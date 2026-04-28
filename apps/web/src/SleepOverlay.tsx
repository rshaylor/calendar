import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "./hooks";

export type SleepSchedule = {
  enabled: boolean;
  bedtime: string; // "HH:MM" 24h
  waketime: string;
};

const DEFAULT_SCHEDULE: SleepSchedule = {
  enabled: false,
  bedtime: "22:00",
  waketime: "07:00",
};

export function useSleepMode() {
  const [manual, setManual] = useState(false);
  const [schedule, setSchedule] = useLocalStorage<SleepSchedule>(
    "familyhub:sleep-schedule",
    DEFAULT_SCHEDULE,
  );
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const inSleepHours = useMemo(() => {
    if (!schedule.enabled) return false;
    const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (schedule.bedtime <= schedule.waketime) {
      // same-day window (rare: e.g. 13:00 -> 14:00)
      return hm >= schedule.bedtime && hm < schedule.waketime;
    }
    // crosses midnight: e.g. 22:00 -> 07:00
    return hm >= schedule.bedtime || hm < schedule.waketime;
  }, [now, schedule]);

  // If schedule disengages, clear the manual override too so the overlay doesn't stick
  useEffect(() => {
    if (!inSleepHours) return;
  }, [inSleepHours]);

  return {
    active: manual || inSleepHours,
    manual,
    toggleManual: () => setManual((v) => !v),
    sleep: () => setManual(true),
    wake: () => {
      setManual(false);
    },
    schedule,
    setSchedule,
  };
}

export default function SleepOverlay({
  active,
  onWake,
}: {
  active: boolean;
  onWake: () => void;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;

  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <button
      onClick={onWake}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center text-white"
      aria-label="Wake screen"
    >
      <div className="text-center">
        <div className="text-7xl md:text-9xl font-light tabular-nums">{time}</div>
        <div className="text-xl md:text-2xl mt-4 opacity-50">{date}</div>
        <div className="text-sm mt-16 opacity-25">tap to wake</div>
      </div>
    </button>
  );
}
