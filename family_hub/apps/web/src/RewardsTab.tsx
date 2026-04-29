import { useState } from "react";
import { api, type Balance, type FamilyMember, type Reward } from "./api";
import HistoryModal from "./HistoryModal";
import Icon from "./Icon";
import { PRESET_REWARD_EMOJIS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  rewards: Reward[];
  balances: Balance[];
  onChanged: () => void;
};

export default function RewardsTab({ members, rewards, balances, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [adjustingMemberId, setAdjustingMemberId] = useState<number | null>(null);
  const [historyMember, setHistoryMember] = useState<FamilyMember | null>(null);

  const kids = members.filter((m) => m.is_kid);
  const balanceFor = (id: number) => balances.find((b) => b.member_id === id)?.stars ?? 0;

  async function redeem(rewardId: number, memberId: number) {
    try {
      await api.redeemReward(rewardId, memberId);
      onChanged();
    } catch (e) {
      alert(String(e));
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this reward? Past redemptions are kept.")) return;
    await api.deleteReward(id);
    onChanged();
  }

  return (
    <div>
      {kids.length > 0 && (
        <div className="grid gap-3 mb-6 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
          {kids.map((k) => {
            const stars = balanceFor(k.id);
            const adjusting = adjustingMemberId === k.id;
            return (
              <div
                key={k.id}
                className="rounded-[28px] p-5"
                style={{
                  background: tint(k.color, 0.22),
                  border: `1px solid ${tint(k.color, 0.4)}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl shrink-0"
                    style={{ boxShadow: `0 0 0 3px ${tint(k.color, 0.5)}` }}
                  >
                    {k.avatar_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-2xl font-medium leading-tight">{k.name}</div>
                    <div className="flex items-center gap-1.5 text-3xl font-bold leading-none mt-1">
                      <Icon name="starFill" size={26} fill="var(--color-star)" color="var(--color-star)" />
                      <span className="tabular-nums">{stars}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => setAdjustingMemberId(adjusting ? null : k.id)}
                      className="w-9 h-9 rounded-xl bg-white flex items-center justify-center hover:opacity-90"
                      title="Adjust stars"
                      aria-label="Adjust stars"
                    >
                      <Icon name="plus" size={18} color="var(--color-ink-2)" />
                    </button>
                    <button
                      onClick={() => setHistoryMember(k)}
                      className="w-9 h-9 rounded-xl bg-white flex items-center justify-center hover:opacity-90"
                      title="History"
                      aria-label="History"
                    >
                      <Icon name="clock" size={18} color="var(--color-ink-2)" />
                    </button>
                  </div>
                </div>
                {adjusting && (
                  <BalanceAdjuster
                    memberId={k.id}
                    onDone={() => {
                      setAdjustingMemberId(null);
                      onChanged();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {rewards.map((r) => (
          <article
            key={r.id}
            className="rounded-3xl bg-surface border border-line shadow-sm p-5 flex flex-col gap-3 relative"
          >
            <button
              onClick={() => remove(r.id)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full text-muted hover:bg-bg-2 hover:text-danger inline-flex items-center justify-center"
              aria-label="Remove reward"
            >
              <Icon name="trash" size={16} />
            </button>
            <div
              className="self-start w-14 h-14 rounded-[18px] flex items-center justify-center text-3xl"
              style={{ background: "var(--color-primary-soft)" }}
            >
              {r.emoji}
            </div>
            <div className="font-display text-xl font-medium leading-tight">{r.name}</div>
            <div className="flex items-center gap-1 text-lg font-bold">
              <Icon name="starFill" size={18} fill="var(--color-star)" color="var(--color-star)" />
              <span className="tabular-nums">{r.star_cost}</span>
            </div>
            {kids.length > 0 && (
              <div className="flex gap-1.5 mt-auto pt-2">
                {kids.map((k) => {
                  const bal = balanceFor(k.id);
                  const canAfford = bal >= r.star_cost;
                  return (
                    <button
                      key={k.id}
                      disabled={!canAfford}
                      onClick={() => redeem(r.id, k.id)}
                      className={
                        "flex-1 px-2 py-2.5 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-sm " +
                        (canAfford ? "" : "cursor-not-allowed")
                      }
                      style={{
                        background: canAfford ? tint(k.color, 0.32) : "var(--color-bg-2)",
                        opacity: canAfford ? 1 : 0.45,
                        color: "var(--color-ink)",
                      }}
                    >
                      <span>{k.avatar_emoji}</span>
                      {canAfford ? "Redeem" : "—"}
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}

        {/* Add tile */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-3xl border-2 border-dashed border-line p-5 flex flex-col items-center justify-center gap-2 text-muted hover:bg-bg-2 transition min-h-[200px]"
          >
            <div className="w-14 h-14 rounded-full bg-bg-2 flex items-center justify-center">
              <Icon name="plus" size={28} color="var(--color-muted)" />
            </div>
            <div className="text-sm font-semibold">Add reward</div>
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <RewardForm
            onCancel={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              onChanged();
            }}
          />
        </div>
      )}

      {historyMember && (
        <HistoryModal member={historyMember} onClose={() => setHistoryMember(null)} />
      )}
    </div>
  );
}

function BalanceAdjuster({
  memberId,
  onDone,
}: {
  memberId: number;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(sign: 1 | -1) {
    if (amount === 0) return;
    setBusy(true);
    try {
      await api.adjustBalance(memberId, sign * amount, reason.trim() || undefined);
      onDone();
    } catch (e) {
      alert(String(e));
      setBusy(false);
    }
  }

  const presets = [1, 5, 10];

  return (
    <div className="mt-4 pt-4 border-t border-white/40 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-ink-2">Quick:</span>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={
              "px-3 py-1.5 rounded-full text-sm font-medium transition " +
              (amount === p ? "bg-white shadow-sm" : "bg-white/40 hover:bg-white/70")
            }
          >
            {p}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || "0", 10)))}
          className="w-20 px-3 py-1.5 rounded-full bg-white/70 border border-white/40 text-sm tabular-nums"
        />
      </div>

      <input
        type="text"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-white/70 border border-white/40 text-sm"
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || amount === 0}
          onClick={() => apply(1)}
          className="flex-1 px-4 py-2 rounded-xl text-white font-semibold shadow-sm disabled:opacity-50"
          style={{ background: "var(--color-success)" }}
        >
          + Add {amount}
        </button>
        <button
          type="button"
          disabled={busy || amount === 0}
          onClick={() => apply(-1)}
          className="flex-1 px-4 py-2 rounded-xl text-white font-semibold shadow-sm disabled:opacity-50"
          style={{ background: "var(--color-danger)" }}
        >
          − Take {amount}
        </button>
      </div>
    </div>
  );
}

function RewardForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PRESET_REWARD_EMOJIS[0]);
  const [cost, setCost] = useState(10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || cost < 1) return;
    await api.createReward({ name: name.trim(), emoji, star_cost: cost });
    onSaved();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-5 max-w-2xl"
    >
      <h3 className="font-display text-2xl font-medium">New reward</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Reward (e.g. Movie night)"
        autoFocus
        className="px-4 py-3 rounded-xl bg-bg-2 border border-line text-lg"
      />
      <div>
        <div className="text-sm text-ink-2 mb-2">Emoji</div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_REWARD_EMOJIS.map((e) => (
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
      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-sm text-ink-2">Cost (stars)</span>
        <input
          type="number"
          min={1}
          value={cost}
          onChange={(e) => setCost(parseInt(e.target.value || "1", 10))}
          className="px-3 py-2 rounded-xl bg-bg-2 border border-line"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-ink text-white font-semibold shadow-sm"
        >
          Save reward
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
