---
title: ADR-0384 — Billing Gate on Signed Contract
id: ADR_0384
status: accepted
layer: decision
created: 2026-05-20
updated: 2026-05-20
module: billing
tags: [billing, cron, contract, pricing, adr-0121]
---

# ADR-0384 — Billing Gate on Signed Contract

## Context and Problem Statement

The monthly billing cron (`generate-monthly-invoices`) lists companies with `company.is_active = true` and generates an invoice per company. But `company.is_active` is `NOT NULL DEFAULT true` — every company is active from creation. The `is_active` filter therefore gates nothing: a company with no signed contract would still be invoiced.

Signing a SaaS contract sets `workspace.contract_status = 'active'` (DocuSeal webhook), but this signal never reached billing. The result: billing was decoupled from the contract lifecycle.

## Decision

The cron gates invoice generation on a **signed contract**: a company is invoiced only if at least one of its workspaces has `contract_status = 'active'`.

- The `is_active = true` filter is kept as a cheap pre-filter (suspended/deactivated companies are excluded early).
- The contract gate is the authoritative one: `generateForCompany` skips any company where no workspace has `contract_status = 'active'`, logging `no signed contract`.
- **Start date** is enforced by the existing `pricing_terms.effective_from <= periodTo` filter. A company with a future `effective_from`, or no `pricing_terms` row at all, is already skipped. Billing therefore begins from the contract's effective date.

## Billing model (clarification, per Pontus 2026-05-20)

`price_per_employee` is the price per **active employee on the shift list (vaktliste)** — NOT a dead field. It is synced equal to `overage_price_per_user` (ADR-0121). The cron computes "active on vaktliste" as the count of distinct `employee_id` with a `completed` `schedule_shift` in the period.

Invoice = `monthly_cost` (includes `free_users` employees, standard 10) + `max(0, active_on_vaktliste − free_users) × overage_price_per_user` + 25% VAT.

UI labels were updated to make this explicit: "Inkluderte ansatte i månedslisens (standard 10)" + "Pris per aktiv ansatt på vaktliste".

## Consequences

- ✅ Un-contracted companies are never invoiced.
- ✅ Billing begins from the contract effective date, not company-create date.
- ✅ Signing a contract becomes the meaningful billing trigger.
- ⚠️ Existing seed/test companies without `contract_status='active'` on any workspace stop being invoiced — this is the intended behaviour, not a regression.
- ⚠️ `price_per_employee` column is retained (NOT dropped). It is the live per-active-employee price, kept in sync with `overage_price_per_user`.

## Related

- ADR-0121 (`pricing_terms` extension: `free_users`, `overage_price_per_user`)
- ADR-0119 (completed-shift billable-user predicate)
- Sortie `feat/pricing-ui-match-adr-0121` (UI aligned to free_users + overage)
- Sortie `feat/owner-as-prokura-signatory` (workspace.signatory_profile_id; owner-invite → contract recipient)
