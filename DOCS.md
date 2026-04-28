# Family Hub

Shared calendar, chores with star rewards, and family lists — on a kitchen touchscreen and on every family member's phone.

## What it does

- **Today** — a glanceable home tab: kid progress rings, what's up next, and today's events as a clean timeline.
- **Calendar** — Google Calendar sync with per-member colours. Connect one or more Google accounts, assign each calendar to a family member, then pick a week and see everyone's plans side by side. Add / edit / delete / move events directly from the touchscreen or a phone.
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
| `google_client_id` | OAuth 2.0 Client ID from your Google Cloud project. |
| `google_client_secret` | Matching client secret (treated as a password). |
| `google_redirect_uri` | Must match a redirect URI in your Google OAuth client. Default `http://homeassistant.local:8000/api/calendar/callback` works for most installs — replace `homeassistant.local` if your HA hostname differs. |
| `location_lat` / `location_lon` | Decimal coordinates for the weather pill. Leave blank to hide weather. |
| `calendar_sync_seconds` | How often the server polls Google Calendar in the background. Default `1800` (30 min). |

### One-time Google Cloud setup

1. Create a Google Cloud project (or reuse one).
2. Enable the **Google Calendar API**.
3. Create an **OAuth 2.0 Client ID** of type **Web application**.
4. Add to **Authorized redirect URIs**: `http://<your-ha-hostname>:8000/api/calendar/callback` — match this exactly to the `google_redirect_uri` option.
5. Add yourself (and any family member who'll need to connect their calendar) as **Test users** on the OAuth consent screen — the app stays in "Testing" mode, which is fine for a personal household app.
6. Paste the Client ID / Client Secret into this add-on's Configuration tab and save.

### Connecting a Google Calendar

1. Open Family Hub (left sidebar in HA, or directly via Ingress).
2. **Settings → Calendar → Connect Google Calendar**.
3. Sign in with the Google account whose calendar you want to use, accept the scopes.
4. You'll land back in Family Hub with the calendar's subscriptions listed.
5. Tick which calendars to show, and (optionally) assign each one to a family member so events get that member's colour.

You can connect multiple Google accounts — each will appear in the list and can be configured independently.

## Data and privacy

- Everything is stored locally in a SQLite database at `/data/app.db` inside the add-on's persistent volume. It survives restarts, updates, and reboots.
- The only data sent off the Yellow is to Google (read-write Calendar) and Open-Meteo (weather, anonymous lat/lon). Nothing is sent to any cloud belonging to this project.
- The UI is auth-gated by HA Ingress — only people who can sign in to your Home Assistant can use the app's UI. The OAuth callback port (8000) is reachable directly without HA auth, but it only handles Google's redirect.

## Updating

```bash
cd /addons/family_hub
git pull
# In HA: Settings → Add-ons → Family Hub → Rebuild → Start
```

## Troubleshooting

- **"Insufficient Permission" when saving an event** — your Google OAuth token was created with a read-only scope. Disconnect the Google account in Settings → Calendar, then reconnect — Google will prompt for the new write scope.
- **Birthdays don't appear** — set a date of birth on the family member in **Settings → Family**. Birthdays are synthetic events — they aren't pushed to Google.
- **Weather pill missing** — set `location_lat` and `location_lon` in the add-on Configuration tab.
- **Build fails on apk** — make sure your HA install is on the matching architecture for the base image. The add-on supports `aarch64` and `amd64`.
