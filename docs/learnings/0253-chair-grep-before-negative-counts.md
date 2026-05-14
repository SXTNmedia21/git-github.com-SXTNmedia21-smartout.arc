---
title: "Chair must grep before asserting negative counts on code surface"
id: L-0253
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [council, chair, code-trace, L-0147-precedent]
---

# L-0253: Chair must grep before asserting negative counts on code surface

## The Trap

System-steward (chair) Phase 3 review on 2026-05-14 asserted "0 ON CONFLICT clauses across all 20 new migrations". Supervisor Phase 3 ran the grep and verified 60 idempotency guards across the same 20 migrations. Chair's claim was an inference from briefing-text, not from code.

## Why It Happens

Briefings include enumerated facts (migration names, ADR numbers, commit counts). Chair reading the briefing infers properties from the listed items without verifying. Negative claims ("0 X" / "no Y" / "none of Z") are especially trap-prone because they sound authoritative.

## The Rule

When chair (or any reviewer) is about to assert a negative count claim on a code surface, the assertion MUST be preceded by the grep itself. Acceptable forms:
- "I ran `grep -c X migrations/*.sql` — result: 0"
- "Verified by direct file read: 0 occurrences"

Unacceptable:
- "0 ON CONFLICT clauses across the migrations" (without citation)
- "No capability tools reference this" (without grep)

## Pattern Signature (L-0147 precedent #6)

This is the 6th codified precedent of Chair Self-Reversal (L-0147):
1. Year Wheel Redesign 2026-04-20 (Trust Gate Phase 3 PASS → Phase 5 FAIL after Agent-coord code-trace)
2. /dashboard/help 2026-04-28 (Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence)
3. ADR-0216 2026-04-28 (Phase 3 Option A2 → Phase 5 Option B after Supervisor's 139-site blast-radius scan)
4. Botsson on Platform Admin 2026-04-29
5. S6 welcome-mission R4 2026-05-09
6. **Pre-Promote-Preview Pipeline 2026-05-14 (this learning)**

Pattern signature: chair operates on briefing-enumerated facts; code-tracer (typically Supervisor or system-agent-coordinator) falsifies via grep. Chair must reverse, not rationalize.

## How to Apply

In `/run-council` Phase 3 (when chair drafts review): any claim of form "0 / no / none / zero" against code MUST be preceded by the grep command + result. If chair cannot run grep at review time, state the claim as "expected: 0" instead and assign the verification to a code-tracer reviewer.

In Phase 5 (synthesis): if Supervisor or agent-coord produces a count that contradicts chair's negative claim, chair MUST classify Phase 3 as REVERSED (not REFINED, not HELD-with-conditions) per L-0147 hard rule.

## Cross-references

- L-0147 (Chair Self-Reversal Protocol — parent)
- `/run-council` Phase 5 §1.5 hard rule
- ADR-0323 Pre-Promote-Preview Council Protocol (parent council)
