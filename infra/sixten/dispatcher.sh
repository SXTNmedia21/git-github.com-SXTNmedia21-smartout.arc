#!/usr/bin/env bash
# ============================================
# infra/sixten/dispatcher.sh
# Sixten Task Dispatcher (Phase 0.5).
#
# Reads infra/sixten/queue.json, picks the next due pending task,
# POSTs to stage-engine /agent/dispatch, updates status, logs to
# activity-log.
#
# Trigger: heartbeat job `sixten-dispatch` (cooldown 5m), or manual
# invocation for smoke-tests.
#
# Schema: see infra/sixten/queue.json. Each task has:
#   id, title, description, persona, missionPath, instruction,
#   schedule {type, interval_seconds, deadline}, status, priority,
#   created_at, last_run_at, next_run_at, last_result.
#
# Selection rule:
#   status == "pending"
#   AND (next_run_at IS NULL OR next_run_at <= now)
#   AND (deadline IS NULL OR deadline >= now)
#   ORDER BY priority ASC, next_run_at ASC NULLS FIRST
#   LIMIT 1.
#
# Status transitions:
#   pending  -> in_progress         (claimed by dispatcher)
#   in_progress -> completed         (once-task, persona returned ok)
#   in_progress -> pending           (recurring, bump next_run_at)
#   in_progress -> failed            (persona returned non-ok)
#
# Connected to: services/stage-engine/src/routes/agent/dispatch.ts
# Connected to: ~/.claude/scripts/log-activity.sh
# Connected to: HEARTBEAT.md job sixten-dispatch
# ============================================

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────
REPO_ROOT="${REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
QUEUE_FILE="${QUEUE_FILE:-${REPO_ROOT}/infra/sixten/queue.json}"
STAGE_ENGINE_URL="${STAGE_ENGINE_URL:-http://localhost:5010}"
DISPATCH_ENDPOINT="${STAGE_ENGINE_URL}/agent/dispatch"
LOG_SCRIPT="${HOME}/.claude/scripts/log-activity.sh"
ACTOR="claude"
SOURCE="system"
LOG_PREFIX="[sixten-dispatcher]"

# ── Helpers ──────────────────────────────────────────────────────
log() {
  echo "${LOG_PREFIX} $*" >&2
}

log_activity() {
  if [[ -x "${LOG_SCRIPT}" ]]; then
    "${LOG_SCRIPT}" "${SOURCE}" "${ACTOR}" "$1" || true
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "FATAL: required command '$1' not found"
    exit 2
  fi
}

# ── Pre-flight ───────────────────────────────────────────────────
require_cmd jq
require_cmd curl
require_cmd date

if [[ ! -f "${QUEUE_FILE}" ]]; then
  log "queue file not found at ${QUEUE_FILE} — nothing to dispatch"
  exit 0
fi

NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
NOW_EPOCH="$(date -u +%s)"

# ── Validate JSON ────────────────────────────────────────────────
if ! jq empty "${QUEUE_FILE}" 2>/dev/null; then
  log "FATAL: queue.json is not valid JSON"
  exit 3
fi

# ── Pick next due task ───────────────────────────────────────────
# Filter pending + due. Sort by priority asc, next_run_at asc.
# next_run_at NULL is treated as immediately due.
NEXT_TASK="$(
  jq --arg now "${NOW_ISO}" '
    [.tasks[]
     | select(.status == "pending")
     | select(.next_run_at == null or .next_run_at <= $now)
     | select(.schedule.deadline == null or .schedule.deadline >= $now)
    ]
    | sort_by(.priority, .next_run_at // "0001-01-01T00:00:00Z")
    | .[0] // empty
  ' "${QUEUE_FILE}"
)"

if [[ -z "${NEXT_TASK}" ]]; then
  log "no due pending tasks"
  exit 0
fi

TASK_ID="$(echo "${NEXT_TASK}" | jq -r '.id')"
PERSONA="$(echo "${NEXT_TASK}" | jq -r '.persona')"
MISSION_PATH="$(echo "${NEXT_TASK}" | jq -r '.missionPath')"
TITLE="$(echo "${NEXT_TASK}" | jq -r '.title')"
SCHEDULE_TYPE="$(echo "${NEXT_TASK}" | jq -r '.schedule.type')"
INTERVAL_SECONDS="$(echo "${NEXT_TASK}" | jq -r '.schedule.interval_seconds // 0')"

log "dispatching task=${TASK_ID} persona=${PERSONA} mission=${MISSION_PATH}"
log_activity "sixten-dispatcher claiming task=${TASK_ID} (${TITLE}) -> ${PERSONA}"

# ── Claim: pending -> in_progress ────────────────────────────────
TMP_FILE="$(mktemp)"
trap 'rm -f "${TMP_FILE}"' EXIT

jq --arg id "${TASK_ID}" --arg now "${NOW_ISO}" '
  .tasks |= map(
    if .id == $id then
      .status = "in_progress" | .last_run_at = $now
    else . end
  )
' "${QUEUE_FILE}" > "${TMP_FILE}"
mv "${TMP_FILE}" "${QUEUE_FILE}"

# ── POST to stage-engine ─────────────────────────────────────────
PAYLOAD="$(jq -n \
  --arg persona "${PERSONA}" \
  --arg missionPath "${MISSION_PATH}" \
  '{persona: $persona, missionPath: $missionPath}'
)"

HTTP_CODE=0
RESPONSE_BODY=""
if RESPONSE_BODY="$(curl -sS -w '\n%{http_code}' \
  -X POST "${DISPATCH_ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -d "${PAYLOAD}" \
  --max-time 320 \
  2>&1)"; then
  HTTP_CODE="$(echo "${RESPONSE_BODY}" | tail -n1)"
  RESPONSE_BODY="$(echo "${RESPONSE_BODY}" | sed '$d')"
else
  HTTP_CODE=0
  log "curl failed: ${RESPONSE_BODY}"
fi

# Parse ok flag from response (best-effort; default false on parse error)
RESPONSE_OK="$(echo "${RESPONSE_BODY}" | jq -r '.ok // false' 2>/dev/null || echo "false")"

if [[ "${HTTP_CODE}" == "200" && "${RESPONSE_OK}" == "true" ]]; then
  TERMINAL_STATUS="success"
else
  TERMINAL_STATUS="failed"
fi

# ── Update queue based on result ─────────────────────────────────
TMP_FILE="$(mktemp)"

if [[ "${TERMINAL_STATUS}" == "success" ]]; then
  if [[ "${SCHEDULE_TYPE}" == "recurring" && "${INTERVAL_SECONDS}" -gt 0 ]]; then
    NEXT_EPOCH=$((NOW_EPOCH + INTERVAL_SECONDS))
    NEXT_RUN_AT="$(date -u -d "@${NEXT_EPOCH}" +"%Y-%m-%dT%H:%M:%SZ")"
    NEW_STATUS="pending"
  else
    NEXT_RUN_AT="null"
    NEW_STATUS="completed"
  fi
else
  NEXT_RUN_AT="null"
  NEW_STATUS="failed"
fi

jq --arg id "${TASK_ID}" \
   --arg status "${NEW_STATUS}" \
   --arg next "${NEXT_RUN_AT}" \
   --arg result "${TERMINAL_STATUS}" \
   --arg http "${HTTP_CODE}" '
  .tasks |= map(
    if .id == $id then
      .status = $status
      | .next_run_at = (if $next == "null" then null else $next end)
      | .last_result = {terminal: $result, http_code: ($http | tonumber? // 0)}
    else . end
  )
' "${QUEUE_FILE}" > "${TMP_FILE}"
mv "${TMP_FILE}" "${QUEUE_FILE}"

log "task=${TASK_ID} terminal=${TERMINAL_STATUS} http=${HTTP_CODE} new_status=${NEW_STATUS}"
log_activity "sixten-dispatcher task=${TASK_ID} terminal=${TERMINAL_STATUS} http=${HTTP_CODE}"

# Exit non-zero on failure so heartbeat surfaces it
if [[ "${TERMINAL_STATUS}" != "success" ]]; then
  exit 1
fi

exit 0
