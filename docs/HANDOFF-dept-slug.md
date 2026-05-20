---
title: "HANDOFF — dept-slug"
status: done
updated: 2026-05-20
created: 2026-05-18
module: mobile-schedule
tags: [mobile, schedule, dept-routing, handoff]
---

# HANDOFF — dept-routing reads department.slug from DB

## Summary

Replaced substring-based department heuristics (`toDeptSlug`, `extractDept`) in the mobile schedule hooks with structured DB reads of `department.slug`. This eliminates a silent mis-routing bug where departments with names not containing a keyword (`"Lounge"`, `"Vinkjeller"`) fell through to the `kjokken` fallback.

**Branch:** `feat/ui-shell-dept-slug`
**Campaign:** `campaign/ui-shell`
**Files changed:** 11 files (+215/-34 lines)

## What Was Built

- `apps/mobile/src/hooks/queries/use-my-shifts.ts` — rewrote dept scope resolution to join `position.department_id → department.slug` instead of substring-matching the shift label.
- `apps/mobile/src/hooks/queries/use-calendar-items.ts` — same slug-first pattern; `dept` field now populated from structured DB column.
- `apps/mobile/src/hooks/queries/use-operations-feed.ts` — `feedItem.dept` now carries the DB slug directly.
- `apps/mobile/src/hooks/queries/use-team-shifts.ts` — team-shift feed aligned to slug-based routing.
- `apps/mobile/src/components/calendar/types.ts` — widened `Department` union to include slugs observed in seed (`kjokken | sal | bar | event`).
- `apps/mobile/src/components/calendar/CompactShiftRow.tsx`, `DetailSheet.tsx`, `ScopeChips.tsx` — consume `dept` as slug directly; no string transforms.
- `apps/mobile/app/(app)/(shifts)/index.tsx` — ShiftListScreen scope scope wire-up.
- `packages/design-tokens/src/native.ts` — dept color map keyed by slug.

## Decisions Made

- Decision log entry added in commit `e559a3670` — registered in `docs/decisions/0000-decision-log.md`.
- No new ADR slot required: change is a bugfix (wrong slug derivation) not an architectural change. The `Department` slug union is already defined per cascade D1 model; this change aligns implementation to spec.

## Learnings

- `toDeptSlug` was used in 4+ places as a stop-gap because the query didn't join the `department` table. Once the join is added, all slug derivation code becomes dead weight. Remove the helper entirely rather than deprecating it — it leads to confusion.
- `Department` union type in `types.ts` must be kept in sync with `SELECT DISTINCT slug FROM department` (seed + migrations). A mismatch causes TypeScript to narrow to `never` for unrecognized slugs. Consider a codegen step.

## Known Issues / Debt

- NULL `position.department_id` fallback still defaults to `kjokken` with a `console.warn`. Documented in JOURNEY as an accepted gap. Fix requires a separate decision on how unassigned positions should behave.
- `Department` union in `types.ts` is manually maintained — risks drift when workspaces add custom department slugs. Long-term: generate from DB enum or RPC response type.

## Next Steps

- Monitor for slug-union drift as workspaces add departments via admin panel.
- Consider generating `Department` type from Supabase type-gen output.
- The `toDeptSlug` helper can now be removed from any remaining call sites outside the schedule module.
