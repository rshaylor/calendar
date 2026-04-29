# Family Hub

A Skylight-style family display: shared calendar, kids' chores, star rewards, lists. Designed for a wall-mounted touchscreen plus phone access on the home Wi-Fi.

Calendars come from Home Assistant — connect Google Calendar, Office 365, iCloud, CalDAV, or HA's Local Calendar in HA itself, and Family Hub picks them up automatically. No add-on-specific OAuth, no port forwarding.

## Installing

Family Hub ships as a Home Assistant add-on through this GitHub repository.

1. In HA, go to **Settings → Add-ons → Add-on Store**, click the ⋮ menu in the top right, choose **Repositories**, and paste:
   ```
   https://github.com/rshaylor/calendar
   ```
2. The store now shows a **Family Hub** section. Click **Family Hub → Install**.
3. Open the **Configuration** tab, optionally set your latitude / longitude (for the weather pill), and **Save**.
4. **Start** the add-on. Open the UI from HA's sidebar (it's served via Ingress and auth-protected by HA).
5. In HA, **Settings → Devices & Services → Add Integration** and add at least one calendar (Google Calendar, Local Calendar, Office 365, CalDAV, …). With Nabu Casa, Google Calendar takes ~30 seconds and no Google Cloud setup.
6. Back in Family Hub: **Settings → Calendar** → tick the calendars you want shown, optionally assign each one to a family member.

The SQLite database is persisted in HA's `/data` mount and survives restarts and updates. To upgrade, hit **Update** in the add-on store when a new version is published.

See [family_hub/DOCS.md](family_hub/DOCS.md) for full configuration and troubleshooting.

## Local development

Windows / macOS / Linux with Node and Python installed:

```bash
npm install   # at repo root
npm run dev   # starts API (uvicorn) + web (vite) together
```

The dev server can't read calendars (calendar features need a real HA instance with `SUPERVISOR_TOKEN`), but everything else — chores, rewards, lists, family — works against the local SQLite DB.

## Repo layout

```
repository.yaml         # marks this repo as an HA add-on store
family_hub/             # the add-on itself
  config.yaml           # add-on metadata
  Dockerfile            # add-on build (multi-arch: aarch64, amd64)
  run.sh                # add-on entrypoint
  apparmor.txt          # add-on AppArmor profile (currently disabled)
  DOCS.md               # shown in the add-on's Documentation tab
  CHANGELOG.md          # shown in the add-on's Changelog tab
  apps/api/             # FastAPI backend (chores, rewards, calendar via HA, lists)
  apps/web/             # React + Vite + Tailwind frontend
package.json            # repo-root dev convenience scripts
```
