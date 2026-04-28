import { useCallback, useEffect, useState } from "react";
import { api, type Balance, type Chore, type FamilyMember, type Reward } from "./api";
import ChoresTab from "./ChoresTab";
import RewardsTab from "./RewardsTab";
import CalendarTab from "./CalendarTab";
import ListsTab from "./ListsTab";
import SettingsTab from "./SettingsTab";
import SleepOverlay, { useSleepMode } from "./SleepOverlay";
import WeatherPill from "./WeatherPill";
import { useIdleTimer } from "./hooks";

type Tab = "calendar" | "chores" | "rewards" | "lists" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "chores", label: "Chores", icon: "✅" },
  { id: "rewards", label: "Rewards", icon: "⭐" },
  { id: "lists", label: "Lists", icon: "📝" },
];
const SETTINGS_TAB: { id: Tab; label: string; icon: string } = {
  id: "settings",
  label: "Settings",
  icon: "⚙️",
};

const REFRESH_INTERVAL_MS = 30_000;
const IDLE_RETURN_MS = 5 * 60_000;

function initialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  if (
    t === "calendar" ||
    t === "chores" ||
    t === "rewards" ||
    t === "lists" ||
    t === "settings"
  )
    return t;
  return "calendar";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const sleep = useSleepMode();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [m, c, r, b] = await Promise.all([
        api.listMembers(),
        api.listChores(),
        api.listRewards(),
        api.listBalances(),
      ]);
      setMembers(m);
      setChores(c);
      setRewards(r);
      setBalances(b);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Initial + periodic data refresh
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Idle return to calendar
  const onIdle = useCallback(() => {
    setTab("calendar");
  }, []);
  useIdleTimer(IDLE_RETURN_MS, onIdle);

  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const allTabs = [...TABS, SETTINGS_TAB];

  function NavButton({ t }: { t: (typeof allTabs)[number] }) {
    const active = tab === t.id;
    return (
      <button
        onClick={() => setTab(t.id)}
        className={
          "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition " +
          (active ? "bg-primary text-white shadow-sm" : "text-ink-2 hover:bg-surface-2")
        }
      >
        <span className="text-xl shrink-0">{t.icon}</span>
        <span className="hidden md:inline font-medium">{t.label}</span>
      </button>
    );
  }

  return (
    <div className="flex h-full bg-bg text-ink">
      <aside className="w-20 md:w-56 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-6 hidden md:block">
          <div className="text-xs uppercase tracking-wider text-muted">Family</div>
          <div className="text-xl font-semibold">Hub</div>
        </div>
        <div className="md:hidden p-5 text-2xl text-center">🏠</div>
        <nav className="flex-1 px-3 space-y-1">
          {TABS.map((t) => (
            <NavButton key={t.id} t={t} />
          ))}
        </nav>
        <div className="px-3 pb-3 space-y-1">
          <button
            onClick={sleep.sleep}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-ink-2 hover:bg-surface-2 transition"
            title="Sleep screen"
          >
            <span className="text-xl shrink-0">🌙</span>
            <span className="hidden md:inline font-medium">Sleep</span>
          </button>
          <NavButton t={SETTINGS_TAB} />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="px-6 md:px-10 py-6 flex items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {allTabs.find((t) => t.id === tab)?.label}
            </h1>
            <div className="text-muted mt-1">{date}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <WeatherPill />
            <div className="text-2xl md:text-3xl font-semibold tabular-nums text-ink-2">
              {time}
            </div>
          </div>
        </header>

        <div className="px-6 md:px-10 pb-12 max-w-6xl">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 text-danger">{error}</div>
          )}
          {tab === "calendar" && (
            <CalendarTab
              members={members}
              chores={chores}
              onGoToSettings={() => setTab("settings")}
            />
          )}
          {tab === "chores" && <ChoresTab members={members} chores={chores} onChanged={refresh} />}
          {tab === "rewards" && (
            <RewardsTab
              members={members}
              rewards={rewards}
              balances={balances}
              onChanged={refresh}
            />
          )}
          {tab === "lists" && <ListsTab />}
          {tab === "settings" && (
            <SettingsTab
              members={members}
              onMembersChanged={refresh}
              sleepSchedule={sleep.schedule}
              onSleepScheduleChange={sleep.setSchedule}
            />
          )}
        </div>
      </main>

      <SleepOverlay active={sleep.active} onWake={sleep.wake} />
    </div>
  );
}
