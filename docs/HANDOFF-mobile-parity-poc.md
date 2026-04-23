---
title: "Handoff — mobile-parity-poc (M4)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [handoff, m4, mobile-parity, daily-operation, adr-0158]
---

# Handoff — mobile-parity-poc (M4)

> Sub-sortie of `campaign/daily-operation` · Branch: `feat/daily-operation-mobile-parity-poc` · Base: `campaign/daily-operation@0420ae7e` · Prerequisite token: `9ebef7a6` (`--hero-warm-deep` light + dark) · 4 commits delivered.

## Summary

M4 proves the dual-platform consumption strategy in live code. Three `packages/ui/day-control` widgets (PhaseBadge, TaskRow, KpiTile) now ship with `.native.tsx` siblings that consume shared `.ts` logic primitives — labels, tone keys, delta glyphs, and source suffixes live in exactly one place per widget, and both platforms resolve identical semantics through the same file. On top of that, `DuringShiftView.v2.tsx` lands as a parallel mobile surface behind `EXPO_PUBLIC_DURING_SHIFT_V2=true` — a Nordic Split gradient-hero redesign with a breathing animation (reduced-motion + low-power gated) and a Geist Mono tabular-nums live timer that carries the tempo without a tick animation. The flag-off build renders the legacy `DuringShiftView` unchanged; the flag-on build renders v2 end-to-end.

## What shipped (4 commits)

| Phase | Commit | Purpose |
|---|---|---|
| A | `6e0f3be1` | day-control: extract shared `phase-styles.ts` + `kpi-tile-shared.ts`; update web `.tsx` + `index.ts` to re-import from shared locations; add `lucide-react-native` optional peer to `packages/ui` |
| B | `0814dcbe` | day-control: `PhaseBadge.native.tsx` + `TaskRow.native.tsx` + `KpiTile.native.tsx`; add `--hero-warm-deep` hex to `nativeTheme.light` + `nativeTheme.dark` |
| C | `87bb17af` | mobile-during-shift: `DuringShiftView.v2.tsx` gradient-hero; `shift-hub.tsx` feature-flag alias resolver |
| D | (this commit) | docs: plan + journey + handoff |

## Decisions referenced

No new ADRs this sub-sortie. M4 lives entirely under three existing ADRs:

- **ADR-0158** — `packages/ui` dual-platform consumption strategy. M4 is the first consumer; this sub-sortie is the on-the-ground validation that the `.native.tsx` + shared `.ts` pattern scales past the design doc. Three widgets migrated cleanly; the pattern holds.
- **ADR-0133** — mobile executes, web composes. v2 is pure execution surface — read state + navigate + call Linking/Haptics. No authoring. Hero redesign does not reach across the boundary.
- **ADR-0134** — mobile telemetry contract. v2 is read-only + navigation-only; it emits **nothing new**. `getProfileContext()` wiring is therefore not in scope here — the contract is satisfied vacuously.

## Learnings

1. **ADR-0158 `.native.tsx` resolution relies on Metro defaults** — there's no explicit resolver config in `apps/mobile/metro.config.js` (beyond what Expo provides). Metro picks `*.native.tsx` over `*.tsx` when targeting iOS/Android out of the box. Web bundlers (Next.js/webpack) don't understand `.native.tsx` and default to `.tsx`. This works today with zero additional config, but a defensive test (attempt to import one widget in both platform contexts and assert class names / React-tree differences) would guard against a future bundler regression silently flipping the wrong file into the wrong build.

2. **Shared `.ts` files must stay DOM-free AND RN-free** — `phase-styles.ts` and `kpi-tile-shared.ts` don't import React, `lucide-react`, `lucide-react-native`, or any StyleSheet primitive. If a contributor adds a JSX fragment or an RN `StyleSheet.create` call into one of these files, both platforms break in different ways (web breaks because `StyleSheet` is undefined; mobile breaks because `tailwind` classes are meaningless strings). The safeguard today is code review + file header comments stating "Pure TS — no DOM, no RN". Future hardening: a lint rule on the `day-control/**.ts` glob banning JSX + RN imports.

3. **Token hex values must match OKLCH → sRGB conversion** — the `--hero-warm-deep` CSS side (at `9ebef7a6`) defined `oklch(0.28 0.04 48)` and `oklch(0.22 0.035 48)`. The native-theme side needs pre-converted hex. Manual conversion gave `#4c3b2a` (light) and `#3a2d1f` (dark). If the CSS token is ever tweaked, `packages/design-tokens/src/native.ts` must be updated in lockstep — there's no automatic sync. Future discipline: when editing any token row in `tokens.css`, mirror it in `native.ts` in the same PR. Ideally this becomes codegen.

4. **Feature flag lives at module-load, not render** — the `DuringShiftView = DURING_SHIFT_V2_ENABLED ? V2 : V1` line at the top of `shift-hub.tsx` resolves once when the JS module loads. Toggling the env var at runtime (which can't happen in a production Expo build — the flag is statically inlined) or via a runtime toggle would require lifting the check into the component body. The chosen pattern is correct for static compile-time gating; a runtime override for QA requires a different approach (e.g. AsyncStorage + `useFeatureFlag("during_shift_v2")`).

5. **`useReducedMotion()` + `useLowPower()` is a two-gate pattern that scales** — the boolean `shouldAnimate = !reduceMotion && !lowPower` is readable and extensible. Adding a third gate later (e.g. "pause animations when app is backgrounded") is a one-line addition. Treating them as independent predicates avoided the "combined accessibility flag" trap where reduced-motion also disables battery saver, or vice versa.

## Known issues / debt

1. **`useLowPower()` is a placeholder.** The hook returns `false` unconditionally. Wiring `expo-battery` (`Battery.getPowerStateAsync()` + `Battery.lowPowerModeChanged` listener) is a pure follow-up that does not change any caller code — the hook signature is stable. `expo-battery` is not installed in the monorepo today; adding the dep + subscription is ~30 min of polish work. Parked here to keep M4 scope tight.

2. **Live hourly-rate is fallback-only.** `estimateEarnings(220, punch_in)` uses a hardcoded 220 NOK/t. Real rate resolution via `framework_rule` / `tariff_rate_table` + the employee's current contract is a D6/C1 integration that belongs to a separate sortie (likely part of the M2 recon-wizard depth work — the wizard already has the infrastructure to read these rates at reconciliation time).

3. **Pause and tillegg stats are placeholders.** "Pause 0 min" and "Tillegg —" exist to demonstrate the grid composition. Break accumulation from `time_entry.breaks` and surcharge computation from `framework_rule` are follow-ups.

4. **Radial-gradient is approximated.** React Native has no native radial-gradient primitive. `LinearGradient` with `start={{ x: 0.1, y: 0.05 }}` + `end={{ x: 0.95, y: 1 }}` reads as warm depth, but a true radial glow would require `react-native-svg`'s `<RadialGradient>` inside an absolutely-positioned SVG — acceptable future upgrade if the diagonal reads flat on-device.

5. **Flag-on bundle still includes flag-off code.** `DuringShiftViewV1` is imported unconditionally at the top of `shift-hub.tsx`; the ternary picks which one to render, but tree-shaking can't remove V1 because the import has side effects (module registration). When v2 promotes to default and we remove the flag, V1 should be deleted entirely to shrink the bundle.

6. **No motion-regression test.** Motion invariants (scale 1→1.04, 8s easing, reduced-motion static) are verified by inspection of `DuringShiftView.v2.tsx` lines 134-144. There is no E2E test that captures the reanimated shared-value over time and asserts the breathe shape. Acceptance is manual on-device.

7. **Typecheck is the only CI gate today.** No motion lint, no accessibility lint, no shared-file import guard. Campaign Invariant #1 ("3 CI-gates grønne på hver PR") still has 2 of 3 gates pending (seed-parity + emit-registry are planned in Phase 0e/0c of the revised campaign sequence).

## Next steps

1. **`/close-feature` handled by the orchestrator** — merges `feat/daily-operation-mobile-parity-poc` into `campaign/daily-operation`, syncs `origin/development` in, removes worktree.
2. **E2E journey sweep** — Phase 4 of the revised campaign sequence (CAMPAIGN-daily-operation.md lines 105-116). One spec per journey in `apps/e2e/` covering J1/J2 (flag ON/OFF) + J3 (dual-platform parity if feasible in Playwright + Detox; otherwise split into a web-E2E for J3-web and a manual on-device check for J3-mobile).
3. **Fase A closure** — M4 is the last Foundation milestone. Once E2E sweep passes, Fase A (Foundation) is complete and the campaign is ready to consider Fase B (intelligence-lag) per the roadmap.
4. **V2 promotion to default** — after on-device validation on at least 3 real shifts (breakfast, lunch rush, closing) and a positive leader-closing-time signal, flip the flag default to ON and schedule V1 removal.
5. **Polish follow-ups** (none blocking): `expo-battery` wiring, live hourly rate, pause accumulation, real radial gradient via SVG, shared-file import lint rule.

## Typecheck state at close

```
pnpm turbo typecheck
→ 33/33 tasks successful, 0 errors.
→ Mobile, UI, web, landing, all package typechecks green.
```

## Files touched

| Category | File | Change |
|---|---|---|
| shared logic | `packages/ui/src/day-control/phase-styles.ts` | new |
| shared logic | `packages/ui/src/day-control/kpi-tile-shared.ts` | new |
| web widget | `packages/ui/src/day-control/PhaseBadge.tsx` | re-import from shared |
| web widget | `packages/ui/src/day-control/TaskRow.tsx` | ADR-0158 header + `"use client"` |
| web widget | `packages/ui/src/day-control/KpiTile.tsx` | re-import from shared |
| barrel | `packages/ui/src/day-control/index.ts` | export shared + split PHASE_STYLES source |
| native widget | `packages/ui/src/day-control/PhaseBadge.native.tsx` | new |
| native widget | `packages/ui/src/day-control/TaskRow.native.tsx` | new |
| native widget | `packages/ui/src/day-control/KpiTile.native.tsx` | new |
| package manifest | `packages/ui/package.json` | `lucide-react-native` optional peer |
| lockfile | `pnpm-lock.yaml` | `lucide-react-native@0.577.0` entry |
| tokens | `packages/design-tokens/src/native.ts` | `heroWarmDeep` (light + dark) |
| mobile view | `apps/mobile/src/components/home/DuringShiftView.v2.tsx` | new (581 lines) |
| mobile route | `apps/mobile/app/(app)/(home)/shift-hub.tsx` | feature-flag alias |
| docs | `docs/plans/PLAN-mobile-parity-poc.md` | filled-in |
| docs | `docs/journeys/JOURNEY-mobile-parity-poc.md` | new |
| docs | `docs/HANDOFF-mobile-parity-poc.md` | this file |
