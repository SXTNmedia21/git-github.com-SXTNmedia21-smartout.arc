---
title: "Journey — Billing only fires for signed contracts"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [journey, billing, cron, contract]
---

# Journey — Billing only fires for signed contracts

> Branch: `feat/billing-gate-contract-signed`

## Journey 1: Cron skips un-contracted company

**Precondition:** Company exists, `is_active=true`, has a workspace, has pricing_terms. No contract signed (`workspace.contract_status != 'active'`). Cron runs day 5.

1. Cron lists active companies (is_active=true) with nested workspace + contract_status
2. For this company: workspaces exist, pricing_terms exist
3. **NEW gate:** no workspace has `contract_status='active'` → skip with log `no signed contract`
4. No invoice row created

**Postcondition:** Un-contracted company is NOT invoiced.

## Journey 2: Cron invoices contracted company from start date

**Precondition:** Company has a workspace with `contract_status='active'` (SaaS contract signed). pricing_terms with `effective_from` <= billing period. 12 employees worked completed shifts in the period. free_users=10, price_per_employee (= overage)=150.

1. Cron lists company → workspace contract_status='active' → gate passes
2. pricing_terms resolved: effective_from <= periodTo → start date defined → continue
3. Count active on vaktliste: 12 distinct employee_ids with completed shifts
4. billable = 12 − 10 = 2
5. Invoice = monthly_cost + 2 × 150 + 25% VAT
6. Invoice row created (status draft → issued)

**Postcondition:** Contracted company invoiced correctly from the contract start date, billing only the employees over the free limit.

**Error paths:**
- effective_from in the future → pricing_terms query excludes it → skip (start date not yet reached)
- No pricing_terms at all → skip `no effective pricing_terms`

## Journey 3: Admin sets per-employee price with clear labels

**Precondition:** Pontus on workspace-detail Avtaler tab, editing pricing.

1. Sees "Inkluderte ansatte i månedslisens (standard 10)" input → sets 10
2. Sees "Pris per aktiv ansatt på vaktliste (over inkluderte)" input → sets 150
3. Saves → pricing_terms { free_users: 10, overage_price_per_user: 150, price_per_employee: 150 }

**Postcondition:** Pricing matches the billing math. Labels make explicit that billing counts active employees on the shift list above the included 10.
