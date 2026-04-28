from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from .db import Base


chore_assignees = Table(
    "chore_assignees",
    Base.metadata,
    Column("chore_id", ForeignKey("chores.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", ForeignKey("family_members.id", ondelete="CASCADE"), primary_key=True),
)


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#888888")
    avatar_emoji = Column(String, nullable=False, default="🙂")
    is_kid = Column(Boolean, nullable=False, default=False)


class Chore(Base):
    __tablename__ = "chores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    emoji = Column(String, nullable=False, default="✅")
    star_value = Column(Integer, nullable=False, default=0)
    # "none" = one-shot, "daily", "weekdays" (days-of-week list)
    recurrence = Column(String, nullable=False, default="none")
    # Active days of week when recurrence == "weekdays".
    # Stored as a JSON array of ints, JS-style: 0=Sun..6=Sat
    weekdays = Column(JSON, nullable=True)
    # Optional time-of-day grouping: "morning" / "afternoon" / "evening" / null
    time_of_day = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    assignees = relationship("FamilyMember", secondary=chore_assignees, lazy="joined")


class ChoreCompletion(Base):
    __tablename__ = "chore_completions"

    id = Column(Integer, primary_key=True, index=True)
    chore_id = Column(Integer, ForeignKey("chores.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    stars_awarded = Column(Integer, nullable=False, default=0)


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    emoji = Column(String, nullable=False, default="🎁")
    star_cost = Column(Integer, nullable=False, default=1)


class Redemption(Base):
    __tablename__ = "redemptions"

    id = Column(Integer, primary_key=True, index=True)
    reward_id = Column(Integer, ForeignKey("rewards.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    star_cost = Column(Integer, nullable=False)
    reward_name = Column(String, nullable=False)
    reward_emoji = Column(String, nullable=False)
    redeemed_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class StarAdjustment(Base):
    __tablename__ = "star_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # positive = bonus, negative = deduction
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class Setting(Base):
    """Generic key/value app settings (e.g. weather location)."""
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)


class GoogleAccount(Base):
    __tablename__ = "google_accounts"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True)
    refresh_token = Column(String, nullable=False)
    connected_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    last_synced_at = Column(DateTime, nullable=True)


class CalendarSubscription(Base):
    __tablename__ = "calendar_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("google_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    google_calendar_id = Column(String, nullable=False)
    summary = Column(String, nullable=False, default="")
    background_color = Column(String, nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    enabled = Column(Boolean, nullable=False, default=False)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True, index=True)


class TodoList(Base):
    __tablename__ = "todo_lists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    emoji = Column(String, nullable=False, default="📝")
    color = Column(String, nullable=False, default="#86b9f7")
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class TodoItem(Base):
    __tablename__ = "todo_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("todo_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String, nullable=False)
    done = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("google_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    google_event_id = Column(String, nullable=False, index=True)
    calendar_id = Column(String, nullable=False)
    color = Column(String, nullable=True)
    member_id = Column(Integer, ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True, index=True)
    summary = Column(String, nullable=False, default="")
    location = Column(String, nullable=True)
    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=False)
    all_day = Column(Boolean, nullable=False, default=False)
