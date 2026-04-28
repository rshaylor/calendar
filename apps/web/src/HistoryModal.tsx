import { useEffect, useState } from "react";
import { api, type FamilyMember, type HistoryEntry } from "./api";
import { tint } from "./ui";

type Props = {
  member: FamilyMember;
  onClose: () => void;
};

export default function HistoryModal({ member, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.memberHistory(member.id);
        if (!cancelled) setEntries(data);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          {entries && entries.length > 0 && (
            <ul className="space-y-1">
              {entries.map((e, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/60 transition"
                >
                  <span className="text-2xl shrink-0">{e.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.label}</div>
                    <div className="text-xs text-ink-2">{formatWhen(e.at)}</div>
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
          )}
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }) + `, ${time}`;
}
