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

## Detector Ratchet Pattern (G3 spot-check follow-up)

G3 review found that wiring the detector to `pre-push` without a ratchet would block ALL pushes on ALL branches due to 8 pre-existing cross-domain collisions (L-0260 amplifier shape: closing 3 collisions while a new CI gate blocks all forward motion).

**Ratchet adopted** — same shape as TypeScript baseline gates, ESLint baseline gates, SonarCloud quality gates.

### Allowlist file

`scripts/known-tool-name-collisions.json`:

```json
{
  "knownCollisions": [
    "getInvoiceDetail",
    "switchStatusFilter",
    "getUnreadCount",
    "getCurrentStep",
    "openStep",
    "listTeams",
    "proposeActivateSeason",
    "proposeArchiveSeason"
  ],
  "note": "L-0258 cross-domain collisions pending follow-up sortie. ADR-0348 ratchet: detector PASSES on these, FAILS on any NEW collision. Shrink this list when collisions are resolved.",
  "lastUpdated": "2026-05-17",
  "trackingRef": "M5 HMS hms-collision-fix sortie HANDOFF"
}
```

### Detector behavior

The detector partitions detected collisions into `allowed` (in JSON) vs `new` (not in JSON):

- `new.length === 0` → exit 0. Allowlisted entries logged as `⚠ WARN` (informational, not blocking).
- `new.length > 0` → exit 1. NEW collisions listed with hint: "fix the collision OR add to allowlist with sortie/PR reference".
- **Decay warning:** if an allowlisted entry no longer appears as a collision (e.g. follow-up sortie resolved it), emit `⚠ WARN` suggesting the entry be pruned from the JSON.

### Verification

| Scenario | Command | Expected | Actual |
|---|---|---|---|
| Current state — 8 known, 0 new | `pnpm lint:tool-collisions` | exit 0, 8 allowlisted | exit 0, 8 allowlisted |
| Inject synthetic 9th collision (`focusDeviation` → `openDeviationDetail`) | `pnpm lint:tool-collisions` | exit 1, 1 new collision | exit 1, 1 new collision named correctly |
| Revert synthetic | `pnpm lint:tool-collisions` | exit 0 again | exit 0 again |

## Learnings

**L-0260 amplifier shape avoided via ratchet.** Closing the 3 HMS collisions while enabling a CI gate that fails on 8 pre-existing collisions would have blocked all developer pushes across all branches until follow-up sortie. The ratchet pattern (allowlist + partition) preserves forward motion while still blocking NEW regressions. Same shape used elsewhere for TypeScript baseline gates, ESLint baseline gates.

**Detector found 8 out-of-scope cross-domain collisions.** Running `scripts/check-tool-name-collisions.ts` after the 3 HMS fixes reports 8 additional collisions across unrelated surfaces (billing, contracts, proposals, komm/notifications, onboarding-assistant/setup, organization/teams, season/year-wheel). These are tracked in the allowlist (`scripts/known-tool-name-collisions.json`) and flagged for follow-up sortie.

Cross-domain collisions tracked in allowlist (for follow-up sortie):
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

- 8 cross-domain collisions remain in the allowlist. A follow-up sortie should resolve them and shrink `scripts/known-tool-name-collisions.json` to an empty array. This allowlist file IS the planning seed for that sortie.
- Detector currently wired to pre-push hook only (not a `turbo run lint` task). Adding it to turbo lint would require a per-package `lint` script in `apps/web/package.json`. Deferred — pre-push is sufficient to block developers and CI runs pre-push as well.

## Next Steps (Sortie 3)

- `hms-cluster-polish-read` — now unblocked. Can safely refine tool descriptions in `use-hms-deviations-tools.ts`, `use-hms-drift-tools.ts`, `use-hms-governance-tools.ts` without phantom-contract amplifier risk (L-0257).
- Follow-up sortie for 8 cross-domain collisions in the allowlist — assign single ownership per collision, then prune the JSON. Detector's decay-warning will surface entries that can be removed.
