#!/usr/bin/env bash
# triage.sh — Call OpenRouter LLM to classify the CI failure.
# Inputs (env): OPENROUTER_API_KEY, CTX_JSON
# Outputs ($GITHUB_OUTPUT): action, confidence, failure_class, severity,
#   summary, suggested_fix, is_known_pattern, memory_ref, triage_json
set -euo pipefail

log() { echo "[triage] $*" >&2; }

PROMPT_FILE=".github/scripts/ci-agent/triage-prompt.md"
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: triage prompt not found at $PROMPT_FILE" >&2
  exit 1
fi

SYSTEM_PROMPT=$(cat "$PROMPT_FILE")
USER_CONTENT="${CTX_JSON}"

log "Calling OpenRouter (anthropic/claude-sonnet-4.6)..."

REQUEST_BODY=$(jq -n \
  --arg model "anthropic/claude-sonnet-4.6" \
  --arg system "$SYSTEM_PROMPT" \
  --arg user "$USER_CONTENT" \
  '{
    model: $model,
    max_tokens: 1024,
    messages: [
      {role: "user", content: $user}
    ],
    system: $system
  }')

RESPONSE=$(curl -s -f \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://github.com/SXTNmedia21/smartout.ai" \
  -H "X-Title: CI Incident Conductor" \
  -d "$REQUEST_BODY" \
  "https://openrouter.ai/api/v1/chat/completions")

if [[ -z "$RESPONSE" ]]; then
  log "ERROR: empty response from OpenRouter"
  exit 1
fi

# Extract message content
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty')
if [[ -z "$CONTENT" ]]; then
  log "ERROR: no content in LLM response"
  echo "$RESPONSE" >&2
  exit 1
fi

log "LLM response received (${#CONTENT} chars)"

# Strip markdown code fences if present
CONTENT_CLEAN=$(echo "$CONTENT" | sed 's/^```json[[:space:]]*//' | sed 's/^```[[:space:]]*//' | sed 's/```[[:space:]]*$//')

# Try direct parse; if fails, extract first {...} block from prose;
# if still fails, synthesise a minimal escalate-medium triage so workflow proceeds.
if ! echo "$CONTENT_CLEAN" | jq . >/dev/null 2>&1; then
  log "Direct parse failed, attempting JSON-block extraction from prose..."
  CONTENT_CLEAN=$(echo "$CONTENT" | sed -n '/^{/,/^}$/p')
  if [[ -z "$CONTENT_CLEAN" ]] || ! echo "$CONTENT_CLEAN" | jq . >/dev/null 2>&1; then
    log "WARNING: LLM returned non-JSON. Falling back to escalate-medium synthetic triage."
    CONTENT_CLEAN=$(jq -n \
      --arg summary "LLM triage failed — non-JSON response." \
      --arg raw "$CONTENT" \
      '{
        action: "escalate",
        confidence: 0.0,
        class: "unknown",
        severity: "medium",
        summary: $summary,
        suggested_fix: "Review CI agent prompt; LLM may need stricter JSON instruction.",
        is_known_pattern: false,
        memory_ref: "",
        root_cause: "Triage LLM did not return JSON",
        raw_content: $raw
      }')
  fi
fi

TRIAGE_JSON=$(echo "$CONTENT_CLEAN" | jq -c '.')

# Parse fields with safe defaults
ACTION=$(echo "$TRIAGE_JSON" | jq -r '.action // "escalate"')
CONFIDENCE=$(echo "$TRIAGE_JSON" | jq -r '.confidence // "0.0"')
FAILURE_CLASS=$(echo "$TRIAGE_JSON" | jq -r '.class // "unknown"')
SEVERITY=$(echo "$TRIAGE_JSON" | jq -r '.severity // "medium"')
SUMMARY=$(echo "$TRIAGE_JSON" | jq -r '.summary // ""')
SUGGESTED_FIX=$(echo "$TRIAGE_JSON" | jq -r '.suggested_fix // ""')
IS_KNOWN=$(echo "$TRIAGE_JSON" | jq -r '.is_known_pattern // "false"')
MEMORY_REF=$(echo "$TRIAGE_JSON" | jq -r '.memory_ref // ""')

# Validate action is in allowed set
case "$ACTION" in
  auto-fix|suggest|escalate|no-op) ;;
  *)
    log "WARNING: unknown action '$ACTION', defaulting to escalate"
    ACTION="escalate"
    ;;
esac

# Validate severity is in allowed set
case "$SEVERITY" in
  info|medium|high|critical) ;;
  *)
    log "WARNING: unknown severity '$SEVERITY', defaulting to medium"
    SEVERITY="medium"
    ;;
esac

log "Triage complete: class=$FAILURE_CLASS action=$ACTION confidence=$CONFIDENCE severity=$SEVERITY"

{
  echo "action=${ACTION}"
  echo "confidence=${CONFIDENCE}"
  echo "failure_class=${FAILURE_CLASS}"
  echo "severity=${SEVERITY}"
  echo "is_known_pattern=${IS_KNOWN}"
  echo "memory_ref=${MEMORY_REF}"
  echo "triage_json<<EOF_TRIAGE"
  echo "$TRIAGE_JSON"
  echo "EOF_TRIAGE"
  # summary and suggested_fix may be multi-line — use heredoc
  echo "summary<<EOF_SUMMARY"
  echo "$SUMMARY"
  echo "EOF_SUMMARY"
  echo "suggested_fix<<EOF_FIX"
  echo "$SUGGESTED_FIX"
  echo "EOF_FIX"
} >> "$GITHUB_OUTPUT"
