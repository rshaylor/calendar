"""Home Assistant Calendar client.

Replaces the previous direct-Google integration. The Family Hub add-on now
reads and writes calendar data through HA Core, which means the user sets up
Google Calendar (or any other calendar integration — CalDAV, Local Calendar,
Office 365, etc.) once in HA and we consume it from here.

REST API handles list/read and create_event; update and delete are only
available via HA's WebSocket API.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

import httpx
from websockets.sync.client import connect as ws_connect

log = logging.getLogger("ha_calendar")

SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
HA_REST_BASE = os.environ.get("HA_REST_BASE", "http://supervisor/core/api")
HA_WS_URL = os.environ.get("HA_WS_URL", "ws://supervisor/core/websocket")

_HTTP_TIMEOUT = httpx.Timeout(15.0)
_ws_id_lock = threading.Lock()
_ws_id_counter = 0


def _next_ws_id() -> int:
    global _ws_id_counter
    with _ws_id_lock:
        _ws_id_counter += 1
        return _ws_id_counter


class HAError(RuntimeError):
    """A call to Home Assistant failed."""


def is_configured() -> bool:
    return bool(SUPERVISOR_TOKEN)


def _rest_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {SUPERVISOR_TOKEN}"}


def list_calendars() -> list[dict[str, Any]]:
    """Return [{entity_id, name}, ...] for every calendar entity HA knows about."""
    r = httpx.get(f"{HA_REST_BASE}/calendars", headers=_rest_headers(), timeout=_HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


def list_events(entity_id: str, start_iso: str, end_iso: str) -> list[dict[str, Any]]:
    """Fetch events for a single calendar entity in [start, end)."""
    r = httpx.get(
        f"{HA_REST_BASE}/calendars/{entity_id}",
        params={"start": start_iso, "end": end_iso},
        headers=_rest_headers(),
        timeout=_HTTP_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def create_event(
    entity_id: str,
    summary: str,
    location: str | None,
    start: str,
    end: str,
    all_day: bool,
) -> None:
    body: dict[str, Any] = {"entity_id": entity_id, "summary": summary}
    if location:
        body["location"] = location
    if all_day:
        body["start_date"] = start[:10]
        body["end_date"] = end[:10]
    else:
        body["start_date_time"] = start
        body["end_date_time"] = end
    r = httpx.post(
        f"{HA_REST_BASE}/services/calendar/create_event",
        json=body,
        headers=_rest_headers(),
        timeout=_HTTP_TIMEOUT,
    )
    r.raise_for_status()


def _ws_send_command(command: dict[str, Any]) -> dict[str, Any]:
    """Open a WebSocket, authenticate, send one command, return the result."""
    with ws_connect(HA_WS_URL, open_timeout=10, close_timeout=5) as ws:
        hello = json.loads(ws.recv(timeout=10))
        if hello.get("type") != "auth_required":
            raise HAError(f"unexpected hello: {hello}")
        ws.send(json.dumps({"type": "auth", "access_token": SUPERVISOR_TOKEN}))
        auth_resp = json.loads(ws.recv(timeout=10))
        if auth_resp.get("type") != "auth_ok":
            raise HAError(f"auth failed: {auth_resp}")
        msg_id = _next_ws_id()
        ws.send(json.dumps({"id": msg_id, **command}))
        result = json.loads(ws.recv(timeout=15))
        if not result.get("success", False):
            err = result.get("error") or result
            raise HAError(f"{command['type']} failed: {err}")
        return result.get("result") or {}


def _ws_event_payload(
    summary: str,
    location: str | None,
    start: str,
    end: str,
    all_day: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"summary": summary}
    if location is not None:
        payload["location"] = location
    if all_day:
        payload["dtstart"] = start[:10]
        payload["dtend"] = end[:10]
    else:
        payload["dtstart"] = start
        payload["dtend"] = end
    return payload


def update_event(
    entity_id: str,
    uid: str,
    summary: str,
    location: str | None,
    start: str,
    end: str,
    all_day: bool,
    recurrence_id: str | None = None,
    recurrence_range: str | None = None,
) -> None:
    cmd: dict[str, Any] = {
        "type": "calendar/event/update",
        "entity_id": entity_id,
        "uid": uid,
        "event": _ws_event_payload(summary, location, start, end, all_day),
    }
    if recurrence_id:
        cmd["recurrence_id"] = recurrence_id
    if recurrence_range:
        cmd["recurrence_range"] = recurrence_range
    _ws_send_command(cmd)


def delete_event(
    entity_id: str,
    uid: str,
    recurrence_id: str | None = None,
    recurrence_range: str | None = None,
) -> None:
    cmd: dict[str, Any] = {
        "type": "calendar/event/delete",
        "entity_id": entity_id,
        "uid": uid,
    }
    if recurrence_id:
        cmd["recurrence_id"] = recurrence_id
    if recurrence_range:
        cmd["recurrence_range"] = recurrence_range
    _ws_send_command(cmd)
