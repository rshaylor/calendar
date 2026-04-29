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
      if (s.configured) {
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

  async function toggleEnabled(sub: CalendarSubscription) {
    await api.updateSubscription(sub.id, { enabled: !sub.enabled });
    refresh();
  }

  async function setOwner(sub: CalendarSubscription, memberId: number | null) {
    await api.updateSubscription(sub.id, { member_id: memberId });
    refresh();
  }

  async function setColor(sub: CalendarSubscription, color: string | null) {
    await api.updateSubscription(sub.id, { color });
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
        <p className="text-ink-2 mb-2">
          Calendar isn't reachable from this add-on.
        </p>
        {status.reason && (
          <p className="text-sm text-muted mb-3">{status.reason}</p>
        )}
        <p className="text-sm text-ink-2">
          Family Hub reads calendars from Home Assistant. Make sure HA has at
          least one calendar integration set up (Settings → Devices & Services
          → Add Integration → Google Calendar / Local Calendar / CalDAV / …),
          then come back here.
        </p>
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-6 text-center">
        <p className="text-ink-2 mb-3">
          No calendars found in Home Assistant yet.
        </p>
        <p className="text-sm text-muted mb-4">
          Add one in HA (Settings → Devices & Services → Add Integration), then
          tap below.
        </p>
        <button
          onClick={refreshCalendarList}
          disabled={busy}
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm disabled:opacity-50"
        >
          {busy ? "Looking…" : "Re-check Home Assistant"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center mb-2">
          <span className="text-xs text-muted uppercase tracking-wide">Calendars</span>
          <button
            onClick={refreshCalendarList}
            disabled={busy}
            className="ml-auto text-sm text-ink-2 hover:text-ink"
          >
            refresh from HA
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          Tick the calendars you want shown, pick a colour, and (optionally)
          assign each one to a family member so events take that member's
          colour automatically.
        </p>
        <div className="rounded-3xl bg-surface border border-line divide-y divide-line">
          {subs.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggleEnabled(s)}
                className="w-5 h-5"
              />
              <input
                type="color"
                value={s.color ?? "#9ca3af"}
                onChange={(e) => setColor(s, e.target.value)}
                className="w-8 h-8 rounded border border-line cursor-pointer"
                title="Calendar colour"
              />
              <span className="font-medium flex-1 truncate">
                {s.friendly_name || s.entity_id}
                <span className="ml-2 text-xs text-muted">{s.entity_id}</span>
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

      <p className="text-xs text-muted">
        Calendars are managed in Home Assistant. To connect a new Google
        account or change which Google account is used, go to HA → Settings →
        Devices & Services. Family Hub will pick up changes the next time you
        tap "refresh from HA".
      </p>
    </div>
  );
}
