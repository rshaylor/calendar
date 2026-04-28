import { useMemo } from "react";
import type { CalendarEvent, FamilyMember } from "./api";
import { tint } from "./ui";

type Props = {
  events: CalendarEvent[];
  members: FamilyMember[];
  onEventClick?: (event: CalendarEvent) => void;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayHeader(d: Date, today: Date, tomorrow: Date): string {
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MobileAgenda({ events, members, onEventClick }: Props) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of [...events].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )) {
      const key = startOfDay(new Date(ev.start_at)).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
        Nothing scheduled this week.
      </div>
    );
  }

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="grid gap-5">
      {groups.map(([dayIso, evs]) => {
        const day = new Date(dayIso);
        const allDay = evs.filter((e) => e.all_day);
        const timed = evs.filter((e) => !e.all_day);
        return (
          <div key={dayIso}>
            <div className="font-display text-xl font-medium mb-2">
              {formatDayHeader(day, today, tomorrow)}
            </div>
            <ul className="grid gap-2">
              {allDay.map((ev) => {
                const m = ev.member_id ? memberById.get(ev.member_id) : null;
                const color = m?.color ?? ev.color ?? "#86b9f7";
                return (
                  <li key={ev.id}>
                    <button
                      onClick={() => onEventClick?.(ev)}
                      className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
                      style={{ background: tint(color, 0.28) }}
                    >
                      {m && (
                        <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0">
                          {m.avatar_emoji}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{ev.summary}</div>
                        <div className="text-xs text-ink-2">All day</div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {timed.map((ev) => {
                const m = ev.member_id ? memberById.get(ev.member_id) : null;
                const color = m?.color ?? ev.color ?? "#86b9f7";
                return (
                  <li key={ev.id}>
                    <button
                      onClick={() => onEventClick?.(ev)}
                      className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
                      style={{ background: tint(color, 0.18) }}
                    >
                      <div className="text-sm tabular-nums shrink-0 w-14">
                        <div className="font-semibold leading-tight">
                          {formatTime(ev.start_at)}
                        </div>
                        <div className="text-[11px] text-muted leading-tight">
                          {formatTime(ev.end_at)}
                        </div>
                      </div>
                      {m && (
                        <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm shrink-0">
                          {m.avatar_emoji}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{ev.summary}</div>
                        {ev.location && (
                          <div className="text-xs text-ink-2 truncate">📍 {ev.location}</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
