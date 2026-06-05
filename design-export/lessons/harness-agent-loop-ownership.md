---
topic: harness-agent-loop-ownership
status: open
updated: 2026-05-31T00:00:00Z
created: 2026-05-31T00:00:00Z
supersedes:
---

# Decision lesson — harness-agent-loop-ownership

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

OPEN — not yet resolved. Two new conductor agents landed untracked in the same
session (`agents/sxtn-harness-builder.md`, `agents/sxtn-foreman.md`). Both appear
to claim authority over the autonomous loop / between-gate drive. Loop ownership
MUST be assigned to exactly one agent before either ships; the other must
explicitly defer. Resolution pending a read of `sxtn-foreman.md` and Pontus's call.

## Why

Two agents arming/driving the same Stop-loop (`sxtn-loop-gate` re-feed) risks
double-dispatch, conflicting state writes, and the opus-on-opus slowness CLAUDE.md
warns against. Single source of truth (harness-builder Build Discipline §"Single
source of truth") demands one owner per fact — loop ownership is such a fact.

Two further review findings on `sxtn-harness-builder.md` recorded with this topic
(same session, unconfirmed):

1. `model: opus` defensible (it coordinates) but it MUST pass `model:` down to
   every subagent it dispatches, or it inherits opus-on-opus.
2. `description:` field is ~250 words — bloat hurts the agent trigger-matcher;
   candidate to trim to ~3 sentences.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T00:00:00Z — initial: flagged harness-builder/foreman loop-ownership overlap + 2 review findings (opus dispatch, description bloat) as OPEN, pending foreman read + Pontus decision
