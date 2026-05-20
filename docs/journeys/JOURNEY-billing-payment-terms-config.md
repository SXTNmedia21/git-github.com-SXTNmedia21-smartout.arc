---
title: "Journey — billing-payment-terms-config"
status: done
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [journey, billing, invoice, pricing]
---

# User Journeys — billing-payment-terms-config

## Journey: Platform-admin sets per-customer payment terms
**Precondition:** Platform-admin (godmode) on a workspace's Avtaler tab or the new-workspace form.
1. Admin enters "Betalingsfrist (dager)" (default 14) alongside free_users + overage → submits pricing.
2. System persists `pricing_terms.payment_terms_days` (API Zod-validated `int > 0`).
**Postcondition:** The customer's payment term is stored; future invoices use it.
**Error paths:** ≤0 or non-integer → Zod 400 (CreateSchema/UpdateSchema) + DB CHECK `payment_terms_days > 0` as defense-in-depth. Not provided → default 14.

## Journey: Generated invoice due date reflects the customer's term
**Precondition:** A company has `pricing_terms.payment_terms_days` set (or default 14).
1. Generation cron runs → generator reads `pt.payment_terms_days` (from `select("*")`).
2. `due_at = issue_date + (payment_terms_days ?? 14) days` → passed to the atomic RPC.
**Postcondition:** Invoice due date matches the per-customer term (net-30 customer gets +30, not always +14).
**Error paths:** Null column (shouldn't happen — NOT NULL DEFAULT 14) → `?? 14` fallback in TS.

## Journey: Accountant sees the real payment term
**Precondition:** Accountant viewing the workspace kartotek (apps/admin).
1. `BillingConfigSection` reads `pricingTerms.payment_terms_days` → renders "Betalingsfrist X dager".
**Postcondition:** The actual configured term is visible (was always blank before the column existed).
**Error paths:** none — column is NOT NULL.
