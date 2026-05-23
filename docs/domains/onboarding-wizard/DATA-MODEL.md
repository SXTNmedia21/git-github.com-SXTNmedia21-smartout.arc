---
title: "Onboarding Wizard — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: onboarding-wizard
tags: [domain, onboarding-wizard, data-model, schema, consent, availability, identity, adr-0396, adr-0397]
mirror: verified
last_verified: 2026-05-23
---

# Onboarding Wizard — Data Model

> Every table the Onboarding Wizard reads or writes. Two new tables introduced by this sortie; remaining tables reused from identity / D2 layers.
> **Code wins.** `mirror: verified` — all claimed tables + migrations confirmed against code on `feat/employee-onboarding-wizard`.

## Tables

### Reused

#### `user_identity` — identity layer (pre-workspace)
- `display_name`, `phone` → written by `saveContact` Server Action (Step 2)
- `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` → written by `saveOptional` Server Action (Step 7)
- ADR-0396: these columns belong here, NOT duplicated on `profile`. The wizard correctly writes to `user_identity` for these fields.
- PKs and remaining columns owned by identity domain.

#### `profile` — D2 Resource (workspace-scoped)
- `personal_number` → written by `savePersonalNumber` via `submit_own_pii('identity', …)` (Step 4)
- `bank_account` → written by `saveOptional` via `submit_own_pii('banking', …)` (Step 7)
- `is_welcome_complete` → set `true` by `completeWelcome` (Step 8)
- `welcome_completed_at` → set `now()` by `completeWelcome` (Step 8)
- `address_line_1`, `address_line_2`, `postal_code`, `city` → written by `saveAddress` via `submit_own_pii('address', …)` (Step 3). **Note: ADR-0396 violation — address belongs on `user_identity`. Pre-existing debt; separate sortie (see GAPS §D1).**
- Owns `workspace_id` FK — workspace-scoped.

#### `employee_availability` — D2 Resource
- Written by new `saveAvailability` Server Action (Step 5).
- One row per unavailable weekday:
  - `workspace_id`, `profile_id` (server-derived — never from body)
  - `valid_from = CURRENT_DATE`, `valid_to = NULL`
  - `rrule = 'FREQ=WEEKLY;BYDAY=<MO|TU|WE|TH|FR|SA|SU>'`
  - `preference_type = 'unavailable'`
  - `reason = 'onboarding-wizard'` (provenance discriminator for scheduler)
  - `created_by = profile_id` NOT NULL (R-NEW per agent-coord finding O-5)
- Table DDL owned by scheduling / D2 domain. Wizard is a writer, not the owner.

### New

#### `consent_acceptance` — append-only consent audit
**Migration:** `supabase/migrations/20260624000000_create_consent_acceptance.sql`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL → `workspace` ON DELETE CASCADE | RLS root |
| `profile_id` | UUID NOT NULL → `profile` ON DELETE CASCADE | |
| `consent_type` | TEXT NOT NULL CHECK (`handbook` \| `gdpr` \| `tariff`) | one row per accepted type |
| `document_version` | TEXT NOT NULL | e.g. `"handbook-v1"`, `"gdpr-v1"`, `"tariff-v1"` (V1 hardcoded; catalog = ROADMAP) |
| `accepted_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | immutable once written |
| `source` | TEXT NOT NULL DEFAULT `'employee-onboarding-wizard'` | provenance |
| `client_user_agent` | TEXT | captured server-side at BFF |
| `client_ip` | TEXT | captured server-side at BFF |

Index: `idx_consent_acceptance_profile ON (profile_id, consent_type, accepted_at DESC)`

**RLS:**
- SELECT: owning `profile_id` + manager/admin in same workspace
- INSERT: SECURITY DEFINER function or service role from Server Action — **never JWT-direct**
- NO UPDATE policy
- NO DELETE policy
- Immutability is intentional (Bokf. §13-style audit record)

**Note on scope vs ADR-0311:** this table captures identity-layer onboarding consent (handbook + GDPR + tariff acknowledgement). ADR-0311 governs payroll `trekk-samtykke` (Aml. §14-15) using `payroll.consent_document` + DocuSeal — a separate payroll-domain concern. Both coexist; this table does NOT replace ADR-0311's table.

#### `employee_onboarding_state` — cross-device resumability
**Migration:** `supabase/migrations/20260624000100_create_employee_onboarding_state.sql`

| Column | Type | Notes |
|---|---|---|
| `profile_id` | UUID PRIMARY KEY → `profile` ON DELETE CASCADE | one row per employee |
| `workspace_id` | UUID NOT NULL → `workspace` ON DELETE CASCADE | |
| `status` | TEXT NOT NULL DEFAULT `'in_progress'` CHECK (`in_progress` \| `dismissed` \| `completed`) | |
| `current_step_index` | INT NOT NULL DEFAULT `0` | resumes at this step |
| `step_data` | JSONB NOT NULL DEFAULT `'{}'::jsonb` | transient UI state only — NO PII, NO consent records |
| `started_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |
| `dismissed_at` | TIMESTAMPTZ | set on dismiss; CHECK enforces coherence with status |
| `completed_at` | TIMESTAMPTZ | set atomically with `profile.is_welcome_complete = true` |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT `now()` | |

Constraints:
- `CHECK ((status = 'completed') = (completed_at IS NOT NULL))` — status-timestamp coherence
- `CHECK ((status = 'dismissed') = (dismissed_at IS NOT NULL))` — status-timestamp coherence

Row creation: lazy UPSERT by BFF GET handler on first request. `profile welcome_wizard_started` fires on first creation.

`step_data` does NOT contain payroll PII or consent records — those write directly to their canonical tables at step commit.

`completed_at` is set in the same transaction as `profile.is_welcome_complete = true` (extended `completeWelcome` action).

**RLS:**
- SELECT own via JWT (`auth.uid()` → `profile_id`)
- UPDATE own via JWT
- INSERT own via JWT
- SELECT via API key (workspace_id match)

## Migrations

| File | What |
|---|---|
| `supabase/migrations/20260624000000_create_consent_acceptance.sql` | `consent_acceptance` table + RLS + index |
| `supabase/migrations/20260624000100_create_employee_onboarding_state.sql` | `employee_onboarding_state` table + RLS + triggers |

Pre-existing (shared, not introduced by this sortie):
- `supabase/migrations/20260514000010_secure_submit_own_pii.sql` — hardened PII RPC (binding write contract)
- `supabase/migrations/00003_governance_tables.sql` (identity-layer tables)

## Telemetry

All events in `packages/telemetry/src/registry.ts` under the `profile welcome_wizard_*` family (registry:636-665).

| Event | New? | Destinations | Notes |
|---|---|---|---|
| `profile welcome_wizard_started` | reused | posthog, logger, activity_trail | fires on first state-row creation |
| `profile welcome_wizard_step_completed` | reused | posthog, activity_trail | per-step; `{step: N}` metadata |
| `profile welcome_wizard_completed` | reused | **posthog, logger, activity_trail, engine_event** | `engine_event` destination is a downstream consumer dependency — do NOT remove (registry:14253-14268) |
| `profile welcome_wizard_skipped_optional` | reused | posthog, activity_trail | fired by `skipOptional` |
| `profile welcome_wizard_dismissed` | **NEW** | posthog, logger, activity_trail | no `engine_event` — dismissal does not drive downstream processes |
| `profile welcome_wizard_resumed` | **NEW** | posthog, logger, activity_trail | fired by `resumeWelcomeWizard` Server Action |

No new event family / namespace was introduced. The existing `profile welcome_wizard_*` convention is preserved exactly as required by R5 / D10.
