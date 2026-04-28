export type FamilyMember = {
  id: number;
  name: string;
  color: string;
  avatar_emoji: string;
  is_kid: boolean;
};

export type FamilyMemberInput = Omit<FamilyMember, "id">;

export type Recurrence = "none" | "daily" | "weekly";

export type Chore = {
  id: number;
  name: string;
  emoji: string;
  star_value: number;
  recurrence: Recurrence;
  assignees: FamilyMember[];
  done_today_by: number[];
};

export type ChoreInput = {
  name: string;
  emoji: string;
  star_value: number;
  recurrence: Recurrence;
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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listMembers: () => request<FamilyMember[]>("/members"),
  createMember: (m: FamilyMemberInput) =>
    request<FamilyMember>("/members", { method: "POST", body: JSON.stringify(m) }),
  deleteMember: (id: number) => request<void>(`/members/${id}`, { method: "DELETE" }),

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

  calendarStatus: () => request<CalendarStatus>("/calendar/status"),
  calendarAuthUrl: () => request<{ url: string }>("/calendar/auth-url"),
  calendarEvents: (days = 7) => request<CalendarEvent[]>(`/calendar/events?days=${days}`),
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
