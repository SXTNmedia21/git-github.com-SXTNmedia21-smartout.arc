---
title: "Plan — m2-doc-chunk-auto-update"
feature: m2-doc-chunk-auto-update
spec: docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md
status: draft
updated: 2026-04-28
created: 2026-04-28
module: Core
campaign: core-module
milestone: M2.3
tags: [plan, knowledge, ingest, embeddings, governance]
---

# Plan — m2-doc-chunk-auto-update

> Branch: `feat/core-module-m2-doc-chunk-auto-update` | Worktree: `/home/sxtnl/dev/smartout.ai-core-module-wt-1` | Base: `campaign/core-module` | Module: Core

**Spec:** [Workspace Doc Chunk Auto-Update on Governance Edit (M2.3)](../superpowers/specs/2026-04-28-doc-chunk-auto-update.md)

## Journeys (the contract)

- [JOURNEY-m2-doc-chunk-auto-update-handbook-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-handbook-edit.md) — Admin edits handbook_chapter → re-ingest → searchKnowledge returns updated text
- [JOURNEY-m2-doc-chunk-auto-update-policy-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-policy-edit.md) — Admin edits policy → same flow
- [JOURNEY-m2-doc-chunk-auto-update-protocol-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-protocol-edit.md) — Admin edits protocol → same flow
- [JOURNEY-m2-doc-chunk-auto-update-ingest-failure](../journeys/JOURNEY-m2-doc-chunk-auto-update-ingest-failure.md) — Ingest fails (embedding API down) → prior chunks intact, engine_state failed, UI not blocked

## Goal

Wire governance Server Actions that update `handbook_chapter` / `policy` / `protocol` content to trigger source-targeted re-ingest via existing `ingest-workspace-knowledge` edge function. ≤30s lag from save to Botsson reflecting new content.

## Tasks

- [ ] **T1** — Discovery: grep `apps/web/src/app/dashboard/governance/` and any path that UPDATEs handbook_chapter / policy / protocol content. Document file:line of each Server Action UPDATE site.
- [ ] **T2** — Read `supabase/functions/ingest-workspace-knowledge/index.ts` end-to-end. Document: source-targeted filter support, idempotency on content_hash, delete-stale-chunks behavior.
- [ ] **T3** — Read `supabase/functions/engine-dispatch/index.ts` for `ingest_knowledge` action handler. Verify: payload shape, per-row serialization, success/failure telemetry.
- [ ] **T4** — Add telemetry event `governance.content_updated` to `packages/telemetry/src/registry.ts`. Routing: posthog + activity_trail + engine_event. Payload `{ workspaceId: NonEmptyString; actorId: NonEmptyString; source_type: 'handbook_chapter' | 'policy' | 'protocol'; source_id: NonEmptyString; trigger: 'create' | 'update' | 'delete' }`.
- [ ] **T5** — Update each governance Server Action from T1 to emit `governance.content_updated` AFTER successful gate_action + DB UPDATE. Use existing emit() helper. nonEmpty workspace_id + actor_id from auth context.
- [ ] **T6** — Verify engine-dispatch routes `governance.content_updated` engine_event rows to `ingest_knowledge` action. If missing, add handler. Pass source_type + source_id from event payload.
- [ ] **T7** — If T2 found no source-targeted ingest support, extend `ingest-workspace-knowledge` to accept optional `source_type` + `source_id` body params. Existing full-workspace path stays.
- [ ] **T8** — Handle DELETE (Q4): on trigger='delete', ingest function removes all `workspace_doc_chunk` rows for `(source_type, source_id)`. Add branch.
- [ ] **T9** — Idempotency: verify unique constraint on `(workspace_id, source_type, source_id, chunk_index)`. Add migration if missing. Document expected debounce behavior.
- [ ] **T10** — Failure handling: ingest API error → engine_state status='failed'. Prior chunks remain (NOT wiped at start). Admin save UX unaffected.
- [ ] **T11** — E2E `apps/e2e/tests/journey-doc-chunk-handbook-edit.spec.ts`: seed handbook_chapter, edit via Server Action, wait ≤35s, query workspace_doc_chunk via service-role for updated content.
- [ ] **T12** — E2E `apps/e2e/tests/journey-doc-chunk-policy-edit.spec.ts`: same shape, policy table.
- [ ] **T13** — E2E `apps/e2e/tests/journey-doc-chunk-protocol-edit.spec.ts`: same shape, protocol table.
- [ ] **T14** — E2E `apps/e2e/tests/journey-doc-chunk-ingest-failure.spec.ts`: stub embedding API error, edit content, verify prior chunks remain + engine_state failed.
- [ ] **T15** — Audit:
  - G-DISP: dispatch path uses engine_event/engine-dispatch (no bespoke worker)
  - G-WS: every emit has nonEmpty workspace_id + actor_id
  - I-4 workspace scoping: cross-workspace edit cannot affect another workspace's chunks
- [ ] **T16** — `pnpm turbo typecheck` PASS.
- [ ] **T17** — Flip each journey frontmatter to `status: verified` + `e2e_test:` path.
- [ ] **T18** — HANDOFF in `docs/handoffs/HANDOFF-m2-doc-chunk-auto-update.md` with audit verdicts + Q1/Q2/Q4 outcomes + I-1..I-4.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for Q1 / Q2 / Q4 outcomes if architectural
- [ ] At least one E2E test exists per journey
- [ ] G-DISP merge-blocker: ingest path uses engine_event, no bespoke worker
- [ ] G-WS merge-blocker: every emit has nonEmpty workspace_id + actor_id
