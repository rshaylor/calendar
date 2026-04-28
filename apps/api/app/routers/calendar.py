from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .. import google_calendar as gcal
from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/calendar", tags=["calendar"])

WEB_ORIGIN = "http://localhost:5173"


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
def auth_url():
    if not gcal.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Google credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )
    flow = gcal.make_flow()
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"url": url}


@router.get("/callback")
def callback(code: str = Query(...), db: Session = Depends(get_db)):
    if not gcal.is_configured():
        raise HTTPException(status_code=400, detail="Google credentials not configured.")

    flow = gcal.make_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    if not creds.refresh_token:
        return RedirectResponse(
            f"{WEB_ORIGIN}/?calendar_error=no_refresh_token", status_code=302
        )

    email = gcal.fetch_userinfo_email(creds)
    if not email:
        return RedirectResponse(f"{WEB_ORIGIN}/?calendar_error=no_email", status_code=302)

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

    return RedirectResponse(f"{WEB_ORIGIN}/?tab=calendar&connected=1", status_code=302)


@router.delete("/accounts/{account_id}", status_code=204)
def disconnect(account_id: int, db: Session = Depends(get_db)):
    account = db.get(models.GoogleAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(account)
    db.commit()


@router.get("/events", response_model=list[schemas.CalendarEventRead])
def list_events(days: int = Query(default=7, ge=1, le=30), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=days)
    return (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.end_at >= now,
            models.CalendarEvent.start_at <= until,
        )
        .order_by(models.CalendarEvent.start_at)
        .all()
    )


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
    try:
        result = gcal.insert_event(account, sub.google_calendar_id, body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google API error: {e}")
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
