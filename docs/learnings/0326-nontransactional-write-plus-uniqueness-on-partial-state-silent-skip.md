---
id: L-0326
title: Non-transactional multi-write + uniqueness-on-partial-state = silent skip
status: accepted
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [learnings, billing, cron, idempotency, transactionality, trust-gate]
---

# L-0326 — Non-transactional multi-write guarded by an idempotency early-exit will lock in partial state

## Context

`generate-monthly-invoices/generator.ts::generateForCompany` did three separate writes
per company: INSERT invoice (status='draft') → INSERT invoice_line_item[] → UPDATE
status='issued'. Idempotency was enforced two ways: a DB partial unique index
`idx_invoice_one_recurring_per_period` (WHERE `invoice_type='recurring' AND status<>'void'`)
and an application early-exit that skipped if a matching non-void invoice already existed.

## The defect

The early-exit predicate (`status<>'void'`) matches the **partial state** a crash leaves
behind. If the process died after the draft INSERT but before the draft→issued UPDATE, a
header-only `draft` invoice (zero line items, zero collectible amount) remained. On the next
run, both guards treated that stuck draft as "already billed" → the company was **silently
never billed**. No error, no signal. n8n cron retries made the crash window *more* likely to
be hit, not less. The idempotency index that protects against double-billing offered zero
protection against zero-billing — there is nothing to detect because a (broken) row exists.

## The rule

**Any multi-write sequence guarded by an idempotency early-exit MUST be transactional — or
the early-exit will lock in partial state.** When the uniqueness/skip predicate can be
satisfied by an *incomplete* write, a crash mid-sequence is indistinguishable from success.
Wrap the sequence in a single transaction (e.g. a SECURITY DEFINER plpgsql RPC) so it either
commits complete or rolls back fully, leaving nothing for the early-exit to mistake for done.

## Trust-gate check (reusable)

When reviewing any generation/mutation path:
1. Is there a multi-row write sequence (header + children + state transition)?
2. Is it guarded by an early-exit or unique constraint?
3. Does that guard's predicate match a *partial* (mid-sequence) state?
→ If 1+2+3, the sequence MUST be atomic, or partial state silently wins.

## Sibling failures (same shape: no error, silently wrong state)

- L-0177 — silent fallback to JWT-default workspace on row-not-found.
- Telemetry-contract-without-emit-wiring (ADR-0358) — registry entry, no emit site.
- All share: the failure produces no exception and no log, only quietly incorrect data.

## Fix

ADR-0384-adjacent sortie `feat/billing-cron-correctness` (2026-05-20): `fn_generate_company_invoice`
SECURITY DEFINER RPC makes per-company generation atomic; C2 migration voids pre-existing
stuck drafts; R1 `fn_check_billing_run` watchdog converts silent zero-billing into an audited
`invoice generation_missing` signal. Surfaced by run-council 2026-05-20 (chair self-reversal,
L-0147 6th precedent — chair Phase 3 called it "operational only"; two code-tracers found the
correctness defect).
