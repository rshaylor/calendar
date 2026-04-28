import { useEffect, useMemo, useState } from "react";
import { api, type FamilyMember, type HistoryEntry } from "./api";
import { tint } from "./ui";

type Props = {
  member: FamilyMember;
  onClose: () => void;
};

const PAGE_SIZE = 100;

export default function HistoryModal({ member, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextLimit: number) {
    setLoading(true);
    try {
      const data = await api.memberHistory(member.id, nextLimit);
      setEntries(data);
      setLimit(nextLimit);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    if (!entries) return [];
    const out: { day: string; entries: HistoryEntry[] }[] = [];
    for (const e of entries) {
      const day = new Date(e.at).toDateString();
      const last = out[out.length - 1];
      if (last && last.day === day) last.entries.push(e);
      else out.push({ day, entries: [e] });
    }
    return out;
  }, [entries]);

  // If we got back exactly `limit` entries there might be more.
  const maybeMore = entries !== null && entries.length === limit && limit < 500;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl shadow-xl overflow-hidden"
        style={{ background: tint(member.color, 0.12) }}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-white/40 bg-white/40">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white shadow-sm">
            {member.avatar_emoji}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{member.name}'s history</h3>
            <p className="text-xs text-ink-2">Earnings, redemptions and adjustments</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-2 hover:text-ink rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3">
          {error && <p className="text-danger px-3">{error}</p>}
          {entries === null && !error && <p className="text-muted px-3">Loading…</p>}
          {entries && entries.length === 0 && (
            <p className="text-ink-2 px-3 py-6 text-center">Nothing yet.</p>
          )}
          {grouped.map((group) => (
            <div key={group.day} className="mb-3">
              <div className="sticky top-0 bg-white/70 backdrop-blur-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-2 rounded">
                {formatDay(group.day)}
              </div>
              <ul className="mt-1">
                {group.entries.map((e, i) => (
                  <li
                    key={`${group.day}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/60 transition"
                  >
                    <span className="text-2xl shrink-0">{e.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{e.label}</div>
                      <div className="text-xs text-ink-2">{formatTime(e.at)}</div>
                    </div>
                    <div
                      className={
                        "tabular-nums font-semibold " +
                        (e.amount > 0 ? "text-success" : "text-danger")
                      }
                    >
                      {e.amount > 0 ? `+${e.amount}` : e.amount} ⭐
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {entries && entries.length > 0 && (
            <div className="px-3 py-3 text-center text-xs text-muted">
              Showing {entries.length} most recent
              {maybeMore && (
                <>
                  {" · "}
                  <button
                    onClick={() => load(Math.min(limit + PAGE_SIZE, 500))}
                    disabled={loading}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    {loading ? "loading…" : "show more"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDay(dayStr: string): string {
  const d = new Date(dayStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
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
