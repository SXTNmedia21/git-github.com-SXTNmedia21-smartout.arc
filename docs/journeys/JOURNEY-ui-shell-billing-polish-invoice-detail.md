---
title: "Journey — Admin opens invoice detail and reviews line items"
status: verified
feature: billing-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, billing, polish, campaign-ui-shell]
---

# Journey — Admin opens invoice detail and reviews line items

> Sub-sortie: `ui-shell-billing-polish`. Secondary journey covering `/dashboard/billing/[invoice_id]`.

## Journey: Admin drills into a specific invoice to inspect line items and download PDF

**Precondition:** Admin signed in, on `/dashboard/billing`. At least one invoice exists in the roster. Admin has clicked an invoice row and browser has navigated to `/dashboard/billing/[invoice_id]`.

1. Browser navigates to `/dashboard/billing/[invoice_id]` — route streams via Suspense → `loading.tsx` shows header skeleton + line-item table skeleton aligned with Nordic Split tokens → no layout shift
2. Server Component fetches invoice by `invoice_id`, RLS-scoped via Supabase admin client — confirms invoice belongs to the admin's company before rendering
3. Page header renders — `font-heading` h1 showing invoice number (e.g. "Faktura #2026-0042") + status badge (Betalt / Forfalt / Utestående) using semantic CSS-variable colours
4. Invoice metadata row renders — issue date (`Utstedt`), due date (`Forfallsdato`), period covered (`Periode`), total amount (`Totalbeløp inkl. mva`)
5. Line-items table renders — each row: description, quantity, unit price, VAT rate, line total; footer row shows subtotal + VAT + grand total
6. "Last ned PDF"-button visible — links to the Supabase Storage PDF URL (pre-signed, short-lived) or Stripe-hosted invoice PDF URL
7. "← Fakturaoversikt"-breadcrumb link navigates back to `/dashboard/billing`
8. Botsson `getInvoiceDetail` tool responds correctly if Botsson asks about this invoice (read-only, no mutation surface)

**Postcondition:** Admin sees complete invoice breakdown. All amounts match Stripe source. PDF download accessible. No console errors. First meaningful paint < 1.2 s on local dev.

**Error paths:**
- `invoice_id` does not exist or belongs to a different company → new `error.tsx` renders "Fakturaen ble ikke funnet" + link back to `/dashboard/billing` (no white screen, no raw JSON error)
- PDF URL expired → "Last ned PDF" renders disabled state with tooltip "PDF midlertidig utilgjengelig — prøv igjen"
- Query failure (network / Supabase) → `error.tsx` renders Norwegian message + retry button

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `ls apps/web/src/app/dashboard/billing/\[invoice_id\]/error.tsx apps/web/src/app/dashboard/billing/\[invoice_id\]/loading.tsx` → both exist
- `grep "font-heading" apps/web/src/app/dashboard/billing/\[invoice_id\]/page.tsx` → 1+ hit
- `grep -E "bg-(zinc|slate|gray|blue|green|red|amber)-(50|100|200|700)" apps/web/src/app/dashboard/billing/\[invoice_id\]/"` → 0 hits (Nordic Split palette clean)
- Manual: navigate to a known invoice_id → renders without flash; back-link works; error.tsx renders on invalid id

## E2E (recommended)

S12 protocol step 7 verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright deferred (covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`).
