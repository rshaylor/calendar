import { useCallback, useEffect, useState } from "react";
import { api, type Balance, type Chore, type FamilyMember, type Reward } from "./api";
import TodayTab from "./TodayTab";
import ChoresTab from "./ChoresTab";
import RewardsTab from "./RewardsTab";
import CalendarTab from "./CalendarTab";
import ListsTab from "./ListsTab";
import SettingsTab from "./SettingsTab";
import SleepOverlay, { useSleepMode } from "./SleepOverlay";
import WeatherPill from "./WeatherPill";
import Icon from "./Icon";
import { useIdleTimer } from "./hooks";

type Tab = "today" | "calendar" | "chores" | "rewards" | "lists" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "chores", label: "Chores", icon: "checkSquare" },
  { id: "rewards", label: "Rewards", icon: "star" },
  { id: "lists", label: "Lists", icon: "list" },
];

const REFRESH_INTERVAL_MS = 30_000;
const IDLE_RETURN_MS = 5 * 60_000;

function initialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  if (
    t === "today" ||
    t === "calendar" ||
    t === "chores" ||
    t === "rewards" ||
    t === "lists" ||
    t === "settings"
  )
    return t;
  return "today";
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

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const onIdle = useCallback(() => {
    setTab("today");
  }, []);
  useIdleTimer(IDLE_RETURN_MS, onIdle);

  const titleOf: Record<Tab, string> = {
    today: "Today",
    calendar: "Calendar",
    chores: "Chores",
    rewards: "Rewards",
    lists: "Lists",
    settings: "Settings",
  };
  const dayShort = now.toLocaleDateString(undefined, { weekday: "short" });
  const dayNum = now.getDate();
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const longDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function NavItem({
    id,
    label,
    icon,
    onClick,
    active,
  }: {
    id: string;
    label: string;
    icon: string;
    onClick: () => void;
    active: boolean;
  }) {
    return (
      <button
        key={id}
        onClick={onClick}
        className={
          "w-[72px] py-2.5 rounded-2xl flex flex-col items-center gap-1 transition " +
          (active ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:bg-surface-2")
        }
      >
        <Icon name={icon} size={22} stroke={active ? 2 : 1.75} />
        <span className="text-[11px] font-medium">{label}</span>
      </button>
    );
  }

  return (
    <div className="flex h-full bg-bg text-ink">
      <aside className="w-24 shrink-0 bg-surface border-r border-line flex flex-col items-center py-5">
        {/* Day card */}
        <div className="w-16 h-16 rounded-[18px] bg-bg-2 border border-line-soft flex flex-col items-center justify-center mb-1.5">
          <div className="text-[9px] font-bold tracking-[0.12em] text-muted uppercase">
            {dayShort}
          </div>
          <div className="font-display text-[28px] font-semibold leading-none mt-0.5">
            {dayNum}
          </div>
        </div>
        <div className="text-[22px] font-semibold tabular-nums mb-6">{time}</div>

        <nav className="flex-1 flex flex-col gap-1.5 items-center">
          {TABS.map((t) => (
            <NavItem
              key={t.id}
              id={t.id}
              label={t.label}
              icon={t.icon}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-1.5 items-center">
          <button
            onClick={sleep.sleep}
            className="w-[72px] py-2.5 rounded-2xl flex flex-col items-center gap-1 text-ink-2 hover:bg-surface-2 transition"
            title="Sleep screen"
          >
            <Icon name="moon" size={22} />
            <span className="text-[11px] font-medium">Sleep</span>
          </button>
          <NavItem
            id="settings"
            label="Settings"
            icon="settings"
            active={tab === "settings"}
            onClick={() => setTab("settings")}
          />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="px-6 md:px-10 py-6 flex items-end gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-none">
              {titleOf[tab]}
            </h1>
            <div className="text-muted mt-1.5">{longDate}</div>
          </div>
          <div className="ml-auto">
            <WeatherPill />
          </div>
        </header>

        <div className="px-6 md:px-10 pb-12">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-danger/10 text-danger">{error}</div>
          )}
          {tab === "today" && (
            <TodayTab
              members={members}
              chores={chores}
              balances={balances}
              onChanged={refresh}
            />
          )}
          {tab === "calendar" && (
            <CalendarTab
              members={members}
              chores={chores}
              onGoToSettings={() => setTab("settings")}
            />
          )}
          {tab === "chores" && (
            <ChoresTab
              members={members}
              chores={chores}
              balances={balances}
              onChanged={refresh}
            />
          )}
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

      <SleepOverlay
        active={sleep.active}
        onWake={sleep.wake}
        schedule={sleep.schedule}
        members={members}
      />
    </div>
  );
}
