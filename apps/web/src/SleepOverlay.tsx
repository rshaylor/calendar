import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
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
  schedule,
}: {
  active: boolean;
  onWake: () => void;
  schedule?: SleepSchedule;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;

  // Split into "h:mm" + AM/PM in two scales for the redesign
  const hours = now.getHours();
  const mins = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = ((hours + 11) % 12) + 1;
  const minStr = String(mins).padStart(2, "0");
  const longDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <button
      onClick={onWake}
      className="fixed inset-0 z-[100] flex items-center justify-center text-white"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, oklch(0.18 0.05 280) 0%, oklch(0.08 0.02 270) 65%, #000 100%)",
      }}
      aria-label="Wake screen"
    >
      {/* Schedule indicator top-right */}
      {schedule?.enabled && (
        <div className="absolute top-6 right-8 flex items-center gap-2 opacity-50 text-sm">
          <Icon name="moon" size={16} color="white" />
          <span>sleeping until {schedule.waketime}</span>
        </div>
      )}

      {/* Centered clock */}
      <div className="text-center">
        <div className="font-display tabular-nums" style={{ fontSize: "min(20vw, 168px)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}>
          {hour12}:{minStr}
          <span style={{ fontSize: "0.38em", opacity: 0.5, marginLeft: "0.05em" }}>{period}</span>
        </div>
        <div className="text-xl md:text-2xl mt-4 opacity-70">{longDate}</div>
      </div>

      {/* tap to wake */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-xs opacity-30">
        tap to wake
      </div>
    </button>
  );
}
