---
title: Training Domain — Gaps and Debt
status: done
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, gaps, debt, overlap, deviation]
mirror: verified
last_verified: 2026-05-23
---

# Training Domain — Gaps and Debt

## §Deviations (spec said X, code did Y)

### D1 — `sm-2fu-training-wire` plan status = `in_progress`, code is shipped
**Spec:** `docs/superpowers/plans/2026-05-19-sm-2fu-training-wire.md` (status: in_progress)
**Code:** `WorkforceReadinessClient.tsx`, `ReadinessProfileRow.tsx`, `use-workforce-readiness.ts` — all exist and are fully wired.
**Classification:** Confirmation — code shipped. Plan frontmatter not updated at closure.
**Action:** No code change needed. Document here.

### D2 — `hms.training.viewed` emits `protocol_count: 0` always
**Spec (MODULE_6):** Protocol count at view time should reflect active protocols in scope.
**Code:** `apps/web/src/app/dashboard/hms/training/page.tsx` — `protocol_count: 0` hardcoded with TODO comment (line ±40): "TODO: derive real protocol_count when governance hooks are lifted to page level."
**Classification:** Known debt. Not a blocker.
**Action:** Future HMS-domain pre run should address this.

### D3 — Sub-project A (admin assignment CRUD) partial
**Spec:** `2026-04-14-training-module6-subprojectA-admin-assignment-crud.md` — planned `AssignProtocolSheet`, `WaiveAssignmentDialog`, `use-assignment-mutations.ts`.
**Code:** `apps/web/src/app/dashboard/governance/_hooks/` — check reveals no `use-assignment-mutations.ts`.
**Classification:** Gap (partial implementation — governance overview may have assign button; dedicated sheet/dialog components not found).
**Action:** See §G2.

---

## §Gaps (planned, not implemented)

### G1 — Mobile procedure stepper + knowledge test UI
**Source:** Sub-project B plan (`2026-04-14-training-module6-subprojectB-mobile-training-ui.md`)
**What exists:** `use-training-data.ts` hook wired. Training screen renders course list.
**What's missing:** `ProcedureStepper`, `KnowledgeTestView`, `ConfirmationSign` mobile components.
**Severity:** 🟠 Medium — mobile employees can see status but cannot complete training on mobile.
**ROADMAP:** Phase 2.

### G2 — Admin manual assign / waive / revoke UI
**Source:** Sub-project A plan
**What exists:** `protocol_assignment` schema has `waived_by`, `waived_reason`, `assigned_via = 'manual'` support.
**What's missing:** `AssignProtocolSheet`, `WaiveAssignmentDialog`, `use-assignment-mutations.ts`.
**Severity:** 🟠 Medium — admins cannot manually override assignments from the UI.
**ROADMAP:** Phase 3.

### G3 — AI-adaptive training (Botsson nudges)
**Source:** MODULE_6 §8 — proactive training nudges, knowledge gap detection, spaced repetition.
**What exists:** `next_review_at` column on `protocol_assignment` (schema support). 3 capability tools (query-only).
**What's missing:** Botsson proactive push, spaced repetition scheduling engine, difficulty adaptation.
**Severity:** 🟡 Low — core engine works; AI personalization is aspirational.
**ROADMAP:** Phase 4.

### G4 — CV builder (employee desktop)
**Source:** MODULE_6 §6.3 — completed protocols + certifications + test scores as professional profile.
**What exists:** Data exists in `protocol_assignment` + `knowledge_test_attempt` + `confirmation_signature`.
**What's missing:** CV view UI.
**Severity:** 🟡 Low.
**ROADMAP:** Phase 5.

### G5 — Gamification integration
**Source:** MODULE_6 §10 — points for training activities.
**What exists:** Nothing. `points_event` table not built. `gamification_config` not built.
**What's missing:** Full gamification domain (future).
**Severity:** 🟡 Low — not a blocker.
**ROADMAP:** Blocked on gamification domain definition.

### G6 — Season-based training (deadline + AI outreach)
**Source:** MODULE_6 §9.2 — seasonal protocol deadlines, proactive AI outreach.
**What exists:** `assigned_via = 'season'` enum value. `next_review_at` for scheduling.
**What's missing:** Season-triggered assignment batch, deadline enforcement, AI notification.
**Severity:** 🟡 Low.
**ROADMAP:** Phase 4.

### G7 — Protocol update re-assignment (major version bump)
**Source:** MODULE_6 §2.3 — admin can reset assignments on major version update.
**What exists:** `protocol_version` snapshot on assignment. Schema supports re-assignment.
**What's missing:** Admin UI for "reset on version bump", minor/major distinction enforcement.
**Severity:** 🟡 Low.
**ROADMAP:** Phase 3.

### G8 — Position-based assignment trigger
**Source:** Enum value `assigned_via = 'position'`. `profession_training.is_required` (ADR-0387b B1).
**What exists:** Enum value only. `profession_training` table with position→protocol mappings.
**What's missing:** `auto_assign` trigger branch for position; `profile_position` INSERT hook.
**Severity:** 🟠 Medium — position-based compliance training not auto-triggered.
**ADR:** ADR-0387b (council-gated as of 2026-05-23).
**ROADMAP:** Blocked on ADR-0387b approval.

---

## §Overlap (cross-domain edges)

### O1 — procedure-engine: `protocol_assignment`, `knowledge_test_attempt`, `confirmation_signature`
**Shared surface:** Training-domain writes to `protocol_assignment`, `knowledge_test_attempt`, `confirmation_signature`. procedure-engine also claims these in its README (`docs/domains/procedure-engine/README.md:78`): "Owning tables (DDL): ... protocol_assignment, knowledge_test_attempt, confirmation_signature".
**Classification: keep — with seam clarification.** The apparent dual-ownership is because procedure-engine lumps the _full_ governance lifecycle including execution proof. Training-domain is the exclusive _writer_ of instance rows (assignments, attempts, signatures). procedure-engine owns the spec tables (`protocol`, `knowledge_test`, `confirmation`) and has documented the assignment/proof tables as part of its full list. There is no functional conflict — training-domain mutations never write to spec tables; procedure-engine tools never write to assignment/proof tables.
**Recommendation:** Clarify in procedure-engine README §78 that `protocol_assignment`, `knowledge_test_attempt`, `confirmation_signature` are DDL-listed but INSTANCE writes are training-domain's responsibility. Add a pointer to this domain.

### O2 — procedure-engine: `profession_training` table
**Shared surface:** `profession_training` seeds K1a role→mandatory-protocol maps. procedure-engine GAPS §O (line 104-106) classifies it as procedure-engine-owned (ADR-0387a). Training reads via `governance.list_mandatory_protocols_for_role`.
**Classification: keep.** procedure-engine owns; training reads. No dual ownership. No action needed.

### O3 — hms-future: `/dashboard/hms/training` route
**Shared surface:** The route lives under the HMS navigation hub but renders training-engine components. HMS-domain (future) will author WHAT is mandatory for HMS compliance; training-domain provides the engine.
**Classification: keep.** Ownership boundary: training-domain owns the route renderer + engine. HMS-future domain owns "what protocols are HMS-mandatory" (policy authoring). This seam should be explicit in the HMS-domain pre run when that domain is defined.

### O4 — contracts: `employment_category` + ADR-0253 lærling
**Shared surface:** `20260503110000_employment_category_constraint_and_template_column.sql` adds `employment_category` to `employment_contract`. MODULE_6 §1 references trainee/lærling as a training-relevant status. ADR-0253 defines lærling contract block.
**Classification: keep.** Contracts-domain owns `employment_category` on `employment_contract`. Training reads contract status to understand if an employee is an apprentice. Training-domain does NOT write to `employment_contract`. The `employment_category` constraint migration is in the contracts migration group (not training).

### O5 — scheduling: trainee shift restrictions
**Shared surface:** MODULE_6 cascade mapping notes that D3 training requirements "constrain who can work what." Scheduling reads readiness for shift assignment safety checks.
**Classification: keep.** Scheduling reads readiness; training provides it. Clear consumer/author split.

### O6 — year-wheel: `season.get_readiness` tool reads `protocol_assignment`
**Shared surface:** `docs/domains/year-wheel/GAPS-AND-DEBT.md:156` notes `season.get_readiness` reads `protocol_assignment`. This is already documented as G26 in procedure-engine GAPS.
**Classification: keep.** year-wheel tool reads training data as a cross-domain read. No ownership conflict. `protocol_assignment` is training-domain's table.

### O7 — botsson: invokes training capability tools
**Shared surface:** Botsson surfaces training tools (`get_my_training_status`, etc.) in its harness. `my-training-tools-bridge.tsx` registers view-tools.
**Classification: keep.** Botsson invokes; training-domain owns the capability + tools + data. Standard author/consumer.

### O8 — core-structure: `profile.status` trainee value
**Shared surface:** `auto_assign_protocols_to_new_employee()` trigger checks `NEW.status IN ('trainee', 'active')`. `profile_status` enum with `trainee` is core-structure's table.
**Classification: keep.** Training reads profile status to gate assignment logic. Core-structure owns `profile`. No cross-write.

---

## §Debt

| ID | Item | Severity | File/anchor |
|---|---|---|---|
| T1 | `hms.training.viewed` emits `protocol_count: 0` always | 🟡 Low | `apps/web/src/app/dashboard/hms/training/page.tsx:40` (TODO comment) |
| T2 | `sm-2fu-training-wire.md` plan status `in_progress` but code shipped | 🟡 Info | `docs/superpowers/plans/2026-05-19-sm-2fu-training-wire.md` |
| T3 | `procedure_step_completion` not referenced in `packages/training` types — no `TypedProcedureStepCompletion` export | 🟡 Low | `packages/training/src/types.ts` |
| T4 | `assigned_via = 'position'` dead letter in trigger | 🟠 Medium | `20260414014856_training_schema_foundation.sql:trigger` — no position branch |
