---
title: "Schema-deletion plans require full-codebase grep before vote"
id: LEARNING_0155
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [council, blast-radius, scope-failure, chair-failure-mode, schema-deletion]
---

# Learning-0155: Schema-deletion plans require full-codebase grep before vote

## Context

ADR-0216 council 2026-04-28 — chair (Steward) voted Phase 3 for Option A2 (capabilities write `engine_sessions`, drop `engine_state`) on the premise that "engine_state has zero stage-engine readers, so it's already phantom — Option A formalizes reality." Phase 3 grep was scoped to `services/stage-engine/` only and returned zero hits, confirming the premise.

Phase 5 reversal: Supervisor's full-codebase scan found **139 production sites across 8 unrelated cascade domains** reading or writing `engine_state`:

- `apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts` (9 sites, ADR-0160)
- `apps/web/src/app/dashboard/komm/_hooks/use-channel-helpdesk-flags.ts` + `useMinKo.ts`
- `apps/web/src/app/dashboard/komm/thread/[channelId]/_actions/resolve-ticket.ts`
- `apps/mobile/src/hooks/queries/use-my-queue.ts` + `use-swap-requests.ts` + `use-ticket.ts`, `mutations/use-resolve-ticket.ts`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts` (ADR-0091)
- `apps/web/src/app/api/employment-contracts/[id]/send/route.ts` (ADR-0076)
- `apps/web/src/app/platform-admin/billing/_actions/integrations/loadIntegrationSyncHistory.ts`
- `supabase/functions/journey-stuck-detector/index.ts`
- `supabase/functions/engine-dispatch/index.ts` + handlers
- 9 schema migrations baking on engine_state

`engine_state` is the **canonical Event Engine universal workflow runtime** per CLAUDE.md "Cascade Core Model" — not a journey-only artifact. The "phantom" framing was structurally wrong.

## Discovery

When a chair votes on a schema-deletion plan, the relevant question is NOT "does the plan's claimed consumer exist?" but "what is the full set of producers AND consumers of the schema being deleted?" Scoped greps produce false reassurance. The pattern:

1. Briefing presents schema X as "underused" / "phantom" / "already gone"
2. Chair greps the claimed-empty consumer set, finds emptiness
3. Chair confirms premise without checking the producer side or unrelated consumers
4. Phase 5 reveals N unrelated domains reading X
5. Chair reverses

**The misframing is structural, not careless.** The briefing language ("phantom surface already") shifts the burden of proof from "prove X is unused" to "prove X is used." Reversing this proof burden requires a full-codebase grep, not a scoped one.

## Impact

**Hard rule for chair (run-council Phase 3):** Before voting on any plan to drop, deprecate, or collapse a schema element (table, column, enum, FK, type), chair MUST run:

```bash
rg -n "<schema_name>" apps/ packages/ services/ supabase/ 2>/dev/null | wc -l
rg -ln "<schema_name>" apps/ packages/ services/ supabase/ 2>/dev/null
```

Report site count + domain breakdown in Phase 3 vote. If site count > 5 OR spans >2 domains, treat as Event-Engine-class artifact and require Phase 5 architecture review.

**Briefing rule:** Phase 2 briefing-author must include "Blast radius scan: N sites across M domains" for any schema element flagged for deletion. Briefing without this scan is incomplete.

**Council reviewer guidance:** when reviewing a deletion plan, ask "did the briefing run a full-codebase grep?" If no, mark Phase 2.5 fact-check as INCOMPLETE — block Phase 3 dispatch until scan runs.

## References

- ADR-0216 (engine_state vs engine_sessions ontology — Option B accepted)
- L-0146 (phantom-consumer pattern — distinct from "phantom table" misframing)
- L-0094 (phantom-emit pattern)
- L-0147 (chair self-reversal pattern, 3rd occurrence)
- Council 2026-04-28 Phase 5 synthesis
- CLAUDE.md "Cascade Core Model" — Event Engine canonical definition

---
