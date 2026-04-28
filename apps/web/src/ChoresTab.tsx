import { useMemo, useState } from "react";
import { api, type Chore, type FamilyMember, type Recurrence } from "./api";
import Celebration from "./Celebration";
import { PRESET_CHORE_EMOJIS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  chores: Chore[];
  onChanged: () => void;
};

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
};

export default function ChoresTab({ members, chores, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [todayOnly, setTodayOnly] = useState(true);
  const [celebration, setCelebration] = useState({ trigger: 0, message: "" });

  const visibleChores = useMemo(() => {
    if (!todayOnly) return chores;
    return chores.filter((c) => c.recurrence === "daily" || c.recurrence === "none");
  }, [chores, todayOnly]);

  function memberFinishedAll(memberId: number, after: Chore[]): boolean {
    const assigned = after.filter((c) => c.assignees.some((a) => a.id === memberId));
    if (assigned.length === 0) return false;
    return assigned.every((c) => c.done_today_by.includes(memberId));
  }

  async function toggleDone(chore: Chore, memberId: number) {
    const wasDone = chore.done_today_by.includes(memberId);

    if (wasDone) {
      await api.uncompleteChore(chore.id, memberId);
    } else {
      await api.completeChore(chore.id, memberId);
      const optimistic = chores.map((c) =>
        c.id === chore.id ? { ...c, done_today_by: [...c.done_today_by, memberId] } : c,
      );
      if (memberFinishedAll(memberId, optimistic)) {
        const m = members.find((x) => x.id === memberId);
        setCelebration({ trigger: Date.now(), message: `Nice one, ${m?.name ?? "you"}!` });
      }
    }
    onChanged();
  }

  async function remove(id: number) {
    if (!confirm("Delete this chore?")) return;
    await api.deleteChore(id);
    onChanged();
  }

  if (members.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
        Add a family member first.
      </div>
    );
  }

  return (
    <div>
      <Celebration trigger={celebration.trigger} message={celebration.message} />

      <div className="flex items-center gap-3 mb-5">
        <div className="inline-flex p-1 rounded-full bg-surface-2 border border-line">
          {(["today", "all"] as const).map((mode) => {
            const active = mode === (todayOnly ? "today" : "all");
            return (
              <button
                key={mode}
                onClick={() => setTodayOnly(mode === "today")}
                className={
                  "px-5 py-2 rounded-full text-sm font-medium transition " +
                  (active ? "bg-white text-ink shadow-sm" : "text-ink-2")
                }
              >
                {mode === "today" ? "Today" : "All"}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-sm text-muted">
          {visibleChores.length} chore{visibleChores.length === 1 ? "" : "s"}
        </span>
      </div>

      {visibleChores.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
          {todayOnly ? "No chores for today." : "No chores yet."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {visibleChores.map((c) => (
            <li
              key={c.id}
              className="rounded-3xl bg-surface border border-line p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center text-3xl shrink-0">
                  {c.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">{c.name}</div>
                  <div className="text-sm text-ink-2 flex items-center gap-2">
                    <span>{RECURRENCE_LABELS[c.recurrence]}</span>
                    {c.star_value > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-star">⭐ {c.star_value}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-sm text-muted hover:text-danger px-2 py-1"
                >
                  remove
                </button>
              </div>
              {c.assignees.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {c.assignees.map((a) => {
                    const done = c.done_today_by.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleDone(c, a.id)}
                        className={
                          "flex items-center gap-2 px-4 py-2.5 rounded-full text-base font-medium transition active:scale-95 " +
                          (done ? "text-white shadow-sm" : "text-ink hover:opacity-80")
                        }
                        style={{
                          background: done ? a.color : tint(a.color, 0.22),
                        }}
                      >
                        <span className="text-lg">{a.avatar_emoji}</span>
                        <span>{a.name}</span>
                        {done && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {showForm ? (
          <ChoreForm
            members={members}
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              onChanged();
            }}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm hover:opacity-90"
          >
            + Add chore
          </button>
        )}
      </div>
    </div>
  );
}

function ChoreForm({
  members,
  onCancel,
  onSaved,
}: {
  members: FamilyMember[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PRESET_CHORE_EMOJIS[0]);
  const [stars, setStars] = useState(1);
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);

  function toggleAssignee(id: number) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createChore({
      name: name.trim(),
      emoji,
      star_value: stars,
      recurrence,
      assignee_ids: assigneeIds,
    });
    onSaved();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-4"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Chore name (e.g. Make bed)"
        autoFocus
        className="px-4 py-3 rounded-xl bg-surface-2 border border-line text-lg"
      />

      <div>
        <div className="text-sm text-ink-2 mb-2">Emoji</div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_CHORE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={
                "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition " +
                (emoji === e ? "ring-2 ring-primary bg-surface-2" : "hover:bg-surface-2")
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Recurrence</span>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
          >
            <option value="none">One-off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Stars ⭐</span>
          <input
            type="number"
            min={0}
            max={20}
            value={stars}
            onChange={(e) => setStars(parseInt(e.target.value || "0", 10))}
            className="w-24 px-3 py-2 rounded-xl bg-surface-2 border border-line"
          />
        </label>
      </div>

      <div>
        <div className="text-sm text-ink-2 mb-2">Assign to</div>
        <div className="flex gap-2 flex-wrap">
          {members.map((m) => {
            const on = assigneeIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleAssignee(m.id)}
                className={
                  "flex items-center gap-2 px-4 py-2 rounded-full transition " +
                  (on ? "text-white" : "text-ink hover:opacity-80")
                }
                style={{ background: on ? m.color : tint(m.color, 0.22) }}
              >
                <span>{m.avatar_emoji}</span>
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm"
        >
          Save chore
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl text-ink-2 hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
