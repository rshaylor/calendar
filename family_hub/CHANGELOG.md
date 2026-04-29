# Changelog

## 0.3.0

**Breaking change:** calendars now come from Home Assistant instead of Google directly.

- Removed the in-app Google OAuth flow, the `google_client_id` / `google_client_secret` / `google_redirect_uri` / `calendar_sync_seconds` add-on options, and the direct port `8000` mapping that existed only to receive the OAuth callback.
- Family Hub now reads and writes calendar data through HA's REST + WebSocket API (`homeassistant_api: true`). Set up Google Calendar / Office 365 / Local Calendar / CalDAV / iCloud / etc. in HA itself; Family Hub picks them up automatically. With Nabu Casa, Google Calendar setup takes ~30 seconds.
- Settings → Calendar now lists every HA calendar entity, with per-calendar colour pickers and member assignment.
- Direct Pi (non-HA) deploy path removed (`Dockerfile.prod`, `docker-compose*.yml`, `scripts/pi-setup.sh`). HA add-on is now the only supported deploy.
- On upgrade, the legacy `google_accounts` and `calendar_events` tables are dropped, and `calendar_subscriptions` is rebuilt with the new schema. Family members, chores, rewards, lists, and star balances are preserved. Calendar visibility/owner choices are not — re-pick them once after upgrading.

## 0.2.1

- Disable AppArmor profile — the 0.2.0 profile blocked s6-overlay's `/init` from re-executing, preventing the add-on from restarting cleanly. Will revisit with a properly tested profile.

## 0.2.0

- AppArmor profile added — narrows what the container can do.
- Add-on metadata polished (description, panel mode, startup type, security defaults).
- Documentation tab and changelog tab now ship with the add-on.

## 0.1.0

- Initial Home Assistant add-on.
- Family Hub: calendar (Google sync, full event CRUD), chores with time-of-day routines and star rewards, family lists, settings (family name, members with DOB, calendar accounts, weather, sleep schedule).
- Auto-birthdays on the calendar from member DOB.
- Today tab with kid progress rings, up-next chores, and today's events timeline.
- Sleep mode with big clock and tomorrow's events peek.
- Mobile-responsive — bottom tab bar and vertical agenda for phone access on the home Wi-Fi.
