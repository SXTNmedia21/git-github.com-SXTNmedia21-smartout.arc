---
title: "Harness Coverage Top-3 Batch 4 — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [e2e, harness, coverage, legal, helpdesk, billing-query]
---

# Harness Coverage Top-3 Batch 4 — HANDOFF

## What was built

Three new E2E harness specs.

| Spec | Tools covered | Tests / Skips |
|------|---------------|---------------|
| `apps/e2e/tests/legal-harness-e2e.spec.ts` | cite_law, validate_aml_14_6 | 14 explicit + 28 expect, 11 named tests, classify_amendment gap-doc'd |
| `apps/e2e/tests/helpdesk-harness-e2e.spec.ts` | list_my_queue, get_ticket, open_ticket, resolve_ticket | 65 expects across 14 blocks, 2 skip (A8 authority-conditional, N3 voice) |
| `apps/e2e/tests/billing-query-harness-e2e.spec.ts` | list_my_invoices, get_my_invoice, explain_invoice_basis, list_overdue_invoices, list_invoice_dispatches, get_usage_snapshot | 28 tests / ~55 expects, 2 skip (N1 voice, M1 conditional masking) |

## Decisions

### D1: Pattern reuse from batches 1-3
Three agents dispatched in parallel on wt-11. Each owns one spec + one optional helper. Total wall-clock ~17 min.

### D2: classify_amendment system-channel-only
`legal/classify_amendment` is `allowedChannels: ["system", "autonomous"]`. Cannot be triggered via user chat. Same pattern as `interpret_shift`/`settle_shift` in batch 2. Tracked as `legal-classify-amendment-system-e2e`.

### D3: Authority-conditional open_ticket
helpdesk_query.open_ticket requires `suggest+` authority. SEED_WORKSPACE_ID may have `read_only` (default). A8 self-skips with clear pass-condition message. Same pattern as save_memory tier visibility tests.

### D4: PII masking inline assertions
billing-query `list_invoice_dispatches` surfaces email addresses. Spec asserts mask format inline (M1) — runs when dispatch row exists, skips with activation instructions otherwise.

## Known issues / debt

1. `classify_amendment` system-channel-only — Phase 4 engine-dispatch test infra needed
2. open_ticket / resolve_ticket authority-dependent — seed migration needs review for test workspace coverage
3. M1 conditional masking — relies on seeded dispatch row; could be moved to a fixture for guaranteed coverage
4. get_invoice_basis RPC dependency — A9 graceful if not deployed; production must have it

## Next steps

1. Merge to development.
2. Refresh `apps/e2e/coverage.md`: legal/helpdesk_query/billing-query → 🟡
3. Coverage post-batch-4: 10/29 capabilities = 34%, 45/124 tools = 36%
4. Next top-3 (suggested): engine-world (3), personal (5), training (3)

## References

- Template: `apps/e2e/tests/botsson-harness-e2e.spec.ts`
- Shared helper: `apps/e2e/helpers/botsson-harness.ts`
- Prior batches: HANDOFF-harness-coverage-top3.md, HANDOFF-harness-coverage-top3-batch2.md
- ADR-0078 channel guard, ADR-0099 capability authority, ADR-0151 server-derive IDs, ADR-0116 tool_invoked telemetry
- L-0079 completed_at semantics
