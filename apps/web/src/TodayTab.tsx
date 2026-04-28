import { useEffect, useMemo, useState } from "react";
import {
  api,
  type Balance,
  type CalendarEvent,
  type Chore,
  type FamilyMember,
} from "./api";
import Icon from "./Icon";
import { tint } from "./ui";

type Props = {
  members: FamilyMember[];
  chores: Chore[];
  balances: Balance[];
  familyName?: string;
  onChanged: () => void;
};

function isActiveToday(c: Chore, dow: number): boolean {
  if (c.recurrence === "none" || c.recurrence === "daily") return true;
  if (c.recurrence === "weekdays") return (c.weekdays ?? []).includes(dow);
  return true;
}

const SECTION_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

export default function TodayTab({
  members,
  chores,
  balances,
  familyName,
  onChanged,
}: Props) {
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const todayDow = new Date().getDay();
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const balanceFor = (id: number) => balances.find((b) => b.member_id === id)?.stars ?? 0;

  // Fetch today's events
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      try {
        const evs = await api.calendarEvents({
          from: start.toISOString(),
          to: end.toISOString(),
        });
        if (!cancelled) setTodayEvents(evs);
      } catch (e) {
        if (!cancelled) setEventsError(String(e));
      }
    }
    load();
    const t = setInterval(load, 30 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const todays = useMemo(
    () => chores.filter((c) => isActiveToday(c, todayDow)),
    [chores, todayDow],
  );

  const totalDone = todays.reduce((acc, c) => acc + c.done_today_by.length, 0);
  const totalAssignments = todays.reduce((acc, c) => acc + c.assignees.length, 0);
  const choresLeft = totalAssignments - totalDone;

  // "Up next" — pending (chore, assignee) pairs sorted by time of day
  const upNext = useMemo(() => {
    const items: { chore: Chore; assignee: FamilyMember }[] = [];
    for (const c of todays) {
      for (const a of c.assignees) {
        if (!c.done_today_by.includes(a.id)) items.push({ chore: c, assignee: a });
      }
    }
    items.sort((a, b) => {
      const aOrder = SECTION_ORDER[a.chore.time_of_day ?? ""] ?? 3;
      const bOrder = SECTION_ORDER[b.chore.time_of_day ?? ""] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.chore.star_value ?? 0) - (a.chore.star_value ?? 0);
    });
    return items.slice(0, 6);
  }, [todays]);

  const greeting = greetingFor(new Date(), familyName);
  const allDayEvents = todayEvents.filter((e) => e.all_day);
  const timedEvents = todayEvents.filter((e) => !e.all_day);

  async function toggle(c: Chore, mid: number) {
    if (c.done_today_by.includes(mid)) {
      await api.uncompleteChore(c.id, mid);
    } else {
      await api.completeChore(c.id, mid);
    }
    onChanged();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      {/* LEFT — hero, rings, up-next */}
      <div className="flex flex-col gap-4 min-w-0">
        {/* Hero */}
        <div className="rounded-3xl bg-surface border border-line shadow-sm p-5 flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #ffd28a, #ffb38a)" }}
          >
            <Icon name="sun" size={32} color="white" stroke={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-3xl font-medium leading-tight">{greeting}</div>
            <div className="text-ink-2 mt-1">
              {todayEvents.length} event{todayEvents.length === 1 ? "" : "s"} today
              {choresLeft > 0 ? ` · ${choresLeft} chore${choresLeft === 1 ? "" : "s"} left` : " · all chores done ✨"}
            </div>
          </div>
        </div>

        {/* Kid progress rings */}
        {members.filter((m) => m.is_kid).length > 0 && (
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
            {members
              .filter((m) => m.is_kid)
              .map((m) => {
                const mine = todays.filter((c) => c.assignees.some((a) => a.id === m.id));
                const done = mine.filter((c) => c.done_today_by.includes(m.id)).length;
                const pct = mine.length === 0 ? 0 : done / mine.length;
                return (
                  <div
                    key={m.id}
                    className="rounded-3xl bg-surface border border-line shadow-sm p-4 flex flex-col items-center gap-2"
                  >
                    <ProgressRing pct={pct} color={m.color} avatar={m.avatar_emoji} />
                    <div className="font-display text-xl font-medium mt-1">{m.name}</div>
                    <div className="flex gap-3 text-sm text-ink-2">
                      <span>
                        {done}/{mine.length} chores
                      </span>
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: "var(--color-star)" }}
                      >
                        <Icon
                          name="starFill"
                          size={14}
                          fill="var(--color-star)"
                          color="var(--color-star)"
                        />
                        {balanceFor(m.id)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Up next */}
        <div className="rounded-3xl bg-surface border border-line shadow-sm p-5 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="checkSquare" size={20} color="var(--color-ink-2)" />
            <div className="font-display text-2xl font-medium">Up next</div>
            <span className="ml-auto text-xs text-muted">
              {upNext.length === 0
                ? "all done"
                : `${upNext.length} of ${choresLeft} shown`}
            </span>
          </div>
          {upNext.length === 0 ? (
            <div className="text-ink-2 py-4">
              {totalAssignments === 0
                ? "No chores assigned today."
                : "Everyone's caught up. ✨"}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upNext.map(({ chore, assignee }) => (
                <li key={`${chore.id}-${assignee.id}`}>
                  <button
                    onClick={() => toggle(chore, assignee.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition active:scale-[0.99]"
                    style={{ background: tint(assignee.color, 0.16) }}
                  >
                    <span
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-base shrink-0"
                    >
                      {assignee.avatar_emoji}
                    </span>
                    <span
                      className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-lg shrink-0"
                      style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}
                    >
                      {chore.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold leading-tight truncate">{chore.name}</div>
                      {chore.time_of_day && (
                        <div className="text-xs text-ink-2 capitalize">
                          {chore.time_of_day}
                        </div>
                      )}
                    </div>
                    {chore.star_value > 0 && (
                      <div
                        className="inline-flex items-center gap-1 text-sm font-bold shrink-0"
                        style={{ color: "var(--color-star)" }}
                      >
                        <Icon
                          name="starFill"
                          size={14}
                          fill="var(--color-star)"
                          color="var(--color-star)"
                        />
                        {chore.star_value}
                      </div>
                    )}
                    <span
                      className="w-7 h-7 rounded-full shrink-0"
                      style={{
                        border: `2px solid ${assignee.color}`,
                        background: "white",
                      }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT — today timeline */}
      <div className="rounded-3xl bg-surface border border-line shadow-sm p-5 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="calendar" size={20} color="var(--color-ink-2)" />
          <div className="font-display text-2xl font-medium">Today</div>
          <span className="ml-auto text-xs text-muted">
            {todayEvents.length} event{todayEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        {eventsError && <p className="text-danger text-sm">{eventsError}</p>}

        {/* All-day events */}
        {allDayEvents.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted mb-1.5">
              All day
            </div>
            <ul className="flex flex-col gap-1.5">
              {allDayEvents.map((ev) => {
                const m = ev.member_id ? memberById.get(ev.member_id) : null;
                const color = m?.color ?? ev.color ?? "#86b9f7";
                return (
                  <li
                    key={ev.id}
                    className="rounded-xl px-3 py-2 flex items-center gap-2"
                    style={{ background: tint(color, 0.28) }}
                  >
                    {m && (
                      <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm">
                        {m.avatar_emoji}
                      </span>
                    )}
                    <span className="font-semibold truncate">{ev.summary}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Timed events */}
        {timedEvents.length === 0 && allDayEvents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-ink-2 text-center px-6">
            Nothing scheduled today.
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5 overflow-auto">
            {timedEvents.map((ev) => {
              const m = ev.member_id ? memberById.get(ev.member_id) : null;
              const color = m?.color ?? ev.color ?? "#86b9f7";
              return (
                <li
                  key={ev.id}
                  className="grid grid-cols-[60px_14px_1fr] gap-3 items-stretch py-2"
                >
                  <div className="text-right text-sm pr-1">
                    <div className="font-semibold text-ink leading-tight">
                      {formatTime(ev.start_at)}
                    </div>
                    <div className="text-[11px] text-muted leading-tight">
                      {formatTime(ev.end_at)}
                    </div>
                  </div>
                  <div className="relative">
                    <div
                      className="absolute left-1.5 top-0 bottom-0 w-0.5"
                      style={{ background: "var(--color-line-soft)" }}
                    />
                    <div
                      className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full"
                      style={{
                        background: color,
                        border: "3px solid var(--color-surface)",
                        boxShadow: `0 0 0 1px ${color}`,
                      }}
                    />
                  </div>
                  <div
                    className="rounded-2xl px-3 py-2 flex items-center gap-2.5 min-w-0"
                    style={{ background: tint(color, 0.18) }}
                  >
                    {m && (
                      <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0">
                        {m.avatar_emoji}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold truncate leading-tight">{ev.summary}</div>
                      {ev.location && (
                        <div className="text-xs text-ink-2 truncate">📍 {ev.location}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProgressRing({
  pct,
  color,
  avatar,
  size = 92,
}: {
  pct: number;
  color: string;
  avatar: string;
  size?: number;
}) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint(color, 0.25)}
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-2 rounded-full bg-white flex items-center justify-center"
        style={{
          fontSize: size * 0.4,
          boxShadow: `inset 0 0 0 1px ${tint(color, 0.4)}`,
        }}
      >
        {avatar}
      </div>
    </div>
  );
}

function greetingFor(d: Date, familyName?: string): string {
  const h = d.getHours();
  // If they typed "Shaylor Family" pull out the name part for the greeting
  const lastWord = (familyName ?? "").trim().toLowerCase().endsWith("family");
  const subject = familyName && familyName !== "Family Hub"
    ? lastWord
      ? familyName.trim().replace(/\s*family\s*$/i, "") + " family"
      : familyName
    : "family";
  if (h < 5) return `Late night, ${subject}`;
  if (h < 12) return `Good morning, ${subject}`;
  if (h < 18) return `Good afternoon, ${subject}`;
  return `Good evening, ${subject}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
