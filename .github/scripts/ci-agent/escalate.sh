#!/usr/bin/env bash
# escalate.sh — Multi-tier escalation: Issue / Telegram / Linear / CRITICAL.md
# Called directly for action=escalate, or with --handoff flag for boundary-1 handoffs.
# Inputs (env): GH_TOKEN, TELEGRAM_BOT_TOKEN, LINEAR_API_KEY, LINEAR_OPS_PROJECT_ID,
#               TELEGRAM_CHAT_ID, TRIAGE_JSON, INCIDENT_ID, BRANCH, HEAD_SHA, REPOSITORY
# Flags: --handoff, --reason <r>, --incident-id <id>
# Output ($GITHUB_OUTPUT): detail
set -euo pipefail

log() { echo "[escalate] $*" >&2; }

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
HANDOFF_MODE=false
HANDOFF_REASON=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --handoff) HANDOFF_MODE=true; shift ;;
    --reason) HANDOFF_REASON="$2"; shift 2 ;;
    --incident-id) INCIDENT_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve triage fields (with handoff fallback)
# ---------------------------------------------------------------------------
if [[ "$HANDOFF_MODE" == "true" ]]; then
  SEVERITY="medium"
  FAILURE_CLASS="deploy"
  SUMMARY="Deploy-class failure on protected branch — handing off to deploy-conductor."
  ROOT_CAUSE="$HANDOFF_REASON"
  SUGGESTED_FIX="Review with deploy-conductor. See ops/ci-incidents/log.jsonl for incident $INCIDENT_ID."
  IS_KNOWN="false"
  MEMORY_REF=""
  ESCALATED_TO="deploy-conductor"
else
  TRIAGE_JSON="${TRIAGE_JSON:-{}}"
  SEVERITY=$(echo "$TRIAGE_JSON" | jq -r '.severity // "medium"')
  FAILURE_CLASS=$(echo "$TRIAGE_JSON" | jq -r '.class // "unknown"')
  SUMMARY=$(echo "$TRIAGE_JSON" | jq -r '.summary // ""')
  ROOT_CAUSE=$(echo "$TRIAGE_JSON" | jq -r '.root_cause // ""')
  SUGGESTED_FIX=$(echo "$TRIAGE_JSON" | jq -r '.suggested_fix // ""')
  IS_KNOWN=$(echo "$TRIAGE_JSON" | jq -r '.is_known_pattern // "false"')
  MEMORY_REF=$(echo "$TRIAGE_JSON" | jq -r '.memory_ref // ""')
  ESCALATED_TO=""
fi

ISSUE_URL=""
TELEGRAM_SENT=false
LINEAR_TICKET_URL=""
DETAIL_PARTS=()

# ---------------------------------------------------------------------------
# Severity: info — log only, no external escalation
# ---------------------------------------------------------------------------
if [[ "$SEVERITY" == "info" && "$HANDOFF_MODE" != "true" ]]; then
  log "Severity=info — no external escalation"
  echo "detail=info-no-escalation" >> "$GITHUB_OUTPUT"
  exit 0
fi

# ---------------------------------------------------------------------------
# Determine issue label and body
# ---------------------------------------------------------------------------
case "$SEVERITY" in
  critical) ISSUE_LABEL="ci-incident-urgent" ;;
  high)     ISSUE_LABEL="ci-incident-urgent" ;;
  *)        ISSUE_LABEL="ci-incident" ;;
esac

KNOWN_NOTE=""
if [[ "$IS_KNOWN" == "true" && -n "$MEMORY_REF" ]]; then
  KNOWN_NOTE="
> **Known pattern match:** \`${MEMORY_REF}\`"
fi

CRITICAL_MENTION=""
if [[ "$SEVERITY" == "critical" ]]; then
  CRITICAL_MENTION="
@SXTNmedia21 — CRITICAL severity, immediate attention required."
fi

ISSUE_BODY="## CI Incident — ${INCIDENT_ID}

| Field | Value |
|-------|-------|
| Severity | ${SEVERITY} |
| Class | \`${FAILURE_CLASS}\` |
| Branch | \`${BRANCH}\` |
| SHA | \`${HEAD_SHA}\` |

**Summary:** ${SUMMARY}
${KNOWN_NOTE}

**Root cause:** ${ROOT_CAUSE}

**Suggested fix:**
\`\`\`
${SUGGESTED_FIX}
\`\`\`
${CRITICAL_MENTION}
---
<sub>opened by ci-incident-conductor — incident ${INCIDENT_ID}</sub>"

# ---------------------------------------------------------------------------
# Open GitHub Issue (severity >= medium or handoff)
# ---------------------------------------------------------------------------
if [[ "$SEVERITY" != "info" ]]; then
  log "Opening GitHub Issue (label=$ISSUE_LABEL)"
  ISSUE_TITLE="[${SEVERITY}] CI Incident ${INCIDENT_ID}: ${FAILURE_CLASS} on ${BRANCH}"
  if [[ "$HANDOFF_MODE" == "true" ]]; then
    ISSUE_TITLE="[deploy-handoff] CI Incident ${INCIDENT_ID}: deploy-class on ${BRANCH}"
  fi
  ISSUE_URL=$(gh issue create \
    --repo "$REPOSITORY" \
    --label "$ISSUE_LABEL" \
    --title "$ISSUE_TITLE" \
    --body "$ISSUE_BODY" 2>/dev/null || echo "")
  if [[ -n "$ISSUE_URL" ]]; then
    log "Issue created: $ISSUE_URL"
    DETAIL_PARTS+=("issue:${ISSUE_URL}")
  else
    log "WARNING: Issue creation failed"
  fi
fi

# ---------------------------------------------------------------------------
# Telegram alert (severity >= medium)
# ---------------------------------------------------------------------------
if [[ "$SEVERITY" == "medium" || "$SEVERITY" == "high" || "$SEVERITY" == "critical" ]] || [[ "$HANDOFF_MODE" == "true" ]]; then
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
    log "TELEGRAM_BOT_TOKEN not set — skipping Telegram"
  else
    CHAT_ID="${TELEGRAM_CHAT_ID:-}"
    if [[ -z "$CHAT_ID" ]]; then
      log "TELEGRAM_CHAT_ID not set — skipping Telegram"
    else
      EMOJI="⚠️"
      [[ "$SEVERITY" == "high" ]] && EMOJI="🔴"
      [[ "$SEVERITY" == "critical" ]] && EMOJI="🚨"
      [[ "$HANDOFF_MODE" == "true" ]] && EMOJI="🔀"

      TG_TEXT="${EMOJI} *CI Incident ${INCIDENT_ID}*
Class: \`${FAILURE_CLASS}\`
Severity: ${SEVERITY}
Branch: \`${BRANCH}\`
${SUMMARY}

${ISSUE_URL:+Issue: ${ISSUE_URL}}"

      RESPONSE=$(curl -s -X POST \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${CHAT_ID}" \
        -d "parse_mode=Markdown" \
        --data-urlencode "text=${TG_TEXT}" || echo '{"ok":false}')

      if echo "$RESPONSE" | jq -e '.ok == true' >/dev/null 2>&1; then
        log "Telegram alert sent"
        TELEGRAM_SENT=true
        DETAIL_PARTS+=("telegram:sent")
      else
        log "WARNING: Telegram send failed: $RESPONSE"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Linear ticket (severity >= high)
# ---------------------------------------------------------------------------
if [[ "$SEVERITY" == "high" || "$SEVERITY" == "critical" ]]; then
  if [[ -z "${LINEAR_API_KEY:-}" ]]; then
    log "LINEAR_API_KEY not set — skipping Linear"
  else
    # Resolve OPS team/project ID
    OPS_PROJECT_ID="${LINEAR_OPS_PROJECT_ID:-}"

    if [[ -z "$OPS_PROJECT_ID" ]]; then
      # Attempt to look up OPS team ID via API
      TEAMS_RESP=$(curl -s \
        -H "Authorization: ${LINEAR_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"query":"{ teams { nodes { id name key } } }"}' \
        "https://api.linear.app/graphql" 2>/dev/null || echo '{}')
      OPS_TEAM_ID=$(echo "$TEAMS_RESP" | jq -r '.data.teams.nodes[] | select(.key == "OPS") | .id // empty' 2>/dev/null || true)
    fi

    LINEAR_TITLE="👀 CI Incident ${INCIDENT_ID}: ${FAILURE_CLASS} on ${BRANCH}"
    LINEAR_DESCRIPTION="## ${INCIDENT_ID}

**Severity:** ${SEVERITY}
**Class:** \`${FAILURE_CLASS}\`
**Branch:** \`${BRANCH}\`
**SHA:** \`${HEAD_SHA}\`

### Summary
${SUMMARY}

### Root cause
${ROOT_CAUSE}

### Suggested fix
${SUGGESTED_FIX}

${ISSUE_URL:+GitHub Issue: ${ISSUE_URL}}

---
_Opened by ci-incident-conductor_"

    MUTATION=$(jq -n \
      --arg title "$LINEAR_TITLE" \
      --arg description "$LINEAR_DESCRIPTION" \
      --arg teamId "${OPS_TEAM_ID:-}" \
      --arg projectId "${OPS_PROJECT_ID:-}" \
      '{"query": "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id url } } }",
        "variables": {
          "input": {
            "title": $title,
            "description": $description
          } | if $teamId != "" then . + {"teamId": $teamId} else . end
            | if $projectId != "" then . + {"projectId": $projectId} else . end
        }
      }')

    LINEAR_RESP=$(curl -s \
      -H "Authorization: ${LINEAR_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$MUTATION" \
      "https://api.linear.app/graphql" 2>/dev/null || echo '{}')

    LINEAR_TICKET_URL=$(echo "$LINEAR_RESP" | jq -r '.data.issueCreate.issue.url // empty' 2>/dev/null || true)
    if [[ -n "$LINEAR_TICKET_URL" ]]; then
      log "Linear ticket created: $LINEAR_TICKET_URL"
      DETAIL_PARTS+=("linear:${LINEAR_TICKET_URL}")
    else
      log "WARNING: Linear ticket creation failed"
      log "Response: $LINEAR_RESP"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# CRITICAL: commit to ops/ci-incidents/CRITICAL.md + @-mention in Issue
# ---------------------------------------------------------------------------
if [[ "$SEVERITY" == "critical" ]]; then
  log "CRITICAL severity — appending to CRITICAL.md"
  CRITICAL_FILE="ops/ci-incidents/CRITICAL.md"
  mkdir -p "$(dirname "$CRITICAL_FILE")"

  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  {
    echo ""
    echo "## ${INCIDENT_ID} — ${TS}"
    echo ""
    echo "- **Class:** \`${FAILURE_CLASS}\`"
    echo "- **Branch:** \`${BRANCH}\`"
    echo "- **SHA:** \`${HEAD_SHA}\`"
    echo "- **Summary:** ${SUMMARY}"
    echo "- **Issue:** ${ISSUE_URL}"
    echo "- **Linear:** ${LINEAR_TICKET_URL}"
    echo ""
  } >> "$CRITICAL_FILE"

  DETAIL_PARTS+=("critical-md:appended")
fi

# ---------------------------------------------------------------------------
# Assemble final detail string
# ---------------------------------------------------------------------------
DETAIL=$(IFS='|'; echo "${DETAIL_PARTS[*]}")
echo "detail=${DETAIL}" >> "$GITHUB_OUTPUT"
log "Escalation complete: $DETAIL"
