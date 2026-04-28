import { useState } from "react";
import { api, type FamilyMember } from "./api";
import Icon from "./Icon";
import { PRESET_AVATARS, PRESET_COLORS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  onChanged: () => void;
};

export default function FamilyTab({ members, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);

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
              <div className="font-display text-xl font-medium leading-tight">{m.name}</div>
              <div
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-1"
                style={{
                  background: m.is_kid ? tint(m.color, 0.28) : "var(--color-bg-2)",
                  color: "var(--color-ink-2)",
                }}
              >
                {m.is_kid ? "Kid" : "Grown-up"}
              </div>
            </div>
            <button
              onClick={() => remove(m.id)}
              className="w-9 h-9 rounded-full bg-bg-2 hover:bg-line flex items-center justify-center text-ink-2 hover:text-danger"
              aria-label="Remove member"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-[20px] border-2 border-dashed border-line p-4 flex items-center gap-3.5 text-muted hover:bg-bg-2 transition"
          >
            <div className="w-14 h-14 rounded-full bg-bg-2 flex items-center justify-center shrink-0">
              <Icon name="plus" size={24} color="var(--color-muted)" />
            </div>
            <div className="font-semibold text-base">Add a person</div>
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <MemberForm
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MemberForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PRESET_AVATARS[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isKid, setIsKid] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createMember({ name: name.trim(), color, avatar_emoji: emoji, is_kid: isKid });
    onSaved();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-5 max-w-2xl"
    >
      <h3 className="font-display text-2xl font-medium">New family member</h3>
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

      <label className="flex gap-3 items-center text-ink-2 font-medium">
        <input
          type="checkbox"
          checked={isKid}
          onChange={(e) => setIsKid(e.target.checked)}
          className="w-5 h-5"
        />
        Kid (can earn stars)
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          Save
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
