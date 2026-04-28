import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from . import models
from .db import SessionLocal

log = logging.getLogger("calendar")

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/calendar/callback"
)
SYNC_INTERVAL_SECONDS = int(os.environ.get("CALENDAR_SYNC_SECONDS", "600"))
SYNC_DAYS_AHEAD = int(os.environ.get("CALENDAR_DAYS_AHEAD", "14"))


def is_configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET)


def _client_config() -> dict:
    return {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }


def make_flow(state: str | None = None) -> Flow:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, state=state)
    flow.redirect_uri = REDIRECT_URI
    return flow


def credentials_from_refresh_token(refresh_token: str) -> Credentials:
    # Don't pass scopes here — let Google return whatever the token was granted.
    # If we ask for scopes the existing token doesn't cover, refresh fails with
    # invalid_scope. To gain new scopes (e.g. write), the user must reconnect.
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(GoogleRequest())
    return creds


def fetch_userinfo_email(creds: Credentials) -> str:
    service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
    info = service.userinfo().get().execute()
    return info.get("email", "")


def list_google_calendars(creds: Credentials) -> list[dict]:
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    result = service.calendarList().list().execute()
    return result.get("items", [])


def upsert_subscriptions(db: Session, account: models.GoogleAccount) -> None:
    creds = credentials_from_refresh_token(account.refresh_token)
    items = list_google_calendars(creds)

    existing = {
        s.google_calendar_id: s
        for s in db.query(models.CalendarSubscription)
        .filter(models.CalendarSubscription.account_id == account.id)
        .all()
    }
    seen_ids: set[str] = set()

    for item in items:
        cal_id = item["id"]
        seen_ids.add(cal_id)
        is_primary = bool(item.get("primary"))
        sub = existing.get(cal_id)
        if sub is None:
            sub = models.CalendarSubscription(
                account_id=account.id,
                google_calendar_id=cal_id,
                summary=item.get("summary", ""),
                background_color=item.get("backgroundColor"),
                is_primary=is_primary,
                enabled=is_primary,  # default to primary on first sight
            )
            db.add(sub)
        else:
            sub.summary = item.get("summary", sub.summary)
            sub.background_color = item.get("backgroundColor", sub.background_color)
            sub.is_primary = is_primary

    # Drop subscriptions for calendars the user no longer has access to
    for cal_id, sub in existing.items():
        if cal_id not in seen_ids:
            db.delete(sub)

    db.commit()


def _parse_event_time(value: dict) -> tuple[datetime, bool]:
    if "dateTime" in value:
        # Google returns RFC3339 strings; fromisoformat handles them in 3.11+
        return datetime.fromisoformat(value["dateTime"]).astimezone(timezone.utc), False
    # all-day event
    return datetime.fromisoformat(value["date"]).replace(tzinfo=timezone.utc), True


def sync_account(db: Session, account: models.GoogleAccount) -> int:
    creds = credentials_from_refresh_token(account.refresh_token)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    subscriptions = (
        db.query(models.CalendarSubscription)
        .filter(
            models.CalendarSubscription.account_id == account.id,
            models.CalendarSubscription.enabled == True,  # noqa: E712
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=SYNC_DAYS_AHEAD)).isoformat()

    # Replace this account's events for the window with fresh data from enabled calendars
    db.query(models.CalendarEvent).filter(
        models.CalendarEvent.account_id == account.id
    ).delete()

    total = 0
    for sub in subscriptions:
        try:
            events_result = (
                service.events()
                .list(
                    calendarId=sub.google_calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=250,
                )
                .execute()
            )
        except Exception:
            log.exception("failed to list events for %s", sub.summary)
            continue

        for item in events_result.get("items", []):
            if item.get("status") == "cancelled":
                continue
            start_at, all_day = _parse_event_time(item.get("start", {}))
            end_at, _ = _parse_event_time(item.get("end", {}))
            db.add(
                models.CalendarEvent(
                    account_id=account.id,
                    google_event_id=item["id"],
                    calendar_id=sub.google_calendar_id,
                    color=sub.background_color,
                    member_id=sub.member_id,
                    summary=item.get("summary", "(no title)"),
                    location=item.get("location"),
                    start_at=start_at,
                    end_at=end_at,
                    all_day=all_day,
                )
            )
            total += 1

    account.last_synced_at = now
    db.commit()
    return total


def sync_all() -> None:
    if not is_configured():
        return
    db = SessionLocal()
    try:
        accounts = db.query(models.GoogleAccount).all()
        for account in accounts:
            try:
                count = sync_account(db, account)
                log.info("synced %s: %d events", account.email, count)
            except Exception:
                log.exception("sync failed for %s", account.email)
    finally:
        db.close()


def build_event_body(
    summary: str,
    location: str | None,
    start: str,
    end: str,
    all_day: bool,
) -> dict:
    if all_day:
        return {
            "summary": summary,
            "location": location or "",
            "start": {"date": start[:10]},
            "end": {"date": end[:10]},
        }
    return {
        "summary": summary,
        "location": location or "",
        "start": {"dateTime": start},
        "end": {"dateTime": end},
    }


def _service(account: models.GoogleAccount):
    creds = credentials_from_refresh_token(account.refresh_token)
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def insert_event(account: models.GoogleAccount, calendar_id: str, body: dict) -> dict:
    return _service(account).events().insert(calendarId=calendar_id, body=body).execute()


def patch_event(
    account: models.GoogleAccount, calendar_id: str, event_id: str, body: dict
) -> dict:
    return (
        _service(account)
        .events()
        .patch(calendarId=calendar_id, eventId=event_id, body=body)
        .execute()
    )


def delete_event(account: models.GoogleAccount, calendar_id: str, event_id: str) -> None:
    _service(account).events().delete(calendarId=calendar_id, eventId=event_id).execute()


def move_event(
    account: models.GoogleAccount,
    source_calendar_id: str,
    event_id: str,
    destination_calendar_id: str,
) -> dict:
    return (
        _service(account)
        .events()
        .move(
            calendarId=source_calendar_id,
            eventId=event_id,
            destination=destination_calendar_id,
        )
        .execute()
    )


_sync_thread: threading.Thread | None = None


def start_background_sync() -> None:
    global _sync_thread
    if _sync_thread and _sync_thread.is_alive():
        return

    def loop() -> None:
        while True:
            try:
                sync_all()
            except Exception:
                log.exception("sync loop error")
            time.sleep(SYNC_INTERVAL_SECONDS)

    _sync_thread = threading.Thread(target=loop, daemon=True, name="calendar-sync")
    _sync_thread.start()
