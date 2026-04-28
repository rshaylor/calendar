import { useEffect, useState } from "react";
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

export default function CalendarTab({ members, chores, onGoToSettings }: Props) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });

  async function refresh() {
    try {
      const s = await api.calendarStatus();
      setStatus(s);
      if (s.accounts.length > 0) {
        const [evs, ss] = await Promise.all([api.calendarEvents(7), api.listSubscriptions()]);
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
  }, []);

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

  const enabledSubs = subs.filter((s) => s.enabled);

  return (
    <div>
      {error && <p className="text-danger mb-4">{error}</p>}

      <MemberProgress members={members} chores={chores} />

      <div className="flex flex-wrap items-center gap-3 mb-4 mt-4">
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
            disabled={enabledSubs.length === 0}
            className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium shadow-sm disabled:opacity-50"
          >
            + Event
          </button>
        </div>
      </div>

      <WeekView
        events={events}
        members={members}
        days={5}
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
