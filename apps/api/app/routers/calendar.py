import logging
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import ha_calendar, models, schemas
from ..db import get_db

log = logging.getLogger("calendar.router")
router = APIRouter(prefix="/calendar", tags=["calendar"])


# ---------- helpers ----------

def _parse_event_time(value: dict) -> tuple[datetime, bool]:
    """Convert HA's {date|dateTime} into (utc_datetime, all_day)."""
    if "dateTime" in value:
        return datetime.fromisoformat(value["dateTime"]).astimezone(timezone.utc), False
    return datetime.fromisoformat(value["date"]).replace(tzinfo=timezone.utc), True


def _parse_iso(value: str) -> datetime:
    if "T" in value:
        return datetime.fromisoformat(value)
    return datetime.fromisoformat(value + "T00:00:00").replace(tzinfo=timezone.utc)


def _normalize_event(
    sub: models.CalendarSubscription, raw: dict
) -> schemas.CalendarEventRead | None:
    start_raw = raw.get("start") or {}
    end_raw = raw.get("end") or {}
    if not start_raw or not end_raw:
        return None
    start_at, all_day = _parse_event_time(start_raw)
    end_at, _ = _parse_event_time(end_raw)
    uid = raw.get("uid")
    if not uid:
        # HA *should* always emit a uid; if it doesn't, the event can't be edited.
        # Fabricate a stable-ish key so we can still render it read-only.
        uid = f"noid:{sub.entity_id}:{start_at.isoformat()}"
        read_only = True
    else:
        read_only = False
    return schemas.CalendarEventRead(
        uid=uid,
        entity_id=sub.entity_id,
        summary=raw.get("summary") or "(no title)",
        location=raw.get("location"),
        color=sub.color,
        member_id=sub.member_id,
        start_at=start_at,
        end_at=end_at,
        all_day=all_day,
        read_only=read_only,
    )


def _sync_subscriptions(db: Session) -> list[models.CalendarSubscription]:
    """Reconcile local subscription rows with HA's current calendar list."""
    try:
        ha_calendars = ha_calendar.list_calendars()
    except Exception as e:
        log.warning("Couldn't list HA calendars: %s", e)
        return list(db.query(models.CalendarSubscription).all())

    by_entity = {c["entity_id"]: c for c in ha_calendars}
    existing = {s.entity_id: s for s in db.query(models.CalendarSubscription).all()}

    for entity_id, info in by_entity.items():
        name = info.get("name") or entity_id
        sub = existing.get(entity_id)
        if sub is None:
            db.add(
                models.CalendarSubscription(
                    entity_id=entity_id,
                    friendly_name=name,
                    enabled=True,
                )
            )
        else:
            sub.friendly_name = name

    for entity_id, sub in existing.items():
        if entity_id not in by_entity:
            db.delete(sub)

    db.commit()
    return list(
        db.query(models.CalendarSubscription)
        .order_by(models.CalendarSubscription.friendly_name)
        .all()
    )


# ---------- routes ----------

@router.get("/status")
def status():
    if not ha_calendar.is_configured():
        return {
            "configured": False,
            "reason": "Add-on isn't running with homeassistant_api access — check config.yaml.",
        }
    try:
        cals = ha_calendar.list_calendars()
    except Exception as e:
        return {"configured": False, "reason": f"Couldn't reach Home Assistant: {e}"}
    return {"configured": True, "calendar_count": len(cals)}


@router.get("/subscriptions", response_model=list[schemas.CalendarSubscriptionRead])
def list_subscriptions(db: Session = Depends(get_db)):
    return _sync_subscriptions(db)


@router.patch("/subscriptions/{sub_id}", response_model=schemas.CalendarSubscriptionRead)
def update_subscription(
    sub_id: int,
    payload: schemas.CalendarSubscriptionUpdate,
    db: Session = Depends(get_db),
):
    sub = db.get(models.CalendarSubscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if payload.enabled is not None:
        sub.enabled = payload.enabled
    if "member_id" in payload.model_fields_set:
        sub.member_id = payload.member_id
    if "color" in payload.model_fields_set:
        sub.color = payload.color
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/subscriptions/refresh", status_code=202)
def refresh_subscriptions(db: Session = Depends(get_db)):
    _sync_subscriptions(db)
    return {"status": "ok"}


def _birthday_events(
    db: Session, start: datetime, end: datetime
) -> list[schemas.CalendarEventRead]:
    members = (
        db.query(models.FamilyMember)
        .filter(models.FamilyMember.birth_date.isnot(None))
        .all()
    )
    out: list[schemas.CalendarEventRead] = []
    for m in members:
        bday: date = m.birth_date  # type: ignore[assignment]
        for year in range(start.year, end.year + 1):
            try:
                day = bday.replace(year=year)
            except ValueError:
                # Feb 29 on a non-leap year — show on Feb 28
                day = date(year, bday.month, 28)
            ev_start = datetime.combine(day, time.min, tzinfo=timezone.utc)
            ev_end = ev_start + timedelta(days=1)
            if ev_end <= start or ev_start >= end:
                continue
            age = year - bday.year
            label = f"🎂 {m.name}'s birthday"
            if age >= 0:
                label += f" ({age})"
            out.append(
                schemas.CalendarEventRead(
                    uid=f"birthday:{m.id}:{year}",
                    entity_id="birthday",
                    summary=label,
                    location=None,
                    color=m.color,
                    member_id=m.id,
                    start_at=ev_start,
                    end_at=ev_end,
                    all_day=True,
                    read_only=True,
                )
            )
    return out


@router.get("/events", response_model=list[schemas.CalendarEventRead])
def list_events(
    days: int | None = Query(default=None, ge=1, le=60),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if from_date and to_date:
        start = _parse_iso(from_date)
        end = _parse_iso(to_date)
    else:
        start = datetime.now(timezone.utc)
        end = start + timedelta(days=days or 7)

    subs = _sync_subscriptions(db)
    out: list[schemas.CalendarEventRead] = []
    for sub in subs:
        if not sub.enabled:
            continue
        try:
            raw_events = ha_calendar.list_events(
                sub.entity_id, start.isoformat(), end.isoformat()
            )
        except Exception:
            log.exception("failed to fetch events for %s", sub.entity_id)
            continue
        for raw in raw_events:
            ev = _normalize_event(sub, raw)
            if ev is not None:
                out.append(ev)

    out.extend(_birthday_events(db, start, end))
    out.sort(key=lambda e: e.start_at)
    return out


@router.post("/events", response_model=schemas.CalendarEventRead, status_code=201)
def create_event(payload: schemas.EventWrite, db: Session = Depends(get_db)):
    sub = db.get(models.CalendarSubscription, payload.subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Calendar not found")
    try:
        ha_calendar.create_event(
            entity_id=sub.entity_id,
            summary=payload.summary,
            location=payload.location,
            start=payload.start,
            end=payload.end,
            all_day=payload.all_day,
        )
    except Exception as e:
        log.exception("create_event failed")
        raise HTTPException(status_code=400, detail=f"Create failed: {e}")
    # HA's create_event service doesn't return the created event. Return a
    # placeholder; the frontend re-fetches /events right after save and gets
    # the canonical one with its uid.
    start_dt = _parse_iso(payload.start)
    end_dt = _parse_iso(payload.end)
    return schemas.CalendarEventRead(
        uid="pending",
        entity_id=sub.entity_id,
        summary=payload.summary,
        location=payload.location,
        color=sub.color,
        member_id=sub.member_id,
        start_at=start_dt,
        end_at=end_dt,
        all_day=payload.all_day,
        read_only=False,
    )


@router.patch("/events/{uid:path}", response_model=schemas.CalendarEventRead)
def update_event(
    uid: str,
    payload: schemas.EventPatch,
    entity_id: str = Query(...),
    db: Session = Depends(get_db),
):
    sub = db.query(models.CalendarSubscription).filter_by(entity_id=entity_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Calendar not found for this event")
    # HA's WebSocket update replaces the event wholesale, so we need a full set.
    missing = [
        name
        for name in ("summary", "start", "end", "all_day")
        if getattr(payload, name) is None
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing fields for update: {', '.join(missing)}",
        )
    try:
        ha_calendar.update_event(
            entity_id=entity_id,
            uid=uid,
            summary=payload.summary,  # type: ignore[arg-type]
            location=payload.location,
            start=payload.start,  # type: ignore[arg-type]
            end=payload.end,  # type: ignore[arg-type]
            all_day=payload.all_day,  # type: ignore[arg-type]
        )
    except Exception as e:
        log.exception("update_event failed")
        raise HTTPException(status_code=400, detail=f"Update failed: {e}")
    return schemas.CalendarEventRead(
        uid=uid,
        entity_id=entity_id,
        summary=payload.summary or "",
        location=payload.location,
        color=sub.color,
        member_id=sub.member_id,
        start_at=_parse_iso(payload.start),  # type: ignore[arg-type]
        end_at=_parse_iso(payload.end),  # type: ignore[arg-type]
        all_day=bool(payload.all_day),
        read_only=False,
    )


@router.delete("/events/{uid:path}", status_code=204)
def delete_event(uid: str, entity_id: str = Query(...)):
    try:
        ha_calendar.delete_event(entity_id=entity_id, uid=uid)
    except Exception as e:
        log.exception("delete_event failed")
        raise HTTPException(status_code=400, detail=f"Delete failed: {e}")
