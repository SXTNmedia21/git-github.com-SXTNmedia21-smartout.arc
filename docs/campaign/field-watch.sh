#!/usr/bin/env bash
# field-watch.sh — the heartbeat field-check. Reads the in-field agent's progress,
# compares to the last checkpoint, and verdicts whether it's MOVING or STALLED.
#
# The cron wakes the orchestrator (me); I run this; I read the verdict and decide
# whether to escalate (heartbeat-notify telegram). The script measures; I judge.
#
#   field-watch.sh            — print state + verdict, update checkpoint
# Verdict line is machine-readable:  VERDICT: MOVING | STALLED | IDLE
#   MOVING  = progress since last check (new commit / dims up / verify ran)
#   STALLED = an in_progress task, but NO progress AND last commit older than $STALE_MIN
#   IDLE    = nothing in_progress (nothing to watch)

set -uo pipefail
CAMP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$CAMP/../.." && pwd)"
CP="$CAMP/.field-watch.json"
STALE_MIN="${STALE_MIN:-20}"

now_epoch=$(date +%s)
now_iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# orchestrator activity: campaign HEAD + age
head_hash=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo "?")
head_epoch=$(git -C "$REPO" log -1 --format=%ct 2>/dev/null || echo 0)
head_age_min=$(( (now_epoch - head_epoch) / 60 ))

# in-field tasks (in_progress) + their green dims
python3 - "$CAMP" "$CP" "$head_hash" "$head_age_min" "$now_iso" "$STALE_MIN" <<'PY'
import json, os, sys, glob
camp, cp, head, age, now, stale = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5], int(sys.argv[6])
prev = {}
if os.path.exists(cp):
    try: prev = json.load(open(cp))
    except Exception: prev = {}

infield = []
for f in glob.glob(os.path.join(camp, "tasks", "*.task.json")):
    t = json.load(open(f))
    if t.get("status") == "in_progress":
        subs = t.get("subtasks") or []
        green = sum(1 for s in subs if s.get("status") == "green")
        lr = t.get("last_run") or {}
        infield.append({"id": t.get("id"), "green": lr.get("green_dims", green),
                        "total": len(subs), "cleared": bool(lr.get("cleared", False))})

print(f"▶ field-watch {now}")
print(f"  orchestrator HEAD {head} · {age}m old")
if not infield:
    print("  in-field: (none in_progress)")
    print("VERDICT: IDLE")
    verdict = "IDLE"
else:
    moved = head != prev.get("head_hash")
    prev_dims = prev.get("dims", {})
    dims_up = False
    for t in infield:
        pd = prev_dims.get(t["id"], -1)
        flag = "↑" if t["green"] > pd else " "
        if t["green"] > pd: dims_up = True
        print(f"  {flag} {t['id']:<26} {t['green']}/{t['total']} dims" + (" ✅CLEAR" if t["cleared"] else ""))
    if moved or dims_up:
        verdict = "MOVING"
        print(f"  progress: commit={'yes' if moved else 'no'} dims={'up' if dims_up else 'flat'}")
    elif age >= stale:
        verdict = "STALLED"
        print(f"  ⚠ no progress + HEAD {age}m old (≥{stale}m) — agent may be stuck/hiding/not using harness")
    else:
        verdict = "MOVING"  # too soon to call stall
        print(f"  no delta yet but HEAD only {age}m old (<{stale}m) — give it time")
    print(f"VERDICT: {verdict}")

json.dump({"last_check": now, "head_hash": head,
           "dims": {t["id"]: t["green"] for t in infield}},
          open(cp, "w"), indent=2)
PY
