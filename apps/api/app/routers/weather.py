import json
import logging
import os
import time
import urllib.request
from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/weather", tags=["weather"])

log = logging.getLogger("weather")
_cache: dict[str, Any] = {"at": 0.0, "data": None}
_TTL_SECONDS = 600  # 10 min


def _wmo_to_icon(code: int) -> str:
    if code == 0:
        return "☀️"
    if code in (1, 2):
        return "🌤️"
    if code == 3:
        return "☁️"
    if code in (45, 48):
        return "🌫️"
    if code in (51, 53, 55, 56, 57):
        return "🌦️"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "🌧️"
    if code in (71, 73, 75, 77, 85, 86):
        return "❄️"
    if code in (95, 96, 99):
        return "⛈️"
    return "🌡️"


def _wmo_to_label(code: int) -> str:
    return {
        0: "Clear",
        1: "Mostly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Fog",
        51: "Drizzle",
        53: "Drizzle",
        55: "Drizzle",
        56: "Freezing drizzle",
        57: "Freezing drizzle",
        61: "Light rain",
        63: "Rain",
        65: "Heavy rain",
        66: "Freezing rain",
        67: "Freezing rain",
        71: "Light snow",
        73: "Snow",
        75: "Heavy snow",
        77: "Snow",
        80: "Rain showers",
        81: "Rain showers",
        82: "Rain showers",
        85: "Snow showers",
        86: "Snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm",
        99: "Thunderstorm",
    }.get(code, "Weather")


@router.get("")
def get_weather():
    lat = os.environ.get("LOCATION_LAT", "").strip()
    lon = os.environ.get("LOCATION_LON", "").strip()
    if not lat or not lon:
        return {"configured": False}

    if _cache["data"] is not None and time.time() - _cache["at"] < _TTL_SECONDS:
        return _cache["data"]

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&current_weather=true&temperature_unit=celsius"
    )
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            payload = json.load(resp)
    except Exception:
        log.exception("weather fetch failed")
        # On failure return last cached value if we have one, else a graceful empty
        if _cache["data"] is not None:
            return _cache["data"]
        return {"configured": True, "error": "unavailable"}

    cw = payload.get("current_weather") or {}
    code = int(cw.get("weathercode", -1))
    data = {
        "configured": True,
        "temperature": round(cw.get("temperature", 0)),
        "icon": _wmo_to_icon(code),
        "label": _wmo_to_label(code),
        "code": code,
    }
    _cache["at"] = time.time()
    _cache["data"] = data
    return data
