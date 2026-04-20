#!/bin/bash
# new-campaign.sh — Create a long-lived campaign worktree.
#
# Campaigns are persistent worktrees for ongoing development streams
# (e.g. Botsson Arena, Schedule). They are NOT part of the sortie pool
# (wt-N) and are not closed via /close-feature. Feature branches can be
# spawned inside a campaign with /start-feature (path-aware).
#
# Structure:
#   ~/dev/<repo>-<campaign>/          campaign worktree (this script creates)
#   ~/dev/<repo>-<campaign>-wt-N/     sub-sortie (created by new-feature.sh)
#
# Campaign branch: campaign/<name> (from development)
# Sub-sortie branch: feat/<campaign>-<sortie-name>
#
# Usage: new-campaign.sh <campaign-name> [module-name]

set -e

CAMPAIGN_NAME=$1
MODULE_NAME=${2:-"unspecified"}

if [ -z "$CAMPAIGN_NAME" ]; then
  echo "Usage: new-campaign.sh <campaign-name> [module-name]"
  exit 1
fi

# Reject names that collide with the sortie pool naming.
if [[ "$CAMPAIGN_NAME" =~ ^wt- ]]; then
  echo "❌ Campaign name cannot start with 'wt-' (reserved for sortie pool)."
  exit 1
fi

# Reject names with characters that would break filesystem or branch naming.
if [[ ! "$CAMPAIGN_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "❌ Campaign name must be lowercase kebab-case (a-z, 0-9, -)."
  echo "   Got: ${CAMPAIGN_NAME}"
  exit 1
fi

# Repo-aware: resolve main repo from current git context.
if MAIN_REPO=$(git rev-parse --show-toplevel 2>/dev/null); then
  COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ -n "$COMMON_DIR" ] && [ -d "$COMMON_DIR" ]; then
    MAIN_REPO=$(cd "$COMMON_DIR/.." && pwd)
  fi
else
  MAIN_REPO=~/dev/smartout.ai
fi
REPO_NAME=$(basename "$MAIN_REPO")

# Refuse to create a campaign from inside another campaign worktree.
# Campaigns are peers, not nested.
if [[ "$REPO_NAME" != "$(basename "$MAIN_REPO")" ]] || [[ "$MAIN_REPO" =~ -wt-[0-9]+$ ]]; then
  echo "❌ Run /start-campaign from the main repo checkout, not a worktree."
  exit 1
fi

CAMPAIGN_DIR=~/dev/${REPO_NAME}-${CAMPAIGN_NAME}
BRANCH="campaign/${CAMPAIGN_NAME}"
DATE=$(date +%Y-%m-%d)

if [ -d "$CAMPAIGN_DIR" ]; then
  echo "❌ Campaign worktree already exists: ${CAMPAIGN_DIR}"
  echo "   To open it: cd ${CAMPAIGN_DIR}"
  echo "   To remove it: git worktree remove ${CAMPAIGN_DIR} && git branch -D ${BRANCH}"
  exit 1
fi

echo "Setting up campaign: ${CAMPAIGN_NAME}"
echo "   Branch:   ${BRANCH}"
echo "   Worktree: ${CAMPAIGN_DIR}"
echo "   Repo:     ${REPO_NAME}"
echo ""

cd "$MAIN_REPO"
git checkout development
git pull origin development 2>/dev/null || true
git branch "$BRANCH" 2>/dev/null || echo "   Branch exists, reusing."
git worktree add "$CAMPAIGN_DIR" "$BRANCH"

# Copy env files (project standard — no .env.local)
if [ -f "${MAIN_REPO}/.env.template" ]; then
  cp "${MAIN_REPO}/.env.template" "${CAMPAIGN_DIR}/.env.template" 2>/dev/null || true
  echo "   .env.template copied (use: op run --env-file=.env.template)"
fi
cp "${MAIN_REPO}/.env.local" "${CAMPAIGN_DIR}/.env.local" 2>/dev/null || true

mkdir -p "${CAMPAIGN_DIR}/docs/decisions" "${CAMPAIGN_DIR}/docs/plans" "${CAMPAIGN_DIR}/docs/journeys"

# Campaign plan — different from feature plan. This is a roadmap, not a single task.
cat > "${CAMPAIGN_DIR}/docs/plans/CAMPAIGN-${CAMPAIGN_NAME}.md" << EOF
---
title: "Campaign — ${CAMPAIGN_NAME}"
status: active
updated: ${DATE}
created: ${DATE}
module: ${MODULE_NAME}
tags: [campaign, roadmap]
---

# Campaign — ${CAMPAIGN_NAME}

> Branch: \`${BRANCH}\` | Worktree: ${CAMPAIGN_DIR} | Module: ${MODULE_NAME} | Started: ${DATE}

## Vision

<!-- What is this campaign trying to accomplish? One paragraph. -->

## Scope

<!-- What is in scope. What is explicitly out of scope. -->

## Milestones

- [ ] Milestone 1 — describe

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See \`docs/decisions/0000-decision-log.md\` (inherited from development at campaign start).
All campaign-specific decisions registered here.

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
EOF

# Decision log: inherit from development (same pattern as new-feature.sh).
# Only create a fresh one if none exists.
if [ ! -f "${CAMPAIGN_DIR}/docs/decisions/0000-decision-log.md" ]; then
  cat > "${CAMPAIGN_DIR}/docs/decisions/0000-decision-log.md" << EOF
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
  echo "   Decision log inherited from development — not overwritten"
fi

# Commit the scaffolded plan on the campaign branch so close-feature on a
# sub-sortie does not fail on an uncommitted CAMPAIGN-<name>.md. Decision
# log is only committed if it was newly created in this run (else it is
# already part of development's history via inheritance).
(
  cd "$CAMPAIGN_DIR"
  git add "docs/plans/CAMPAIGN-${CAMPAIGN_NAME}.md" "docs/decisions/0000-decision-log.md" 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "$(cat <<EOF
docs(campaign): scaffold ${CAMPAIGN_NAME} roadmap

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)" >/dev/null 2>&1 && echo "   Scaffolding committed on ${BRANCH}"
  fi
)

echo ""
echo "✅ Campaign ready!"
echo "   ${CAMPAIGN_DIR} -> ${BRANCH}"

# Log campaign-start to activity-log.
if [ -x ~/.claude/scripts/log-activity.sh ]; then
  if ~/.claude/scripts/log-activity.sh session claude \
       "campaign-start: ${CAMPAIGN_NAME} (branch: ${BRANCH}, module: ${MODULE_NAME})" \
       2>/dev/null; then
    echo "   Activity log: campaign-start event written"
  else
    echo "   Warning: activity-log write failed (vault unreachable?) — campaign-start event lost"
  fi
fi

# Set terminal title
printf '\033]0;camp:%s\007' "${CAMPAIGN_NAME}"

# If inside tmux, rename the current window
if [ -n "$TMUX" ]; then
  tmux rename-window "camp:${CAMPAIGN_NAME}"
fi

echo ""
echo "   Start: tmux new -s ${REPO_NAME}-${CAMPAIGN_NAME} -n \"camp:${CAMPAIGN_NAME}\" -c ${CAMPAIGN_DIR}"
echo ""
echo "   Within this worktree:"
echo "     /start-feature <name>  → creates sub-sortie with branch feat/${CAMPAIGN_NAME}-<name>"
echo "     /sync-campaign         → merge latest development into campaign"
echo "     /close-feature         → BLOCKED at campaign root (campaigns don't close)"
