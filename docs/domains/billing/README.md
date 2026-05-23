---
title: "Billing — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, invoice, c3-commercial, source-of-truth]
---

# Billing — Source of Truth

> Authoritative folder for the **billing** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Schema (enums + 5 core tables) | ✅ | ✅ | Fase 1 — migrations `20260417*` |
| Invoice lifecycle triggers | ✅ | ✅ | assign_invoice_number, immutability, credit-note constraints |
| generate-monthly-invoices Edge Function | ✅ | 🟡 | EF live; pg_cron trigger (see GAPS G1) |
| apps/admin (`admin.smartout.ai`) — accountant order/avstemming surface | ✅ | 🟡 | Orders + avstemming + workspaces/kartotek routes live; E2E partial (kartotek + avstemming specs exist) |
| Platform-admin billing UI (`apps/web/platform-admin/billing/`) | ✅ | 🟡 | All sub-routes present; serves Smartout-internal superadmin (parallel to apps/admin, different actor) |
| Workspace-admin billing UI | ✅ | 🟡 | `/dashboard/billing` read-only; settings page |
| `billing_query` AI capability | ✅ | ✅ | 6 chat-only tools (Fase 1+2) |
| Dispatch system (Fase 2) | ✅ | ✅ | `billing_dispatch_rule` + `invoice_dispatch` + 4 adapters |
| Integration framework (Fase 2) | ✅ | ✅ | `billing_integration` + placeholder adapter |
| Stripe payments (Fase 3A) | ✅ | 🟡 | `payment`/`payment_attempt` tables + `stripe-webhook` EF |
| EHF CSV export (Fase 3B) | ✅ | ✅ | `generateEhfExport` in `packages/billing/src/actions/ehf-export/` |
| Accountant access (`billing` schema) | ✅ | 🟡 | `accountant_company_grant` table + RLS + SECURITY DEFINER helpers |
| Settlement tables | ✅ | 🟡 | `billing.settlement_*` — overlap-edge (see GAPS §5) |
| `billing_product` catalog | ✅ | 🟡 | `billing_product` table; platform-admin ad-hoc invoice lines |
| Telemetry (billing_activity_log provider) | ✅ | ✅ | `packages/telemetry/src/providers/billing-activity-log.ts` |
| peppol_ehf adapter | 🔴 | 🔴 | Intentionally absent — Fase 3B deferred (ADR-0129) |
| PlatformAdminToolContext AI-tools | 🔴 | 🔴 | Blocked on dedicated ADR |
| Auto-dunning (engine_process) | 🟡 | 🟡 | `dunning_escalation_scan` process seeded; runtime not yet triggered live |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching billing code. Truth lives in this folder.

- **NEVER use `workspace_id` on core billing tables.** `invoice`, `invoice_line_item`, `billing_activity_log` are company-scoped. `usage_snapshot` has BOTH `company_id` (required) and `workspace_id` (required). This is the documented exception to the universal workspace-scoping rule (ADR-0118).
- **NEVER write directly to `billing_activity_log`.** The telemetry provider (`packages/telemetry/src/providers/billing-activity-log.ts`) is the only writer. Every billing mutation emits via `@smartout/telemetry`'s `emit()`.
- **NEVER delete or UPDATE `issued`/`paid`/`void`/`uncollectible` invoices.** Norwegian bokføringslov §5. Corrections go via `credit_note` invoices only (ADR-0120).
- **NEVER add `stripe_customer_id` to `company` in Fase 1 scope.** Deferred to Fase 2/3 via ADR-0012 amendment (ADR-0131 governs Stripe model).
- **NEVER claim delivery via `invoice.delivery_channel`/`delivery_status`/`external_reference`.** These columns were dropped (migration `20260512000012`). Use `invoice_dispatch` table (ADR-0128).
- **NEVER instantiate a `peppol_ehf` adapter class.** Enum exists for forward-compat; adapter class is intentionally absent until Fase 3B (ADR-0129, `packages/billing/src/dispatch/registry.ts:20`).
- **`apps/admin/` is the canonical accountant admin surface.** `admin.smartout.ai` (port 3070) — separate Vercel project. Auth via `requireAccountant()`. Do NOT build accountant-facing flows in `apps/web/platform-admin/`. `apps/web/platform-admin/billing/` is for Smartout-internal superadmin only.
- **Settlement tables (`billing.settlement_*`) ARE part of the billing domain.** `billing.settlement_run` + `billing.settlement_artifact` are queried by `apps/admin/avstemming/` to reconcile Smartout's invoiced periods. This is NOT workspace-internal employee settlement — it is accountant period close for Smartout's B2B billing cycle. See GAPS §5 revised decision (2026-05-22).
- Owning packages: `packages/billing/` · Edge Functions: `supabase/functions/generate-monthly-invoices/`, `supabase/functions/stripe-webhook/` · Core tables: `public.invoice`, `public.invoice_line_item`, `public.usage_snapshot`, `public.billing_dispatch_rule`, `public.invoice_dispatch`, `public.billing_integration`, `public.payment`, `billing.accountant_company_grant`, `billing.settlement_run`, `billing.settlement_artifact`
