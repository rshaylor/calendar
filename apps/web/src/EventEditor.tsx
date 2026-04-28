import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CalendarEvent,
  type CalendarSubscription,
  type EventPatchBody,
  type EventWriteBody,
} from "./api";
import Icon from "./Icon";

type Props = {
  event: CalendarEvent | null; // null = creating new
  subs: CalendarSubscription[];
  defaultStart?: Date; // optional initial start time for new events
  onClose: () => void;
  onSaved: () => void;
};

function localDateInput(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function localDateTimeInput(d: Date): string {
  // datetime-local expects YYYY-MM-DDTHH:mm in local time
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string): string {
  // value is "YYYY-MM-DDTHH:mm" in browser local; produce ISO with offset
  return new Date(value).toISOString();
}

function shiftDateString(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateInput(d);
}

export default function EventEditor({ event, subs, defaultStart, onClose, onSaved }: Props) {
  const writableSubs = useMemo(() => subs.filter((s) => s.enabled), [subs]);
  const editing = event !== null;

  const initialSubId = useMemo(() => {
    if (event) {
      return (
        subs.find((s) => s.google_calendar_id === event.calendar_id)?.id ??
        writableSubs.find((s) => s.is_primary)?.id ??
        writableSubs[0]?.id ??
        0
      );
    }
    return writableSubs.find((s) => s.is_primary)?.id ?? writableSubs[0]?.id ?? 0;
  }, [event, subs, writableSubs]);

  const initial = useMemo(() => {
    if (event) {
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      // For all-day events the stored end is exclusive (Google's convention).
      // Show an inclusive end in the UI by subtracting one day.
      const endStr = event.all_day
        ? shiftDateString(localDateInput(e), -1)
        : localDateTimeInput(e);
      return {
        summary: event.summary,
        location: event.location ?? "",
        all_day: event.all_day,
        start: event.all_day ? localDateInput(s) : localDateTimeInput(s),
        end: endStr,
      };
    }
    const s = defaultStart ?? new Date();
    s.setMinutes(0, 0, 0);
    const e = new Date(s.getTime() + 60 * 60_000);
    return {
      summary: "",
      location: "",
      all_day: false,
      start: localDateTimeInput(s),
      end: localDateTimeInput(e),
    };
  }, [event, defaultStart]);

  const [summary, setSummary] = useState(initial.summary);
  const [location, setLocation] = useState(initial.location);
  const [allDay, setAllDay] = useState(initial.all_day);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [subId, setSubId] = useState<number>(initialSubId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When toggling all-day, normalise the start/end formats
  function setAllDayAndAdjust(next: boolean) {
    if (next === allDay) return;
    if (next) {
      setStart(start.slice(0, 10));
      setEnd(end.slice(0, 10));
    } else {
      const s = new Date(start);
      s.setHours(9, 0, 0, 0);
      const e = new Date(start);
      e.setHours(10, 0, 0, 0);
      setStart(localDateTimeInput(s));
      setEnd(localDateTimeInput(e));
    }
    setAllDay(next);
  }

  async function save() {
    if (!summary.trim()) {
      setError("Title is required.");
      return;
    }
    if (subId === 0) {
      setError("Choose a calendar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Google all-day events use exclusive end. UI shows inclusive end,
      // so add one day on submit.
      const startIso = allDay ? start : toIsoFromLocalDateTime(start);
      const endIso = allDay
        ? shiftDateString(end < start ? start : end, 1)
        : toIsoFromLocalDateTime(end);
      if (editing && event) {
        const patch: EventPatchBody = {
          subscription_id: subId,
          summary: summary.trim(),
          location: location.trim(),
          all_day: allDay,
          start: startIso,
          end: endIso,
        };
        await api.updateEvent(event.id, patch);
      } else {
        const body: EventWriteBody = {
          subscription_id: subId,
          summary: summary.trim(),
          location: location.trim(),
          all_day: allDay,
          start: startIso,
          end: endIso,
        };
        await api.createEvent(body);
      }
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    if (!confirm("Delete this event from Google Calendar?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteEvent(event.id);
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (writableSubs.length === 0) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-xl">
          <h3 className="text-lg font-semibold mb-2">No calendars enabled</h3>
          <p className="text-ink-2 mb-4">
            Enable at least one calendar in Settings before you can add events.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-line"
          >
            Close
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface rounded-3xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center mb-4">
          <h3 className="text-lg font-semibold">{editing ? "Edit event" : "New event"}</h3>
          <button
            onClick={onClose}
            className="ml-auto text-muted hover:text-ink rounded-full w-8 h-8 flex items-center justify-center hover:bg-bg-2"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Title"
            autoFocus
            className="px-4 py-3 rounded-xl bg-surface-2 border border-line text-lg"
          />

          <label className="flex items-center gap-2 text-ink-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDayAndAdjust(e.target.checked)}
              className="w-5 h-5"
            />
            All day
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Start</span>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">End</span>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
              />
            </label>
          </div>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
          />

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Calendar</span>
            <select
              value={subId}
              onChange={(e) => setSubId(parseInt(e.target.value, 10))}
              className="px-3 py-2 rounded-xl bg-surface-2 border border-line"
            >
              {writableSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.summary || s.google_calendar_id}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="text-danger text-sm">{error}</div>}

          <div className="flex gap-2 mt-2">
            <button
              onClick={save}
              disabled={busy}
              className="px-5 py-2.5 rounded-2xl bg-primary text-white font-medium shadow-sm disabled:opacity-50"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create event"}
            </button>
            {editing && (
              <button
                onClick={remove}
                disabled={busy}
                className="px-4 py-2.5 rounded-2xl text-danger hover:bg-danger/10"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              disabled={busy}
              className="ml-auto px-4 py-2.5 rounded-2xl text-ink-2 hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
}
