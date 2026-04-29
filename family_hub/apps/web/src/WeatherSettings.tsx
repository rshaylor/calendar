import { useEffect, useState } from "react";
import { api } from "./api";

export default function WeatherSettings() {
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [savedLat, setSavedLat] = useState<number | null>(null);
  const [savedLon, setSavedLon] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.weatherLocation();
      setSavedLat(data.lat);
      setSavedLon(data.lon);
      setLat(data.lat !== null ? String(data.lat) : "");
      setLon(data.lon !== null ? String(data.lon) : "");
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    if (Number.isNaN(latN) || Number.isNaN(lonN)) {
      setError("Enter valid numbers for lat and lon.");
      return;
    }
    setBusy(true);
    try {
      await api.setWeatherLocation(latN, lonN);
      setStatus("Saved. The weather pill will refresh shortly.");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    if (!confirm("Clear the saved location and revert to env-var fallback?")) return;
    setBusy(true);
    try {
      await api.setWeatherLocation(null, null);
      setStatus("Cleared.");
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-3xl bg-surface border border-line shadow-sm p-5 space-y-4"
    >
      <p className="text-sm text-ink-2">
        Weather is shown in the header when a location is set. Uses Open-Meteo (no API key).
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Latitude</span>
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="51.5074"
            className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Longitude</span>
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="-0.1278"
            className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
          />
        </label>
      </div>
      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-2xl bg-primary text-white font-medium shadow-sm disabled:opacity-50"
        >
          Save
        </button>
        {(savedLat !== null || savedLon !== null) && (
          <button
            type="button"
            onClick={clearOverride}
            disabled={busy}
            className="px-3 py-2 rounded-2xl text-ink-2 hover:bg-surface-2 text-sm"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-ink-2">
          Find your coordinates on{" "}
          <a
            href="https://www.openstreetmap.org"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            openstreetmap.org
          </a>
        </span>
      </div>
      {status && <p className="text-success text-sm">{status}</p>}
      {error && <p className="text-danger text-sm">{error}</p>}
    </form>
  );
}
