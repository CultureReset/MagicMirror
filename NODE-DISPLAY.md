# NODE display (MagicMirror²)

This is the CultureReset fork of [MagicMirrorOrg/MagicMirror](https://github.com/MagicMirrorOrg/MagicMirror), edited so the TV is a family-hub MagicMirror: a large calendar as the hero, plus clearly separated section modules in official MagicMirror regions. The same sections are meant to appear on the companion phone app (phone is the editor and inbox; the TV is the glanceable board).

It is a working copy / branch (`feat/node-display-20261109`). It is not wired into the live NODE kiosk.

Design follows the 9 November 2026 NODE UI/UX research: Skylight / Hearth / DAKboard / Cozyla section model, plus NODE-only Agents, Workflows, Approvals, and Activity. Meals, photos, and rewards are not subscription-gated. The layout is fluid from 720p to a 100-inch 4K panel — no screen size, host, or path is hardcoded.

## Default TV layout

- **Top-left:** Weather (stock `weather` + `nodeos` provider, NODE `/api/weather`)
- **Top-right:** Clock and date (stock `clock`)
- **Hero, middle:** Two-week color-coded calendar (`MMM-CalendarExt3` v2.3.3) fed by a hidden stock `calendar` module from NODE `/api/calendar` via `/mmm-node/calendar.ics`
- **Right stack (`lower_third`):** Today / upcoming (`MMM-CalendarExt3Agenda` v2.0.5), Meals, Chores
- **Bottom status:** Approvals (count + next, with Approve / Reject / Request revision), Agents (one status line), System (3–5 numbers)
- **Idle:** Photos / privacy cover on `fullscreen_below` after `MM_IDLE_MS` (default 120s; `0` disables). Clock and weather stay visible on top.

## Section catalog (module map)

| ID | Section | Default TV module | Other surfaces / future MM modules |
| --- | --- | --- | --- |
| `calendar` | Calendar | `MMM-CalendarExt3` + hidden `calendar` feeder | Phone/desktop views; optional extra ICS via `NODE_CALENDAR_ICS`. If NODE’s calendar is empty, set `NODE_DEMO_CALENDAR=1` for clearly labeled Demo events, or connect Google / Apple / Outlook / ICS. |
| `clock` | Clock | stock `clock` | Phone header |
| `weather` | Weather | stock `weather` + `nodeos` | Phone glance |
| `meals` | Meals | `MMM-NODE` `kind: meals` | Phone editor. Future: `MMM-Tandoor`, `MMM-MealieMenu`, `MMM-AnyList`. Not paywalled. |
| `chores` | Chores | `MMM-NODE` `kind: chores` | Phone checklist. Future: `MMM-FamilyChores`, `MMM-Chores`, `MMM-GoogleTasks`, `MMM-Todoist`. |
| `approvals` | Approvals | `MMM-NODE` `kind: approvals` | Phone inbox with the same three actions. `/api/approvals` is not on the daemon yet, so the TV shows “None waiting.” |
| `agents` | Agents | `MMM-NODE` `kind: agents` | Desktop cockpit. TV uses human status (“3 agents OK”), never Codex / Crush lists. |
| `system` | System | `MMM-NODE` `kind: system` | Desktop charts. TV: services, disk, uptime only. GPU/power are not in the daemon API. |
| `photos` | Photos / privacy cover | `MMM-NODE` `kind: photos` on `fullscreen_below` | Phone album picker. Future: `MMM-Wallpaper`, `MMM-GooglePhotos`, `MMM-ImageSlideshow`. Not paywalled. |
| `workflows` | Workflows | Opt-in `MMM-NODE` `kind: workflows` | Desktop canvas; phone start/stop. Data: `/api/automations`. Separate from chores. |
| `activity` | Activity | Opt-in `MMM-NODE` `kind: activity` | Phone/desktop pulse. Grouped notifications; not the TV hero. |
| `profiles` | Profiles | Opt-in `MMM-NODE` `kind: profiles` (`/api/worlds`) | Color key on calendar events. Future: `MMM-ProfileSwitcher`. |
| `lists` | Lists / shopping | Opt-in `MMM-NODE` `kind: lists` | Phone store trip. Future: `MMM-Bring`, `MMM-AnyList`. |
| `rewards` | Rewards | Opt-in `MMM-NODE` `kind: rewards` | Phone + small TV status. Not paywalled. |
| `apps` | Apps catalog | Opt-in `MMM-NODE` `kind: apps` | Phone/desktop home. Rakazo stays an app, not the shell. |
| `tasks`, `notes`, `news`, `transit`, `packages`, `smarthome`, `files`, `chat`, `work`, `crm`, `settings` | Catalog sections | Off this TV layout | Phone/desktop as documented in the research catalog. |

`MMM-JarvisDisplay` is kept in the tree from `draft/mmm-jarvis-display-v1`. Not in the default layout.

## Run

```bash
export NODE_URL=http://127.0.0.1:17770   # portable test-run default
export MM_PORT=18080
# Optional, off by default. Adds clearly labeled "Demo:" events so the calendar is not an empty grid.
# export NODE_DEMO_CALENDAR=1
./start-node-display.sh
```

Then open `http://127.0.0.1:18080/` (or whatever `MM_ADDRESS`/`MM_PORT` you set). `serveronly` mode serves the page; a browser or kiosk can display it.

## Environment

See comments in `config/config.js`. Nothing in that file names a machine, a home path, or a screen.
