import { useEffect, useState } from "react";
import { api } from "./api";

type Props = {
  onChanged: () => void;
};

export default function FamilyNameForm({ onChanged }: Props) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    try {
      const info = await api.familyInfo();
      setName(info.name);
      setSaved(info.name);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === saved) return;
    setBusy(true);
    setStatus(null);
    try {
      await api.setFamilyInfo({ name: name.trim() });
      setSaved(name.trim());
      setStatus("Saved.");
      onChanged();
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl bg-surface border border-line shadow-sm p-5 grid gap-3 max-w-xl"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-semibold uppercase tracking-wider">
          Family name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Shaylor Family"
          className="px-4 py-3 rounded-xl bg-bg-2 border border-line text-lg"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim() || name === saved}
          className="px-5 py-2.5 rounded-2xl bg-ink text-white font-semibold shadow-sm disabled:opacity-50"
        >
          Save
        </button>
        {status && <span className="text-sm text-ink-2">{status}</span>}
      </div>
    </form>
  );
}
