#!/bin/bash
# sync-campaign.sh — Merge the latest development into the current campaign.
#
# Run from inside a campaign worktree (branch campaign/<name>). The script
# fetches origin, merges origin/development into the campaign branch, pushes,
# and appends a sync entry to the campaign plan's Sync Log.
#
# This is the manual counterpart to the auto-sync that runs at the end of
# /close-feature from a sub-sortie. Use it to refresh a campaign when no
# sub-sortie is closing right now (e.g. when you come back after development
# has moved ahead).
#
# Usage: sync-campaign.sh

set -e

# Resolve repo + worktree context.
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "❌ Not inside a git repo."
  exit 1
fi
WT_DIR=$(git rev-parse --show-toplevel)
BRANCH=$(git branch --show-current)

if [[ ! "$BRANCH" =~ ^campaign/(.+)$ ]]; then
  echo "❌ sync-campaign must run from a campaign worktree."
  echo "   Current branch: ${BRANCH}"
  echo "   Current path:   ${WT_DIR}"
  exit 1
fi
CAMPAIGN_NAME="${BASH_REMATCH[1]}"

# Worktree must be clean — we're going to merge onto this branch.
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Campaign worktree has uncommitted changes."
  echo "   Commit or stash them before syncing."
  exit 1
fi

echo "🔄 Syncing campaign/${CAMPAIGN_NAME} with development..."
echo "   Worktree: ${WT_DIR}"
echo ""

# Pull anything already on origin for the campaign branch.
git fetch origin 2>/dev/null || {
  echo "❌ git fetch failed (network?)."
  exit 1
}
git pull --ff-only origin "campaign/${CAMPAIGN_NAME}" 2>/dev/null || true

# How far behind are we before merging?
BEHIND=$(git rev-list --count "HEAD..origin/development" 2>/dev/null || echo 0)
AHEAD=$(git rev-list --count "origin/development..HEAD" 2>/dev/null || echo 0)

if [ "$BEHIND" = "0" ]; then
  echo "✅ Already up to date with development (0 commits behind)."
  if [ "$AHEAD" -gt "0" ]; then
    echo "   Campaign is ${AHEAD} commit(s) ahead of development."
  fi
  exit 0
fi

echo "   development is ${BEHIND} commit(s) ahead of campaign."
echo "   Merging origin/development → campaign/${CAMPAIGN_NAME}..."
echo ""

DEV_HEAD=$(git rev-parse --short origin/development)

if ! git merge origin/development --no-edit -m "sync(${CAMPAIGN_NAME}): development into campaign"; then
  echo ""
  echo "⚠️  Merge conflict. Resolve in ${WT_DIR}, commit, then push manually:"
  echo "     git push origin campaign/${CAMPAIGN_NAME}"
  exit 2
fi

MERGE_HEAD=$(git rev-parse --short HEAD)

echo "🚀 Pushing campaign/${CAMPAIGN_NAME}..."
git push origin "campaign/${CAMPAIGN_NAME}"

# Append to Sync Log in the campaign plan, if the file exists.
PLAN_FILE="docs/plans/CAMPAIGN-${CAMPAIGN_NAME}.md"
if [ -f "$PLAN_FILE" ]; then
  DATE=$(date +%Y-%m-%d)
  SYNC_ROW="| ${DATE} | ${DEV_HEAD} | ${MERGE_HEAD} |"
  # Append after the Sync Log table header if present. Falls back to file end.
  if grep -q "^## Sync Log" "$PLAN_FILE"; then
    # Append at end of file — simpler and always works.
    printf '%s\n' "$SYNC_ROW" >> "$PLAN_FILE"
    echo "   Sync Log updated: ${PLAN_FILE}"
  fi
fi

echo ""
echo "✅ Campaign synced."
echo "   Merged ${BEHIND} commit(s) from development into campaign/${CAMPAIGN_NAME}."

# Activity log.
if [ -x ~/.claude/scripts/log-activity.sh ]; then
  if ~/.claude/scripts/log-activity.sh session claude \
       "campaign-sync: campaign/${CAMPAIGN_NAME} merged origin/development (${DEV_HEAD} → ${MERGE_HEAD}, ${BEHIND} commits)" \
       2>/dev/null; then
    echo "   Activity log: campaign-sync event written"
  fi
fi
