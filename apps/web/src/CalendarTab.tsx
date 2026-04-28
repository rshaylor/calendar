import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CalendarEvent,
  type CalendarStatus,
  type CalendarSubscription,
  type Chore,
  type FamilyMember,
} from "./api";
import WeekView from "./WeekView";
import MobileAgenda from "./MobileAgenda";
import EventEditor from "./EventEditor";
import Icon from "./Icon";
import { tint } from "./ui";

type Props = {
  members: FamilyMember[];
  chores: Chore[];
  onGoToSettings: () => void;
};

type EditorState =
  | { kind: "closed" }
  | { kind: "edit"; event: CalendarEvent }
  | { kind: "new"; defaultStart?: Date };

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
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

function formatRange(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sOpts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  const eOpts: Intl.DateTimeFormatOptions = sameMonth
    ? { day: "numeric" }
    : { month: "long", day: "numeric" };
  return (
    start.toLocaleDateString(undefined, sOpts) +
    " — " +
    end.toLocaleDateString(undefined, eOpts)
  );
}

export default function CalendarTab({ members, onGoToSettings }: Props) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [memberFilter, setMemberFilter] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  async function refresh() {
    try {
      const s = await api.calendarStatus();
      setStatus(s);
      if (s.accounts.length > 0) {
        const [evs, ss] = await Promise.all([
          api.calendarEvents({
            from: weekStart.toISOString(),
            to: weekEnd.toISOString(),
          }),
          api.listSubscriptions(),
        ]);
        setEvents(evs);
        setSubs(ss);
      } else {
        setEvents([]);
        setSubs([]);
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()]);

  async function syncNow() {
    setBusy(true);
    try {
      await api.syncCalendar();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(id: number) {
    setMemberFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!status) return <p className="text-muted">Loading…</p>;

  if (!status.configured || status.accounts.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-bg-2 mx-auto mb-3 flex items-center justify-center">
          <Icon name="calendar" size={28} color="var(--color-ink-2)" />
        </div>
        <h3 className="font-display text-2xl font-medium mb-2">
          {!status.configured ? "Google Calendar not configured" : "No calendar connected"}
        </h3>
        <p className="text-ink-2 mb-5">
          {!status.configured
            ? "Set GOOGLE_CLIENT_ID and SECRET in apps/api/.env, then connect."
            : "Connect a Google account to start showing events."}
        </p>
        <button
          onClick={onGoToSettings}
          className="px-5 py-3 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  const today = new Date();
  const isCurrentWeek = isSameDay(weekStart, startOfWeekMonday(today));
  const filtered =
    memberFilter.size === 0
      ? events
      : events.filter((e) => e.member_id !== null && memberFilter.has(e.member_id));

  return (
    <div className="space-y-4">
      {error && <p className="text-danger">{error}</p>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="font-display text-xl md:text-2xl font-medium">
          {formatRange(weekStart, addDays(weekStart, 6))}
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-line">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="w-9 h-9 rounded-full hover:bg-bg-2 text-ink-2 inline-flex items-center justify-center"
            aria-label="Previous week"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
            className={
              "px-4 h-9 rounded-full text-sm font-semibold " +
              (isCurrentWeek ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:bg-bg-2")
            }
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="w-9 h-9 rounded-full hover:bg-bg-2 text-ink-2 inline-flex items-center justify-center"
            aria-label="Next week"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {members.map((m) => {
            const active = memberFilter.has(m.id);
            const dim = memberFilter.size > 0 && !active;
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className={
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition " +
                  (dim ? "opacity-40" : "")
                }
                style={{ background: tint(m.color, 0.22) }}
                title={memberFilter.size === 0 ? `Show only ${m.name}'s events` : `Toggle ${m.name}`}
              >
                <span
                  className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs"
                >
                  {m.avatar_emoji}
                </span>
                {m.name}
              </button>
            );
          })}

          <div className="w-px h-6 bg-line mx-1" />

          <button
            onClick={syncNow}
            disabled={busy}
            className="w-9 h-9 rounded-full bg-surface border border-line hover:bg-bg-2 inline-flex items-center justify-center disabled:opacity-50"
            aria-label="Sync now"
            title={
              status.accounts[0]?.last_synced_at
                ? `Synced ${new Date(status.accounts[0].last_synced_at).toLocaleTimeString()}`
                : "Sync now"
            }
          >
            <Icon name="refresh" size={16} color="var(--color-ink-2)" />
          </button>
          <button
            onClick={() => setEditor({ kind: "new" })}
            disabled={subs.filter((s) => s.enabled).length === 0}
            className="px-4 h-9 rounded-full bg-ink text-white text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Icon name="plus" size={16} color="white" stroke={2.25} />
            New event
          </button>
        </div>
      </div>

      <div className="hidden md:block">
        <WeekView
          events={filtered}
          members={members}
          days={7}
          startDate={weekStart}
          onEventClick={(ev) => {
            if (ev.read_only) return; // birthdays managed in Family settings
            setEditor({ kind: "edit", event: ev });
          }}
          onSlotClick={(start) => setEditor({ kind: "new", defaultStart: start })}
        />
      </div>
      <div className="md:hidden">
        <MobileAgenda
          events={filtered}
          members={members}
          onEventClick={(ev) => {
            if (ev.read_only) return;
            setEditor({ kind: "edit", event: ev });
          }}
        />
      </div>

      {editor.kind !== "closed" && (
        <EventEditor
          event={editor.kind === "edit" ? editor.event : null}
          subs={subs}
          defaultStart={editor.kind === "new" ? editor.defaultStart : undefined}
          onClose={() => setEditor({ kind: "closed" })}
          onSaved={() => {
            setEditor({ kind: "closed" });
            refresh();
          }}
        />
      )}
    </div>
  );
}
