import base64
import json
import logging
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from .. import google_calendar as gcal
from .. import models, schemas
from ..db import get_db

log = logging.getLogger("calendar.router")


def _google_error_detail(exc: Exception, action: str) -> str:
    if isinstance(exc, HttpError):
        try:
            payload = exc.error_details if hasattr(exc, "error_details") else None
            reason = payload[0].get("message") if payload else None
        except Exception:
            reason = None
        if not reason:
            reason = str(exc)
        return f"Google rejected the {action}: {reason}"
    return f"{action} failed: {exc}"

router = APIRouter(prefix="/calendar", tags=["calendar"])

WEB_ORIGIN_FALLBACK = "http://localhost:5173"


def _encode_state(payload: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def _decode_state(state: str | None) -> dict:
    if not state:
        return {}
    try:
        return json.loads(base64.urlsafe_b64decode(state.encode()).decode())
    except Exception:
        return {}


@router.get("/status")
def status(db: Session = Depends(get_db)):
    return {
        "configured": gcal.is_configured(),
        "redirect_uri": gcal.REDIRECT_URI,
        "accounts": [
            {
                "id": a.id,
                "email": a.email,
                "connected_at": a.connected_at,
                "last_synced_at": a.last_synced_at,
            }
            for a in db.query(models.GoogleAccount).all()
        ],
    }


@router.get("/auth-url", response_model=schemas.AuthUrl)
def auth_url(return_to: str | None = Query(default=None)):
    if not gcal.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Google credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )
    flow = gcal.make_flow()
    state = _encode_state({"return_to": return_to or ""})
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return {"url": url}


def _redirect_to(return_to: str | None, params: dict[str, str]) -> RedirectResponse:
    target = return_to or f"{WEB_ORIGIN_FALLBACK}/"
    sep = "&" if "?" in target else "?"
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{target}{sep}{qs}", status_code=302)


@router.get("/callback")
def callback(
    code: str = Query(...),
    state: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if not gcal.is_configured():
        raise HTTPException(status_code=400, detail="Google credentials not configured.")

    return_to = _decode_state(state).get("return_to") or None

    flow = gcal.make_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    if not creds.refresh_token:
        return _redirect_to(return_to, {"calendar_error": "no_refresh_token"})

    email = gcal.fetch_userinfo_email(creds)
    if not email:
        return _redirect_to(return_to, {"calendar_error": "no_email"})

    existing = db.query(models.GoogleAccount).filter_by(email=email).first()
    if existing:
        existing.refresh_token = creds.refresh_token
        existing.connected_at = datetime.now(timezone.utc)
        account = existing
    else:
        account = models.GoogleAccount(email=email, refresh_token=creds.refresh_token)
        db.add(account)
    db.commit()
    db.refresh(account)

    try:
        gcal.upsert_subscriptions(db, account)
        gcal.sync_account(db, account)
    except Exception:
        pass

    return _redirect_to(return_to, {"tab": "calendar", "connected": "1"})


@router.delete("/accounts/{account_id}", status_code=204)
def disconnect(account_id: int, db: Session = Depends(get_db)):
    account = db.get(models.GoogleAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(account)
    db.commit()


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
                # Feb 29 on a non-leap year: shift to Feb 28
                day = date(year, bday.month, 28)
            ev_start = datetime.combine(day, time.min, tzinfo=timezone.utc)
            ev_end = ev_start + timedelta(days=1)
            if ev_end <= start or ev_start >= end:
                continue
            age = year - bday.year
            label = f"🎂 {m.name}'s birthday"
            if age >= 0:
                label += f" ({age})"
            # Negative IDs for synthetic events; stable across requests.
            synth_id = -(m.id * 10000 + (year % 10000))
            out.append(
                schemas.CalendarEventRead(
                    id=synth_id,
                    google_event_id=f"birthday:{m.id}:{year}",
                    calendar_id="synthetic",
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
    days: int = Query(default=None, ge=1, le=60),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if from_date and to_date:
        start = datetime.fromisoformat(from_date)
        end = datetime.fromisoformat(to_date)
    else:
        start = datetime.now(timezone.utc)
        end = start + timedelta(days=days or 7)

    real = (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.end_at >= start,
            models.CalendarEvent.start_at <= end,
        )
        .order_by(models.CalendarEvent.start_at)
        .all()
    )
    real_models = [schemas.CalendarEventRead.model_validate(e) for e in real]
    combined = real_models + _birthday_events(db, start, end)
    combined.sort(key=lambda e: e.start_at)
    return combined


@router.post("/sync", status_code=202)
def trigger_sync():
    gcal.sync_all()
    return {"status": "ok"}


def _account_for_subscription(db: Session, subscription_id: int) -> tuple[models.GoogleAccount, models.CalendarSubscription]:
    sub = db.get(models.CalendarSubscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Calendar not found")
    account = db.get(models.GoogleAccount, sub.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account, sub


def _find_event_after_sync(db: Session, account_id: int, google_event_id: str):
    return (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.account_id == account_id,
            models.CalendarEvent.google_event_id == google_event_id,
        )
        .first()
    )


@router.post("/events", response_model=schemas.CalendarEventRead, status_code=201)
def create_event(payload: schemas.EventWrite, db: Session = Depends(get_db)):
    account, sub = _account_for_subscription(db, payload.subscription_id)
    body = gcal.build_event_body(
        payload.summary, payload.location, payload.start, payload.end, payload.all_day
    )
    log.info("Creating event on %s body=%s", sub.google_calendar_id, body)
    try:
        result = gcal.insert_event(account, sub.google_calendar_id, body)
    except Exception as e:
        log.exception("event create failed")
        raise HTTPException(status_code=400, detail=_google_error_detail(e, "create"))
    gcal.sync_account(db, account)
    event = _find_event_after_sync(db, account.id, result["id"])
    if not event:
        raise HTTPException(status_code=500, detail="Event created but not found in cache")
    return event


@router.patch("/events/{event_id}", response_model=schemas.CalendarEventRead)
def update_event(event_id: int, payload: schemas.EventPatch, db: Session = Depends(get_db)):
    event = db.get(models.CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    account = db.get(models.GoogleAccount, event.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    current_calendar_id = event.calendar_id
    google_event_id = event.google_event_id

    # Move calendars if requested
    if payload.subscription_id is not None:
        target_sub = db.get(models.CalendarSubscription, payload.subscription_id)
        if not target_sub:
            raise HTTPException(status_code=404, detail="Target calendar not found")
        if target_sub.account_id != account.id:
            raise HTTPException(
                status_code=400,
                detail="Moving events between accounts isn't supported.",
            )
        if target_sub.google_calendar_id != current_calendar_id:
            try:
                moved = gcal.move_event(
                    account, current_calendar_id, google_event_id, target_sub.google_calendar_id
                )
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Move failed: {e}")
            current_calendar_id = target_sub.google_calendar_id
            google_event_id = moved["id"]

    # Apply other changes
    body: dict = {}
    if payload.summary is not None:
        body["summary"] = payload.summary
    if payload.location is not None:
        body["location"] = payload.location
    if payload.start is not None or payload.end is not None or payload.all_day is not None:
        all_day = payload.all_day if payload.all_day is not None else event.all_day
        start = payload.start if payload.start is not None else event.start_at.isoformat()
        end = payload.end if payload.end is not None else event.end_at.isoformat()
        time_body = gcal.build_event_body("", "", start, end, all_day)
        body["start"] = time_body["start"]
        body["end"] = time_body["end"]

    if body:
        try:
            gcal.patch_event(account, current_calendar_id, google_event_id, body)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Update failed: {e}")

    gcal.sync_account(db, account)
    fresh = _find_event_after_sync(db, account.id, google_event_id)
    if not fresh:
        raise HTTPException(status_code=500, detail="Event updated but not found in cache")
    return fresh


@router.delete("/events/{event_id}", status_code=204)
def remove_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(models.CalendarEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    account = db.get(models.GoogleAccount, event.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        gcal.delete_event(account, event.calendar_id, event.google_event_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Delete failed: {e}")
    db.delete(event)
    db.commit()


@router.get("/subscriptions", response_model=list[schemas.CalendarSubscriptionRead])
def list_subscriptions(db: Session = Depends(get_db)):
    return (
        db.query(models.CalendarSubscription)
        .order_by(
            models.CalendarSubscription.account_id,
            models.CalendarSubscription.is_primary.desc(),
            models.CalendarSubscription.summary,
        )
        .all()
    )


@router.patch("/subscriptions/{sub_id}", response_model=schemas.CalendarSubscriptionRead)
def update_subscription(
    sub_id: int,
    payload: schemas.CalendarSubscriptionUpdate,
    db: Session = Depends(get_db),
):
    sub = db.get(models.CalendarSubscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.enabled is not None:
        sub.enabled = payload.enabled
    if "member_id" in payload.model_fields_set:
        sub.member_id = payload.member_id
    db.commit()
    db.refresh(sub)
    # Re-sync so events pick up new color/owner
    account = db.get(models.GoogleAccount, sub.account_id)
    if account:
        try:
            gcal.sync_account(db, account)
        except Exception:
            pass
    return sub


@router.post("/subscriptions/refresh", status_code=202)
def refresh_subscriptions(db: Session = Depends(get_db)):
    for account in db.query(models.GoogleAccount).all():
        try:
            gcal.upsert_subscriptions(db, account)
        except Exception:
            pass
    return {"status": "ok"}
