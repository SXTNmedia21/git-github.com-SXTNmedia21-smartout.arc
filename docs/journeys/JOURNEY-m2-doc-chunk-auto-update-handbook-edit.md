---
title: "Journey — Admin edits handbook_chapter → workspace_doc_chunk re-ingested → searchKnowledge returns updated text"
feature: m2-doc-chunk-auto-update
journey: handbook-edit
status: verified
verified_at: 2026-04-29
e2e_test: apps/e2e/tests/journey-doc-chunk-handbook-edit.spec.ts
created: 2026-04-28
updated: 2026-04-29
module: Core
tags: [journey, knowledge, ingest, handbook, admin]
---

# Journey: Admin edits handbook → re-ingest → Botsson reflects update

**Role:** admin

**Precondition:** Workspace has at least one `handbook_chapter` row already ingested into `workspace_doc_chunk`. Admin authenticated.

## Happy Path

1. Admin opens handbook chapter editor on `/dashboard/governance/...` (or wherever).
2. Admin edits content (e.g. changes "vakter starter kl 09" → "vakter starter kl 08").
3. Admin clicks Save.
4. Server Action runs: gate_action('handbook_chapter', 'update') → UPDATE handbook_chapter SET content=... → emit `governance.content_updated` with `{ source_type: 'handbook_chapter', source_id, trigger: 'update' }`.
5. emit() routes to engine_event → engine-dispatch picks up event → invokes `ingest_knowledge` action with source_type + source_id.
6. ingest-workspace-knowledge fetches updated row → chunks → embeds → upserts into workspace_doc_chunk.
7. Within ≤30s of step 3, `searchKnowledge` query for related text returns the NEW content (not stale "kl 09").

**Postcondition:** workspace_doc_chunk rows for that source reflect updated text. Prior chunks for unchanged sections retained via content_hash idempotency. Botsson chat hero answers with updated information.

## Error Paths

- **Scenario:** Embedding API errors → engine_state status='failed'. Prior chunks remain. searchKnowledge keeps returning old content until next successful ingest. Admin save UX unaffected.
- **Scenario:** Admin saves 5 times in 10s → 5 events queued. Last write wins via upsert on `(workspace_id, source_type, source_id, chunk_index)`.
- **Scenario:** Cross-workspace edit attempt blocked by gate_action + RLS — workspace A admin can never trigger ingest for workspace B's handbook.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end (edit handbook → wait → search via Botsson → updated text returned)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
