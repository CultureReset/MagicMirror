# MMM-NODE

MagicMirror² module for the CultureReset NODE display.

It polls the NODE daemon (URL from `NODE_URL` / module config, never a baked-in hostname) and shows:

- Agent providers and their installed/default status
- Alerts (`/api/alerts`, falling back to `/api/notifications` when that route is absent)
- System vitals from `/api/status`, `/api/system`, `/api/files/disk`, and `/api/services`
- A compact count of NODE web apps from `/api/webapps/catalog` (or web apps in `/api/apps`)

The helper also serves `GET /mmm-node/calendar.ics`, a live ICS conversion of `/api/calendar`, so the stock MagicMirror `calendar` module and MMM-CalendarExt3 can show the same NODE events as a big month/agenda calendar.

## Config

```js
{
  module: "MMM-NODE",
  position: "bottom_right",
  header: "NODE",
  config: {
    nodeUrl: process.env.NODE_URL || "http://127.0.0.1:17770",
    updateInterval: 15000
  }
}
```

`nodeUrl` must be a base URL such as `http://127.0.0.1:17770`. Do not hard-code machine hostnames, home paths, or screen sizes.

GPU usage and power draw are not on the current daemon API; the module leaves those rows empty rather than inventing values.
