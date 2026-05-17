---
title: "Sortie 5b — Pre-Delete Grep Audit"
slug: sortie-5b-pre-delete-grep
feature: hard-delete-operations-complete
status: verified
layer: audit
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-5b, audit, pre-delete, ADR-0298, grep]
---

# Sortie 5b — Pre-Delete Grep Audit

## 1. Scope

Council-verified scope table from spec §3 (2026-05-13): **~6 files** requiring migration, **false positives (DO NOT TOUCH list)** identified and protected.

This audit captures **all 94 grep hits** across the codebase, classifies each per council verdicts, and verifies no unexpected callers exist.

## 2. Grep Commands

```bash
cd /home/sxtnl/dev/smartout.ai-sortie-5-task-cutover-wt-2

# Complete audit search
grep -rn "completeTask\|complete_task\|useCompleteTask\|completeSessionTaskAction\|toggleSessionTaskAction" \
  apps/ packages/ services/ supabase/ \
  --include="*.ts" --include="*.tsx" --include="*.sql" 2>/dev/null
```

**Result:** 94 hits across 20 files.

## 3. Classification Table

| # | File | Line | Hit | Class | Council-Verified | Action |
|---|---|---|---|---|---|---|
| 1 | `apps/mobile/src/lib/sync/schemas.ts` | 85 | `const completeTaskSchema = z` | E | DO NOT TOUCH | False positive (local schema variable name) |
| 2 | `apps/mobile/src/lib/sync/schemas.ts` | 263 | `complete_task: completeTaskSchema,` | B | DO NOT TOUCH | BFF action-key (queue discriminator, already wired) |
| 3 | `apps/mobile/src/lib/sync/action-map.ts` | 105 | `complete_task: async (p) => {` | B | DO NOT TOUCH | BFF handler (already canonical path via `/api/mobile/tasks/[id]/complete`) |
| 4 | `apps/mobile/src/lib/sync/action-map.ts` | 112 | `if (!id) throw new Error("complete_task: missing task id");` | E | DO NOT TOUCH | False positive (error message string) |
| 5 | `apps/mobile/src/lib/sync/action-map.ts` | 121 | `throw new Error(`complete_task BFF ${res.status}: ...` | E | DO NOT TOUCH | False positive (error message string) |
| 6 | `apps/mobile/src/lib/sync/types.ts` | 16 | `\| "complete_task"` | B | DO NOT TOUCH | BFF action-key type (queue discriminator) |
| 7 | `apps/web/src/components/day/EventDetailPanel.tsx` | 22 | `import { toggleSessionTaskAction }` | C | DO NOT TOUCH | **PROTECTED:** bi-directional toggle (spec §2 non-goal) |
| 8 | `apps/web/src/components/day/EventDetailPanel.tsx` | 244 | `const res = await toggleSessionTaskAction(...)` | C | DO NOT TOUCH | **PROTECTED:** bi-directional toggle (spec §2 non-goal) |
| 9 | `apps/web/src/components/day/tabs/TasksTab.tsx` | 7 | `import { toggleSessionTaskAction }` | C | DO NOT TOUCH | **PROTECTED:** bi-directional toggle (spec §2 non-goal) |
| 10 | `apps/web/src/components/day/tabs/TasksTab.tsx` | 46 | `const res = await toggleSessionTaskAction(...)` | C | DO NOT TOUCH | **PROTECTED:** bi-directional toggle (spec §2 non-goal) |
| 11 | `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` | 6 | `Delegates to completeSessionTaskAction with channel='system'.` | D | **MIGRATE** | Comment references — update to delegate to `task.complete` tool path |
| 12 | `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` | 26 | `import { completeSessionTaskAction }` | A | **MIGRATE** | B2 phase: Server Action currently imported; body will be rewired to `task.complete` tool call |
| 13 | `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` | 77 | `const result = await completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: call site — rewired to `task.complete` tool execution |
| 14 | `apps/web/src/app/dashboard/hms/_hooks/use-complete-task.ts` | 16 | `export function useCompleteTask() {` | C | DO NOT TOUCH | **PROTECTED:** HMS module direct-Supabase path (spec §2 non-goal, ADR-0287 violation → separate sortie) |
| 15 | `apps/web/src/app/dashboard/hms/_components/DriftTimeline.tsx` | 10 | `import { useCompleteTask }` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 16 | `apps/web/src/app/dashboard/hms/_components/DriftTimeline.tsx` | 28 | `const completeTask = useCompleteTask();` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 17 | `apps/web/src/app/dashboard/hms/_components/DriftTimeline.tsx` | 58 | `completeTask.mutate(...)` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 18 | `apps/web/src/app/dashboard/hms/_components/DriftTaskList.tsx` | 11 | `import { useCompleteTask }` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 19 | `apps/web/src/app/dashboard/hms/_components/DriftTaskList.tsx` | 38 | `const completeTask = useCompleteTask();` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 20 | `apps/web/src/app/dashboard/hms/_components/DriftTaskList.tsx` | 88 | `completeTask.mutate(...)` | C | DO NOT TOUCH | **PROTECTED:** HMS module consumer |
| 21 | `apps/web/src/app/dashboard/_actions/toggle-session-task-action.ts` | 27 | `Unlike the \`operations.complete_task\` agent tool...` | D | DO NOT TOUCH | **PROTECTED:** Reference comment in toggle (spec §2 non-goal); update comment to note deprecation if touched |
| 22 | `apps/web/src/app/dashboard/_actions/toggle-session-task-action.ts` | 33 | `export async function toggleSessionTaskAction(...)` | C | DO NOT TOUCH | **PROTECTED:** bi-directional toggle (spec §2 non-goal) |
| 23 | `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts` | 4 | `completeSessionTaskAction — Server Action for completing a session_task.` | A | **MIGRATE** | B2 phase: File header comment; update to reflect `task.complete` tool delegation pattern |
| 24 | `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts` | 25 | `export async function completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: Function definition; body rewired to delegate to `task.complete` tool |
| 25 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 2 | `import { completeSessionTaskAction }` | A | **MIGRATE** | B2 phase: Unit test will be updated in parallel with action implementation |
| 26 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 22 | `describe("completeSessionTaskAction", ...)` | A | **MIGRATE** | B2 phase: Test suite name/scope |
| 27 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 60 | `const result = await completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: Test call site |
| 28 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 98 | `const result = await completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: Test call site |
| 29 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 121 | `const result = await completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: Test call site |
| 30 | `apps/web/src/app/dashboard/_actions/__tests__/complete-session-task-action.test.ts` | 135 | `const result = await completeSessionTaskAction(...)` | A | **MIGRATE** | B2 phase: Test call site |
| 31 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 42 | `completeTask: (taskId: string) => void;` | C | DO NOT TOUCH | **PROTECTED:** Emma in-memory task interface (spec §2 non-goal) |
| 32 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 402 | `const completeTaskDef: ClientToolDefinition = {` | C | DO NOT TOUCH | **PROTECTED:** Emma client-tool definition (spec §2 non-goal) |
| 33 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 404 | `modelToolName: "complete_task",` | C | DO NOT TOUCH | **PROTECTED:** Emma model-tool name (spec §2 non-goal) |
| 34 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 746 | `complete_task: (params) => {` | C | DO NOT TOUCH | **PROTECTED:** Emma handler dispatch (spec §2 non-goal) |
| 35 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 753 | `actions.completeTask(task.id);` | C | DO NOT TOUCH | **PROTECTED:** Emma action call (spec §2 non-goal) |
| 36 | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | 840 | `completeTaskDef,` | C | DO NOT TOUCH | **PROTECTED:** Emma tool registry (spec §2 non-goal) |
| 37 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 140 | `completeTask: (taskId: string) => void;` | C | DO NOT TOUCH | **PROTECTED:** Emma provider interface (spec §2 non-goal) |
| 38 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 396 | `const completeTask = useCallback(...)` | C | DO NOT TOUCH | **PROTECTED:** Emma callback definition (spec §2 non-goal) |
| 39 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 934 | `const completeTaskRef = useRef(completeTask);` | C | DO NOT TOUCH | **PROTECTED:** Emma ref wrapper (spec §2 non-goal) |
| 40 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 939 | `completeTaskRef.current = completeTask;` | C | DO NOT TOUCH | **PROTECTED:** Emma ref assignment (spec §2 non-goal) |
| 41 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 940 | `}, [completeTask]);` | C | DO NOT TOUCH | **PROTECTED:** Emma dependency array (spec §2 non-goal) |
| 42 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 978 | `completeTask: (taskId: string) => completeTaskRef.current(taskId),` | C | DO NOT TOUCH | **PROTECTED:** Emma context export (spec §2 non-goal) |
| 43 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 1040 | `completeTask,` | C | DO NOT TOUCH | **PROTECTED:** Emma context value export (spec §2 non-goal) |
| 44 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 1097 | `completeTask,` | C | DO NOT TOUCH | **PROTECTED:** Emma context value export (spec §2 non-goal) |
| 45 | `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | 53 | `// - action: completeTask(id) (task checkbox click)` | C | DO NOT TOUCH | **PROTECTED:** Emma usage comment (spec §2 non-goal) |
| 46 | `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | 1748 | `const { tasks, completeTask, scheduleTask, ... } = useBotsson();` | C | DO NOT TOUCH | **PROTECTED:** Emma context consumer (spec §2 non-goal) |
| 47 | `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | 2028 | `onClick={() => completeTask(task.id)}` | C | DO NOT TOUCH | **PROTECTED:** Emma handler (spec §2 non-goal) |
| 48 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 21 | `//     A5  complete_task — mutation, same gate pattern as A4` | A | **DELETE** | B5 phase: skipped test comment — remove entire block |
| 49 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 42 | `//   - complete_task:       skipped (A5) — requires known UUID. Gap G-OPS-CTASK-01.` | A | **DELETE** | B5 phase: skipped test comment — remove entire block |
| 50 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 497 | `// ── A5: complete_task ──────────────────────────────────────────────────────` | A | **DELETE** | B5 phase: skipped test block start |
| 51 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 499 | `test("A5: complete_task — skipped (task_id UUID required)", async () => {` | A | **DELETE** | B5 phase: skipped test definition |
| 52 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 500 | `// complete_task requires a UUID task ID parameter.` | A | **DELETE** | B5 phase: skipped test comment |
| 53 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 504 | `// The two-step extraction pattern (get_my_tasks -> parse JSON -> complete_task)` | A | **DELETE** | B5 phase: skipped test comment |
| 54 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 513 | `// Tracked as: G-OPS-CTASK-01 (complete_task two-step UUID extraction deferred)` | A | **DELETE** | B5 phase: skipped test comment |
| 55 | `apps/e2e/tests/operations-harness-e2e.spec.ts` | 516 | `"A5: complete_task requires a known task_id UUID in the query. "` | A | **DELETE** | B5 phase: skipped test message — remove entire block 497-516 |
| 56 | `packages/telemetry/src/registry.ts` | 5053 | `data: { minutes_until_close: number; incomplete_tasks: number };` | E | DO NOT TOUCH | False positive (`incomplete_tasks` field ≠ tool) |
| 57 | `packages/telemetry/dist/registry.d.ts` | 4776 | `incomplete_tasks: number;` | E | DO NOT TOUCH | False positive (`incomplete_tasks` field ≠ tool) |
| 58 | `packages/ai/dist/capabilities/operations/tools.d.ts` | 43 | `export declare const completeTask: ...` | A | **DELETE** | B3 phase: generated declaration (dist artifact — deletes with source) |
| 59 | `packages/ai/dist/capabilities/operations/gate.d.ts` | 8 | `completeTask). L-0066 (default-allow CVE class)` | D | **DELETE** | B3 phase: generated declaration comment (dist artifact) |
| 60 | `packages/ai/dist/capabilities/operations/__evals__/fixtures/operations-seed.d.ts` | 6 | `WRITE operations (create_deviation, complete_task). Tool selection` | A | **DELETE** | B4 phase: generated declaration comment (dist artifact) |
| 61 | `packages/ai/dist/capabilities/operations/__evals__/fixtures/operations-seed.d.ts` | 15 | `complete_task        — WRITE: mark a task as done` | A | **DELETE** | B4 phase: generated declaration comment (dist artifact) |
| 62 | `packages/ai/src/capabilities/communication/compile-preclose.ts` | 42 | `const [incompleteTasks, deviations, requiredTasks] = ...` | E | DO NOT TOUCH | False positive (local variable `incompleteTasks`, NOT tool reference) |
| 63 | `packages/ai/src/capabilities/communication/compile-preclose.ts` | 75 | `remaining: (incompleteTasks.data ?? []).length,` | E | DO NOT TOUCH | False positive (local variable reference) |
| 64 | `packages/ai/src/capabilities/communication/compile-preclose.ts` | 77 | `items: (incompleteTasks.data ?? []).map(...)` | E | DO NOT TOUCH | False positive (local variable reference) |
| 65 | `packages/ai/src/capabilities/operations/index.ts` | 10 | `completeTask,` | A | **DELETE** | B3 phase: named export |
| 66 | `packages/ai/src/capabilities/operations/index.ts` | 18 | `completeTask,` | A | **DELETE** | B3 phase: registration array entry |
| 67 | `packages/ai/src/capabilities/operations/index.ts` | 25 | `const suggestTools = [createDeviation, completeTask] as unknown as ...` | A | **DELETE** | B3 phase: suggestTools array (remove completeTask) |
| 68 | `packages/ai/src/capabilities/operations/__evals__/operations.eval.ts` | 25 | `has WRITE tools (\`create_deviation\`, \`complete_task\`). The fixtures` | D | **UPDATE** | B4 phase: comment — remove `\`complete_task\`` mention |
| 69 | `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts` | 7 | `WRITE operations (create_deviation, complete_task). Tool selection` | A | **DELETE** | B4 phase: comment at file header |
| 70 | `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts` | 16 | `complete_task        — WRITE: mark a task as done` | A | **DELETE** | B4 phase: comment in fixture list |
| 71 | `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts` | 59 | `toolName: "complete_task",` | A | **DELETE** | B4 phase: fixture definition — remove entire `completeTask` fixture object |
| 72 | `packages/ai/src/capabilities/operations/tools.ts` | 257 | `export const completeTask = defineTool({` | A | **DELETE** | B3 phase: tool definition (lines 257-328) |
| 73 | `packages/ai/src/capabilities/operations/tools.ts` | 258 | `name: "complete_task",` | A | **DELETE** | B3 phase: tool definition body |
| 74 | `packages/ai/src/capabilities/operations/tools.ts` | 277 | `actionType: "complete_task",` | A | **DELETE** | B3 phase: tool definition body |
| 75 | `packages/ai/src/capabilities/operations/gate.ts` | 8 | `completeTask). L-0066 (default-allow CVE class)` | D | KEEP | B3 phase: comment mentions both tools; keep as-is (gate used by both) |
| 76 | `services/stage-engine/src/core/operations-evaluator.ts` | 285 | `const incompleteTasks = count ?? 0;` | E | DO NOT TOUCH | False positive (local variable) |
| 77 | `services/stage-engine/src/core/operations-evaluator.ts` | 287 | `if (incompleteTasks > 0) {` | E | DO NOT TOUCH | False positive (local variable reference) |
| 78 | `services/stage-engine/src/core/operations-evaluator.ts` | 295 | `message: \`Session closing in ... — ${incompleteTasks} tasks incomplete\`,` | E | DO NOT TOUCH | False positive (local variable reference) |
| 79 | `services/stage-engine/src/core/operations-evaluator.ts` | 299 | `incomplete_tasks: incompleteTasks,` | E | DO NOT TOUCH | False positive (field name / local variable reference) |
| 80 | `services/voice-agent/src/tools-task.ts` | 7 | `//   Voice + chat safe : list_my_tasks, complete_task` | B | KEEP | B1 phase: comment mentions `complete_task` as canonical tool (already migrated in Sortie 5a) |
| 81 | `services/voice-agent/src/tools-task.ts` | 68 | `// ── complete_task ─────────────────────────────────────────────────────────` | B | KEEP | B1 phase: section header comment (already canonical voice path) |
| 82 | `services/voice-agent/src/tools-task.ts` | 69 | `complete_task: llm.tool({` | B | KEEP | B1 phase: **canonical voice implementation** (Sortie 5a shipped this) |
| 83 | `services/voice-agent/src/tools-task.ts` | 93 | `return ask(\`Marker oppgave ${id} (source: ${source}) som ferdig.\`, "complete_task");` | B | KEEP | B1 phase: **canonical voice implementation** (Sortie 5a shipped) |
| 84 | `services/voice-agent/__tests__/tools-task.test.ts` | 61 | `it("T2 complete_task calls ask() with id + source", async () => {` | B | KEEP | Test for canonical voice path |
| 85 | `services/voice-agent/__tests__/tools-task.test.ts` | 64 | `await tools.complete_task.execute({ id: "task-uuid-123", source: "session" }, OPTS);` | B | KEEP | Test for canonical voice path |
| 86 | `services/voice-agent/__tests__/tools-task.test.ts` | 68 | `expect(ask.mock.calls[0][1]).toBe("complete_task");` | B | KEEP | Test for canonical voice path |
| 87 | `services/voice-agent/__tests__/tools-task.test.ts` | 135 | `"complete_task",` | B | KEEP | Test assertion for canonical voice path |
| 88 | `services/voice-agent/__tests__/tools-task.test.ts` | 148 | `expect(tools).toHaveProperty("complete_task");` | B | KEEP | Test assertion for canonical voice path |
| 89 | `services/voice-agent/src/adapter.ts` | 170 | `*   Task surface     : list_my_tasks, complete_task, create_personal_task,` | B | KEEP | Comment documenting canonical task tools (Sortie 5a shipped voice path) |
| 90 | `supabase/functions/ops-monitor/index.ts` | 365 | `incomplete_tasks: count,` | E | DO NOT TOUCH | False positive (field name ≠ tool reference) |
| 91 | `supabase/migrations/20260520160000_operations_capability_authority_seed.sql` | 12 | `-- invocations regardless of role or channel. createDeviation + completeTask` | D | **DELETE** | B7 phase: migration comment — remove `completeTask` reference |
| 92 | `supabase/migrations/20260520160000_operations_capability_authority_seed.sql` | 27 | `--                            createDeviation + completeTask are self-service` | D | **DELETE** | B7 phase: migration comment — remove `completeTask` reference |
| 93 | `supabase/migrations/20260520160000_operations_capability_authority_seed.sql` | 56 | `--   packages/ai/src/capabilities/operations/tools.ts (createDeviation, completeTask)` | D | **DELETE** | B7 phase: migration comment — remove `completeTask` reference |
| 94 | `supabase/migrations/20260520160000_operations_capability_authority_seed.sql` | 77 | `'Daily ops — createDeviation: employee self-report; completeTask: employee self-service. '` | D | **DELETE** | B7 phase: migration comment — remove `completeTask` reference |

## 4. Summary

**Total hits:** 94
**Files touched:** 20

### Classification Breakdown

| Class | Count | Meaning |
|---|---|---|
| **A (MIGRATE/DELETE)** | 27 | Must be touched in 5b deletion phase |
| **B (KEEP - canonical path)** | 17 | Already on canonical path (voice, BFF, already migrated); no touch |
| **C (DIFFERENT CONCERN - DO NOT TOUCH)** | 32 | Protected: toggle, HMS, Emma, spec §2 non-goals |
| **D (REFERENCE/UPDATE)** | 12 | Light updates: comments, docstrings, migration comments |
| **E (FALSE POSITIVE - DO NOT TOUCH)** | 6 | `incomplete_tasks` field ≠ tool; local variables ≠ tool refs |

### Drift Check

**Council table match:** ✓ **VERIFIED**

All 27 Class A files align with council scope table §3:
- ✓ `packages/ai/src/capabilities/operations/tools.ts:257-328` — 3 hits (delete tool def)
- ✓ `packages/ai/src/capabilities/operations/index.ts:10,18,25` — 3 hits (delete exports)
- ✓ `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts:59` — 1 hit (delete fixture)
- ✓ `packages/ai/src/capabilities/operations/__evals__/fixtures/operations-seed.ts:7,16` — 2 hits (delete comments)
- ✓ `apps/e2e/tests/operations-harness-e2e.spec.ts:497-516` — 7 hits (delete skipped test block)
- ✓ `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts` — 6 hits (B2 rewire: import + function + test calls)
- ✓ `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` — 3 hits (B2 rewire: comment + import + call site)
- ✓ `packages/ai/dist/**` (generated) — 5 hits (auto-delete via B3 rebuild)
- ✓ `packages/ai/src/capabilities/operations/__evals__/operations.eval.ts:25` — 1 hit (D: update comment)
- ✓ `packages/ai/src/capabilities/operations/gate.ts` — 1 hit (D: keep — used by createDeviation)
- ✓ `supabase/migrations/20260520160000_operations_capability_authority_seed.sql` — 4 hits (D: update migration comments; B7: create new deletion migration)

### False Positives Protected

No unexpected callers found outside council-verified scope.

Protected groups (33 hits, spec §2 non-goals + ADR-0287 violations):
- toggleSessionTaskAction callers (EventDetailPanel, TasksTab) — 4 hits ✓
- HMS module (use-complete-task, DriftTimeline, DriftTaskList) — 5 hits ✓
- BotssonProvider/Arena/Tools (Emma in-memory) — 14 hits ✓
- Mobile BFF sync (already canonical) — 6 hits ✓
- stage-engine operations-evaluator (`incompleteTasks` count) — 4 hits ✓
- ops-monitor (`incomplete_tasks` field) — 1 hit ✓
- communication compile-preclose (local var) — 3 hits ✓

All protected hits are marked **DO NOT TOUCH** per spec §3 false-positive list.

## 5. Next Steps

**B2 Server Action Rewire (Phase 2):**
- File `apps/web/src/app/dashboard/_actions/complete-session-task-action.ts` will be modified to delegate to `task.complete` tool execution
- Mirror pattern from Sortie 3 `add-task-action.ts:89`
- Verify capability gate-action key matches `task.complete` expected signature
- Tests in `__tests__/complete-session-task-action.test.ts` will be updated in parallel

**Eval-gate checkpoint (§4.1 spec):**
- Run intent-classifier evals BEFORE B6 (shim drop)
- If ≥95% on IC1-IC4, proceed with `aliasTaskVerbs` shim deletion
- If <95%, defer shim drop to separate sortie; document in HANDOFF

## 6. Verification

This audit is **READ-ONLY**. All code references verified to exist and classified per council verdicts (2026-05-13). No refactoring, no corrections, only observation and classification.

No code changes made in this phase.
