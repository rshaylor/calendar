import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    """Lightweight migrations for SQLite.

    Runs *before* `Base.metadata.create_all`, so we can drop legacy tables
    that have a different shape than the current models, then let create_all
    rebuild them.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # 0.3.0: switched calendar from direct-Google to HA-backed. Drop the legacy
    # google_accounts / calendar_events tables; reshape calendar_subscriptions
    # if it still has the old (account_id, google_calendar_id) schema.
    legacy_drops: list[str] = []
    if "google_accounts" in tables:
        legacy_drops.append("google_accounts")
    if "calendar_events" in tables:
        legacy_drops.append("calendar_events")
    if "calendar_subscriptions" in tables:
        cols = {c["name"] for c in inspector.get_columns("calendar_subscriptions")}
        if "account_id" in cols or "google_calendar_id" in cols:
            legacy_drops.append("calendar_subscriptions")
    if legacy_drops:
        with engine.begin() as conn:
            for table in legacy_drops:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))

    # Additive column migrations on still-current tables. Run after drops so
    # we don't try to ALTER tables we're about to recreate.
    inspector = inspect(engine)
    additions = [
        ("chores", "weekdays", "TEXT"),
        ("chores", "time_of_day", "VARCHAR"),
        ("family_members", "birth_date", "DATE"),
    ]
    for table, col, coltype in additions:
        if table not in inspector.get_table_names():
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        if col not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
