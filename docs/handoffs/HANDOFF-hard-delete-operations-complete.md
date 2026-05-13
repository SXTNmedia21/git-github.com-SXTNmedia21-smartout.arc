---
title: "Sortie 5b — hard-delete-operations-complete HANDOFF"
slug: hard-delete-operations-complete
status: done
revision: v1
layer: handoff
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0303
campaign: sortie-5-task-cutover
related_sorties: [Sortie-3 (ADR-0301), Sortie-4 (ADR-0302), Sortie-5a]
target_branch: feat/sortie-5-task-cutover-hard-delete-operations-complete
tags: [sortie-5b, handoff, capability, task, hard-delete]
---

# Sortie 5b — HANDOFF: hard-delete-operations-complete

## Summary

Sortie 5b closes ADR-0298 row 5: the `operations.complete_task` tool is deleted, all 6 council-verified callers are migrated to `task.complete`, the orphaned authority rows are dropped from `engine_authority_config`, and ADR-0298 is promoted `proposed → accepted`.

The pre-delete council audit identified 51 grep hits across the codebase. After classification, 17 files had real call-sites; 6 were direct callers requiring migration (all others were comments, tests of the tool itself, or intent-classifier references covered by the existing `aliasTaskVerbs` shim). All 6 callers migrated cleanly:

- `apps/web/src/actions/complete-session-task.ts` — Server Action rewritten to delegate to `task.complete.execute({id, source:'session'}, ctx)` instead of direct `gate_action` + UPDATE.
- `services/voice-agent/src/tools-task.ts` — voice thin-wrapper already pointed at `task.complete`; verified clean (Sortie 5a).
- `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` — BFF already routes to `task.complete`; no change needed.
- `packages/ai/src/evals/operations.eval.ts` — `complete_task` eval fixture removed; only `createDeviation` fixtures remain.
- `apps/e2e/botsson-harness/A5-operations-complete.spec.ts` — E2E spec removed (skipped block after capability deletion).
- `packages/ai/src/capabilities/operations/index.ts` + `tools.ts` — `completeTask` tool deleted; `operations` capability now exposes 1 tool (`createDeviation`).

The `operations` capability remains registered and functional. Only the `complete_task` action is gone.

## Decisions

**D1 — `completeSessionTaskAction` delegates to `task.complete.execute()`**

The Server Action no longer owns the gate or the UPDATE. It calls `complete.execute({id, source:'session'}, ctx)` which handles gate_action + emit + UPDATE internally per ADR-0099 + ADR-0134. Pattern: thin Server Action + thick capability tool body. No dual-gate risk (ADR-0204 reconciliation not required here — single gate path).

**D2 — `operations` capability retains `createDeviation` tool; capability stays registered**

Deleting the capability entirely would require an intent-classifier enum change and a registry removal. The capability is retained with 1 tool. This is a deliberate minimisation of blast radius — operations intelligence surface will grow again (D7 production deviations).

**D3 — Authority cleanup via migration `20260608130000`**

`engine_authority_config` rows for `capability='operations.complete_task'` deleted via dedicated migration. Idempotent (DELETE 0 on re-run). Migration applied and verified locally (count=0 before and after).

**D4 — ADR-0298 promoted `proposed → accepted`**

All 5 sortie rows of the campaign now shipped (Sorties 1-4 + 5a + 5b). Outstanding deferred items recorded in ADR-0298 Closure section; they do not block acceptance.

**D5 — CLAUDE.md task-handling section added**

Task Ontology (ADR-0298) section inserted under Data Model in `CLAUDE.md`. Five-source table + capability tool inventory + channel policy + BFF routes captured as quick-reference for future sessions.

## Learnings

**L1 — Stop-hook stale snapshot fires mid-edit (reconfirmed, 6th occurrence this session)**

The pre-push typecheck hook runs on file-save-triggered edits. When `tools.ts` was edited to delete `completeTask` but `index.ts` had not yet been saved with the updated export list, the hook captured an intermediate broken state and surfaced a TS error. Error resolved on the next save without intervention. Pattern: the hook is aggressive about catching real errors but produces false positives during multi-file atomic edits. Do not abort mid-edit when the hook fires — wait for both files to reach consistent state before diagnosing.

**L2 — Council false-positive rate ~30% for grep-based pre-delete audits**

51 grep hits → 17 files with real content → 6 actual callers requiring migration. The remaining ~35 hits were: comments, docstrings, eval fixtures testing the tool itself, E2E specs covering the tool, and intent-classifier enum references managed by the `aliasTaskVerbs` shim. Pre-delete council audit remains valuable (it caught the evals + E2E spec as explicit cleanup targets) but the ratio of false positives is high enough that a structured classification step (rather than naive hit count) is needed before estimating migration scope.

**L3 — Phase 7 (shim drop) deferred due to OPENROUTER_API_KEY unavailable in agent env**

The eval-gate script requires `OPENROUTER_API_KEY` to run the intent-classifier accuracy check. The key is in 1Password (`op://smartout_ai/openrouter/api-key`) but was not available in the CI agent environment (agent sessions run without `op run` wrap). The shim (`aliasTaskVerbs` at `tool-selector.ts:109-114`) remains live. Rerun manually with the key present; if IC1-IC4 accuracy ≥95%, drop shim in follow-on sortie.

## Known Issues / Debt

| ID | Issue | Owner | Deadline |
|---|---|---|---|
| D-SHIM | `aliasTaskVerbs` shim live in `tool-selector.ts:109-114` | harness-builder | Sortie 5c (manual eval-gate) |
| D-IC4 | `intent-classifier.test.ts:162-208` asserts shim behavior | harness-builder | Same as D-SHIM |
| D-ALIAS | 30-day telemetry alias `task.added_manual` | harness-builder | 2026-06-12 (Sortie 5c) |
| D-HMS | `useCompleteTask` direct-supabase in HMS module | tbd | Separate sortie (ADR-0287) |
| D-EMMA | `completeTask` in Emma in-memory list (unrelated entity) | harness-builder | ADR addendum if naming ambiguity causes confusion |

## Next Steps

1. **Sortie 5c (2026-06-12):** Write ADR-0304 alias cutover. Delete `task.added_manual` telemetry alias row. Update `registry.ts` to remove the alias path.
2. **Optional shim-drop sortie:** When OPENROUTER_API_KEY available, run `scripts/eval-gate-intent-classifier.ts` manually. If IC1-IC4 accuracy ≥95%, drop `aliasTaskVerbs` shim + IC4 test block in a focused sortie.
3. **HMS direct-supabase migration:** File a separate sortie for `useCompleteTask` → `task.complete` migration per ADR-0287. Scope: replace the direct Supabase client call in the HMS module with a BFF route that delegates to the capability tool.
