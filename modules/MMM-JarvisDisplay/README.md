# MMM-JarvisDisplay (draft)

MagicMirror² custom module that **subscribes read-only** to a proposed MQTT
display contract and redraws a task/status list.

> Draft-only. Not deployed. Topics/schemas are **proposed v1** pending a real
> bridge implementation and Matt's approval. Hub Planner confirmed no
> finalized bridge/topic/schema exists yet.

## Install (draft / local only)

```bash
cd ~/MagicMirror/modules/MMM-JarvisDisplay
npm install --no-audit --no-fund
```

Add to `config/config.js` (placeholders only):

```text
{
  module: "MMM-JarvisDisplay",
  position: "top_left",
  header: "Jarvis Tasks",
  config: {
    // Prefer env MMM_JARVIS_DISPLAY_MQTT_URL on the host.
    mqttUrl: "mqtt://127.0.0.1:1883",
    topics: {
      // PROPOSED — not an existing live contract
      tasks: "gcr/display/v1/tasks",
      bridge: "gcr/display/v1/bridge"
    },
    maxItems: 8
  }
}
```

## Privacy

- Subscribe only (no MQTT publish / commands).
- No business DB credentials or gcr-api-clean calls from this module.
- Payload sanitizer rejects approval/command/secret-looking fields.

## Contract

See [`docs/proposed-display-contract-v1.md`](./docs/proposed-display-contract-v1.md).

## Tests

From the MagicMirror repo root:

```bash
npx vitest run tests/unit/modules/MMM-JarvisDisplay
```
