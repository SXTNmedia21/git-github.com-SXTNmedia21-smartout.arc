---
title: "Journey — Admin reviews invoices and billing state"
status: verified
feature: billing-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, billing, polish, campaign-ui-shell]
---

# Journey — Admin reviews invoices and billing state

> Sub-sortie: `ui-shell-billing-polish`. Primary journey closing S12 step 7 (`/dashboard/billing`).

## Journey: Admin navigates to /dashboard/billing and reviews invoice roster

**Precondition:** Admin signed in, on dashboard shell. Workspace's company has at least one invoice in Supabase (issued_at not null). Sidebar M1 surfaced the route via "Administrasjon > Fakturering".

1. Admin clicks "Fakturering" in sidebar → browser navigates to `/dashboard/billing`
2. Route streams via Suspense → existing `loading.tsx` shows header + 5-row table skeleton aligned with Nordic Split tokens → no layout shift
3. `getMyCompanyInvoices()` returns up to 48 invoices for the admin's company, RLS-scoped via Supabase admin client
4. Page header renders — new `font-heading` h1 "Fakturering" + Norwegian page instructions explaining the invoice roster surface
5. Invoice table renders — 5 columns (number, period, amount, status, due_date), Nordic Split tokens applied
6. Empty state when zero invoices — friendly Norwegian copy
7. Botsson page-tool kit registered via `useRegisterTools('billing', kit)` — 5 read-only tools (getBillingOverview, listInvoices, getInvoiceDetail, openInvoiceDetail, openBillingSettings)
8. Admin clicks an invoice row → navigates to `/dashboard/billing/[invoice_id]`
9. Admin clicks "Innstillinger" → navigates to `/dashboard/billing/settings`

**Postcondition:** Admin sees production-grade billing overview. First paint < 1s on local dev. No console errors. Tools work for Botsson queries about invoice status.

**Error paths:**
- Query failure → new `error.tsx` renders Norwegian message + retry button (no white screen)
- RLS denies → empty state shows, no error surface
- Non-admin → middleware/role gate redirects (pre-existing)

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0
- `ls apps/web/src/app/dashboard/billing/error.tsx apps/web/src/app/dashboard/billing/[invoice_id]/error.tsx apps/web/src/app/dashboard/billing/[invoice_id]/loading.tsx apps/web/src/app/dashboard/billing/settings/error.tsx apps/web/src/app/dashboard/billing/settings/loading.tsx` → all 5 exist
- `grep "font-heading" apps/web/src/app/dashboard/billing/page.tsx` → 1+ hit
- `grep "emit(" apps/web/src/app/dashboard/billing/settings/_actions/updateCompanyEhfSettings.ts` → 1+ hit
- `grep -E "bg-(zinc|slate|gray|blue|green|red|amber)-(50|100|200|700)" apps/web/src/app/dashboard/billing/` → 0 hits

## E2E (recommended)

S12 protocol step 7 verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright deferred (covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`).
