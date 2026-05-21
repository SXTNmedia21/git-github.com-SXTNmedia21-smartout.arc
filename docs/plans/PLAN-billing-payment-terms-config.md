---
title: "Plan — billing-payment-terms-config"
status: in_progress
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [plan, billing, invoice, pricing, due-date]
---

# Plan — billing-payment-terms-config

> Branch: `feat/billing-payment-terms-config` | Worktree: /home/sxtnl/dev/smartout.ai-wt-9 | Base: `development` | Module: billing
>
> Council 2026-05-20 TIER 3 R4. Moves the hardcoded net-14 invoice due-date into a
> per-customer-configurable `pricing_terms.payment_terms_days`.

## Goal

Make invoice payment terms (due date) a per-customer setting on `pricing_terms` instead of
a hardcoded `now + 14 days` in the generator.

## Context (verified)

- `payment_terms_days` does NOT exist in DB / migrations / `database.types.ts`. It is only
  read defensively in accountant `BillingConfigSection.tsx` (always null today).
- Generator hardcodes `due_at = now + 14 days` (`generator.ts:253-255`), passed to the
  atomic RPC as `p_due_at` (`:306`).
- Pricing config API: `apps/web/src/app/api/platform-admin/pricing-terms/route.ts`
  (CreateSchema at :27 has free_users/overage). Workspace create writes pricing_terms in
  `apps/web/src/app/api/platform-admin/workspaces/route.ts`.
- Web-only (pricing authoring per mobile boundary ADR-0133). No mobile.

## Tasks

- [ ] **Migration** (`<ts>_pricing_terms_payment_terms_days.sql`, ts > 20260621200003):
  `ALTER TABLE public.pricing_terms ADD COLUMN IF NOT EXISTS payment_terms_days int NOT NULL DEFAULT 14;`
  + a COMMENT. (Net-14 default preserves current behavior for all existing rows.)
- [ ] **Regen types**: `npx supabase gen types ... > packages/supabase/src/database.types.ts`
  WITHOUT `op run` (1Password corrupts gen types — substring conceal). Local Supabase only.
- [ ] **Generator** (`generator.ts:253-255`): `due_at = toIsoDate(new Date(Date.now() + (pt.payment_terms_days ?? 14) * 86400000))`. `pt` already comes from `select("*")` so the column is present.
- [ ] **API route** (`pricing-terms/route.ts`): add `payment_terms_days: z.number().int().positive().optional()` to CreateSchema + UpdateSchema; include in the insert/update payload.
- [ ] **Workspace create** (`workspaces/route.ts`): write `payment_terms_days` on the pricing_terms insert (default 14 if not provided).
- [ ] **UI**: add a `payment_terms_days` input (label "Betalingsfrist (dager)", default 14) to the platform-admin pricing edit form (ContractTab) + new-workspace pricing form. Accountant `BillingConfigSection` already displays "Betalingsfrist X dager" — will now show the real value.

## Out of scope

- Auto-charge (ADR-0385 manual V1). Stale-issued watchdog.

## Acceptance Criteria

- [ ] Migration applies clean on local Supabase; column present with default 14.
- [ ] Generator uses `payment_terms_days` (verify via RPC smoke test or read-back).
- [ ] API create/update accept + persist `payment_terms_days`.
- [ ] UI input present on both authoring surfaces; accountant display shows real value.
- [ ] Typecheck passes.
- [ ] User journeys written.

## Journeys

1. Platform-admin sets per-customer payment terms (e.g. net-30) when configuring pricing.
2. Generated invoice's due date reflects the customer's `payment_terms_days` (not always net-14).
3. Accountant sees the real payment term on the workspace kartotek.

## Knowledge to capture (at closure)

- No ADR (config enhancement, council pre-approved as R4). Learning only if non-obvious.
