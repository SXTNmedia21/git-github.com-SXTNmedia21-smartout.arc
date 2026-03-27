---
title: "Industry Intelligence Consolidation"
status: approved
updated: 2026-03-27
created: 2026-03-27
module: industry
tags: [industry, i1, tariff, consolidation, architecture]
council: APPROVE_WITH_CHANGES
---

# Industry Intelligence Consolidation

> Consolidate three divergent copies of industry intelligence into one shared module with runtime tariff loading.

## Problem

Industry intelligence (tariff rates, NACE mappings, department defaults, shift templates, botsson prompts) is scattered across three locations:

| Location                                                  | Contents                                                                           | Consumers                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `apps/web/src/lib/industry/packages/hospitality.ts`       | Richest: tariffs, dept types, offsets, payroll templates, shifts, seasons, botsson | 9 setup wizard adapters via hook |
| `apps/web/src/app/onboarding/lib/industry-defaults.ts`    | NACE map, departments, positions, procedures                                       | 4 onboarding wizard files        |
| `packages/ai/src/tools/intelligence/industry-defaults.ts` | Near-identical to onboarding copy                                                  | AI tool barrel re-exports        |

Problems:

1. **Web-only** — mobile and Edge Functions cannot access industry data
2. **Three copies diverging** — hospitality.ts evolved (correct Riksavtalen rates), NACE copies stayed simpler
3. **Hardcoded tariff rates** — should come from `tariff_rate_table` at runtime (seeded by migration 20260424100000)

## Solution

Consolidate into two packages:

- **Types**: `packages/types/src/industry.ts` — domain types shared by all consumers
- **Logic + data**: `packages/ai/src/industry/` — canonical industry intelligence module

### Target Structure

```
packages/types/src/industry.ts          <- IndustryPackage, IndustryTariff, etc.

packages/ai/src/industry/
├── index.ts                            <- Public API re-exports
├── packages/
│   ├── hospitality.ts                  <- Bootstrap seed data + UI package config
│   └── default.ts                      <- Default fallback package
├── defaults.ts                         <- NACE map, getDepartmentsForIndustry, etc. (consolidated)
├── department-classifier.ts            <- lookupDepartmentType, DEPARTMENT_TYPE_MAP, offsets
└── loader.ts                           <- Runtime loader: SupabaseClient -> tariff_rate_table -> IndustryPackage
```

### Why NOT `packages/ai/src/capabilities/industry/`

The `capabilities/` directory has a strict contract: every entry is a `CapabilityDefinition` with `name`, `tools`, `readOnlyTools`. Industry intelligence is a data/logic module, not an agent capability. Placing it in `capabilities/` would violate that contract and confuse the capability registry.

### Why NOT a standalone `packages/industry/`

Overkill for one vertical (hospitality). The AI package already has Supabase dependency and is the natural home for I1 bootstrap logic. Can be extracted later if more verticals are added.

## Loader Design

### Scope: I1 Bootstrap Only

The loader answers: "What should a workspace look like at creation time for this industry?"

It does NOT:

- Compute runtime scheduling constraints (that is cascade D3 via `resolveTariffRate()`)
- Replace `department_operating_hours` lookups at runtime
- Serve as a general "get tariff rates" API

### Signature

```typescript
async function loadIndustryPackage(
  supabase: SupabaseClient,
  industryType: IndustryType,
  workspaceId?: string,
): Promise<IndustryPackage>;
```

Takes explicit `SupabaseClient` parameter — never imports a client directly. Maintains workspace isolation through the caller's RLS-scoped client.

### Three-Tier Fallback Chain

1. **Workspace K1b** — `tariff_rate_table WHERE workspace_id = ?` (future: workspace overrides)
2. **Platform K1a** — `tariff_rate_table WHERE workspace_id IS NULL` (seeded by migration 20260424100000)
3. **Hardcoded defaults** — static `hospitalityPackage` constant (current reality, always works)

Today: tier 2 works if framework seed migration has run. Tier 3 always works. Tier 1 is future.

### Type Relationship

- `IndustryTariff` (in `packages/types/`) — bootstrap/UI presentation shape with nested supplements
- `TariffRateRow` (in cascade `types.ts`) — flat DB row shape for D3 runtime resolution
- The loader transforms `tariff_rate_table` rows into `IndustryTariff` shape
- `tariff_rate_table` is the source of truth. `IndustryTariff` is a projection for display.

## React Hook

`apps/web/src/lib/industry/use-industry-package.ts` stays in apps/web. It:

1. Detects industry type from `workspace.intelligence_data`
2. Calls the loader (or falls back to hardcoded package)
3. Provides `setIndustryType` for manual override + persist

### UX Strategy

Moving from hardcoded (instant) to DB-backed (50-200ms) requires:

- **Pre-fetch at dashboard level** — `queryClient.prefetchQuery` in DashboardShell or OnboardingGuide. Users never see a flash.
- **staleTime: Infinity** — already set. Tariff rates don't change during a wizard session.
- **Skeleton cards** — PayrollStepAdapter shows skeleton rows matching tariff table layout, not a spinner.
- **Error boundaries** — per-adapter error boundaries. Failed loader falls back to hardcoded, shows soft indicator.
- **No WizardLoadingOverlay** — that pattern is for heavy operations, not lightweight queries.

## Three-Copy Consolidation Plan

### Copy 1: `apps/web/src/lib/industry/packages/hospitality.ts`

**Action:** Move to `packages/ai/src/industry/packages/hospitality.ts`

- Update type imports to `@smartout/types/industry`
- This is the canonical, richest version

### Copy 2: `apps/web/src/app/onboarding/lib/industry-defaults.ts`

**Action:** Delete. Replace imports with `@smartout/ai/industry`

- 4 consumers: wizard-definition.ts, useOnboardingState.ts, BigBoard.tsx, TeamSetupStep.tsx
- Type differences (`DepartmentOption` vs `DepartmentSuggestion`) resolved — use one canonical type

### Copy 3: `packages/ai/src/tools/intelligence/industry-defaults.ts`

**Action:** Replace body with re-export shim from `@smartout/ai/industry` + `@deprecated` JSDoc

- 1 consumer: `packages/ai/src/tools/intelligence/index.ts`

## Files Changed

### Created

| File                                                | Purpose                                             |
| --------------------------------------------------- | --------------------------------------------------- |
| `packages/types/src/industry.ts`                    | Canonical domain types                              |
| `packages/ai/src/industry/index.ts`                 | Public API                                          |
| `packages/ai/src/industry/packages/hospitality.ts`  | Hospitality package (moved)                         |
| `packages/ai/src/industry/packages/default.ts`      | Default package (moved)                             |
| `packages/ai/src/industry/defaults.ts`              | Consolidated NACE/dept/position/procedure functions |
| `packages/ai/src/industry/department-classifier.ts` | Department type classification + offset defaults    |
| `packages/ai/src/industry/loader.ts`                | Runtime tariff loader with 3-tier fallback          |

### Deleted

| File                                                   | Reason       |
| ------------------------------------------------------ | ------------ |
| `apps/web/src/lib/industry/packages/hospitality.ts`    | Moved        |
| `apps/web/src/lib/industry/packages/default.ts`        | Moved        |
| `apps/web/src/app/onboarding/lib/industry-defaults.ts` | Consolidated |

### Modified (import updates)

| File                                                      | Change                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| `packages/types/package.json`                             | Add `./industry` subpath export              |
| `packages/ai/package.json`                                | Add `./industry` subpath export              |
| `packages/ai/src/tools/intelligence/industry-defaults.ts` | Deprecation re-export shim                   |
| `packages/ai/src/tools/intelligence/index.ts`             | Update re-export source                      |
| `apps/web/src/lib/industry/types.ts`                      | Re-export from `@smartout/types/industry`    |
| `apps/web/src/lib/industry/use-industry-package.ts`       | Import packages from `@smartout/ai/industry` |
| 7 wizard step files                                       | Type imports -> `@smartout/types/industry`   |
| 4 onboarding files                                        | NACE imports -> `@smartout/ai/industry`      |
| 1 test file                                               | Update imports                               |

### Not Changed

| Module                                                          | Why                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| Cascade lib (`resolve-tariff-rate.ts`, `get-tariff-context.ts`) | Independent D3 runtime — different types, different queries |
| Edge Functions (`bootstrap-cascade`, `finalize-workspace`)      | Use SQL directly, not TypeScript packages                   |
| Schedule/shift modules                                          | No industry imports                                         |
| Telemetry                                                       | No coupling                                                 |
| Mobile                                                          | No industry imports yet (enabled by this change)            |

## Known Debt (Not Blocking)

1. **Hardcoded Norwegian text** — hospitality.ts has department names, botsson prompts, season descriptions in Norwegian. i18n extraction is a future task. This consolidation reduces the surface area (1 file instead of 3).
2. **botsson prompts** — agent prompt fragments embedded in IndustryPackage. Should eventually move to `packages/ai/src/prompts/`. Not blocking.
3. **DepartmentOption vs DepartmentSuggestion** — two type names for the same concept. Unified to one canonical type in this consolidation.

## Council Review

Reviewed 2026-03-27 by System Council (all 4 agents).
**Verdict:** APPROVE WITH CHANGES
**Key changes from original proposal:**

1. Types to `packages/types/`, not `packages/ai/`
2. `packages/ai/src/industry/`, not `packages/ai/src/capabilities/industry/`
3. Three-copy consolidation (not two)
4. Explicit 3-tier fallback chain documented
5. UX strategy: pre-fetch + skeleton + error boundaries
