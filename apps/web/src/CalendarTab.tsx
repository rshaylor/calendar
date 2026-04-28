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
import MemberProgress from "./MemberProgress";
import EventEditor from "./EventEditor";

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
  const dow = x.getDay(); // 0 Sun..6 Sat
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
  const sOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const eOpts: Intl.DateTimeFormatOptions = sameMonth
    ? { day: "numeric" }
    : { month: "short", day: "numeric" };
  const yOpt: Intl.DateTimeFormatOptions =
    start.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" };
  return (
    start.toLocaleDateString(undefined, sOpts) +
    " – " +
    end.toLocaleDateString(undefined, { ...eOpts, ...yOpt })
  );
}

export default function CalendarTab({ members, chores, onGoToSettings }: Props) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
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

  if (!status) return <p className="text-muted">Loading…</p>;

  if (!status.configured || status.accounts.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 shadow-sm text-center">
        <div className="text-5xl mb-3">📅</div>
        <h3 className="text-xl font-semibold mb-2">
          {!status.configured ? "Google Calendar not configured" : "No calendar connected"}
        </h3>
        <p className="text-ink-2 mb-5">
          {!status.configured
            ? "Set GOOGLE_CLIENT_ID and SECRET in apps/api/.env, then connect."
            : "Connect a Google account to start showing events."}
        </p>
        <button
          onClick={onGoToSettings}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm"
        >
          Open Settings
        </button>
      </div>
    );
  }

  const today = new Date();
  const isCurrentWeek = isSameDay(weekStart, startOfWeekMonday(today));

  return (
    <div className="space-y-4">
      {error && <p className="text-danger">{error}</p>}

      <MemberProgress members={members} chores={chores} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-surface-2 border border-line p-1">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="w-9 h-9 rounded-full hover:bg-white text-ink-2 hover:text-ink"
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
            className={
              "px-4 h-9 rounded-full text-sm font-medium " +
              (isCurrentWeek ? "bg-white shadow-sm" : "hover:bg-white text-ink-2 hover:text-ink")
            }
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="w-9 h-9 rounded-full hover:bg-white text-ink-2 hover:text-ink"
            aria-label="Next week"
          >
            ›
          </button>
        </div>
        <div className="text-lg font-semibold tracking-tight">
          {formatRange(weekStart, addDays(weekStart, 6))}
        </div>
        <span className="text-sm text-muted">
          {status.accounts[0]?.last_synced_at
            ? `synced ${new Date(status.accounts[0].last_synced_at).toLocaleTimeString()}`
            : "not synced yet"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={busy}
            className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-line text-sm font-medium disabled:opacity-50"
          >
            {busy ? "syncing…" : "sync now"}
          </button>
          <button
            onClick={() => setEditor({ kind: "new" })}
            disabled={subs.filter((s) => s.enabled).length === 0}
            className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium shadow-sm disabled:opacity-50"
          >
            + Event
          </button>
        </div>
      </div>

      <WeekView
        events={events}
        members={members}
        days={7}
        startDate={weekStart}
        onEventClick={(ev) => setEditor({ kind: "edit", event: ev })}
        onSlotClick={(start) => setEditor({ kind: "new", defaultStart: start })}
      />

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
