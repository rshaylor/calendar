import { useMemo } from "react";
import type { Chore, FamilyMember } from "./api";
import { tint } from "./ui";

type Props = {
  members: FamilyMember[];
  chores: Chore[];
};

// "Today" includes daily and one-off chores (matches the Today filter in ChoresTab)
function isTodayChore(c: Chore): boolean {
  return c.recurrence === "daily" || c.recurrence === "none";
}

export default function MemberProgress({ members, chores }: Props) {
  const stats = useMemo(() => {
    const today = chores.filter(isTodayChore);
    return members.map((m) => {
      const assigned = today.filter((c) => c.assignees.some((a) => a.id === m.id));
      const done = assigned.filter((c) => c.done_today_by.includes(m.id)).length;
      return { member: m, total: assigned.length, done };
    });
  }, [members, chores]);

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map(({ member: m, total, done }) => {
        const pct = total === 0 ? 0 : (done / total) * 100;
        const complete = total > 0 && done === total;
        return (
          <div
            key={m.id}
            className="rounded-full px-3 py-1.5 flex items-center gap-2.5 shadow-sm"
            style={{ background: tint(m.color, 0.18) }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-base bg-white shrink-0"
            >
              {m.avatar_emoji}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold leading-none">{m.name}</span>
                <span className="text-xs text-ink-2 tabular-nums leading-none">
                  {total > 0 ? `${done}/${total}` : "—"}
                </span>
                {complete && <span className="text-xs">✨</span>}
              </div>
              {total > 0 && (
                <div className="mt-1.5 h-1 w-24 rounded-full" style={{ background: tint(m.color, 0.25) }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: m.color }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
