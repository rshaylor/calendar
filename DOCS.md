# Family Hub

Shared calendar, chores with star rewards, and family lists — on a kitchen touchscreen and on every family member's phone.

## What it does

- **Today** — a glanceable home tab: kid progress rings, what's up next, and today's events as a clean timeline.
- **Calendar** — every calendar Home Assistant knows about, with per-member colours. Tick which ones to show, assign each to a family member, and pick a week to see everyone's plans side by side. Add / edit / delete events directly from the touchscreen or a phone.
- **Chores** — per-kid lanes with morning / afternoon / evening / anytime sections. Tap to mark done. Stars accumulate.
- **Rewards** — kid-level star bank, parent-defined rewards (movie night, ice cream, …), redeem with one tap, full history.
- **Lists** — multiple lists (grocery / packing / to-do / …) with quick add, swipe-to-clear-done.
- **Birthdays** — set a DOB on a family member and they auto-appear on the calendar each year.
- **Sleep mode** — auto-dim with a big bedside-style clock and tomorrow's events peek; unlock with a tap.
- **Weather** — small icon + temperature in the header (Open-Meteo, no API key needed).

## Screens

The app adapts:
- **15"+ landscape touchscreen** (kitchen wall): full sidebar nav, week-grid calendar, multi-column chore lanes.
- **Phone / portrait small screens** (family on home Wi-Fi): bottom tab bar, vertical agenda, single-column lanes.

## Configuration

All options are set on the **Configuration** tab of the add-on.

| Option | What it does |
|---|---|
| `location_lat` / `location_lon` | Decimal coordinates for the weather pill. Leave blank to hide weather. |

That's it. Calendars are managed in Home Assistant itself — see below.

### Calendar setup

Family Hub doesn't talk to Google directly. It reads from any calendar integration that Home Assistant supports.

**Easy path (with Home Assistant Cloud / Nabu Casa):**
1. In HA: **Settings → Devices & Services → Add Integration → Google Calendar**.
2. Click "Sign in with Google" — HA Cloud handles the OAuth handshake. No Google Cloud project, no client ID, no redirect URI.
3. Pick which Google calendars to expose to HA.
4. Open Family Hub → **Settings → Calendar** → tick the calendars you want shown and assign owners.

**Without Nabu Casa:** the same flow works, but HA walks you through creating a Google Cloud OAuth client. The HA documentation for the Google Calendar integration covers this end-to-end and is much smoother than rolling your own.

**Other calendars:** Local Calendar, CalDAV (Fastmail, Nextcloud, etc.), Office 365 / Microsoft 365, and iCloud are all supported by HA integrations. Add them in HA the same way and they appear in Family Hub.

## Connecting a calendar to a family member

1. Open Family Hub → **Settings → Calendar**.
2. For each calendar you want shown, tick the checkbox.
3. Pick a colour with the colour swatch (defaults to a neutral grey).
4. Optional: pick a family member as the calendar's owner — events on that calendar then show that member's avatar and inherit their colour.

Hit **refresh from HA** if you've just added a new calendar in HA and don't see it in the list yet.

## Data and privacy

- Everything Family Hub stores (members, chores, rewards, lists, calendar visibility/colour preferences) lives in a SQLite database at `/data/app.db` inside the add-on's persistent volume. It survives restarts, updates, and reboots.
- Family Hub doesn't talk to Google, Microsoft, Apple, or any calendar provider directly. All calendar data flows through HA's API on the Yellow.
- The UI is auth-gated by HA Ingress — only people who can sign in to your Home Assistant can use the app.
- Weather goes to Open-Meteo with the lat/lon you set (anonymous, no API key, no account).

## Updating

```bash
cd /addons/family_hub
git pull
# In HA: Settings → Add-ons → Family Hub → Rebuild → Start
```

## Troubleshooting

- **"Calendar isn't reachable"** — confirm `homeassistant_api: true` is set in `config.yaml` (it is by default; this would only be an issue if you've forked and changed it). Restart the add-on so the Supervisor injects a fresh token.
- **No calendars listed** — add at least one calendar integration in HA (Settings → Devices & Services → Add Integration). Then in Family Hub Settings → Calendar, hit **refresh from HA**.
- **Editing or deleting an event fails** — not every HA calendar integration supports update/delete. Local Calendar and recent Google Calendar versions do; CalDAV varies. If your integration is read-only, edits have to be done in the source calendar app.
- **Birthdays don't appear** — set a date of birth on the family member in **Settings → Family**. Birthdays are synthetic events — they aren't pushed anywhere.
- **Weather pill missing** — set `location_lat` and `location_lon` in the add-on Configuration tab.
- **Build fails on apk** — make sure your HA install is on the matching architecture for the base image. The add-on supports `aarch64` and `amd64`.
