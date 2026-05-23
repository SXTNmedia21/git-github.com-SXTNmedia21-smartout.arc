---
title: "Year Wheel — Gaps and Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, gaps, debt, deviations]
---

# Year Wheel — Gaps and Debt

> Built-vs-planned delta. Deviations = code diverges from spec/plan. Gaps = planned but not built. Debt = built but needs cleanup. Overlap = shared surface with another domain.

## Deviations (code diverges from spec/plan)

### D1 — Dual tool registration: `proposeActivateSeason` + `proposeArchiveSeason`

**Severity:** Medium  
**Source:** L-0258 (known collision), `scripts/known-tool-name-collisions.json`

Both tool names appear in two surfaces:
- Year-wheel page: `apps/web/src/app/dashboard/year-wheel/_tools/use-year-wheel-tools.ts` (lines ~187–215)
- Season detail page: `apps/web/src/app/dashboard/season/[seasonId]/_tools/use-season-tools.ts` (lines ~96–116)

Per ADR-0240, cross-namespace writes without delegation OR dual registration without disambiguation violates frozen boundary rules. However, these are **client-tool registrations** (not capability tools), so the boundary is the page surface, not the capability namespace. Each registration is scoped to its page context (year-wheel page vs season detail page) and they cannot fire simultaneously.

**Current status:** Known collision. Pre-push hook (`lint:tool-collisions`) passes because both names are in the allowlist. The allowlist explicitly marks this as pending resolution ("Shrink this list when collisions are resolved"). ADR-grade resolution required before the allowlist shrinks.

**Resolution path:** Rename the season-page tools to `proposeActivateThisSeason` / `proposeArchiveThisSeason` to disambiguate. Low-risk rename — these are string keys, not TypeScript exports. Requires aligning intent-classifier mappings if any exist.

### D2 — `opening_hours` column vs `season_opening_hours` table

**Severity:** Low  
**Source:** Migration archaeology

The domain spec scope mentions a `season_opening_hours` table. Code inspection shows no such table — opening hours live on `season.opening_hours JSONB` (column added by `20260416200000_season_opening_hours.sql:6`) AND per-department operating hours are seeded to `public.department_operating_hours` on activation (D1 fanout). The `SeasonHoursTab.tsx` component exists and is in the active routing path (not deferred), reading from `useSeasonOperatingHours` hook.

**Status:** No blocking issue — just a terminology gap between the original scope spec and the shipped schema. `season_opening_hours` as a separate table does not exist.

### D3 — Active super-plan duplicate vs completed twin

**Severity:** Low  
**Source:** `docs/superpowers/plans/2026-04-20-year-wheel-redesign.md` vs `docs/superpowers/plans/completed/2026-04-20-year-wheel-redesign.md`

Both files have identical content. The "active" plan at `docs/superpowers/plans/` appears to be an artifact of the campaign setup rather than a genuinely in-flight plan. The redesign is shipped.

**Resolution path:** Confirm with Pontus. If completed, move/archive the active copy to `completed/` and note in CAMPAIGN file.

---

## Gaps (planned but not built)

### G1 — SeasonGoalsTab not in routing path

**Severity:** Medium  
**Source:** `apps/web/src/app/dashboard/season/[seasonId]/_components/_deferred/SeasonGoalsTab.tsx` (exists but deferred)

`season_goal` table is live with full schema. The tab component is written. But it is in `_deferred/` and the `SeasonSubmenu.tsx` tab navigation does not include the goals tab in its active routing.

**Resolution path:** CAMPAIGN M4 — move `SeasonGoalsTab.tsx` out of `_deferred/`, add "goals" tab to `SeasonSubmenu.tsx`.

### G2 — SeasonProceduresTab not in routing path

**Severity:** Medium  
**Source:** `apps/web/src/app/dashboard/season/[seasonId]/_components/_deferred/SeasonProceduresTab.tsx`

`season_policy_binding` table is live. The component is written. Deferred same as G1.

**Resolution path:** CAMPAIGN M4 — same pattern as G1.

### G3 — Duplicate season ("Copy last year") has no UI entry point

**Severity:** Low  
**Source:** `apps/web/src/app/dashboard/_actions/duplicate-season-action.ts` exists; `season_archive_duplicate_authority_seed.sql` seeded

The PRD's "Copy last year" hypothesis (§2) is partially implemented (server action + authority seed exist) but no UI button or context menu wires to it.

**Resolution path:** CAMPAIGN M4 — add Duplicate button to season detail Overview tab or year-wheel sidebar context menu.

### G4 — Seeded pill not surfaced in year-wheel canvas

**Severity:** Low  
**Source:** `useSeasonsSeededState` hook exists in `packages/year-wheel/src/hooks/use-seasons-seeded-state.ts`; no UI indicator on `TimelineBlock.tsx`

The hook returns a Set of season_ids whose D1 department_operating_hours have been seeded post-activation. This data is used in Botsson tool context but not rendered on the canvas.

### G5 — Voice bridge for mutation tools (ADR-0201 §D5)

**Severity:** Low (intentional deferral)  
**Source:** `packages/ai/src/capabilities/season/index.ts:26–28`

Mutation tools (create/set_revenue/save_playbook) + propose-tools are restricted to `chat + system` channels. Voice is reserved for `get_readiness` + `learn_factors`. Voice mutation path deferred to M5.

### G6 — Drag-to-resize season blocks

**Severity:** Low  
**Source:** Spec `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` §4.1

The canvas handles `onPointerDown` for draw-to-create but not drag-to-resize existing blocks. PRD Hypothesis 1 ("Draw, Don't Type") intended resize as a natural extension of the draw interaction.

### G7 — lint coverage gap: flat module files not scanned by `check-archived-refs.mjs`

**Severity:** Low  
**Source:** Domain-steward pre run, 2026-05-23

`scripts/check-archived-refs.mjs` scans for references to archived folder-form docs (e.g., `docs/modules/daytimeline/`) but does NOT scan for references to archived flat files (e.g., `docs/modules/MODULE_YEAR_WHEEL_PRD.md`). The `MODULE_YEAR_WHEEL_PRD.md` and `SMARTOUT_MODULE_15_SEASON_PLANNING.md` have now been archived, but no CI gate will catch stale refs to them until the lint script is extended.

**Resolution path:** Extend `check-archived-refs.mjs` to also scan for flat `.md` file paths in `docs/modules/` that carry `status: archived`.

---

## Debt (built but needs cleanup)

### T1 — Hardcoded color classes in year-wheel + season routes

**Source:** CAMPAIGN M2 Nordic Split sweep — partially done

Scope: `apps/web/src/app/dashboard/year-wheel/**` + `apps/web/src/app/dashboard/season/**`. ADR-0366 OKLCH literal ban applies.

### T2 — `isDark` prop drilling

**Source:** CAMPAIGN M2 design-debt plan

Multiple components accept `isDark` prop for theming. Should be replaced by CSS variable cascade (Nordic Split).

### T3 — Remaining hardcoded Norwegian strings

**Source:** CAMPAIGN M2 i18n migration (partially complete per M3 audit)

An i18n sweep touched ~55 keys in the wizard and surfaces, but year-wheel Norwegian strings were not fully migrated.

### T4 — Spring constants not on Nordic Split tokens

**Source:** CAMPAIGN M2

Framer Motion `stiffness` + `damping` values should use `--motion-spring-*` tokens.

### T5 — Touch targets on canvas blocks < 44pt

**Source:** CAMPAIGN M2

`TimelineBlock.tsx` blocks may fall below 44pt minimum on narrow seasons.

---

## Overlap edges

| Domain | Shared surface | Status |
|---|---|---|
| **core-structure** | `planning_cycle` (D1 container): year-wheel reads `planning_cycle_id` on season; core-structure owns the table. `department_operating_hours`: year-wheel's activation trigger seeds D1 rows owned by core-structure. | resolved (author/consumer) |
| **scheduling (future)** | `planning_event` (D4 demand signal) rendered on year-wheel canvas. When scheduling domain is defined, this table will migrate there. | open (deferred) |
| **day-session** | `department_session.season_id` links daily ops to active season. Year-wheel activation seeds the operating hours that day-session reads. | resolved (author/consumer) |
| **payroll** | Season period defines tariff `effective_from/to` slice window. Payroll reads season dates; year-wheel does not touch tariff tables. | resolved (read-only boundary) |
| **procedure-engine** | `season_policy_binding.policy_id` FK points to `public.policy` owned by procedure-engine. Year-wheel owns the binding record; procedure-engine owns the policy. `season.get_readiness` tool reads `protocol_assignment` (procedure-engine table) — noted as G26 in procedure-engine GAPS. | resolved (author/consumer) |
