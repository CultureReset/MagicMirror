#!/usr/bin/env bash
# Start MagicMirror² in serveronly mode for the NODE display.
# Does not touch a live NODE process. Override ports and URLs with env vars.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export NODE_URL="${NODE_URL:-${NODEOS_URL:-http://127.0.0.1:17770}}"
export MM_ADDRESS="${MM_ADDRESS:-127.0.0.1}"
export MM_PORT="${MM_PORT:-18080}"
if [[ ! -d node_modules/express ]]; then
  echo "Installing MagicMirror production dependencies…"
  npm run install-mm
fi
echo "MagicMirror NODE display on http://${MM_ADDRESS}:${MM_PORT}  (NODE_URL=${NODE_URL})"
exec npm run server
