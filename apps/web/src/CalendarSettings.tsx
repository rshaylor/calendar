import { useEffect, useState } from "react";
import { api, type CalendarStatus, type CalendarSubscription, type FamilyMember } from "./api";

type Props = {
  members: FamilyMember[];
};

export default function CalendarSettings({ members }: Props) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const s = await api.calendarStatus();
      setStatus(s);
      if (s.accounts.length > 0) {
        setSubs(await api.listSubscriptions());
      } else {
        setSubs([]);
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect() {
    try {
      const { url } = await api.calendarAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(String(e));
    }
  }

  async function disconnect(id: number) {
    if (!confirm("Disconnect this Google account?")) return;
    await api.disconnectGoogle(id);
    refresh();
  }

  async function toggleEnabled(sub: CalendarSubscription) {
    await api.updateSubscription(sub.id, { enabled: !sub.enabled });
    refresh();
  }

  async function setOwner(sub: CalendarSubscription, memberId: number | null) {
    await api.updateSubscription(sub.id, { member_id: memberId });
    refresh();
  }

  async function refreshCalendarList() {
    setBusy(true);
    try {
      await api.refreshSubscriptions();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-danger">{error}</p>;

  if (!status.configured) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-6">
        <p className="text-ink-2 mb-3">
          Add your Google OAuth client to{" "}
          <code className="px-1 py-0.5 rounded bg-surface-2">apps/api/.env</code>:
        </p>
        <pre className="rounded-xl bg-surface-2 p-4 text-sm overflow-auto">
{`GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=${status.redirect_uri}`}
        </pre>
      </div>
    );
  }

  if (status.accounts.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-6 text-center">
        <p className="text-ink-2 mb-4">No Google account connected.</p>
        <button
          onClick={connect}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm"
        >
          Connect Google Calendar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted uppercase tracking-wide mb-2">Accounts</div>
        <div className="rounded-3xl bg-surface border border-line divide-y divide-line">
          {status.accounts.map((a) => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3">
              <span>📅</span>
              <span className="font-medium">{a.email}</span>
              <span className="text-xs text-muted ml-2">
                {a.last_synced_at
                  ? `synced ${new Date(a.last_synced_at).toLocaleTimeString()}`
                  : "not synced"}
              </span>
              <button
                onClick={() => disconnect(a.id)}
                className="text-sm text-muted hover:text-danger ml-auto"
              >
                disconnect
              </button>
            </div>
          ))}
        </div>
        <button onClick={connect} className="mt-2 text-sm text-primary hover:underline">
          + connect another account
        </button>
      </div>

      <div>
        <div className="flex items-center mb-2">
          <span className="text-xs text-muted uppercase tracking-wide">Calendars</span>
          <button
            onClick={refreshCalendarList}
            disabled={busy}
            className="ml-auto text-sm text-ink-2 hover:text-ink"
          >
            refresh list
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          Tick what you want shown, and assign each calendar to a family member so events get their colour.
        </p>
        <div className="rounded-3xl bg-surface border border-line divide-y divide-line">
          {subs.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggleEnabled(s)}
                className="w-5 h-5"
              />
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{ background: s.background_color ?? "#9ca3af" }}
              />
              <span className="font-medium flex-1 truncate">
                {s.summary || s.google_calendar_id}
                {s.is_primary && <span className="ml-2 text-xs text-muted">primary</span>}
              </span>
              <select
                value={s.member_id ?? ""}
                onChange={(e) =>
                  setOwner(s, e.target.value === "" ? null : parseInt(e.target.value, 10))
                }
                className="px-3 py-1.5 rounded-lg border border-line bg-surface text-sm"
              >
                <option value="">— Owner —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar_emoji} {m.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
