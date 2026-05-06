#!/usr/bin/env bash
# log.sh — Append-only JSON-line to ops/ci-incidents/log.jsonl.
# Schema per ADR-0275 § Logging schema.
# Inputs (env): INCIDENT_ID, CTX_JSON, TRIAGE_JSON, ACTION_DETAIL,
#               GUARD_SKIP, GUARD_REASON, BRANCH
set -euo pipefail

log() { echo "[log] $*" >&2; }

LOG_FILE="ops/ci-incidents/log.jsonl"
mkdir -p "$(dirname "$LOG_FILE")"

# ---------------------------------------------------------------------------
# Parse context
# ---------------------------------------------------------------------------
# `${VAR:-{}}` parses as `${VAR:-{}` + literal `}` in bash — appends extra `}`
# to the value. Use empty default + null-fallback to a literal "{}" instead.
CTX="${CTX_JSON:-}"
TRIAGE="${TRIAGE_JSON:-}"
[[ -z "$CTX" ]] && CTX="{}"
[[ -z "$TRIAGE" ]] && TRIAGE="{}"

TS_NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INCIDENT="${INCIDENT_ID:-CI-UNKNOWN}"

# Context fields
TRIGGER=$(echo "$CTX" | jq -r '.trigger // "unknown"')
BRANCH_VAL="${BRANCH:-$(echo "$CTX" | jq -r '.branch // "unknown"')}"
WORKFLOW=$(echo "$CTX" | jq -r '.workflow // "unknown"')
RUN_ID=$(echo "$CTX" | jq -r '.run_id // ""')
RUN_ATTEMPT=$(echo "$CTX" | jq -r '.run_attempt // 1')
HEAD_SHA=$(echo "$CTX" | jq -r '.head_sha // ""')
RECURRENCE=$(echo "$CTX" | jq -r '.recurrence_count_30d // 0')

# Triage fields (may be empty if guard skipped triage)
GUARD_SKIPPED="${GUARD_SKIP:-false}"

if [[ "$GUARD_SKIPPED" == "true" ]]; then
  FAILURE_CLASS="deploy"
  ROOT_CAUSE="${GUARD_REASON:-deploy-class on protected branch}"
  CONFIDENCE="1.0"
  ACTION="escalate"
  ACTION_DETAIL_VAL="${ACTION_DETAIL:-deploy-conductor-handoff}"
  SEVERITY="medium"
  IS_KNOWN="false"
  MEMORY_REF=""
  ESCALATED_TO="deploy-conductor"
  SUMMARY="Deploy-class failure handed off to deploy-conductor."
else
  FAILURE_CLASS=$(echo "$TRIAGE" | jq -r '.class // "unknown"')
  ROOT_CAUSE=$(echo "$TRIAGE" | jq -r '.root_cause // ""')
  CONFIDENCE=$(echo "$TRIAGE" | jq -r '.confidence // "0"')
  ACTION=$(echo "$TRIAGE" | jq -r '.action // "no-op"')
  ACTION_DETAIL_VAL="${ACTION_DETAIL:-}"
  SEVERITY=$(echo "$TRIAGE" | jq -r '.severity // "info"')
  IS_KNOWN=$(echo "$TRIAGE" | jq -r '.is_known_pattern // "false"')
  MEMORY_REF=$(echo "$TRIAGE" | jq -r '.memory_ref // ""')
  ESCALATED_TO=""
  SUMMARY=$(echo "$TRIAGE" | jq -r '.summary // ""')
fi

# Extract escalated_to from detail if present
if echo "$ACTION_DETAIL_VAL" | grep -q "issue:"; then
  ESCALATED_TO="${ESCALATED_TO:-github-issue}"
fi
if echo "$ACTION_DETAIL_VAL" | grep -q "linear:"; then
  ESCALATED_TO="${ESCALATED_TO:+${ESCALATED_TO},}linear"
fi

# Determine the failed job name for logging
JOB=$(echo "$CTX" | jq -r '.failed_jobs[0].name // ""')

# ---------------------------------------------------------------------------
# Build the JSON-line entry
# ---------------------------------------------------------------------------
# All required fields: incident_id, ts_detected, trigger, branch,
#   failure_class, confidence, action, severity
ENTRY=$(jq -n \
  --arg incident_id "$INCIDENT" \
  --arg ts_detected "$TS_NOW" \
  --null-input \
  --arg ts_resolved "" \
  --arg trigger "$TRIGGER" \
  --arg branch "$BRANCH_VAL" \
  --arg workflow "$WORKFLOW" \
  --arg job "$JOB" \
  --arg run_id "$RUN_ID" \
  --arg run_attempt "$RUN_ATTEMPT" \
  --arg head_sha "$HEAD_SHA" \
  --arg failure_class "$FAILURE_CLASS" \
  --arg root_cause "$ROOT_CAUSE" \
  --arg confidence "$CONFIDENCE" \
  --arg action "$ACTION" \
  --arg action_detail "$ACTION_DETAIL_VAL" \
  --arg validation "" \
  --arg duration_impact_sec "" \
  --arg recurrence_count_30d "$RECURRENCE" \
  --arg is_known_pattern "$IS_KNOWN" \
  --arg memory_ref "$MEMORY_REF" \
  --arg related_audit "" \
  --arg related_drift "" \
  --arg escalated_to "$ESCALATED_TO" \
  --arg severity "$SEVERITY" \
  --arg follow_up "" \
  --arg summary "$SUMMARY" \
  '{
    incident_id: $incident_id,
    ts_detected: $ts_detected,
    ts_resolved: (if $ts_resolved == "" then null else $ts_resolved end),
    trigger: $trigger,
    branch: $branch,
    workflow: $workflow,
    job: (if $job == "" then null else $job end),
    run_id: (if $run_id == "" then null else $run_id end),
    run_attempt: ($run_attempt | tonumber),
    head_sha: (if $head_sha == "" then null else $head_sha end),
    failure_class: $failure_class,
    root_cause: (if $root_cause == "" then null else $root_cause end),
    confidence: ($confidence | tonumber),
    action: $action,
    action_detail: (if $action_detail == "" then null else $action_detail end),
    validation: null,
    duration_impact_sec: null,
    recurrence_count_30d: ($recurrence_count_30d | tonumber),
    is_known_pattern: ($is_known_pattern == "true"),
    memory_ref: (if $memory_ref == "" then null else $memory_ref end),
    related_audit: null,
    related_drift: null,
    escalated_to: (if $escalated_to == "" then null else $escalated_to end),
    severity: $severity,
    follow_up: null,
    summary: (if $summary == "" then null else $summary end)
  }')

# Append as single line
echo "$ENTRY" | jq -c '.' >> "$LOG_FILE"
log "Appended incident $INCIDENT to $LOG_FILE"
