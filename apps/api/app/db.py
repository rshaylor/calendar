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
    """Lightweight additive migrations for SQLite (create_all only handles new tables)."""
    inspector = inspect(engine)

    additions = [
        ("calendar_events", "color", "VARCHAR"),
        ("calendar_events", "member_id", "INTEGER"),
        ("calendar_subscriptions", "member_id", "INTEGER"),
        ("chores", "weekdays", "TEXT"),
    ]
    for table, col, coltype in additions:
        if table not in inspector.get_table_names():
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        if col not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
