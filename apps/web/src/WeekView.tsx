import { useMemo } from "react";
import type { CalendarEvent, FamilyMember } from "./api";
import { tint } from "./ui";

type Props = {
  events: CalendarEvent[];
  members: FamilyMember[];
  days?: number;
  /** Start date of the visible window. Defaults to today. */
  startDate?: Date;
  onEventClick?: (event: CalendarEvent) => void;
  onSlotClick?: (start: Date) => void;
};

const HOUR_HEIGHT = 56; // px
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(h: number): string {
  const am = h < 12;
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${am ? " am" : " pm"}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Lay out overlapping events into side-by-side tracks within a day column.
 * Returns a map from event uid to {track, tracks} where `track` is the column
 * index (0-based) and `tracks` is the total columns this event has to share with.
 */
function layoutDay(events: CalendarEvent[]): Map<string, { track: number; tracks: number }> {
  const out = new Map<string, { track: number; tracks: number }>();
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );
  if (sorted.length === 0) return out;

  // Phase 1: greedy track assignment (interval graph coloring)
  const trackEnds: number[] = [];
  const trackOf = new Map<string, number>();
  for (const ev of sorted) {
    const start = new Date(ev.start_at).getTime();
    const end = new Date(ev.end_at).getTime();
    let track = trackEnds.findIndex((e) => e <= start);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[track] = end;
    }
    trackOf.set(ev.uid, track);
  }

  // Phase 2: each event's "tracks" = max track index among events it overlaps with, +1
  for (const ev of sorted) {
    const evStart = new Date(ev.start_at).getTime();
    const evEnd = new Date(ev.end_at).getTime();
    let maxTrack = trackOf.get(ev.uid)!;
    for (const other of sorted) {
      if (other.uid === ev.uid) continue;
      const oStart = new Date(other.start_at).getTime();
      const oEnd = new Date(other.end_at).getTime();
      if (oStart < evEnd && evStart < oEnd) {
        maxTrack = Math.max(maxTrack, trackOf.get(other.uid)!);
      }
    }
    out.set(ev.uid, { track: trackOf.get(ev.uid)!, tracks: maxTrack + 1 });
  }
  return out;
}

export default function WeekView({
  events,
  members,
  days = 5,
  startDate,
  onEventClick,
  onSlotClick,
}: Props) {
  const today = startOfDay(new Date());
  const start = useMemo(() => (startDate ? startOfDay(startDate) : today), [startDate, today]);
  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(start, i)),
    [start, days],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const { startHour, endHour } = useMemo(() => {
    let s = DEFAULT_START_HOUR;
    let e = DEFAULT_END_HOUR;
    for (const ev of events) {
      if (ev.all_day) continue;
      const evStart = new Date(ev.start_at);
      const inWindow = dayList.some((d) => isSameDay(d, evStart));
      if (!inWindow) continue;
      s = Math.min(s, evStart.getHours());
      const evEnd = new Date(ev.end_at);
      const endHourFloor = evEnd.getMinutes() > 0 ? evEnd.getHours() + 1 : evEnd.getHours();
      e = Math.max(e, endHourFloor);
    }
    return { startHour: Math.max(0, s), endHour: Math.min(24, Math.max(e, s + 6)) };
  }, [events, dayList]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = startOfDay(new Date(ev.start_at)).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const now = new Date();
  const totalHours = endHour - startHour;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="rounded-[28px] bg-surface border border-line overflow-hidden shadow-sm">
      {/* Day header */}
      <div
        className="grid border-b border-line"
        style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)` }}
      >
        <div />
        {dayList.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={
                "px-3 py-3 text-center border-l border-line-soft " +
                (isToday ? "bg-bg-2" : "")
              }
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div
                className={
                  "font-display text-[26px] font-medium tabular-nums mt-0.5 leading-none " +
                  (isToday ? "text-primary" : "")
                }
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <AllDayStrip
        days={days}
        dayList={dayList}
        eventsByDay={eventsByDay}
        memberById={memberById}
        onEventClick={onEventClick}
      />

      {/* Time grid */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)`, height: gridHeight }}
      >
        <div>
          {hours.map((h) => (
            <div
              key={h}
              className="text-xs text-muted px-2 -mt-2 pt-2 border-t border-line first:border-t-0"
              style={{ height: HOUR_HEIGHT }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {dayList.map((d) => {
          const dayEvents = eventsByDay.get(d.toISOString()) ?? [];
          const isToday = isSameDay(d, today);
          const nowOffset =
            isToday && now.getHours() >= startHour && now.getHours() < endHour
              ? (now.getHours() - startHour + now.getMinutes() / 60) * HOUR_HEIGHT
              : null;

          return (
            <div
              key={d.toISOString()}
              className={"relative border-l border-line " + (onSlotClick ? "cursor-cell" : "")}
              onClick={(e) => {
                if (!onSlotClick) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const hourFloat = offsetY / HOUR_HEIGHT + startHour;
                const hour = Math.floor(hourFloat);
                const slotStart = new Date(d);
                slotStart.setHours(hour, 0, 0, 0);
                onSlotClick(slotStart);
              }}
            >
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="border-t border-line first:border-t-0"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}

              {(() => {
                const timed = dayEvents.filter((e) => !e.all_day);
                const layout = layoutDay(timed);
                return timed.map((ev) => {
                  const start = new Date(ev.start_at);
                  const end = new Date(ev.end_at);
                  const startMin = start.getHours() * 60 + start.getMinutes();
                  const endMin = end.getHours() * 60 + end.getMinutes();
                  const top = (startMin / 60 - startHour) * HOUR_HEIGHT;
                  const height = Math.max(
                    24,
                    ((endMin - startMin) / 60) * HOUR_HEIGHT,
                  );
                  const member = ev.member_id ? memberById.get(ev.member_id) : null;
                  const color = member?.color ?? ev.color ?? "#86b9f7";
                  const slot = layout.get(ev.uid) ?? { track: 0, tracks: 1 };
                  const widthPct = 100 / slot.tracks;
                  const leftPct = slot.track * widthPct;
                  // small inset between tracks for visual separation
                  const insetPx = 2;

                  return (
                    <button
                      key={ev.uid}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className="absolute rounded-xl px-2 py-1.5 overflow-hidden text-left hover:shadow-md transition-shadow"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + ${insetPx}px)`,
                        width: `calc(${widthPct}% - ${insetPx * 2}px)`,
                        background: tint(color, 0.32),
                        zIndex: slot.track + 1,
                      }}
                      title={`${ev.summary} · ${formatTime(ev.start_at)} – ${formatTime(ev.end_at)}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {member && slot.tracks <= 2 && (
                          <span
                            className="w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center text-[11px] shrink-0"
                          >
                            {member.avatar_emoji}
                          </span>
                        )}
                        <div className="text-[12px] font-bold leading-tight truncate text-ink flex-1">
                          {ev.summary}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-ink-2 leading-tight truncate">
                        {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
                      </div>
                    </button>
                  );
                });
              })()}

              {nowOffset !== null && (
                <div
                  className="absolute left-0 right-0 pointer-events-none z-10"
                  style={{ top: nowOffset }}
                >
                  <div className="h-px bg-danger/80" />
                  <div
                    className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-danger"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllDayStrip({
  days,
  dayList,
  eventsByDay,
  memberById,
  onEventClick,
}: {
  days: number;
  dayList: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  memberById: Map<number, FamilyMember>;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const anyAllDay = dayList.some((d) =>
    (eventsByDay.get(d.toISOString()) ?? []).some((e) => e.all_day),
  );
  if (!anyAllDay) return null;

  return (
    <div
      className="grid border-b border-line"
      style={{ gridTemplateColumns: `64px repeat(${days}, 1fr)` }}
    >
      <div className="text-[10px] text-muted px-2 py-2 self-center uppercase tracking-wide">
        all day
      </div>
      {dayList.map((d) => {
        const allDay = (eventsByDay.get(d.toISOString()) ?? []).filter((e) => e.all_day);
        return (
          <div key={d.toISOString()} className="px-1 py-1.5 border-l border-line min-h-9 space-y-1">
            {allDay.map((ev) => {
              const member = ev.member_id ? memberById.get(ev.member_id) : null;
              const color = member?.color ?? ev.color ?? "#86b9f7";
              return (
                <button
                  key={ev.uid}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(ev);
                  }}
                  className="w-full rounded-lg px-2 py-1 text-[11px] truncate font-bold text-left text-ink hover:shadow-sm transition-shadow"
                  style={{ background: tint(color, 0.32) }}
                  title={ev.summary}
                >
                  {ev.summary}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
