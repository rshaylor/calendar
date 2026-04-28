import { useState } from "react";
import { api, type FamilyMember } from "./api";
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
      {members.length === 0 ? (
        <p className="text-muted">No family members yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="rounded-3xl p-5 flex items-center gap-4 shadow-sm"
              style={{ background: tint(m.color, 0.18) }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                style={{ background: "white" }}
              >
                {m.avatar_emoji}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{m.name}</div>
                <div className="text-sm text-ink-2">{m.is_kid ? "Kid" : "Grown-up"}</div>
              </div>
              <button
                onClick={() => remove(m.id)}
                className="text-sm text-ink-2 hover:text-danger px-3 py-1 rounded-lg hover:bg-white/60"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {showForm ? (
          <MemberForm
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
            + Add family member
          </button>
        )}
      </div>
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
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-4"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        autoFocus
        className="px-4 py-3 rounded-xl bg-surface-2 border border-line text-lg"
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
                (emoji === e ? "ring-2 ring-primary bg-surface-2" : "hover:bg-surface-2")
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

      <label className="flex gap-3 items-center text-ink-2">
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
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm"
        >
          Save
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
