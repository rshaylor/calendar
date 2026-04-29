import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  function update(next: T) {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* swallow quota / private mode errors */
    }
  }

  return [value, update];
}

/** Calls onIdle after `ms` of no user activity. Resets on click/keypress/touch. */
export function useIdleTimer(ms: number, onIdle: () => void): void {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    function reset() {
      if (t) clearTimeout(t);
      t = setTimeout(onIdle, ms);
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (t) clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [ms, onIdle]);
}
