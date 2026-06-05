#!/usr/bin/env bash
# run-verify.sh — run a task's verify-script(s) and apply the confidence gate.
#
# The AGENT runs this. The agent does NOT write the verify-scripts — Pontus/orchestrator own them.
# The scripts are the truth the agent cannot fake.
#
#   run-verify.sh <task.json>
#
# Handles BOTH shapes:
#   • single   : task.verify_script           → one {percent,confidence}
#   • subtasks : task.subtasks[].verify_script → N dimensions, ALL must clear
#
# Each verify-script MUST print one JSON line:  {"percent":0-100,"confidence":0-100}
# Gate: confidence >= GATE (default 95). A task CLEARS only when EVERY part clears.
# On clear → AWAITING-HUMAN-APPROVAL (C4 — ready ≠ authorized; the human advances, not the agent).
#
# Exit: 0 = CLEAR(awaiting human) · 2 = NOT READY (honest gap) · 1 = usage error

set -uo pipefail
GATE="${TASK_GATE_CONFIDENCE:-95}"
TASK="${1:?usage: run-verify.sh <task.json>}"
[ -f "$TASK" ] || { echo "task not found: $TASK" >&2; exit 1; }

GATE="$GATE" python3 - "$TASK" <<'PY'
import json, subprocess, sys, os
gate = int(os.environ.get("GATE", "95"))
path = sys.argv[1]
d = os.path.dirname(path) or "."
t = json.load(open(path))
tid = t.get("id", "?")

def run(vscript):
    """Run a verify-script the agent did NOT write. Return (percent, confidence, ok_to_run)."""
    if not vscript:
        return 0, 0, False
    full = os.path.join(d, vscript)
    if not os.path.isfile(full):
        return 0, 0, False
    try:
        out = subprocess.run(["bash", full], capture_output=True, text=True, timeout=120).stdout
        j = json.loads(out.strip().splitlines()[-1])
        return int(j.get("percent", 0)), int(j.get("confidence", 0)), True
    except Exception:
        return 0, 0, True  # ran but unparseable → treat as 0/0 (fails the gate honestly)

subs = t.get("subtasks")
reds, results = [], []

if isinstance(subs, list) and subs:
    # ── 8-dimension fidelity task ──────────────────────────────────────────
    for s in subs:
        p, c, ran = run(s.get("verify_script", ""))
        green = ran and c >= gate
        s["last_run"] = {"percent": p, "confidence": c, "green": green, "has_script": ran}
        s["status"] = "green" if green else ("missing-script" if not ran else "red")
        mark = "🟢" if green else ("🟡" if not ran else "🔴")
        label = s.get("dim", s.get("n", "?"))
        note = "no script yet" if not ran else f"{p}% conf={c}%"
        print(f"  {mark} {label:<14} {note}")
        results.append(green)
        if not green:
            reds.append(str(label))
    all_green = all(results) and len(results) > 0
    t["last_run"] = {"green_dims": sum(results), "total_dims": len(results), "cleared": all_green}
else:
    # ── single verify_script task ──────────────────────────────────────────
    p, c, ran = run(t.get("verify_script", ""))
    green = ran and c >= gate
    t["last_run"] = {"percent": p, "confidence": c, "cleared": green, "has_script": ran}
    print(f"  {'🟢' if green else ('🟡' if not ran else '🔴')} {tid}  {'no script yet' if not ran else f'{p}% conf={c}%'}")
    all_green = green
    if not green:
        reds.append(tid)

json.dump(t, open(path, "w"), indent=2, ensure_ascii=False)

print("")
if all_green:
    print(f"🟢 {tid} — ALL parts ≥{gate}% → CLEAR")
    print(f"   ⏸ AWAITING-HUMAN-APPROVAL — cleared ≠ authorized (C4). Pontus reviews the browser + approves; then advance.")
    sys.exit(0)
else:
    print(f"🔴 {tid} — NOT READY · red/missing: {', '.join(reds)} · no advance (page-100-before-advance)")
    sys.exit(2)
PY
