---
title: "HANDOFF — hms-collision-fix"
status: done
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, collision-fix, ADR-0348, L-0258, M5-sortie-2]
---

# HANDOFF — hms-collision-fix

> Branch: `feat/ui-shell-hms-collision-fix` | Commit: `d053819e7` | Closed: 2026-05-17

## What Was Built

Resolved 3 LIVE L-0258 tool-name collisions in the HMS cluster Botsson bridges + shipped the ADR-0348 CI detector script to prevent recurrence. This was M5 Sortie 2 of 4 — blocker for Sortie 3 (`hms-cluster-polish-read`).

## Collisions Resolved

| Tool Name | Removed From | Kept In | Semantic Change |
|---|---|---|---|
| `listOpenDeviations` | `hms` umbrella + `governance` | `hms/deviations` (sub-tab) | HMS umbrella and governance surface deviation counts via `getHmsOverview` / `getGovernanceState` respectively. Full list requires navigating to `/dashboard/hms/deviations`. |
| `getDriftStatus` | `hms` umbrella | `hms/drift` (sub-tab) | HMS umbrella no longer exposes drift detail. Manager must navigate to `/dashboard/hms/drift` tab to query D6 session stats. |
| `getProtocolDetail` | `hms/governance` (sub-tab) | `governance` (top-level) | `/dashboard/hms/governance` sub-tab now exposes overview + list only (`getHmsGovernanceOverview` + `listGovernanceProtocols`). Per-protocol detail requires `/dashboard/governance`. |

## Files Changed

### Tool files (4 removals across 3 source files)

- `apps/web/src/app/dashboard/hms/_tools/use-hms-tools.ts` — removed `listOpenDeviations` + `getDriftStatus` definitions + implementations. Removed `summarizeDeviation` helper (sole consumer removed). Removed `driftInsights` from `HmsToolInput`. Removed `DriftInsights` import.
- `apps/web/src/app/dashboard/governance/_tools/use-governance-tools.ts` — removed `listOpenDeviations` definition + implementation. Removed `summarizeDeviation` helper (sole consumer removed).
- `apps/web/src/app/dashboard/hms/governance/_tools/use-hms-governance-tools.ts` — removed `getProtocolDetail` definition + implementation.

### Bridge files (1 caller update)

- `apps/web/src/app/dashboard/hms/_tools/hms-tools-bridge.tsx` — removed `useDriftInsights` import, `today` computed constant (useMemo), `driftInsights` state, and `driftInsights: driftInsights ?? null` prop passed to `useHmsTools`. `useMemo` retained for `overdueProtocolCount`.

### No bridge changes needed

- `apps/web/src/app/dashboard/governance/_tools/governance-tools-bridge.tsx` — bridge passes all of `GovernanceToolInput` via props spread; `openDeviations` still in input (used by `getGovernanceState`). No change.
- `apps/web/src/app/dashboard/hms/governance/_tools/hms-governance-tools-bridge.tsx` — bridge passes `{ loading, protocols }` as-is. No change.

### CI detector (new)

- `scripts/check-tool-name-collisions.ts` — ADR-0348 detector. Globs 46 `use-*-tools.ts` files under `apps/web/src/app/dashboard/**/_tools/`, extracts `modelToolName` literals (with comment stripping), fails on duplicates.
- `package.json` — added `"lint:tool-collisions": "tsx scripts/check-tool-name-collisions.ts"` script.
- `.husky/pre-push` — added `pnpm lint:tool-collisions` after existing `pnpm lint` + `pnpm typecheck` gates.

## Input Type Changes

| Type | Field Removed | Impact |
|---|---|---|
| `HmsToolInput` | `driftInsights: DriftInsights \| null` | `hms-tools-bridge.tsx` no longer fetches `useDriftInsights` or passes this prop. |

No other input types changed. `GovernanceToolInput.openDeviations` retained (used by `getGovernanceState`).

## Decisions

| ID | Decision |
|---|---|
| ADR-0348 | L-0258 collision detector mandatory in CI (proposed → accepted by this sortie shipping the implementation). |

## Learnings

**Detector found 8 out-of-scope cross-domain collisions.** Running `scripts/check-tool-name-collisions.ts` after the 3 HMS fixes reports 8 additional collisions across unrelated surfaces (billing, contracts, proposals, komm/notifications, onboarding-assistant/setup, organization/teams, season/year-wheel). These are NOT fixed in this sortie (out of scope per council decision). Flag for follow-up sortie.

Cross-domain collisions found (for follow-up sortie):
1. `getInvoiceDetail` — billing/[invoice_id] + billing
2. `switchStatusFilter` — contracts + proposals
3. `getUnreadCount` — komm + notifications
4. `getCurrentStep` — onboarding-assistant + setup
5. `openStep` — onboarding-assistant + setup
6. `listTeams` — organization + organization/teams
7. `proposeActivateSeason` — season/[seasonId] + year-wheel
8. `proposeArchiveSeason` — season/[seasonId] + year-wheel

**`useDriftInsights` was imported exclusively for the removed `getDriftStatus` tool.** Removing the tool + the prop was safe — no other HMS umbrella tool reads drift data. The bridge was the only caller.

**`summarizeDeviation` pattern.** Both `use-hms-tools.ts` and `use-governance-tools.ts` had local `summarizeDeviation` helper functions that became unused when `listOpenDeviations` was removed. Both removed cleanly. ESLint confirmed no unused variable warnings.

## Known Issues / Debt

- 8 cross-domain collisions remain (detected by new script, exit 1). These are pre-existing L-0258 instances not in the HMS cluster. A follow-up sortie is needed to resolve them before the CI detector can be a hard gate across the full app.
- Detector currently wired to pre-push hook only (not a `turbo run lint` task). Adding it to turbo lint would require a per-package `lint` script in `apps/web/package.json`. Deferred — pre-push is sufficient to block developers and CI runs pre-push as well.

## Next Steps (Sortie 3)

- `hms-cluster-polish-read` — now unblocked. Can safely refine tool descriptions in `use-hms-deviations-tools.ts`, `use-hms-drift-tools.ts`, `use-hms-governance-tools.ts` without phantom-contract amplifier risk (L-0257).
- Follow-up sortie for 8 cross-domain collisions detected above.
