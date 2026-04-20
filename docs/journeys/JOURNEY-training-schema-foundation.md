---
title: "Journey — Training Schema Foundation"
status: done
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [journey, training, schema, foundation]
---

# Journey — Training Schema Foundation

> Sub-project 0 of Module 6 Training. Foundation layer — no new UI surfaces.
> User-facing journeys are enabled by this work but ship in sub-projects A, B, C.

---

## Journey: Admin — Assign Protocol to Employee (existing, now enhanced)

**Precondition:** Admin is in a workspace with active policies and protocols. Employee profile exists.

1. New employee profile is created (status: trainee or active)
   -> System trigger `auto_assign_protocols_to_new_employee` fires
   -> System creates `protocol_assignment` rows with:
     - `workspace_id` (direct, NOT NULL) from profile
     - `assigned_via` = policy scope (workspace/department/team/location)
     - `assigned_ref_id` = scope reference ID
     - `protocol_version` = current protocol version
     - `status` = `not_started` (was `pending`)
   -> User sees: assignments appear in employee's training dashboard

**Postcondition:** Employee has protocol assignments scoped to workspace with full provenance tracking.

**Error paths:**
- If profile has no workspace_id -> migration constraint prevents NULL workspace_id
- If policy scope doesn't match any enum -> CASE returns NULL for assigned_via (safe default)

---

## Journey: Employee — View Training Status via AI Agent

**Precondition:** Employee has protocol assignments. AI agent session active.

1. Employee asks "What training do I need?" or "How's my training going?"
   -> System routes intent to `training` capability
   -> Tool `get_my_training_status` executes
   -> System queries `protocol_assignment` filtered by `profile_id` + `workspace_id`
   -> User sees: total protocols, completed, not started, in progress, expired, readiness %

2. Employee asks "What should I work on next?"
   -> Tool `get_next_protocol` executes
   -> System queries oldest incomplete assignment (not_started or in_progress)
   -> User sees: protocol name, description, status, assignment date

**Postcondition:** Employee knows their training status and next action.

**Error paths:**
- No assignments -> "You have no protocol assignments yet."
- All completed -> "All protocols completed! You are at 100% readiness."
- Training capability not registered -> intent falls through to general capability (graceful degradation)

---

## Journey: Manager — View Team Readiness via AI Agent

**Precondition:** Manager/admin in workspace with assigned protocols. AI session active.

1. Manager asks "How is my team doing on training?" or "Show team readiness"
   -> System routes to `training` capability
   -> Tool `get_team_readiness` executes (requires suggest authority or higher)
   -> System calls `get_workspace_readiness` RPC (uses direct `workspace_id` filter)
   -> System fetches profile display names
   -> User sees: per-employee readiness percentages, overall workspace readiness

2. Manager asks "Show readiness for kitchen department"
   -> Tool receives `departmentId` parameter
   -> System filters results by department
   -> User sees: filtered readiness for that department

**Postcondition:** Manager has visibility into team training progress.

**Error paths:**
- No employees with assignments -> "No employees with protocol assignments found."
- Department filter matches nobody -> "No employees match the filter."
- Insufficient authority (read_only) -> tool not available in tool list

---

## Journey: Employee — Complete Training Steps (existing, now uses shared hooks)

**Precondition:** Employee is on the training dashboard. Has protocol assignments.

1. Employee opens My Training page
   -> `useAssignedProtocols` hook fires (now delegates to `@smartout/training` shared hook)
   -> System queries `protocol_assignment` with direct `workspace_id` filter (no JOIN through protocol)
   -> System fetches procedures, steps, tests, confirmations in parallel via `Promise.all()`
   -> User sees: protocol list with progress bars

2. Employee completes a procedure step
   -> `useCompleteStep` mutation fires (now delegates to shared hook)
   -> System inserts `procedure_step_completion`
   -> System emits `protocol step_completed` telemetry event
   -> System invalidates training query cache
   -> User sees: step marked complete, progress updates

3. Employee submits a knowledge test
   -> `useSubmitTest` mutation fires
   -> System inserts `knowledge_test_attempt`
   -> System emits `protocol test_submitted` telemetry event
   -> User sees: pass/fail result, score displayed

4. Employee signs a confirmation
   -> `useSignConfirmation` mutation fires
   -> System inserts `confirmation_signature`
   -> System emits `protocol confirmation_signed` telemetry event
   -> User sees: confirmation marked as signed

**Postcondition:** Employee training progress is tracked and persisted.

**Error paths:**
- Insert fails (duplicate completion) -> toast error "Kunne ikke fullf*re steg"
- Test insert fails -> toast error "Kunne ikke sende inn test"
- Signature insert fails -> toast error "Kunne ikke registrere signatur"

---

## Journey: Admin — View Competence Matrix (existing, now optimized)

**Precondition:** Admin is on the HMS/Competence page.

1. Admin opens Competence Matrix
   -> `useCompetenceData` queries `protocol_assignment` with direct `workspace_id` filter
   -> Previously: required JOIN through protocol table for workspace scoping
   -> Now: direct `workspace_id` column on `protocol_assignment` (indexed)
   -> User sees: matrix of employees vs protocols with completion status

**Postcondition:** Admin sees workspace-wide competence overview.

**Error paths:**
- No assignments in workspace -> empty matrix displayed

---

## Non-Journey: Mobile Parity (deferred to Sub-project B)

The shared hooks in `@smartout/training` accept dependency-injected supabase client and context, making them usable from React Native. However, the mobile app's `use-training-data.ts` hook has NOT been wired to the shared hooks yet. This is explicitly deferred to Sub-project B.

## Non-Journey: AI Grading and Spaced Repetition (deferred to Phase 2)

Columns `ai_confidence`, `graded_by` on `knowledge_test_attempt` and `next_review_at` on `protocol_assignment` are schema-ready but have no write tools or UI yet. Phase 2 will add AI grading tools and spaced repetition scheduling.
