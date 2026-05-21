---
title: "Handoff — billing-payment-terms-config"
status: done
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [handoff, billing, invoice, pricing]
---

# Handoff — billing-payment-terms-config

## Summary

Closes council 2026-05-20 TIER 3 R4. Moves the hardcoded net-14 invoice due-date into a
per-customer-configurable `pricing_terms.payment_terms_days`. Final item of the billing-cron
reliability arc.

## What was built

- **Migration** `20260621200004_pricing_terms_payment_terms_days.sql`: `ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14` + COMMENT + idempotent (DO-block-guarded) CHECK `payment_terms_days > 0`. Default 14 = no behavior change for existing rows.
- **Types**: regenerated `database.types.ts` (Row/Insert/Update) — local gen, no op-run (1Password corrupts gen types).
- **Generator** (`generator.ts:254`): `due_at = issue + (pt.payment_terms_days ?? 14) days` (was hardcoded 14).
- **API**: `payment_terms_days` added to pricing-terms CreateSchema + UpdateSchema + workspaces CreateWorkspaceSchema; written on the pricing_terms insert (default 14).
- **UI**: "Betalingsfrist (dager)" input on platform-admin ContractTab edit form + new-workspace form (web-only authoring per ADR-0133). Accountant `BillingConfigSection` already displays it — now shows the real value.

## Verification

- Local `db reset` clean; column present, default 14, CHECK constraint present.
- `TURBO_CONCURRENCY=1 turbo typecheck --filter=web` → exit 0 (no regressions; pre-existing dist TS2307 unrelated).

## Decisions

- No new ADR (config enhancement, council pre-approved R4; behavior recorded under ADR-0385 follow-up + this handoff).

## Known issues / debt

- Generator due_at logic is in TS (computed before the atomic RPC) — verified by inspection + the column default; not exercised via a full generator run (needs the Deno harness). Low risk: pure offset arithmetic from a NOT-NULL column.

## Next steps

- Billing-cron reliability arc COMPLETE (C1/C2/R1 correctness + watchdog, ADR-0385 manual-collection, R2/R3 pg_cron+runbook, R4 payment terms). Remaining future work: auto-charge (ADR-0385 future ADR), stale-issued collection watchdog, operator n8n droplet cutover on next prod deploy.
