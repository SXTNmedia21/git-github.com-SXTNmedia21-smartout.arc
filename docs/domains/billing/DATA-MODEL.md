---
title: "Billing — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, data-model, schema, rls]
---

# Billing — Data Model

> Actual schema. **Code wins** — verified against migrations + `database.types.ts`. Enums enumerated directly from source, not guessed.

## Tables

All core billing tables live in the `public` schema (no dedicated billing schema for invoice tables, per ADR-0118 note in migration `20260521000000`). Accountant and settlement tables live in the `billing` schema.

| Table | Schema | company-scoped | workspace-scoped | Key columns | Primary migration |
|---|---|---|---|---|---|
| `invoice` | public | ✅ (`company_id`) | ❌ | `invoice_id`, `invoice_number`, `invoice_type`, `status`, `dunning_status`, `period_from`, `period_to`, `amount_incl_vat`, `pricing_terms_id`, `credits_invoice_id` | `20260417121720_invoice_table.sql` |
| `invoice_line_item` | public | via FK | ❌ | `line_item_id`, `invoice_id`, `line_type`, `quantity`, `unit_price`, `amount_incl_vat`, `usage_snapshot_id` | `20260417121917_invoice_line_item_table.sql` |
| `usage_snapshot` | public | ✅ | ✅ (NOT NULL, one row per workspace) | `usage_snapshot_id`, `company_id`, `workspace_id`, `period_from`, `period_to`, `active_users`, `billable_users`, `counted_profile_ids` (jsonb), `source_query_hash` | `20260417122044_usage_snapshot_table.sql` |
| `basis_drift_event` | public | via snapshot FK | via snapshot | `drift_event_id`, `usage_snapshot_id`, `invoice_id`, `shift_id`, `drift_type`, `old_value`, `new_value`, `resolution` | `20260417121720_invoice_table.sql` |
| `billing_activity_log` | public | ✅ | ❌ | `id`, `company_id`, `invoice_id`, `event`, `entity_type`, `entity_id`, `data`, `changes`, `actor_user_id` (→ user_identity), `source` | `20260417122417_billing_activity_log.sql` |
| `billing_dispatch_rule` | public | optional | optional | `dispatch_rule_id`, `workspace_id` (NULL=platform), `company_id` (optional scoping), `channel`, `trigger_event`, `target` (jsonb), `action`, `template_id` | `20260511200001_billing_dispatch_rule_table.sql` |
| `billing_dispatch_template` | public | ❌ | ❌ | `template_id`, `name`, `channel`, `subject`, `body_template` | `20260511200002_billing_dispatch_template_table.sql` |
| `invoice_dispatch` | public | via FK | ❌ | `invoice_dispatch_id`, `invoice_id`, `dispatch_rule_id`, `channel`, `target` (jsonb snapshot), `status`, `engine_state_id`, `attempts`, `delivered_at`, `external_reference` | `20260511200003_invoice_dispatch_table.sql` |
| `billing_integration` | public | ❌ | optional | `integration_id`, `workspace_id` (NULL=platform), `integration_type`, `config` (jsonb, op:// refs only), `is_enabled`, `is_placeholder`, `last_sync_at` | `20260511200004_billing_integration_table.sql` |
| `billing_product` | public | ❌ | optional | `product_id`, `workspace_id` (NULL=platform preset), `name`, `default_unit_price`, `default_vat_rate`, `currency`, `is_active` | `20260515170000_billing_product_catalog.sql` |
| `payment` | public | ✅ | ❌ | `payment_id`, `invoice_id`, `company_id` (snapshot), `payment_method`, `amount`, `status`, `external_id` (Stripe pi_*), `paid_at`, `refunded_amount` | `20260512000002_payment_table.sql` |
| `payment_attempt` | public | via FK | ❌ | `payment_attempt_id`, `payment_id`, `stripe_event_id` (UNIQUE), `redacted_payload` (jsonb, PII-whitelisted) | (Fase 3A migrations) |
| `billing.accountant_company_grant` | billing | ✅ | ❌ | `grant_id`, `user_id`, `company_id`, `scope`, `granted_by`, `granted_at`, `revoked_at` | `20260521000100_billing_accountant_grant.sql` |
| `billing.settlement_period` | billing | ❌ | ✅ | `period_id`, `workspace_id`, `period_start`, `period_end`, `status`, `locked_at`, `locked_by` | `20260522000000_billing_settlement_schema.sql` |
| `billing.settlement_run` | billing | ❌ | ✅ (via period) | `run_id`, `scope`, `initiated_by`, `period_start`, `period_end`, `workspace_ids`, `started_at`, `completed_at`, `status`, `summary` (jsonb), `error_message` — immutable append-only; each "Kjør avstemming" click = new row | `20260522000000_billing_settlement_schema.sql` |
| `billing.settlement_artifact` | billing | ❌ | ✅ (via run) | `artifact_id`, `run_id`, `artifact_type` (summary_pdf/detail_csv/invoice_bundle_pdf/discrepancy_pdf), `storage_path`, `file_size_bytes`, `generated_at` | `20260522000000_billing_settlement_schema.sql` |

> **Note:** `invoice.delivery_channel`, `delivery_status`, `external_reference` were dropped in migration `20260512000012_drop_invoice_delivery_columns.sql` (Fase 3A B6). MODULE_BILLING.md referenced these columns — they are gone. Use `invoice_dispatch` table for delivery state (ADR-0128).

## Enums

All verified from `packages/supabase/src/database.types.ts` (lines 24440–25099 Enums section) and corresponding migration DDL.

### `public` schema enums

| Enum | Values | Source |
|---|---|---|
| `invoice_type` | `recurring`, `onboarding`, `credit_note`, `one_off` | `database.types.ts:24740`; migration `20260417121600_invoice_enums.sql` |
| `invoice_status` | `draft`, `issued`, `sent`, `paid`, `overdue`, `void`, `uncollectible` | `database.types.ts:24731`; migration `20260417121600` |
| `dunning_status` | `none`, `in_negotiation`, `reminder_sent`, `escalated`, `reminder_1`, `reminder_2`, `collection_notice` | `database.types.ts:24653` — **DEVIATION from Fase 1 spec**: spec had 4 values; Fase 3A added `reminder_1`, `reminder_2`, `collection_notice` for automated dunning ladder |
| `invoice_line_type` | `base_plan`, `user_overage`, `addon`, `onboarding`, `adjustment` | `database.types.ts:24724`; migration `20260417121600` |
| `billing_dispatch_channel` | `email_customer`, `email_internal`, `http_api`, `peppol_ehf`, `stripe_invoice` | `database.types.ts:24486` — note: `peppol_ehf` exists for forward-compat; no adapter |
| `dispatch_status` | `pending`, `in_flight`, `delivered`, `failed`, `bounced` | `database.types.ts:24636`; migration `20260511200000_billing_fase2_enums.sql` |
| `dispatch_rule_action` | `send`, `suppress` | `database.types.ts:24635`; migration `20260511200000` |
| `billing_integration_type` | `fiken`, `tripletex`, `stripe`, `placeholder` | `database.types.ts:24493`; migration `20260511200000` |
| `payment_method_type` | `stripe_card`, `stripe_bank`, `bank_transfer`, `manual_adjustment`, `accountant_manual` | `database.types.ts:24873` |
| `payment_status` | `pending`, `processing`, `succeeded`, `failed`, `refunded`, `partially_refunded` | `database.types.ts:24880` |

### `billing` schema enums

| Enum | Values | Source |
|---|---|---|
| `billing.accountant_grant_scope` | `orders_only`, `full_kartotek` | `database.types.ts:255`; migration `20260521000100_billing_accountant_grant.sql` |

### Application enums (Zod, not DB)

| Enum | Values | Source |
|---|---|---|
| `VoidReason` | `duplicate`, `fraudulent`, `order_change`, `product_unsatisfactory`, `issued_in_error`, `other` | `packages/billing/src/schemas.ts:12` (`VoidReasonSchema`) — matches Fase 1 spec §8.1 exactly (verified 2026-05-22) |
| `billing.settlement_status` | `open`, `locked`, `closed` | `database.types.ts:263`; migration `20260522000000_billing_settlement_schema.sql` |
| `billing.settlement_run_status` | `running`, `succeeded`, `failed`, `cancelled` | migration `20260522000000` |
| `billing.settlement_artifact_type` | `summary_pdf`, `detail_csv`, `invoice_bundle_pdf`, `discrepancy_pdf` | migration `20260522000000` |
| `billing.settlement_scope` | `single_workspace`, `all_workspaces` | migration `20260522000000` |

## FK map

```
invoice
  ├── company_id → public.company.company_id
  ├── pricing_terms_id → public.pricing_terms.pricing_terms_id (ON DELETE RESTRICT)
  ├── credits_invoice_id → public.invoice.invoice_id (self-ref, credit notes only)
  ├── voided_by → public.user_identity.user_id
  └── created_by → public.user_identity.user_id

invoice_line_item
  ├── invoice_id → public.invoice.invoice_id (ON DELETE RESTRICT)
  └── usage_snapshot_id → public.usage_snapshot.usage_snapshot_id (nullable)

usage_snapshot
  ├── company_id → public.company.company_id
  └── workspace_id → public.workspace.workspace_id
  UNIQUE (company_id, workspace_id, period_from, period_to)

basis_drift_event
  ├── usage_snapshot_id → public.usage_snapshot.usage_snapshot_id
  ├── invoice_id → public.invoice.invoice_id (nullable)
  └── reviewed_by → public.user_identity.user_id

billing_activity_log
  ├── company_id → public.company.company_id
  ├── invoice_id → public.invoice.invoice_id (nullable)
  └── actor_user_id → public.user_identity.user_id (nullable; platform-level actor)

billing_dispatch_rule
  ├── workspace_id → public.workspace.workspace_id (nullable = platform baseline)
  ├── company_id → public.company.company_id (optional scoping)
  ├── template_id → public.billing_dispatch_template.template_id
  └── created_by → public.user_identity.user_id

invoice_dispatch
  ├── invoice_id → public.invoice.invoice_id
  ├── dispatch_rule_id → public.billing_dispatch_rule.dispatch_rule_id (nullable)
  └── engine_state_id → public.engine_state.id (nullable)

billing_integration
  └── workspace_id → public.workspace.workspace_id (nullable = platform)

billing_product
  └── workspace_id → public.workspace.workspace_id (nullable = platform preset)

payment
  ├── invoice_id → public.invoice.invoice_id
  └── company_id → public.company.company_id (snapshot)

billing.accountant_company_grant
  ├── user_id → public.user_identity.user_id (ON DELETE CASCADE)
  ├── company_id → public.company.company_id (ON DELETE CASCADE)
  ├── granted_by → public.user_identity.user_id
  └── revoked_by → public.user_identity.user_id (nullable)

billing.settlement_period
  └── workspace_id → public.workspace.workspace_id (ON DELETE RESTRICT)
```

## RLS posture

### `public` tables — company-admin read + service-role write

| Table | Policy / posture | Helper used |
|---|---|---|
| `invoice` | `invoice_company_admin_read`: SELECT if `is_admin_in_company(auth.uid(), company_id)` OR `billing.is_accountant_for_company(company_id)` | `is_admin_in_company`, `billing.is_accountant_for_company` |
| `invoice_line_item` | `invoice_line_item_company_admin_read`: EXISTS join to parent invoice | Same helpers via invoice |
| `usage_snapshot` | `usage_snapshot_company_admin_read` | `is_admin_in_company` |
| `basis_drift_event` | RLS enabled, no public policy — platform-admin only via service_role | — |
| `billing_activity_log` | `billing_log_company_admin_read` | `is_admin_in_company` |
| `billing_dispatch_rule` | Platform-admin + workspace-admin (workspace_id match) | — |
| `invoice_dispatch` | Via invoice JOIN (company-scoped) | — |
| `billing_integration` | godmode + workspace admin | — |
| `billing_product` | godmode read + service_role write | — |
| `payment` | Via invoice company_id | `is_admin_in_company` |

**Views with revoked anon/authenticated grants:**
- `v_current_plan_preview` — service_role + postgres only (migration `20260417125541_billing_view_rls_hardening.sql`)
- `v_invoice_dunning_notes` — service_role + postgres only (same migration)

**No API key RLS policies.** Billing is an internal platform surface. No workspace API key should read invoice data. Intentional.

**Write posture:** Platform-admin mutations run via Server Actions with service-role client after `getSuperAdminId()` gate. No direct client mutations from the browser.

### `billing` schema — self-select + service_role

| Table | Policy |
|---|---|
| `billing.accountant_company_grant` | `accountant_company_grant_self_select`: `user_id = auth.uid() AND revoked_at IS NULL` |
| `billing.settlement_period/run/artifact` | RLS per migration `20260522000100_billing_settlement_rls.sql` |

**SECURITY DEFINER helpers:**
- `billing.get_accountant_company_ids(p_user_id uuid) → uuid[]` — returns companies an accountant has active grants for
- `billing.is_accountant_for_company(p_company_id uuid) → boolean` — predicate used in `public.invoice` RLS

Anchor: `supabase/migrations/20260521000100_billing_accountant_grant.sql` — `CREATE OR REPLACE FUNCTION billing.get_accountant_company_ids`

## Telemetry events

All billing events are registered in `packages/telemetry/src/registry.ts` (around line 6184 — anchor: comment `ADR-0118: C3 Commercial consumer`).

| Event | Destinations | Emitted at |
|---|---|---|
| `invoice generated` | posthog, logger, billing_activity_log, engine_event | Draft invoice written by cron |
| `invoice issued` | posthog, logger, billing_activity_log, engine_event | `draft → issued` transition |
| `invoice sent` | logger, billing_activity_log, engine_event | Delivery confirmation |
| `invoice marked_paid` | posthog, logger, billing_activity_log, engine_event | Payment registered |
| `invoice voided` | logger, billing_activity_log, engine_event | Status → void |
| `invoice marked_uncollectible` | logger, billing_activity_log, engine_event | Written off |
| `invoice overdue_detected` | logger, billing_activity_log, engine_event | Cron flips issued/sent past due_at |
| `invoice generation_missing` | logger, billing_activity_log | Company has no non-void invoice for previous month |
| `invoice credit_note_issued` | logger, billing_activity_log, engine_event | Credit note created |
| `invoice basis_drift_detected` | logger, billing_activity_log, engine_event | Trigger on retroactive shift change |
| `invoice dispatched` | logger, billing_activity_log | Dispatch attempt succeeded |
| `invoice dispatch failed` | logger, billing_activity_log | Dispatch attempt failed |
| `invoice dispatch retried` | logger, billing_activity_log | Retry triggered |
| `invoice dunning_escalated` | logger, billing_activity_log | Dunning ladder step |
| `invoice line_item added/edited/removed` | logger, billing_activity_log | Manual line item mutations |
| `invoice adhoc_created` | posthog, logger, billing_activity_log | Ad-hoc one_off invoice |
| `usage_snapshot created` | logger, billing_activity_log | Per-workspace snapshot frozen |
| `pricing_terms updated` | posthog, logger, billing_activity_log | Admin edits pricing |
| `dunning_note added` | logger, billing_activity_log | Manual dunning note |
| `billing ehf_export_generated` | logger, billing_activity_log | EHF CSV/PDF exported |
| `billing accountant_marked_paid` | logger, billing_activity_log | Accountant marks invoice paid |
| `order list_viewed` | posthog, logger, billing_activity_log | Accountant views order list in `apps/admin/orders` |
| `order detail_viewed` | posthog, logger, billing_activity_log | Accountant views order detail in `apps/admin/orders/[id]` |
| `order marked_received` | posthog, logger, billing_activity_log | Accountant marks invoice paid via `markReceivedAction` |
| `settlement run_initiated` | posthog, logger, billing_activity_log | Accountant triggers `runSettlement` in `apps/admin/avstemming/run` |
| `kartotek viewed` | posthog, logger, billing_activity_log | Accountant views workspace kartotek in `apps/admin/workspaces/[id]` |

**Note on `workspace_id: null`:** admin-app telemetry emits with `workspace_id: null` because accountant operations are company-scoped (across multiple workspaces). This is intentional per the accountant role design. The `entity_id` field carries the relevant `invoice_id` or `settlement_run.run_id` for audit tracking.

**Note:** spec events used dot notation (`invoice.issued`); the actual registry uses space-separated (`invoice issued`) per ADR-0118 telemetry convention. Code wins — space-separated is correct. `registry.ts:6185` anchor: `space-separated convention`.

**Vitest assertion coverage:** `packages/telemetry/src/__tests__/billing-emit.spec.ts` asserts each billing mutation calls `emit()` with the expected event shape.
