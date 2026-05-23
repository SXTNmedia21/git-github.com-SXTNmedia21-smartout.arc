---
title: "Contracts — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, database, schema, rls, migrations, telemetry]
---

# Contracts — Data Model

> All tables verified against `supabase/migrations/`. Migration line hints are approximate (±10 lines). CODE WINS.

## Core Tables

### `public.employment_contract` — D2 Resource (primary)

**Created:** `supabase/migrations/00012_profile_logs_and_contracts.sql:57`
**Extended by:** `20260519100100_contracts_module_foundation.sql`, `20260515100300_employment_contract_detail.sql`, `20260501100000_contract_status_pending_data.sql`, `20260501100100_contract_status_declined.sql`, `20260501100200_employment_contract_composition_columns.sql`, `20260515100100_employment_contract_tripletex_columns.sql`, `20260519095100_contract_status_enum_values.sql`

Key columns (from foundation + extensions):
- `contract_id` uuid PK
- `workspace_id` uuid FK → `workspace`
- `profile_id` uuid FK → `profile` (D2 anchor)
- `status` enum (`contract_status`: draft, proposed, pending, active, amending, archived, declined, migration_incomplete)
- `position_title`, `employment_category`, `employment_percentage`
- `hourly_rate`, `monthly_salary`, `start_date`, `end_date`
- `document_url`, `signature_id`, `signed_at`
- Tripletex columns (added `20260515100100`): `tripletex_employee_id`, `tripletex_contract_id`, etc.
- `composition_*` columns (ADR-0076): `composition_source`, `composition_version`, `composition_locked_at`
- `superseded_by_contract_id` (parallel contracts, ADR-0001/0024)
- `created_by`, `created_at`, `updated_at`

**RLS:** `workspace_id` gate. JWT + API key policies. See `20260301100000_api_key_rls_policies.sql`.

---

### `public.employment_contract_detail` — Amendment versioning

**Created:** `supabase/migrations/20260515100300_employment_contract_detail.sql:8`

Stores per-amendment detail rows. One row per material change requiring employee acknowledgement (ADR-0111). The `employment_contract` row remains the source of truth; detail rows are the versioned supplement.

Key columns: `detail_id`, `contract_id` FK → `employment_contract`, `field_name`, `old_value`, `new_value`, `changed_by`, `acknowledged_at`, `created_at`

---

### `public.contract` — Platform/client contracts

**Evolved from:** `platform_contract_instance` (renamed in `20260228140000_contract_system_foundation.sql:~20`)

Tracks workspace-onboarding client agreements. Shares DocuSeal infrastructure with employment contracts but has a lighter lifecycle.

Key columns: `contract_id`, `template_id` FK → `contract_template`, `company_id`, `workspace_id`, `title`, `status`, `docuseal_submission_id`, `field_values`, `signatories`, `sent_at`, `signed_at`, `expires_at`, `document_url`, `resolved_html`, `resolved_values`, `recipient_name`, `recipient_email`, `signed_pdf_url`, `audit_log_url`, `journey_type`, `auto_create_workspace`, `metadata`

---

### `public.contract_template` — Factory templates

**Evolved from:** `platform_contract_template` (renamed in `20260228140000_contract_system_foundation.sql:~12`)
**Extended:** `20260228210000_contract_template_attachments.sql`, `20260330100200_update_contract_template_design.sql`, `20260515170200_contract_template_lineage_columns.sql`, `20260515170300_contract_template_is_system_immutability.sql`, `20260515170400_contract_template_rls_workspace_vs_platform.sql`

Key columns: `template_id`, `workspace_id` (nullable = platform-level template), `name`, `contract_type`, `language`, `content_html`, `content_css`, `header_html`, `footer_html`, `placeholders` jsonb, `version`, `is_system` bool, `is_active` bool, `docuseal_template_id`, `lineage_parent_id` (template fork lineage)

**RLS split (`20260515170400`):** platform-level templates (workspace_id IS NULL) readable by all workspace users; workspace-level templates gated by workspace_id.

---

### `public.contract_template_attachment` — Template file attachments

**Created:** `supabase/migrations/20260228210000_contract_template_attachments.sql`
**Extended:** `20260311111000_contract_template_attachments.sql`

Key columns: `attachment_id`, `template_id` FK → `contract_template`, `file_url`, `file_name`, `mime_type`, `order_index`

---

### `public.contract_template_binding` — Workspace template assignment

**Created:** `supabase/migrations/20260422120000_contract_template_binding.sql:10`

Wires a workspace to a template for a given role + department without touching live contracts (ADR-0182). One binding per workspace+role+department combination.

Key columns: `binding_id`, `workspace_id`, `template_id` FK → `contract_template`, `role_class`, `department_id`, `is_default` bool, `created_at`, `updated_at`

---

### `public.contract_pay_rule` — Compensation rules per contract

**Created:** `supabase/migrations/20260519100100_contracts_module_foundation.sql:636`

Stores structured pay rules (base rate, overtime, supplements, tips, commission) per employment contract. Consumed by payroll capability for rate resolution.

Key columns: `pay_rule_id`, `contract_id` FK → `employment_contract`, `rule_type` enum, `value`, `currency`, `effective_from`, `effective_to`, `metadata` jsonb

---

### `public.contract_tip_rule` — Tips rules per contract

**Created:** `supabase/migrations/20260519100100_contracts_module_foundation.sql:702`

Key columns: `tip_rule_id`, `contract_id` FK, `distribution_type` (shift/stilling/pool), `percentage`, `notes`

---

### `public.contract_obligation` — Operational obligations

**Created:** `supabase/migrations/20260519100100_contracts_module_foundation.sql:762`

Training + certification + activity requirements attached to the contract. The day-session readiness gate reads these to determine if an employee is cleared for shifts.

Key columns: `obligation_id`, `contract_id` FK, `obligation_type` enum (training/certification/activity), `name`, `description`, `is_mandatory` bool, `due_date`, `completed_at`, `notified_at` (added `20260519180000`)

---

### `public.contract_amendment` — Amendment lifecycle

**Created:** `supabase/migrations/20260519100100_contracts_module_foundation.sql:848`

Each amendment request creates a row here. The amendment moves through draft → proposed → accepted/rejected before applying changes to the `employment_contract` row and creating `employment_contract_detail` version records.

Key columns: `amendment_id`, `contract_id` FK, `amendment_type`, `status` enum, `proposed_by`, `proposed_at`, `accepted_at`, `rejected_at`, `requires_employee_signature` bool (ADR-0244 proposed), `change_summary` jsonb, `created_at`

---

### `public.contract_attachment` — Per-contract file attachments

**Created:** `supabase/migrations/20260320120001_contract_attachment.sql:4`

Individual file attachments on a specific contract instance (not template-level). Added as part of ADR-0024 enhancements.

Key columns: `attachment_id`, `contract_id` FK → `contract`, `file_url`, `file_name`, `mime_type`, `uploaded_by`, `uploaded_at`

---

### Supporting tables (created in foundation migrations)

| Table | Migration | Purpose |
|---|---|---|
| `public.contract_event` | `20260228140000:97` | Immutable audit trail of lifecycle events |
| `public.contract_reminder` | `20260228140000:114` | Scheduled reminder records for unsigned contracts |
| `public.message_template` | `20260228140000:137` | Notification body templates (seeded in `20260228140100`, `20260414072301`) |
| `public.clause_library` | `20260228140000:157` | Reusable clause snippets for template authoring |

### Lookup/enum tables (from `contracts_module_foundation`)

| Table | Migration:line | Purpose |
|---|---|---|
| `public.salary_type` | `20260519100100:172` | Salary type enum (fast/deltid/tilkalling/...) |
| `public.end_date_reason` | `20260519100100:207` | Termination reason codes |
| `public.pension_scheme` | `20260519100100:243` | Pension scheme definitions |
| `public.capability_default_registry` | `20260518000000:132` | Default authority config per capability |

## Migration Groups

| Group | Migrations | Phase |
|---|---|---|
| Foundation | `00012`, `20260228140000` | Early platform contracts + audit |
| Templates | `20260228140100`, `20260228210000`, `20260228210100`, `20260311110000`, `20260311111000`, `20260330100200` | Template system |
| Attachment | `20260320120001` | Per-contract attachments |
| Notification | `20260414072300`, `20260414072301` | Event-driven notifications |
| Intake fix | `20260417141000` | Engine-state filter for intake |
| Binding | `20260422120000` | Template binding ADR-0182 |
| Payroll sync | `20260422400200` | cascade_contract_payroll_sync trigger |
| Signing | `20260428210000`, `20260430182443` | Employee signing + audit trail trigger |
| Status / composition | `20260501100000`–`20260501200000` | Status enum extensions + composition columns |
| Engine process seed | `20260501110000` | Engine process seeds for contract lifecycle |
| GDPR anonymize | `20260501120000` | Anonymize RPC (GDPR Art. 17) |
| Intake completion | `20260505100000` | Contract intake completion fields |
| Tripletex / detail | `20260515100100`–`20260515170500` | Tripletex columns, detail versioning, lineage, authority seed |
| Authority bootstrap | `20260518000000` | Authority seed upsert + capability_default_registry |
| Module foundation | `20260519095100`–`20260519180000` | employment_contract + pay/tip/obligation/amendment tables, status cast, obligation notified_at |
| Workspace FK | `20260519100001` | workspace.active_contract_id FK |
| Event engine | `20260520120000`–`20260520120100` | Event Engine trigger for contract events |
| Status timestamps | `20260615100100` | Auto-stamp trigger |
| PDF preview | `20260615200100` | `pdf_preview_viewed_at` column |
| Authority seed v2 | `20260616100300` | engine_authority_config contract seed |
| DocuSeal unique | `20260616100500` | Unique constraint on `docuseal_submission_id` |
| Template URL fix | `20260620110000` | Fix message template URLs |
| Event URL update | `20260621000000` | Contract event trigger URL update |

**Total: 44 contract migrations** (verified by `ls supabase/migrations/ | grep contract | wc -l`).

## Telemetry

Events in `packages/telemetry/src/registry.ts`:

**Contract instance events (lines 1636–1701):**
- `contract created` (1636)
- `contract sent` (1650)
- `contract viewed` (1661)
- `contract signed` (1674)
- `contract cancelled` (1685)
- `contract declined` (1693)
- `contract expired` (1701)

**Contract template events (lines 2321–2427):**
- `contract_template copied` (2321)
- `contract_template forked` (2346)
- `contract_template created` (2358)
- `contract_template clause_updated` (2369)
- `contract_template published` (2382)
- `contract_template unpublished` (2394)
- `contract_template renamed` (2404)
- `contract_template deprecated` (2415)
- `contract_template deleted` (2427)

**Contract UI events (lines 2444–2465):**
- `contract.hub_viewed` (2444)
- `contract.tab_switched` (2454)
- `contract.botsson_chip_invoked` (2465)

**Total: 19 contract telemetry event types.**

**Profile activation via contract** (line 568): `profile activated` event references `contract_id` + `submission_id` as payload.

## RLS Summary

All workspace-scoped tables have `workspace_id` RLS gate. Platform-level templates (workspace_id IS NULL) are readable by all authenticated users (`20260515170400`). High-PII columns on `profile` (personnummer, bank_account) have separate RPC-controlled access tier (ADR-0077). Contract-service uses service-role for webhook processing; all other operations use JWT.
