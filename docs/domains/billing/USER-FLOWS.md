---
title: "Billing — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, user-flows, journeys]
---

# Billing — User Flows

> Flow index. **Links** to journey fundaments in `docs/journeys/` (owned by journey-protocol) — does NOT duplicate them.

## Flow index

| # | Flow | Role | Shipped? | Journey |
|---|---|---|---|---|
| 1 | Monthly invoice generation (cron → draft → issued) | system/platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 2 | Platform-admin: view invoice list + detail | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 3 | Platform-admin: mark invoice paid | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 4 | Platform-admin: void invoice (typed confirmation) | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 5 | Platform-admin: issue credit note | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 6 | Platform-admin: dunning dashboard + add note | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 7 | Platform-admin: basis drift review | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 8 | Platform-admin: update pricing terms | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 9 | Platform-admin: CSV export | platform-admin | ✅ | [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) |
| 10 | Workspace-admin: view own invoices | company admin/owner | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 11 | Workspace-admin: ask AI about invoice | company admin/owner | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 12 | Invoice dispatch (multi-channel: email, HTTP, Stripe) | system | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 13 | Workspace-admin: configure dispatch rules | company admin | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 14 | Integration sync (Fiken / Tripletex placeholder) | system | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 15 | Platform-admin: ad-hoc invoice creation | platform-admin | ✅ | [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) |
| 16 | Stripe payment flow (workspace pays via Checkout) | company admin | ✅ | (Fase 3A — journey pending explicit file) |
| 17 | Auto-dunning escalation ladder | system | 🟡 | (process seeded; not yet running live — GAPS G5) |
| 18 | EHF CSV/PDF export for accountant | platform-admin | ✅ | (Fase 3B) |
| 19 | Accountant marks invoice paid | accountant | ✅ | [JOURNEY-billing-erik-seed-erik-login.md](../../journeys/JOURNEY-billing-erik-seed-erik-login.md) |
| 20 | Accountant: kartotek (cross-company billing view) | accountant | ✅ | [JOURNEY-avstemming-pages.md](../../journeys/JOURNEY-avstemming-pages.md) |
| 21 | Settlement period open → locked → closed | platform-admin/accountant | ✅ (tables) | [JOURNEY-settlement-bucket-migration.md](../../journeys/JOURNEY-settlement-bucket-migration.md) |
| 22 | Accountant: view order list (admin.smartout.ai/orders) | accountant | ✅ | `apps/admin/src/app/(admin)/orders/page.tsx` |
| 23 | Accountant: view order detail + payment history + dispatch history | accountant | ✅ | `apps/admin/src/app/(admin)/orders/[id]/page.tsx` |
| 24 | Accountant: run avstemming (period close, generate 4 artifacts) | accountant | ✅ | `apps/admin/src/app/(admin)/avstemming/run/page.tsx` + `runSettlement` action |
| 25 | Accountant: view settlement run detail + download artifacts | accountant | ✅ | `apps/admin/src/app/(admin)/avstemming/[run_id]/page.tsx` |
| 26 | Accountant: view settlement history (last 50 runs) | accountant | ✅ | `apps/admin/src/app/(admin)/avstemming/historikk/page.tsx` |

## Cross-surface notes

**apps/admin (`admin.smartout.ai`) — accountant surface (NEW as of 2026-05-22):**

- `apps/admin/` is the canonical accountant-facing admin. It is a separate Next.js app + separate Vercel project (`admin.smartout.ai`, dev port 3070).
- Actor: `accountant` — must have at least one active `billing.accountant_company_grant` row. Auth via `requireAccountant()` in `apps/admin/src/lib/accountant.ts`.
- The `/orders` section = invoice list/detail for granted companies. The `/avstemming` section = settlement pipeline (period reconciliation). The `/workspaces` section = kartotek (full workspace billing overview).
- `apps/web/src/app/platform-admin/billing/` is a parallel surface for **Smartout-internal superadmin** operations (dunning, drift, integration CRUD, dispatch-rule admin). Both surfaces are live; they serve different actors.

**Web composes, mobile executes (ADR-0133):**
- Billing authoring (invoice generation config, pricing terms, dispatch rule creation, integration CRUD, void/credit-note) → **web-only** (platform-admin or workspace-admin dashboard).
- Mobile gets read-only access to `billing_query` AI tools via the chat BFF (workspace-admin can ask "what invoices do I have" via voice/chat). No billing mutation surfaces on mobile.
- `packages/billing/src/hooks.ts` exports `useInvoices`, `useInvoice`, `useUsageSnapshot` — shared hooks supporting both web and mobile (mobile parity architecture in place per ADR-0133).

**Authority gates (C4):**
- `void` requires platform-admin + typed invoice number confirmation.
- `issue_credit_note` requires platform-admin + AlertDialog reason.
- `mark_uncollectible` requires platform-admin + reason code enum.
- `generate draft` has no gate (cron/automation).
- `mark_paid` requires platform-admin or accountant (confirm + payment channel).

**Accountant surface (ADR-0269 proposed):**
- Accountants access billing via `billing.is_accountant_for_company()` helper — distinct from workspace membership.
- Accountant scope: `orders_only` (invoice/payment read) or `full_kartotek` (+ employment_contract + pricing_terms + company_member).
- Accountant can mark invoices paid with `payment_method = 'accountant_manual'`.
