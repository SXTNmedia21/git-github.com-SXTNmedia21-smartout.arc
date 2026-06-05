# STANDING ORDER — 2026-06-03T18:13:04Z

Pontus is asleep. No human in the loop until morning. **Work until you are ready.**

- Push your in_progress task toward DONE: build/run the verify gates, port, commit, advance dims.
- Use the harness: `tasks/task.sh verify <id>` → gate ≥95 → AWAITING-HUMAN-APPROVAL.
- You are DONE when your task is CLEAR (all gates green). Then drop `<id>.done` in this dir and stop.
- You are STOPPED only on a HARD block you cannot pass. Drop `<id>.stop` with one line why, then stop.
- Do NOT wait for Pontus. Do NOT auto-cross G8 / human-approval (C4). Clear the gate; leave approval for morning.
- Confident ≠ authorized. Flag what needs a human in `<id>.stop`; keep working on everything else.
