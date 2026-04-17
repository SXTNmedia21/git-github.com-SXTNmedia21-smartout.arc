---
title: "Plan — strom-mcp-migration-check"
status: in_progress
updated: 2026-04-17
created: 2026-04-15
module: strike-mcp
tags: [plan, migration, bubble, tier1, tier2]
---

# Plan — strom-mcp-migration-check

> Branch: `feat/strom-mcp-migration-check` | Worktree: wt-2 | Module: strike-mcp |
> Started: 2026-04-15

## Goal

Smartout.ai-side worktree for the strike-mcp Bubble→v3 migration:
land ADRs, learnings, council reviews, and amendments that the strike-mcp
tool work depends on. The migration tool itself lives in `~/dev/strike-mcp/`
(separate repo); this branch holds the smartout.ai documentation +
governance integration boundary.

## Scope

This branch is the **integration boundary** between two independent codebases:

- **`~/dev/strike-mcp/`** (separate repo) — the migration tool (engine,
  transforms, mappings, ADRs 0001-0006, patch scripts, manual SQL templates,
  emit orchestrator).
- **`~/dev/smartout.ai-wt-2/`** (this branch) — smartout.ai-side ADRs that
  shape the v3 schema strike-mcp targets, council records of cross-system
  decisions, and learnings that emerge from the migration work.

## Tasks

### Tier 1 — identity + structure + operational data — DONE 2026-04-17

- [x] Strike-mcp ADRs 0003-0006 written (in strike-mcp repo)
- [x] Smartout.ai ADR-0099 lock implementation to Postgres RPC (commit `524cf8d0`)
- [x] Council post-implementation review on Tier 1 attestation (commit `6c5801d3`)
- [x] Learning 0033 captured — "Migration attestation completeness ≠ apply-readiness"
- [x] COUNCIL-LOG entry for Tier 1 strike-mcp post-implementation review
- [x] All 10/10 Tier 1 entities verified end-to-end via live Bubble fetch (in strike-mcp)
- [x] Cutover communication artifacts drafted (in strike-mcp `docs/migration/`)
- [x] ADR-0006 amended with apply-script SAVEPOINT + force-password-reset +
      cutover artifacts requirement (in strike-mcp)

### Tier 2 — content extraction (approach pivoted 2026-04-17) — IN PROGRESS

**Reframe (Pontus, 2026-04-17):** "Vi behøver ikke hente information table by
table — vi henter kunnskapen fra workspacen og implementerer den i version 3."
Tier 2 is no longer a structural schema-mapping problem; it's a content
extraction + v3-native re-creation problem.

- [x] Discovery doc captured 2026-04-17 — `~/dev/strike-mcp/docs/source/DISCOVERED-bubble-content-model.md`
- [x] Live meta verification of 6 Tier 2 entities (strike-mcp commit bc5d70b)
- [x] Run discovery for 5 live entities (`🎖️ badge` confirmed non-existent)
- [x] Council ran 2026-04-17, produced APPROVE WITH CHANGES verdict, then
      Pontus superseded with knowledge-extraction reframe. See Learning 0034.
- [x] **Tier 2 v1 extraction pipeline (strike-mcp commits e52358b + 026ea7f):**
      `scripts/tier2_extract.ts` — handbook → protocol + challenge →
      confirmation + live activity → procedure. Produces DRY-RUN SQL at
      `~/dev/strike-mcp/supabase/migration-staging-tier2/`.
- [x] **Spec:** `~/dev/strike-mcp/docs/superpowers/specs/2026-04-17-tier2-content-extraction.md`

Open items (post-pivot):

- [ ] Tier 2 v2: activity tree → procedure_step nesting (preserve children + 🚀 Parant)
- [ ] Tier 2 v2: route live activities by `_activityType` to specialized v3
      entities (control_list, routine, knowledge_test) vs flat procedure
- [ ] Tier 1 `handbooks → runbook` attestation hole (surfaced by Supervisor
      in 2026-04-17 council — runbook has NOT NULL trigger_event etc. that
      handbooks don't have). Requires Tier 1 re-attestation → protocol.
- [ ] Live `knowledge_test.workspace_id` writer bug in
      `apps/web/src/.../use-governance-mutations.ts:332` (surfaced by Agent
      Coordinator code-trace)
- [ ] Decide Tier 2 quiz scope (deferred — depends on whether Wrightegaarden
      will author its own questions or reference global ones)

### Tier 3 — salary/time rules — DEFERRED

- [ ] Rebuild from K1a industry baseline (out of strike-mcp scope per
      strike-mcp ADR-0002)

### Production apply blockers (out of attestation scope)

- [x] Build `strike-auth-bridge` — DONE 2026-04-17 (strike-mcp commit `c3677e8`).
      Scripts at `~/dev/strike-mcp/scripts/auth-bridge/`. Verified against
      local Supabase: 3 Wrightegaarden auth.users created with deterministic
      uuidv5, `07_user_identity.sql` then applies cleanly.
- [x] v3 login-flow gate enforces force-password-reset for migrated users —
      DONE 2026-04-17 (wt-2 commit `403edb6b`). Middleware §4b redirects
      `force_password_reset=true` users to `/reset-password`; flag cleared
      atomically on successful password update.
- [ ] wt-3 schema migrations applied to target Postgres (wt-3 owns this)
- [ ] Bubble CSV exports for swaprecords (14) + records aggregation (5,434)
- [ ] Distribute recovery links from audit CSV to migrated users (admin
      operational task, out of tooling scope)
- [ ] Source-tagging decision for v3 governance tables — ADR pending
      (sidecar JSONL vs `source text` column per Cascade Invariant 8)

## Acceptance Criteria

- [x] Decision log updated — ADR-0099 + Learning 0033 + COUNCIL-LOG entry
- [x] User journeys — N/A (this is migration-tooling, no UI changes)
- [x] Typecheck passes — verified 2026-04-17 (no smartout.ai code changes
      this session; all work was docs + ADRs + learnings)
- [x] Handoff written — see strike-mcp `docs/migration/` for cutover docs
- [ ] Tier 2 design landed (in progress — discovery captured, mapping pending)

## Notes

- This branch is **LONG-LIVED** and not intended to merge until Tier 1+2+3
  are all complete. It serves as the smartout.ai-side coordination point
  for multi-tier migration work.
- The actual migration tool (strike-mcp) is in a separate repo with its
  own commits / ADRs / tests / 393+ passing tests.
- Cross-references to wt-3 (`~/dev/smartout.ai-wt-3/`) — that worktree
  owns the v3 schema migrations (M1-M9 + payroll_ledger_archive +
  ADRs 0107-0111). Strike-mcp's `v3_schema.json` is generated from wt-3
  state, not this wt-2 worktree.
- Strike-mcp git log (most recent at top): `843b088` (Tier 2 discovery doc)
  → `7f3417a` (Tier 2 instruction template) → `403cd26` (source folder) →
  `a57a506` (10/10 emit verified) → `2f85289` (Bubble live API fix) →
  `d462dbe` (forceReview fix) → ... ~30 commits this arc.
