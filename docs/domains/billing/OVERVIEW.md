---
title: "Billing — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, overview, c3-commercial, invoice]
---

# Billing — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

The Billing domain is Smartout's internal invoice system ("fakturamotor"). It generates monthly invoice drafts from cascade-derived usage data — counting distinct employees who completed shifts in the previous calendar month — stores them with full audit-trail and Norwegian bokføringslov compliance, and exposes platform-admin surfaces for review, dispatch, and payment reconciliation. Workspace-admins (company owners) get a read-only view of their own company's invoices.

Billing owns the full customer-money loop: generating what is owed (usage metering), creating the legal invoice record, dispatching it via configurable channels (email, HTTP API, Stripe), tracking whether it was delivered and paid, and triggering dunning escalation for overdue invoices. It also manages accountant access — external accountants who must see billing data across multiple companies they service.

**What billing is NOT:** workspace → end-customer billing. Smartout is not a payment processor for its workspace customers' end-customers. That is explicitly out of scope (ADR-0131 — Stripe Connect rejected). Smartout is the merchant-of-record, billing its own B2B customers (the companies that operate workspaces on the platform).

## 2. Cascade placement

**C3 Commercial** — the correct layer for "what value, what cost?" outcome tracking on top of the operational dimensions.

| Dimension | Billing's relationship |
|---|---|
| **D6 Production** (`schedule_shift`) | Source for active-user counting (ADR-0119 predicate: `status = 'completed'` + `employee_id IS NOT NULL`) |
| **K1b Workspace** (`pricing_terms`) | Rate card and agreement terms; FK on `invoice.pricing_terms_id` + date-range fallback |
| **C3 Commercial** | **Invoice engine lives here.** Consumes D6 + K1b, writes to its own tables. |
| **C4 Governance** | Gates destructive mutations: void, credit_note_issuance, adjust_basis |
| **Identity** (`company`, `user_identity`) | Billed entity + platform-admin actor |
| **D1 Envelope** (`workspace`) | Sub-scope for per-workspace usage rollup |

The engine **reads** from D6/K1b/Identity and **writes** only to billing tables. It never mutates cascade sources (ADR-0118 C3 invariant verified at `packages/billing/src/actions/`, `supabase/functions/generate-monthly-invoices/`).

## 3. Boundaries

**Owns:**
- `usage_snapshot` — seat/usage metering (what Smartout bills its customers)
- `invoice` + `invoice_line_item` — legal billing record
- `payment` + `payment_attempt` — payment settlement records
- `billing_dispatch_rule` + `invoice_dispatch` + dispatch adapters — delivery routing and tracking
- `billing_integration` — third-party accounting system integration config
- `billing_activity_log` — platform-scoped audit trail (ADR-0125)
- `billing_product` — platform product catalog for ad-hoc invoice lines
- `billing.accountant_company_grant` — accountant cross-company access (ADR-0269)
- `pricing_terms` billing columns — `free_users`, `overage_price_per_user`, `delivery_channel`, `invoice_format`, `agreement_period` (additive extension, ADR-0121)
- `billing_query` AI capability — read-only workspace-admin tools

**Does NOT own:**
- `pricing_terms` core columns — owned by the subscription/contract domain; billing only extends it (ADR-0121)
- `settlement_*` tables (`billing.settlement_period`, `billing.settlement_run`, `billing.settlement_artifact`) — physically in the `billing` schema but a DIFFERENT concept: workspace-internal cash/revenue reconciliation by Erik/accountant. See GAPS §5 for the overlap-edge recommendation.
- `schedule_shift` — D6 Production; billing reads it, never writes
- `company` / `workspace` / `user_identity` — Identity layer; billing reads, never writes
- Workspace → end-customer payment processing — rejected (ADR-0131)

## 4. Key invariants

- **Company-scoped, not workspace-scoped.** `invoice`, `invoice_line_item`, `billing_activity_log` carry `company_id` (not `workspace_id`). `usage_snapshot` carries both (one row per workspace per period, aggregate computed at read time). Enforced by schema NOT NULL constraints — verified in `supabase/migrations/20260417121720_invoice_table.sql`.
- **Immutability after issue.** Once `invoice.status = 'issued'`, the row becomes immutable except for status progression. No deletes for non-draft invoices. Corrections via `credit_note` only. Enforced by triggers in `20260417123340_invoice_trigger_functions_hardened.sql`.
- **All mutations via `emit()`.** No billing mutation bypasses `@smartout/telemetry`. The `billing_activity_log` provider (`packages/telemetry/src/providers/billing-activity-log.ts`) is the sole writer to `billing_activity_log`. No direct INSERT from domain code.
- **`peppol_ehf` adapter intentionally absent.** The dispatch channel enum exists (`billing_dispatch_channel`); the adapter class is not registered. `packages/billing/src/dispatch/registry.ts:20` states this explicitly (ADR-0129).
- **Active user = completed shift with employee_id.** The billing predicate (`schedule_shift WHERE status = 'completed' AND employee_id IS NOT NULL`) is deterministic and stored with a `source_query_hash` for audit replay (ADR-0119). Verified in `supabase/functions/generate-monthly-invoices/generator.ts`.
