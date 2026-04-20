#!/bin/bash
# new-feature.sh — Create a feature worktree (sortie).
#
# Two modes, chosen by the current git context:
#
# 1. Sortie from main (default): called from the main repo checkout or any
#    worktree whose branch is NOT campaign/*. Creates:
#      ~/dev/<repo>-wt-<N>/  with branch feat/<name>, based on development.
#
# 2. Sub-sortie from a campaign: called from a worktree whose branch is
#    campaign/<campaign-name>. Creates:
#      ~/dev/<repo>-<campaign>-wt-<N>/  with branch feat/<campaign>-<name>,
#      based on campaign/<campaign-name>.
#
# Usage: new-feature.sh <feature-name> <wt-number> [module-name]

set -e
FEATURE_NAME=$1
WT_NUMBER=$2
MODULE_NAME=${3:-"unspecified"}

if [ -z "$FEATURE_NAME" ] || [ -z "$WT_NUMBER" ]; then
  echo "Usage: new-feature.sh <feature-name> <wt-number> [module-name]"
  exit 1
fi

# ── Detect campaign context from current branch ───────────────
# If the invocation happens inside a campaign worktree, we spawn a
# sub-sortie that is based on and named after that campaign.
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$CURRENT_BRANCH" =~ ^campaign/(.+)$ ]]; then
  CAMPAIGN_NAME="${BASH_REMATCH[1]}"
  IS_SUB_SORTIE=true
else
  CAMPAIGN_NAME=""
  IS_SUB_SORTIE=false
fi

# ── Resolve the main repo regardless of current worktree ──────
if MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null); then
  COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ -n "$COMMON_DIR" ] && [ -d "$COMMON_DIR" ]; then
    MAIN_REPO=$(cd "$COMMON_DIR/.." && pwd)
  fi
else
  MAIN_REPO=~/dev/smartout.ai
fi
REPO_NAME=$(basename "$MAIN_REPO")

# ── Compute worktree path and branch based on context ─────────
if $IS_SUB_SORTIE; then
  WT_DIR=~/dev/${REPO_NAME}-${CAMPAIGN_NAME}-wt-${WT_NUMBER}
  BRANCH="feat/${CAMPAIGN_NAME}-${FEATURE_NAME}"
  BASE_BRANCH="campaign/${CAMPAIGN_NAME}"
  CONTEXT_LABEL="sub-sortie of campaign:${CAMPAIGN_NAME}"
else
  WT_DIR=~/dev/${REPO_NAME}-wt-${WT_NUMBER}
  BRANCH="feat/${FEATURE_NAME}"
  BASE_BRANCH="development"
  CONTEXT_LABEL="sortie"
fi

DATE=$(date +%Y-%m-%d)

if [ -d "$WT_DIR" ]; then
  echo "❌ Worktree already exists: ${WT_DIR}"
  echo "   Close it first, or pick a different wt-number."
  exit 1
fi

echo "Setting up: ${FEATURE_NAME} (${CONTEXT_LABEL})"
echo "   Branch:   ${BRANCH} (based on ${BASE_BRANCH})"
echo "   Worktree: ${WT_DIR}"
echo ""

cd "$MAIN_REPO"

# Fetch to ensure we branch from the freshest ref we have locally.
# Do NOT checkout the base branch — that would change MAIN_REPO's HEAD and
# surprise other sessions. Use `git branch <new> <base>` to create without
# touching the current HEAD.
git fetch origin 2>/dev/null || true

# For sortie: keep the historic behaviour of pulling development into
# MAIN_REPO so the main checkout stays fresh. This matters because many
# operators work directly in MAIN_REPO on development.
if ! $IS_SUB_SORTIE; then
  CURRENT_MAIN_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  if [ "$CURRENT_MAIN_BRANCH" = "development" ]; then
    git pull --ff-only origin development 2>/dev/null || true
  fi
fi

# Create the new branch from the base, without switching MAIN_REPO's HEAD.
git branch "$BRANCH" "$BASE_BRANCH" 2>/dev/null || echo "   Branch exists, reusing."
git worktree add "$WT_DIR" "$BRANCH"

# Copy env files (project standard — no .env.local committed).
if [ -f "${MAIN_REPO}/.env.template" ]; then
  cp "${MAIN_REPO}/.env.template" "${WT_DIR}/.env.template" 2>/dev/null || true
  echo "   .env.template copied (use: op run --env-file=.env.template)"
fi
cp "${MAIN_REPO}/.env.local" "${WT_DIR}/.env.local" 2>/dev/null || true

mkdir -p "${WT_DIR}/docs/decisions" "${WT_DIR}/docs/plans" "${WT_DIR}/docs/journeys"

# ── Look for existing spec/plan in the main repo ──────────────
EXISTING_SPEC=""
EXISTING_PLAN=""
for f in "${MAIN_REPO}"/docs/superpowers/specs/*"${FEATURE_NAME}"*.md; do
  [ -f "$f" ] && EXISTING_SPEC="$f" && break
done
for f in "${MAIN_REPO}"/docs/superpowers/plans/*"${FEATURE_NAME}"*.md; do
  [ -f "$f" ] && EXISTING_PLAN="$f" && break
done

SPEC_REF=""
PLAN_REF=""
if [ -n "$EXISTING_SPEC" ]; then
  SPEC_BASENAME=$(basename "$EXISTING_SPEC")
  SPEC_REF="**Spec:** [${SPEC_BASENAME}](../../superpowers/specs/${SPEC_BASENAME})"
  echo "   Found existing spec: ${SPEC_BASENAME}"
fi
if [ -n "$EXISTING_PLAN" ]; then
  PLAN_BASENAME=$(basename "$EXISTING_PLAN")
  PLAN_REF="**Implementation plan:** [${PLAN_BASENAME}](../../superpowers/plans/${PLAN_BASENAME})"
  echo "   Found existing plan: ${PLAN_BASENAME}"
fi

# Plan filename uses the raw feature name; branch name has campaign prefix.
cat > "${WT_DIR}/docs/plans/PLAN-${FEATURE_NAME}.md" << EOF
---
title: "Plan — ${FEATURE_NAME}"
status: draft
updated: ${DATE}
created: ${DATE}
module: ${MODULE_NAME}
tags: [plan]
---

# Plan — ${FEATURE_NAME}

> Branch: \`${BRANCH}\` | Worktree: ${WT_DIR} | Base: \`${BASE_BRANCH}\` | Module: ${MODULE_NAME} | Started: ${DATE}

${SPEC_REF}
${PLAN_REF}

## Goal

<!-- What does this feature accomplish? One sentence. -->

## Tasks

<!-- Use superpowers:subagent-driven-development or superpowers:executing-plans to implement. -->

- [ ] Task 1

## Acceptance Criteria

- [ ] Typecheck passes: \`pnpm turbo typecheck\`
- [ ] Decision log updated
- [ ] User journeys written
EOF

# Remove blank lines from missing refs
sed -i '/^$/N;/^\n$/d' "${WT_DIR}/docs/plans/PLAN-${FEATURE_NAME}.md"

# Decision log is inherited from the base branch via git worktree add. Never
# overwrite — that would wipe ADRs that exist on development/campaign. Only
# create a template if the file genuinely does not exist.
if [ ! -f "${WT_DIR}/docs/decisions/0000-decision-log.md" ]; then
  cat > "${WT_DIR}/docs/decisions/0000-decision-log.md" << EOF
---
title: Decision Log
status: in_progress
updated: ${DATE}
created: ${DATE}
module: ${MODULE_NAME}
tags: [decisions]
---

# Decision Log

| # | Date | Decision | Status |
|---|------|----------|--------|
EOF
  echo "   Created new decision log (none existed)"
else
  echo "   Decision log inherited from ${BASE_BRANCH} — not overwritten"
fi

echo ""
echo "✅ Ready!"
echo "   ${WT_DIR} -> ${BRANCH}"
echo "   Repo: ${REPO_NAME}"

# ── Log feature-start to activity-log (ADR-0075) ──────────────
if [ -x ~/.claude/scripts/log-activity.sh ]; then
  if $IS_SUB_SORTIE; then
    LOG_MSG="sub-sortie-start: ${FEATURE_NAME} in campaign:${CAMPAIGN_NAME} wt-${WT_NUMBER} (branch: ${BRANCH}, module: ${MODULE_NAME})"
  else
    LOG_MSG="feature-start: ${FEATURE_NAME} wt-${WT_NUMBER} (branch: ${BRANCH}, module: ${MODULE_NAME})"
  fi
  if ~/.claude/scripts/log-activity.sh session claude "$LOG_MSG" 2>/dev/null; then
    echo "   Activity log: start event written"
  else
    echo "   Warning: activity-log write failed (vault unreachable?) — start event lost"
  fi
fi

# Terminal and tmux titles
if $IS_SUB_SORTIE; then
  TITLE="${CAMPAIGN_NAME}-wt-${WT_NUMBER}:${FEATURE_NAME}"
  TMUX_SESSION_NAME="${REPO_NAME}-${CAMPAIGN_NAME}-${WT_NUMBER}"
else
  TITLE="wt-${WT_NUMBER}:${FEATURE_NAME}"
  TMUX_SESSION_NAME="${REPO_NAME}-${WT_NUMBER}"
fi

printf '\033]0;%s\007' "${TITLE}"
if [ -n "$TMUX" ]; then
  tmux rename-window "${TITLE}"
fi

echo ""
echo "   Start: tmux new -s ${TMUX_SESSION_NAME} -n \"${TITLE}\" -c ${WT_DIR}"
