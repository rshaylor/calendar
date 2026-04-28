import { useEffect, useState } from "react";
import { api, type Weather } from "./api";

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
    const t = setInterval(load, 10 * 60_000); // 10 min
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!w || !w.configured || w.error) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 text-ink-2"
      title={w.label}
    >
      <span className="text-lg">{w.icon}</span>
      <span className="font-semibold tabular-nums">{w.temperature}°</span>
    </div>
  );
}
