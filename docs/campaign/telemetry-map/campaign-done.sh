#!/usr/bin/env bash
# campaign-done.sh — the redesign-wiring "done" / escalation watcher.
#
# DONE iff EVERY domain's control.json is hook-green per the campaign lesson:
#     hooks_missing == []   AND   events_missing_from_registry == []
# (redesign-wiring-pipeline.md: fan-out-readiness = HOOK-readiness, not telemetry real_rate.)
#
# Modes:
#   --when   : exit 0 if ALL control.json are hook-green (the heartbeat `when` predicate),
#              exit 1 otherwise. Pure read.
#   --fire   : the campaign IS done -> disarm the autonomous loop (remove both walls' flags
#              + stop the heartbeat) and write a Pontus-facing notice. Idempotent.
#
# No app code. Reads control.json, writes only the done-notice + removes .sxtn loop flags.
set -uo pipefail
cd "$(dirname "$0")"
PROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ..)"
MODE="${1:---when}"
command -v jq >/dev/null 2>&1 || { echo "campaign-done: jq required" >&2; exit 2; }

shopt -s nullglob
TOTAL=0; GREEN=0; NOTGREEN=()
for c in */control.json; do
  TOTAL=$((TOTAL+1))
  g="$(jq -r '(((.hooks_missing//[])|length)==0) and (((.events_missing_from_registry//[])|length)==0)' "$c" 2>/dev/null)"
  if [ "$g" = "true" ]; then GREEN=$((GREEN+1)); else NOTGREEN+=("$(dirname "$c")"); fi
done

all_green() { [ "$TOTAL" -gt 0 ] && [ "$GREEN" -eq "$TOTAL" ]; }

case "$MODE" in
  --when)
    all_green && exit 0 || exit 1
    ;;
  --fire)
    if ! all_green; then
      echo "campaign-done --fire: NOT done ($GREEN/$TOTAL green; remaining: ${NOTGREEN[*]}). No-op." >&2
      exit 1
    fi
    # disarm both walls + stop the beat
    rm -f "$PROOT/.sxtn/autonomous-loop.active" \
          "$PROOT/.sxtn/enforce-gates" \
          "$PROOT/.sxtn/.loop-gate-count" \
          "$PROOT/.sxtn/.loop-gate-laststate" \
          "$PROOT/.sxtn/heartbeat.active"
    NOTICE="reports/CAMPAIGN-DONE.md"
    mkdir -p reports
    {
      echo "# redesign-wiring — CAMPAIGN DONE"
      echo
      echo "All **$TOTAL** domains are hook-green: \`hooks_missing == [] AND events_missing_from_registry == []\`."
      echo
      echo "- Disarmed: removed \`.sxtn/autonomous-loop.active\`, \`.sxtn/enforce-gates\`, \`.sxtn/heartbeat.active\`."
      echo "- Verified at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo
      echo "> Pontus: the loop self-disarmed on the done-read. Next step is release gating (preview promote / tag), which is yours, not the loop's."
    } > "$NOTICE"
    # live pulse to Pontus (best-effort; never fails the disarm)
    bash "$PROOT/.sxtn-staging/telemetry-map/heartbeat.sh" 2>/dev/null || true
    ~/.claude/scripts/heartbeat-notify.sh file "redesign-wiring: all $TOTAL domains hook-green — autonomous loop disarmed. See $NOTICE." 2>/dev/null || true
    echo "campaign-done: DONE — $GREEN/$TOTAL green. Disarmed + notice at $NOTICE."
    exit 0
    ;;
  *)
    echo "usage: campaign-done.sh [--when|--fire]" >&2; exit 2 ;;
esac
