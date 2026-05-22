---
title: "Billing — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, architecture, c3-commercial]
---

# Billing — Architecture

> L1–L5 code map. **Code wins.** Every component cited with a grep-able anchor.

## L1 — Surface (UI)

### CANONICAL admin surface — `apps/admin/` (admin.smartout.ai)

`apps/admin/` is a **separate Next.js app** (separate Vercel project) serving `admin.smartout.ai` (dev port: 3070). It is the new order system ("ordresystem") for accountants. Auth role: `requireAccountant()` via `billing.accountant_company_grant`. No `.vercel/project.json` is present as of 2026-05-22 — deployment is configured separately in Vercel (project name not yet confirmed in code).

**Anchor:** `apps/admin/next.config.ts` — comment `Serves admin.smartout.ai — accountant portal for Erik`; `apps/admin/README.md` — `Deployed at: admin.smartout.ai`

| Route | File | Purpose |
|---|---|---|
| `/` (dashboard) | `apps/admin/src/app/(admin)/page.tsx` | Accountant action-dashboard: period CTA, quick-tasks, last settlement run |
| `/orders` | `apps/admin/src/app/(admin)/orders/page.tsx` | Paginated invoice list across all granted companies; filter by status/company; `OrderDetailSheet` slide-in |
| `/orders/[id]` | `apps/admin/src/app/(admin)/orders/[id]/page.tsx` | Invoice detail: `InvoiceDetailReadOnly` + `PaymentsHistory` + `DispatchesList` + `MarkReceivedDialog` |
| `/orders/[id]/download-csv` | route handler | CSV export for a single invoice |
| `/orders/[id]/download-pdf` | route handler | PDF export for a single invoice |
| `/avstemming/run` | `apps/admin/src/app/(admin)/avstemming/run/page.tsx` | Pre-check + confirm form to trigger a settlement run (`runSettlement` server action) |
| `/avstemming/[run_id]` | `apps/admin/src/app/(admin)/avstemming/[run_id]/page.tsx` | Settlement run detail: `SettlementSummaryView` + `ArtifactDownloads` |
| `/avstemming/historikk` | `apps/admin/src/app/(admin)/avstemming/historikk/page.tsx` | Table of last 50 settlement runs |
| `/workspaces` | `apps/admin/src/app/(admin)/workspaces/page.tsx` | Kartotek workspace list across all granted companies |
| `/workspaces/[id]` | `apps/admin/src/app/(admin)/workspaces/[id]/page.tsx` | Per-workspace kartotek: 7 parallel data sections (summary, orders, payments, members, contracts, pricing_terms, recent activity) |
| `/account` | `apps/admin/src/app/(admin)/account/page.tsx` | Accountant account settings |
| `/auth/login` | public | Email/OTP login |
| `/auth/callback` | public | OAuth / token callback |
| `/auth/logout` | public | Session destroy |
| `/api/health` | public | Health probe |
| `/api/orders/[id]/mark-received` | POST route handler | REST entry point for `markReceivedAction` |
| `/api/avstemming/[run_id]/artifact/[type]` | GET route handler | Signed artifact download |

**Key libs:**
- `apps/admin/src/lib/orders/fetchers.ts` — wraps `@smartout/billing` query functions; queries `public.invoice` with `company_id` filter
- `apps/admin/src/lib/orders/actions.ts` — `markReceivedAction`: INSERT `payment` + UPDATE `invoice.status = 'paid'`; emits `order marked_received`
- `apps/admin/src/lib/avstemming/fetchers.ts` — queries `billing.settlement_run`, `billing.settlement_artifact`; calls `billing.compute_period_aggregates` RPC
- `apps/admin/src/lib/avstemming/actions.ts` — `runSettlement`: delegates to `executeSettlementRun` (packages/billing/server/settlement); emits `settlement run_initiated`
- `apps/admin/src/lib/kartotek/fetchers.ts` — stub (M3 pending); will wrap `@smartout/billing/server` `fetchWorkspaceKartotek`
- `apps/admin/src/lib/accountant.ts` — `requireAccountant()` gate: session check + `fetchAccountantCompanyGrants`

**Tables directly queried by apps/admin:**
- `public.invoice` — order list + detail (via `@smartout/billing`)
- `public.payment` — payment history + markReceivedAction INSERT
- `billing.settlement_run` — avstemming run list, status, summary (via `billing` schema selector)
- `billing.settlement_artifact` — artifact downloads (via `billing` schema selector)
- `billing.accountant_company_grant` — via `@smartout/billing/accountant` grant helpers
- `billing.compute_period_aggregates` RPC — period preview on dashboard (migration `20260522000200_billing_settlement_helpers.sql`)

**Anchor for fetchers:** `apps/admin/src/lib/avstemming/fetchers.ts` — comment `settlement data fetchers for the admin app`; `apps/admin/src/lib/orders/fetchers.ts` — comment `typed order fetcher wrappers`

### Platform-admin routes in `apps/web` — parallel-still-live, legacy scope

`apps/web/src/app/platform-admin/billing/` routes are still routed and linked (sidebar: `apps/web/src/components/platform-admin/sidebar-nav.tsx:61`). They serve **Smartout internal operations** (invoicing configuration, dunning management, drift review, dispatch rule administration, integration CRUD) — NOT the accountant-facing order/settlement workflow that `apps/admin/` owns. These two surfaces are parallel, not redundant: they serve different actors with different authority levels.

| Route | Purpose |
|---|---|
| `/platform-admin/billing` | Overview tab (existing MRR page + hub) |
| `/platform-admin/billing/invoices` | Invoice list + `DataTable` |
| `/platform-admin/billing/invoices/[id]` | Invoice detail (`InvoiceDetail` tabs: Oversikt / Historikk / Handlinger) |
| `/platform-admin/billing/dunning` | Dunning dashboard (`DunningKanban`) |
| `/platform-admin/billing/drift` | Basis drift panel (`BasisDriftPanel`) |
| `/platform-admin/billing/export` | CSV export form |
| `/platform-admin/billing/ehf-export` | EHF CSV/PDF export (Fase 3B) |
| `/platform-admin/billing/payments` | Payments dashboard |
| `/platform-admin/billing/integrations` | Integration registry UI |
| `/platform-admin/billing/settings/dispatch` | Dispatch rule settings |

**Actor distinction:** `apps/web/platform-admin/billing` requires `getSuperAdminId()` (Smartout internal staff). `apps/admin/` requires `requireAccountant()` (external accountants with company grants).

### Dashboard (workspace-admin) routes (`apps/web/src/app/dashboard/billing/`)

| Route | Purpose |
|---|---|
| `/dashboard/billing` | Workspace-admin invoice list + own invoices read-only |
| `/dashboard/billing/[invoice_id]` | Invoice detail |
| `/dashboard/billing/settings` | Billing settings (dispatch rules + company config) |

**Anchor:** directory confirmed at `apps/web/src/app/platform-admin/billing/` and `apps/web/src/app/dashboard/billing/`.

### Web components (`apps/web/src/components/billing/`) and admin components

- `StripeRedirectInterstitial.tsx` — trust anchor interstitial before Stripe Checkout redirect

### Shared UI components (`packages/ui/src/components/`)

- `invoice-status-badge.tsx` — `InvoiceStatusBadge` with token-mapped status → Lucide icon + CSS var color
- `status-badge.tsx` — generic status badge sibling

**Anchor for InvoiceStatusBadge:** `packages/ui/src/components/invoice-status-badge.tsx`

## L2 — BFF / API

### Server Actions

All mutations run as Next.js Server Actions — no direct client-to-DB writes. The actions directory is `apps/web/src/app/platform-admin/billing/_actions/`:

| Action file | Mutation |
|---|---|
| `markInvoicePaid.ts` | Invoice → paid |
| `voidInvoice.ts` | Invoice → void (typed confirmation gate) |
| `issueCreditNote.ts` | Create credit_note invoice |
| `addDunningNote.ts` | Log dunning note |
| `markInvoiceUncollectible.ts` | Invoice → uncollectible |
| `updatePricingTerms.ts` | Update company pricing |
| `retryDispatch.ts` | Retry failed invoice_dispatch row |
| `resolveDriftEvent.ts` | Resolve a basis_drift_event |
| `createAdHocDispatch.ts` | Manual dispatch outside rules |
| `invoice-editing/` | Add / edit / delete manual line items, create ad-hoc invoice |
| `payments/` | Payment management actions |
| `dispatch-rules/` | Create / toggle dispatch rules |
| `integrations/` | Integration CRUD |

Workspace-admin actions at `apps/web/src/app/dashboard/billing/_actions/`.

### Route Handler (CSV export, file download)

`apps/web/src/app/platform-admin/billing/export/csv/route.ts` — `GET` with query params `period_from`, `period_to`, `company_ids[]`, returns `text/csv` attachment.

**Anchor:** `apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts`

## L3 — Engine / orchestration

### Edge Functions (`supabase/functions/`)

| Function | Trigger | Purpose |
|---|---|---|
| `generate-monthly-invoices/` | pg_cron day 5 at 00:01 UTC (migration `20260621200003`) | Monthly usage snapshot freeze + invoice generation + overdue scan |
| `stripe-webhook/` | Stripe signature-verified public endpoint | Reflects Stripe payment events → `payment`, `payment_attempt`, `invoice` state |
| `engine-dispatch/handlers/scan-overdue-invoices.ts` | Engine process | `invoice overdue_detected` handler |
| `engine-dispatch/handlers/sync-integration.ts` | Engine process `sync_integration` | Billing integration sync via adapter |
| `engine-dispatch/handlers/period-locked-notifier.ts` | Engine process | Settlement period locked notification |

**Anchor for generator:** `supabase/functions/generate-monthly-invoices/index.ts` — comment `generate-monthly-invoices — Cron-triggered billing generator`

**Anchor for stripe-webhook:** `supabase/functions/stripe-webhook/index.ts` — comment `Billing Engine Fase 3A — stripe-webhook Edge Function`

### Engine processes (seeded via migrations)

- `invoice_lifecycle` — Fase 1 blueprint: `draft → issued → paid|overdue|void` (migration `20260417123908_invoice_lifecycle_engine_process.sql`)
- `invoice_dispatch_delivery` — Fase 2 orchestrates per-channel delivery + retry (migration `20260511200008_billing_fase2_engine_processes.sql`)
- `dunning_escalation_scan` — Fase 3A: auto-escalation ladder for overdue invoices

### pg_cron job

`fn_generate_company_invoice` + pg_cron registration in migration `20260621200003_pg_cron_generate_monthly_invoices.sql`. Note: ADR-0388 documents that pg_cron was not enabled in prod at Fase 1 ship — confirm prod pg_cron ≥1.5 before relying on this trigger (GAPS G1).

## L4 — Capability / domain logic

### `packages/billing/src/`

| Module | Purpose |
|---|---|
| `types.ts` | Billing domain TypeScript types |
| `schemas.ts` | Zod validation schemas |
| `queries.ts` | Read query helpers |
| `hooks.ts` | React query hooks (`useInvoices`, `useInvoice`, `useUsageSnapshot`) |
| `server/` | Server-side helpers (`invoice-detail.ts`, `order-export.ts`, `kartotek.ts`) |
| `dispatch/` | Dispatch adapter registry + adapter implementations (email_customer, email_internal, http_api, stripe) |
| `integrations/` | Integration adapter interface + registry |
| `accountant/` | Accountant access helpers (`grants.ts`, `audit.ts`) |
| `actions/invoice-editing/` | Pure business logic for line item mutations |
| `actions/ehf-export/` | `generateEhfExport` — CSV/PDF export builder (Fase 3B) |
| `__tests__/` | Vitest unit tests |

**Anchor:** `packages/billing/src/dispatch/registry.ts` — `ADAPTER_REGISTRY` const

### `packages/ai/src/capabilities/billing-query/`

- `tools.ts` — 6 read-only tools: `list_my_invoices`, `get_my_invoice`, `explain_invoice_basis`, `list_overdue_invoices`, `list_invoice_dispatches`, `get_usage_snapshot`
- `index.ts` — capability registration
- `__tests__/` — capability tests

**Anchor:** `packages/ai/src/capabilities/billing-query/tools.ts` — `list_my_invoices` tool definition

### `packages/ai/src/lib/resolveCompanyId.ts`

Helper: `resolveCompanyId(ctx: AgentToolContext) → company_id` via `workspace.company_id` lookup. Called at entry of every billing-query tool. Throws on missing workspace linkage (fail-fast, ADR-0177 pattern).

### `packages/telemetry/src/providers/billing-activity-log.ts`

Telemetry provider — sole writer to `billing_activity_log`. Routing key: `billing_activity_log`. Registered in `packages/telemetry/src/registry.ts`.

## L5 — Persistence

→ See [DATA-MODEL.md](./DATA-MODEL.md) for full table inventory, enums, FK map, and RLS posture.

Core table locations:
- `public` schema: `invoice`, `invoice_line_item`, `usage_snapshot`, `basis_drift_event`, `billing_activity_log`, `billing_dispatch_rule`, `billing_dispatch_template`, `invoice_dispatch`, `billing_integration`, `billing_product`, `payment`, `payment_attempt`
- `billing` schema: `accountant_company_grant`, `settlement_period`, `settlement_run`, `settlement_artifact`

## Data flow — monthly invoice generation

```
pg_cron (day 5, 00:01 UTC)
  → generate-monthly-invoices EF
      → for each active company:
          → compute usage_snapshot per workspace (ADR-0119 predicate on schedule_shift)
          → BEGIN TX: INSERT invoice (draft) + invoice_line_item rows
          → UPDATE invoice.status = 'issued' → assign_invoice_number trigger fires
          → COMMIT
          → emit('usage_snapshot created') + emit('invoice generated') + emit('invoice issued')
              → billing_activity_log provider (writes audit row)
              → engine_event (starts invoice_lifecycle process)
              → posthog + logger
      → overdue scan: UPDATE issued/sent past due_at → 'overdue' + emit('invoice overdue_detected')
```

## Data flow — invoice dispatch

```
invoice.status = 'issued'
  → engine_process 'invoice_dispatch_delivery' starts
      → evaluate billing_dispatch_rule (2-level: platform baseline + workspace override/suppress)
      → INSERT invoice_dispatch rows per matched channel
      → per row: getAdapter(channel) → adapter.send(invoice_dispatch)
          email_customer → SendGrid
          email_internal → SendGrid (internal)
          http_api → signed HMAC POST
          stripe_invoice → Stripe Invoice API
          peppol_ehf → NOT REGISTERED (Fase 3B, ADR-0129)
      → on success: invoice_dispatch.status = 'delivered'
      → on failure: engine_delayed_trigger for retry
```
