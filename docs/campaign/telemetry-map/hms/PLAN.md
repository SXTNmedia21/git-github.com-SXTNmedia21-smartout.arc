---
title: HMS Build Plan — Telemetry + Hooks
domain: hms
agent: map-hms
generated: 2026-05-31
status: draft
---

# HMS Build Plan

Ordered implementation plan: wire every mutation to its event + hook, register missing registry events, unblock F0.4 seed blockers.

---

## Priority 1 — Core deviation lifecycle (unblocks compliance reporting)

### 1a. Wire MeldAvvikModal submit to useCreateDeviation

- Element: `MeldAvvikModal` submit (#88) → `hms-avvik.jsx:414`
- Hook: `use-create-deviation.ts` + `reportDeviationAction`
- Telemetry: `deviation reported` ✅ IN REGISTRY
- DoD: `reportDeviationAction` called on submit; optimistic insert; toast "Avvik meldt"; `deviation reported` emitted server-side (awaited)

### 1b. Wire DevCard + AvvikDrawer move/advance to useUpdateDeviation

- Elements: DevCard advance (#70), drag-drop (#65, #67), AvvikDrawer stage seg (#72, #73) → `hms-avvik.jsx`
- Hook: `use-update-deviation.ts` → `resolveDeviationAction / acknowledgeDeviationAction / escalateDeviationAction`
- Telemetry: `deviation updated` ✅, `deviation resolved` ✅
- DoD: Each stage transition calls correct Server Action; `deviation updated` or `deviation resolved` emitted; undo toast support preserved

### 1c. Wire AvvikDrawer owner assign to useUpdateDeviation

- Element: AvvikDrawer owner picker (#75)
- Hook: `use-update-deviation.ts`
- Telemetry: `deviation updated` ✅
- DoD: Owner change persisted via Server Action; event emitted

### 1d. Register + emit deviation viewed

- Element: DevCard row click (#68) + AQRow action (#11, #12)
- Hook: `useDeviations` already reads; add `emit("deviation viewed")` on open
- Telemetry: `deviation viewed` ✅ IN REGISTRY
- DoD: Client-side emit on drawer open (non-gated read event; no gate_action needed per ADR pattern)

---

## Priority 2 — Task + routine completion (unblocks protocol compliance %)

### 2a. Wire HmsTaskRow toggle to useCompleteTask

- Elements: #39, #54, #56, #112
- Hook: `use-complete-task.ts` (gated template — gatedMutation + admin-client + awaited emit)
- Telemetry: `protocol step_completed` ✅
- DoD: `completeTaskAction` called on toggle; `protocol step_completed` emitted with `protocol_assignment_id`, `step_id`, `session_id`

### 2b. Wire Routine "Marker rutine fullført" to useCompleteTask + evidence

- Element: #113 (`HmsRoutineDetail` complete button)
- Hook: `use-complete-task.ts`
- Telemetry: `protocol completed` ✅
- DoD: All tasks in routine marked done via Server Action; `protocol completed` emitted; evidence signoff record generated; `addEvi()` propagates to parent protocol

### 2c. Wire Training player "Neste/Fullfør" to protocol step_completed

- Elements: #117 training player steps
- Hook: `use-complete-task.ts`
- Telemetry: `protocol step_completed` ✅
- DoD: Each module advance emits step completion event with module index as step_id

### 2d. Wire Quiz player "Se resultat" to protocol test_submitted

- Element: #125 quiz advance → result
- Telemetry: `protocol test_submitted` ✅ IN REGISTRY
- DoD: On phase === "done", emit `protocol test_submitted` with `score`, `passed`, `protocol_id`, `quiz_id`

### 2e. Wire Manual "Bekreft lest" to protocol confirmation_signed

- Element: #132 manual player final
- Telemetry: `protocol confirmation_signed` ✅ IN REGISTRY
- DoD: Emit `protocol confirmation_signed` with `confirmation_id` (manual read receipt id), `protocol_id`

---

## Priority 3 — Protocol wizard creation

### 3a. Register missing wizard events in registry.ts

Missing events to add:

- `hms.protocol.wizard_started` — emitted when wizard opens
- `hms.protocol.wizard_abandoned` — emitted when wizard closed before completion
- `hms.protocol.created` — emitted when final "Opprett protokoll" create() succeeds

### 3b. Wire Wizard to Server Action + registry events

- Elements: #3/#25 (open wizard), #89 (close/abandon), #107 (create)
- Hook: Create `use-create-protocol.ts` following gated template pattern
- Telemetry: `wizard started` ✅, `wizard abandoned` ✅ (generic wizard events already in registry); `hms.protocol.created` MISSING
- DoD: `create()` calls Server Action to insert into `protocol` table; `hms.protocol.created` emitted with `protocol_id`, `cat`, `importance`, `handbook_id`, `chapter_id`; wizard step nav uses `wizard step_completed`/`wizard step_back`

---

## Priority 4 — AI panel actions

### 4a. Register + emit AIPanel action/dismiss events

Missing events to add:

- `hms.ai.action_confirmed` — emitted when user confirms an AI suggestion
- `hms.ai.suggestion_dismissed` — emitted when user dismisses AI suggestion
- Elements: #16 (action), #17 (dismiss), #64 (Botsson strip CTA)
- DoD: Client-side emit only (non-gated); passes `suggestion_id`, `cat`, `action_type`

---

## Priority 5 — Training/quiz/manual lifecycle events

### 5a. Register + emit training lifecycle

Missing events to add:

- `hms.training.started` — on player cover CTA
- `hms.training.completed` — on done screen close/quiz handoff
- Elements: #115, #116, #119
- DoD: Client-side emit with `training_id`, `protocol_id`, `module_count`

### 5b. Register + emit quiz lifecycle

Missing events to add:

- `hms.quiz.started` — on quiz cover CTA
- `hms.quiz.retried` — on retry button
- Elements: #123, #127
- DoD: Client-side emit with `quiz_id`, `protocol_id`

### 5c. Register + emit manual lifecycle

Missing events to add:

- `hms.manual.started` — on manual player open
- Elements: #129, #130
- DoD: Client-side emit with `manual_id`, `protocol_id`

---

## Priority 6 — UX telemetry (readiness, export, comments)

### 6a. Register + emit readiness reminder

- `hms.readiness.reminder_sent` MISSING — element #49
- DoD: Server Action to send notification; emit event with `recipient_count`, `blocked_count`

### 6b. Register + emit comment actions

- `hms.comment.sent` MISSING — element #144 (CommentDrawer send)
- `hms.comment.resolved` MISSING — element #139 (CommentDrawer resolve toggle)
- DoD: Client-side emit; passes `anchor_id`, `priority`, `has_mention`

### 6c. Register + emit misc UX events

- `hms.training.export_requested` — element #43
- `hms.activity.exported` — element #59
- `hms.category.viewed` — element #10 (CatCard click)
- `hms.evidence.archive_opened` — element #20
- `hms.legal.external_link_opened` — element #135
- DoD: Client-side emit; diagnostic/analytics only

---

## F0.4 Compliance-Seed Blocker (CRITICAL — flags for E2E gate)

### BLOCKER-1: haccp_log — 0 seed rows

- **Impact:** HACCP log entry widget in HMS renders hollow. `haccp logged` event in registry (line 2214) cannot be exercised in E2E tests. Any compliance widget that counts HACCP entries shows 0.
- **Tables affected:** `haccp_log`
- **Action required before E2E:** Insert ≥3 seed rows in `haccp_log` with realistic `session_id`, `protocol_id`, `recorded_at`, `recorded_by` matching existing sessions + profiles.

### BLOCKER-2: knowledge_test_attempt — 0 seed rows

- **Impact:** Quiz completion/score widgets render hollow. `protocol test_submitted` cannot be verified end-to-end. Protocol readiness % is incorrect (denominator but no numerator for quiz completion).
- **Tables affected:** `knowledge_test_attempt` (or equivalent tracking table)
- **Action required:** Insert ≥2 seed rows: one passed (score ≥ pass%), one failed. Link to existing quiz + profile.

### BLOCKER-3: confirmation_signature — 0 seed rows

- **Impact:** Manual read-receipt lesekvittering widgets render hollow. `protocol confirmation_signed` event cannot be E2E verified. Manual compliance column in protocol detail shows all missing.
- **Tables affected:** `confirmation_signature` (or `confirmation` table)
- **Action required:** Insert ≥2 seed rows: one per manual per profile. Link `confirmation_id` to existing `manual` + `profile`.

---

## Control-Point DoD (gate battery)

All of the following must be true before the HMS domain is considered PASS:

| Gate                               | Check                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| every_element_mapped               | 145/145 rows in TELEMETRY-MAP.md                                                                                                                                             |
| every_mutation_has_event           | All 38 mutations resolve to a registry event (either existing or newly registered)                                                                                           |
| every_event_registry_status_known  | All 145 rows have "YES" or "MISSING" in registry column — no unknowns                                                                                                        |
| every_mutation_has_hook_or_flagged | All mutation elements name a hook or are flagged for new hook                                                                                                                |
| baseline_count_recorded            | interactive_elements_total = 145 locked in control.json                                                                                                                      |
| f04_seed_blockers_resolved         | haccp_log, knowledge_test_attempt, confirmation_signature all have ≥2 seed rows                                                                                              |
| e2e_per_journey                    | E2E tests exist for: create deviation, move deviation stage, complete routine, complete task, start+complete training, take quiz (pass), read manual, create protocol wizard |

---

## Missing Registry Events (20 total to register)

1. `hms.protocol.wizard_started`
2. `hms.protocol.wizard_abandoned`
3. `hms.protocol.created`
4. `hms.category.viewed`
5. `hms.ai.action_confirmed`
6. `hms.ai.suggestion_dismissed`
7. `hms.training.started`
8. `hms.training.completed`
9. `hms.quiz.started`
10. `hms.quiz.retried`
11. `hms.manual.started`
12. `hms.readiness.reminder_sent`
13. `hms.comment.sent`
14. `hms.comment.resolved`
15. `hms.training.export_requested`
16. `hms.activity.exported`
17. `hms.evidence.archive_opened`
18. `hms.legal.external_link_opened`
19. `hms.deviation.comment_added`
20. `hms.task.created`
