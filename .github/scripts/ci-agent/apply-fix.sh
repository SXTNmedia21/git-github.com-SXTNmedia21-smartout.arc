#!/usr/bin/env bash
# apply-fix.sh — Execute allowlisted auto-fixes via PRs to development.
# NEVER pushes to main or preview. NEVER patches application code.
# Inputs (env): GH_TOKEN, TRIAGE_JSON, INCIDENT_ID, BRANCH, HEAD_SHA
#               SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (Phase 2C: optional,
#               used to write engine_world status=green on resolve)
# Output ($GITHUB_OUTPUT): detail (description of action taken)
set -euo pipefail

log() { echo "[apply-fix] $*" >&2; }

# ---------------------------------------------------------------------------
# Hard-coded allowlist (mirrored from ADR-0275 § Auto-fix allowlist)
# ---------------------------------------------------------------------------
ALLOWED_CLASSES=(
  "ci-config"
  "dep-cache"
  "flaky"
  "stale-artifact"
)

# Parse triage fields
FAILURE_CLASS=$(echo "$TRIAGE_JSON" | jq -r '.class // "unknown"')
SUGGESTED_FIX=$(echo "$TRIAGE_JSON" | jq -r '.suggested_fix // ""')
CONFIDENCE=$(echo "$TRIAGE_JSON" | jq -r '.confidence // "0"')
SUMMARY=$(echo "$TRIAGE_JSON" | jq -r '.summary // ""')

# ---------------------------------------------------------------------------
# Allowlist gate (hard stop — no bypass)
# ---------------------------------------------------------------------------
CLASS_ALLOWED=false
for allowed in "${ALLOWED_CLASSES[@]}"; do
  if [[ "$FAILURE_CLASS" == "$allowed" ]]; then
    CLASS_ALLOWED=true
    break
  fi
done

if [[ "$CLASS_ALLOWED" != "true" ]]; then
  log "STOP: class '$FAILURE_CLASS' not in auto-fix allowlist — escalating instead"
  echo "detail=class_not_allowed:${FAILURE_CLASS}" >> "$GITHUB_OUTPUT"
  exit 0
fi

# Confidence guard (belt-and-suspenders — workflow already checks, but double here)
CONF_INT=$(echo "$CONFIDENCE" | awk '{printf "%d", $1 * 100}')
if (( CONF_INT < 85 )); then
  log "STOP: confidence $CONFIDENCE < 0.85 — skipping auto-fix"
  echo "detail=confidence_too_low:${CONFIDENCE}" >> "$GITHUB_OUTPUT"
  exit 0
fi

log "Applying fix for class=$FAILURE_CLASS confidence=$CONFIDENCE"

# ---------------------------------------------------------------------------
# Set up git for PR creation
# ---------------------------------------------------------------------------
git config user.email "ci-agent@smartout.ai"
git config user.name "CI Incident Agent"

FIX_BRANCH="ci-auto-fix/${INCIDENT_ID}"
git fetch origin development
git checkout -b "$FIX_BRANCH" origin/development

CHANGES_MADE=false
DETAIL=""

# ---------------------------------------------------------------------------
# Dispatch to fix handler by class
# ---------------------------------------------------------------------------
case "$FAILURE_CLASS" in

  ci-config)
    log "Handler: ci-config — YAML lint + concurrency + timeout fixes"
    # Lint: remove trailing whitespace from workflow files
    WORKFLOW_FILES=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)
    for f in $WORKFLOW_FILES; do
      if sed -i 's/[[:space:]]*$//' "$f" 2>/dev/null && git diff --quiet "$f"; then
        : # no change
      else
        log "Lint-fixed: $f"
        CHANGES_MADE=true
      fi
    done

    # Check if any workflow is missing concurrency or timeout-minutes
    # and the triage suggested adding them
    if echo "$SUGGESTED_FIX" | grep -qi "concurrency"; then
      log "Note: concurrency-add suggested — requires human-readable YAML edit, skipping auto-patch"
      # Concurrency group edits are structural — safe only if we can identify the exact job.
      # Skipping to avoid inadvertent YAML corruption. Log for suggest instead.
      DETAIL="ci-config:lint-only (concurrency add requires suggest)"
    else
      DETAIL="ci-config:lint-whitespace-fix"
    fi
    ;;

  dep-cache)
    log "Handler: dep-cache — pnpm lockfile + cache strategy"
    # Detect pnpm cache steps in workflows and ensure frozen lockfile
    DETAIL="dep-cache:add-frozen-lockfile-flag"
    for wf in .github/workflows/*.yml .github/workflows/*.yaml; do
      [[ -f "$wf" ]] || continue
      if grep -q "pnpm install" "$wf" && ! grep -q "frozen-lockfile" "$wf"; then
        sed -i 's/pnpm install$/pnpm install --frozen-lockfile/g' "$wf"
        log "Added --frozen-lockfile to pnpm install in $wf"
        CHANGES_MADE=true
      fi
    done
    ;;

  flaky)
    log "Handler: flaky — re-run once then quarantine"
    # For flaky tests, we cannot re-run from within this job safely.
    # Instead, we create a PR that adds the test to a known-flaky skip list
    # and opens a Linear ticket (done in escalate.sh).
    # The actual re-run is triggered by marking the check for re-run via gh.
    RUN_ID_TO_RETRY=$(echo "$TRIAGE_JSON" | jq -r '.run_id // ""')
    if [[ -n "$RUN_ID_TO_RETRY" ]]; then
      RETRY_ATTEMPT=$(echo "$TRIAGE_JSON" | jq -r '.run_attempt // "1"')
      if (( RETRY_ATTEMPT <= 1 )); then
        log "Triggering single re-run of run $RUN_ID_TO_RETRY"
        gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${RUN_ID_TO_RETRY}/rerun-failed-jobs" \
          --method POST 2>/dev/null && log "Re-run triggered" || log "Re-run failed (may not be eligible)"
        DETAIL="flaky:single-rerun-triggered"
      else
        log "Already retried (attempt=$RETRY_ATTEMPT) — quarantine path"
        DETAIL="flaky:quarantine-needed (escalate for skip-list PR)"
        CHANGES_MADE=false
      fi
    fi
    ;;

  stale-artifact)
    log "Handler: stale-artifact — add .next/types purge step"
    DETAIL="stale-artifact:next-types-purge-step"
    # Add a purge step before typecheck in ci.yml if not already present
    CI_YML=".github/workflows/ci.yml"
    if [[ -f "$CI_YML" ]] && ! grep -q "rm -rf apps/web/.next/types" "$CI_YML"; then
      # Use python for safer YAML manipulation than raw sed
      python3 - "$CI_YML" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path) as f:
    content = f.read()

purge_step = '''      - name: Purge stale .next/types (L-stale-types pattern)
        # See: memory/learning_stale_next_types_blocks_typecheck.md
        run: rm -rf apps/web/.next/types apps/web/.next/dev/types
'''

# Insert before typecheck step
content = re.sub(
    r'(- name: Type[Cc]heck)',
    purge_step + r'\1',
    content,
    count=1
)

with open(path, 'w') as f:
    f.write(content)

print("Inserted stale-types purge step")
PYEOF
      CHANGES_MADE=true
    else
      log "Purge step already present or ci.yml not found"
      DETAIL="stale-artifact:purge-step-already-exists"
    fi
    ;;

  *)
    log "STOP: unhandled class '$FAILURE_CLASS' — this should not happen after allowlist gate"
    echo "detail=unhandled_class:${FAILURE_CLASS}" >> "$GITHUB_OUTPUT"
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Create PR if changes were made
# ---------------------------------------------------------------------------
if [[ "$CHANGES_MADE" == "true" ]]; then
  git add -A
  if git diff --cached --quiet; then
    log "No staged changes — skipping PR"
    echo "detail=${DETAIL}:no-changes" >> "$GITHUB_OUTPUT"
    exit 0
  fi

  git commit -m "ci(auto-fix): ${INCIDENT_ID} — ${FAILURE_CLASS} fix

${SUGGESTED_FIX}

Incident: ${INCIDENT_ID}
Auto-fix class: ${FAILURE_CLASS}
Confidence: ${CONFIDENCE}

Co-Authored-By: ci-incident-conductor <noreply@anthropic.com>"

  git push origin "$FIX_BRANCH"

  PR_URL=$(gh pr create \
    --base development \
    --head "$FIX_BRANCH" \
    --label "ci-auto-fix" \
    --title "[ci-auto-fix] ${INCIDENT_ID}: ${FAILURE_CLASS}" \
    --body "## CI Auto-Fix — ${INCIDENT_ID}

**Class:** \`${FAILURE_CLASS}\`
**Confidence:** ${CONFIDENCE}

### Summary
${SUMMARY}

### Fix applied
${SUGGESTED_FIX}

---

<sub>opened by ci-incident-conductor — incident ${INCIDENT_ID}</sub>")

  log "PR created: $PR_URL"
  echo "detail=${DETAIL}:pr=${PR_URL}" >> "$GITHUB_OUTPUT"

  # -------------------------------------------------------------------------
  # Phase 2C: write engine_world ci.workflow.<name> status=green on resolve
  # -------------------------------------------------------------------------
  # A fix PR has been created — the incident is considered in-progress resolution.
  # Write status=green optimistically so the surface reflects "fix dispatched".
  # The surface will revert to red on next failure and green when CI passes.
  # fire-and-forget: || true — engine_world write NEVER blocks apply-fix.sh.
  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    # Derive workflow slug from INCIDENT_ID (CI-YYYY-MM-DD-NNN → no slug) or
    # fall back to FAILURE_CLASS since WORKFLOW_NAME is not passed to apply-fix.
    # The log.sh step (always()) will have already written the red surface;
    # we overwrite with green here to indicate resolution was dispatched.
    # Surface: ci.workflow.auto-fix-<incident_id> to avoid colliding with the
    # classify surface while still being discoverable.
    EW_SURFACE_RESOLVE="ci.workflow.auto-fix-$(echo "${INCIDENT_ID:-unknown}" | tr '[:upper:]' '[:lower:]')"
    EW_RESOLVE_DETAILS=$(jq -n \
      --arg incident_id "${INCIDENT_ID:-}" \
      --arg failure_class "${FAILURE_CLASS}" \
      --arg pr_url "$PR_URL" \
      --arg sha "${HEAD_SHA:-}" \
      '{
        incident_id: $incident_id,
        failure_class: $failure_class,
        pr_url: $pr_url,
        sha: (if $sha == "" then null else $sha end),
        note: "auto-fix PR dispatched"
      }' 2>/dev/null || echo '{}')
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    "${REPO_ROOT}/infra/scripts/engine-world-write.sh" \
      "$EW_SURFACE_RESOLVE" \
      "ci_workflow" \
      "green" \
      "$EW_RESOLVE_DETAILS" \
      7200 \
      "ci-incident-conductor" || true
    log "engine_world: surface=$EW_SURFACE_RESOLVE status=green (Phase 2C resolve)"
  else
    log "engine_world resolve: skipped — SUPABASE_SERVICE_ROLE_KEY not set (Phase 2C)"
  fi
else
  log "No file changes — fix noted in detail only"
  echo "detail=${DETAIL}" >> "$GITHUB_OUTPUT"
fi
