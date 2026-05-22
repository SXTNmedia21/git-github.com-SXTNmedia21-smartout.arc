---
title: "Billing — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, e2e, testing]
---

# Billing — E2E Coverage

> Test = proof of built. A flow without a test is `mirror: aspirational` until proven.

## Coverage matrix

| # | Flow | Web E2E (Playwright) | SQL (pgTAP) | Unit (Vitest) | Manual |
|---|---|---|---|---|---|
| 1 | Monthly invoice generation | MISSING (cron EF not testable via Playwright) | `supabase/tests/migrations/20260417_billing_constraints.spec.sql` — constraints + trigger structure | `packages/billing/src/__tests__/queries.spec.ts` | verified via migration tests |
| 2 | Platform-admin: view invoice list | MISSING | — | — | 🟡 manual |
| 3 | Platform-admin: mark invoice paid | MISSING | — | `packages/billing/src/__tests__/listPayments.spec.ts` | 🟡 manual |
| 4 | Platform-admin: void invoice | MISSING | `supabase/tests/migrations/20260417_billing_rls.spec.sql` — immutability tests | — | 🟡 manual |
| 5 | Platform-admin: issue credit note | MISSING | pgTAP: nested credit note CHECK | — | 🟡 manual |
| 6 | Platform-admin: dunning dashboard | MISSING | — | `packages/billing/src/__tests__/dunning-stages.spec.ts`, `dunning-optout-rule-shape.spec.ts` | 🟡 manual |
| 7 | Platform-admin: basis drift review | MISSING | — | — | 🟡 manual |
| 8 | Platform-admin: CSV export | MISSING | — | — | 🟡 manual |
| 9 | Workspace-admin: view own invoices | MISSING | `supabase/tests/migrations/20260417_billing_rls.spec.sql` — company A cannot read company B | — | 🟡 manual |
| 10 | AI billing_query (chat) | `apps/e2e/tests/billing-query-harness-e2e.spec.ts` ✅ | — | `packages/ai/src/capabilities/billing-query/__tests__/` | verified |
| 11 | Dispatch rules evaluation | MISSING | `supabase/tests/migrations/20260511200000_billing_fase2_schema.spec.sql` | `packages/billing/src/__tests__/adapters.spec.ts`, `template.spec.ts` | 🟡 manual |
| 12 | Stripe webhook idempotency | MISSING | `supabase/tests/migrations/20260512000010_billing_fase3a_webhook_idempotency.spec.sql` ✅ | — | 🟡 manual |
| 13 | EHF CSV export | MISSING | `supabase/tests/migrations/20260513000001_billing_fase3b_ehf_export_schema.spec.sql` | `packages/billing/src/actions/ehf-export/__tests__/generateEhfExport.spec.ts` ✅ | verified |
| 14 | Accountant mark-paid | MISSING | `supabase/tests/billing_settlement_bucket.test.sql` | `packages/billing/src/__tests__/run.audit.spec.ts` | 🟡 manual |
| 15 | Platform-admin product catalog | `apps/e2e/tests/journey-platform-admin-billing-product-catalog.spec.ts` ✅ | — | — | verified |
| 16 | Settlement period lifecycle | MISSING | `supabase/tests/migrations/20260512000009_billing_fase3a_schema.spec.sql` | `packages/billing/src/__tests__/settlement-render.spec.ts` | 🟡 manual |
| 17 | Accountant kartotek (cross-company) — `apps/admin/workspaces` | `apps/e2e/admin/kartotek.spec.ts` ✅ | — | — | verified |
| 18 | Accountant avstemming — `apps/admin/avstemming/*` | `apps/e2e/admin/avstemming.spec.ts` ✅ (anchor: `Production: https://admin.smartout.ai` comment at line 17) | — | — | verified |
| 21 | Accountant orders list — `apps/admin/orders` | MISSING | — | — | 🔴 no test |
| 22 | Accountant mark-received action | MISSING | — | `packages/billing/src/__tests__/run.audit.spec.ts` (covers run pipeline) | 🟡 manual |
| 19 | RLS: company A cannot read company B invoice | — | `supabase/tests/migrations/20260417_billing_rls.spec.sql` ✅ | — | verified |
| 20 | Dunning integration handler | — | `supabase/tests/migrations/20260511200000_billing_fase2_integration_handler.spec.sql`, `20260512000011_billing_fase3a_dunning_handler.spec.sql` | — | 🟡 partial |

## Gaps

### Critical missing E2E coverage (feeds GAPS §3 G9)

The following flows have **no automated web E2E proof** — they rely entirely on manual testing:

- Platform-admin: mark paid, void, credit note, uncollectible (all mutation paths)
- Platform-admin: dunning dashboard + note
- Workspace-admin: invoice list + detail (most-used customer-facing flow)
- Invoice dispatch end-to-end (email → delivered)
- Stripe payment complete flow (Checkout → webhook → invoice paid)
- Basis drift detection + resolution

**Recommended:** Playwright specs in `apps/e2e/tests/billing/` covering:
1. `billing-platform-admin-mark-paid.spec.ts` — happy path + partial payment
2. `billing-platform-admin-void.spec.ts` — typed confirmation gate
3. `billing-workspace-admin-invoice-list.spec.ts` — read-only list + AI tool
4. `billing-dispatch-email.spec.ts` — dispatch rule → mock SendGrid delivery

### pgTAP coverage is strong for schema invariants

pgTAP specs exist for RLS cross-company isolation, invoice constraints, Fase 2 schema, Fase 3A webhook idempotency, and Fase 3B schema. The schema-level test layer is healthy.

### Vitest coverage is good for business logic

`packages/billing/src/__tests__/` has 8 spec files covering dunning stages, adapters, templates, queries, run audit, settlement rendering, payment listing, and m3 queries.
