# Proposed MagicMirror display contract v1 (DRAFT)

Status: **PROPOSED only**. Hub Planner verified that no finalized MQTT
bridge / topic / schema exists yet. `/workspace/hub-plan/jarvis-paperclip-bridge-contract.md`
is planning documentation for the Jarvis↔Paperclip handoff, not wiring for
this display surface.

This document defines a conservative read-only display envelope that a
future MQTT bridge _may_ publish for MagicMirror. It is not an existing
contract and must not be treated as live until Matt approves a bridge
implementation.

## Privacy boundary

- MagicMirror is **read-only display**.
- No business database credentials, connection strings, or storage models.
- Sole business-data access path elsewhere remains **gcr-api-clean** (not used by this module).
- No approval fields, command fields, or secret material in payloads.
- This module **subscribes only**; it never publishes commands/acks.

## Proposed topics (not existing)

| Topic                   | Direction            | Purpose                               |
| ----------------------- | -------------------- | ------------------------------------- |
| `gcr/display/v1/tasks`  | broker → MagicMirror | Task/status snapshot for the mirror   |
| `gcr/display/v1/bridge` | broker → MagicMirror | Optional bridge health for the mirror |

Operators may override topic strings in module config. Defaults above are
the proposed v1 names only.

## Proposed schema: `gcr.display.tasks.v1`

```json
{
  "schema": "gcr.display.tasks.v1",
  "updated_at": "2026-11-06T06:00:00.000Z",
  "source": "proposed-bridge",
  "items": [
    {
      "task_id": "opaque-paperclip-or-local-id",
      "title": "Short human title",
      "status": "in_progress",
      "summary": "Optional one-line summary",
      "updated_at": "2026-11-06T05:59:00.000Z"
    }
  ]
}
```

### Allowed `status` values

Aligned with Paperclip native issue statuses observed in planning docs:

`backlog`, `todo`, `in_progress`, `in_review`, `blocked`, `done`, `cancelled`

Unknown values are coerced to `unknown` for display.

### Rejected / forbidden fields

Any payload containing keys such as `approval`, `command`, `password`,
`token`, `secret`, `credential`, `authorization`, `allow`, `database`,
`connectionString`, or `api_key` (case-insensitive) is **rejected** and
not rendered.

## Proposed schema: `gcr.display.bridge.v1`

```json
{
  "schema": "gcr.display.bridge.v1",
  "state": "ok",
  "message": "optional short note",
  "updated_at": "2026-11-06T06:00:00.000Z"
}
```

Allowed `state`: `ok`, `degraded`, `offline`, `unknown`.

## Broker configuration placeholders

Broker host/credentials are unresolved in shared agent context. Configure
on the MagicMirror host only:

- Config: `mqttUrl`, optional `mqttUsername` / `mqttPassword`
- Or env: `MMM_JARVIS_DISPLAY_MQTT_URL`, `MMM_JARVIS_DISPLAY_MQTT_USERNAME`,
  `MMM_JARVIS_DISPLAY_MQTT_PASSWORD`

Example placeholder (not a real broker claim):

```js
mqttUrl: "mqtt://127.0.0.1:1883";
```

Do not commit real secrets. Prefer environment variables on the device.

## Relationship to Jarvis–Paperclip planning doc

The hub-plan Paperclip bridge covers conversation→task→result delivery.
Task/status **display** may later be fed by a **separate** read-only MQTT
projection. That projection is not implemented by the planning doc and is
explicitly out of band until approved.
