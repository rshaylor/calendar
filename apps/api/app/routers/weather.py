import json
import logging
import os
import time
import urllib.request
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import SessionLocal, get_db

router = APIRouter(prefix="/weather", tags=["weather"])

log = logging.getLogger("weather")
_cache: dict[str, Any] = {"at": 0.0, "data": None}
_TTL_SECONDS = 600  # 10 min

LOCATION_KEY = "weather.location"


class WeatherLocation(BaseModel):
    lat: float | None = None
    lon: float | None = None


def _read_location_from_db(db: Session) -> tuple[str, str]:
    s = db.get(models.Setting, LOCATION_KEY)
    if s and s.value:
        try:
            data = json.loads(s.value)
            lat = data.get("lat")
            lon = data.get("lon")
            if lat is not None and lon is not None:
                return str(lat), str(lon)
        except Exception:
            pass
    return "", ""


def _resolve_location(db: Session) -> tuple[str, str]:
    lat, lon = _read_location_from_db(db)
    if lat and lon:
        return lat, lon
    return (
        os.environ.get("LOCATION_LAT", "").strip(),
        os.environ.get("LOCATION_LON", "").strip(),
    )


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
    db = SessionLocal()
    try:
        lat, lon = _resolve_location(db)
    finally:
        db.close()

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


@router.get("/location", response_model=WeatherLocation)
def get_location(db: Session = Depends(get_db)):
    lat, lon = _resolve_location(db)
    return WeatherLocation(
        lat=float(lat) if lat else None,
        lon=float(lon) if lon else None,
    )


@router.put("/location", response_model=WeatherLocation)
def set_location(payload: WeatherLocation, db: Session = Depends(get_db)):
    if payload.lat is None and payload.lon is None:
        # Clear: revert to env-var fallback
        s = db.get(models.Setting, LOCATION_KEY)
        if s:
            db.delete(s)
            db.commit()
        _cache["data"] = None
        return get_location(db)

    if payload.lat is None or payload.lon is None:
        raise HTTPException(status_code=400, detail="Both lat and lon are required")
    if not (-90 <= payload.lat <= 90) or not (-180 <= payload.lon <= 180):
        raise HTTPException(status_code=400, detail="Coordinates out of range")

    s = db.get(models.Setting, LOCATION_KEY)
    body = json.dumps({"lat": payload.lat, "lon": payload.lon})
    if s:
        s.value = body
    else:
        s = models.Setting(key=LOCATION_KEY, value=body)
        db.add(s)
    db.commit()
    _cache["data"] = None  # invalidate cache so next /weather fetches fresh
    return WeatherLocation(lat=payload.lat, lon=payload.lon)
