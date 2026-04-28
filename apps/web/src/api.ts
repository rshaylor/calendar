export type FamilyMember = {
  id: number;
  name: string;
  color: string;
  avatar_emoji: string;
  is_kid: boolean;
  birth_date: string | null; // YYYY-MM-DD
};

export type FamilyMemberInput = Omit<FamilyMember, "id">;
export type FamilyMemberPatch = Partial<FamilyMemberInput>;

export type FamilyInfo = { name: string };

export type Recurrence = "none" | "daily" | "weekdays";

// JS-style: 0=Sun, 1=Mon, ..., 6=Sat
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type Chore = {
  id: number;
  name: string;
  emoji: string;
  star_value: number;
  recurrence: Recurrence;
  weekdays: number[] | null;
  time_of_day: TimeOfDay | null;
  assignees: FamilyMember[];
  done_today_by: number[];
};

export type ChoreInput = {
  name: string;
  emoji: string;
  star_value: number;
  recurrence: Recurrence;
  weekdays: number[] | null;
  time_of_day: TimeOfDay | null;
  assignee_ids: number[];
};

export type Reward = {
  id: number;
  name: string;
  emoji: string;
  star_cost: number;
};

export type RewardInput = Omit<Reward, "id">;

export type Balance = { member_id: number; stars: number };

export type Redemption = {
  id: number;
  reward_id: number;
  member_id: number;
  star_cost: number;
  reward_name: string;
  reward_emoji: string;
  redeemed_at: string;
};

export type HistoryEntry = {
  type: "chore" | "reward" | "adjust";
  amount: number;
  label: string;
  emoji: string;
  at: string;
};

export type GoogleAccount = {
  id: number;
  email: string;
  connected_at: string;
  last_synced_at: string | null;
};

export type CalendarStatus = {
  configured: boolean;
  redirect_uri: string;
  accounts: GoogleAccount[];
};

export type CalendarEvent = {
  id: number;
  google_event_id: string;
  calendar_id: string;
  summary: string;
  location: string | null;
  color: string | null;
  member_id: number | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  read_only?: boolean;
};

export type CalendarSubscription = {
  id: number;
  account_id: number;
  google_calendar_id: string;
  summary: string;
  background_color: string | null;
  is_primary: boolean;
  enabled: boolean;
  member_id: number | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") message = body.detail;
    } catch {
      /* swallow non-JSON bodies */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listMembers: () => request<FamilyMember[]>("/members"),
  createMember: (m: FamilyMemberInput) =>
    request<FamilyMember>("/members", { method: "POST", body: JSON.stringify(m) }),
  updateMember: (id: number, patch: FamilyMemberPatch) =>
    request<FamilyMember>(`/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteMember: (id: number) => request<void>(`/members/${id}`, { method: "DELETE" }),

  familyInfo: () => request<FamilyInfo>("/family"),
  setFamilyInfo: (info: FamilyInfo) =>
    request<FamilyInfo>("/family", { method: "PUT", body: JSON.stringify(info) }),

  listChores: () => request<Chore[]>("/chores"),
  createChore: (c: ChoreInput) =>
    request<Chore>("/chores", { method: "POST", body: JSON.stringify(c) }),
  deleteChore: (id: number) => request<void>(`/chores/${id}`, { method: "DELETE" }),
  completeChore: (choreId: number, memberId: number) =>
    request<void>(`/chores/${choreId}/complete`, {
      method: "POST",
      body: JSON.stringify({ member_id: memberId }),
    }),
  uncompleteChore: (choreId: number, memberId: number) =>
    request<void>(`/chores/${choreId}/complete/${memberId}`, { method: "DELETE" }),

  listRewards: () => request<Reward[]>("/rewards"),
  createReward: (r: RewardInput) =>
    request<Reward>("/rewards", { method: "POST", body: JSON.stringify(r) }),
  deleteReward: (id: number) => request<void>(`/rewards/${id}`, { method: "DELETE" }),
  redeemReward: (rewardId: number, memberId: number) =>
    request<Redemption>(`/rewards/${rewardId}/redeem`, {
      method: "POST",
      body: JSON.stringify({ member_id: memberId }),
    }),

  listBalances: () => request<Balance[]>("/balances"),
  listRedemptions: () => request<Redemption[]>("/redemptions"),
  adjustBalance: (memberId: number, amount: number, reason?: string) =>
    request<{ id: number; member_id: number; amount: number; reason: string | null; created_at: string }>(
      `/balances/${memberId}/adjust`,
      { method: "POST", body: JSON.stringify({ amount, reason }) },
    ),
  memberHistory: (memberId: number, limit = 100) =>
    request<HistoryEntry[]>(`/balances/${memberId}/history?limit=${limit}`),

  calendarStatus: () => request<CalendarStatus>("/calendar/status"),
  calendarAuthUrl: () => request<{ url: string }>("/calendar/auth-url"),
  calendarEvents: (params: { days?: number; from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from_date", params.from);
    if (params.to) q.set("to_date", params.to);
    if (params.days) q.set("days", String(params.days));
    const qs = q.toString();
    return request<CalendarEvent[]>(`/calendar/events${qs ? "?" + qs : ""}`);
  },
  disconnectGoogle: (id: number) =>
    request<void>(`/calendar/accounts/${id}`, { method: "DELETE" }),
  syncCalendar: () => request<{ status: string }>("/calendar/sync", { method: "POST" }),
  listSubscriptions: () => request<CalendarSubscription[]>("/calendar/subscriptions"),
  updateSubscription: (
    id: number,
    patch: { enabled?: boolean; member_id?: number | null },
  ) =>
    request<CalendarSubscription>(`/calendar/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  refreshSubscriptions: () =>
    request<{ status: string }>("/calendar/subscriptions/refresh", { method: "POST" }),

  createEvent: (body: EventWriteBody) =>
    request<CalendarEvent>("/calendar/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEvent: (id: number, body: EventPatchBody) =>
    request<CalendarEvent>(`/calendar/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteEvent: (id: number) =>
    request<void>(`/calendar/events/${id}`, { method: "DELETE" }),

  weather: () => request<Weather>("/weather"),
  weatherLocation: () =>
    request<{ lat: number | null; lon: number | null }>("/weather/location"),
  setWeatherLocation: (lat: number | null, lon: number | null) =>
    request<{ lat: number | null; lon: number | null }>("/weather/location", {
      method: "PUT",
      body: JSON.stringify({ lat, lon }),
    }),

  listLists: () => request<TodoList[]>("/lists"),
  createList: (body: TodoListInput) =>
    request<TodoList>("/lists", { method: "POST", body: JSON.stringify(body) }),
  updateList: (id: number, body: Partial<TodoListInput>) =>
    request<TodoList>(`/lists/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteList: (id: number) => request<void>(`/lists/${id}`, { method: "DELETE" }),
  listItems: (listId: number) => request<TodoItem[]>(`/lists/${listId}/items`),
  createItem: (listId: number, text: string) =>
    request<TodoItem>(`/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({ text, done: false }),
    }),
  updateItem: (itemId: number, body: Partial<{ text: string; done: boolean }>) =>
    request<TodoItem>(`/lists/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteItem: (itemId: number) =>
    request<void>(`/lists/items/${itemId}`, { method: "DELETE" }),
  clearDone: (listId: number) =>
    request<void>(`/lists/${listId}/clear-done`, { method: "POST" }),
};

export type TodoList = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  position: number;
  item_count: number;
  done_count: number;
};

export type TodoListInput = {
  name: string;
  emoji?: string;
  color?: string;
};

export type TodoItem = {
  id: number;
  list_id: number;
  text: string;
  done: boolean;
  position: number;
};

export type Weather = {
  configured: boolean;
  temperature?: number;
  icon?: string;
  label?: string;
  code?: number;
  error?: string;
};

export type EventWriteBody = {
  subscription_id: number;
  summary: string;
  location?: string | null;
  all_day: boolean;
  start: string;
  end: string;
};

export type EventPatchBody = Partial<EventWriteBody>;
