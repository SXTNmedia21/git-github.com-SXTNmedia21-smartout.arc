---
title: "Handoff — strom-mcp-migration-check"
status: in_progress
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [handoff, migration, bubble, tier1, tier2]
---

# Handoff — strom-mcp-migration-check (wt-2)

## Summary

This worktree (`feat/strom-mcp-migration-check`, wt-2) is the smartout.ai-side
coordination point for the strike-mcp Bubble→v3 migration. The actual
migration tool lives in a separate repo (`~/dev/strike-mcp/`); this branch
holds smartout.ai documentation that the migration depends on or that
emerges from migration work (ADRs, learnings, council logs).

## What was built — Tier 1 arc (2026-04-15 → 2026-04-17)

### Smartout.ai changes (this branch — 3 commits)
- `f73e2ce0` — 6 ADRs + lifecycle map from shift-lifecycle council
- `524cf8d0` — ADR-0099 lock implementation to Postgres RPC (option B)
- `6c5801d3` — Tier 1 strike-mcp council verdict + Learning 0033

### Strike-mcp changes (separate repo, ~30 commits this arc)
See `~/dev/strike-mcp/` for full history. Highlights:
- 4 strike-mcp ADRs (0003-0006: conflict strategy, derived/constant columns,
  raw_json_target, auth-bridge orchestration)
- Engine framework: derived_columns + constant_columns + raw_json_target
- 5 new transforms: iso_to_date, iso_to_time, seconds_to_hours,
  email_from_auth, profile_code_from_id
- 11 attested mappings + 2 intentional drops + 2 manual SQL synthesis files
- emit_migration_sql.ts orchestrator (live Bubble fetch → SQL → staging)
- 10/10 Tier 1 entities verified end-to-end via live Bubble API
- 393+ passing tests
- ADR-0006 amendment with apply-script SAVEPOINT + force-password-reset
- Cutover communication artifacts (NO + EN drafts)
- Tier 2 source documentation folder + discovery doc (Genesis bubble-mcp
  source mining)

## Decisions captured

- **ADR-0099** (this branch) — Lock implementation to Postgres RPC (option B)
- **Learning 0033** (this branch) — Migration "attestation complete" ≠
  "apply ready"; operational wrappers are first-class deliverables
- **COUNCIL-LOG entry 2026-04-16** — Tier 1 strike-mcp post-implementation
  review; APPROVE WITH CHANGES; 4 must-fix items addressed same session
- **Strike-mcp ADRs 0003-0006** (separate repo) — see strike-mcp
  `docs/superpowers/decisions/`

## Learnings discovered

- **L-0033** — Migration attestation completeness ≠ apply-readiness
  (`docs/learnings/0033-migration-attestation-not-apply-ready.md`)
- Post-merge in council_meta.md (cross-session memory):
  - Cross-worktree fact-check confusion (wt-2 vs wt-3)
  - "Attestation complete ≠ apply ready" boundary insight
  - Code-tracer mandate paying off (Steward concern resolved by Supervisor's
    line:N citations on manual SQL source-tagging)

## Known issues / debt

- **Tier 2 incomplete** — 5 of 7 Bubble content entities never discovered in
  Tier 1 (`activity`, `handbook.challenge`, `question`, `🎖️handbook.log`,
  `🎖️ badge`). The `🎎training` and `handbooks` mappings we did attest are
  per-employee summary + container respectively, not the actual content.
  Re-verification needed.
- **Tier 1 production apply blocked** on:
  1. `strike-auth-bridge` package buildout (1-2 days, separate workstream)
  2. v3 login-flow gate for `migrated_from_bubble` users
  3. Bubble CSV exports for swaprecords + records staging table
  4. wt-3 schema migrations applied to target Postgres
- **Multi-tenant company_id** — profiles patch hardcodes Wrightegaarden's
  company UUID. Multi-tenant requires cross-entity lookup framework
  (future strike-mcp ADR).

## Next steps (in priority order)

1. **Tier 2 discovery** — run strike-mcp `run_discovery.ts` for the 5
   missing Bubble content entities. Inputs needed in
   `~/dev/strike-mcp/docs/source/`:
   - Pontus's content model overview (Norwegian or English) — already
     captured indirectly via Genesis bubble-mcp scan
   - Live API discovery output for each entity
2. **Council on Tier 2 mapping** — 4 open design questions in
   `~/dev/strike-mcp/docs/source/DISCOVERED-bubble-content-model.md`
3. **Build strike-auth-bridge** — separate workstream, 1-2 days
4. **Production cutover** — only after auth-bridge + Tier 2 land

## Boot sources for next session

1. `docs/DASHBOARD.md` — live git state
2. `docs/plans/PLAN-strom-mcp-migration-check.md` — full task list
3. `~/dev/strike-mcp/docs/source/DISCOVERED-bubble-content-model.md` —
   Tier 2 content model discovery
4. `~/dev/second-brain-v2/ops/activity-log.md` — narrative continuity
5. claude-mem MCP — cross-session memory

## Cross-references

- Strike-mcp repo: `~/dev/strike-mcp/` (branch `main`, ~30 commits this arc)
- wt-3 worktree: `~/dev/smartout.ai-wt-3/` (owns v3 schema migrations
  M1-M9 + ADRs 0107-0111 referenced by strike-mcp)
- Genesis bubble-mcp: `/mnt/c/Users/sxtnl/Dev/Genesis/mcp-servers/bubble-mcp/`
  (Bubble content model source-of-truth)
- Smartout core: `/mnt/c/Users/sxtnl/Dev/Smartout/Smartout core structures.jsonc`
  (v3 10-datatype canonical schema)
- COUNCIL-LOG entry: `docs/council/COUNCIL-LOG.md` 2026-04-16
- Learning 0033: `docs/learnings/0033-migration-attestation-not-apply-ready.md`

## E2E tests

N/A — this branch holds documentation and ADRs only. Migration tool tests
live in strike-mcp repo (393+ passing as of 2026-04-17).
