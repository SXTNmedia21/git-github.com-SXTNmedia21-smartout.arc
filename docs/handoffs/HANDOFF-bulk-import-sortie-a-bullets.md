---
title: bulk_import Sortie A — HANDOFF bullets (close-feature.sh input)
status: draft
updated: 2026-05-23
created: 2026-05-23
module: bulk-import
tags: [handoff, bulk-import, sortie-a, foundation]
---

# bulk_import Sortie A — HANDOFF bullet content

> close-feature.sh consumes this file to generate the full HANDOFF-bulk-import-sortie-a.md.
> Each section maps to the HANDOFF template's named slots.

## Summary

Foundation sortie for the bulk_import capability. Shipped 3 ADRs + 2 migrations + 2 utility packages + resolver wrapper + 1 read-only capability tool + 1 telemetry registry entry + 1 e2e smoke scaffold. Database + capability skeleton + first user-callable tool (parse_spreadsheet, read-only) operational on local Supabase. Sortie B (preview_batch + composer UI) + Sortie C (commit_batch + cascade-delegation helpers) unblocked.

## Decisions registered (this sortie)

- ADR-0401: bulk_import Capability — Dedicated import_run Table + Cascade-Delegated Commit Pipeline (accepted)
- ADR-0402: xlsx Library Adoption (SheetJS) — License, Bundle Size, Zip-Bomb Mitigation (proposed — Sortie B flips to accepted before install)
- ADR-0404: schedule_shift.source — Add 'v3_bulk_import' Value (accepted)

Slot 0403 reserved for Sortie C "Attachment Routing in Stage-Engine — MIME-Type Deterministic Capability Dispatch" (retroactive codification).

## Learnings worth ADR-grade promotion

| Learning | Occurrence | Action |
|---|---|---|
| L-0316 (cross-branch ADR collision) | 6th + 7th — both during this sortie | PROMOTE to mandatory `start-feature.sh` pre-flight check OR husky pre-push hook: "any new ADR file must pass `git log --all --oneline -- 'docs/decisions/{slot}-*'` returning zero results before commit". Codify in writing-plans skill. |
| L-NEW-A (plan-template-vs-real-schema deviation) | New: discovered during Sortie A Task 5 + Task 10 | engine_authority_config has no `tool_name` column (ADR-0192 two-part pattern instead); SmartoutTool uses `defineTool()` helper + `schema` field; emit() signature flat top-level not nested; getProfileContext doesn't exist (ctx.workspaceId is middleware-injected). Plan templates must be verified against actual repo grep BEFORE committing. Promote to `writing-plans` skill: mandatory pre-Task verification of templated schemas. |
| L-NEW-B (UUID-in-GIN composite blocker) | New: caught by code-quality review of foundation migration | Composite `GIN (uuid_col, text gin_trgm_ops)` fails apply because UUID has no GIN opclass and btree_gin extension is not installed. Two-index pattern (separate BTREE + GIN, BITMAP scan combines) is the correct repo idiom. Promote to `smartout-database-guide` trap section. |
| L-NEW-C (TDD subagent double-bump cascade bug) | New: discovered during ADR slot renumber | Sequential replace_all in highest-first order does NOT prevent cascading bumps when the same digit pattern appears in multiple contexts. Solution: context-specific Edit (with surrounding text) rather than bare-number replace_all when the number appears in different ADR slots within the same file. Promote to internal orchestration playbook. |
| L-0083 (engine_authority_config default deny) | Re-confirmed (4 capability bodies seeded ahead of Sortie B+C) | Already documented; this sortie's seed migration is the canonical pattern. |
| L-0176 (body-before-docstring) | Re-confirmed (Task 10 parse_spreadsheet) | Already documented; Tool Compliance Self-Check ran post-body. |
| L-0177 (fail-fast on workspace resolution) | Re-confirmed (3 tools: parse_spreadsheet path-prefix, resolveEntity RPC error, parseCsv empty input) | Already documented; consistent enforcement across this sortie's code. |

## Known issues / debt (deferred — NOT introduced by this sortie unless noted)

**Sortie B follow-ups (small, mechanical):**
- `apps/e2e/bulk-import/sortie-a-parse-spreadsheet.spec.ts` line ~67: flip `test.skip` → `test()` once composer UI + auth helper land
- `packages/ai/src/capabilities/bulk_import/tools.test.ts`: add `expect(emit).not.toHaveBeenCalled()` assertions on path-mismatch + xlsx-rejection early-return tests (close ADR-0287 coverage symmetrically)
- `packages/ai/src/capabilities/bulk_import/tools.ts`: extract `"botsson-imports"` bucket-name to named constant shared between prefix check + objectPath strip (forward maintenance hazard noted by code-quality reviewer)
- `packages/ai/src/capabilities/bulk_import/tools.test.ts`: mock both `@smartout/telemetry` AND `/server` subpath OR inline `NonEmptyString` construction (current state has mock-boundary leak noted by code-quality reviewer)
- `packages/utils/vitest.config.ts`: add `src/**/__tests__/**/*.test.ts` glob to match sibling convention (year-wheel, agent-sdk)
- `packages/utils/src/index.ts`: consider switching `export * from './spreadsheet/index.js'` to named re-exports once Sortie B adds xlsx types (avoid barrel bleed)

**Cross-cutting sweeps (pre-existing debt, separate sorties):**
- ADR-0287 description in repo-wide convention: shorthand "ONE emit per gated mutation" doesn't match actual ADR-0287 title "gate_action mandatory on all mutation capability tools". CLAUDE.md + spec + plan + 3 new ADRs all carry the shorthand. Convention sweep deserves its own sortie.
- `tags` + `module` frontmatter fields missing in ADRs 0401/0402/0404 (branch-wide gap matching sibling ADRs 0398/0399; not introduced here)
- DRY consolidation: 7+ inline `createHash('sha256')` call-sites scattered across `packages/payroll-export`, `packages/ai`, `packages/docs-pipeline`, `services/stage-engine`, `apps/web` should migrate to `@smartout/utils sha256Hex` helper added in Task 8
- Authority seed parity: 4 pre-existing failures (`day-line`, `org`, `routine`, `schedule.view_preference.write`) — L-0066 debt on the branch, unrelated to Sortie A
- 44 pre-existing typecheck errors in `@smartout/ai` (`@smartout/types` + `@smartout/journey-ir` missing); 15 pre-existing typecheck errors in `apps/e2e/runners` (vitest-in-Playwright conflict) — baseline debt

## Next steps

**Immediate:** Operator runs `close-feature.sh` to merge `feat/bulk-import-sortie-a` → `development`.

**Sortie B (preview + resolver + UI) preconditions met:**
- ADR-0402 status `proposed` → must be flipped to `accepted` BEFORE installing xlsx
- 4 authority rows already seeded for preview_batch + resolve_ambiguity (Sortie B) + commit_batch (Sortie C) — no L-0083 friction
- `fn_fuzzy_match_entity` RPC + resolveEntity wrapper both ready for preview_batch consumption
- `import_run` table + RLS + idempotency UNIQUE all live
- Telemetry registry has slot for batch_previewed/committed/failed registration (ADR-0377 register-with-emit gate enforces same-commit landing in Sortie B/C)

**Sortie C (commit_batch + cascade-delegation) preconditions met:**
- `schedule_shift.source` CHECK allows `v3_bulk_import`
- Cascade-delegation helpers to add: `scheduler.create_shift_via_bulk_import`, `task.create_day_ad_hoc_via_bulk_import`, `invitation.send_for_workspace_import`
- Slot ADR-0403 reserved for retroactive attachment-routing ADR
