# Family Hub

A Skylight-style family display: shared calendar, kids' chores, star rewards, lists. Designed for a wall-mounted touchscreen plus phone access on the home Wi-Fi.

Calendars come from Home Assistant — connect Google Calendar, Office 365, iCloud, CalDAV, or HA's Local Calendar in HA itself, and Family Hub picks them up automatically. No add-on-specific OAuth, no port forwarding.

## Installing

The repo is a single-add-on Home Assistant repository.

1. On your HA host (Samba / SSH / VS Code add-on), clone or copy this repo into `/addons/family_hub/`:
   ```bash
   git clone https://github.com/rshaylor/calendar /addons/family_hub
   ```
2. In Home Assistant: **Settings → Add-ons → ⋮ → Check for updates** (or restart the Supervisor). Family Hub appears under **Local add-ons**.
3. Open the add-on, set your latitude/longitude on the **Configuration** tab (optional — for the weather pill).
4. **Start** the add-on. The UI shows up under HA's sidebar via Ingress (auth-protected by HA).
5. In HA, **Settings → Devices & Services → Add Integration** and add at least one calendar (Google Calendar, Local Calendar, Office 365, CalDAV, …). With Nabu Casa, Google Calendar takes ~30 seconds and no Google Cloud setup.
6. Open Family Hub → **Settings → Calendar** → tick the calendars you want shown, optionally assign each one to a family member.

The SQLite database is persisted in HA's `/data` mount and survives restarts and updates.

See [DOCS.md](DOCS.md) for full configuration and troubleshooting.

## Local development

Windows / macOS / Linux with Node and Python installed:

```bash
npm install   # at repo root
npm run dev   # starts API (uvicorn) + web (vite) together
```

The dev server can't read calendars (calendar features need a real HA instance with `SUPERVISOR_TOKEN`), but everything else — chores, rewards, lists, family — works against the local SQLite DB.

## Repo layout

```
apps/api/              # FastAPI backend (chores, rewards, calendar via HA, lists, settings)
apps/web/              # React + Vite + Tailwind frontend
config.yaml            # HA add-on metadata
Dockerfile             # HA add-on build
run.sh                 # HA add-on entrypoint (reads bashio options)
```
