import { useState } from "react";
import { api, type Balance, type FamilyMember, type Reward } from "./api";
import HistoryModal from "./HistoryModal";
import { PRESET_REWARD_EMOJIS, tint } from "./ui";

type Props = {
  members: FamilyMember[];
  rewards: Reward[];
  balances: Balance[];
  onChanged: () => void;
};

export default function RewardsTab({ members, rewards, balances, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [redeemingFor, setRedeemingFor] = useState<{ rewardId: number } | null>(null);
  const [adjustingMemberId, setAdjustingMemberId] = useState<number | null>(null);
  const [historyMember, setHistoryMember] = useState<FamilyMember | null>(null);

  const kids = members.filter((m) => m.is_kid);
  const balanceFor = (id: number) => balances.find((b) => b.member_id === id)?.stars ?? 0;

  async function redeem(rewardId: number, memberId: number) {
    try {
      await api.redeemReward(rewardId, memberId);
      setRedeemingFor(null);
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
        <div className="grid gap-3 mb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kids.map((k) => {
            const stars = balanceFor(k.id);
            const adjusting = adjustingMemberId === k.id;
            return (
              <div
                key={k.id}
                className="rounded-3xl p-5 shadow-sm"
                style={{ background: tint(k.color, 0.18) }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl bg-white shadow-sm">
                    {k.avatar_emoji}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{k.name}</div>
                    <div className="text-xl text-star font-semibold">⭐ {stars}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setAdjustingMemberId(adjusting ? null : k.id)}
                      className="text-sm text-ink-2 hover:text-ink px-3 py-1 rounded-full hover:bg-white/60"
                    >
                      {adjusting ? "close" : "adjust"}
                    </button>
                    <button
                      onClick={() => setHistoryMember(k)}
                      className="text-sm text-ink-2 hover:text-ink px-3 py-1 rounded-full hover:bg-white/60"
                    >
                      history
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

      {rewards.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-line p-8 text-center text-ink-2">
          No rewards yet — add something kids can earn.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rewards.map((r) => (
            <li key={r.id} className="rounded-3xl bg-surface border border-line p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center text-3xl shrink-0">
                  {r.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">{r.name}</div>
                  <div className="text-sm text-star font-medium">⭐ {r.star_cost}</div>
                </div>
                <button
                  onClick={() => setRedeemingFor({ rewardId: r.id })}
                  disabled={kids.length === 0}
                  className="px-4 py-2 rounded-2xl bg-primary text-white font-medium shadow-sm disabled:opacity-40"
                >
                  Redeem
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="text-sm text-muted hover:text-danger px-2 py-1"
                >
                  remove
                </button>
              </div>

              {redeemingFor?.rewardId === r.id && (
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-ink-2 mr-2">For which kid?</span>
                  {kids.map((k) => {
                    const bal = balanceFor(k.id);
                    const canAfford = bal >= r.star_cost;
                    return (
                      <button
                        key={k.id}
                        disabled={!canAfford}
                        onClick={() => redeem(r.id, k.id)}
                        className={
                          "flex items-center gap-2 px-4 py-2 rounded-full text-base font-medium transition " +
                          (canAfford ? "text-white" : "text-muted cursor-not-allowed")
                        }
                        style={{
                          background: canAfford ? k.color : tint(k.color, 0.12),
                        }}
                      >
                        <span>{k.avatar_emoji}</span>
                        <span>{k.name}</span>
                        <span className="opacity-90">⭐ {bal}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setRedeemingFor(null)}
                    className="px-3 py-2 text-ink-2 hover:bg-surface-2 rounded-full"
                  >
                    cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {showForm ? (
          <RewardForm
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
            + Add reward
          </button>
        )}
      </div>

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
          className="flex-1 px-4 py-2 rounded-xl bg-success text-white font-medium shadow-sm disabled:opacity-50"
        >
          + Add ⭐ {amount}
        </button>
        <button
          type="button"
          disabled={busy || amount === 0}
          onClick={() => apply(-1)}
          className="flex-1 px-4 py-2 rounded-xl bg-danger text-white font-medium shadow-sm disabled:opacity-50"
        >
          − Take ⭐ {amount}
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
      className="rounded-3xl p-6 bg-surface border border-line shadow-sm grid gap-4"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Reward (e.g. Movie night)"
        autoFocus
        className="px-4 py-3 rounded-xl bg-surface-2 border border-line text-lg"
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
                (emoji === e ? "ring-2 ring-primary bg-surface-2" : "hover:bg-surface-2")
              }
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-sm text-ink-2">Cost ⭐</span>
        <input
          type="number"
          min={1}
          value={cost}
          onChange={(e) => setCost(parseInt(e.target.value || "1", 10))}
          className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="submit"
          className="px-5 py-3 rounded-2xl bg-primary text-white font-medium shadow-sm"
        >
          Save reward
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
