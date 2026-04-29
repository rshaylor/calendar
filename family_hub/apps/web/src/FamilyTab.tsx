import { useState } from "react";
import { api, type FamilyMember } from "./api";
import Icon from "./Icon";
import { PRESET_AVATARS, PRESET_COLORS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  onChanged: () => void;
};

type FormState =
  | { kind: "closed" }
  | { kind: "creating" }
  | { kind: "editing"; member: FamilyMember };

export function ageFromBirthDate(iso: string): number {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return 0;
  const now = new Date();
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;
  return age;
}

export default function FamilyTab({ members, onChanged }: Props) {
  const [form, setForm] = useState<FormState>({ kind: "closed" });

  async function remove(id: number) {
    if (!confirm("Remove this family member?")) return;
    await api.deleteMember(id);
    onChanged();
  }

  return (
    <div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        {members.map((m) => (
          <div
            key={m.id}
            className="rounded-[20px] bg-surface border border-line shadow-sm p-4 flex items-center gap-3.5"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-3xl shrink-0"
              style={{
                background: tint(m.color, 0.32),
                boxShadow: `0 0 0 3px ${tint(m.color, 0.5)}`,
              }}
            >
              {m.avatar_emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-xl font-medium leading-tight truncate">
                {m.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: m.is_kid ? tint(m.color, 0.28) : "var(--color-bg-2)",
                    color: "var(--color-ink-2)",
                  }}
                >
                  {m.is_kid ? "Kid" : "Grown-up"}
                </div>
                {m.birth_date && (
                  <div className="text-xs text-ink-2">
                    {ageFromBirthDate(m.birth_date)} yrs
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setForm({ kind: "editing", member: m })}
              className="w-9 h-9 rounded-full bg-bg-2 hover:bg-line flex items-center justify-center text-ink-2"
              aria-label="Edit member"
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              onClick={() => remove(m.id)}
              className="w-9 h-9 rounded-full bg-bg-2 hover:bg-line flex items-center justify-center text-ink-2 hover:text-danger"
              aria-label="Remove member"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}

        {form.kind === "closed" && (
          <button
            onClick={() => setForm({ kind: "creating" })}
            className="rounded-[20px] border-2 border-dashed border-line p-4 flex items-center gap-3.5 text-muted hover:bg-bg-2 transition"
          >
            <div className="w-14 h-14 rounded-full bg-bg-2 flex items-center justify-center shrink-0">
              <Icon name="plus" size={24} color="var(--color-muted)" />
            </div>
            <div className="font-semibold text-base">Add a person</div>
          </button>
        )}
      </div>

      {form.kind !== "closed" && (
        <div className="mt-4">
          <MemberForm
            initial={form.kind === "editing" ? form.member : undefined}
            onCancel={() => setForm({ kind: "closed" })}
            onSaved={() => {
              setForm({ kind: "closed" });
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MemberForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: FamilyMember;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.avatar_emoji ?? PRESET_AVATARS[0]);
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [isKid, setIsKid] = useState(initial?.is_kid ?? false);
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      color,
      avatar_emoji: emoji,
      is_kid: isKid,
      birth_date: birthDate ? birthDate : null,
    };
    if (initial) {
      await api.updateMember(initial.id, payload);
    } else {
      await api.createMember(payload);
    }
    onSaved();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-5 max-w-2xl"
    >
      <h3 className="font-display text-2xl font-medium">
        {initial ? `Edit ${initial.name}` : "New family member"}
      </h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        autoFocus
        className="px-4 py-3 rounded-xl bg-bg-2 border border-line text-lg"
      />

      <div>
        <div className="text-sm text-ink-2 mb-2">Avatar</div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_AVATARS.map((e) => (
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
        <div className="text-sm text-ink-2 mb-2">Colour</div>
        <div className="flex gap-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                "w-9 h-9 rounded-full transition " +
                (color === c ? "ring-2 ring-offset-2 ring-ink/30" : "")
              }
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-semibold uppercase tracking-wider">
            Birthday
          </span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="px-3 py-2.5 rounded-xl bg-bg-2 border border-line text-base"
          />
        </label>
        <label className="flex items-end gap-3">
          <input
            type="checkbox"
            checked={isKid}
            onChange={(e) => setIsKid(e.target.checked)}
            className="w-5 h-5 mb-2.5"
          />
          <span className="font-medium pb-2.5">Kid (can earn stars)</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          {initial ? "Save changes" : "Create"}
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
