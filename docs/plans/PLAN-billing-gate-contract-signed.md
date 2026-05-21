---
title: "Plan — billing-gate-contract-signed"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [plan, billing, cron, contract, pricing]
---

# Plan — billing-gate-contract-signed

> Branch: `feat/billing-gate-contract-signed` | Worktree: /home/sxtnl/dev/smartout.ai-wt-5 | Base: `development` | Module: billing

## Goal

The monthly billing cron must only invoice companies that have a SIGNED contract and a DEFINED start date. Today it bills every company with `is_active=true` (the default), so un-contracted companies would be invoiced. Add a contract-signed gate. Also clarify the per-employee billing model in the UI: `price_per_employee` = price per active employee on the shift list (vaktliste), with a free limit of 10 included in the monthly license.

## Background

- `company.is_active` is `NOT NULL DEFAULT true` — every company is active on creation, so the cron's `is_active=true` filter gates nothing.
- Signing a SaaS contract sets `workspace.contract_status='active'` (docuseal webhook line 336-344) but never gates billing.
- Cron company query: `generator.ts:42-45` selects all `is_active=true` companies + nested `workspace(workspace_id)`.
- Per Pontus 2026-05-20: billing model = `monthly_cost` (includes `free_users` employees) + `(active_on_vaktliste − free_users) × price_per_employee`. Free limit standard = 10.
- The cron ALREADY computes "active on vaktliste" = distinct `employee_id` from `schedule_shift status='completed'` in the period (`generator.ts:156-171`), then `billable = active − free_users`, `overage = billable × overage_price_per_user`. This matches Pontus' model. `price_per_employee` is synced `= overage_price_per_user` (prior sortie). DO NOT drop the column — it is the live per-active-employee price.
- Start date: `pricing_terms.effective_from` already gates via `lte(effective_from, periodTo)` (`generator.ts:128`). A future effective_from naturally excludes the company until that period. "Start date must be defined" → a company with no pricing_terms row is already skipped (`generator.ts:134`).

## Tasks

### A. Cron contract-signed gate
- [ ] `supabase/functions/generate-monthly-invoices/generator.ts`:
  - Extend `CompanyRow` type: `workspace: Array<{ workspace_id: string; contract_status: string | null }> | null`.
  - Company query (line 44): change nested select to `workspace(workspace_id, contract_status)`.
  - In `generateForCompany`: after the workspaces-empty check (line 142), add a gate — at least one workspace must have `contract_status === 'active'`. If none, skip with log `no signed contract`. This is the new billing-gate.
  - Keep the existing `is_active=true` filter (cheap pre-filter) AND the new contract gate (the real gate).

### B. UI label clarity — per-active-employee + free 10
- [ ] `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx`:
  - Relabel "Inkluderte brukere (gratis)" → "Inkluderte ansatte i månedslisens (standard 10)".
  - Relabel "Pris per bruker over inkluderte" → "Pris per aktiv ansatt på vaktliste (over inkluderte)".
  - Read-mode dl labels match.
- [ ] `apps/web/src/app/platform-admin/workspaces/new/page.tsx`: same two relabels. Verify `free_users` default is "10".

### C. Decision log
- [ ] Register an ADR note (or amend ADR-0121) documenting the contract-signed billing gate. New ADR slot — grep `docs/decisions/` for next free number.

## Acceptance Criteria

- [ ] `apps/web` tsc exit 0
- [ ] generator.ts Deno typecheck (or tsc) clean
- [ ] Manual SQL test: company with no workspace contract_status='active' → cron skips (verify via log + no invoice row). Company with one active-contract workspace → invoice created.
- [ ] free_users default = 10 in both UI forms
- [ ] Labels reflect "aktiv ansatt på vaktliste" + "inkluderte ansatte i månedslisens"

## Out of Scope

- Dropping price_per_employee column (it is the live per-active-employee price, NOT dead)
- Stripe outbound payment creation (separate 🔴, needs ADR)
- company.is_active lifecycle rework (we gate on contract_status, not is_active flips)
