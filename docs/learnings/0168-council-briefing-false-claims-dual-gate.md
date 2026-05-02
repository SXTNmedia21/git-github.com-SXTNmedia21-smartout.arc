---
title: "Council Briefing False-Claim Pattern (6th Occurrence)"
id: LEARNING_0168
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [council, audit, briefing, fact-check, recurring-pattern]
---

# Learning-0163: Council Briefings Repeatedly Embed False Claims (6th Occurrence)

## Context

2026-04-28 dual-gate reconciliation council. Phase 2.5 fact-check + Phase 3 supervisor review caught **3 false claims** in the orchestrator-authored briefing:

1. "Server Actions call only `cascade_gate_write`" — wrong. 4 reconciliation actions in `apps/web/src/app/dashboard/reconciliation/_actions/*-action.ts:15-18` cite `gate_action` in JSDocs.
2. "5 capability families call only `gate_action`" — wrong. `journey/tools.ts` has 7 direct writes (`:239,242,461,497,503,991,994`) bypassing **both** gates.
3. "Per-surface channel defaults claimed in `journey/gate.ts:13-17` are load-bearing" — wrong. Code is byte-identical to `shift-lifecycle/gate.ts`; the JSDoc claim is aspirational.

Plus the Phase 2.5 fact-check itself caught:
4. Migration list omitted `20260512100100_assert_gate_caller.sql` (the helper function — separate from `20260512100200_cascade_gate_write_assert.sql`).
5. `mission-resolution.ts` listed as `gate_action` caller — false grep result.

Briefing was authored by orchestrator from STATE-SUMMARY P0 #4 entry which itself summarized prior council notes from 2026-04-16 + 2026-04-18.

## Discovery

This is the **6th documented occurrence** of council-briefing false claims (per `council_meta.md` and prior learnings — promoted to SKILL.md hard rule on 5th occurrence per Phase 9 Step 4):

- 2026-04-13 entity-drawer (mobile telemetry "broken" was false)
- 2026-04-15 Botsson can't read schedules (false)
- 2026-04-16 Web Perf (audit-inflation pattern — L-0050)
- 2026-04-18 Wave 2A (briefing claimed paths that didn't exist — L-0058 grep-count inflation)
- 2026-04-19 helpdesk (council scope partially fictional)
- 2026-04-28 dual-gate reconciliation (this session — 5 false claims)

Pattern signature: **briefings authored from STATE-SUMMARY summaries decay because STATE-SUMMARY itself is a snapshot of prior council outputs.** Each generation adds drift. By the 4th hop (council N → STATE-SUMMARY → STATE-SUMMARY rewrite → briefing for council N+1), the original code-grounded claims are 30%+ false.

Phase 2.5 fact-check catches them, but the cost is non-trivial: a re-briefing round before Phase 3 dispatch.

## Impact

1. **Phase 2.5 fact-check is non-negotiable**: any council touching code paths must run the fact-check gate before Phase 3 reviewer dispatch. Already mandatory in run-council SKILL.md; this is the 6th occurrence so the gate proves its value.
2. **STATE-SUMMARY hygiene**: when ADRs close P0 items, the STATE-SUMMARY entry must be marked RESOLVED in the same commit (not as a follow-up). Deferred resolution = stale-claim seeding for next council. This council closed P0 #2 + #3 in commit `22f3f575`; this learning closes P0 #4 (dual-gate reconciliation).
3. **Briefing source-of-truth rule**: orchestrator authoring a briefing from STATE-SUMMARY must explicitly cite the underlying ADR/migration/file:line for each load-bearing claim. If the citation is "see council 2026-MM-DD", the orchestrator must spend 5 minutes verifying that prior council's verdict still holds against current code before pasting.
4. **Promote-to-SKILL.md candidate**: this is the 6th occurrence. The promotion already happened at occurrence 5 (Phase 2.5 fact-check is mandatory). Next promotion threshold: occurrence 9 — promote "briefing must contain side-by-side parameter tables for any dual-RPC topic" and "STATE-SUMMARY entries MUST cite verifiable file:line for every claim".

## References

- L-0050 (audit-inflation pattern)
- L-0058 (grep-count vs reality)
- L-0156 (Phase 2.5 briefing accuracy gates)
- run-council SKILL.md Phase 2.5 (mandatory fact-check)
- Council sessions: 2026-04-13, 2026-04-15, 2026-04-16, 2026-04-18, 2026-04-19, 2026-04-28
- Phase 9 Step 4 (promote pattern after 3+ recurrences) — already executed at occurrence 5

> After writing: register in `docs/learnings/0000-learning-log.md`.
