---
title: "PLAN-2 — READ-rewrite (12 sites, 2 files)"
sortie: adr-0430-shift-zone-m2m
plan: 2
tier: T2
phase: read-side
created: 2026-05-28
status: pending
depends_on: [PLAN-1]
blocks: [PLAN-3]
estimated_effort_hours: 4-6
adr_rules_covered: [Rule 3]
---

# PLAN-2 — READ-rewrite

## Purpose

Switch the 12 READ sites that currently embed `location:location_id(name)` directly off `schedule_shift` to the post-reform path `shift_session → shift_session_day_line → day_line → location`. After PLAN-2, app code reads zone/location information through the cascade-correct join path.

This is **read-only refactor** — no writes touched, no schema changes, no telemetry events extended. The returned `location.name` string is identical; only the join path changes (ADR Rule 3).

## Scope

| # | File | Line | Current embed | Target path |
|---|------|------|---------------|-------------|
| 1 | `packages/ai/src/capabilities/schedule/tools.ts` | 80 | `location:location_id(name)` | `shift_session(shift_session_day_line(day_line(location(name))))` |
| 2 | `packages/ai/src/capabilities/schedule/tools.ts` | 253 | same | same |
| 3 | `packages/ai/src/capabilities/schedule/tools.ts` | 324 | same | same |
| 4 | `packages/ai/src/capabilities/schedule/tools.ts` | 414 | same | same |
| 5 | `packages/ai/src/capabilities/communication/briefing.ts` | 37 | `location:location_id(name)` | same |
| 6 | `packages/ai/src/capabilities/communication/briefing.ts` | 52 | same | same |

> **Important:** ADR-0430 cites "12 READ sites across 4 files." The 2026-05-27 audit INDEX lists 6 sites across 2 files; the discrepancy is the **multi-row return shape** at each site (each `select()` returns multiple shifts, but it's one query per call-site). PLAN-2 implements 6 query-rewrites; if implementer finds additional `location:location_id` embed call-sites elsewhere in those 2 files, include them. Verify with `grep -n 'location:location_id\|location:location_id(name)' packages/ai/src/capabilities/schedule/tools.ts packages/ai/src/capabilities/communication/briefing.ts` BEFORE starting work.

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-2.1 | All `location:location_id(name)` embeds on `schedule_shift` removed | `grep -n 'location:location_id' packages/ai/src/capabilities/schedule/tools.ts packages/ai/src/capabilities/communication/briefing.ts` returns 0 matches |
| AC-2.2 | New cascade-correct embed path present | `grep -nE 'shift_session.*day_line.*location' packages/ai/src/capabilities/schedule/tools.ts packages/ai/src/capabilities/communication/briefing.ts` returns ≥ 6 matches |
| AC-2.3 | Return shape unchanged at call-site | TypeScript compiles without changes to consumer code; the field `location.name` or equivalent string is still exposed at the same access path (may require re-flattening) |
| AC-2.4 | No LLM prompt template changes | `git diff` does NOT touch `packages/ai/src/prompts/` (per ADR Rule 3 claim — re-verify; if briefing.ts:37 returns multi-zone data and Bottson prompt depends on single-location string, this AC may need amendment) |
| AC-2.5 | Live invoke green | Per MEMORY.md L-0348 / Track-F rule: every new DB-read capability MUST end with Node-script live invoke on seeded local DB. Run `tsx packages/ai/src/capabilities/schedule/__live__/invoke-read.ts` (or scratch script) and confirm output matches pre-rewrite snapshot |
| AC-2.6 | typegen unchanged blast | `pnpm turbo typecheck` green; no `SelectQueryError` (per L-0177 + L-0298 traps; if seen, typegen behind DB — re-run `supabase gen types --local`) |
| AC-2.7 | Capability unit tests green | `pnpm turbo test --filter='@smartout/ai...'` PASS |
| AC-2.8 | E2E green | `pnpm exec playwright test apps/e2e/scheduling/` PASS — pre-PLAN-3 (no UI changes yet, but Botsson conversational tests exercise these reads) |

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Briefing.ts:37 LLM prompt actually depends on flattened single-location string — multi-zone return breaks prompt | MEDIUM | Manually inspect briefing.ts:37 output shape. If multi-zone shift would surface multiple location names, decide: (a) join+aggregate location names server-side (`array_agg(DISTINCT location.name)`), (b) leave first-only (LIMIT 1 effective), (c) accept change and update prompt. ADR claim "no prompt change" assumes (a) or (b) — flag if (c) required. |
| Return shape change cascades into typegen errors (L-0298 sibling) | MEDIUM | If `SelectQueryError` appears, `supabase db reset` → `gen types --local` → re-typecheck. Do NOT add `as any` shortcut. |
| Embed depth (4 levels deep) hits PostgREST query-complexity limit | LOW | If observed, switch to two-step query (fetch shift, fetch shift_session location separately) — acceptable performance tradeoff for correctness |
| Multi-zone shift returns multiple rows where caller expects 1 | MEDIUM | Distinct-on caller side OR aggregate in select. Most readers want shift-row dedup; verify per-call-site |

## Dependencies

- **PLAN-1** must be applied (otherwise `shift_session_day_line.location` join path isn't useful — `shift_zone` table not yet present, but READ-rewrite uses pre-existing junction).
- **NOTE:** Technically PLAN-2 reads do NOT depend on `shift_zone` table — they only depend on `shift_session_day_line` → `day_line` → `location` which all exist pre-PLAN-1. PLAN-2 *could* run before PLAN-1 in principle, but per SDSM continuous test-mode + ADR Rule 3 ordering ("READ-rewrite before WRITE-rewrite"), PLAN-1 ships first to keep migration discipline intact.

## Files to touch

- **Edit:** `packages/ai/src/capabilities/schedule/tools.ts` (4 query-rewrites at lines 80, 253, 324, 414)
- **Edit:** `packages/ai/src/capabilities/communication/briefing.ts` (2 query-rewrites at lines 37, 52)
- **Create (scratch):** `packages/ai/src/capabilities/schedule/__live__/invoke-read.ts` (Track-F live invoke per L-0348)
- **No regen:** `database.types.ts` should NOT change from PLAN-1 baseline

## Validation gate (must pass before PLAN-3 ships)

All 8 ACs PASS. `pnpm turbo typecheck` green. Track-F live invoke produces deterministic non-error output. Continuous mode: E2E green.

## Notes

- PLAN-2 is the lowest-risk plan in this sortie — pure refactor on read path. Surfaced as its own plan (rather than bundled with PLAN-3) because:
  1. **Bisection clarity** — if a regression appears in chat surfaces post-PLAN-2, we know it's read-only and easy to revert.
  2. **ADR Rule 3 ordering discipline** — read-rewrite BEFORE write-rewrite is a council-mandated invariant (not just "convenient").
  3. **Track-F live invoke milestone** — proves new join path returns sensible data before any write logic depends on it.
- If implementer finds the `location:location_id` embed elsewhere in `packages/ai/` (e.g. operations/, communication/) — capture as bonus rewrite and verify the 2026-05-27 audit was complete. Append to AC-2.1 file list.
