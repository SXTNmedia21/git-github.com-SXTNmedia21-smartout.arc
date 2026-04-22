#!/bin/bash
# close-feature-journey-guardian.sh — Journey Engine gates for close-feature (M6).
#
# This is the canonical home for journey-engine-specific close-feature gates.
# It implements the 6 gates called out in CLAUDE.md §Feature closure gates #6–#10
# (journey-specific additions) plus the L-0023 runtime-write gate.
#
# Integration: sourced or invoked by `.claude/scripts/close-feature.sh` AFTER
# the generic gates (1 Decision log, 2 Journey Guardian, 3 Frontmatter, 4
# Typecheck) and BEFORE the Handoff info line. Block is isolated so non-
# journey flows skip the entire battery.
#
# ─── Contract ─────────────────────────────────────────────────────────────
#   Inputs  (env):
#     BASE_BRANCH              — branch this sub-sortie merges into
#                                 (e.g. campaign/journey-engine or development).
#     CLOSE_FEATURE_SELF_TEST  — optional. If "1", runs all gates against the
#                                current tree state (no diff needed) so the
#                                battery can be exercised in isolation.
#   Outputs (env, written back to caller via shared process scope):
#     JOURNEY_GUARDIAN_ERRORS  — number of failed gates (caller should add
#                                this to its ERRORS counter and block merge).
#
# ─── Integration snippet (to paste into close-feature.sh) ────────────────
#
#   # =============================================
#   # GATE 5: Journey Guardian
#   # =============================================
#   if [ -x "$(git rev-parse --show-toplevel)/scripts/close-feature-journey-guardian.sh" ]; then
#     JOURNEY_GUARDIAN_ERRORS=0
#     source "$(git rev-parse --show-toplevel)/scripts/close-feature-journey-guardian.sh"
#     ERRORS=$((ERRORS + JOURNEY_GUARDIAN_ERRORS))
#   fi
#
# ─── Gates ────────────────────────────────────────────────────────────────
#   G-JE-1  Emit-registry parity     — every new `event: "journey <name>"`
#                                      has a matching key in
#                                      packages/telemetry/src/registry.ts.
#   G-JE-2  Authority seed parity    — a new capability tool in the diff
#                                      must be paired with a migration on
#                                      engine_authority_config.
#   G-JE-3  No legacy journey-path refs (ADR-0171).
#   G-JE-4  No enum shortcut (ADR-0172).
#   G-JE-5  Capability count frozen at 4 (ADR-0173).
#   G-JE-6  No runtime writes to journey_event (L-0023).
#
# All gates are merge blockers when the diff touches journey-engine surfaces.

set +e  # Gates run independently; one failure must not abort the whole block.

JOURNEY_GUARDIAN_ERRORS=${JOURNEY_GUARDIAN_ERRORS:-0}
BASE_BRANCH="${BASE_BRANCH:-campaign/journey-engine}"

echo "📋 Gate 5: Journey Guardian (journey-engine gates)"

# ─── Guard: is this diff journey-touching? ──────────────────────────────
# Any path matching one of the journey-engine surfaces arms the battery.
# Non-journey sub-sorties skip gracefully. Self-test mode forces all
# gates to run.
JE_DIFF=$(git diff "${BASE_BRANCH}..HEAD" --name-only 2>/dev/null || true)
JE_TOUCHES=$(printf "%s\n" "$JE_DIFF" | grep -E '^(packages/journey-ir/|packages/ai/src/capabilities/journey/|packages/telemetry/src/registry\.ts|apps/web/src/app/platform-admin/journeys/|apps/web/src/app/api/journey/|apps/web/src/components/journey/|apps/mobile/src/screens/journey/|apps/e2e/generators/|supabase/functions/journey-stuck-detector/|supabase/migrations/.*journey|docs/decisions/017[1-8]-.*\.md$)' || true)

if [ -z "$JE_TOUCHES" ] && [ -z "$CLOSE_FEATURE_SELF_TEST" ]; then
  echo "   ℹ️  Diff does not touch journey-engine surfaces — Journey Guardian skipped."
  return 0 2>/dev/null || exit 0
fi

if [ -n "$CLOSE_FEATURE_SELF_TEST" ]; then
  echo "   🧪 SELF-TEST mode — running all gates against current tree state."
else
  echo "   🛡️  Journey-engine surfaces touched — enforcing gates G-JE-1..6."
fi

# ─── G-JE-1: Emit-registry parity ──────────────────────────────────────
# Find new/modified `event: "journey <name>"` emit call-sites in the diff.
# Every such event name must appear in the registry file.
# Space-form is canonical (ADR-0175). Dot-form in activity_trail is
# post-toDotNotation() wire form and intentionally excluded here.
JE_EMIT_NEW=$(git diff "${BASE_BRANCH}..HEAD" -- '*.ts' '*.tsx' 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -oE 'event:[[:space:]]*["'\'']journey [a-z_]+' \
  | sed -E 's/^event:[[:space:]]*["'\'']//; s/["'\'']//g' \
  | sort -u || true)
JE_EMIT_MISSING=""
if [ -n "$JE_EMIT_NEW" ]; then
  while IFS= read -r ev; do
    [ -z "$ev" ] && continue
    if ! grep -q "\"$ev\"" packages/telemetry/src/registry.ts 2>/dev/null; then
      JE_EMIT_MISSING="${JE_EMIT_MISSING}${ev}\n"
    fi
  done <<< "$JE_EMIT_NEW"
fi
if [ -n "$JE_EMIT_MISSING" ]; then
  echo "   ❌ G-JE-1 FAIL: emit call(s) without matching registry entry:"
  printf "%b" "$JE_EMIT_MISSING" | sed 's/^/        - /'
  echo "       Fix: add each event to packages/telemetry/src/registry.ts in the same commit."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-1 Emit-registry parity (ADR-0175)"
fi

# ─── G-JE-2: Authority seed parity ─────────────────────────────────────
# If tools.ts added a new capability definition, the diff must include
# a migration touching engine_authority_config.
JE_CAP_DIFF=$(git diff "${BASE_BRANCH}..HEAD" -- packages/ai/src/capabilities/journey/tools.ts 2>/dev/null \
  | grep -E '^\+[^+].*capability:[[:space:]]*["'\'']journey\.[a-z_]+' || true)
JE_AUTHORITY_DIFF=$(git diff "${BASE_BRANCH}..HEAD" -- 'supabase/migrations/*' 2>/dev/null \
  | grep -E '^\+[^+].*engine_authority_config' || true)
if [ -n "$JE_CAP_DIFF" ] && [ -z "$JE_AUTHORITY_DIFF" ]; then
  echo "   ❌ G-JE-2 FAIL: new capability(ies) declared but no engine_authority_config migration in diff."
  echo "       Fix: seed the capability in a migration in the same commit (ADR-0176)."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-2 Authority seed parity (ADR-0176)"
fi

# ─── G-JE-3: No legacy journey-path refs (ADR-0171) ────────────────────
# Exclude this script (it names the forbidden paths in comments/regex).
JE_LEGACY=$(grep -RnE "packages/ai/src/journey|@smartout/ai/journey/compile" apps packages scripts \
  --exclude=close-feature-journey-guardian.sh 2>/dev/null || true)
if [ -n "$JE_LEGACY" ]; then
  echo "   ❌ G-JE-3 FAIL: legacy journey-path references found (ADR-0171 forbids):"
  printf "%s\n" "$JE_LEGACY" | sed 's/^/        /'
  echo "       Fix: import from @smartout/journey-ir instead."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-3 No legacy journey-path refs (ADR-0171)"
fi

# ─── G-JE-4: No enum shortcut (ADR-0172) ───────────────────────────────
JE_ENUM_SHORTCUT=$(grep -RnE "journey_status ADD VALUE" supabase/migrations 2>/dev/null || true)
if [ -n "$JE_ENUM_SHORTCUT" ]; then
  echo "   ❌ G-JE-4 FAIL: 'journey_status ADD VALUE' found (ADR-0172 forbids — use 0a/0b/0c):"
  printf "%s\n" "$JE_ENUM_SHORTCUT" | sed 's/^/        /'
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-4 No enum shortcut (ADR-0172)"
fi

# ─── G-JE-5: Capability count frozen at 4 (ADR-0173) ───────────────────
# Count UNIQUE capability names in tools.ts. Repeated `capability:`
# occurrences for the same name inside dispatch/gate blocks are fine.
JE_CAP_COUNT=$(grep -oE "capability:[[:space:]]*[\"']journey\.[a-z_]+" packages/ai/src/capabilities/journey/tools.ts 2>/dev/null | sort -u | wc -l)
if [ "$JE_CAP_COUNT" != "4" ]; then
  echo "   ❌ G-JE-5 FAIL: capability count = ${JE_CAP_COUNT}, expected 4 (run_dev, publish_mission, publish_guide, run_guided). ADR-0173 bans adding a 5th capability here."
  grep -oE "capability:[[:space:]]*[\"']journey\.[a-z_]+" packages/ai/src/capabilities/journey/tools.ts 2>/dev/null | sort -u | sed 's/^/        /'
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-5 Capability count = 4 (ADR-0173)"
fi

# ─── G-JE-6: No runtime writes to journey_event (L-0023) ───────────────
JE_RUNTIME_EVT=$(grep -RnE "from\(['\"]journey_event['\"]\)\..*insert" apps/web/src/app/api/journey apps/mobile packages/ai/src/capabilities/journey 2>/dev/null || true)
if [ -n "$JE_RUNTIME_EVT" ]; then
  echo "   ❌ G-JE-6 FAIL: runtime path writes to journey_event (L-0023 forbids — use engine_state + engine_event):"
  printf "%s\n" "$JE_RUNTIME_EVT" | sed 's/^/        /'
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-6 No runtime writes to journey_event (L-0023)"
fi

# Re-enable strict mode for downstream callers that expect it.
set -e

return 0 2>/dev/null || exit 0
