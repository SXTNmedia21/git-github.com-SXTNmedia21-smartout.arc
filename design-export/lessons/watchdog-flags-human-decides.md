---
topic: watchdog-flags-human-decides
status: active
updated: 2026-05-31T16:30:00Z
created: 2026-05-31T16:30:00Z
supersedes:
---

# Decision lesson — watchdog-flags-human-decides

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

A monitoring/watchdog harness **surfaces and proposes — it does not auto-fix.** The contract is: watchdog flags → orchestrator surfaces the finding + proposes a fix → orchestrator **WAITS for the human's explicit decision** → only then act. Confirming an _observation_ ("yes, the dashboard shows STALLED") is NOT authorization to _act_ on it. Do not infer a fix-approval from an acknowledgement of the problem.

**Confident ≠ authorized** (C4 authority). Being sure a fix is correct does not grant permission to execute it unprompted. When the user has explicitly scoped the work to "catch and double-check with me, don't fix," dispatching the fix — however right — is an override.

## Why

Pontus, 2026-05-31: after he set the harness up as "fang og dobbeltsjekk med meg, ikke en fikse-jobb," I treated his confirmation of the drift as a green light, dispatched fixes to both the dashboard and the watchdog, and closed the loop myself. His correction: "men du må ikke overstyre." The whole point of a human-in-the-loop harness is that the human holds the decision at the checkpoint; an orchestrator that auto-resolves removes the checkpoint and defeats the harness. This is the same boundary the product itself encodes (Mr. Botsson: autonomous enough to act, but governed by C4 — "selvsikker ≠ autorisert"). Default to proposing and waiting; act only on explicit go. When unsure whether an ack is authorization, ask.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T16:30:00Z — initial: watchdog surfaces + proposes, never auto-fixes; confirming an observation ≠ authorizing a fix; confident ≠ authorized (C4); when the user scoped work to "catch + check with me," dispatching the fix is an override even if correct.
