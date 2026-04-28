import { useMemo } from "react";
import type { CalendarEvent, FamilyMember } from "./api";
import { tint } from "./ui";

type Props = {
  events: CalendarEvent[];
  members: FamilyMember[];
  days?: number;
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

export default function WeekView({ events, members, days = 5, onEventClick, onSlotClick }: Props) {
  const today = startOfDay(new Date());
  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(today, i)),
    [today, days],
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
    <div className="rounded-3xl bg-surface border border-line overflow-hidden shadow-sm">
      {/* Day header */}
      <div
        className="grid border-b border-line bg-surface-2/50"
        style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}
      >
        <div />
        {dayList.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={
                "px-3 py-3 text-center border-l border-line " +
                (isToday ? "bg-primary/10" : "")
              }
            >
              <div className="text-xs uppercase tracking-wide text-muted">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div
                className={
                  "text-2xl font-semibold tabular-nums " + (isToday ? "text-primary" : "")
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
      />

      {/* Time grid */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)`, height: gridHeight }}
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

              {dayEvents
                .filter((e) => !e.all_day)
                .map((ev) => {
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

                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className="absolute rounded-xl px-2 py-1.5 overflow-hidden text-xs shadow-sm text-left hover:shadow-md transition-shadow"
                      style={{
                        top,
                        height,
                        left: 4,
                        right: 4,
                        background: tint(color, 0.28),
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`${ev.summary} · ${formatTime(ev.start_at)} – ${formatTime(ev.end_at)}`}
                    >
                      <div className="font-semibold leading-tight truncate">{ev.summary}</div>
                      <div className="text-ink-2 leading-tight">
                        {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
                      </div>
                      {member && (
                        <div
                          className="absolute bottom-1 right-1 w-5 h-5 rounded-full text-[11px] flex items-center justify-center"
                          style={{ background: "white" }}
                        >
                          {member.avatar_emoji}
                        </div>
                      )}
                    </button>
                  );
                })}

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
}: {
  days: number;
  dayList: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  memberById: Map<number, FamilyMember>;
}) {
  const anyAllDay = dayList.some((d) =>
    (eventsByDay.get(d.toISOString()) ?? []).some((e) => e.all_day),
  );
  if (!anyAllDay) return null;

  return (
    <div
      className="grid border-b border-line"
      style={{ gridTemplateColumns: `60px repeat(${days}, 1fr)` }}
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
                <div
                  key={ev.id}
                  className="rounded-lg px-2 py-1 text-xs truncate font-medium"
                  style={{
                    background: tint(color, 0.28),
                    borderLeft: `3px solid ${color}`,
                  }}
                  title={ev.summary}
                >
                  {ev.summary}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
