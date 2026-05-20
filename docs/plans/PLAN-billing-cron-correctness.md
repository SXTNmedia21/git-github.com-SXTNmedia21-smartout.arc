---
title: "Plan — billing-cron-correctness"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [plan, billing, cron, invoice, correctness, watchdog]
---

# Plan — billing-cron-correctness

> Branch: `feat/billing-cron-correctness` | Worktree: /home/sxtnl/dev/smartout.ai-wt-5 | Base: `development` | Module: billing | Started: 2026-05-20
>
> Council verdict 2026-05-20: APPROVE WITH CHANGES. Chair self-reversal (L-0147 6th) —
> generation logic has a CORRECTNESS defect, not just operational gaps.

## Goal

Make monthly invoice generation atomic per company (kill stuck-draft silent under-billing),
void pre-existing stuck drafts, and add a missing-run watchdog — the minimum that makes
"order system fungerer på cron basis" actually true.

## Problem (verified against code)

`generate-monthly-invoices/generator.ts::generateForCompany` does 3 non-transactional writes
per company: invoice insert (draft, L257) → line_items insert (L316) → status→issued (L359).
A crash between insert(draft) and →issued leaves a header-only `draft` invoice. The early-exit
(L115, `status<>'void'`) + unique index `idx_invoice_one_recurring_per_period`
(WHERE invoice_type='recurring' AND status<>'void') then treat that stuck draft as "already
billed" → company silently never billed. n8n retries make it MORE likely.

## Tasks

- [ ] **C1 — Atomic generation (CORRECTNESS, blocks).** New migration: `fn_generate_company_invoice(...)`
  SECURITY DEFINER, `SET search_path TO public, extensions`. Inputs: company_id, period_from,
  period_to, pricing_terms_id, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat, currency,
  due_at, line_items JSONB[]. Body (atomic by function semantics): INSERT invoice(status='draft') →
  INSERT all line_items → UPDATE status='issued' (fires draft→issued assign_invoice_number trigger).
  RETURN invoice_id + invoice_number. Refactor `generator.ts`: keep usage_snapshot upsert + amount/
  line-item computation in TS, replace the 3 writes (L257-364) with one RPC call. Emits stay in TS
  AFTER RPC returns.
- [ ] **C2 — Reconcile stuck drafts (one-shot, blocks first reliable run).** Forward-only idempotent
  migration: `UPDATE invoice SET status='void' WHERE invoice_type='recurring' AND status='draft'
  AND NOT EXISTS (SELECT 1 FROM invoice_line_item li WHERE li.invoice_id = invoice.invoice_id)`.
  Comment as one-shot cleanup of pre-C1 stuck drafts. No-op on fresh DB.
- [ ] **R1 — Missing-run watchdog (detection).** New migration: `fn_check_billing_run()` SECURITY
  DEFINER + pg_cron (~day 7, 06:00 CET). Detect every company with a workspace
  `contract_status='active'` that has NO non-void recurring invoice for previous-month period →
  insert `billing_activity_log` event `invoice generation_missing` (one per missing company),
  SECURITY DEFINER direct insert (platform-scoped, ADR-0125). Register `invoice generation_missing`
  in `packages/telemetry/src/registry.ts`.

## Out of scope (separate sorties)

- R3 pg_cron migration of the GENERATION trigger (n8n→pg_cron) + runbook R2 — own sortie + ADR.
- Auto-charge wiring (`enqueueDispatchesForInvoice` → cron) — needs Pontus scope decision; manual collection V1.
- due_at → pricing_terms (R4).

## Acceptance Criteria

- [ ] C1 RPC exists; `generator.ts` calls it; no path inserts a draft invoice without same-tx issue.
- [ ] Simulated crash (manual stuck draft) → next run re-bills (after C2 void) — no permanent skip.
- [ ] R1 detects a missing run on seed and writes `invoice generation_missing`.
- [ ] Local Supabase `db reset` + migrations apply clean; generator harness produces 1 issued invoice/company.
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (note: pg_cron ADR deferred to R3 sortie)
- [ ] User journeys written (3 below)

## Journeys

1. System (cron) generates monthly invoice atomically — no partial/stuck drafts.
2. Operator/cron detects a missing billing run (watchdog) and surfaces it.
3. Maintenance: pre-existing stuck drafts are voided so affected companies get re-billed.

## Knowledge to capture (at closure)

- Learning: non-transactional multi-write + uniqueness-on-partial-state = silent skip (trust-gate check).
- ADR (separate R3 sortie): pg_cron-vs-n8n for billing generation.
