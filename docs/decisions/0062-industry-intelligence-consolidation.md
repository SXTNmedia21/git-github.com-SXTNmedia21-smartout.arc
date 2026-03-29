---
title: "ADR-0062: Industry Intelligence Consolidation"
status: accepted
updated: 2026-03-27
created: 2026-03-27
module: industry
tags: [industry, i1, architecture, consolidation]
---

# ADR-0062: Industry Intelligence Consolidation

## Context

Industry intelligence (tariff rates, NACE mappings, department defaults, shift templates, botsson prompts) existed in three divergent copies:

1. `apps/web/src/lib/industry/packages/hospitality.ts` — richest, correct Riksavtalen rates
2. `apps/web/src/app/onboarding/lib/industry-defaults.ts` — NACE mappings for onboarding wizard
3. `packages/ai/src/tools/intelligence/industry-defaults.ts` — near-identical to #2

This caused: web-only access (no mobile/Edge Function/agent access), divergent data, and hardcoded tariff rates that should come from `tariff_rate_table`.

## Decision

Consolidate into two locations:

- **Types**: `packages/types/src/industry.ts` — domain types accessible to all packages
- **Logic + data**: `packages/ai/src/industry/` — canonical I1 bootstrap module

### Key boundaries

1. **NOT in `capabilities/`** — the capability directory has a strict `CapabilityDefinition` contract (tools, readOnlyTools). Industry intelligence is a data/logic module, not an agent capability.
2. **Loader scope: I1 bootstrap only** — loads tariff data for display/configuration. NOT D3 runtime resolution (use `resolveTariffRate()` from cascade lib for that).
3. **Loader takes explicit `SupabaseClient` parameter** — never imports a client directly. Maintains workspace isolation.
4. **Three-tier fallback**: workspace K1b → platform K1a (NULL workspace_id) → hardcoded defaults.
5. **`IndustryTariff` is a presentation projection** of `tariff_rate_table` rows. `tariff_rate_table` is the D3 source of truth.

### Onboarding adapter

The onboarding wizard uses its own state types (`DepartmentOption`, `ProcedureData` with `id`, `selected`, `isCustom`). A thin adapter in `apps/web/src/app/onboarding/lib/industry-defaults.ts` maps from canonical `IndustrySuggestion` to these wizard-specific types.

## Consequences

- All industry data has one canonical source
- Mobile and Edge Functions can access industry intelligence via `@smartout/ai/industry`
- Onboarding wizard functions unchanged (adapter preserves signatures)
- Deprecation shim in `packages/ai/src/tools/intelligence/industry-defaults.ts` — remove after all consumers updated

## Known debt

- Hardcoded Norwegian text in hospitality.ts (botsson, department names) — i18n extraction deferred
- `botsson` prompts embedded in IndustryPackage — should eventually move to prompt system

## Council review

System Council reviewed 2026-03-27. Verdict: APPROVE WITH CHANGES (all 4 agents).
