from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from . import google_calendar
from .db import Base, engine, ensure_schema
from .routers import calendar, chores, members, rewards

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
