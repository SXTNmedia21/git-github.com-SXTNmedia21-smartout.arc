---
title: "Global scripts are not owned by the campaign that refactors them"
id: LEARNING_0098
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [cutover, global-scripts, ownership, edge-functions]
---

# Learning-0098: Global scripts are not owned by the campaign that refactors them

## Context

`supabase/functions/journey-stuck-detector/index.ts` has hardcoded constants: `PROCESS_ID = "journey_03_check_shifts"`, step 2, 24h threshold. Spec v1.6.0 proposed to generalize the detector to read configuration from a table so multiple journeys could share it. No migration plan, no cutover ordering, no consumer-of-truth swap.

Global Edge Functions like this one are called from multiple execution paths (cron, webhooks, engine dispatch). The campaign refactoring a global script owns the refactor but does not own the consumers. Removing the hardcoded constants without sequencing the consumer swap breaks every live caller until the config table is populated.

## Discovery

Global scripts create false ownership. The file lives in `supabase/functions/` which looks campaign-neutral — but the assumptions baked into its constants (which journey, which step, which threshold) are owned by whichever campaign originally wrote it. When a different campaign wants to generalize, the original assumptions are load-bearing for production cron jobs.

Cutover requires three ordered steps:

1. Introduce the config table + seed the current hardcoded values.
2. Swap the Edge Function to read the config table, fallback to the hardcoded values if the table is empty.
3. Remove the hardcoded fallback only after verifying the table has entries for every live consumer.

Missing any step breaks production silently — cron runs, the detector returns nothing, nobody notices until a journey actually gets stuck.

## Impact

- Every spec that modifies `supabase/functions/*` must include a three-step cutover plan.
- Briefings for Edge Function changes must include: *"List every scheduled cron, webhook, or engine process that calls this function. Verify each still works after the change."*
- Promote to a general rule: "Generalizing a hardcoded script is a migration, not a refactor. Ship in stages."

## References

- ADR-0174 (ADR-0074 unification completion) — JourneyIR retargeting is similar scope; also needs ordered cutover for existing protocol generators.
- L-0061 (orphan capability code invisible until engine_trigger wires it) — adjacent failure class for the inverse (capability live but unwired).
- L-0078 (PLAN-file decay) — adjacent failure class for silent drift between docs and code.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
