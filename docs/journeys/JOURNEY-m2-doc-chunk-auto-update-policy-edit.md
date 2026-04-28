---
title: "Journey — Admin edits policy → workspace_doc_chunk re-ingested"
feature: m2-doc-chunk-auto-update
journey: policy-edit
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, knowledge, ingest, policy, admin]
---

# Journey: Admin edits policy → re-ingest

**Role:** admin

**Precondition:** Workspace has at least one `policy` row ingested into workspace_doc_chunk.

## Happy Path

Same shape as handbook-edit journey, with `source_type='policy'`:

1. Admin edits policy content via Server Action.
2. After UPDATE: emit `governance.content_updated` with source_type='policy'.
3. engine_event → engine-dispatch → ingest_knowledge → re-embed.
4. ≤30s later, searchKnowledge reflects new policy text.

**Postcondition:** policy chunks updated. Prior unchanged content retained via content_hash idempotency.

## Error Paths

Same as handbook-edit journey. Embedding API failure leaves prior chunks intact. Workspace scoping enforced.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
