---
title: "Plan — tariff-7g-reconcile"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: ai
tags: [plan, payroll, tariff, phase-7g, reconcile, contract, telemetry]
---

# Plan — tariff-7g-reconcile

> Branch: `feat/payroll-tariff-7g-reconcile` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll`

## Goal

Reconcile contract drift + missing telemetry + dedup left by Phase 7e parallel sortie (5 tracks shipped clean against contract but with documented gaps). Single-sortie fix because consumers + producer must stay aligned.

## Source of truth

- Phase 7e T1 report — 6 contract gaps flagged on commit `143a1fc97`
- Phase 7e T3 report — `SupplementType`/`RateType` named-export gap + view-emit registry gap
- Phase 7e T4 report — `payroll.tariff_view_loaded_mobile` not in registry
- T2 onboarding placeholder UUIDs documented in `apps/web/src/lib/onboarding/tariff-state.ts`
- ADR-0152 (envelope), ADR-0356 (audit-symmetry), ADR-0186 (telemetry registry)

## Files to modify

### Contract (foundation)
- `packages/types/src/payroll-tariff-bff-contract.ts`:
  - `setupTariffRequestSchema.union_id`: `z.string().uuid()` → `z.enum(["taro-79","taro-226","non-bound"])`
  - `changeTariffRequestSchema.new_union_id`: same enum
  - `supplementTypeSchema`: UX labels → DB taxonomy `["normal","week_based","day_based","manual","holiday","contract_rule"]`
  - `rateTypeSchema`: `["percentage","fixed_amount","hourly_rate"]` → `["fixed_per_hour","percentage","fixed_per_shift"]`
  - Add named exports: `UnionId`, `SupplementType`, `RateType`

### Capability tools (return real emit IDs)
- `packages/ai/src/capabilities/payroll/tariff-tools.ts`:
  - Each tool exec returns `{...existing, payroll_emit_id, cascade_emit_id}` from real emit() returns
  - `change_workspace_tariff`: read `old_law_version` from prev `workspace_union_binding` row BEFORE cascade call; return in result data
  - Update result type exports

### BFF (drop translation layers)
- `apps/web/src/app/api/payroll/tariff/setup/route.ts` — drop UUID→enum translation
- `apps/web/src/app/api/payroll/tariff/change/route.ts` — same + pass through old_law_version
- `apps/web/src/app/api/payroll/tariff/supplement/route.ts` — drop UX→DB taxonomy mapping
- `apps/web/src/app/api/payroll/tariff/current/route.ts` — no change
- All 4: response audit block uses real tool-returned emit IDs (no synthetic correlation UUIDs)

### Consumers (use enum + named types)
- `apps/web/src/lib/onboarding/tariff-state.ts` — `selected_union_id: UnionId | null`. `TARIFF_UNION_OPTIONS` enum values
- `apps/web/src/app/onboarding/_components/sections/TariffSection.tsx` — submit enum string, drop placeholder UUID logic (NOTE: file location may be `apps/web/src/app/onboarding/steps/` — verify via Glob)
- `apps/web/src/app/dashboard/payroll/tariff/_components/AddSupplementForm.tsx` — supplement_type select uses DB taxonomy, import named `SupplementType`
- `apps/web/src/app/dashboard/payroll/tariff/_components/ChangeBindingForm.tsx` — union_id select uses enum values

### Telemetry registry (2 events)
- `packages/telemetry/src/registry.ts`:
  - `PayrollTariffViewLoaded` interface + EVENT_ROUTING + SmartoutEvent union
  - `PayrollTariffViewLoadedMobile` interface + EVENT_ROUTING + SmartoutEvent union
  - Both route PostHog + Logger only (no activity_trail — read events, not mutations)

### Uncomment view-emit
- `apps/web/src/app/dashboard/payroll/tariff/_components/TariffClient.tsx` — uncomment view-emit, drop `unknown` cast
- `apps/mobile/app/(app)/(me)/tariff.tsx` — uncomment view-emit

### Deduplicate lovsen-client
- DELETE `services/lovsen-nho-reiseliv-mcp/src/lib/lovsen-client.ts` (Python MCP service can't consume TS)
- KEEP canonical `apps/web/src/lib/tariff/lovsen-client.ts`

### Sortie close
- `docs/journeys/JOURNEY-payroll-tariff-7g-reconcile.md` with `feature: tariff-7g-reconcile`
- `docs/handoffs/HANDOFF-payroll-tariff-7g-reconcile.md`

## Tasks

- [ ] T1. Read Phase 7e reports + current contract + capability tool emit shape
- [ ] T2. Amend contract (Zod + named exports)
- [ ] T3. Amend capability tools (return emit IDs + old_law_version)
- [ ] T4. Amend BFF (4 routes, drop translation, pass through emit IDs)
- [ ] T5. Amend onboarding consumer
- [ ] T6. Amend admin consumer
- [ ] T7. Register 2 telemetry events
- [ ] T8. Uncomment view-emit (T3+T4)
- [ ] T9. Delete duplicate lovsen-client.ts
- [ ] T10. Typecheck + tests + lint pass: web + mobile + ai + telemetry + types
- [ ] T11. Code-reviewer sonnet pass
- [ ] T12. Journey + handoff + close-feature

## Acceptance Criteria

- [ ] Contract matches tool/DB reality (no UUID, no UX label mapping)
- [ ] BFF returns real `payroll_emit_id` + `cascade_emit_id` (queryable in `activity_trail`)
- [ ] 2 telemetry events registered (interface + routing + union)
- [ ] T3 + T4 view-emit uncommented, no `unknown` cast
- [ ] T2 onboarding sends `"taro-79"|"taro-226"|"non-bound"` (no placeholder UUIDs)
- [ ] T3 admin uses named `SupplementType` + `RateType` imports
- [ ] Single `lovsen-client.ts` at `apps/web/src/lib/tariff/`
- [ ] `pnpm turbo typecheck --filter=web --filter=@smartout/mobile --filter=@smartout/ai --filter=@smartout/telemetry --filter=@smartout/types` all pass
- [ ] `pnpm turbo test --filter=@smartout/ai` passes (fixtures updated for new enums if needed)
- [ ] `pnpm --filter @smartout/ai lint` 0 errors
- [ ] Code-review approves

## Out of scope

- Stage-engine integration (T1's direct invocation pattern stays)
- Union master table (defer; enum sufficient V1)
- New ADRs
- New BFF routes
- Phase 8 production smoke + user testing

## Risks

- **Test fixture breakage**: T5 amendment-classifier tests + T10 tariff-tools tests may use old shapes. Update.
- **Telemetry registry collision**: Verify campaign/payroll tip before adding EVENT_ROUTING entries.
- **emit() return shape**: emit() may not return id today. May need uuid-before-emit pattern. Read existing payroll emit usage first.
- **Synthetic AgentToolContext**: BFF calls tools via synthetic ctx. Verify emit IDs propagate through that path (tools may need to return emit_id from data, not from emit() return).
