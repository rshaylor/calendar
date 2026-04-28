# Changelog

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
