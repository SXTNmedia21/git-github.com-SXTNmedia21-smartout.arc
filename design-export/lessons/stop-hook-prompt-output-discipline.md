---
topic: stop-hook-prompt-output-discipline
status: active
updated: 2026-05-31T13:03:48Z
created: 2026-05-31T13:03:48Z
supersedes:
---

# Decision lesson — stop-hook-prompt-output-discipline

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

A `prompt`-type Stop hook must instruct the evaluator to return a decision ONLY (`{"decision":"approve"}` silent on the no-event path) and never emit analysis/commentary. If the prompt permits prose, the harness surfaces that prose as a **"Stop hook error"** on every Stop — visible noise even when the verdict is approve. The sxtn self-improve Stop gate (`hooks/hooks.json` → `Stop[0].hooks[1]`) was rewritten to demand decision-only output.

## Why

The original prompt said "return decision 'approve'" but did not forbid explanatory text, so the model returned a full paragraph each turn ("No renaming... No lesson capture required"), which Claude Code renders through the error channel. Output discipline (decision-only, silent approve) eliminates the per-Stop noise without losing the fuzzy judgment a prompt gate provides — a mechanical command hook cannot detect "flagged a finding in prose", so the gate stays prompt-type. Hooks load at session start: the new prompt takes effect only after a Claude Code restart.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T13:03:48Z — initial: stop-hook prompt-gates must return decision-only output; prose surfaces as "Stop hook error" noise.
