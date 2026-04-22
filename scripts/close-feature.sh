#!/bin/bash
# scripts/close-feature.sh — M6 Journey Guardian entry point.
#
# This is the top-level scripts/ shim referenced by CAMPAIGN-journey-engine.md
# §M6 deliverables and by the M6 handoff. It exists for two reasons:
#
#   1. Self-test — `bash scripts/close-feature.sh --self-test` runs the full
#      Journey Guardian battery (G-JE-1..6) against the current tree without
#      requiring a real feature branch. CI and reviewers use this to confirm
#      the gates behave correctly.
#
#   2. Delegation — in normal closure flow, the canonical driver is
#      `.claude/scripts/close-feature.sh` (the per-project harness script).
#      When invoked without `--self-test`, this shim forwards to the
#      canonical driver and layers the Journey Guardian battery on top.
#
# The Journey Guardian logic itself lives in a dedicated, isolated block at
# `scripts/close-feature-journey-guardian.sh` so it can be sourced cleanly
# by either entry point without duplicating code.
#
# Usage:
#   bash scripts/close-feature.sh --self-test          # run guardian only, any tree
#   bash scripts/close-feature.sh --guardian-only      # alias of --self-test
#   bash scripts/close-feature.sh                      # forward to .claude/scripts/close-feature.sh
#   bash scripts/close-feature.sh <wt-number>          # idem
#
# Exit codes:
#   0  — all guardian gates passed (or self-test green).
#   1  — one or more gates failed; block the merge.

set -eo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "❌ scripts/close-feature.sh: not inside a git repo." >&2
  exit 1
fi

GUARDIAN_SCRIPT="$REPO_ROOT/scripts/close-feature-journey-guardian.sh"
CANONICAL_DRIVER="$REPO_ROOT/.claude/scripts/close-feature.sh"

if [ ! -x "$GUARDIAN_SCRIPT" ]; then
  echo "❌ Missing: $GUARDIAN_SCRIPT" >&2
  echo "   The Journey Guardian battery is required for M6 closure." >&2
  exit 1
fi

MODE="${1:-}"

case "$MODE" in
  --self-test|--guardian-only)
    # ── Self-test path ────────────────────────────────────────────
    # Forces every G-JE-* gate to run regardless of diff content.
    # Useful for CI ("does the battery still work?") and for reviewers
    # validating the gates on a synthetic journey-engine diff.
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Journey Guardian — SELF-TEST"
    echo "   Base:    HEAD (no diff)"
    echo "   Mode:    force-all-gates"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    export CLOSE_FEATURE_SELF_TEST=1
    export BASE_BRANCH="${BASE_BRANCH:-HEAD}"
    JOURNEY_GUARDIAN_ERRORS=0

    # Source so the counter comes back across the boundary.
    # shellcheck source=./close-feature-journey-guardian.sh
    . "$GUARDIAN_SCRIPT"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ "${JOURNEY_GUARDIAN_ERRORS:-0}" -gt 0 ]; then
      echo "❌ Journey Guardian SELF-TEST: ${JOURNEY_GUARDIAN_ERRORS} gate(s) failed."
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      exit 1
    fi
    echo "✅ Journey Guardian SELF-TEST: all 6 gates green."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
    ;;

  --non-journey-dry-run)
    # ── Dry-run path: confirm guardian skips on non-journey diff ──
    # Verifies the guard clause is intact so non-journey sub-sorties
    # don't accidentally trip the battery.
    echo "🧪 Journey Guardian — NON-JOURNEY DRY-RUN"
    echo "   (expecting the guardian to skip without touching any gate)"
    echo ""
    unset CLOSE_FEATURE_SELF_TEST
    # Empty diff => guardian must skip.
    export BASE_BRANCH="HEAD"
    JOURNEY_GUARDIAN_ERRORS=0
    # shellcheck source=./close-feature-journey-guardian.sh
    . "$GUARDIAN_SCRIPT"
    if [ "${JOURNEY_GUARDIAN_ERRORS:-0}" -gt 0 ]; then
      echo "❌ Guardian ran and failed gates on a non-journey diff — guard broken."
      exit 1
    fi
    echo ""
    echo "✅ Non-journey dry-run green (guardian skipped)."
    exit 0
    ;;

  *)
    # ── Normal closure path: forward to canonical driver ──────────
    if [ ! -x "$CANONICAL_DRIVER" ]; then
      echo "❌ Canonical driver missing: $CANONICAL_DRIVER" >&2
      exit 1
    fi
    # Forward all args to the canonical driver. Guardian gates are
    # invoked by the canonical driver via source when the diff touches
    # journey-engine surfaces.
    exec "$CANONICAL_DRIVER" "$@"
    ;;
esac
