---
title: "M2.3 Discovery — scope explosion before implementation"
status: pause-for-decision
created: 2026-04-28
updated: 2026-04-28
module: Core
campaign: core-module
milestone: M2.3
tags: [discovery, blocker, scope-decision, knowledge, ingest, governance]
---

# M2.3 Discovery Report — Pause for Scope Decision

> Discovery (T1+T2+T3) revealed M2.3 spec assumptions are mostly wrong. Five separate problems, three of which are pre-existing tech debt unrelated to the original goal. Writing this so user can decide scope before code lands.

## What spec assumed vs reality

| Spec assumption | Reality |
|---|---|
| Governance updates are Server Actions | All 4 sites are client-side React hooks/mutations (`use client`) |
| Server Actions use gateAction | Zero gateAction calls on handbook/policy/protocol mutations |
| ingest action accepts source_type + source_id | Action `ingest_workspace_knowledge` is workspace-wide only, no filter |
| Ingest is idempotent / transactional | NOT transactional — delete-then-insert with partial-failure window |
| Existing dispatch route auto-handles event | Routing requires explicit `engine_trigger` row matching `governance.content_updated` event_name |

## Concrete findings

### F1 — UPDATE sites (T1)

| File | Line | Table | gateAction? | emit? |
|---|---|---|---|---|
| apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts | 136 | policy | NO | YES (line 147) |
| apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts | 227 | protocol | NO | YES (line 238) |
| apps/web/src/components/dashboard/wizard-steps/HandbookSetupStep.tsx | 495 | handbook_chapter | NO | YES (line 518) |
| apps/web/src/app/dashboard/_components/document-mode/use-handbook-content.ts | 67 | handbook_chapter (upsert) | NO | YES (line 80) |

**All 4 are client-side hooks.** CLAUDE.md "every mutation must use gateAction" rule violated pre-existing. M2.3 cannot just "add an emit" — the foundation is wrong.

### F2 — Ingest function (T2)

- Workspace-wide only. No `source_type` / `source_id` filter.
- Delete-then-insert per source, NO transaction. Partial-delete window if embedding API errors mid-run.
- Source type enum mismatch: migration allows 7 types (`handbook_chapter | policy | protocol | procedure | routine | runbook | other`), function code only handles first 3.
- `match_workspace_docs` RPC has no source_type filter.
- `workspace_doc_chunk.source_id` has no FK constraint to handbook_chapter/policy/protocol — orphan chunks possible on source delete.

### F3 — engine-dispatch (T3)

- Action key is `ingest_workspace_knowledge` (NOT `ingest_knowledge` as spec assumed).
- Fire-and-forget call to ingest function with `{ workspace_id, force }` only.
- Routing via `engine_trigger` table — explicit trigger row needed for `governance.content_updated` event_name → `ingest_workspace_knowledge` action.
- engine_event consumer at engine-dispatch:204 polls/processes events.
- No retry policy visible at dispatch level.

## Recommended path forward (3 options)

### Option A — Minimum viable (1-2 days)

Smallest scope that delivers the user-visible benefit (Botsson reflects governance edits within ~30s).

1. Add `engine_trigger` row: event_name='governance.content_updated' → action='ingest_workspace_knowledge'
2. Add telemetry event `governance.content_updated` (T4)
3. Wire 4 existing client-side mutation sites to emit it (T5)
4. Accept workspace-wide ingest cost (~30-60s per save instead of source-targeted)
5. E2E + audit + HANDOFF

**Pros:** ships fast, uses existing infrastructure as-is. **Cons:** ignores tech debt, slower per-save, doesn't fix gateAction gap, doesn't fix transaction gap.

### Option B — Medium scope (3-4 days)

Option A + extend ingest function for source-targeted re-ingest (T7) + transaction wrap (T2 fix).

**Pros:** ≤5s per-source ingest, transactional safety. **Cons:** still leaves gateAction debt + client-side mutation pattern.

### Option C — Full proper fix (7-10 days)

Option B + refactor 4 client-side mutations to Server Actions with gateAction (per CLAUDE.md mandate) + add source_id FK constraint + cleanup orphan chunks on source delete.

**Pros:** correct foundation. **Cons:** drags in governance refactor that isn't M2.3's stated scope. Should probably be its own campaign milestone.

## Decision needed

User picks A, B, or C. Default recommendation: **Option A** ships M2.3's user-visible promise; Options B and C become their own follow-up sub-sorties (M3.1.x or new campaign).

## Files / commits so far on this sub-sortie

- Spec: `docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md` (campaign commit `6f0fcb00`)
- Plan + journeys: `docs/plans/PLAN-m2-doc-chunk-auto-update.md` + 4 JOURNEY-* files (sub-sortie commit on push)
- This discovery report (pause-for-decision)

## Recommended sub-sortie disposition

If user picks A: continue work in this sub-sortie (rename plan tasks accordingly). If B or C: close this sub-sortie as discovery-only, open new sub-sortie with revised plan.
