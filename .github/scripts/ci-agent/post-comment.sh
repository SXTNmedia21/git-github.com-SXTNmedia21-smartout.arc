#!/usr/bin/env bash
# post-comment.sh — Post diagnosis comment on the PR associated with this run.
# Inputs (env): GH_TOKEN, TRIAGE_JSON, INCIDENT_ID, HEAD_SHA, BRANCH
# Output ($GITHUB_OUTPUT): detail
set -euo pipefail

log() { echo "[post-comment] $*" >&2; }

FAILURE_CLASS=$(echo "$TRIAGE_JSON" | jq -r '.class // "unknown"')
CONFIDENCE=$(echo "$TRIAGE_JSON" | jq -r '.confidence // "0"')
SEVERITY=$(echo "$TRIAGE_JSON" | jq -r '.severity // "medium"')
SUMMARY=$(echo "$TRIAGE_JSON" | jq -r '.summary // ""')
SUGGESTED_FIX=$(echo "$TRIAGE_JSON" | jq -r '.suggested_fix // ""')
IS_KNOWN=$(echo "$TRIAGE_JSON" | jq -r '.is_known_pattern // "false"')
MEMORY_REF=$(echo "$TRIAGE_JSON" | jq -r '.memory_ref // ""')
ROOT_CAUSE=$(echo "$TRIAGE_JSON" | jq -r '.root_cause // ""')

# Find the PR associated with this SHA
PR_NUMBER=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${HEAD_SHA}/pulls" \
  --jq '.[0].number // empty' 2>/dev/null || true)

if [[ -z "$PR_NUMBER" ]]; then
  # Try to find PR by branch name
  PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number // empty' 2>/dev/null || true)
fi

if [[ -z "$PR_NUMBER" ]]; then
  log "No PR found for SHA $HEAD_SHA or branch $BRANCH — skipping comment"
  echo "detail=no-pr-found" >> "$GITHUB_OUTPUT"
  exit 0
fi

log "Posting comment on PR #$PR_NUMBER"

# Build severity badge
case "$SEVERITY" in
  info)     SEVERITY_BADGE="[info]" ;;
  medium)   SEVERITY_BADGE="[medium]" ;;
  high)     SEVERITY_BADGE="**[high]**" ;;
  critical) SEVERITY_BADGE="**[CRITICAL]**" ;;
  *)        SEVERITY_BADGE="[$SEVERITY]" ;;
esac

KNOWN_PATTERN_NOTE=""
if [[ "$IS_KNOWN" == "true" && -n "$MEMORY_REF" ]]; then
  KNOWN_PATTERN_NOTE="
> **Known pattern:** matched \`${MEMORY_REF}\`"
fi

COMMENT_BODY="### CI Incident Triage — ${INCIDENT_ID}

| Field | Value |
|-------|-------|
| Severity | ${SEVERITY_BADGE} |
| Class | \`${FAILURE_CLASS}\` |
| Confidence | ${CONFIDENCE} |
| Branch | \`${BRANCH}\` |

**Summary:** ${SUMMARY}
${KNOWN_PATTERN_NOTE}

**Root cause:** ${ROOT_CAUSE}

**Suggested fix:**
\`\`\`
${SUGGESTED_FIX}
\`\`\`

---

<sub>posted by ci-incident-conductor — incident ${INCIDENT_ID}</sub>"

gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY"
log "Comment posted on PR #$PR_NUMBER"
echo "detail=pr-comment:${PR_NUMBER}" >> "$GITHUB_OUTPUT"
