---
title: "Plan — mobile-parity-poc (M4)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [plan, m4, mobile-parity, daily-operation, adr-0158]
---

# Plan — mobile-parity-poc (M4)

> Branch: `feat/daily-operation-mobile-parity-poc` · Worktree: `/home/sxtnl/dev/smartout.ai-daily-operation-wt-4` · Base: `campaign/daily-operation@0420ae7e` · Module: operations · Started: 2026-04-22

## Goal

Ship the first concrete slice of ADR-0158 dual-platform strategy by migrating three `packages/ui/day-control` widgets (PhaseBadge, TaskRow, KpiTile) to `.native.tsx` siblings with shared `.ts` logic primitives, and redesigning `DuringShiftView` on mobile into the Nordic Split gradient-hero surface gated behind `EXPO_PUBLIC_DURING_SHIFT_V2`.

## Scope

Per `docs/plans/CAMPAIGN-daily-operation.md` §Milestone 4 (lines 183-197) + §Motion-spec M4 (lines 222-228).

- Three widgets dual-platform migrated (`PhaseBadge`, `TaskRow`, `KpiTile`) per ADR-0158 — `.tsx` for web, `.native.tsx` for mobile, shared `.ts` logic files keep labels / glyphs / tones identical.
- `DuringShiftView.v2.tsx` mobile redesign behind `EXPO_PUBLIC_DURING_SHIFT_V2=true`:
  - Radial-gradient hero using `--hero-warm-deep` token (seeded at `9ebef7a6`).
  - `useReducedMotion()` + `useLowPower()` gated breathe animation (scale 1→1.04→1, 8s ease-in-out infinite alternate).
  - Geist Mono 52pt tabular-nums live-timer — no tick animation (typography carries the tempo).
  - Earnings / pause / tillegg stat grid.
  - Noise-overlay per Nordic Split §glassmorphism.
  - a11y: `aria-label` on dept-stripe, ≥56pt touch targets, focus-ring via pressed states.

## Tasks

- [x] Seed `--hero-warm-deep` token (light + dark) in `packages/design-tokens/src/native.ts` — landed at `9ebef7a6`.
- [x] Extract `PHASE_STYLES` + `PhaseStyle` type from `PhaseBadge.tsx` into shared `packages/ui/src/day-control/phase-styles.ts`.
- [x] Extract `SOURCE_SUFFIX` + `deltaGlyph` + `deltaTone` from `KpiTile.tsx` into shared `packages/ui/src/day-control/kpi-tile-shared.ts`.
- [x] Add `PhaseBadge.native.tsx` — RN primitives + `nativeTheme` palette + reanimated pulse dot on `tone="success"` (respecting `useReducedMotion()`).
- [x] Add `TaskRow.native.tsx` — RN primitives + Pressable checkbox + `lucide-react-native` icons + overdue left-border parity.
- [x] Add `KpiTile.native.tsx` — RN primitives + shared delta/source logic + compact/default variants.
- [x] Update `packages/ui/src/day-control/index.ts` to export `PHASE_STYLES` / `PhaseStyle` / `SOURCE_SUFFIX` / `deltaGlyph` / `deltaTone` from shared locations.
- [x] Add `lucide-react-native` peer + dev dep to `packages/ui/package.json` (optional peer, aligns with `expo-linear-gradient`/`react-native`/`react-native-svg`).
- [x] Write `apps/mobile/src/components/home/DuringShiftView.v2.tsx` (581 lines) with hero, breathe animation, stat grid, live card, action grid.
- [x] Feature-flag switch in `apps/mobile/app/(app)/(home)/shift-hub.tsx` — `EXPO_PUBLIC_DURING_SHIFT_V2 === "true"` renders v2; default renders legacy `DuringShiftView.tsx` unchanged.
- [x] `pnpm turbo typecheck` — 0 errors.

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` → 33/33 tasks successful, 0 errors.
- [x] Motion invariants hold in code:
  - Breathe: scale 1→1.04 @ 8000ms `Easing.inOut(Easing.ease)` with `withRepeat(-1, true)`.
  - Reduced-motion fallback: `breathScale.value = 1` static.
  - Live-timer: no animation, `fontVariant: ["tabular-nums"]` + `GeistMono-Regular`.
- [x] Feature flag routes correctly:
  - `process.env.EXPO_PUBLIC_DURING_SHIFT_V2 === "true"` → `DuringShiftViewV2` mounts.
  - Unset / any other value → legacy `DuringShiftView` mounts; zero behaviour change.
- [x] Three widgets have `.native.tsx` siblings that consume shared `.ts` logic (no duplication of labels / glyphs / tones).
- [x] Decision log — no new ADRs this sub-sortie (M4 lives entirely under ADR-0158 + ADR-0133 + ADR-0134).
- [x] User journeys written: `docs/journeys/JOURNEY-mobile-parity-poc.md`.
- [x] Handoff written: `docs/HANDOFF-mobile-parity-poc.md`.

## Out-of-scope

- **`expo-battery` wiring.** `useLowPower()` is a placeholder returning `false`; real `Battery.getPowerStateAsync()` + `Battery.lowPowerModeChanged` listener is polish follow-up. The hook contract is in place so the swap is a no-op for consumers.
- **Live hourly-rate wiring.** `estimateEarnings()` uses a fallback 220 NOK/t. Live rate resolution (framework_rule / tariff_rate_table per ADR-0133 D6) is a follow-up tied to C1 calibration, not M4.
- **Pause tracking.** "Pause 0 min" stat is a placeholder — break accumulation against `time_entry.breaks` is a parallel sortie.
- **Tillegg computation.** Weekend / night / red-day surcharges display "—" with a "Beregnes ved oppgjør" hint — reconciliation surfaces the real number at M2 submit.
- **E2E sweep across all sub-sorties.** That's Phase 4 of the revised campaign sequence (lines 105-116), not M4.

## Related references

- ADR-0158 — packages/ui dual-platform strategy (`docs/decisions/0158-packages-ui-dual-platform-strategy.md`).
- ADR-0133 — mobile surface boundary (web composes, mobile executes).
- ADR-0134 — mobile telemetry contract (no new emit paths introduced here; v2 does not mutate, only displays).
- Frontend Council M4 motion-spec — `CAMPAIGN-daily-operation.md` lines 222-228.
- `--hero-warm-deep` token commit — `9ebef7a6` (light `oklch(0.28 0.04 48)` / dark `oklch(0.22 0.035 48)`).
