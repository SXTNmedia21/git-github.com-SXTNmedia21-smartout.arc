---
id: ADR-0385
title: Billing collection is manual in V1 — generation cron stops at issued
status: accepted
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [billing, invoice, collection, stripe, cron, scope]
---

# ADR-0385 — Billing collection is manual in V1; generation cron stops at `issued`

## Status

accepted (2026-05-21)

## Context

The monthly invoice generator (`generate-monthly-invoices`) produces invoices and
transitions them to `status='issued'` (ADR-0118/0119/0384, and the atomic RPC from
sortie `feat/billing-cron-correctness`). A separate dispatch/collection layer exists:
`enqueueDispatchesForInvoice` (`packages/billing/src/actions/dispatch/`) + the
`dispatch_invoice` engine-dispatch handler + `StripeDispatchAdapter` (Checkout Session).
Stripe is wired both inbound (`stripe-webhook` → `payment` → `invoice.status='paid'`)
and outbound-on-demand ("Betal nå" Checkout + manual `dispatch_invoice`).

The run-council 2026-05-20 (order/invoice cron review) flagged that
`enqueueDispatchesForInvoice` has **zero call-sites from the generation cron** — the cron
stops at `issued` and never auto-charges. The council asked: is `issued→sent` auto-charge
in scope, and if not, document the manual-collection boundary so the unwired function reads
as deliberate, not abandoned (TIER 2 scope decision, owner: Pontus).

## Decision

**Collection is manual in V1. The generation cron deliberately stops at `status='issued'`.**

- The monthly cron generates + issues invoices only. It does NOT call
  `enqueueDispatchesForInvoice` and does NOT trigger any Stripe charge.
- Collection happens via existing manual/operator paths: the customer-facing "Betal nå"
  Checkout, or a platform-admin manually triggering `dispatch_invoice`.
- `enqueueDispatchesForInvoice` + `StripeDispatchAdapter` remain in the codebase as
  **built-but-intentionally-unwired** infrastructure for a future auto-charge decision —
  they are NOT dead code and MUST NOT be deleted as "unused."

## Rationale

- Auto-charging from an unattended cron is the highest-blast-radius action in the billing
  system: it moves real customer money without a human in the loop. Wiring it requires an
  explicit go decision + verification of the Stripe charge path under cron conditions.
- Manual collection V1 is the current, working behavior — this ADR records it as a
  deliberate boundary rather than a gap.

## Consequences

- Invoices can sit in `issued` indefinitely until collected manually. The R1 missing-run
  watchdog (`fn_check_billing_run`) detects missing *generation*, not missing *collection* —
  a follow-up watchdog for stale `issued` invoices may be warranted if manual collection lags.
- Promoting to auto-charge is a future ADR (supersede this one's V1 scope): wire
  `enqueueDispatchesForInvoice` into the generation flow after the atomic RPC, behind an
  explicit operator opt-in, with the Stripe charge path verified under cron.

## Refs

- ADR-0118 (Invoice Engine as C3 Commercial Consumer), ADR-0384 (billing gate), ADR-0131
  (Stripe Connect platform model), ADR-0127/0129 (dispatch rule + adapter pattern).
- run-council 2026-05-20 (order/invoice cron review, COUNCIL-LOG).
- Sortie `feat/billing-cron-correctness` (C1/C2/R1).
