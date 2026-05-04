---
title: "Journeys — mobile-parity-poc (M4)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [journey, m4, mobile-parity, daily-operation, adr-0158]
---

# Journeys — M4 Mobile Parity PoC

Three flows covering the v2 hero happy path (flag ON), the legacy-preservation regression path (flag OFF), and the dual-platform parity smoke test where web + mobile consume the same shared logic primitives. Written in the Journey Guardian format: precondition, numbered steps, postcondition, error paths.

---

## Journey 1: Leader on-shift with `EXPO_PUBLIC_DURING_SHIFT_V2=true` (happy path)

**Precondition:** Kari Nordmann is punched-in for her evening shift at Café Skuta. `use-shift-phase` returns `phase === "during_shift"` with a non-null `activeTimeEntry`. Build was produced with `EXPO_PUBLIC_DURING_SHIFT_V2=true` so the Expo static-inlining captured the flag at compile time. `useReducedMotion()` returns `false`, `useLowPower()` (placeholder) returns `false`.

1. Kari taps the Home FAB to land on the home tab.
   - System: `HomeScreen` renders, reads `phase === "during_shift"` + `activeTimeEntry`, and mounts `DuringShiftView` — which module-load resolved to `DuringShiftViewV2`.
   - Kari sees: SafeAreaView top bar (Menu · Smartout · Bell), ActionBar, then the warm radial-gradient hero filling the top of the phase-scroll.
2. Kari notices the hero breathing gently.
   - System: `breathScale` shared value runs `withTiming(1.04, { duration: 8000, easing: Easing.inOut(Easing.ease) })` with `withRepeat(-1, true)`. The `<Animated.View>` wrapping the gradient scales from 1.00 → 1.04 → 1.00 on an 8-second cycle.
   - Kari sees: the gradient surface expands + contracts by 4 % every 8 s — perceived as a slow breath under the timer, not a distraction.
3. Kari reads the live timer.
   - System: `setInterval(1000)` updates local `timer` state via `formatTimer(timeEntry.punch_in)`. The `<Text>` uses `fontFamily: "GeistMono-Regular"`, `fontSize: 52`, `fontVariant: ["tabular-nums"]`, `color: brandOrange`. No transform animation is applied to the `<Text>` — only the string content changes.
   - Kari sees: `02:14:33` counting in monospace without jitter between digits.
4. Kari glances at the stats row.
   - System: `StatTile` × 3 render "Tjent så langt" (live earnings via `estimateEarnings(220, punch_in)`), "Pause" (placeholder "0 min"), "Tillegg" ("—" + hint "Beregnes ved oppgjør").
   - Kari sees: three glassmorphism cards with mono labels + bold values. The first value reads e.g. `493 kr`; last two remain muted/grey.
5. Kari taps the circular "STEMPLE UT" CTA.
   - System: `Haptics.impactAsync(Heavy)` fires; router pushes `/(app)/(home)/punch-clock`. Pressed state collapses to `scale: 0.97, opacity: 0.9` (focus-ring equivalent).
   - Kari sees: haptic tick + punch-clock screen opens. (From here M2 recon-wizard takes over.)
6. Back on the home view, Kari taps "Ring leder" in the quick-action grid.
   - System: `Haptics.impactAsync(Medium)` → `Linking.openURL(tel:${leaderPhone})`. Leader phone was resolved via `useDutyLeader(departmentId, workspaceId)` on the parent screen.
   - Kari sees: iOS / Android dialer launches with the duty leader's number pre-filled.

**Postcondition:**
- v2 surface rendered with live timer, active breathe animation, and reachable quick actions.
- No new mutations emitted — v2 is read-only + navigation-only (consistent with ADR-0134: no new emit paths means no new telemetry contract to verify).
- `EXPO_PUBLIC_DURING_SHIFT_V2 === "true"` confirmed load-bearing — if the build had not baked the flag, legacy would have rendered instead.

**Error paths:**
- `activeTimeEntry` becomes null mid-render (rare, e.g. punch-out race) → parent `HomeScreen` swaps to `ActivityIndicator` + "Kobler til vaktdata…" copy. v2 unmounts cleanly; animations cancelled by reanimated on unmount.
- `leaderPhone` is null → "Ring leder" press is a no-op (guarded by `if (leaderPhone) Linking.openURL(…)`); no error surfaced (intentional — the button remains pressable as a haptic-only confirmation of intent).
- Hero gradient fails to render (`expo-linear-gradient` not available) → the surrounding `<View>` still shows timer + stats; gradient degrades to transparent. Not blocking.

### Reduced-motion variant

**Precondition:** identical to Journey 1 but `useReducedMotion()` returns `true` (OS accessibility setting on).

1. v2 mounts.
2. `useEffect` observes `shouldAnimate === false` (because `reduceMotion === true`), sets `breathScale.value = 1`, returns early without scheduling `withRepeat`.
3. Kari sees: hero is visually static — gradient frozen at its base position. Timer still ticks text. No motion anywhere on the hero.

**Postcondition:** Motion-spec M4 invariant "Reduced-motion fallback `{ scale: 1 }` static" holds in code.

### Low-power variant

**Precondition:** identical to Journey 1 but `useLowPower()` returns `true` (today: placeholder stub; future: `expo-battery` low-power-mode listener).

1. v2 mounts.
2. `shouldAnimate = !reduceMotion && !lowPower` → `false`.
3. Breathe loop is suppressed same as reduced-motion variant.
4. Kari sees: hero static even with reduced-motion OFF — device low-power budget is honored.

**Postcondition:** The hook contract is in place — swapping the placeholder for the real `Battery.getPowerStateAsync()` + `Battery.lowPowerModeChanged` listener is a no-op for this view.

---

## Journey 2: Leader on-shift with `EXPO_PUBLIC_DURING_SHIFT_V2` unset (regression path)

**Precondition:** Same as Journey 1 — Kari punched-in, `phase === "during_shift"`, `activeTimeEntry` non-null. Build was produced without `EXPO_PUBLIC_DURING_SHIFT_V2`, or with a value other than the literal string `"true"` (e.g. `"1"`, `"TRUE"`, `"yes"`). Expo's static-inlining captured the unset / non-matching value at compile time.

1. Kari lands on the home tab.
   - System: `shift-hub.tsx` module-load read `process.env.EXPO_PUBLIC_DURING_SHIFT_V2 === "true"` → `false`. `DuringShiftView` alias resolved to `DuringShiftViewV1` (the legacy component unchanged by M4).
   - Kari sees: the legacy DuringShiftView surface — `FadeIn`-animated "På vakt" hero, earnings card, live update card, task list with priority glow borders, 2×2 quick actions grid. Identical to pre-M4 behaviour.
2. Kari taps any element — behaviour unchanged.
   - System: no code path in v2 runs; no `lucide-react-native` import, no `expo-linear-gradient` LinearGradient, no reanimated `withRepeat` hero-breathe effect.
   - Kari sees: the app she used yesterday.

**Postcondition:**
- `DuringShiftViewV1` renders. `DuringShiftViewV2` is loaded into the JS bundle but never mounted (tree-shaking cannot remove it — the ternary resolves at module init, not build time — but the rendered tree is legacy-only).
- Zero regressions to the legacy path. Any bug report on the default build is not attributable to M4.

**Error paths:**
- Flag typo at build time (`EXPO_PUBLIC_DURING_SHIFT_V2="TRUE"` uppercase) → strict `=== "true"` check fails → legacy renders. Expected. Documentation explicitly states lowercase required.
- Flag stripped by a bundler config change → legacy renders. Safe default.

---

## Journey 3: Web recon UI + mobile home consume the same shared primitives (dual-platform parity smoke)

**Precondition:** `packages/ui/src/day-control/` has shipped `.tsx` + `.native.tsx` variants of PhaseBadge, TaskRow, KpiTile backed by `phase-styles.ts` (labels + tones + pulse flag) and `kpi-tile-shared.ts` (source suffix + delta glyph + delta tone). Admin loads `/dashboard/reconciliation` on web while Kari has the mobile home open on the same workspace.

1. Admin opens `/dashboard/reconciliation` in the browser.
   - System: Next.js / webpack picks `PhaseBadge.tsx`, `TaskRow.tsx`, `KpiTile.tsx` (the `.tsx` variants). Both consume `PHASE_STYLES` from `phase-styles.ts` and `SOURCE_SUFFIX` / `deltaGlyph` / `deltaTone` from `kpi-tile-shared.ts`.
   - Admin sees: a `PhaseBadge` pill labelled "PÅGÅR" with a pulsing success-tinted dot. A `KpiTile` row shows `↗ 12 %` in success green with sub-text "snapshot". A `TaskRow` shows an overdue task with a destructive left border.
2. Kari, on mobile, navigates to a day-control surface that embeds the same widgets (e.g. a task-heavy `BeforeShiftView` or a future mobile admin-preview).
   - System: Metro's default platform resolver picks `PhaseBadge.native.tsx`, `TaskRow.native.tsx`, `KpiTile.native.tsx`. These import the **same** `phase-styles.ts` + `kpi-tile-shared.ts` because those files have no `.native.ts` variant — they're pure TypeScript with no DOM / no RN surface.
   - Kari sees: a React-Native `<View>` pill labelled "PÅGÅR" (uppercased via `label.toUpperCase()` in the native variant), with a reanimated-pulse dot keyed off `PhaseStyle.pulse === true`. A `<View>`-based KPI tile shows `↗ 12 %` with identical arrow glyph and success colour. A `<View>` task row shows the overdue task with a destructive left border.
3. QA diffs the two surfaces visually.
   - Labels are identical strings: "Pågår", "Venter på oppgjør", "Starter snart", etc. (Native uppercases at render time; web uses CSS `uppercase`.)
   - Delta glyphs are identical Unicode characters: `↗`, `↘`, `·`.
   - Source suffixes are identical: `""`, `" · snapshot"`, `" · etter oppgjør"`.
   - Tones map to semantic keys (`success`, `warning`, `destructive`, `brandOrange`, `muted`) and resolve to hex via `nativeTheme` on mobile and via `var(--success)` etc. on web.

**Postcondition:**
- The shared `.ts` files are the single source of truth for labels + glyphs + tones — any future change to "Pågår" copy or the `↗` arrow lands in one place and both platforms pick it up automatically.
- ADR-0158 "Concrete plan step 3: logic primitives in shared files" is proven in a real surface, not just design.

**Error paths:**
- A contributor edits `PHASE_STYLES` in a `.native.tsx` file instead of the shared `.ts` → diverges from web. Caught by code review (the shared file is flagged as the SSoT in its header comment) and by a future lint rule (`no-platform-divergence-in-label-strings`).
- A new phase is added to `UiPhase` but not to `PHASE_STYLES` → `PhaseBadge` falls back to `PHASE_STYLES.upcoming` per the `??` guard. Both platforms degrade identically. Non-fatal.
- A future `.native.tsx` variant is added that has no web counterpart (mobile-only widget) → ADR-0158 permits this; the web build simply has no import path to it. No test breakage.

---

## Notes for the Journey Guardian

- M4 introduces **no new mutations** in any of the three journeys. The v2 surface is read-and-navigate only. Therefore ADR-0134 telemetry-contract checks are satisfied vacuously — there is no new `emit()` call site that needs `workspace_id` + `actor_id` resolution.
- Motion invariants are code-level invariants (scale values, durations, easing). Verify via targeted inspection of `DuringShiftView.v2.tsx` lines 134-144 (breathe loop) and `phase-styles.ts` (tone → pulse mapping). No E2E-style motion regression test exists for reanimated shared-values today; manual inspection on-device is the acceptance signal.
- Dual-platform parity in Journey 3 is the load-bearing check for ADR-0158 adoption. The three widgets are the first Smartout primitives to exercise the pattern — any wobble in the shared-logic file ergonomics surfaces here, not later.
