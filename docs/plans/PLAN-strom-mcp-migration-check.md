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

### Tier 2 — governance content layer — IN PROGRESS

- [x] Discovery doc captured 2026-04-17 — `~/dev/strike-mcp/docs/source/DISCOVERED-bubble-content-model.md`
      (7-entity content stack from Genesis bubble-mcp source)
- [ ] Run discovery for 5 missing Bubble entities (`activity`,
      `handbook.challenge`, `question`, `🎖️handbook.log`, `🎖️ badge`)
- [ ] Council review on Bubble → v3 governance hierarchy mapping
      (4 open questions — see DISCOVERED doc)
- [ ] Patch + attest Tier 2 entities
- [ ] Re-verify training + handbooks attestations (Tier 1 mappings need
      revisit now we know they're per-employee summary + container respectively)

### Tier 3 — salary/time rules — DEFERRED

- [ ] Rebuild from K1a industry baseline (out of strike-mcp scope per
      strike-mcp ADR-0002)

### Production apply blockers (out of attestation scope)

- [ ] Build `strike-auth-bridge` package (1-2 days, separate package)
- [ ] v3 login-flow gate enforces force-password-reset for migrated users
- [ ] wt-3 schema migrations applied to target Postgres (wt-3 owns this)
- [ ] Bubble CSV exports for swaprecords (14) + records aggregation (5,434)

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
