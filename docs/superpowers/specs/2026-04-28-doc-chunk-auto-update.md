---
title: "Workspace Doc Chunk Auto-Update on Governance Edit (M2.3)"
status: draft
created: 2026-04-28
updated: 2026-04-28
module: Core
campaign: core-module
milestone: M2.3
tags: [help, knowledge, ingest, embeddings, workspace-doc-chunk, governance]
---

# Workspace Doc Chunk Auto-Update on Governance Edit

> M2.3 of campaign/core-module. When admin edits `handbook_chapter`, `policy`, or `protocol` content, `workspace_doc_chunk` is auto-updated so `searchKnowledge` (RAG retrieval) returns the new content within ~30s, not "whenever someone manually re-ingests."

## Problem

`workspace_doc_chunk` (K1b knowledge base) feeds Botsson chat hero on `/dashboard/help` (M1) via `searchKnowledge` (`packages/ai/src/capabilities/communication/tools.ts:285`). Existing edge function `supabase/functions/ingest-workspace-knowledge/` reads `handbook_chapter`/`policy`/`protocol` rows, chunks + embeds + upserts into `workspace_doc_chunk`. Today this only runs on demand (Setup wizard, manual trigger).

When admin edits a handbook chapter, the chunk store goes stale. Botsson keeps answering with old text. There is no automated "content was updated → re-ingest" path. Q4 was deferred from M1 spec to v1.5 (this milestone).

## Goal

Wire governance Server Actions that update `handbook_chapter`/`policy`/`protocol` content to trigger re-ingestion of just the affected source via `ingest-workspace-knowledge` edge function. Lag target: ≤30s between save and Botsson reflecting the new content.

## Scope

### In scope

- **Identify governance Server Actions** updating these 3 tables. (Likely `apps/web/src/app/dashboard/governance/_actions/` and similar — discover during T1.)
- **Wire post-save dispatch**: after successful UPDATE, emit `engine_event` with `action_type='ingest_knowledge'` (existing dispatcher path) OR call ingest edge function directly. Pick one based on existing patterns.
- **Source-targeted ingest**: pass `source_type` + `source_id` to ingest function so it re-chunks only the changed row, not the whole workspace (efficiency + lag minimization).
- **Idempotency**: ingest function already content-hashes chunks (per `ChunkResult.content_hash`). Re-running should be safe.
- **Debounce**: if 5 saves happen in 10s on the same row, only the last triggers ingest (or all queue up — acceptable as long as final state is correct). Existing engine-dispatch may already serialize per row; verify.
- **Telemetry**: emit `governance.content_updated` (one event covering all 3 source types via discriminator field) → routing posthog + activity_trail + engine_event. The engine_event route IS the trigger path.
- **Migration**: if `engine_event` consumer doesn't already match `action_type='ingest_knowledge'` for `handbook_chapter`/`policy`/`protocol`, add the routing.

### Out of scope

- M3.1 platform-content disk-based ingest (`docs/journeys/`, `docs/modules/MODULE_*.md` from disk → embed)
- New chunking strategy / new embedding model — reuse existing `ingest-workspace-knowledge` as-is
- Real-time (sub-1s) freshness — engine_event consumer cycle is acceptable
- Manual re-ingest UI button (admin-facing reset/troubleshoot tool — defer to M3 if needed)
- Mobile-side governance edits (mobile boundary ADR-0133 — handbook/policy/protocol editing is web-only)

## Falsifiable Invariants

| # | Invariant | Test |
|---|-----------|------|
| **I-1** | Save-to-Botsson lag ≤30s for handbook_chapter / policy / protocol updates | E2E with stub embedding |
| **I-2** | Failed ingest (embedding API error) leaves prior `workspace_doc_chunk` rows intact (no partial wipe) | unit + E2E |
| **I-3** | Repeated saves within 10s do not produce duplicate active chunks for the same `(source_type, source_id, chunk_index)` (last write wins via upsert) | DB integration test |
| **I-4** | Ingest is workspace-scoped — admin in workspace A editing their handbook never affects workspace B's chunks | RLS + audit |
| **G-DISP** | Post-save dispatch path uses existing engine_event/engine-dispatch infrastructure, NOT a new bespoke worker | code review + ADR if deviates |
| **G-WS** | Every emit includes `workspace_id` (NonEmptyString) + `actor_id` (NonEmptyString) per ADR-0193/0134 | code review |

## Open Questions

- Q1: One unified `governance.content_updated` event with `source_type` discriminator, OR three events (`handbook.content_updated`, `policy.content_updated`, `protocol.content_updated`)? Default: ONE event with discriminator (cheaper to maintain registry, easier to consume).
- Q2: Does engine-dispatch's `ingest_knowledge` action handler already accept `source_type` + `source_id` filter? Read its code to confirm. If not, extend it (small change).
- Q3: Should the user-facing save action wait for ingest completion (block save UI ~5-30s) OR fire-and-forget (return ok immediately, let ingest finish in background)? Default: fire-and-forget; ingest lag is acceptable.
- Q4: What about DELETE? If admin deletes a handbook_chapter, should chunks be deleted? Default: yes — extend ingest-workspace-knowledge to handle delete OR add explicit cleanup step. May need separate small task.

## References

- ADR-0219 — `/dashboard/help` multi-tier hub (M1)
- ADR-0152 — activity_trail + engine_event parity
- ADR-0091/0099 — gate_action mandatory for mutations
- M1 HANDOFF — `docs/handoffs/HANDOFF-dashboard-help-v1.md` (lists Q4 as out of scope, deferred to v1.5)
- M2.2 HANDOFF — `docs/handoffs/HANDOFF-m2-tour-harness.md`
- Existing edge function: `supabase/functions/ingest-workspace-knowledge/index.ts`
- Existing query path: `packages/ai/src/capabilities/communication/tools.ts:285` (searchKnowledge)
- Existing dispatcher: `supabase/functions/engine-dispatch/index.ts` (action_type='ingest_knowledge')
