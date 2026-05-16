---
title: "Sortie 5b — Hard Delete operations.complete_task (Design Spec)"
slug: sortie-5b-hard-delete-operations-complete
status: ready
revision: v1
layer: spec
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0298
sortie_adr_reserved: ADR-0303
related_sorties: [Sortie-3 (ADR-0301), Sortie-4 (ADR-0302), Sortie-5a]
campaign: sortie-5-task-cutover
tags: [sortie, spec, capability, task, operations, hard-delete, ADR-0298]
---

# Sortie 5b — Hard Delete operations.complete_task (Design Spec)

## 1. Goal

Hard-delete `operations.complete_task` capability tool + migrate ~6 call sites to canonical `task.complete` path. Drop `aliasTaskVerbs` intent-classifier shim (subject to eval-gate). Update CLAUDE.md task-handling section (ADR-0298 line 273 mandate). Promote ADR-0298 `proposed` → `accepted` (4/5 sorties done; alias drop deferred to 5c).

## 2. Non-goals

- toggleSessionTaskAction migration — bi-directional toggle, task.complete is one-way. Out of scope per council.
- HMS module useCompleteTask migration — direct Supabase path, ADR-0287 violation, separate sortie.
- BotssonProvider/Arena/Tools `completeTask` references — Emma in-memory task list, different entity, DO NOT TOUCH.
- New web BFF route `/api/web/tasks/[id]/complete` — Server Action is canonical write surface per ADR-0114.
- Drop `task.added_manual` telemetry alias — 30-day clock not expired (deferred 5c, 2026-06-12).
- Voice e2e Playwright — covered by 5a unit tests; full LiveKit harness future.
- Real voice path retest after intent-classifier shim drop — eval-harness suffices.

## 3. Canonical reality (locked 2026-05-13 post-council)

True migration surface = **~6 files**, not 17. Council triangulation:

| File | Hits | Class | Action |
|---|---|---|---|
| `packages/ai/src/capabilities/operations/tools.ts:257-328` | 1 (definition) | A | **DELETE** completeTask export |
| `packages/ai/src/capabilities/operations/index.ts:10,18,25` | 3 (registration) | A | **DELETE** 3 entries; operationsCapability shrinks to createDeviation only |
| `packages/ai/src/capabilities/operations/gate.ts` | 1 (shared helper) | D | Keep — still used by createDeviation |
| `packages/ai/src/capabilities/operations/__evals__/operations.eval.ts:25` | 1 (comment) | D | Remove `complete_task` mention |
| `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts:7,16,59` | 3 (eval fixtures) | A | **DELETE** complete_task fixtures + comments |
| `apps/e2e/tests/operations-harness-e2e.spec.ts:497-516` | A5 skipped test | A | Delete or move to task harness |
| `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts` | (still references operations gate-action key?) | A | Verify gate-action capability key is `task.complete` not `operations.complete_task`; rewire body to delegate to `complete.execute({id, source:'session'}, ctx)` like Sortie 3 add-task pattern |
| `packages/ai/src/router/tool-selector.ts:109-114+124` | aliasTaskVerbs shim | A | **DELETE** shim — but only if eval-gate passes (see §4.1) |
| `packages/ai/src/router/__tests__/intent-classifier.test.ts:162-208` | IC4 shim test | A | DELETE IC4 test block (shim gone) |

False positives (DO NOT TOUCH):
- `apps/web/src/app/dashboard/_actions/toggle-session-task-action.ts` — bi-directional toggle, supports "Gjenåpne"
- `apps/web/src/components/day/EventDetailPanel.tsx` + `TasksTab.tsx` — toggle UI
- `apps/web/src/app/Botsson/_components/{BotssonProvider,BotssonArena,BotssonTools}.{tsx,ts}` — Emma in-memory list
- `apps/web/src/app/dashboard/hms/**` — HMS direct-supabase bypass, separate sortie
- `apps/mobile/src/lib/sync/{action-map,types,schemas}.ts` — already BFF-path, action name `complete_task` is queue-key (not tool name)
- `services/stage-engine/src/core/operations-evaluator.ts:299` — `incompleteTasks` count field (not tool ref)
- `supabase/functions/ops-monitor/index.ts:365` — `incomplete_tasks` field name
- `packages/ai/src/capabilities/communication/compile-preclose.ts:42,75,77` — local variable

Eval-gate trigger: `aliasTaskVerbs` shim drop blocks on intent-classifier accuracy ≥95% across the 4 task fixtures (IC1-IC4) in `packages/ai/src/router/__evals__/fixtures/intent-seed.ts:97-127`. Run eval first; if fail, defer shim drop to a future sortie (alone), continue rest of 5b.

## 4. Architecture

### 4.1 Eval-gate first (Phase 1)

- Run `pnpm vitest run packages/ai/src/router/__evals__/intent-classifier.eval.ts` with `OPENROUTER_API_KEY` set.
- Assert ≥95% accuracy across IC1-IC4 (4 fixtures, minimum confidence 0.7-0.75).
- If pass → proceed with shim drop. If fail → skip shim drop in 5b; flag for separate sortie; HANDOFF documents gate failure.

### 4.2 Migration order

Strict sequencing — typecheck cliff at the delete step:

1. **B1 audit doc** — `docs/audits/sortie-5b-pre-delete-grep.md` capturing all 51 hits with classification (council-verified table from §3).
2. **B2 web Server Action rewire** — `complete-session-task-action.ts` body delegates to `complete.execute({id, source:'session'}, ctx)`. Mirror Sortie 3 `add-task-action.ts:89` pattern. Keep file exports identical. Verify gate-action capability key in body matches what `task.complete` body expects (likely already aligned via Sortie 3 — verify).
3. **B3 capability tool delete** — Remove `completeTask` export from `operations/tools.ts:257-328`. Remove 3 lines in `operations/index.ts:10,18,25`. operationsCapability now has 1 tool (createDeviation).
4. **B4 operations evals cleanup** — Remove complete_task fixtures from `operations-seed.ts:7,16,59`. Update `operations.eval.ts:25` comment. Eval suite should still PASS after — only createDeviation fixtures remain.
5. **B5 operations-harness-e2e A5** — Delete the skipped block at `operations-harness-e2e.spec.ts:497-516` (already `.skip()`'d — clean removal).
6. **B6 intent-classifier shim drop (conditional on §4.1 pass)** — Remove `aliasTaskVerbs` function from `tool-selector.ts:109-114`. Remove the call site at `:124`. Delete IC4 test block in `intent-classifier.test.ts:162-208`.
7. **B7 authority cleanup migration** — `supabase/migrations/20260608100000_drop_operations_complete_task_authority.sql`:
   ```sql
   DELETE FROM public.engine_authority_config 
   WHERE capability = 'operations.complete_task';
   COMMENT ON TABLE public.engine_authority_config IS '...';
   ```
   Idempotent — DELETE is by definition.

### 4.3 CLAUDE.md task-handling section (ADR-0298 line 273)

Add section to `/home/sxtnl/dev/smartout.ai-wt-2/CLAUDE.md`:

```markdown
## Task Ontology (ADR-0298)

Five sources, one read surface, one capability:

| Source | Table | Cascade Role | Actor |
|---|---|---|---|
| `session` | `session_task` | D6 Production | cron + manager + agent |
| `day_ad_hoc` | `schedule_day_task` | D6 Production | manager |
| `personal` | `personal_task` | C2 Agent-Utility | user via agent |
| `emma` | `emma_task` | C2 Agent-Utility | Botsson auto |
| `runtime` | `engine_state_step` | C2 Workflow Runtime | engine-dispatch (NEVER user-task) |

- **Read:** `fn_list_my_tasks` RPC unions 4 sources (engine_state_step excluded per R2).
- **Write:** `task` capability — 6 tools (`list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`).
- **Channel:** chat + voice for `list_mine` + `complete`. Chat-only V1 on `create_*` + `cancel_personal` (R6, PII risk).
- **Voice surface:** `services/voice-agent/src/tools-task.ts` mirrors capability (6 typed thin tools).
- **BFF route (mobile):** `/api/mobile/tasks/[id]/complete` (POST) + `/api/mobile/tasks/personal` (POST).
- **Server Action (web):** `addTaskAction` + `completeSessionTaskAction` (delegate to task tools).
- Do NOT use `operations.complete_task` — superseded by `task.complete` (Sortie 5b 2026-05-13).
```

### 4.4 ADR-0298 promote

- Update `docs/decisions/0298-task-ontology-five-sources.md` frontmatter `status: proposed` → `status: accepted`. Append closure note.

## 5. Test surface

- `pnpm turbo typecheck` — 52/52 green after each phase (typecheck-cliff at B3).
- `pnpm --filter @smartout/ai test -- task` — existing 16 cases stay green.
- `pnpm --filter @smartout/ai test -- intent-classifier` — IC1-IC3 stay green; IC4 deleted.
- `pnpm --filter @smartout/ai test -- operations` — only createDeviation fixtures remain.
- `npx supabase migration up` + `db reset` cycle — B7 migration applies clean + idempotent.

## 6. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Typecheck cliff at B3 (delete capability tool) | B2 (Server Action rewire) MUST complete + green-typecheck BEFORE B3. Eval coverage stays green after B4. |
| Eval-gate fails (intent-classifier < 95% on task fixtures) | Skip B6 (shim drop). Document in HANDOFF. Shim continues to operate. |
| Migration `20260608100000_drop_operations_complete_task_authority.sql` timestamp ordering | Verify > current tip via `ls supabase/migrations/ \| tail -1`. Repo currently at `20260607*`. Pick `20260608100000`. |
| `complete-session-task-action.ts` body change breaks caller | Server Action signature unchanged. Body delegates to tool. Callers (toggleSessionTaskAction etc) unaffected. |
| Council false-negative — agent finds new caller during execution | Stop, report, decide: scope expand OR defer file to separate sortie. |
| Botsson Arena `completeTask` ref accidentally migrated | Spec §3 explicit DO NOT TOUCH list — agents must respect. |

## 7. Escalation

Council escalation required only if:
- Eval-gate fails — escalate before deciding shim defer vs full block.
- New caller discovered not in §3 council-verified list — escalate before touching.
- ADR-0298 promote blocked by missing deliverable — escalate.

## 8. References

- ADR-0298 (5-source task ontology) — row 5 closure
- ADR-0287 (gate_action mandatory)
- ADR-0288 (voice channel policy split)
- ADR-0114 (Server Actions canonical)
- ADR-0298 line 273 (promote contract)
- Council 2026-05-13 (4× APPROVE WITH CHANGES — code-reviewer + steward + agent-coordinator + supervisor)
- L-0042 (migration timestamp ordering)
- L-0207 (ADR ID squat check)
- Sortie 3 HANDOFF (task capability + create_session wrapper pattern)
- Sortie 5a HANDOFF (voice tools-task.ts shipped)
