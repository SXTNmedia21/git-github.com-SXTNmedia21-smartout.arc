---
title: "Gatedwrite Wave 2A — Season Wizard Migration"
status: in_progress
updated: 2026-04-18
created: 2026-04-18
module: governance
tags: [gate-client, adr-0091, adr-0114, season, wizard]
---

# Gatedwrite Wave 2A — Season Wizard Migration

## Scope

Council verdict (2026-04-18): APPROVE WITH CHANGES — rescoped to Season-wizard only. Waves 2B (capability) and 2C (schedule TanStack) are blocked on prerequisites (P1–P3, Q1–Q3) out of scope for this feature.

## Council-mandated scope (5 items)

### 1. Migrate `SeasonSetupStep.tsx` raw `useCallback` → Server Action

File: `apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx`

Today the step writes directly via `supabase.from("season").insert()` or `.update()` inside a `useCallback`. Migrate to:

- New file: `apps/web/src/app/dashboard/setup/_actions/season-actions.ts`
  - Export `createSeason(input)` → uses `gatedInsert(serverClient, "season", row, ctx)`
  - Export `updateSeason(seasonId, patch)` → uses `gatedUpdate(serverClient, "season", patch, ctx)` with `entityIdColumn: "season_id"`
  - Return shape: `Promise<GatedActionResult>` matching pilot contract
- `SeasonSetupStep.tsx` calls the Server Action and routes the result through `handleGatedResult` from `@/lib/gated-result` (existing helper from pilot)
- Preserves the pre-populate-from-existing behavior (`useQuery({queryKey: ["seasons", ...]})` stays)

### 2. Fix telemetry bug

Today the Season wizard emits `emit({event: "button clicked", properties: {trackingId: "season-created"}})` — wrong event, wrong shape. Registry at `packages/telemetry/src/registry.ts:1046, 1085` has proper `"season created"` and `"season updated"` events, currently unused.

After migration, Server Action emits `"season created"` or `"season updated"` with the registered schema (entity_type: "season", entity_id: season_id, data: {name, start_date, end_date, status}).

### 3. Flip `gatedUpdate`/`gatedDelete` default `entityIdColumn` to required

File: `packages/supabase/src/gate-client.ts`

Today: `GateContext.entityIdColumn?: string` (defaults to `"id"` inside the function).
Change: `GateContext.entityIdColumn: string` (required — no default, TS enforces at compile time).

Rationale: Council caught this as a latent zero-row-match trap. Silent zero-row updates + successful gate telemetry = provenance claiming mutations that didn't happen. A canonical cascade integrity violation.

Breaking change surface:
- All existing callers in `apps/web/src/app/dashboard/people/_actions/people-actions.ts` already pass `entityIdColumn: "profile_id"` explicitly — no behavioral change.
- Tests at `apps/web/src/app/dashboard/people/_actions/__tests__/gate-client.test.ts` explicitly verify the `"defaults to 'id'"` behavior. These tests must be **removed/rewritten** to verify that `entityIdColumn` is required and that passing it correctly produces the right `.eq()` call.
- New callers in Wave 2A (`season-actions.ts`) pass `entityIdColumn: "season_id"`.

### 4. ~~I1 bootstrap verification~~ — VERIFIED, not a blocker

`bootstrap-cascade` Edge Function populates `engine_authority_config` at step 10. Called from `finalize-workspace`. `SeasonSetupStep` runs DURING wizard, BEFORE finalize — but `cascade_gate_write` falls back to `{allowed: true, outcome: 'applied'}` when no `framework_trigger` targets `entity_type='season'`. No season triggers are seeded today, so Season writes pass through the gate cleanly.

### 5. ~~`handleGatedMutationError` helper~~ — DEFERRED to Wave 2C

The helper as named is for TanStack optimistic mutations (Wave 2C scope). Wave 2A uses the existing `handleGatedResult` from `apps/web/src/lib/gated-result.ts` (flat Server Action shape). Shipping a TanStack helper speculatively would produce an untested signature. Deferred with the realtime reconciliation contract.

## Files created

- `apps/web/src/app/dashboard/setup/_actions/season-actions.ts` — NEW, two Server Actions
- `apps/web/src/app/dashboard/setup/_actions/__tests__/season-actions.test.ts` — NEW, Vitest
- `apps/web/src/test-utils/gate-mocks.ts` — NEW (consolidation from pilot handoff TODO — `gatedUpdateMock` + `buildClientStub` from people-actions moved here so Wave 2A reuses the pattern)

## Files modified

- `apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx` — replace direct supabase writes with Server Action calls + `handleGatedResult`
- `packages/supabase/src/gate-client.ts` — flip `entityIdColumn` from optional to required in `GateContext` type + remove `?? "id"` fallback in `gatedUpdate`/`gatedDelete` bodies
- `apps/web/src/app/dashboard/people/_actions/__tests__/gate-client.test.ts` — rewrite `"defaults to 'id'"` tests as `"requires entityIdColumn"` tests

## Not touched in this wave

- `apps/web/src/app/dashboard/people/_actions/people-actions.ts` — already passes `entityIdColumn` explicitly, no change needed
- `packages/ai/src/capabilities/**` — Wave 2B
- `apps/web/src/app/dashboard/schedule/**` — Wave 2C
- `hooks/shift-clock/**` — Wave 2C

## Exit criteria

1. `pnpm --filter @smartout/supabase typecheck` clean (entityIdColumn required)
2. `pnpm --filter @smartout/web typecheck` clean (all existing callers compile)
3. `pnpm --filter @smartout/web test:unit -- season-actions` passes — applied / proposed / denied branches covered
4. `pnpm --filter @smartout/web test:unit -- gate-client` passes — "requires entityIdColumn" tests pass
5. Manual verification: onboarding wizard season step creates season, toast shows "Sesong opprettet", subsequent visit updates season, toast shows "Sesong oppdatert"
6. `activity_trail` + PostHog receive `"season created"` / `"season updated"` events (not `"button clicked"`)
7. No direct `.from("season").insert/update/delete` in web app (ESLint `smartout/no-direct-supabase-write` no longer flags `SeasonSetupStep.tsx`)

## Post-merge deliverables

- HANDOFF doc: `docs/HANDOFF-gatedwrite-wave-2a.md`
- JOURNEY doc: `docs/journeys/JOURNEY-gatedwrite-wave-2a.md`

## Out of scope (explicitly flagged as debt)

- Wave 2B capability migration — blocked on P1/P2/P3 prerequisites (ADRs for gate stacking + tool result contract + agent-router security)
- Wave 2C schedule TanStack — blocked on Q1/Q2/Q3 prerequisites (`--color-proposed` token + `pendingProposalId` type field + realtime reconciliation contract)
- Wave 2D ESLint warn → error — deferred until all gated-table waves land
- `packages/ai/src/tools/season/*` orphaned D4 writes (uses `SeasonToolContext`, not `AgentToolContext`) — separate remediation wave
- `contract-intake/tools.ts:221` D2 `employment_contract.insert` — Wave 2B scope
