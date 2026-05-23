---
title: Training Domain — Roadmap
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: training
tags: [training, roadmap, aspirational, phases]
mirror: aspirational
last_verified: 2026-05-23
---

# Training Domain — Roadmap

> This file is aspirational. Verified current state lives in ARCHITECTURE.md + DATA-MODEL.md + GAPS-AND-DEBT.md. Use this file to understand where the domain is heading.

## North star

Every Smartout employee at 100% readiness before their first solo shift. "Ready" = all assigned Protocols completed (procedures read, tests passed, confirmations signed). Compliance is a byproduct of actual competence.

## Delivered (confirmed in code)

### Phase 0 — Schema Foundation ✅
Source: `2026-04-14-training-module6-subproject0-schema-foundation.md` + `20260414014856_training_schema_foundation.sql`

- `protocol_assignment` extensions: `workspace_id`, `assigned_via`, denorm counters, waiver, `next_review_at`, RLS rewrite
- `knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion` tables (immutable proof layer)
- `auto_assign_protocols_to_new_employee()` trigger (workspace/dept/team/location scope cascade)
- `get_workspace_readiness()` RPC
- `@smartout/training` shared package: `useAssignedProtocols`, `useCompleteStep`, `useSubmitTest`, `useSignConfirmation`, `useReadinessScore`, types

### Phase 1 — Employee Self-View ✅
Source: Delivered alongside Phase 0.

- `/dashboard/my-training` — full protocol → procedure → test → confirmation flow
- `ProtocolList`, `ProcedureStepper`, `KnowledgeTestView`, `ConfirmationSign` components
- `MyTrainingToolsBridge` + `use-my-training-tools` (Botsson harness registration)

### Phase 1b — Training Content Columns ✅
Source: `20260422300800_hms_procedure_step_training.sql`

- `procedure_step.training_content` + `procedure_step.media_urls` columns
- Enables rich step content in training mode vs. compact operational mode

### Phase 1c — Admin Readiness Matrix ✅
Source: `2026-04-14-training-module6-subprojectC-readiness-dashboard.md` + `2026-05-19-sm-2fu-training-wire.md`

- `/dashboard/people/training` — workforce readiness matrix
- 4-KPI strip (ready, avg readiness, expired, expiring soon)
- Department filter pills + per-profile readiness rows with expandable protocol status
- `hms/training` — HMS-flavored subset (training-engine, HMS edge)

### Phase 1d — Mobile Hook ✅
Source: `2026-04-14-training-module6-subprojectB-mobile-training-ui.md`

- `apps/mobile/src/hooks/queries/use-training-data.ts` — thin wrapper over `@smartout/training`
- Mobile training screen reads readiness % + course list

### Phase 1e — Profession-Training Bootstrap ✅
Source: ADR-0379a, `20260621200105` + `20260621200106`

- `fn_seed_profession_training` — idempotent I1 bootstrap for hospitality roleCapabilityProfiles
- Read-path indexes on `profession_training`
- Consumed by `governance.list_mandatory_protocols_for_role` capability tool (ADR-0387a)

### Phase 1f — Training Capability Tools ✅
Source: `packages/ai/src/capabilities/training/tools.ts`

- 3 tools: `get_my_training_status`, `get_next_protocol`, `get_team_readiness`
- Available on both chat + voice channels

---

## Upcoming

### Phase 2 — Mobile Training Completion
**Closes:** G1 (mobile procedure stepper + test UI)
**Scope:**
- `ProcedureStepper` mobile component (step-by-step reader with `training_content` + `media_urls`)
- `KnowledgeTestView` mobile component (multiple choice + true/false)
- `ConfirmationSign` mobile component
- Wire `useCompleteStep`, `useSubmitTest`, `useSignConfirmation` on mobile (already in `@smartout/training`)

### Phase 3 — Admin Manual Assignment CRUD
**Closes:** G2 (manual assign/waive UI), G7 (protocol version bump reset)
**Scope:**
- `AssignProtocolSheet` — select employee + protocol + assign
- `WaiveAssignmentDialog` — confirm waiver with reason (logs `waived_by`, `waived_reason`)
- `use-assignment-mutations` — TanStack mutations for assign, waive, revoke, bulk assign
- Protocol version bump UI — admin can trigger re-assignment on major version update
**Governing ADRs:** ADR-0101-0106 (governance model)

### Phase 4 — AI-Adaptive Training
**Closes:** G3 (Botsson nudges), G6 (season-based training)
**Scope:**
- Botsson proactive push: "Hei [name]! Du har 2 ufullførte protokoller..."
- `next_review_at` spaced repetition scheduling engine (cron-driven)
- Season-triggered assignment batch (when new season activates, assign new protocols with deadline)
- Knowledge gap detection (repeated test failures → refresher recommendation)
- Post-deviation training (deviation logged → AI suggests relevant protocol refresher)
**Dependencies:** Botsson Phase E (proactive missions), season activation hooks

### Phase 5 — CV Builder + Employee Desktop
**Closes:** G4 (CV builder)
**Scope:**
- Employee desktop view: completed protocols + dates + test scores + certifications
- Training history timeline
- Professional profile export (PDF)

### Phase 6 — Position-Based Assignment
**Closes:** G8 (position-based trigger)
**Governing ADR:** ADR-0387b (council-gated — must be accepted first)
**Scope:**
- `auto_assign` trigger branch for `assigned_via = 'position'`
- `profile_position` INSERT → trigger reads `profession_training.is_required` → assigns mandatory protocols
- Readiness gate per role (ADR-0387b B3)

### Phase 7 — Gamification Integration
**Closes:** G5 (gamification)
**Dependencies:** Gamification domain definition
**Scope:**
- `points_event` table (gamification domain)
- Training emit events → points awards (10 per step, 25 per test, 50 per protocol)
- Configurable via `gamification_config.rules_json`

---

## ADR references

| ADR | Topic | Status |
|---|---|---|
| ADR-0387a | `profession_training` revival + I1 seeding + `list_mandatory_protocols_for_role` tool | ✅ Shipped |
| ADR-0387b | Position-based assignment trigger + per-role readiness gate | 🔴 Council-gated |
| ADR-0379a | `fn_seed_profession_training` best-effort seed contract (RA1+RA2c) | ✅ Shipped |
| ADR-0253 | Lærling-kontrakter — Opplæringsloven kap. 4 (contracts-side edge) | 🟡 Block enforced; full flow deferred |
| ADR-0101 to ADR-0106 | Governance model (procedure-engine spec layer) | ✅ Foundation |
| ADR-0298 | Task Ontology (five sources) — training is NOT a task source | ✅ |

## Cross-domain forward references

- **HMS-domain (future):** When defined, will claim "what protocols are HMS-mandatory" authoring. `/dashboard/hms/training` ownership seam to be resolved at that domain's `pre` run.
- **Onboarding (future):** First-day training flow (Trainee Mode) lives there. Training-domain provides the assignment engine.
- **Gamification (future):** Training events feed into point award rules. Training-domain emits; gamification-domain consumes.
- **Contracts:** ADR-0253 lærling block enforced. Full lærling training flow (Opplæringsloven kap. 4 — opplæringskontor integration, practice period plan) deferred.
