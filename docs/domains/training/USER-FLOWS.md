---
title: Training Domain — User Flows
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, user-flows, journeys, readiness, assignment, completion]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — User Flows

This file is an index. Full step-by-step narratives live in the linked journey documents.

## Flow index

### F1 — New employee gets protocols assigned (automatic)
**Journey:** `docs/journeys/JOURNEY-training-schema-foundation.md`

Trigger: Admin creates profile + it achieves `status IN ('trainee', 'active')`.
`auto_assign_protocols_to_new_employee()` trigger fires. Reads active policies scoped to workspace/dept/team/location. Inserts `protocol_assignment` rows with `status = not_started`.

Employee sees all assigned protocols in `my-training` page on next login.

**Confirmed by code:** `20260414014856_training_schema_foundation.sql` — trigger definition at `auto_assign_protocols_to_new_employee`.

---

### F2 — Employee works through a protocol (self-paced)
**Route:** `/dashboard/my-training`
**Components:** `ProtocolList → ProcedureStepper → KnowledgeTestView → ConfirmationSign`
**Package hooks:** `useAssignedProtocols`, `useCompleteStep`, `useSubmitTest`, `useSignConfirmation`

1. Employee opens `my-training` page → sees protocol cards ordered by status (in_progress first)
2. Expands a protocol card → sees `ProcedureStepper` with steps
3. Each step renders `description` + `training_content` (markdown) + `media_urls` (images/video)
4. Employee marks step complete → `useCompleteStep` inserts `procedure_step_completion` row + emits `protocol step_completed`
5. After all steps: `KnowledgeTestView` renders quiz questions
6. Employee submits answers → `useSubmitTest` inserts `knowledge_test_attempt` + emits `protocol test_submitted`
7. After quiz (if passing): `ConfirmationSign` appears
8. Employee signs → `useSignConfirmation` inserts `confirmation_signature` + emits `protocol confirmation_signed`
9. Protocol `status → completed` → emits `protocol completed`

**Confirmed by code:** `packages/training/src/hooks/use-step-completion.ts` — all three mutations.

---

### F3 — Admin views workforce readiness matrix
**Route:** `/dashboard/people/training`
**Components:** `WorkforceReadinessClient`, `ReadinessProfileRow`
**Hook:** `use-workforce-readiness` (shared from HMS extraction)

1. Admin opens `/dashboard/people/training`
2. Server RSC shell calls `resolveDashboardContext()` → passes `workspaceId` + `profileId`
3. `WorkforceReadinessClient` calls `useWorkforceReadiness` → queries `profile` + `protocol` + `protocol_assignment`
4. Renders 4 KPI cards: ready (100%), avg readiness %, expired count, expiring soon (14 days)
5. Department filter pills shown if ≥2 departments
6. Per-profile readiness rows with expandable protocol status list
7. Emits `people.training.viewed` on first data load

**Plan reconciliation:** `2026-05-19-sm-2fu-training-wire.md` — status is `in_progress` in plan frontmatter but code is SHIPPED. Confirmed: `WorkforceReadinessClient.tsx` exists and is fully wired. Plan status = outdated. **Classification: Confirmed (with plan-status deviation — see GAPS §D1).**

---

### F4 — Admin views HMS-flavored training (HMS edge)
**Route:** `/dashboard/hms/training`
**Components:** Renders `CompetenceMatrix` (admin) or `ProtocolList` (employee) — training-engine components

This is the same training engine as F2/F3, surfaced inside the HMS navigation hub. HMS context emits `hms.training.viewed` with `protocol_count` (currently always 0 — see GAPS §D2).

The route does NOT have its own data layer. It re-uses training-domain components. **HMS-domain (future) will define what protocols are HMS-mandatory.** Training-domain provides the rendering engine.

---

### F5 — Mobile employee reads training status
**App:** `apps/mobile/app/(app)/(home)/training.tsx`
**Hook:** `apps/mobile/src/hooks/queries/use-training-data.ts`

1. Employee opens training tab
2. `useTrainingData` calls `useAssignedProtocols` + `useReadinessScore` from `@smartout/training`
3. Maps to legacy `TrainingData` shape (`courses`, `procedures`, `certificates`)
4. Displays readiness % + course list with status badges

Mobile procedure stepper + knowledge test UI = aspirational (see ROADMAP).

---

### F6 — AI / Botsson queries training status
**Capability tools:** `training` capability (`get_my_training_status`, `get_next_protocol`, `get_team_readiness`)
**Channel:** chat + voice (both)

- Employee asks "hva er min fremgang?" → `get_my_training_status` returns counts + readiness %
- Employee asks "hva bør jeg gjøre nå?" → `get_next_protocol` returns oldest incomplete assignment
- Manager asks "hvem er klar?" → `get_team_readiness` returns per-employee % + overall %

---

### F7 — Profession-training bootstrap at workspace creation (I1)
**EF:** `supabase/functions/bootstrap-cascade` (Step 11 — hospitality niche)
**Function:** `fn_seed_profession_training(p_workspace_id, p_profiles)`

1. I1 bootstrap Step 11 calls `fn_seed_profession_training` with `hospitalityPackage.roleCapabilityProfiles`
2. Function upserts `profession` rows (slug = roleSlug)
3. Inserts `profession_training` rows linking profession → mandatory protocols (by name lookup)
4. Silently skips protocols not yet seeded (best-effort per ADR-0379a)

Note: `profession_training` is K1a knowledge classified as procedure-engine-owned. Training domain does NOT write to `profession_training` — only reads via `governance.list_mandatory_protocols_for_role` tool.

---

## Plans → flow confirmation

| Plan / source | Flow | Status |
|---|---|---|
| `20260414014856_training_schema_foundation.sql` | F1 (auto-assign trigger), F2 (mutation tables) | ✅ Confirmed |
| `20260412100200_completion_tracking.sql` | F2 (proof tables) | ✅ Confirmed |
| `2026-04-14-training-module6-subproject0-schema-foundation.md` | F1, F2 schema | ✅ Confirmed |
| `2026-04-14-training-module6-subprojectA-admin-assignment-crud.md` | Manual assign/waive (F3 enhancement) | 🟡 Partial — code partially exists; see GAPS §G2 |
| `2026-04-14-training-module6-subprojectB-mobile-training-ui.md` | F5 mobile hook | ✅ Confirmed (hook shipped; screen partial) |
| `2026-04-14-training-module6-subprojectC-readiness-dashboard.md` | F3 (readiness matrix) | ✅ Confirmed |
| `2026-05-19-sm-2fu-training-wire.md` | F3 (people/training) | ✅ Confirmed (plan status outdated; code shipped) |
| `docs/journeys/JOURNEY-training-schema-foundation.md` | F1 | ✅ Exists |
