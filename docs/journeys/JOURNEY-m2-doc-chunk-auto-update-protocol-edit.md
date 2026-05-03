---
title: "Journey — Admin edits protocol → workspace_doc_chunk re-ingested"
feature: m2-doc-chunk-auto-update
journey: protocol-edit
status: verified
verified_at: 2026-04-29
e2e_test: apps/e2e/tests/journey-doc-chunk-protocol-edit.spec.ts
created: 2026-04-28
updated: 2026-04-29
module: Core
tags: [journey, knowledge, ingest, protocol, admin]
---

# Journey: Admin edits protocol → re-ingest

**Role:** admin

**Precondition:** Workspace has at least one `protocol` row ingested into workspace_doc_chunk.

## Happy Path

Same shape as handbook-edit + policy-edit, `source_type='protocol'`:

1. Admin edits protocol content via Server Action.
2. After UPDATE: emit `governance.content_updated` with source_type='protocol'.
3. engine_event → engine-dispatch → ingest_knowledge → re-embed.
4. ≤30s later, searchKnowledge reflects new protocol text.

**Postcondition:** protocol chunks updated. Idempotency holds.

## Error Paths

Same as sibling journeys. RLS workspace scoping. Embedding API failure isolation.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
