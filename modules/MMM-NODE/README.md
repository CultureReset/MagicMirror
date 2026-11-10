# MMM-NODE

MagicMirror² modules for the CultureReset NODE family-hub display.

Each section is one module instance (`kind`). The default TV layout places them in official MagicMirror regions rather than dumping everything into one corner panel.

The helper is shared: it polls the NODE daemon (`NODE_URL`) for calendar, weather, and built-in chrome, and the App Store (`NODE_APP_STORE_URL`) for which installed apps to show. Neither URL is a baked-in hostname.

## Kinds

| `kind` | Catalog section | Default TV? | Source today |
| --- | --- | --- | --- |
| `agents` | Agents | Yes — one status line | `/api/control` product services (OpenJarvis, Paperclip, NODE, …). Not Codex / Crush / dev-tool lists. |
| `system` | System | Yes — 3–5 large numbers | services + disk + uptime. No CPU model. GPU/power are not in the daemon API. |
| `board` | Selected installed apps | Yes — `slot: stack` and `slot: status` | Reads the App Store `GET /api/display/layout`. A card appears only when that app is installed and selected. |
| `approvals` | Approvals (legacy single kind) | Prefer `board` | Same card if the Approvals app is installed and selected. Actions: Approve, Reject, Request revision (displayed; the TV does not POST). |
| `meals` | Meals (legacy single kind) | Prefer `board` | Same card if the Meals app is installed and selected. |
| `chores` | Chores (legacy single kind) | Prefer `board` | Same card if the Chores app is installed and selected. |
| `photos` | Photos / privacy cover | Yes — `fullscreen_below` after `MM_IDLE_MS` | Wallpaper cover until a photo API exists. Future: `MMM-Wallpaper`, `MMM-GooglePhotos`. |
| `workflows` | Workflows | Opt-in | `/api/automations` (running / next). Separate from chores. |
| `activity` | Activity | Opt-in (not the TV hero) | `/api/alerts`, else `/api/notifications`, grouped by app + title. |
| `profiles` | Profiles | Opt-in (color key lives on the calendar) | `/api/worlds`. Future: `MMM-ProfileSwitcher`. |
| `lists` | Lists / shopping | Opt-in | Empty until NODE has a lists API. Future: `MMM-Bring`, `MMM-AnyList`. |
| `pantry` | Pantry | Opt-in | Empty until an inventory API exists. |
| `rewards` | Rewards | Opt-in | Empty until a rewards API exists. Not subscription-gated. |
| `apps` | App catalog | Opt-in | `/api/webapps/catalog`. |
| `hub` | All cards in one grid | Opt-in | For layouts that want a single region of cards. |

Also served:

- `GET /mmm-node/calendar.ics` — live ICS of `/api/calendar`
- `GET /mmm-node/demo/{school,family,work,meals}.ics` — clearly labeled **Demo:** events, only wired into the board when `NODE_DEMO_CALENDAR=1`
- `GET /mmm-node/data.json` — last snapshot, for a reliable first paint

Do not hard-code machine hostnames, home paths, or screen sizes.
