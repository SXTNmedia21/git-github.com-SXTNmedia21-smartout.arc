---
title: "Plan — bulk-import-sortie-a"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
module: bulk-import
tags: [plan, pointer, bulk-import, sortie-a]
---

# Plan — bulk-import-sortie-a

> Branch: `feat/bulk-import-sortie-a` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Base: `development` | Module: bulk-import | Started: 2026-05-23

**Canonical plan:** [`docs/superpowers/plans/2026-05-23-bulk-import-sortie-a.md`](../superpowers/plans/2026-05-23-bulk-import-sortie-a.md)

**Spec:** [`docs/superpowers/specs/2026-05-23-bulk-import-design.md`](../superpowers/specs/2026-05-23-bulk-import-design.md)

**Journey:** [`docs/journeys/JOURNEY-bulk-import-sortie-a.md`](../journeys/JOURNEY-bulk-import-sortie-a.md)

**ADRs to write:** 0400 (capability + import_run + cascade-delegation), 0401 (xlsx library policy, proposed), 0403 (schedule_shift.source v3_bulk_import)

**Execution:** per writing-plans skill — 14 tasks. Choose subagent-driven (`superpowers:subagent-driven-development`) or inline (`superpowers:executing-plans`).

## Acceptance Criteria

- [ ] ADR-0400 / 0401 / 0403 written + registered in `docs/decisions/0000-decision-log.md`
- [ ] Foundation migration `20260624000000_bulk_import_foundation.sql` applies cleanly (pg_trgm + import_run + fn_fuzzy_match_entity + ALTER schedule_shift.source CHECK)
- [ ] Authority seed migration `20260624000100_bulk_import_authority_seed.sql` seeds 4 engine_authority_config rows (L-0083 default-deny pre-emption)
- [ ] `packages/utils/src/spreadsheet/` parseCsv passes vitest
- [ ] `packages/utils/src/hash/` sha256Hex passes vitest
- [ ] `packages/ai/src/resolver/` resolveEntity passes vitest
- [ ] `packages/ai/src/capabilities/bulk_import/tools.ts` parseSpreadsheetTool passes vitest (workspace-prefix enforcement, xlsx rejection, ONE emit per ADR-0287)
- [ ] Telemetry registry entry `bulk_import.batch_parsed` registered SAME COMMIT as emit site (ADR-0377)
- [ ] Typecheck passes: `pnpm turbo typecheck --filter=@smartout/utils --filter=@smartout/ai --filter=@smartout/telemetry --filter=@smartout/supabase`
- [ ] Decision log updated
- [ ] User journey written (`docs/journeys/JOURNEY-bulk-import-sortie-a.md`)
