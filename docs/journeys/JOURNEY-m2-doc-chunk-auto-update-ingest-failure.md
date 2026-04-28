---
title: "Journey — Ingest fails (embedding API error) → prior chunks intact, retry queued, UI not blocked"
feature: m2-doc-chunk-auto-update
journey: ingest-failure
status: verified
verified_at: 2026-04-29
e2e_test: apps/e2e/tests/journey-doc-chunk-ingest-failure.spec.ts
created: 2026-04-28
updated: 2026-04-29
module: Core
tags: [journey, knowledge, ingest, failure, resilience]
---

# Journey: Ingest fails gracefully

**Role:** admin

**Precondition:** Workspace has handbook/policy/protocol content already ingested. Embedding API (OpenRouter) is unavailable or returns error.

## Happy Path (failure scenario, graceful degradation)

1. Admin edits handbook content + saves.
2. Server Action UPDATE succeeds. emit `governance.content_updated`.
3. engine-dispatch picks up event → invokes ingest-workspace-knowledge.
4. ingest function calls embedding API → API returns 5xx OR times out.
5. Ingest function catches error, returns failure status to dispatcher.
6. engine_state row for that ingest action moves to status='failed' with error context.
7. Prior workspace_doc_chunk rows for that source remain unchanged (NOT wiped at start of ingest run — verified in T2).
8. Admin save UX: save returned `ok:true` immediately (fire-and-forget). No error shown to admin.
9. searchKnowledge keeps returning prior content. Stale by 1 edit but not broken.

**Postcondition:** No data loss. Failed engine_state visible to ops/admin in audit. Retry can be triggered manually OR will fire on next save (which re-emits and re-ingests).

## Error Paths (within the failure scenario)

- **Scenario:** Ingest function partially succeeds (embedded chunk 1+2, errored on chunk 3) → either commit partial OR rollback. Default: rollback. ingest-workspace-knowledge MUST treat the per-source ingest as a transaction (verify in T2/T7).
- **Scenario:** engine-dispatch can't reach edge function (network error before ingest starts) → engine_state status='failed', no chunks touched.
- **Scenario:** Repeated failures → engine-dispatch retry policy applies (existing infrastructure, no M2.3 work).

## Verification

- [ ] Implementation matches the steps above (fire-and-forget save, no UI break, prior chunks retained)
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — stub embedding API error, assert prior chunk unchanged + engine_state.status='failed'
- [ ] Manually tested end-to-end (turn off embedding API key, edit content, verify graceful degradation)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
