import type { FamilyMember } from "./api";
import FamilyTab from "./FamilyTab";
import CalendarSettings from "./CalendarSettings";
import type { SleepSchedule } from "./SleepOverlay";

type Props = {
  members: FamilyMember[];
  onMembersChanged: () => void;
  sleepSchedule: SleepSchedule;
  onSleepScheduleChange: (next: SleepSchedule) => void;
};

export default function SettingsTab({
  members,
  onMembersChanged,
  sleepSchedule,
  onSleepScheduleChange,
}: Props) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-3">Family</h2>
        <FamilyTab members={members} onChanged={onMembersChanged} />
      </section>

      <div className="grid gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <h2 className="text-xl font-semibold mb-3">Calendar</h2>
          <CalendarSettings members={members} />
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">Sleep mode</h2>
            <div className="rounded-3xl bg-surface border border-line shadow-sm p-5">
              <p className="text-sm text-ink-2 mb-3">
                Auto-dim the screen at bedtime. Tap the screen to wake it up early. Use the
                🌙 button in the sidebar to sleep manually anytime.
              </p>
              <label className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={sleepSchedule.enabled}
                  onChange={(e) =>
                    onSleepScheduleChange({ ...sleepSchedule, enabled: e.target.checked })
                  }
                  className="w-5 h-5"
                />
                <span>Sleep on a schedule</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Bedtime</span>
                  <input
                    type="time"
                    value={sleepSchedule.bedtime}
                    onChange={(e) =>
                      onSleepScheduleChange({ ...sleepSchedule, bedtime: e.target.value })
                    }
                    disabled={!sleepSchedule.enabled}
                    className="px-3 py-2 rounded-xl bg-surface-2 border border-line disabled:opacity-50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Waketime</span>
                  <input
                    type="time"
                    value={sleepSchedule.waketime}
                    onChange={(e) =>
                      onSleepScheduleChange({ ...sleepSchedule, waketime: e.target.value })
                    }
                    disabled={!sleepSchedule.enabled}
                    className="px-3 py-2 rounded-xl bg-surface-2 border border-line disabled:opacity-50"
                  />
                </label>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Weather</h2>
            <div className="rounded-3xl bg-surface border border-line shadow-sm p-5">
              <p className="text-sm text-ink-2">
                Set <code className="px-1 py-0.5 rounded bg-surface-2">LOCATION_LAT</code> and{" "}
                <code className="px-1 py-0.5 rounded bg-surface-2">LOCATION_LON</code> in{" "}
                <code className="px-1 py-0.5 rounded bg-surface-2">apps/api/.env</code> to show
                current weather in the header. Uses Open-Meteo (no API key needed).
              </p>
              <p className="text-sm text-ink-2 mt-2">
                Find your latitude / longitude on{" "}
                <a
                  href="https://www.openstreetmap.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  openstreetmap.org
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
