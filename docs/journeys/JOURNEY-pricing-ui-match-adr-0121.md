---
title: "Journey — Pricing UI matches ADR-0121"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [journey, platform-admin, billing, pricing]
---

# Journey — Pricing UI matches ADR-0121

> Branch: `feat/pricing-ui-match-adr-0121`

## Journey 1: Platform-admin sets pricing that actually flows into billing

**Precondition:** Pontus (godmode) on `/platform-admin/workspaces/[id]` → Avtaler tab → click Edit pricing.

1. Pontus sees three pricing inputs:
   - Månedsavgift (`monthly_cost`)
   - Inkluderte brukere (`free_users`, default 10)
   - Pris per bruker over inkluderte (`overage_price_per_user`)
2. Pontus sets: monthly_cost=2000, free_users=5, overage=150
3. Clicks Save → `POST/PATCH /api/platform-admin/pricing-terms`
4. Backend writes `pricing_terms { monthly_cost: 2000, free_users: 5, overage_price_per_user: 150, price_per_employee: 150 }` (last field synced from overage for backward compat)
5. Toast confirms save → form updates from DB
6. Next billing cron run (day 5 of next month) uses these values:
   - Workspace has 12 active users → billable_users = 12 - 5 = 7
   - Invoice total = 2000 + 7 × 150 = 3050 + 25% VAT

**Postcondition:** Invoice line items reflect Pontus' input. Pre-ADR-0121 `price_per_employee` column stays in sync as transition cache.

**Error paths:**
- free_users negative → Zod rejects with 400
- overage_price_per_user missing → falls back to old price_per_employee value if Pontus left it as a legacy form (transition support)

## Journey 2: Workspace creation with pricing matches billing model

**Precondition:** Pontus on `/platform-admin/workspaces/new`.

1. Pontus fills company + workspace + template + pricing
2. Pricing section shows: monthly_cost + free_users + overage_price_per_user (replaces old "pris per ansatt")
3. Template default-pricing populates the fields if template defines them (template.default_pricing.price_per_employee maps to overage_price_per_user during transition)
4. Pontus clicks Create → POST `/api/platform-admin/workspaces`
5. Backend creates company + workspace + pricing_terms row with new fields + synced `price_per_employee`
6. Workspace appears in list with billing-ready pricing

**Postcondition:** Pricing aligns with what the billing cron actually reads. No dead-write of `price_per_employee` standalone.
