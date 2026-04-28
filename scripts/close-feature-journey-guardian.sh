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
#   G-JE-7  No phantom capabilities (ADR-0196 Inv 11) — emit run_started AND
#           return-ok-with-no-write is forbidden in tools.ts.
#   G-JE-8  Falsifiable status claims (ADR-0196 Inv 12) — diff to
#           CAMPAIGN-journey-engine.md / CLAUDE.md adding a "complete" row
#           must include a `verify:` block with a runnable command.
#   G-JE-9  `callGateAction` on every mutation capability (ADR-0196 Inv 13 +
#           ADR-0099) — any tool body containing supabase insert/update/delete
#           in tools.ts must also contain `callGateAction(`.
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
  echo "   🛡️  Journey-engine surfaces touched — enforcing gates G-JE-1..9."
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

# ─── G-JE-7: No phantom capabilities (ADR-0196 Invariant 11) ───────────
# Forbidden shape: emit("journey run_started") near return {ok:true,note:"…skeleton|lands in M…"}
# Implementation: scan tools.ts for the pattern within a 30-line window per
# tool body. False-positive escape hatch: a `// noqa: invariant-11` comment
# on the same line as the offending return.
JE_TOOLS_FILE="packages/ai/src/capabilities/journey/tools.ts"
JE_PHANTOM_HITS=""
if [ -f "$JE_TOOLS_FILE" ]; then
  # awk window: track most-recent `run_started` emit line and check the next
  # 30 lines for `ok: true` followed by a skeleton/lands-in note.
  JE_PHANTOM_HITS=$(awk '
    /emit\(.*"journey run_started"/ { armed = NR; next }
    armed && NR - armed <= 30 && /ok:[[:space:]]*true/ {
      saved_line = $0; saved_nr = NR
    }
    armed && NR - armed <= 30 && saved_nr && /note:.*("|'"'"')(.*skeleton|.*lands in M)/ && !/noqa:[[:space:]]*invariant-11/ {
      print "        line " saved_nr ": phantom emit→ok:true→skeleton/lands-in note"
      armed = 0; saved_nr = 0
    }
    NR - armed > 30 { armed = 0; saved_nr = 0 }
  ' "$JE_TOOLS_FILE" 2>/dev/null || true)
fi
if [ -n "$JE_PHANTOM_HITS" ]; then
  echo "   ❌ G-JE-7 FAIL: phantom capability shape detected in $JE_TOOLS_FILE (ADR-0196 Inv 11):"
  printf "%s\n" "$JE_PHANTOM_HITS"
  echo "       Fix: either implement the artefact-producing body, or return {ok:false,error:'not_implemented'} WITHOUT emitting run_started."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-7 No phantom capabilities (ADR-0196 Inv 11)"
fi

# ─── G-JE-8: Falsifiable status claims (ADR-0196 Invariant 12) ─────────
# Diffs adding a new "complete" / "✅ COMPLETE" row to the campaign doc or
# CLAUDE.md must include a matching `verify:` line in the same hunk.
JE_CLAIM_TARGETS="docs/plans/CAMPAIGN-journey-engine.md CLAUDE.md"
JE_CLAIM_HITS=""
for f in $JE_CLAIM_TARGETS; do
  [ -f "$f" ] || continue
  # Added lines in the diff that mark a milestone complete.
  added=$(git diff "${BASE_BRANCH}..HEAD" -- "$f" 2>/dev/null \
    | grep -E '^\+[^+]' \
    | grep -E '✅ COMPLETE|\bcomplete\b.*—|\bCOMPLETE\b' || true)
  if [ -z "$added" ]; then continue; fi
  # Diff must also contain a `verify:` line added in the same hunk.
  verify=$(git diff "${BASE_BRANCH}..HEAD" -- "$f" 2>/dev/null \
    | grep -E '^\+[^+]' \
    | grep -E 'verify:|`pnpm test|`pnpm turbo|SQL:|grep:' || true)
  if [ -z "$verify" ]; then
    JE_CLAIM_HITS="${JE_CLAIM_HITS}${f}: complete-claim added without verify: block\n"
  fi
done
if [ -n "$JE_CLAIM_HITS" ]; then
  echo "   ❌ G-JE-8 FAIL: campaign status claim added without falsifiable verify (ADR-0196 Inv 12):"
  printf "%b" "$JE_CLAIM_HITS" | sed 's/^/        - /'
  echo "       Fix: append a verify: line citing a runnable command (pnpm test / SQL / grep) that proves the claim."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-8 Falsifiable status claims (ADR-0196 Inv 12)"
fi

# ─── G-JE-9: callGateAction on every mutation tool (ADR-0196 Inv 13) ───
# Per-tool: if execute() body contains supabase insert/update/delete OR a
# write-side rpc, it MUST also contain callGateAction(. Read-only tools
# declare `readOnly: true` and are exempt (ADR-0201 §D4).
JE_GATE_HITS=""
if [ -f "$JE_TOOLS_FILE" ]; then
  JE_GATE_HITS=$(awk '
    /export const [A-Za-z_]+Tool = defineTool\({/ { in_tool = 1; tool_start = NR; tool_text = ""; tool_name = ""; next }
    in_tool { tool_text = tool_text "\n" $0 }
    in_tool && /^[[:space:]]*name:[[:space:]]*"[a-z_]+"/ {
      match($0, /"[a-z_]+"/); tool_name = substr($0, RSTART+1, RLENGTH-2)
    }
    in_tool && /^}\);/ {
      has_mut = (tool_text ~ /\.from\(.+\)\.[[:space:]]*(insert|update|delete)\(/) || (tool_text ~ /\.rpc\(/)
      has_gate = (tool_text ~ /callGateAction\(/)
      is_readonly = (tool_text ~ /readOnly:[[:space:]]*true/)
      if (has_mut && !has_gate && !is_readonly) {
        print "        " tool_name " (line " tool_start "): mutation without callGateAction"
      }
      in_tool = 0
    }
  ' "$JE_TOOLS_FILE" 2>/dev/null || true)
fi
if [ -n "$JE_GATE_HITS" ]; then
  echo "   ❌ G-JE-9 FAIL: mutation capability tool without callGateAction (ADR-0196 Inv 13 + ADR-0099):"
  printf "%s\n" "$JE_GATE_HITS"
  echo "       Fix: call callGateAction(...) before the first .insert/.update/.delete/.rpc — or declare readOnly:true."
  JOURNEY_GUARDIAN_ERRORS=$((JOURNEY_GUARDIAN_ERRORS + 1))
else
  echo "   ✅ G-JE-9 callGateAction on every mutation tool (ADR-0196 Inv 13)"
fi

# Re-enable strict mode for downstream callers that expect it.
set -e

return 0 2>/dev/null || exit 0
