#!/bin/bash
# close-feature.sh v7 — Streamlined feature closure, campaign-aware.
#
# v7: path-aware, campaign sub-sortie support, hardcoded-path bug fixed.
# v6: Closure events written to Second Brain activity-log (ADR-0075).
# v5: Removed fragile WORKLOG/Learning gates.
#
# Closes one of three worktree types, detected from path + branch:
#
# - Sortie:      ~/dev/<repo>-wt-N         on feat/<name>
#                → merge into development, push, remove worktree.
#
# - Sub-sortie:  ~/dev/<repo>-<camp>-wt-N  on feat/<camp>-<name>
#                → merge into campaign/<camp>, sync development → campaign,
#                  push campaign, remove sub-worktree.
#
# - Campaign:    ~/dev/<repo>-<camp>       on campaign/<camp>
#                → BLOCKED. Campaigns are not closed this way.
#
# Gates (applied to feat/ branches only): decision log, JOURNEY file,
# YAML frontmatter on changed docs, typecheck.
#
# Usage:
#   close-feature.sh                  # close the worktree we are CWD in
#   close-feature.sh <wt-number>      # legacy: resolve to ~/dev/<repo>-wt-<N>

set -e

DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)
ERRORS=0
WARNINGS=0

# ─────────────────────────────────────────────────────────────
# Resolve MAIN_REPO from wherever we are called.
# ─────────────────────────────────────────────────────────────
if MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null); then
  COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ -n "$COMMON_DIR" ] && [ -d "$COMMON_DIR" ]; then
    MAIN_REPO=$(cd "$COMMON_DIR/.." && pwd)
  fi
else
  echo "❌ Not inside a git repo."
  exit 1
fi
REPO_NAME=$(basename "$MAIN_REPO")

# ─────────────────────────────────────────────────────────────
# Pick the worktree to close.
# ─────────────────────────────────────────────────────────────
ARG=$1

if [ -n "$ARG" ]; then
  # Legacy invocation: close-feature.sh <wt-number>. Only resolves to a
  # top-level sortie. Campaign subs must be closed from inside.
  CAND1=~/dev/${REPO_NAME}-wt-${ARG}
  CAND2=~/dev/wt-${ARG}
  if [ -d "$CAND1" ]; then
    WT_DIR="$CAND1"
  elif [ -d "$CAND2" ]; then
    WT_DIR="$CAND2"
  else
    echo "❌ No worktree found for wt-${ARG}."
    echo "   Looked at: ${CAND1}, ${CAND2}"
    exit 1
  fi
else
  # Implicit mode: close the worktree we are CWD in.
  WT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
fi

if [ "$WT_DIR" = "$MAIN_REPO" ]; then
  echo "❌ This is the main repo checkout (${MAIN_REPO})."
  echo "   cd into the feature worktree you want to close, or pass <wt-number>."
  exit 1
fi

cd "$WT_DIR"
BRANCH=$(git branch --show-current)
WT_BASENAME=$(basename "$WT_DIR")

# ─────────────────────────────────────────────────────────────
# Detect type from branch.
# ─────────────────────────────────────────────────────────────
if [[ "$BRANCH" =~ ^campaign/(.+)$ ]]; then
  CAMPAIGN_BLOCKED_NAME="${BASH_REMATCH[1]}"
  echo "❌ Campaign branches are not closed via close-feature."
  echo "   Campaign: campaign/${CAMPAIGN_BLOCKED_NAME}"
  echo "   Worktree: ${WT_DIR}"
  echo ""
  echo "   Campaigns are long-lived. To retire one manually (rare):"
  echo "     cd ${MAIN_REPO}"
  echo "     git worktree remove ${WT_DIR}"
  echo "     git branch -D campaign/${CAMPAIGN_BLOCKED_NAME}"
  exit 1
fi

if [[ ! "$BRANCH" =~ ^feat/ ]]; then
  echo "❌ Branch '${BRANCH}' is not a feat/* branch. Nothing to close."
  exit 1
fi

# Is this a sub-sortie of a campaign?
IS_SUB_SORTIE=false
CAMPAIGN_NAME=""
WT_NUMBER=""
CAMPAIGN_DIR=""

if [[ "$WT_BASENAME" =~ ^${REPO_NAME}-(.+)-wt-([0-9]+)$ ]]; then
  CAMPAIGN_CANDIDATE="${BASH_REMATCH[1]}"
  WT_NUMBER="${BASH_REMATCH[2]}"
  CAMPAIGN_DIR=~/dev/${REPO_NAME}-${CAMPAIGN_CANDIDATE}
  # Only treat as sub-sortie if the campaign worktree actually exists.
  if [ -d "$CAMPAIGN_DIR" ]; then
    CAMPAIGN_NAME="$CAMPAIGN_CANDIDATE"
    IS_SUB_SORTIE=true
  else
    # No campaign home — fall back to treating this as a regular sortie
    # even though the name looks campaign-like.
    WT_NUMBER="${BASH_REMATCH[2]}"
  fi
elif [[ "$WT_BASENAME" =~ ^${REPO_NAME}-wt-([0-9]+)$ ]]; then
  WT_NUMBER="${BASH_REMATCH[1]}"
elif [[ "$WT_BASENAME" =~ ^wt-([0-9]+)$ ]]; then
  WT_NUMBER="${BASH_REMATCH[1]}"
fi

# Derive the feature name used for gates and the handoff file.
if $IS_SUB_SORTIE; then
  FEATURE_NAME="${BRANCH#feat/${CAMPAIGN_NAME}-}"
  BASE_BRANCH="campaign/${CAMPAIGN_NAME}"
else
  FEATURE_NAME="${BRANCH#feat/}"
  FEATURE_NAME=${FEATURE_NAME##*/}
  BASE_BRANCH="development"
fi

CONTEXT_LABEL="sortie"
$IS_SUB_SORTIE && CONTEXT_LABEL="sub-sortie of campaign:${CAMPAIGN_NAME}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 CLOSING: ${FEATURE_NAME} (${CONTEXT_LABEL})"
echo "   Branch:    ${BRANCH}"
echo "   Worktree:  ${WT_DIR}"
echo "   Merges to: ${BASE_BRANCH}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================
# GATE 1: Decision log (mandatory)
# =============================================
echo "📋 Gate 1: Decision Log"
DECISION_LOG=$(find docs/decisions -name "0000-decision-log.md" 2>/dev/null | head -1)
if [ -z "$DECISION_LOG" ]; then
  echo "   ❌ Decision log missing (docs/decisions/0000-decision-log.md) — required"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ Decision log exists"
fi
echo ""

# =============================================
# GATE 2: User Journeys (mandatory, status-verified)
# =============================================
# Journey Guardian gate: every JOURNEY-*.md whose frontmatter declares
# `feature: <FEATURE_NAME>` must have `status: verified`. A feature that
# ships zero journeys is blocked — the contract with the user must exist
# before the code can merge.
#
# Legacy fallback: if no journeys carry the feature: field, but a single
# JOURNEY-${FEATURE_NAME}.md file exists, accept it as a verified journey
# to avoid breaking in-flight features.
echo "📋 Gate 2: User Journeys (Journey Guardian)"
JOURNEY_FILES=$(grep -l "^feature: ${FEATURE_NAME}$" docs/journeys/JOURNEY-*.md 2>/dev/null || true)

if [ -z "$JOURNEY_FILES" ]; then
  # Legacy fallback.
  LEGACY_JOURNEY=$(find docs/journeys -name "JOURNEY-${FEATURE_NAME}.md" 2>/dev/null | head -1)
  if [ -n "$LEGACY_JOURNEY" ]; then
    echo "   ⚠️  Legacy journey format (no feature: field): $(basename "$LEGACY_JOURNEY")"
    echo "       Accepted as verified — new journeys should declare feature: + status:."
    WARNINGS=$((WARNINGS + 1))
  else
    echo "   ❌ No journeys declared for feature '${FEATURE_NAME}'."
    echo "       Every feature must ship at least one JOURNEY-*.md with"
    echo "       frontmatter feature: ${FEATURE_NAME} and status: verified."
    ERRORS=$((ERRORS + 1))
  fi
else
  JOURNEY_DRAFT_COUNT=0
  JOURNEY_TOTAL=0
  while IFS= read -r f; do
    JOURNEY_TOTAL=$((JOURNEY_TOTAL + 1))
    STATUS=$(grep -E "^status:" "$f" | head -1 | sed -E 's/^status:\s*//; s/\s+$//')
    if [ "$STATUS" = "verified" ]; then
      echo "   ✅ $(basename "$f") — verified"
    else
      echo "   ❌ $(basename "$f") — status: ${STATUS:-<missing>} (must be verified)"
      JOURNEY_DRAFT_COUNT=$((JOURNEY_DRAFT_COUNT + 1))
    fi
  done <<< "$JOURNEY_FILES"

  if [ "$JOURNEY_DRAFT_COUNT" -gt 0 ]; then
    echo "   ❌ ${JOURNEY_DRAFT_COUNT}/${JOURNEY_TOTAL} journey(s) not verified — required."
    ERRORS=$((ERRORS + 1))
  else
    echo "   ✅ ${JOURNEY_TOTAL} journey(s) verified"
  fi
fi
echo ""

# =============================================
# GATE 3: YAML frontmatter (branch-scoped, warning only)
# =============================================
echo "📋 Gate 3: YAML Frontmatter (scoped to branch changes vs ${BASE_BRANCH})"
DOCS_WITHOUT_FM=0
BRANCH_DOCS=$(git diff "${BASE_BRANCH}..HEAD" --name-only -- 'docs/' 2>/dev/null | grep '\.md$' || true)
if [ -z "$BRANCH_DOCS" ]; then
  echo "   ✅ No docs changed in this branch"
else
  while IFS= read -r f; do
    if [ -f "$f" ] && ! head -1 "$f" | grep -q "^---"; then
      echo "   ⚠️  Missing frontmatter: $f"
      DOCS_WITHOUT_FM=$((DOCS_WITHOUT_FM + 1))
    fi
  done <<< "$BRANCH_DOCS"
  if [ "$DOCS_WITHOUT_FM" -eq 0 ]; then
    echo "   ✅ All changed docs have YAML frontmatter"
  else
    echo "   ⚠️  ${DOCS_WITHOUT_FM} file(s) missing frontmatter"
    WARNINGS=$((WARNINGS + 1))
  fi
fi
echo ""

# =============================================
# GATE 4: Typecheck (mandatory)
# =============================================
echo "🔍 Gate 4: Typecheck"
if pnpm turbo typecheck 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tail -5 | grep -q "successful"; then
  echo "   ✅ Typecheck passed"
else
  echo "   ❌ Typecheck failed — required"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# =============================================
# INFO: Handoff check
# =============================================
echo "📋 Info: Handoff"
HANDOFF=$(find docs -maxdepth 1 -name "HANDOFF-${FEATURE_NAME}.md" 2>/dev/null | head -1)
if [ -z "$HANDOFF" ]; then
  echo "   ⚠️  No handoff file found (docs/HANDOFF-${FEATURE_NAME}.md)"
  echo "   ℹ️  /close-feature should have written one."
  WARNINGS=$((WARNINGS + 1))
else
  echo "   ✅ Handoff exists — travels with the branch at merge"
fi
echo ""

# =============================================
# RESULTS
# =============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ❌ Errors: ${ERRORS}    ⚠️  Warnings: ${WARNINGS}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ BLOCKED. Fix ${ERRORS} error(s) before closing."
  echo ""
  exit 1
fi

echo ""
echo "✅ All required gates passed. Proceeding with merge..."
echo ""

# =============================================
# COMMIT ANY UNCOMMITTED CHANGES
# =============================================
if [ -n "$(git status --porcelain)" ]; then
  echo "📦 Committing remaining changes..."
  git add -A
  git commit -m "$(cat <<EOF
docs(${FEATURE_NAME}): closure deliverables

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
  )"
fi

git push origin "$BRANCH" 2>/dev/null || true

# =============================================
# MERGE
# =============================================
if $IS_SUB_SORTIE; then
  # ─── Sub-sortie path ─────────────────────────────────────
  # Merge feat/<campaign>-<name> → campaign/<campaign>, then sync
  # development into campaign to prevent drift.

  # Campaign worktree must be clean — we're going to move HEAD on its branch.
  if [ -n "$(git -C "$CAMPAIGN_DIR" status --porcelain)" ]; then
    echo "❌ Campaign worktree has uncommitted changes: ${CAMPAIGN_DIR}"
    echo "   Commit or stash them, then re-run close-feature."
    exit 1
  fi

  echo "🔀 Merging ${BRANCH} → campaign/${CAMPAIGN_NAME} (inside ${CAMPAIGN_DIR})..."
  cd "$CAMPAIGN_DIR"
  git pull --ff-only origin "campaign/${CAMPAIGN_NAME}" 2>/dev/null || true
  git merge "$BRANCH" --no-ff -m "feat(merge): ${BRANCH} into campaign/${CAMPAIGN_NAME}"

  echo "🔄 Syncing development → campaign/${CAMPAIGN_NAME}..."
  git fetch origin development 2>/dev/null || true
  if ! git merge origin/development --no-edit -m "sync(${CAMPAIGN_NAME}): development into campaign"; then
    echo ""
    echo "⚠️  Merge conflict syncing development into campaign/${CAMPAIGN_NAME}."
    echo "   Sub-sortie ${BRANCH} IS merged into campaign."
    echo "   Resolve conflicts in ${CAMPAIGN_DIR}, commit, then:"
    echo "     cd ${CAMPAIGN_DIR} && git push origin campaign/${CAMPAIGN_NAME}"
    echo ""
    echo "   NOT cleaning up the sub-sortie worktree — do so manually once synced."
    exit 2
  fi

  echo "🚀 Pushing campaign/${CAMPAIGN_NAME}..."
  git push origin "campaign/${CAMPAIGN_NAME}"
else
  # ─── Classic sortie path ─────────────────────────────────
  # Merge feat/<name> → development.

  echo "🔀 Merging ${BRANCH} → development..."
  cd "$MAIN_REPO"
  CURRENT_MAIN_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  if [ "$CURRENT_MAIN_BRANCH" != "development" ]; then
    if [ -n "$(git status --porcelain)" ]; then
      echo "❌ Main repo is on '${CURRENT_MAIN_BRANCH}' with uncommitted changes."
      echo "   Commit/stash in ${MAIN_REPO}, then re-run."
      exit 1
    fi
    git checkout development
  fi
  git pull --ff-only origin development 2>/dev/null || true
  git merge "$BRANCH" --no-ff -m "feat(merge): ${BRANCH} into development"

  echo "🚀 Pushing development..."
  git push origin development
fi

# =============================================
# SUMMARY
# =============================================
cd "$MAIN_REPO"
FILES_CHANGED=$(git diff --stat HEAD~1 --name-only 2>/dev/null | wc -l)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ FEATURE CLOSED: ${FEATURE_NAME}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Branch:    ${BRANCH} → ${BASE_BRANCH}"
if $IS_SUB_SORTIE; then
  echo "   Campaign:  campaign/${CAMPAIGN_NAME} also synced with development"
fi
echo "   Files:     ~${FILES_CHANGED} changed in last commit"
echo "   Warnings:  ${WARNINGS}"
echo ""

# =============================================
# CLEANUP
# =============================================
# cd to MAIN_REPO before removing the worktree: if the user ran close-feature
# from INSIDE the worktree being removed, our cwd vanishes the instant
# `git worktree remove` runs, and subsequent git commands fail with
# "cannot access parent directories".
echo "🧹 Cleaning up..."
cd "$MAIN_REPO"
git worktree remove "$WT_DIR" 2>/dev/null || echo "   ⚠️  Run manually: git worktree remove ${WT_DIR}"
git branch -d "$BRANCH" 2>/dev/null || echo "   ⚠️  Run manually: git branch -d ${BRANCH}"

# =============================================
# ACTIVITY LOG
# =============================================
if [ -x ~/.claude/scripts/log-activity.sh ]; then
  if $IS_SUB_SORTIE; then
    LOG_MSG="sub-sortie-closed: ${FEATURE_NAME} wt-${WT_NUMBER} merged into campaign/${CAMPAIGN_NAME}; development synced (${BRANCH}, ${FILES_CHANGED} files, ${WARNINGS} warnings)"
  else
    LOG_MSG="feature-closed: ${FEATURE_NAME} wt-${WT_NUMBER} merged to development (${BRANCH}, ${FILES_CHANGED} files, ${WARNINGS} warnings)"
  fi
  if ~/.claude/scripts/log-activity.sh session claude "$LOG_MSG" 2>/dev/null; then
    echo "   ✅ Activity log: closure event written"
  else
    echo "   ⚠️  Activity log WRITE FAILED — audit hole! Investigate vault reachability."
    echo "      Manual repair: ~/.claude/scripts/log-activity.sh session claude \"${LOG_MSG}\""
  fi
else
  echo "   ⚠️  log-activity.sh not executable — closure event LOST"
fi

echo ""
echo "🎉 Done!"
