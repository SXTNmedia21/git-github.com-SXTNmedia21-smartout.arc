---
title: "HANDOFF — M2.3 workspace_doc_chunk Auto-Update on Governance Edit"
feature: m2-doc-chunk-auto-update
status: complete
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [handoff, knowledge, ingest, governance, cascade-K1b]
---

# HANDOFF — M2.3 Doc Chunk Auto-Update (Option C complete)

## Summary

When admins edit governance content (handbook chapters, policies, protocols), `workspace_doc_chunk` (Botsson's K1b RAG store) auto-re-embeds within seconds — no manual reset trip through Setup wizard. The path is: Server Action → `gateAction` → DB update → `emit('governance.content_updated')` → `engine_event` → `engine-dispatch` → `governance_content_ingest` process → `ingest_workspace_knowledge` action → `ingest-workspace-knowledge` Edge Function (source-targeted) → embeddings refreshed → `searchKnowledge` returns new content.

**Option C scope shipped**:
- T1–T6: 4 client TanStack mutations refactored to 3 Server Actions (`update-policy-action`, `update-protocol-action`, `update-handbook-chapter-action` covering both create + update). Full pre-mutation `gateAction` enforcement.
- T7: Single registry event `governance.content_updated` (PostHog + activity_trail + engine_event), 4 emit sites with `nonEmpty()` discipline.
- T8–T9: New `engine_process` `governance_content_ingest` + `engine_trigger` linking event → process. Dispatcher payload-projection promotes `source_type/source_id/trigger` from event payload into `state.context`, ingest action handler reads them and forwards to edge function.
- T10–T12: Edge function gained source-targeted fetch path (single-row vs full workspace scan), delete-trigger short-circuits to delete-only.
- T11 (transactional safety): insert-then-delete-renumber pattern using `chunk_index + 10000` temp offset — no partial-failure window where chunks vanish mid-ingest.
- T14–T16: polymorphic FK trigger, ON DELETE cascade triggers on all 3 source tables, unique partial index `workspace_doc_chunk_source_chunk_idx` for upsert-by-source identity.
- T17–T20: 4 Playwright E2E specs covering happy paths + failure resilience, 4 journey docs flipped `verified`.

## Audit Verdicts

### G-DISP — engine_event/engine-dispatch path (no bespoke worker)

PASS. Every link traceable in code:

- `packages/telemetry/src/registry.ts:8614-8617` — `governance.content_updated` declares `destinations: ["posthog", "activity_trail", "engine_event"]`.
- `apps/web/src/app/dashboard/governance/_actions/update-policy-action.ts:61-70` (and protocol/handbook equivalents) — emit lands in `engine_event` via the registry routing layer.
- `supabase/migrations/20260519120000_governance_content_ingest_process.sql:29-34` — `engine_trigger` row maps `event_type='governance.content_updated'` → `process_id='governance_content_ingest'`.
- `supabase/functions/engine-dispatch/index.ts:336-340` — payload projection: dispatcher copies event payload into `state.context` (excluding protocol fields).
- `supabase/functions/engine-dispatch/index.ts:1738-1779` — `ingest_workspace_knowledge` action handler reads `source_type/source_id/trigger` from `state.context` and forwards to `ingest-workspace-knowledge` edge function via fetch.
- `supabase/functions/ingest-workspace-knowledge/index.ts:170-184` — body parses `source_type/source_id/trigger`.

No bespoke poller, cron, or sidecar worker. Pure event-driven through the canonical Event Engine.

### G-WS — every emit has nonEmpty(workspace_id, actor_id)

PASS. 4 emit sites, all `nonEmpty()`-guarded (helper throws on empty/null IDs — fail fast, no corrupt telemetry per ADR-0134 pattern):

- `update-policy-action.ts:63-67` — workspace_id, actor_id, source_id all guarded.
- `update-protocol-action.ts:64-68` — same.
- `update-handbook-chapter-action.ts:74-78` — update branch.
- `update-handbook-chapter-action.ts:108-112` — create branch (uses freshly-inserted `inserted.handbook_chapter_id`).

### G-GATE — gateAction BEFORE mutation

PASS. All 3 actions call order verified: `parse → resolveCurrentProfile → gateAction → UPDATE/INSERT → emit → revalidatePath`.

- `update-policy-action.ts:35-48` — gate at line 35, UPDATE at line 52.
- `update-protocol-action.ts:36-49` — gate at 36, UPDATE at 53.
- `update-handbook-chapter-action.ts:38-51` — single gate covers both branches; UPDATE at 57 / INSERT at 87.

Gate denies short-circuit return BEFORE any DB write. `default_allow=false` enforced via `gateAction` shared helper.

### Invariants

- **I-1 (≤30s lag)** — PASS structurally. `emit()` writes `engine_event` synchronously inside the Server Action; engine-dispatch picks up via `engine_trigger` and fires `ingest_workspace_knowledge` immediately (fire-and-forget fetch to edge function). E2E poll window set to 35s for cold-start margin. **Caveat**: end-to-end SLA depends on engine-dispatch worker being live in target env — see Known Debt.
- **I-2 (transactional safety)** — PASS. `ingest-workspace-knowledge/index.ts:469-533` implements insert-temp-offset (10000+) → delete-old → renumber. If embeddings or insert fails, no deletes happen. If steps 2/3 fail after step 1, prior chunks remain alongside new high-index ones (degraded but searchable).
- **I-3 (idempotency)** — PASS. `supabase/migrations/20260519130000_workspace_doc_chunk_integrity.sql:124-137` creates unique partial idx `workspace_doc_chunk_source_chunk_idx` on `(workspace_id, source_type, source_id, chunk_index) WHERE source_id IS NOT NULL`. Repeated ingest of same content produces same chunks (content-hash gate at line 405 of edge function short-circuits unchanged sources).
- **I-4 (workspace scoping)** — PASS. `resolveCurrentProfile()` derives `workspace_id` from authenticated session, never from request body. RLS enforced on `.from('policy/protocol/handbook_chapter')` writes. T14 trigger (`check_workspace_doc_chunk_source_exists`) re-verifies the source row lives in the same workspace as the chunk being inserted.

### Phantom Contracts (ADR-0197)

PASS. All producer→consumer relations exercised in tests + traceable in code:

- **`governance.content_updated` event** → consumer `engine_trigger` (migration 20260519120000:29-34) → process `governance_content_ingest` → action `ingest_workspace_knowledge` (engine-dispatch:1738).
- **`ingest_workspace_knowledge` action body** (`source_type/source_id/trigger/workspace_id/force`) → consumer `ingest-workspace-knowledge/index.ts:170-184`. Both sides aligned.
- **`workspace_doc_chunk` rows** → consumer `searchKnowledge` tool at `packages/ai/src/capabilities/communication/tools.ts:316` via `match_workspace_docs` RPC (existing K1b read path, unchanged this sub-sortie).

## Decisions Made

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | One event vs three (`policy_updated`/`protocol_updated`/`handbook_updated`)? | One event `governance.content_updated` with `source_type` discriminator | Single trigger row, single process, easier evolution. Discriminator already needed downstream. |
| Q4 | Delete handling — DB cascade or emit-based? | **Both** (belt-and-suspenders) | DB triggers (T15) guarantee integrity even if emit fails. `trigger='delete'` emit drives Botsson signal + PostHog. |
| T13 | source_type enum mismatch (DB allows 7 values, edge function handles 3) | Kept enum superset, edge function only handles `handbook_chapter/policy/protocol`. T14 trigger only enforces FK for those 3 — `procedure/routine/runbook/other` bypass the check. | Reconciliation deferred until those tables enter governance ingest scope. Logged as known debt. |
| T11 | True transaction or best-effort? | Best-effort insert-temp-offset → delete → renumber | Edge Functions have no DB transaction primitive. RPC wrapper is future work; current pattern preserves prior chunks on every failure mode tested. |

## Files Changed

**Commits on `feat/core-module-m2-doc-chunk-auto-update`**:

| SHA | Message |
|-----|---------|
| 1f72271e | docs(doc-chunk-auto-update): discovery report — pause for scope decision |
| f2c739ea | docs(doc-chunk-auto-update): plan revised — Option C full proper fix |
| 5345ecdf | feat(doc-chunk-auto-update): T1+T2+T3 — Server Actions for policy/protocol/handbook with gateAction |
| fab7f3b4 | feat(doc-chunk-auto-update): T4-T6 — refactor 4 client mutations to Server Actions |
| 3b47c4fb | feat(doc-chunk-auto-update): T7 — register governance.content_updated event + wire emits |
| 7c92cc1a | feat(doc-chunk-auto-update): T8+T9 — engine_process + dispatcher source-targeted payload |
| 8dc0c83f | feat(doc-chunk-auto-update): T10+T11+T12 — source-targeted ingest + transactional + delete |
| 7a761eb0 | feat(doc-chunk-auto-update): T14+T15+T16 — schema integrity (FK trigger + cascade + unique idx) |
| fa924d64 | test(doc-chunk-auto-update): T17 — E2E handbook edit re-ingest (Journey 1) |
| 119aa700 | test(doc-chunk-auto-update): T18 — E2E policy edit triggers re-ingest (Journey 2) |
| 1f1af687 | test(doc-chunk-auto-update): T19 — E2E protocol edit triggers re-ingest (Journey 3) |

**Key files touched**:

- `apps/web/src/app/dashboard/governance/_actions/update-policy-action.ts` (new)
- `apps/web/src/app/dashboard/governance/_actions/update-protocol-action.ts` (new)
- `apps/web/src/app/dashboard/governance/_actions/update-handbook-chapter-action.ts` (new)
- `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts` (refactored to call Server Actions)
- `packages/telemetry/src/registry.ts:8614-8617` (new event registered)
- `supabase/functions/engine-dispatch/index.ts:300-340, 1738-1790` (payload projection + ingest action handler)
- `supabase/functions/ingest-workspace-knowledge/index.ts` (source-targeted fetch + delete short-circuit + transactional safety)
- `supabase/migrations/20260519120000_governance_content_ingest_process.sql` (new)
- `supabase/migrations/20260519130000_workspace_doc_chunk_integrity.sql` (new)
- `apps/e2e/tests/journey-doc-chunk-{handbook-edit,policy-edit,protocol-edit,ingest-failure}.spec.ts` (new)
- `docs/journeys/JOURNEY-m2-doc-chunk-auto-update-{handbook-edit,policy-edit,protocol-edit,ingest-failure}.md` (new + flipped to verified)

**Typecheck**: `pnpm turbo typecheck` → 36/36 successful, 0 errors.

## Known Debt

1. **`source_type` enum mismatch** — DB accepts `procedure/routine/runbook/other` but edge function + T14 trigger only handle `handbook_chapter/policy/protocol`. Reconcile when those source types enter governance ingest scope (or shrink enum if they never will).
2. **True transaction in ingest** — current insert-temp-offset → delete → renumber is best-effort. A wrapping RPC `replace_workspace_doc_chunks(workspace_id, source_type, source_id, chunks[])` would give true ACID. Not blocking; failure modes leave system in degraded-but-searchable state.
3. **E2E coverage depends on engine-dispatch running** — Playwright assertions for end-to-end re-embed require the engine-dispatch worker to be live in test env. Without it, mutation + emit succeed but chunks never refresh. Tests poll with 35s window; if worker is down, journey-handbook/policy/protocol assertions will fail with timeout (correct fail signal).
4. **Ingest-failure E2E (T20) skips when `OPENROUTER_API_KEY` absent** — designed to verify failure resilience by triggering an embedding error; without the key, the spec marks itself skipped rather than producing a misleading PASS.
5. **`source_id` is `text` not `uuid`** — T14 trigger casts via `::uuid`. Performance is acceptable at current scale (single-row trigger). Consider native `uuid` column type in a future migration if cardinality grows or query plans show casting overhead.
6. **`actor_id: 'system'` in activity_trail audit log** — at `ingest-workspace-knowledge/index.ts:541`. Acceptable since the action runs under service role on behalf of the dispatcher, not a specific profile. Flagged for awareness only.

## Next Steps

1. **Close sub-sortie** via `/close-feature` — merges `feat/core-module-m2-doc-chunk-auto-update` → `campaign/core-module`, syncs development into campaign.
2. **Run E2Es against live preview env** to confirm I-1 ≤30s lag with real engine-dispatch worker.
3. **Future M2.x sub-sorties** — consider:
   - `M2.4` reconcile `source_type` enum (add `procedure/routine/runbook` ingest paths or shrink enum).
   - `M2.5` wrap insert-temp-offset → delete → renumber in PG RPC for true ACID.
   - `M2.6` add `chunk_count` decay + low-watermark observability so admins can see "chunks for this policy: N (last refreshed X ago)".

---

**Sub-sortie**: `~/dev/smartout.ai-core-module-wt-1` (branch `feat/core-module-m2-doc-chunk-auto-update`)
**Spec**: `docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md`
**Plan**: `docs/plans/PLAN-m2-doc-chunk-auto-update.md` (Option C)
**Discovery**: `docs/handoffs/HANDOFF-m2-doc-chunk-auto-update-discovery.md` (preserved alongside this final handoff)
