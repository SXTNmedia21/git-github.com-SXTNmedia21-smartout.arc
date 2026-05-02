#!/usr/bin/env bash
# Free Metro port (default 8082) before starting Expo dev server.
# Stale metro from a prior session leaves the port in LISTEN, blocking restart.
# Usage: ./scripts/start-clean.sh [extra expo args]
set -euo pipefail

PORT="${EXPO_PORT:-8082}"

PIDS=$(ss -tlnp 2>/dev/null | awk -v p=":${PORT} " '$0 ~ p { match($0, /pid=([0-9]+)/, a); if (a[1]) print a[1] }' | sort -u)

if [ -n "${PIDS}" ]; then
  echo "[start-clean] killing stale process(es) on :${PORT}: ${PIDS}"
  echo "${PIDS}" | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

exec npx expo start --port "${PORT}" "$@"
