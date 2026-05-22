---
title: "Billing — Gaps & Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, gaps, debt]
---

# Billing — Gaps & Debt

> The bridge between built and planned. Every claim cited.

## 1. Verification method

- **CODE** = grepped, path + grep-able anchor cited.
- **ROADMAP / SPEC / PLAN** = target/intent described in ROADMAP.md or a `docs/superpowers/{specs,plans}` source.
- **GAP** = intent with no matching code. **DEVIATION** = code differs from intent (§4b). **CONFIRMED** = code matches → lives in the spine, not here.

## 2. Working (shipped + verified)

| # | Capability | Evidence |
|---|---|---|
| W1 | Schema: `invoice`, `invoice_line_item`, `usage_snapshot`, `basis_drift_event`, `billing_activity_log` | `supabase/migrations/20260417121720_invoice_table.sql` |
| W2 | Invoice enums (4 Fase-1 types) + Fase-2 dispatch enums | `supabase/migrations/20260417121600_invoice_enums.sql` + `20260511200000_billing_fase2_enums.sql` |
| W3 | Triggers: `assign_invoice_number` (draft→issued), immutability, nested-credit-note prohibition | `supabase/migrations/20260417123340_invoice_trigger_functions_hardened.sql` |
| W4 | Views: `v_current_plan_preview`, `v_invoice_dunning_notes`, `get_invoice_basis()` function | `supabase/migrations/20260417123548_billing_views.sql` |
| W5 | RLS: 4 company-admin-read policies + basis_drift platform-admin | `supabase/migrations/20260417123732_billing_rls_policies.sql` |
| W6 | View RLS hardening (anon/authenticated grants revoked) | `supabase/migrations/20260417125541_billing_view_rls_hardening.sql` |
| W7 | `invoice_lifecycle` engine_process seed | `supabase/migrations/20260417123908_invoice_lifecycle_engine_process.sql` |
| W8 | `billing_query` AI capability — 6 tools registered at all 4 touchpoints | `packages/ai/src/capabilities/billing-query/tools.ts` `list_my_invoices`; `packages/ai/src/capabilities/types.ts:37`; `packages/ai/src/router/intent-classifier.ts:56` |
| W9 | `resolveCompanyId` helper (fail-fast, ADR-0177 pattern) | `packages/ai/src/lib/resolveCompanyId.ts` |
| W10 | `billing_activity_log` telemetry provider | `packages/telemetry/src/providers/billing-activity-log.ts` |
| W11 | `billing_dispatch_rule` + `billing_dispatch_template` + `invoice_dispatch` (Fase 2) | `supabase/migrations/20260511200001–20260511200003` |
| W12 | `billing_integration` table + `PlaceholderAdapter` (is_placeholder gate) | `supabase/migrations/20260511200004_billing_integration_table.sql`; `packages/billing/src/dispatch/registry.ts` |
| W13 | Dispatch adapters: email_customer, email_internal, http_api, stripe_invoice | `packages/billing/src/dispatch/registry.ts` `ADAPTER_REGISTRY` |
| W14 | `invoice_line_item` immutability trigger (Fase 2) | `supabase/migrations/20260511200005_invoice_line_item_immutability_trigger.sql` |
| W15 | `generate-monthly-invoices` Edge Function | `supabase/functions/generate-monthly-invoices/index.ts` comment `Cron-triggered billing generator` |
| W16 | `stripe-webhook` Edge Function (Fase 3A) | `supabase/functions/stripe-webhook/index.ts` comment `Billing Engine Fase 3A` |
| W17 | `payment` + `payment_attempt` tables | `supabase/migrations/20260512000002_payment_table.sql` |
| W18 | `invoice.delivery_*` columns dropped (ADR-0128, ADR-0144) | `supabase/migrations/20260512000012_drop_invoice_delivery_columns.sql` |
| W19 | EHF CSV export (`generateEhfExport`) | `packages/billing/src/actions/ehf-export/generateEhfExport.ts` comment `Fase 3B B3 platform-admin CSV export builder` |
| W20 | `billing.accountant_company_grant` + SECURITY DEFINER helpers | `supabase/migrations/20260521000100_billing_accountant_grant.sql` `CREATE TABLE billing.accountant_company_grant` |
| W21 | `billing` schema created | `supabase/migrations/20260521000000_billing_schema_create.sql` |
| W22 | Settlement tables (`billing.settlement_*`) | `supabase/migrations/20260522000000_billing_settlement_schema.sql` |
| W23 | `billing_product` catalog | `supabase/migrations/20260515170000_billing_product_catalog.sql` |
| W24 | `fn_generate_company_invoice` RPC + pg_cron trigger | `supabase/migrations/20260621200003_pg_cron_generate_monthly_invoices.sql` |
| W25 | Platform-admin UI (all routes: invoices, dunning, drift, export, ehf-export, payments, settings/dispatch, integrations) | `apps/web/src/app/platform-admin/billing/` directory confirmed |
| W26 | Workspace-admin UI (billing list + detail + settings) | `apps/web/src/app/dashboard/billing/` directory confirmed |
| W27 | `InvoiceStatusBadge` in `packages/ui` | `packages/ui/src/components/invoice-status-badge.tsx` |
| W28 | Telemetry billing-emit spec | `packages/telemetry/src/__tests__/billing-emit.spec.ts` |
| W29 | `billing_query_authority_seed` | `supabase/migrations/20260417170000_billing_query_authority_seed.sql` |

## 3. Gaps (planned, not built)

| # | Gap | Severity | Blocking? | Roadmap phase |
|---|---|---|---|---|
| G1 | pg_cron not confirmed enabled in prod (ADR-0388). `fn_generate_company_invoice` pg_cron job registered in migration but prod pg_cron enablement unverified. | high | no | Gate before next main release |
| G2 | `peppol_ehf` dispatch adapter class not implemented. Enum + interface exists; adapter class is intentionally absent (`packages/billing/src/dispatch/registry.ts:20`). | med | no | Fase 3B remainder (pending Digdir cert + AP provider selection) |
| G3 | `PlatformAdminToolContext` AI tools not built (cross-workspace billing tools: `list_all_overdue`, `mark_paid_by_natural_language`). Blocked on ADR. | med | no | Separate ADR + phase |
| G4 | ADR-0269 (accountant portal) still `proposed`. Accountant portal UI (grant management, `/platform-admin/accountant/` route) not built beyond base tables + RLS. | med | no | Pending ADR acceptance |
| G5 | `dunning_escalation_scan` engine_process seeded but runtime not verified running in production. | med | no | Fase 3A follow-up |
| G6 | Bidirectional Fiken/Tripletex sync — `is_placeholder=true` adapters only in prod. Real adapters not implemented. | med | no | Fase 3B remainder |
| G7 | SendGrid dunning reminder templates (friendly / formal / final) not wired. | med | no | Auto-dunning phase |
| G8 | Stripe customer portal / Stripe Checkout flow — workspace-admin "Betal nå" button present (`StripeRedirectInterstitial.tsx`) but full Checkout lifecycle verification pending. | med | no | Fase 3A follow-up |
| G9 | E2E test coverage for Fase 3A (Stripe payments, dunning) is partial. | low | no | Test phase |

## 4. Debt (built, but owes work)

| # | Debt | Risk | Cost |
|---|---|---|---|
| D1 | `dunning_status` enum has 3 Fase-3A values (`reminder_1`, `reminder_2`, `collection_notice`) but the original Fase-1 dunning CHECK constraint (`invoice_status_dunning_legal`) may not cover all combinations. Verify constraint covers new enum values. | med | 1 migration |
| D2 | `is_admin_in_company()` RLS helper references `company_member.role IN ('admin','owner')`. If company membership roles expand, the helper must be updated. | low | 1 migration |
| D3 | `v_invoice_dunning_notes` view reads from `activity_trail` with `event = 'dunning_note.added'` (dot notation). Registry uses space-separated `dunning_note added`. If events were written with dot notation (spec), the view may return no rows. Verify event name consistency in production activity_trail. | med | 1 query + potential migration |
| D4 | `payment_terms_days` added in migration `20260621200004_pricing_terms_payment_terms_days.sql` but no E2E test covers due_at computation using this new field. | low | test coverage |
| D5 | MODULE_BILLING.md references `delivery_channel` / `delivery_status` columns in §8 (spec quote) — stale since `20260512000012` dropped them. MODULE_BILLING is being archived (see §5 below), but anyone reading it before the archive note is visible may be misled. | low | fix: archive note added in this run |

## 4b. Deviations (code ≠ spec/plan)

| # | Source spec/plan | Spec said | Code does | Why (if known) |
|---|---|---|---|---|
| DEV1 | Fase 1 spec §5.5 + MODULE_BILLING §5 | Dunning notes via `activity_trail` only, no dedicated table | `billing_activity_log` is the audit destination (ADR-0125 superseded original plan). `v_invoice_dunning_notes` view still reads from `activity_trail` — may be stale | ADR-0125 replaced `activity_trail` for billing events. View needs audit for consistency |
| DEV2 | Fase 1 spec §5.8 / ADR-0120 | `dunning_status` enum: 4 values (`none`, `in_negotiation`, `reminder_sent`, `escalated`) | 7 values in `database.types.ts:24653` — Fase 3A added `reminder_1`, `reminder_2`, `collection_notice` for auto-dunning ladder | Automated dunning (ADR-0143) required new ladder steps |
| DEV3 | Fase 1 spec §7, MODULE_BILLING §7 | Telemetry events in dot notation (`invoice.issued`, `invoice.marked_paid`) | Space-separated (`invoice issued`, `invoice marked_paid`) per registry comment at line 6185 | ADR-0118 telemetry convention; space-separated is correct |
| DEV5 | Fase 2 spec — `stripe_invoice` adapter channel | Not in original Fase 2 spec (Stripe was Fase 3) | `billing_dispatch_channel` includes `stripe_invoice`; `StripeDispatchAdapter` registered in `ADAPTER_REGISTRY` | Dispatch adapter added during Fase 3A to unify dispatch mechanics |
| DEV6 | Fase 1 spec §6.1 / plan | Cron trigger via n8n POST to EF | pg_cron job (migration `20260621200003`) — ADR-0386 chose pg_cron over n8n | ADR-0386: pg_cron preferred for billing generation |
| DEV7 | MODULE_BILLING.md §11 | "What Exists Today (Fase 1)": 11 migrations, 5 billing tables, 4 enums, 3 views, 3 functions, 5 triggers | As of 2026-05-22: 46+ billing-related migrations, 12+ tables, 10+ enums, additional views, 4 Fase complete | Normal evolution; MODULE_BILLING captures Fase 1 snapshot only |
| DEV8 | Previous ARCHITECTURE.md (prior to 2026-05-22 update) | Admin billing surface = `apps/web/src/app/platform-admin/billing/` | Canonical accountant/admin surface is `apps/admin/` — a separate Next.js app at `admin.smartout.ai` (port 3070). `apps/web/platform-admin/billing/` is still live and serves internal Smartout staff (superadmin scope), not external accountants. Two parallel surfaces, different actors. | `apps/admin/` was built as the new order system ("ordresystem") per Pontus 2026-05-22. The doc erroneously made `platform-admin/billing` the L1 admin entry point. |

## 5. Overlap with other domains

| Overlapping domain | Shared surface | Recommendation | Rationale |
|---|---|---|---|
| settlement (future domain) | `billing.settlement_period`, `billing.settlement_run`, `billing.settlement_artifact` — workspace-internal cash/revenue reconciliation by accountant | **keep in billing domain for now, with clear seam** (revised from original "split" recommendation — see note) | See note below. |
| accountant-portal (future domain) | `billing.accountant_company_grant` — cross-company accountant access | **keep (clear seam)** for now | Grant table is a billing data-access mechanism. If accountant portal grows significantly (its own UI, onboarding, multi-company dashboard beyond billing), promote to own domain. ADR-0269 acceptance is the natural trigger point. |
| payroll | `pricing_terms` read path | **keep** — payroll reads pricing_terms for tariff/cost reasons; billing owns the billing extension columns | Clear FK boundary. No write conflict. |
| procedure-engine / daytimeline | `schedule_shift` read path | **keep** — billing reads `schedule_shift` for usage metering; D6 domain owns the table | Read-only dependency, well-defined ADR-0119 predicate. |

**Settlement/avstemming overlap — revised decision (2026-05-22):**

The prior recommendation was to **split** settlement tables out to a future `settlement` or `daily-operation` domain. After examining the actual code in `apps/admin/`, the recommendation is revised to **keep in billing** with a clear seam:

- `apps/admin/src/lib/avstemming/fetchers.ts` queries `billing.settlement_run` + `billing.settlement_artifact` directly, and calls `billing.compute_period_aggregates` RPC.
- `apps/admin/src/lib/avstemming/actions.ts` delegates to `executeSettlementRun` from `@smartout/billing/server/settlement`.
- The `/avstemming/run` and `/avstemming/historikk` pages are **accountant-facing billing reconciliation** — the accountant reconciles what Smartout earned/invoiced for a period. This is conceptually downstream of the invoice/payment cycle that billing already owns.
- Settlement is NOT workspace-internal employee-facing (that would belong to the daytimeline/schedule domain). It is Smartout's accountant (Erik) confirming that a period's invoices and payments are squared. The seam is clean: `billing` owns invoice + payment generation; `billing.settlement_*` is the period-close confirmation step.
- **The conceptual boundary that justified "split"** (settlement = workspace's own revenue reconciliation) does not match what the code actually does: the accountant reconciles **Smartout's invoices to its customers**, not a workspace's internal revenue data.
- **New seam rule:** `billing.settlement_*` = part of the billing domain. `apps/admin/(admin)/avstemming/` is the L1 surface for settlement within billing. If a future domain needs workspace-internal settlement (i.e. the workspace tracking its own revenue/payroll period), that is a genuinely different concept and should get its own tables outside the `billing` schema.
- **Action:** Update `docs/domains/_DASHBOARD.md` overlap edge to reflect this revised decision.
