#!/bin/bash
# promote-preview.sh — Fast-forward preview to development, gated.
#
# Only Pontus should run this. The script is an orchestrator, not a gate:
# - GitHub Actions on development must be green (checked via gh).
# - Local development must be in sync with origin/development.
# - preview is fast-forwarded to development (no merge commits).
# - Push is then delegated to husky pre-push, which re-runs lint+typecheck
#   and verifies preview's new HEAD is an ancestor of origin/development.
#
# The script NEVER touches main. Promotion preview → main goes via PR only.
#
# Usage: promote-preview.sh

set -e

# Resolve main repo from any worktree.
if ! MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "❌ Not inside a git repo."
  exit 1
fi
COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
if [ -n "$COMMON_DIR" ] && [ -d "$COMMON_DIR" ]; then
  MAIN_REPO=$(cd "$COMMON_DIR/.." && pwd)
fi
REPO_NAME=$(basename "$MAIN_REPO")

# gh is required for CI verification. Refuse to promote without it —
# "assume green" is exactly the failure mode this gate exists to prevent.
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not found. Install it — promotion requires verifying CI."
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh is not authenticated. Run: gh auth login"
  exit 1
fi

# jq is required for parsing both gh and Vercel API responses.
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq not found. Install with: sudo apt install jq"
  exit 1
fi

# Vercel gate requires VERCEL_TOKEN. Read it from env — if you use 1Password,
# invoke this script via: op run --env-file=.env.template -- promote-preview.sh
if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ VERCEL_TOKEN env var not set. Vercel deploy status cannot be verified."
  echo "   Run via 1Password:"
  echo "     op run --env-file=${MAIN_REPO:-.}/.env.template -- ~/.claude/scripts/promote-preview.sh"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 PROMOTE: development → preview"
echo "   Repo: ${REPO_NAME} (${MAIN_REPO})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$MAIN_REPO"

# Main repo must be clean — we will switch branches.
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Main repo has uncommitted changes. Commit/stash first."
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Gate 1: local development in sync with origin/development
# ─────────────────────────────────────────────────────────────
echo "📋 Gate 1: local development in sync with origin"
git fetch origin 2>/dev/null

# Ensure the development branch exists locally.
if ! git show-ref --verify --quiet refs/heads/development; then
  git branch --track development origin/development
fi

LOCAL_DEV=$(git rev-parse development)
REMOTE_DEV=$(git rev-parse origin/development)

if [ "$LOCAL_DEV" != "$REMOTE_DEV" ]; then
  # If local is behind, fast-forward. If local is ahead or diverged, bail.
  if git merge-base --is-ancestor development origin/development; then
    echo "   local development behind origin — fast-forwarding..."
    git checkout development
    git merge --ff-only origin/development
    LOCAL_DEV=$(git rev-parse development)
  else
    echo "   ❌ local development has diverged from origin/development."
    echo "      Local: ${LOCAL_DEV}"
    echo "      Origin: ${REMOTE_DEV}"
    echo "      Resolve locally before promoting."
    exit 1
  fi
fi
echo "   ✅ development at ${LOCAL_DEV:0:8}"
echo ""

# ─────────────────────────────────────────────────────────────
# Gate 2: GitHub Actions on development must be green
# ─────────────────────────────────────────────────────────────
echo "📋 Gate 2: GitHub Actions on development"
DEV_SHA=$(git rev-parse development)

# Ask GH for the most recent runs on this SHA.
RUNS_JSON=$(gh run list --branch development --commit "$DEV_SHA" --json status,conclusion,name,workflowName --limit 20 2>/dev/null || echo "[]")

if [ "$RUNS_JSON" = "[]" ] || [ -z "$RUNS_JSON" ]; then
  echo "   ❌ No GitHub Actions runs found for development@${DEV_SHA:0:8}."
  echo "      Wait for CI to start, or verify CI is configured for this branch."
  exit 1
fi

# Check that every run is completed + success.
FAILED=$(printf '%s' "$RUNS_JSON" | python3 -c '
import json, sys
runs = json.load(sys.stdin)
bad = [r for r in runs if r.get("status") != "completed" or r.get("conclusion") != "success"]
for r in bad:
    print(f"{r.get(\"workflowName\",\"?\")}: status={r.get(\"status\")} conclusion={r.get(\"conclusion\")}")
sys.exit(1 if bad else 0)
' 2>&1) || {
  echo "   ❌ Some GitHub Actions runs are not green:"
  printf '%s\n' "$FAILED" | sed 's/^/      /'
  echo ""
  echo "      Wait for green, or fix what is red, then re-run promote-preview."
  exit 1
}
RUN_COUNT=$(printf '%s' "$RUNS_JSON" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')
echo "   ✅ ${RUN_COUNT} run(s) green on development@${DEV_SHA:0:8}"
echo ""

# ─────────────────────────────────────────────────────────────
# Gate 3: every linked Vercel project has a READY deploy on development@DEV_SHA
# ─────────────────────────────────────────────────────────────
# Vercel auto-deploys on push via the GitHub integration. Before FFing
# preview we verify that every linked project's deploy of the exact
# commit we're about to promote is in state READY. Any other state —
# BUILDING, QUEUED, CANCELED, ERROR — blocks.
echo "📋 Gate 3: Vercel deploys on development"

VERCEL_PROJECT_FILES=$(find "$MAIN_REPO/apps" -maxdepth 3 -name "project.json" -path "*/.vercel/*" 2>/dev/null)

if [ -z "$VERCEL_PROJECT_FILES" ]; then
  echo "   ⚠️  No linked Vercel projects found under ${MAIN_REPO}/apps/*/.vercel/ — skipping Vercel gate"
else
  VERCEL_GATE_FAILED=0
  while IFS= read -r project_json; do
    APP_DIR=$(dirname "$(dirname "$project_json")")
    APP_NAME=$(basename "$APP_DIR")
    PROJECT_ID=$(jq -r '.projectId' "$project_json")
    ORG_ID=$(jq -r '.orgId' "$project_json")

    if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
      echo "   ⚠️  ${APP_NAME}: could not read projectId from ${project_json}"
      VERCEL_GATE_FAILED=$((VERCEL_GATE_FAILED + 1))
      continue
    fi

    # Find the deployment for the exact SHA we are promoting.
    # API: GET /v6/deployments?projectId=...&teamId=...&meta-githubCommitSha=<sha>
    API_RESP=$(curl -s -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v6/deployments?teamId=${ORG_ID}&projectId=${PROJECT_ID}&limit=20" \
      2>/dev/null)

    if [ -z "$API_RESP" ] || ! printf '%s' "$API_RESP" | jq -e '.deployments' >/dev/null 2>&1; then
      ERR_MSG=$(printf '%s' "$API_RESP" | jq -r '.error.message // "unknown error"' 2>/dev/null)
      echo "   ❌ ${APP_NAME}: Vercel API error — ${ERR_MSG}"
      VERCEL_GATE_FAILED=$((VERCEL_GATE_FAILED + 1))
      continue
    fi

    # Find deployment matching DEV_SHA (long form; API returns full sha).
    DEPLOY_INFO=$(printf '%s' "$API_RESP" | jq -r --arg sha "$DEV_SHA" \
      '.deployments[] | select(.meta.githubCommitSha == $sha) | "\(.state)|\(.url)"' | head -1)

    if [ -z "$DEPLOY_INFO" ]; then
      echo "   ❌ ${APP_NAME}: no Vercel deploy found for development@${DEV_SHA:0:8}"
      echo "        (Vercel may not have picked up the commit yet — wait and retry.)"
      VERCEL_GATE_FAILED=$((VERCEL_GATE_FAILED + 1))
      continue
    fi

    STATE=$(printf '%s' "$DEPLOY_INFO" | cut -d'|' -f1)
    URL=$(printf '%s' "$DEPLOY_INFO" | cut -d'|' -f2)

    if [ "$STATE" = "READY" ]; then
      echo "   ✅ ${APP_NAME}: READY (${URL})"
    else
      echo "   ❌ ${APP_NAME}: state=${STATE} (${URL}) — must be READY"
      VERCEL_GATE_FAILED=$((VERCEL_GATE_FAILED + 1))
    fi
  done <<< "$VERCEL_PROJECT_FILES"

  if [ "$VERCEL_GATE_FAILED" -gt 0 ]; then
    echo ""
    echo "   ${VERCEL_GATE_FAILED} Vercel project(s) not READY on development@${DEV_SHA:0:8}."
    echo "   Wait for READY or fix the failing deploy, then re-run promote-preview."
    exit 1
  fi
fi
echo ""

# ─────────────────────────────────────────────────────────────
# Gate 4: preview must be an ancestor (or equal) to development
# ─────────────────────────────────────────────────────────────
echo "📋 Gate 4: preview is behind or equal to development"

# Ensure preview exists locally.
if ! git show-ref --verify --quiet refs/heads/preview; then
  git branch --track preview origin/preview 2>/dev/null || {
    echo "   ❌ Could not track origin/preview. Does the branch exist?"
    exit 1
  }
fi
git fetch origin preview 2>/dev/null || true
git update-ref refs/heads/preview "$(git rev-parse origin/preview)"

PREVIEW_SHA=$(git rev-parse preview)

if [ "$PREVIEW_SHA" = "$DEV_SHA" ]; then
  echo "   ✅ preview already at ${DEV_SHA:0:8} — nothing to promote."
  exit 0
fi

if ! git merge-base --is-ancestor preview development; then
  echo "   ❌ preview (${PREVIEW_SHA:0:8}) is NOT an ancestor of development (${DEV_SHA:0:8})."
  echo "      Preview has diverged — cannot fast-forward. Investigate before promoting."
  exit 1
fi
BEHIND=$(git rev-list --count preview..development)
echo "   ✅ preview is ${BEHIND} commit(s) behind development — FF possible"
echo ""

# ─────────────────────────────────────────────────────────────
# Fast-forward preview to development, push.
# ─────────────────────────────────────────────────────────────
echo "🔀 Fast-forwarding preview to development..."
git checkout preview
git merge --ff-only development

echo "🚀 Pushing preview (husky pre-push will re-verify)..."
# Husky pre-push enforces: (a) commit is descendant of origin/development,
# (b) lint passes, (c) typecheck passes. Failing any of these aborts here.
git push origin preview

# Return to development to leave the main repo in a predictable state.
git checkout development

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PROMOTED: preview → ${DEV_SHA:0:8}"
echo "   ${BEHIND} commit(s) delivered from development."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: validate preview deploy, then open PR preview → main."

# Activity log.
if [ -x ~/.claude/scripts/log-activity.sh ]; then
  ~/.claude/scripts/log-activity.sh git pontus \
    "promote-preview: development@${DEV_SHA:0:8} → preview (${BEHIND} commits)" \
    2>/dev/null && echo "   Activity log: promote-preview event written"
fi
