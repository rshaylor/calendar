import { useEffect, useState } from "react";
import { api, type Weather } from "./api";
import Icon from "./Icon";

const ICON_FOR_CODE = (code?: number): string => {
  if (code === undefined) return "cloud";
  if (code === 0) return "sun";
  if (code <= 2) return "cloudSun";
  if (code === 3) return "cloud";
  if (code >= 95) return "cloud";
  if (code >= 71 && code <= 86) return "cloud";
  if (code >= 51 && code <= 67) return "cloud";
  return "cloudSun";
};

export default function WeatherPill() {
  const [w, setW] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.weather();
        if (!cancelled) setW(data);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!w || !w.configured || w.error) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface border border-line text-ink"
      title={w.label}
    >
      <Icon name={ICON_FOR_CODE(w.code)} size={18} color="var(--color-ink-2)" />
      <span className="font-semibold tabular-nums">{w.temperature}°</span>
      {w.label && (
        <span className="text-muted font-normal text-sm">· {w.label}</span>
      )}
    </div>
  );
}
