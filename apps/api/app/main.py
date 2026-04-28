import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from . import google_calendar
from .db import Base, engine, ensure_schema
from .routers import calendar, chores, lists, members, rewards, weather

Base.metadata.create_all(bind=engine)
ensure_schema()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    google_calendar.start_background_sync()
    yield


app = FastAPI(title="Family Hub API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(members.router, prefix="/api")
app.include_router(chores.router, prefix="/api")
app.include_router(rewards.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(lists.router, prefix="/api")

# In prod the frontend is built into ./static and served from the same origin.
# Mount last so /api routes win.
_static_dir = Path(os.environ.get("STATIC_DIR", "static"))
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
