#!/usr/bin/env bash
# ============================================
# botsson-canary.sh — Synthetic Botsson chat-path canary
#
# Verifies Mr. Botsson chat-path is alive and answering.
# Two probes:
#   1. GET  /health           → expect 200 (container alive)
#   2. POST /agent/chat       → expect 401 (route + auth-middleware live)
#
# If STAGE_ENGINE_API_KEY is set, also runs:
#   3. POST /agent/chat with x-api-key + minimal valid body → expect 200
#      (full round-trip: auth + DB + dispatcher + LLM)
#
# Exit 0 = all green. Exit non-zero = any red.
# On any fail: telegram alert via heartbeat-notify.sh.
#
# Usage:
#   ./infra/scripts/botsson-canary.sh                       # defaults to local
#   STAGE_ENGINE_URL=https://stage.smartout.ai ./...        # prod target
#   STAGE_ENGINE_API_KEY=xxx ./...                          # full round-trip
#
# Heartbeat-friendly: short-lived, no side effects, exit code is signal.
# ============================================

set -uo pipefail

STAGE_ENGINE_URL="${STAGE_ENGINE_URL:-http://localhost:5010}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"
LATENCY_BUDGET_MS="${LATENCY_BUDGET_MS:-5000}"

NOTIFY_SCRIPT="${HOME}/.claude/scripts/heartbeat-notify.sh"

failures=()

alert_and_record() {
  local msg="$1"
  failures+=("$msg")
  echo "FAIL: $msg" >&2
  if [ -x "$NOTIFY_SCRIPT" ]; then
    "$NOTIFY_SCRIPT" telegram "🔴 botsson-canary: $msg" >/dev/null 2>&1 || true
  fi
}

# ── Probe 1: /health ─────────────────────────────────────────────────
probe_health() {
  local start_ns end_ns latency_ms code
  start_ns=$(date +%s%N)
  code=$(curl -s -o /dev/null --max-time "$TIMEOUT_SECONDS" -w "%{http_code}" "${STAGE_ENGINE_URL}/health" || echo "000")
  end_ns=$(date +%s%N)
  latency_ms=$(( (end_ns - start_ns) / 1000000 ))

  if [ "$code" != "200" ]; then
    alert_and_record "health probe HTTP=$code (target=$STAGE_ENGINE_URL)"
    return 1
  fi
  if [ "$latency_ms" -gt "$LATENCY_BUDGET_MS" ]; then
    alert_and_record "health latency ${latency_ms}ms > budget ${LATENCY_BUDGET_MS}ms"
    return 1
  fi
  echo "OK: /health → 200 (${latency_ms}ms)"
}

# ── Probe 2: /agent/chat unauth → 401 ────────────────────────────────
probe_agent_chat_unauth() {
  local code
  code=$(curl -s -o /dev/null --max-time "$TIMEOUT_SECONDS" -w "%{http_code}" \
    -X POST "${STAGE_ENGINE_URL}/agent/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"canary"}' || echo "000")

  if [ "$code" != "401" ]; then
    alert_and_record "/agent/chat unauth expected 401 got HTTP=$code"
    return 1
  fi
  echo "OK: /agent/chat unauth → 401"
}

# ── Probe 3 (optional): /agent/chat full round-trip ─────────────────
probe_agent_chat_authed() {
  if [ -z "${STAGE_ENGINE_API_KEY:-}" ]; then
    return 0
  fi

  local code response start_ns end_ns latency_ms
  local payload
  payload=$(cat <<'EOF'
{
  "message": "canary ping — ignore",
  "user_context": {
    "role": "admin",
    "status": "active",
    "department_id": null,
    "display_name": "canary",
    "language": "no"
  },
  "workspace_context": {
    "workspace_id": "00000000-0000-0000-0000-000000000000",
    "name": "canary",
    "niche": null,
    "active_season_id": null,
    "active_framework_id": null,
    "planning_cycle_id": null
  },
  "route_context": {
    "path": "/",
    "query": {},
    "entity_type": null,
    "entity_id": null,
    "entity_label": null
  }
}
EOF
)

  start_ns=$(date +%s%N)
  response=$(curl -s --max-time "$TIMEOUT_SECONDS" \
    -X POST "${STAGE_ENGINE_URL}/agent/chat" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${STAGE_ENGINE_API_KEY}" \
    -d "$payload" \
    -w "\nHTTP_CODE=%{http_code}" || echo "HTTP_CODE=000")
  end_ns=$(date +%s%N)
  latency_ms=$(( (end_ns - start_ns) / 1000000 ))

  code=$(echo "$response" | grep -oE 'HTTP_CODE=[0-9]+' | tail -1 | cut -d= -f2)

  if [ "$code" != "200" ]; then
    local body
    body=$(echo "$response" | sed '/HTTP_CODE=/d' | head -c 500)
    alert_and_record "/agent/chat authed HTTP=$code (latency=${latency_ms}ms, body=${body})"
    return 1
  fi
  if [ "$latency_ms" -gt "$LATENCY_BUDGET_MS" ]; then
    alert_and_record "/agent/chat authed latency ${latency_ms}ms > budget ${LATENCY_BUDGET_MS}ms"
    return 1
  fi
  echo "OK: /agent/chat authed → 200 (${latency_ms}ms)"
}

# ── Main ──────────────────────────────────────────────────────────────
echo "botsson-canary @ ${STAGE_ENGINE_URL}"
probe_health || true
probe_agent_chat_unauth || true
probe_agent_chat_authed || true

if [ "${#failures[@]}" -gt 0 ]; then
  echo "═══ ${#failures[@]} probe failure(s) ═══" >&2
  exit 1
fi

echo "═══ all probes green ═══"
exit 0
