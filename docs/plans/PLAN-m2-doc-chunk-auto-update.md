---
title: "Plan — m2-doc-chunk-auto-update (Option C — full proper fix)"
feature: m2-doc-chunk-auto-update
spec: docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md
discovery: docs/handoffs/HANDOFF-m2-doc-chunk-auto-update-discovery.md
status: in_progress
updated: 2026-04-28
created: 2026-04-28
module: Core
campaign: core-module
milestone: M2.3
scope: option-c-full
tags: [plan, knowledge, ingest, governance, gate-action, server-actions, refactor]
---

# Plan — m2-doc-chunk-auto-update (Option C)

> Branch: `feat/core-module-m2-doc-chunk-auto-update` | Worktree: `/home/sxtnl/dev/smartout.ai-core-module-wt-1` | Base: `campaign/core-module` | Module: Core
>
> **Option C** chosen 2026-04-28: full proper fix. Refactor client mutations → Server Actions w/ gateAction + source-targeted ingest + transaction safety + FK + orphan cleanup. ~7-10 day estimate.

**Spec:** [Workspace Doc Chunk Auto-Update on Governance Edit (M2.3)](../superpowers/specs/2026-04-28-doc-chunk-auto-update.md)

**Discovery:** [HANDOFF-m2-doc-chunk-auto-update-discovery.md](../handoffs/HANDOFF-m2-doc-chunk-auto-update-discovery.md)

## Journeys (the contract)

- [JOURNEY-m2-doc-chunk-auto-update-handbook-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-handbook-edit.md)
- [JOURNEY-m2-doc-chunk-auto-update-policy-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-policy-edit.md)
- [JOURNEY-m2-doc-chunk-auto-update-protocol-edit](../journeys/JOURNEY-m2-doc-chunk-auto-update-protocol-edit.md)
- [JOURNEY-m2-doc-chunk-auto-update-ingest-failure](../journeys/JOURNEY-m2-doc-chunk-auto-update-ingest-failure.md)

## Goal

Refactor governance mutations to canonical pattern (Server Action + gateAction + emit) AND wire source-targeted re-ingest into workspace_doc_chunk via existing engine_event/engine-dispatch infrastructure. ≤30s lag from save to Botsson reflecting new content. Transactional ingest (no partial-delete window). FK + orphan cleanup on source delete.

## Phase 1 — Server Action refactor (T1-T6, ~3 days)

- [ ] **T1** — Create `apps/web/src/app/dashboard/governance/_actions/update-policy-action.ts` Server Action. Inputs: policy_id, content (Zod-validated). Reads workspace_id + profile_id from auth. Calls `gateAction("policy", "update")`. Performs UPDATE. emits `governance.content_updated`. Returns `{ ok, policy_id }`.
- [ ] **T2** — Create `apps/web/src/app/dashboard/governance/_actions/update-protocol-action.ts` (same shape).
- [ ] **T3** — Create `apps/web/src/app/dashboard/governance/_actions/update-handbook-chapter-action.ts` (same shape).
- [ ] **T4** — Refactor `_hooks/use-governance-mutations.ts:136` (`useUpdatePolicy`) → call Server Action via useTransition (or remove hook in favor of direct Server Action call from form). Keep optimistic UI parity.
- [ ] **T5** — Refactor `_hooks/use-governance-mutations.ts:227` (`useUpdateProtocol`) → same.
- [ ] **T6** — Refactor BOTH handbook UPDATE sites:
  - `apps/web/src/components/dashboard/wizard-steps/HandbookSetupStep.tsx:495` (saveMutation)
  - `apps/web/src/app/dashboard/_components/document-mode/use-handbook-content.ts:67` (useHandbookSave upsert)
  - Both → use update-handbook-chapter-action.ts. CREATE path stays separate (out of scope for M2.3 — only UPDATE wiring needed).

## Phase 2 — Telemetry + dispatch wiring (T7-T9, ~1 day)

- [ ] **T7** — Add telemetry event `governance.content_updated` to `packages/telemetry/src/registry.ts`. Routing: `["posthog", "activity_trail", "engine_event"]`. Payload: `{ workspaceId: NonEmptyString; actorId: NonEmptyString; source_type: 'handbook_chapter' | 'policy' | 'protocol'; source_id: NonEmptyString; trigger: 'create' | 'update' | 'delete' }`.
- [ ] **T8** — Migration: add `engine_trigger` row mapping event_name='governance.content_updated' → action='ingest_workspace_knowledge' (or new action key — see T9). Workspace-scoped (NULL workspace_id = global trigger).
- [ ] **T9** — Decide: extend existing `ingest_workspace_knowledge` action to accept optional source_type+source_id, OR add new action key `ingest_governance_source`. Pick whichever has cleaner blast radius. Update engine-dispatch:1738-1764 accordingly. Action payload pulled from engine_event row. Pass `source_type` + `source_id` to ingest function via request body.

## Phase 3 — Ingest function hardening (T10-T13, ~2 days)

- [ ] **T10** — Extend `supabase/functions/ingest-workspace-knowledge/index.ts`:
  - Accept optional `source_type` + `source_id` request body params
  - When provided: fetch only that source row, chunk + embed, upsert. Don't scan entire workspace.
  - Existing full-workspace path stays for Setup wizard / manual reset.
- [ ] **T11** — Add transaction safety: wrap delete-old + insert-new in a Postgres transaction via RPC. Or reverse order: insert-new (with temporary chunk_index offset) → delete-old → renumber. Pick simpler approach.
- [ ] **T12** — Add DELETE handler: when emit fires with `trigger: 'delete'`, ingest function removes ALL `workspace_doc_chunk` rows for `(source_type, source_id)`. Wire delete trigger into governance Server Actions if delete paths exist (likely T1-T3 don't cover delete — add explicit `delete-policy-action.ts` etc. ONLY if existing delete paths use client-side hooks; otherwise emit is enough).
- [ ] **T13** — Fix source_type enum mismatch: function code only handles `handbook_chapter | policy | protocol` but migration allows 7 values. Either tighten migration check OR expand function. Pick: tighten migration (M2.3 only deals with 3 types; remove `procedure | routine | runbook | other` from check constraint, OR mark them as ignored-for-now in function). Document in HANDOFF.

## Phase 4 — Schema integrity (T14-T16, ~1 day)

- [ ] **T14** — Migration: add FK on `workspace_doc_chunk.source_id` to handbook_chapter / policy / protocol. Polymorphic — needs partial FK or trigger-based check. Pick: trigger-based check function `check_workspace_doc_chunk_source_exists()` that runs on INSERT/UPDATE.
- [ ] **T15** — Migration: add ON DELETE trigger on handbook_chapter / policy / protocol that cascades to delete workspace_doc_chunk rows for that source_id. Idempotent if T12 also handles delete via emit — pick one path. Default: trigger-based DB cascade (more reliable than emit-then-engine-dispatch chain).
- [ ] **T16** — Idempotency / debounce: verify unique constraint `(workspace_id, source_path, chunk_index)` exists per T2 finding. If `source_id` should be in unique key instead of `source_path`, add migration. Document choice.

## Phase 5 — Tests + audit (T17-T22, ~2 days)

- [ ] **T17** — E2E `apps/e2e/tests/journey-doc-chunk-handbook-edit.spec.ts`: seed handbook_chapter row, edit via Server Action, wait ≤35s, query workspace_doc_chunk via service-role for updated content. Verify chunk count appropriate.
- [ ] **T18** — E2E `apps/e2e/tests/journey-doc-chunk-policy-edit.spec.ts`.
- [ ] **T19** — E2E `apps/e2e/tests/journey-doc-chunk-protocol-edit.spec.ts`.
- [ ] **T20** — E2E `apps/e2e/tests/journey-doc-chunk-ingest-failure.spec.ts`: stub embedding API error, edit content, verify prior chunks remain (transactional safety) + engine_state failed.
- [ ] **T21** — Audit:
  - **G-DISP**: dispatch path uses engine_event/engine-dispatch (no bespoke worker). Verify by reading T7 emit → engine_event → engine-dispatch trigger → action handler.
  - **G-WS**: every emit has nonEmpty workspace_id + actor_id (grep all governance Server Actions).
  - **G-GATE**: every Server Action calls gateAction BEFORE mutation (per ADR-0091/0099).
  - **I-1**: save-to-Botsson lag ≤30s in normal path.
  - **I-2**: failed ingest (embedding API error) leaves prior chunks intact (transactional).
  - **I-3**: repeated saves within 10s do not duplicate active chunks (last-write-wins via upsert/transaction).
  - **I-4**: cross-workspace edit cannot affect another workspace's chunks (RLS).
- [ ] **T22** — `pnpm turbo typecheck` PASS. Update each journey frontmatter `status: verified` + `e2e_test:` path.

## Phase 6 — HANDOFF (T23, ~0.5 day)

- [ ] **T23** — HANDOFF in `docs/handoffs/HANDOFF-m2-doc-chunk-auto-update.md` with all audit verdicts, decisions captured (ADRs proposed for: Server Action canonical pattern reaffirmation, source_id FK trigger pattern, transactional ingest), known debt.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for Phase 2/3/4 architectural choices
- [ ] At least one E2E test exists per journey
- [ ] G-DISP: ingest path uses engine_event, no bespoke worker
- [ ] G-WS: every emit has nonEmpty workspace_id + actor_id
- [ ] G-GATE: every refactored Server Action calls gateAction before mutation
- [ ] I-1..I-4: invariants verified by E2E or audit
