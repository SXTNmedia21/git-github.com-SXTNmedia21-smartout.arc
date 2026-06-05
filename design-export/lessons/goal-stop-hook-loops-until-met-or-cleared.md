---
topic: goal-stop-hook-loops-until-met-or-cleared
status: active
updated: 2026-06-01T00:25:00Z
created: 2026-06-01T00:25:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — goal-stop-hook-loops-until-met-or-cleared

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

A `/goal` Stop hook is **runtime session state, not a file on disk** — there is no
`goal.json` to edit. It re-fires on EVERY turn-stop and blocks the turn from ending until
its condition holds true. It auto-clears only when the condition is met; otherwise the human
must run `/goal clear`. The agent CANNOT clear it from its side.

Consequences:

1. **If the goal is currently unmeetable** (work paused, a prerequisite pending a human
   decision, a partial state like 121/143), the hook loops indefinitely — the same
   "condition not satisfied" feedback every turn. This is expected behavior, not a bug.
2. **The runtime caps consecutive blocks** (default 9 — `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`),
   then overrides and ends the turn. So the loop self-terminates after N, but burns N turns first.
3. **Do not hunt for a goal file to patch** — it does not exist as `goal.json`. Searching for /
   editing one wastes turns (verified 2026-06-01: no goal.json in the session project dir).
4. **The only two exits:** (a) actually satisfy the condition, or (b) the human runs
   `/goal clear`. When the agent is correctly blocked on a human decision (e.g. commit
   authority after a data loss), surface BOTH: "I'm blocked on X; you can `/goal clear` to stop
   the hook loop" — once, not repeated every turn.
5. **When a goal conflicts with an explicit user pause/instruction, the user wins** — but the
   hook still fires (it is mechanical). Acknowledge the conflict, do the user's instruction, and
   tell the user the hook will keep firing until they clear it. Don't let the hook push you into
   an action the user paused.

## Why

Pontus, 2026-06-01: "vad skjer fiks denne end hook" — the goal Stop hook (set earlier via
`/goal` to "every telemetry event accounted for") looped ~10 turns because the goal was genuinely
unmet (121/143 events, work uncommitted, paused for recovery + commit decision). The agent wasted
turns searching for a `goal.json` to deactivate; none exists — it is runtime state. The runtime's
9-block cap then auto-overrode. The fix is understanding: the hook is correct to fire (goal unmet);
the exit is `/goal clear` (human) or finishing the work — not a file edit. Relates to
[[do-the-thing-not-machinery-about-it]] (don't spin on machinery — either finish the thing or
surface the one human action that unblocks).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T00:25:00Z — initial: /goal Stop hook is runtime session state (no goal.json to edit); loops every turn until condition met or human runs `/goal clear`; runtime caps consecutive blocks (9, CLAUDE_CODE_STOP_HOOK_BLOCK_CAP) then overrides; agent can't clear it; when blocked on a human decision, surface `/goal clear` once; user pause overrides the goal but the hook still mechanically fires.
