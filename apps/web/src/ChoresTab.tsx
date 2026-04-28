import { useMemo, useState } from "react";
import {
  api,
  type Balance,
  type Chore,
  type FamilyMember,
  type Recurrence,
  type TimeOfDay,
} from "./api";
import Celebration from "./Celebration";
import Icon from "./Icon";
import { PRESET_CHORE_EMOJIS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  chores: Chore[];
  balances: Balance[];
  onChanged: () => void;
};

type ViewMode = "today" | "manage";

const WEEKDAY_UI: { value: number; short: string }[] = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
];
const WEEKDAY_FULL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const SECTIONS: { key: TimeOfDay | "any"; label: string; icon: string }[] = [
  { key: "morning", label: "Morning", icon: "sun" },
  { key: "afternoon", label: "Afternoon", icon: "cloud" },
  { key: "evening", label: "Evening", icon: "moon" },
  { key: "any", label: "Anytime", icon: "checkSquare" },
];

function isActiveToday(c: Chore, dow: number): boolean {
  if (c.recurrence === "none" || c.recurrence === "daily") return true;
  if (c.recurrence === "weekdays") return (c.weekdays ?? []).includes(dow);
  return true;
}

function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function describeRecurrence(c: Chore): string {
  if (c.recurrence === "none") return "One-off";
  if (c.recurrence === "daily") return "Every day";
  if (c.recurrence === "weekdays" && c.weekdays && c.weekdays.length > 0) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const sorted = [...c.weekdays].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (arraysEqual(sorted, [1, 2, 3, 4, 5])) return "Weekdays";
    if (arraysEqual(sorted, [6, 0])) return "Weekends";
    if (sorted.length === 7) return "Every day";
    return sorted.map((d) => WEEKDAY_FULL[d]).join(", ");
  }
  return "Custom";
}

export default function ChoresTab({ members, chores, balances, onChanged }: Props) {
  const [view, setView] = useState<ViewMode>("today");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [celebration, setCelebration] = useState({ trigger: 0, message: "" });

  const todayDow = new Date().getDay();
  const balanceFor = (id: number) => balances.find((b) => b.member_id === id)?.stars ?? 0;

  function memberFinishedAll(memberId: number, after: Chore[]): boolean {
    const todays = after.filter((c) => isActiveToday(c, todayDow));
    const assigned = todays.filter((c) => c.assignees.some((a) => a.id === memberId));
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

  if (members.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
        Add a family member first.
      </div>
    );
  }

  const totalToday = chores.filter((c) => isActiveToday(c, todayDow)).length;
  const totalDone = chores
    .filter((c) => isActiveToday(c, todayDow))
    .reduce((acc, c) => acc + c.done_today_by.length, 0);

  return (
    <div>
      <Celebration trigger={celebration.trigger} message={celebration.message} />

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="inline-flex p-1 rounded-full bg-surface border border-line">
          {(["today", "manage"] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  "px-5 py-2 rounded-full text-sm font-semibold transition " +
                  (active ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:text-ink")
                }
              >
                {v === "today" ? "Today" : "Manage"}
              </button>
            );
          })}
        </div>
        {view === "today" && (
          <>
            <span className="text-sm text-muted">
              {totalDone} of {totalToday} done
            </span>
            <button
              onClick={() => setHideCompleted((v) => !v)}
              className={
                "ml-2 px-4 py-2 rounded-full text-sm font-medium transition border " +
                (hideCompleted
                  ? "bg-ink text-white border-ink shadow-sm"
                  : "bg-surface text-ink-2 border-line hover:bg-surface-2")
              }
            >
              {hideCompleted ? "Showing remaining" : "Hide completed"}
            </button>
          </>
        )}
        {view === "manage" && (
          <button
            onClick={() => setShowForm(true)}
            className="ml-auto px-4 py-2 rounded-full bg-ink text-white text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Icon name="plus" size={16} color="white" stroke={2.25} />
            Add chore
          </button>
        )}
      </div>

      {view === "today" ? (
        <TodayView
          members={members}
          chores={chores}
          todayDow={todayDow}
          hideCompleted={hideCompleted}
          balanceFor={balanceFor}
          onToggleDone={toggleDone}
        />
      ) : (
        <ManageView
          members={members}
          chores={chores}
          onChanged={onChanged}
          showForm={showForm}
          setShowForm={setShowForm}
        />
      )}
    </div>
  );
}

function TodayView({
  members,
  chores,
  todayDow,
  hideCompleted,
  balanceFor,
  onToggleDone,
}: {
  members: FamilyMember[];
  chores: Chore[];
  todayDow: number;
  hideCompleted: boolean;
  balanceFor: (id: number) => number;
  onToggleDone: (c: Chore, memberId: number) => void;
}) {
  const todays = useMemo(
    () => chores.filter((c) => isActiveToday(c, todayDow)),
    [chores, todayDow],
  );

  const memberCards = useMemo(() => {
    return members
      .map((m) => {
        const mine = todays.filter((c) => c.assignees.some((a) => a.id === m.id));
        return { member: m, chores: mine };
      })
      .filter((x) => x.chores.length > 0);
  }, [members, todays]);

  if (memberCards.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
        No chores assigned for today. Switch to <strong>Manage</strong> to add some.
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(420px,1fr))]">
      {memberCards.map(({ member: m, chores: mine }) => {
        const done = mine.filter((c) => c.done_today_by.includes(m.id)).length;
        const total = mine.length;
        const pct = total === 0 ? 0 : (done / total) * 100;
        return (
          <article
            key={m.id}
            className="rounded-[28px] border border-line bg-surface overflow-hidden flex flex-col shadow-sm"
          >
            {/* Big colored header band */}
            <header
              className="px-5 py-4 flex items-center gap-4"
              style={{
                background: tint(m.color, 0.32),
                borderBottom: `1px solid ${tint(m.color, 0.45)}`,
              }}
            >
              <div
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-3xl shrink-0"
                style={{ boxShadow: `0 0 0 3px ${tint(m.color, 0.5)}` }}
              >
                {m.avatar_emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl font-medium leading-tight">{m.name}</div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <div
                    className="h-1.5 w-28 rounded-full"
                    style={{ background: "rgba(255,255,255,0.6)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: m.color,
                        boxShadow: `0 0 8px ${m.color}`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-ink tabular-nums">
                    {done}/{total}
                  </span>
                </div>
              </div>
              {m.is_kid && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full font-bold text-ink shrink-0">
                  <Icon name="starFill" size={14} fill="var(--color-star)" color="var(--color-star)" />
                  <span className="tabular-nums">{balanceFor(m.id)}</span>
                </div>
              )}
            </header>

            <div className="p-3.5 space-y-3 flex-1 overflow-auto">
              {SECTIONS.map((s) => {
                const sectionChores = mine.filter((c) =>
                  s.key === "any" ? c.time_of_day == null : c.time_of_day === s.key,
                );
                const visible = hideCompleted
                  ? sectionChores.filter((c) => !c.done_today_by.includes(m.id))
                  : sectionChores;
                if (sectionChores.length === 0) return null;
                if (visible.length === 0) return null;
                return (
                  <section key={s.key}>
                    <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted px-1 mb-2 flex items-center gap-2">
                      <Icon name={s.icon} size={14} color="var(--color-muted)" />
                      {s.label}
                    </h3>
                    <ul className="space-y-1.5">
                      {visible.map((c) => (
                        <TaskRow
                          key={c.id}
                          chore={c}
                          member={m}
                          done={c.done_today_by.includes(m.id)}
                          onToggle={() => onToggleDone(c, m.id)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TaskRow({
  chore,
  member,
  done,
  onToggle,
}: {
  chore: Chore;
  member: FamilyMember;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        className={
          "w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl transition active:scale-[0.99] text-left " +
          (done ? "opacity-70" : "")
        }
        style={{
          background: done ? "var(--color-bg-2)" : tint(member.color, 0.16),
        }}
      >
        <span
          className="w-[38px] h-[38px] rounded-xl bg-white flex items-center justify-center text-xl shrink-0"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          {chore.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={
              "font-semibold leading-tight " + (done ? "line-through text-muted" : "text-ink")
            }
          >
            {chore.name}
          </div>
          {chore.star_value > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold mt-0.5" style={{ color: "var(--color-star)" }}>
              <Icon name="starFill" size={12} fill="var(--color-star)" color="var(--color-star)" />
              {chore.star_value}
            </div>
          )}
        </div>
        <Checkbox checked={done} color={member.color} />
      </button>
    </li>
  );
}

function Checkbox({ checked, color }: { checked: boolean; color: string }) {
  return (
    <span
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 transition"
      style={{
        background: checked ? color : "white",
        border: `2px solid ${checked ? color : "rgba(0,0,0,0.1)"}`,
        color: "white",
      }}
    >
      {checked && <Icon name="check" size={16} stroke={3} color="white" />}
    </span>
  );
}

function ManageView({
  members,
  chores,
  onChanged,
  showForm,
  setShowForm,
}: {
  members: FamilyMember[];
  chores: Chore[];
  onChanged: () => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}) {
  async function remove(id: number) {
    if (!confirm("Delete this chore?")) return;
    await api.deleteChore(id);
    onChanged();
  }

  return (
    <div>
      {showForm && (
        <div className="mb-4">
          <ChoreForm
            members={members}
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              onChanged();
            }}
          />
        </div>
      )}

      {chores.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
          No chores yet.
        </div>
      ) : (
        <ul className="grid gap-3">
          {chores.map((c) => (
            <li
              key={c.id}
              className="rounded-3xl bg-surface border border-line p-5 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-bg-2 flex items-center justify-center text-3xl shrink-0">
                  {c.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">{c.name}</div>
                  <div className="text-sm text-ink-2 flex items-center gap-2 flex-wrap">
                    <span>{describeRecurrence(c)}</span>
                    {c.time_of_day && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{c.time_of_day}</span>
                      </>
                    )}
                    {c.star_value > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1" style={{ color: "var(--color-star)" }}>
                          <Icon name="starFill" size={12} fill="var(--color-star)" color="var(--color-star)" />
                          {c.star_value}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="w-9 h-9 rounded-full text-muted hover:bg-bg-2 hover:text-danger inline-flex items-center justify-center"
                  aria-label="Delete chore"
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
              {c.assignees.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {c.assignees.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: tint(a.color, 0.2) }}
                    >
                      <span>{a.avatar_emoji}</span>
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type RepeatChoice = "none" | "daily" | "weekdays" | "weekends" | "custom";

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
  const [repeat, setRepeat] = useState<RepeatChoice>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | "">("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);

  function toggleAssignee(id: number) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleDay(d: number) {
    setCustomDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  function resolveRecurrence(): { recurrence: Recurrence; weekdays: number[] | null } {
    if (repeat === "none") return { recurrence: "none", weekdays: null };
    if (repeat === "daily") return { recurrence: "daily", weekdays: null };
    if (repeat === "weekdays") return { recurrence: "weekdays", weekdays: [1, 2, 3, 4, 5] };
    if (repeat === "weekends") return { recurrence: "weekdays", weekdays: [0, 6] };
    return { recurrence: "weekdays", weekdays: customDays };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { recurrence, weekdays } = resolveRecurrence();
    if (recurrence === "weekdays" && (weekdays ?? []).length === 0) {
      alert("Pick at least one day of the week.");
      return;
    }
    await api.createChore({
      name: name.trim(),
      emoji,
      star_value: stars,
      recurrence,
      weekdays,
      time_of_day: (timeOfDay || null) as TimeOfDay | null,
      assignee_ids: assigneeIds,
    });
    onSaved();
  }

  const REPEAT_OPTIONS: { value: RepeatChoice; label: string; hint: string }[] = [
    { value: "daily", label: "Every day", hint: "Mon–Sun" },
    { value: "weekdays", label: "Weekdays", hint: "Mon–Fri" },
    { value: "weekends", label: "Weekends", hint: "Sat–Sun" },
    { value: "custom", label: "Custom days", hint: "pick days" },
    { value: "none", label: "One-off", hint: "no repeat" },
  ];

  const TOD_OPTIONS: { value: TimeOfDay | ""; label: string; icon: string }[] = [
    { value: "", label: "Anytime", icon: "checkSquare" },
    { value: "morning", label: "Morning", icon: "sun" },
    { value: "afternoon", label: "Afternoon", icon: "cloud" },
    { value: "evening", label: "Evening", icon: "moon" },
  ];

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-5"
    >
      <h3 className="font-display text-2xl font-medium">New chore</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Chore name (e.g. Make bed)"
        autoFocus
        className="px-4 py-3 rounded-xl bg-bg-2 border border-line text-lg"
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
                (emoji === e ? "ring-2 ring-primary bg-bg-2" : "hover:bg-bg-2")
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm text-ink-2 mb-2">Time of day</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TOD_OPTIONS.map((opt) => {
            const active = timeOfDay === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeOfDay(opt.value)}
                className={
                  "rounded-2xl px-3 py-3 transition border text-center flex flex-col items-center gap-1 " +
                  (active
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-surface border-line hover:bg-bg-2 text-ink-2")
                }
              >
                <Icon name={opt.icon} size={20} color={active ? "white" : "currentColor"} />
                <div className="text-xs font-medium">{opt.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm text-ink-2 mb-2">Repeat</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REPEAT_OPTIONS.map((opt) => {
            const active = repeat === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRepeat(opt.value)}
                className={
                  "rounded-2xl px-3 py-2.5 text-left transition border " +
                  (active
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-surface border-line hover:bg-bg-2")
                }
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className={"text-xs " + (active ? "text-white/75" : "text-muted")}>
                  {opt.hint}
                </div>
              </button>
            );
          })}
        </div>

        {repeat === "custom" && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {WEEKDAY_UI.map((d) => {
              const on = customDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={
                    "w-14 h-12 rounded-xl text-sm font-medium transition " +
                    (on
                      ? "bg-ink text-white shadow-sm"
                      : "bg-bg-2 text-ink-2 border border-line hover:bg-line")
                  }
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-sm text-ink-2">Stars</span>
        <input
          type="number"
          min={0}
          max={20}
          value={stars}
          onChange={(e) => setStars(parseInt(e.target.value || "0", 10))}
          className="px-3 py-2 rounded-xl bg-bg-2 border border-line"
        />
      </label>

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
          className="px-5 py-3 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          Save chore
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl text-ink-2 hover:bg-bg-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
