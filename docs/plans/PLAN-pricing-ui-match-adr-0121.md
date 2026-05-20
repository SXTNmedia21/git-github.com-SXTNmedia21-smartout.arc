---
title: "Plan — pricing-ui-match-adr-0121"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [plan, platform-admin, billing, pricing, adr-0121]
---

# Plan — pricing-ui-match-adr-0121

> Branch: `feat/pricing-ui-match-adr-0121` | Worktree: /home/sxtnl/dev/smartout.ai-wt-7 | Base: `development` | Module: billing

## Goal

Align platform-admin pricing UI with ADR-0121's billing model. The billing cron (`generate-monthly-invoices`) reads `monthly_cost` + `free_users` + `overage_price_per_user`. The UI today writes `price_per_employee` — a stale column that nothing reads. Replace the input in workspace-create + ContractTab with `free_users` + `overage_price_per_user`, while keeping `price_per_employee` synced (as `= overage_price_per_user`) for backward compat. Schema deprecation of `price_per_employee` is a later sortie after a data audit.

## Background

- ADR-0121 (2026-04-17) added `free_users INT NOT NULL DEFAULT 10` + `overage_price_per_user NUMERIC(12,2)` + `delivery_channel` + `invoice_format` + `agreement_period` to `pricing_terms`.
- `pricing_terms.price_per_employee` predates ADR-0121 and is `NOT NULL` — cannot drop without migration + null backfill.
- Billing cron formula (verified `supabase/functions/generate-monthly-invoices/generator.ts:225-233`):
  ```
  invoice_total = monthly_cost
                + max(0, active_users - free_users) × overage_price_per_user
                + 25% VAT
  ```
- 🔴 finding (Pontus 2026-05-20 E2E review): `price_per_employee` is silently dead — written by ContractTab/new-workspace, never read.

## Tasks

### A. API routes accept new fields, keep backward compat
- [ ] `apps/web/src/app/api/platform-admin/pricing-terms/route.ts` — extend `CreateSchema` + `UpdateSchema`:
  - Add `free_users: z.number().int().nonnegative().optional()` (cron defaults to 10 if NULL via schema default).
  - Add `overage_price_per_user: z.number().nonnegative().nullable().optional()`.
  - `price_per_employee` stays in schema as `.optional()` for backward compat callers.
  - Before insert: if `overage_price_per_user` provided AND `price_per_employee` not provided, sync `price_per_employee = overage_price_per_user` (keep NOT NULL constraint satisfied).
- [ ] `apps/web/src/app/api/platform-admin/workspaces/route.ts` — same: extend `CreateWorkspaceSchema` + the `pricing_terms.insert` block (line 280) to accept + write `free_users` + `overage_price_per_user`. Sync `price_per_employee = overage_price_per_user` for compat.

### B. ContractTab — replace pricePerEmployee input
- [ ] `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx`:
  - `PricingTermsData` type: add `freeUsers: number | null` + `overagePricePerUser: number | null`. Keep `pricePerEmployee` field for backward compat read (UI shows nothing for it).
  - `PricingFormState`: replace `pricePerEmployee` with `freeUsers` + `overagePricePerUser`.
  - `toFormState`: read new fields, fall back to old if needed.
  - Form: replace the single "Pris per ekstra ansatt" input with two:
    - `Inkluderte brukere (free)` — number, default 10
    - `Pris per bruker over inkluderte (NOK)` — number
  - Submit payload: send `free_users` + `overage_price_per_user`.
  - Display block (line 461): show "X gratis brukere, Y kr per bruker over" instead of "Pris per ansatt".

### C. new-workspace form — same
- [ ] `apps/web/src/app/platform-admin/workspaces/new/page.tsx`:
  - Form state: replace `price_per_employee` with `free_users` + `overage_price_per_user`.
  - Inputs: same two as ContractTab.
  - Template default-pricing read: map `price_per_employee` from template default to `overage_price_per_user`.
  - Submit payload: include both new fields.

### D. workspace-detail page passes new fields
- [ ] `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx` — extend `pricingTerms` mapping (line 252-272) to include `freeUsers: pricing_terms.free_users` + `overagePricePerUser: pricing_terms.overage_price_per_user`.

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` passes (isolated apps/web tsc grønn)
- [ ] Manual test: open workspace-detail ContractTab → edit pricing → set free_users=10 + overage=50 → save → verify SQL: `select free_users, overage_price_per_user, price_per_employee from pricing_terms`. All three present. `price_per_employee` synced to overage value.
- [ ] new-workspace form has free_users + overage inputs

## Out of Scope

- Dropping `price_per_employee` column (separate migration sortie after data audit confirms no legacy consumers)
- ADR amendment (this sortie just matches UI to existing ADR-0121 — no schema change needed)
- Cron logic changes (already correct per ADR-0121)
