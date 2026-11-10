# NODE display (MagicMirror²)

This is the CultureReset fork of [MagicMirrorOrg/MagicMirror](https://github.com/MagicMirrorOrg/MagicMirror), edited so the TV board is a real MagicMirror with a large calendar and the same data NODE already exposes.

It is a working copy / branch (`feat/node-display-20261109`). It is not wired into the live NODE kiosk.

## What is on the board

- **Clock** — stock MagicMirror clock. Timezone and 12/24-hour clock come from the environment.
- **Weather** — stock MagicMirror weather module, with a `nodeos` provider that reads `/api/weather` from the NODE daemon (same numbers NODE shows).
- **Big month calendar** — [MMM-CalendarExt3](https://github.com/MMRIZE/MMM-CalendarExt3) v2.3.3 (pinned and vendored), fed by NODE `/api/calendar` through an ICS route at `/mmm-node/calendar.ics`.
- **Agenda** — [MMM-CalendarExt3Agenda](https://github.com/MMRIZE/MMM-CalendarExt3Agenda) v2.0.5 (pinned and vendored), same NODE events.
- **MMM-NODE** — agents, alerts, system vitals, and the NODE web-app catalog.
- **MMM-JarvisDisplay** — kept from the earlier `draft/mmm-jarvis-display-v1` MQTT draft. Not in the default layout (it needs a broker). Not deleted.

The layout uses viewport `clamp()` so it scales from 720p to 4K. No monitor size is hardcoded.

## Run

```bash
export NODE_URL=http://127.0.0.1:17770   # portable test-run default
export MM_PORT=18080
./start-node-display.sh
```

Then open `http://127.0.0.1:18080/` (or whatever `MM_ADDRESS`/`MM_PORT` you set). `serveronly` mode serves the page; a browser or kiosk can display it.

## Environment

See comments in `config/config.js`. Nothing in that file names a machine, a home path, or a screen.

GPU usage and power draw are not provided by the current NODE daemon API, so MMM-NODE labels those rows instead of inventing values. `/api/alerts` is not implemented on the daemon today; MMM-NODE falls back to `/api/notifications`.
