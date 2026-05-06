#!/usr/bin/env bash
# collect.sh — Gather run context for CI incident triage.
# Outputs: ctx_json (JSON string), incident_id, branch, head_sha
# All to $GITHUB_OUTPUT.
set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { echo "[collect] $*" >&2; }

ts_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Generate incident ID: CI-YYYY-MM-DD-NNN (NNN = today's count + 1)
generate_incident_id() {
  local today
  today=$(date -u +"%Y-%m-%d")
  local log_file="ops/ci-incidents/log.jsonl"
  local today_count=0
  if [[ -f "$log_file" ]]; then
    # `grep -c | echo 0` produces multi-line "0\n0" on no-match (grep prints 0,
    # then OR-fallback prints 0). `|| true` swallows non-zero exit silently.
    today_count=$(grep -c "\"ts_detected\":\"${today}" "$log_file" || true)
    [[ -z "$today_count" ]] && today_count=0
  fi
  local seq
  seq=$(printf "%03d" $((today_count + 1)))
  echo "CI-${today}-${seq}"
}

# ---------------------------------------------------------------------------
# Derive event context
# ---------------------------------------------------------------------------
EVENT="${EVENT_NAME:-}"
REPO="${REPOSITORY:-}"
HEAD_SHA="${WORKFLOW_RUN_HEAD_SHA:-$GITHUB_SHA}"
BRANCH="${WORKFLOW_RUN_HEAD_BRANCH:-$GITHUB_REF_NAME}"
WORKFLOW_NAME="${WORKFLOW_RUN_NAME:-unknown}"
RUN_ID="${WORKFLOW_RUN_ID:-$GITHUB_RUN_ID}"
RUN_ATTEMPT="${WORKFLOW_RUN_ATTEMPT:-1}"
CONCLUSION="${WORKFLOW_RUN_CONCLUSION:-unknown}"

log "event=$EVENT branch=$BRANCH sha=$HEAD_SHA"

# ---------------------------------------------------------------------------
# Collect failed job details
# ---------------------------------------------------------------------------
FAILED_JOBS="[]"
LOG_EXCERPT=""

if [[ "$EVENT" == "workflow_run" && -n "$RUN_ID" ]]; then
  log "Fetching job list for run $RUN_ID"
  JOBS_JSON=$(gh api "repos/${REPO}/actions/runs/${RUN_ID}/jobs" --jq '.jobs' 2>/dev/null || echo "[]")
  FAILED_JOBS=$(echo "$JOBS_JSON" | jq '[.[] | select(.conclusion == "failure") | {id: .id, name: .name, conclusion: .conclusion, steps: [.steps[] | select(.conclusion == "failure") | {name: .name, number: .number}]}]' 2>/dev/null || echo "[]")

  # Pull log excerpt from first failed job
  FIRST_FAILED_JOB_ID=$(echo "$FAILED_JOBS" | jq -r '.[0].id // empty' 2>/dev/null || true)
  if [[ -n "$FIRST_FAILED_JOB_ID" ]]; then
    log "Fetching log for job $FIRST_FAILED_JOB_ID"
    LOG_EXCERPT=$(gh api "repos/${REPO}/actions/jobs/${FIRST_FAILED_JOB_ID}/logs" 2>/dev/null | tail -200 | head -200 | sed 's/"/\\"/g; s/\n/\\n/g' || echo "")
  fi
fi

# ---------------------------------------------------------------------------
# Recent commit context (3 commits)
# ---------------------------------------------------------------------------
# Build commits JSON via jq so subjects with embedded `"` or `\` don't break parse.
RECENT_COMMITS=$(git log -3 --pretty='format:%H%x09%h%x09%an%x09%s' 2>/dev/null \
  | jq -Rs 'split("\n") | map(select(length > 0) | split("\t") | {sha:.[0], short:.[1], author:.[2], subject:.[3]})' \
  2>/dev/null) || RECENT_COMMITS="[]"
[[ -z "$RECENT_COMMITS" ]] && RECENT_COMMITS="[]"

# ---------------------------------------------------------------------------
# Regression check — parent commit's run status
# ---------------------------------------------------------------------------
PARENT_SHA=$(git rev-parse HEAD~1 2>/dev/null || echo "")
PARENT_RUN_STATUS="unknown"
if [[ -n "$PARENT_SHA" ]]; then
  PARENT_RUNS=$(gh api "repos/${REPO}/commits/${PARENT_SHA}/check-suites" --jq '.check_suites[0].conclusion // "unknown"' 2>/dev/null || echo "unknown")
  PARENT_RUN_STATUS="$PARENT_RUNS"
fi

# ---------------------------------------------------------------------------
# Recurrence count from log
# ---------------------------------------------------------------------------
RECURRENCE_COUNT=0
LOG_FILE="ops/ci-incidents/log.jsonl"
if [[ -f "$LOG_FILE" ]]; then
  THIRTY_DAYS_AGO=$(date -u -d "30 days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-30d +"%Y-%m-%d" 2>/dev/null || echo "1970-01-01")
  RECURRENCE_COUNT=$(awk -v cutoff="$THIRTY_DAYS_AGO" \
    'BEGIN{c=0} /"workflow":"'"$WORKFLOW_NAME"'"/ && $0 >= cutoff {c++} END{print c}' \
    "$LOG_FILE" 2>/dev/null || echo 0)
fi

# ---------------------------------------------------------------------------
# Assemble context JSON
# ---------------------------------------------------------------------------
INCIDENT_ID=$(generate_incident_id)
TS_DETECTED=$(ts_now)

# Escape log excerpt for JSON embedding. Guard python3 presence explicitly to
# avoid `cmd | python3 || echo "..."` producing concatenated output on failure.
if command -v python3 >/dev/null 2>&1; then
  LOG_EXCERPT_ESCAPED=$(printf '%s' "$LOG_EXCERPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null) || LOG_EXCERPT_ESCAPED='""'
else
  LOG_EXCERPT_ESCAPED='""'
fi

CTX_JSON=$(jq -n \
  --arg incident_id "$INCIDENT_ID" \
  --arg ts_detected "$TS_DETECTED" \
  --arg trigger "$EVENT" \
  --arg branch "$BRANCH" \
  --arg workflow "$WORKFLOW_NAME" \
  --arg run_id "$RUN_ID" \
  --arg run_attempt "$RUN_ATTEMPT" \
  --arg head_sha "$HEAD_SHA" \
  --arg conclusion "$CONCLUSION" \
  --arg parent_run_status "$PARENT_RUN_STATUS" \
  --arg recurrence_count_30d "$RECURRENCE_COUNT" \
  --argjson failed_jobs "$FAILED_JOBS" \
  --argjson recent_commits "$RECENT_COMMITS" \
  --argjson log_excerpt "$LOG_EXCERPT_ESCAPED" \
  '{
    incident_id: $incident_id,
    ts_detected: $ts_detected,
    trigger: $trigger,
    branch: $branch,
    workflow: $workflow,
    run_id: $run_id,
    run_attempt: ($run_attempt | tonumber),
    head_sha: $head_sha,
    conclusion: $conclusion,
    parent_run_status: $parent_run_status,
    recurrence_count_30d: ($recurrence_count_30d | tonumber),
    failed_jobs: $failed_jobs,
    recent_commits: $recent_commits,
    log_excerpt: $log_excerpt
  }')

log "Context collected: incident_id=$INCIDENT_ID"

# ---------------------------------------------------------------------------
# Write outputs
# ---------------------------------------------------------------------------
# ctx_json must be single-line for GITHUB_OUTPUT
CTX_JSON_ONELINE=$(echo "$CTX_JSON" | jq -c '.')

{
  echo "incident_id=${INCIDENT_ID}"
  echo "branch=${BRANCH}"
  echo "head_sha=${HEAD_SHA}"
  echo "ctx_json<<EOF_CTX"
  echo "$CTX_JSON_ONELINE"
  echo "EOF_CTX"
} >> "$GITHUB_OUTPUT"

log "Outputs written."
