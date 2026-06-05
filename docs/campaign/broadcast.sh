#!/usr/bin/env bash
# broadcast.sh — the heartbeat's overnight voice. Sends "keep working" to every
# active field agent each pulse, until each one says DONE (cleared) or STOP (blocked).
#
# Pontus is asleep. No human in the loop. The standing order is: work until ready.
# An agent leaves the broadcast by clearing its task or dropping a .stop/.done signal.
#
#   broadcast.sh            — refresh standing order, nudge every unfinished in_progress task
# Prints who got nudged · who's done · who stopped. Returns 0 always (a pulse, not a gate).

set -uo pipefail
CAMP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIG="$CAMP/tasks/.signals"
mkdir -p "$SIG"
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 1. standing order — the message every agent reads
cat > "$SIG/broadcast.md" <<EOF
# STANDING ORDER — $now

Pontus is asleep. No human in the loop until morning. **Work until you are ready.**

- Push your in_progress task toward DONE: build/run the verify gates, port, commit, advance dims.
- Use the harness: \`tasks/task.sh verify <id>\` → gate ≥95 → AWAITING-HUMAN-APPROVAL.
- You are DONE when your task is CLEAR (all gates green). Then drop \`<id>.done\` in this dir and stop.
- You are STOPPED only on a HARD block you cannot pass. Drop \`<id>.stop\` with one line why, then stop.
- Do NOT wait for Pontus. Do NOT auto-cross G8 / human-approval (C4). Clear the gate; leave approval for morning.
- Confident ≠ authorized. Flag what needs a human in \`<id>.stop\`; keep working on everything else.
EOF

# 2. nudge every in_progress task that isn't already done/stopped
nudged=0; done=0; stopped=0
for f in "$CAMP"/tasks/*.task.json; do
  tid=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('id',''))" "$f")
  st=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('status',''))" "$f")
  cleared=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('last_run',{}).get('cleared',False))" "$f")
  [ "$st" = "in_progress" ] || continue
  if [ -f "$SIG/$tid.done" ] || [ "$cleared" = "True" ]; then
    echo "  ✅ $tid — DONE (left the broadcast)"; done=$((done+1)); continue
  fi
  if [ -f "$SIG/$tid.stop" ]; then
    echo "  ⛔ $tid — STOPPED ($(head -1 "$SIG/$tid.stop"))"; stopped=$((stopped+1)); continue
  fi
  echo "GO $now — keep working until DONE or STOP. See broadcast.md." > "$SIG/$tid.go"
  echo "  📣 $tid — nudged (GO)"; nudged=$((nudged+1))
done

echo ""
echo "broadcast $now · nudged:$nudged done:$done stopped:$stopped"
# verdict for the cron: keep broadcasting while anyone still has work
if [ "$nudged" -gt 0 ]; then echo "BROADCAST: ACTIVE ($nudged still working)"; else echo "BROADCAST: QUIET (all done/stopped)"; fi
