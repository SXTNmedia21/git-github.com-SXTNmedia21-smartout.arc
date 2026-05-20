---
title: "Handoff — billing-cron-correctness"
status: done
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [handoff, billing, cron, invoice, correctness]
---

# Handoff — billing-cron-correctness

## Summary

The monthly invoice generator (`generate-monthly-invoices`) generated invoices via three
non-transactional writes per company (INSERT draft → INSERT line_items → UPDATE issued). A
crash mid-sequence left a header-only `draft` invoice that the idempotency early-exit + partial
unique index then treated as "already billed" → the company was silently never billed. This
sortie makes generation atomic, cleans up pre-existing stuck drafts, and adds a missing-run
watchdog so silent zero-billing becomes detectable. Surfaced by run-council 2026-05-20
(APPROVE WITH CHANGES; chair self-reversal, L-0147 6th precedent).

## What was built

- **C1 — atomic generation.** `fn_generate_company_invoice` SECURITY DEFINER RPC
  (`20260621200000`) wraps invoice draft + line-items + draft→issued in one transaction;
  `assign_invoice_number` trigger fires on the in-tx UPDATE. `generator.ts` calls the RPC
  instead of 3 separate writes; emits run after the RPC returns.
- **C2 — stuck-draft cleanup.** One-shot idempotent migration (`20260621200001`) voids
  pre-C1 header-only recurring drafts so affected companies are re-billed next run.
- **R1 — missing-run watchdog.** `fn_check_billing_run` SECURITY DEFINER + pg_cron day-7
  (`20260621200002`) detects active-contract companies with no recurring invoice for the
  previous month and writes `invoice generation_missing` to `billing_activity_log`
  (ADR-0125). New telemetry event registered in `packages/telemetry/src/registry.ts`.

## Verification (runtime)

- Local Supabase `db reset` applied all 3 migrations clean.
- psql smoke test (rollback txn): C1 RPC produced an `issued` invoice with assigned number +
  2 line items atomically; unique index correctly blocked a duplicate (company, period); R1
  detected 1 missing company + wrote 1 `billing_activity_log` row.
- Telemetry package typecheck: 0 errors. generator.ts (Deno) typecheck via Stop-hook clean.

## Decisions

- No new ADR in this sortie. The pg_cron-vs-n8n decision for the GENERATION trigger (council R3)
  is deferred to its own sortie + ADR (see Next steps). R1 watchdog uses pg_cron directly, which
  partially demonstrates the target convention.

## Learnings

- **L-0326** — non-transactional multi-write + uniqueness-on-partial-state = silent skip.
  Registered in `docs/learnings/0000-learning-log.md`.

## Known issues / debt (out of scope — separate sorties)

- **R2 + R3** — runbook `docs/runbooks/billing-monthly-cron-n8n.md` (referenced in `index.ts:4`)
  still MISSING; the GENERATION trigger is still external n8n (unversioned). Own sortie + ADR.
- **Auto-charge** — `enqueueDispatchesForInvoice` is built but unwired; collection (issued→sent /
  Stripe charge) remains manual. Council deferred to a Pontus scope decision (manual collection V1
  recommended). The cron stops at `issued`.
- **R4** — `due_at` is hardcoded net-14 in `generator.ts`; should move to `pricing_terms`.

## Next steps

1. Decide auto-charge scope (Pontus) — then wire or document the manual boundary.
2. R2/R3 sortie: write the runbook + migrate generation trigger to pg_cron (ADR).
3. R1 follow-up: route `invoice generation_missing` to an operator alert channel (Telegram/Linear).
