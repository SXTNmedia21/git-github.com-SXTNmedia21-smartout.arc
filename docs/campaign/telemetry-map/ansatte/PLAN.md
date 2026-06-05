---
title: Implementation Plan — Ansatte Telemetry & Controls
status: draft
created: 2026-05-31
updated: 2026-05-31
module: ansatte
tags: [plan, telemetry, controls, hooks]
---

# Ansatte Domain — Telemetry & Controls Implementation Plan

## Overview

164 interactive elements mapped. 34 mutations found. 14 mutations have events already in registry; 20 require new events. 6 backend hooks exist; 18 mutations have no backing hook yet.

---

## Phase 1 — Register Missing Events (registry.ts)

Before any hook wiring, add the 20 missing events to `packages/telemetry/src/registry.ts`.
Group by domain prefix for coherence.

### 1.1 `people.*` namespace (new)

These cover the People hub surface — profile and employee lifecycle actions not yet in registry.

| Event                                       | Trigger                                   | Entity                            |
| ------------------------------------------- | ----------------------------------------- | --------------------------------- |
| `people.employee.onboarding_wizard_started` | "Ny ansatt" CTA clicked                   | `profile` (new, pre-creation)     |
| `people.bulk.training_assigned`             | Bulk "Tildel opplæring"                   | `profile[]` + `protocol[]`        |
| `people.bulk.message_sent`                  | Bulk "Melding"                            | `profile[]`                       |
| `people.bulk.department_set`                | Bulk "Sett avdeling"                      | `profile[]`                       |
| `people.competence.added`                   | AddCompetence modal confirm               | `profile` + type-specific entity  |
| `people.absence.registered`                 | NewAbsence modal confirm                  | `profile` (absence record)        |
| `people.document.sent`                      | AssignCenter "Send dokument" confirm      | `profile` + `template[]`          |
| `people.task.assigned`                      | AssignCenter "Tildel oppgave" confirm     | `profile` + `task[]`              |
| `people.task.daily_list_added`              | AssignCenter "Legg i dagsliste" confirm   | `profile` + `task[]`              |
| `people.recert.scheduled`                   | RecertPlan confirm                        | `profile` + `protocol_assignment` |
| `people.recert.deadline_extended`           | "Forleng frist" in RecertPlan + ProtoCard | `profile` + `protocol_assignment` |
| `people.recert.reminder_sent`               | ProtoCard "Påminn"                        | `profile` + `protocol_assignment` |
| `people.botsson.action_invoked`             | Any Botsson assist action                 | `profile`                         |
| `people.message.sent`                       | MessageThread send                        | `profile` (recipient)             |
| `people.audit.exported`                     | AuditPanel "Eksport"                      | `profile`                         |

### 1.2 `contract_attachment.*` namespace

| Event                                  | Trigger                    | Entity                |
| -------------------------------------- | -------------------------- | --------------------- |
| `contract_attachment.upload_initiated` | AddContract "Last opp fil" | `employment_contract` |

### 1.3 `contract_template.*` namespace (extend existing)

| Event                                   | Trigger                            | Entity              |
| --------------------------------------- | ---------------------------------- | ------------------- |
| `contract_template.draft_saved`         | TemplateEditor "Lagre"             | `contract_template` |
| `contract_template.published`           | TemplateEditor "Publiser"          | `contract_template` |
| `contract_template.auto_attach_toggled` | TemplateEditor auto-vedlegg toggle | `contract_template` |

### 1.4 `contracts.export.*` namespace

| Event                        | Trigger                    | Entity                  |
| ---------------------------- | -------------------------- | ----------------------- |
| `contracts.export.initiated` | Directory "Eksport" button | `employment_contract[]` |

**DoD for Phase 1:** All 20 events exist in registry.ts with correct `event`, `workspace_id`, `actor_id`, `properties.entity`, and routing comment. TypeScript compiles clean.

---

## Phase 2 — Write Backend Hooks

For each mutation that has no backing hook, implement the hook. Each hook must:

1. Accept `workspace_id` + `actor_profile_id` (NEVER the subject's `profile_id` as actor)
2. Call `emit()` with the registered event after successful mutation
3. Invalidate relevant query keys

Priority order (highest blast radius first):

### 2.1 Profile save (ProfileCC "Lagre endringer")

- **Hook:** `useUpdateProfile` in `apps/web/src/app/dashboard/people/_hooks/`
- **Tables:** `profile` (display_name, role, department_id, lifecycle_status, language)
- **IDENTITY FLAG:** `email` + `phone` fields must write to `user_identity` (server route, not client Supabase)
- **Events:** `profile role updated` + `profile department updated` (conditionally on what changed)

### 2.2 Access save (AccessEdit "Lagre — logg endring")

- **Hook:** `useUpdateProfileAccess` in `apps/web/src/app/dashboard/people/_hooks/`
- **Tables:** `profile` (role field), insert/delete `profile_access` for scopes
- **Events:** `profile role updated` (on role change), `profile granted` / `profile revoked` (on scope change)

### 2.3 Placement save (PlacementEdit "Lagre plassering")

- **Hook:** `useUpdatePlacement` in `apps/web/src/app/dashboard/people/_hooks/`
- **Tables:** `profile` (department_id), `team_member` (insert/delete), `position` indirect
- **Events:** `profile department updated`, `profile team_member added` / `profile team_member removed`

### 2.4 Employee activate (ConfirmModal "Aktiver ansatt")

- **Reuse:** `profile activated` event already in registry
- **Hook:** `useActivateEmployee` — wraps existing activation engine (ADR-0379 pattern)
- **Tables:** `profile.status` → `active`

### 2.5 Employee reactivate (Summary "Reaktiver")

- **Reuse:** `profile reactivated` event already in registry
- **Hook:** `useReactivateEmployee`
- **Tables:** `profile.status` → `active` from `inactive`

### 2.6 Absence registration (NewAbsence modal)

- **Hook:** `useRegisterAbsence` in `apps/web/src/app/dashboard/people/_hooks/`
- **Tables:** `absence` (new record, pending status)
- **Event:** `people.absence.registered`

### 2.7 Add competence (AddCompetence modal)

- **Hook:** `useAddCompetence` — dispatches to correct sub-table by `type`
  - `stilling`: insert `profile_position`
  - `profesjon`: insert `profile_profession` (if exists) or note-only
  - `juridisk`: insert `profile_legal_function`
  - `sertifikat`: insert `certificate` record
- **Event:** `people.competence.added`

### 2.8 Assign training / protocols (AssignCenter opplæring)

- **Reuse:** `protocol assigned` event already in registry
- **Hook:** Extend `useWorkforceReadiness` or create `useAssignProtocols` for bulk assignment
- **Tables:** `protocol_assignment` (insert per selected protocol per profile)

### 2.9 Assign legal role (AssignCenter "Tildel juridisk verv")

- **Reuse:** `legal_function assigned` event already in registry
- **Hook:** `useAssignLegalFunction` (or reuse existing if present)
- **Tables:** `profile_legal_function`

### 2.10 Recert scheduling + deadline extension

- **Hook:** `useScheduleRecert` + `useExtendRecertDeadline`
- **Tables:** `protocol_assignment.next_review_at` + notification record
- **Events:** `people.recert.scheduled`, `people.recert.deadline_extended`, `people.recert.reminder_sent`

### 2.11 Template save / publish / auto-attach

- **Hook:** `useUpsertContractTemplate` in `apps/web/src/app/dashboard/people/contracts/_hooks/`
- **Tables:** `contract_template` (upsert)
- **Events:** `contract_template.draft_saved`, `contract_template.published`, `contract_template.auto_attach_toggled`

### 2.12 Onboarding wizard start ("Ny ansatt")

- **Hook:** `useStartOnboardingWizard`
- **Event:** `people.employee.onboarding_wizard_started`
- **Tables:** Creates new `profile` row, triggers onboarding flow

### 2.13 Bulk actions (Tildel opplæring / Melding / Sett avdeling)

- **Hook:** `useBulkAssign` with action discriminator
- **Events:** `people.bulk.training_assigned`, `people.bulk.message_sent`, `people.bulk.department_set`
- Note: "Melding" and "Sett avdeling" bulk hooks don't exist yet — need API route too

### 2.14 PII reveal (already hooked, needs emit wiring)

- **Existing:** `admin.pii_reveal` exists in registry
- **Gap:** Emit call must fire on `reveal()` confirmation — verify it exists in server route or add
- **IDENTITY FLAG:** Query must use `user_identity` not `auth.users`

**DoD for Phase 2:** Every mutation in the design has a hook that writes to the correct table AND emits the registered event. `actor_profile_id` is always the admin's profile, never the subject's.

---

## Phase 3 — Wire Events in Design Components

Once events are registered and hooks exist, wire `emit()` calls at call sites. Pattern per `use-employment-contracts.ts`:

```ts
onSuccess: (data, variables) => {
  void emit({
    event: "people.absence.registered",
    workspace_id: nonEmpty(variables.workspace_id, "workspace_id"),
    actor_id: nonEmpty(variables.actor_profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: variables.profile_id },
      data: { absence_type: variables.type },
    },
  });
};
```

---

## Control Points — DoD

| Control Point                        | Definition of Done                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `every_element_mapped`               | All 164 interactive elements appear in TELEMETRY-MAP.md with a row            |
| `every_mutation_has_event`           | All 34 mutations have a named event (MISSING events added to registry)        |
| `every_event_registry_status_known`  | Every event column shows IN or MISSING — no unknowns                          |
| `every_mutation_has_hook_or_flagged` | All 34 mutations have a hook path or an explicit "No hook — must create" note |
| `baseline_count_recorded`            | interactive_elements_total = 164 locked in control.json                       |

---

## Gate Battery Reference

Gate check commands to run before declaring this plan DONE:

```bash
# 1. TypeScript: all new events compile
pnpm turbo typecheck --filter=@smartout/telemetry

# 2. Telemetry: no unknown events in ansatte domain
grep -r "emit(" apps/web/src/app/dashboard/people/ | grep -v "registry"

# 3. Identity: no direct auth.users or user joins in ansatte hooks
grep -r "from.*user\b\|auth\.users" apps/web/src/app/dashboard/people/

# 4. Actor: no call site passes profile_id as actor_id
grep -A3 "actor_id:" apps/web/src/app/dashboard/people/ | grep "profile_id"
```

All four checks must be clean before merge.
