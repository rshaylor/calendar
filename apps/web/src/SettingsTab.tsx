import { useState } from "react";
import type { FamilyMember } from "./api";
import FamilyTab from "./FamilyTab";
import FamilyNameForm from "./FamilyNameForm";
import CalendarSettings from "./CalendarSettings";
import WeatherSettings from "./WeatherSettings";
import Icon from "./Icon";
import type { SleepSchedule } from "./SleepOverlay";

type Section = "family" | "calendar" | "weather" | "sleep";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "family", label: "Family", icon: "users" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "weather", label: "Weather", icon: "cloudSun" },
  { id: "sleep", label: "Sleep", icon: "moon" },
];

type Props = {
  members: FamilyMember[];
  onMembersChanged: () => void;
  onFamilyNameChanged: () => void;
  sleepSchedule: SleepSchedule;
  onSleepScheduleChange: (next: SleepSchedule) => void;
};

export default function SettingsTab({
  members,
  onMembersChanged,
  onFamilyNameChanged,
  sleepSchedule,
  onSleepScheduleChange,
}: Props) {
  const [section, setSection] = useState<Section>("family");

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-6">
      <aside className="flex flex-col gap-1">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={
                "flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left font-semibold transition " +
                (active
                  ? "bg-surface border border-line text-ink shadow-sm"
                  : "text-ink-2 hover:bg-bg-2 border border-transparent")
              }
            >
              <Icon
                name={s.icon}
                size={20}
                color={active ? "var(--color-ink)" : "var(--color-ink-2)"}
              />
              {s.label}
            </button>
          );
        })}
      </aside>

      <main className="min-w-0">
        {section === "family" && (
          <section className="space-y-8">
            <div>
              <h2 className="font-display text-3xl font-medium mb-1">Family</h2>
              <p className="text-muted mb-5">Set the household name and add or edit family members.</p>
              <FamilyNameForm onChanged={onFamilyNameChanged} />
            </div>
            <div>
              <h3 className="font-display text-2xl font-medium mb-4">Members</h3>
              <FamilyTab members={members} onChanged={onMembersChanged} />
            </div>
          </section>
        )}

        {section === "calendar" && (
          <section>
            <h2 className="font-display text-3xl font-medium mb-1">Calendar</h2>
            <p className="text-muted mb-5">Connect Google accounts and assign calendars to family members.</p>
            <CalendarSettings members={members} />
          </section>
        )}

        {section === "weather" && (
          <section>
            <h2 className="font-display text-3xl font-medium mb-1">Weather</h2>
            <p className="text-muted mb-5">Set your latitude / longitude. Open-Meteo is used (no API key needed).</p>
            <WeatherSettings />
          </section>
        )}

        {section === "sleep" && (
          <section>
            <h2 className="font-display text-3xl font-medium mb-1">Sleep mode</h2>
            <p className="text-muted mb-5">
              Auto-dim the screen at bedtime. Tap the screen to wake it early. Use the moon button in the sidebar to sleep manually anytime.
            </p>
            <div className="rounded-3xl bg-surface border border-line shadow-sm p-5 max-w-xl">
              <label className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={sleepSchedule.enabled}
                  onChange={(e) =>
                    onSleepScheduleChange({ ...sleepSchedule, enabled: e.target.checked })
                  }
                  className="w-5 h-5"
                />
                <span className="font-semibold">Sleep on a schedule</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted font-semibold uppercase tracking-wider">Bedtime</span>
                  <input
                    type="time"
                    value={sleepSchedule.bedtime}
                    onChange={(e) =>
                      onSleepScheduleChange({ ...sleepSchedule, bedtime: e.target.value })
                    }
                    disabled={!sleepSchedule.enabled}
                    className="px-3 py-2.5 rounded-xl bg-bg-2 border border-line disabled:opacity-50 text-base"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted font-semibold uppercase tracking-wider">Waketime</span>
                  <input
                    type="time"
                    value={sleepSchedule.waketime}
                    onChange={(e) =>
                      onSleepScheduleChange({ ...sleepSchedule, waketime: e.target.value })
                    }
                    disabled={!sleepSchedule.enabled}
                    className="px-3 py-2.5 rounded-xl bg-bg-2 border border-line disabled:opacity-50 text-base"
                  />
                </label>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
