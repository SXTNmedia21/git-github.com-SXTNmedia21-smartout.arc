#!/usr/bin/env bash
# ============================================
# promote-preview.sh — Repo-canonical promote-preview wrapper (ADR-0265)
#
# Wraps ~/.claude/scripts/promote-preview.sh (the 4-gate FF executor) and
# adds the post-promote enforcement layer:
#
#   - Gate 5: smoke-probe.sh preview must come back green
#   - Gate 6: tag the preview SHA as lkg-preview-<sha> and push the tag
#
# Why a wrapper instead of editing the global script:
# the global script is shared across projects, while these post-promote
# steps are Smartout-specific (smoke surfaces, tag convention). Living in
# the repo means every change is reviewed, version-controlled, and visible
# to the team via git blame.
#
# Usage:
#   op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$INFRA_DIR")"
GLOBAL_PROMOTE="${HOME}/.claude/scripts/promote-preview.sh"
EW_WRITE="${SCRIPT_DIR}/engine-world-write.sh"

# ── engine_world write helper (fire-and-forget) ──────────────────────────────
# All calls use || true — engine_world writes NEVER block the pipeline.
ew_write() {
  if [ -x "$EW_WRITE" ]; then
    "$EW_WRITE" "$@" || true
  fi
}

if [ ! -x "$GLOBAL_PROMOTE" ]; then
  echo "❌ Global promote-preview not found at $GLOBAL_PROMOTE" >&2
  echo "   This wrapper expects the foundational 4-gate executor to exist." >&2
  exit 1
fi

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "❌ VERCEL_TOKEN not set. Run via:" >&2
  echo "   op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh" >&2
  exit 1
fi

# ── Stage 1: foundational 4-gate FF promote ─────────────────────
echo "▶ Stage 1/3: foundational gates (sync, CI, Vercel READY, FF-possible)"
"$GLOBAL_PROMOTE"

# Capture the SHA we promoted to. After Stage 1, preview = development.
cd "$REPO_ROOT"
git fetch origin preview --quiet 2>/dev/null || true
PREVIEW_SHA=$(git rev-parse origin/preview)
PREVIEW_SHORT="${PREVIEW_SHA:0:8}"

echo ""
echo "▶ Stage 2/3: smoke probe on preview"
if "$INFRA_DIR/scripts/smoke-probe.sh" preview; then
  echo "   ✅ smoke green"
else
  echo "   ❌ smoke RED — preview deploy is broken at $PREVIEW_SHORT"
  echo "   Promote completed but smoke failed. Investigate before promoting to main."
  if [ -x ~/.claude/scripts/log-activity.sh ]; then
    ~/.claude/scripts/log-activity.sh git pontus \
      "promote-preview: SMOKE RED at preview@${PREVIEW_SHORT}" 2>/dev/null || true
  fi
  # engine_world: record lkg as red — smoke failed after FF, no LKG tag issued
  _FAIL_DETAILS=$(python3 -c "
import json, sys
print(json.dumps({'preview_sha': sys.argv[1], 'failed_gate': 'smoke', 'reason': 'smoke-probe preview returned non-zero'}))" \
    "$PREVIEW_SHA" 2>/dev/null || echo '{"failed_gate":"smoke"}')
  ew_write "deploy.preview.lkg" "service" "red" "$_FAIL_DETAILS" 7200 "deploy-conductor"
  exit 1
fi

# ── Stage 3: tag last-known-good ────────────────────────────────
echo ""
echo "▶ Stage 3/3: tag last-known-good"
LKG_TAG="lkg-preview-${PREVIEW_SHORT}"

if git rev-parse "$LKG_TAG" >/dev/null 2>&1; then
  echo "   ⚠️  tag $LKG_TAG already exists — skipping"
else
  git tag "$LKG_TAG" "$PREVIEW_SHA"
  if git push origin "$LKG_TAG"; then
    echo "   ✅ tagged $LKG_TAG"
  else
    echo "   ⚠️  tag created locally but push failed — push manually:"
    echo "      git push origin $LKG_TAG"
  fi
fi

if [ -x ~/.claude/scripts/log-activity.sh ]; then
  ~/.claude/scripts/log-activity.sh git pontus \
    "promote-preview: ${LKG_TAG} smoke green, ready for preview→main PR" \
    >/dev/null 2>&1 || true
fi

# engine_world: record deploy.preview.lkg green — HOP A complete, smoke passed, tag pushed
_LKG_DETAILS=$(python3 -c "
import json, sys
print(json.dumps({'lkg_tag': sys.argv[1], 'preview_sha': sys.argv[2], 'ts': __import__('datetime').datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}))" \
  "$LKG_TAG" "$PREVIEW_SHA" 2>/dev/null || echo "{}")
ew_write "deploy.preview.lkg" "service" "green" "$_LKG_DETAILS" 7200 "deploy-conductor"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ENFORCED PROMOTE COMPLETE"
echo "   preview@${PREVIEW_SHORT}"
echo "   smoke: green"
echo "   rollback target: ${LKG_TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next: open release PR with the preview-to-main template:"
echo "   gh pr create --base main --head preview --template preview-to-main.md"
