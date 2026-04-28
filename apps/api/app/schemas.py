from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Recurrence = Literal["none", "daily", "weekdays"]
TimeOfDay = Literal["morning", "afternoon", "evening"]


class FamilyMemberBase(BaseModel):
    name: str
    color: str = "#888888"
    avatar_emoji: str = "🙂"
    is_kid: bool = False


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberRead(FamilyMemberBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ChoreBase(BaseModel):
    name: str
    emoji: str = "✅"
    star_value: int = Field(default=0, ge=0)
    recurrence: Recurrence = "none"
    # 0=Sun..6=Sat. Only meaningful when recurrence == "weekdays".
    weekdays: list[int] | None = None
    # Routine grouping; null means a generic "Chore" (no specific time).
    time_of_day: TimeOfDay | None = None


class ChoreCreate(ChoreBase):
    assignee_ids: list[int] = []


class ChoreRead(ChoreBase):
    id: int
    assignees: list[FamilyMemberRead]
    done_today_by: list[int] = []
    model_config = ConfigDict(from_attributes=True)


class ChoreCompletionRead(BaseModel):
    id: int
    chore_id: int
    member_id: int
    completed_at: datetime
    stars_awarded: int
    model_config = ConfigDict(from_attributes=True)


class ChoreCompletionCreate(BaseModel):
    member_id: int


class RewardBase(BaseModel):
    name: str
    emoji: str = "🎁"
    star_cost: int = Field(default=1, ge=1)


class RewardCreate(RewardBase):
    pass


class RewardRead(RewardBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class RedeemCreate(BaseModel):
    member_id: int


class RedemptionRead(BaseModel):
    id: int
    reward_id: int
    member_id: int
    star_cost: int
    reward_name: str
    reward_emoji: str
    redeemed_at: datetime
    model_config = ConfigDict(from_attributes=True)


class Balance(BaseModel):
    member_id: int
    stars: int


class StarAdjustmentCreate(BaseModel):
    amount: int
    reason: str | None = None


class StarAdjustmentRead(BaseModel):
    id: int
    member_id: int
    amount: int
    reason: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HistoryEntry(BaseModel):
    type: Literal["chore", "reward", "adjust"]
    amount: int
    label: str
    emoji: str
    at: datetime


class TodoListBase(BaseModel):
    name: str
    emoji: str = "📝"
    color: str = "#86b9f7"


class TodoListCreate(TodoListBase):
    pass


class TodoListUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None
    color: str | None = None


class TodoListRead(TodoListBase):
    id: int
    position: int
    item_count: int = 0
    done_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class TodoItemBase(BaseModel):
    text: str
    done: bool = False


class TodoItemCreate(TodoItemBase):
    pass


class TodoItemUpdate(BaseModel):
    text: str | None = None
    done: bool | None = None


class TodoItemRead(TodoItemBase):
    id: int
    list_id: int
    position: int
    model_config = ConfigDict(from_attributes=True)


class GoogleAccountRead(BaseModel):
    id: int
    email: str
    connected_at: datetime
    last_synced_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class CalendarEventRead(BaseModel):
    id: int
    google_event_id: str
    calendar_id: str
    summary: str
    location: str | None
    color: str | None = None
    member_id: int | None = None
    start_at: datetime
    end_at: datetime
    all_day: bool
    model_config = ConfigDict(from_attributes=True)


class CalendarSubscriptionRead(BaseModel):
    id: int
    account_id: int
    google_calendar_id: str
    summary: str
    background_color: str | None
    is_primary: bool
    enabled: bool
    member_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class CalendarSubscriptionUpdate(BaseModel):
    enabled: bool | None = None
    member_id: int | None = None


class EventWrite(BaseModel):
    subscription_id: int
    summary: str
    location: str | None = None
    all_day: bool = False
    start: str
    end: str


class EventPatch(BaseModel):
    subscription_id: int | None = None
    summary: str | None = None
    location: str | None = None
    all_day: bool | None = None
    start: str | None = None
    end: str | None = None


class AuthUrl(BaseModel):
    url: str
