---
title: "Plan — Sortie 5b hard-delete-operations-complete"
slug: sortie-5b-hard-delete-operations-complete
status: ready
revision: v1
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-5b-hard-delete-operations-complete-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0303
campaign: sortie-5-task-cutover
target_branch: feat/sortie-5-task-cutover-hard-delete-operations-complete
target_worktree: ~/dev/smartout.ai-sortie-5-task-cutover-wt-2
tags: [sortie-5b, plan, capability, task, hard-delete]
---

# Plan — Sortie 5b hard-delete-operations-complete

> Sub-sortie of campaign `sortie-5-task-cutover` (5a closed first). Closes ADR-0298 row 5 except telemetry alias drop (deferred 5c).

## Goal

Hard-delete `operations.complete_task` + migrate ~6 callers + (conditional) drop intent-classifier shim + ADR-0298 promote. Council-verified scope.

## Phases

### Phase 1 — Eval-gate

- [ ] T1.1 — Run intent-classifier eval-harness:
  ```bash
  pnpm --filter @smartout/ai exec vitest run packages/ai/src/router/__evals__/intent-classifier.eval.ts
  ```
- [ ] T1.2 — Capture per-fixture confidence + decision matrix
- [ ] T1.3 — Verdict: ≥95% across IC1-IC4 → proceed with B6 shim drop; <95% → skip B6, document in HANDOFF
- [ ] T1.4 — Commit eval report: `docs/audits/sortie-5b-intent-classifier-eval-gate.md`
- [ ] T1.5 — Commit: `docs(sortie-5b): intent-classifier eval-gate report`

### Phase 2 — Audit

- [ ] T2.1 — Write `docs/audits/sortie-5b-pre-delete-grep.md` capturing 51 grep hits + council classification table per spec §3
- [ ] T2.2 — Verify each "DO NOT TOUCH" file actually still matches the false-positive signature (no drift since council)
- [ ] T2.3 — Commit: `docs(sortie-5b): pre-delete audit + caller classification`

### Phase 3 — Web Server Action rewire (B2)

- [ ] T3.1 — Open `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts`
- [ ] T3.2 — Rewire body: replace direct UPDATE logic with `complete.execute({id, source:'session'}, ctx)` import + invocation from `@smartout/ai/capabilities/task/tools`
- [ ] T3.3 — Preserve function signature + return type + exports verbatim
- [ ] T3.4 — Update gate-action capability key reference if any drift (verify Sortie 3 already aligned via `task.complete`)
- [ ] T3.5 — `pnpm --filter web typecheck` green
- [ ] T3.6 — `pnpm --filter web test -- complete-session-task` green (existing 4 unit tests must pass)
- [ ] T3.7 — Commit: `refactor(web-actions): complete-session-task delegate to task.complete (ADR-0298)`

### Phase 4 — Capability tool delete (B3) — TYPECHECK CLIFF

- [ ] T4.1 — Open `packages/ai/src/capabilities/operations/tools.ts:257-328`
- [ ] T4.2 — DELETE `completeTask` export + body (entire block)
- [ ] T4.3 — `packages/ai/src/capabilities/operations/index.ts` — remove 3 lines (import, suggestTools entry, allTools entry)
- [ ] T4.4 — `pnpm --filter @smartout/ai typecheck` green — if FAIL, B2 had a caller miss, STOP + report
- [ ] T4.5 — `pnpm turbo typecheck` 52/52 green
- [ ] T4.6 — Commit: `feat(capabilities): hard-delete operations complete_task tool (ADR-0298 row 5b)`

### Phase 5 — Operations evals cleanup (B4)

- [ ] T5.1 — `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts` — remove lines 7, 16, 59 + `complete_task` fixture block
- [ ] T5.2 — `packages/ai/src/capabilities/operations/__evals__/operations.eval.ts:25` — update comment
- [ ] T5.3 — Run eval to verify only createDeviation fixtures remain: `pnpm --filter @smartout/ai exec vitest run packages/ai/src/capabilities/operations/__evals__/operations.eval.ts`
- [ ] T5.4 — `pnpm turbo typecheck` green
- [ ] T5.5 — Commit: `test(operations-eval): remove complete_task fixtures after hard-delete`

### Phase 6 — operations-harness-e2e A5 (B5)

- [ ] T6.1 — Delete block at `apps/e2e/tests/operations-harness-e2e.spec.ts:497-516`
- [ ] T6.2 — Verify no other test imports or depends on the deleted block
- [ ] T6.3 — Commit: `test(e2e): drop operations.complete_task A5 (superseded by task.complete)`

### Phase 7 — Intent-classifier shim drop (B6) — CONDITIONAL ON T1.3

- [ ] T7.1 — IF Phase 1 verdict was PASS: proceed; ELSE skip Phase 7 entirely + document in HANDOFF
- [ ] T7.2 — `packages/ai/src/router/tool-selector.ts` — remove `aliasTaskVerbs` function (lines 109-114) + call site (line 124)
- [ ] T7.3 — `packages/ai/src/router/__tests__/intent-classifier.test.ts` — delete IC4 test block (lines 162-208)
- [ ] T7.4 — `pnpm --filter @smartout/ai typecheck` green
- [ ] T7.5 — `pnpm --filter @smartout/ai test -- intent-classifier` green (IC1-IC3 only)
- [ ] T7.6 — Commit: `refactor(intent-classifier): drop aliasTaskVerbs shim (eval-gate green)`

### Phase 8 — Authority cleanup migration (B7)

- [ ] T8.1 — Verify migration tip: `ls supabase/migrations/ | tail -1` (expect `20260607*`)
- [ ] T8.2 — Create `supabase/migrations/20260608100000_drop_operations_complete_task_authority.sql`:
  ```sql
  DELETE FROM public.engine_authority_config
  WHERE capability = 'operations.complete_task';
  -- Idempotent: re-running yields 0 rows affected
  ```
- [ ] T8.3 — Apply locally: `npx supabase migration up` (no op run wrap)
- [ ] T8.4 — Regen types: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts 2>/dev/null`
- [ ] T8.5 — Idempotency check: re-run migration → 0 rows affected
- [ ] T8.6 — Commit: `feat(rls): drop operations.complete_task authority rows (ADR-0298)`

### Phase 9 — ADR-0298 promote + CLAUDE.md

- [ ] T9.1 — `docs/decisions/0298-task-ontology-five-sources.md` frontmatter: `status: proposed` → `status: accepted`. Append closure note at bottom.
- [ ] T9.2 — Edit `CLAUDE.md` — add "Task Ontology (ADR-0298)" section per spec §4.3
- [ ] T9.3 — Commit: `docs(adr-0298): promote to accepted + CLAUDE.md task-handling section`

### Phase 10 — Closure

- [ ] T10.1 — `docs/handoffs/HANDOFF-hard-delete-operations-complete.md` per template
- [ ] T10.2 — `docs/journeys/JOURNEY-sortie-5b-hard-delete-operations-complete.md` with `feature: hard-delete-operations-complete` + `status: verified` in frontmatter (per 5a close-feature gate learning)
- [ ] T10.3 — `docs/decisions/0303-sortie-5-task-cutover.md` (campaign closure ADR; covers 5a + 5b + 5c-pending). Register in `0000-decision-log.md`.
- [ ] T10.4 — `pnpm turbo typecheck` final green
- [ ] T10.5 — Closure commit: `docs(sortie-5b): HANDOFF + JOURNEY + ADR-0303 + ADR-0298 promote`
- [ ] T10.6 — Tell Pontus: "Sortie 5b ready for closure. Run `close-feature.sh` from wt-2 to merge into campaign."

## Acceptance criteria

- [ ] `pnpm turbo typecheck` green
- [ ] All vitest + eval green
- [ ] `operations.complete_task` tool deleted from capability + index
- [ ] `complete-session-task-action.ts` delegates to task.complete
- [ ] Operations evals cleaned (only createDeviation)
- [ ] operations-harness-e2e A5 deleted
- [ ] Intent-classifier shim dropped (if eval-gate green) OR documented as deferred
- [ ] Authority migration applied + idempotent
- [ ] ADR-0298 promoted to `accepted`
- [ ] CLAUDE.md task-handling section added
- [ ] HANDOFF + JOURNEY (with `feature:` + `status:verified` frontmatter) + ADR-0303 present
- [ ] Zero new BFF routes
- [ ] Zero toggleSessionTaskAction touches
- [ ] Zero HMS module touches
- [ ] Zero Botsson Arena `completeTask` touches
