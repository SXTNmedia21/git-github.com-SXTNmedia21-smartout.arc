---
title: "packages/ui — Dual-Platform Consumption Strategy (web + mobile RN)"
id: ADR-0158
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0158: packages/ui — Dual-Platform Consumption Strategy (web + mobile RN)

**Status:** Proposed
**Date:** 2026-04-19
**Related:** ADR-0133 (Web Composes, Mobile Executes), ADR-0156 §8 (Day-Control Widget Placement Staging)

## Context and Problem Statement

ADR-0156 §8 locked a staged widget placement: Phase 1 in `apps/web/src/components/day/` with portability discipline, Phase 2 extract to `packages/ui/day-control/` when a second consumer (mobile) needs the same widgets. T4a landed 2026-05-15 — Phase 2 extraction complete; widgets live at `packages/ui/src/day-control/` and `apps/web` consumes them via `@smartout/ui`.

Mobile (`apps/mobile`) has never imported `@smartout/ui`. Zero precedent. No `.native.tsx` variants, no Metro resolver config, no RN-compatible substitutes for shadcn primitives used inside the package. Before mobile can reuse the day-control widgets (or anything else in `packages/ui`), the team needs a decision on:

1. **Resolution strategy** — platform-specific file exports (`.web.tsx` + `.native.tsx`) vs conditional imports vs separate entrypoints
2. **Shadcn primitive compatibility** — shadcn/ui wraps Radix primitives which are web-DOM-specific; mobile cannot consume `<Dialog>`, `<Popover>`, `<Button>` as-is
3. **Metro config** — Expo's Metro bundler needs explicit config to resolve `@smartout/ui` workspace package and correctly pick `.native` variants
4. **Portability fence hardening** — current ESLint rule only forbids `next/*` + `@smartout/supabase` imports in day-control widgets; mobile also needs "no `document` / `window` / HTMLElement" enforcement
5. **Styling translation** — widgets use Tailwind classes (`bg-card`, `var(--success)` CSS variables). React Native has no Tailwind + no CSS variables. Translation layer needed (NativeWind? manual? StyleSheet?).

## Decision Drivers

- ADR-0133: "web composes, mobile executes" — D6 execution verbs (shift witnessing, task toggle, signoff) are mobile-primary. Day-control widgets should be consumable by mobile for these flows.
- ADR-0156 §8 portability discipline: widgets already avoid `next/*` and direct Supabase — the expensive boundary already holds.
- Minimize cross-platform divergence: same contract, same visual, same events on both platforms.
- Avoid premature abstraction: the day-control widgets are the first candidate for dual-platform reuse; the decision should scale to other widget families but not over-engineer the first case.

## Considered Options

### Option A — Platform-specific file extensions (`.web.tsx` + `.native.tsx`)

Widgets ship both variants. Metro + webpack automatically pick per platform. Shared props, shared types, diverging internals.

**Pros:** Industry-standard RN monorepo pattern. Compiler + bundler level selection, no runtime cost. Clean separation.
**Cons:** Doubles maintenance per widget. Visual parity requires discipline. No single source of truth for component behavior.

### Option B — Conditional imports via `Platform.OS` runtime checks

Single file per widget. At render time, branches on `Platform.OS`. Shared internals.

**Pros:** Single source of truth. Easy to reason about.
**Cons:** Bundle bloat (web ships RN code and vice versa). `Platform` must be shimmed for web. Can't statically resolve RN-only imports.

### Option C — Headless/Primitive split

Extract pure logic/state hooks + typed data contracts to `packages/ui/day-control/` (works on both). Ship renderers separately: `packages/ui/day-control/web/` (existing) and `packages/ui-native/day-control/` (new package, RN).

**Pros:** Strictest platform isolation. Clear contract for each platform.
**Cons:** Two packages to maintain. Consumers must know which one to import. Risk of drift.

### Option D — NativeWind-based shared components

Use NativeWind so Tailwind classes compile to RN StyleSheet on mobile. Single component file for both platforms, same class strings, NativeWind handles translation. Custom shadcn-equivalent primitives via NativeWind.

**Pros:** Closest to "write once, run both". Preserves Tailwind DX. Same visual contract.
**Cons:** NativeWind is third-party dependency with churn risk. Subset of Tailwind features supported on RN. Custom CSS variables (`--dept-kitchen`) need translation or duplication.

## Decision Outcome

**Chosen option: A (platform extensions) with C (headless split) for pure-logic components.**

**Rationale:**
- Option A is the established RN monorepo pattern (Shopify, Expo official docs, Callstack). Predictable.
- Option B's bundle bloat and shim complexity are bigger costs than maintaining two implementations.
- Option D's NativeWind dependency is a bet on a rapidly-churning ecosystem; not a decision to lock in without more adoption signal.
- Option C is incrementally applicable to components that don't render DOM/native nodes (like `derivePhase` helpers, `resolveDeptKey`, status styling lookups). These go to `packages/ui/day-control/` as pure TS; RN renderers import the same logic.

### Concrete plan

1. **Repurpose current widgets as `.web.tsx`** (rename `PhaseBadge.tsx` → `PhaseBadge.web.tsx`). Minimal diff — only the file extension changes; all imports keep using `from "@smartout/ui"`, bundler resolves.
2. **Create `.native.tsx` siblings on-demand** as mobile consumers adopt each widget (not all 11 at once). First candidate: `PhaseBadge` (simplest: one pill, one dot, one label).
3. **Logic primitives in shared files** (no extension):
   - `types.ts` (already shared — pure TS)
   - `PHASE_STYLES` export from `PhaseBadge.*` → extract to `phase-styles.ts` so both `.web` and `.native` consume
   - Any future shared hooks (e.g. `usePhaseTransitionAnimation`) land here
4. **Metro config in `apps/mobile`**: add `@smartout/ui` to `watchFolders` + configure `resolver.sourceExts` to prefer `.native.tsx` over `.tsx`. Template config ships with this ADR.
5. **ESLint fence hardening**: widget files additionally forbid DOM-specific globals via `no-restricted-globals` (`document`, `window`) in existing `components/day/widgets/**` + `packages/ui/src/day-control/**` globs. `.web.tsx` files exempt (they ARE DOM-bound by design).
6. **Mobile-side styling**: `.native.tsx` variants use `StyleSheet.create` with values sourced from `packages/design-tokens/src/native.ts` (already shipping hex values from OKLCH tokens). No NativeWind dependency.
7. **Testing discipline**: each dual-platform widget ships a Vitest unit test for the pure logic + separate snapshot tests per platform file.

### Rejected

- Option B (conditional Platform.OS): bundle cost + shim complexity.
- Option D (NativeWind): premature third-party bet.
- "Extract everything to a new package": unnecessary; mixed `.web.tsx` + `.native.tsx` + shared-TS inside `packages/ui/src/day-control/` works for the foreseeable consumer count.

## Rules & Consequences enforced for Agents

- **Good, because** the established pattern scales — when a second widget family (e.g. `shift-clock/`, `deviation-flow/`) goes dual-platform, reuse the same sub-folder convention.
- **Good, because** `.web.tsx` + shared logic preserves the current Apps/web zero-regression path; mobile adoption is additive, not disruptive.
- **Good, because** the ESLint portability fence already covers half the discipline; the hardening (no DOM globals) is a one-line rule addition.
- **Bad, because** two files to maintain per visual component. Diverging visuals will bite if not caught by snapshot tests.
- **Bad, because** doesn't solve rich shadcn primitives (Dialog/Popover/Sheet) — those remain web-only until the team builds native-equivalent primitives separately (out of this ADR's scope).
- **Agent Impact:**
  - Build agents adding new `packages/ui` widgets must decide upfront: is this web-only or dual-platform? Web-only uses `.tsx`. Dual-platform uses `.web.tsx` + `.native.tsx` + extracted shared logic.
  - Reviewers reject PRs that import DOM-specific modules (`document`, Radix primitives) inside files without `.web` extension.
  - Mobile feature PRs that copy-paste logic from `@smartout/ui` widgets instead of reusing via `.native.tsx` extension are rejected — reuse is the point.

## Follow-up / tracked items

- Prototype: convert `PhaseBadge` to `.web.tsx` + `.native.tsx` pair (small, low-risk PoC). Validate Metro config works as expected.
- Full plan: when mobile picks up the first D6 execution verb that benefits from a shared widget, run the PoC migration for that specific widget only. Don't pre-emptively dual-platform all 11.
- ESLint `no-restricted-globals` rule addition in `packages/eslint-config/next.mjs` (or a new `packages/eslint-config/mobile.mjs` if mobile-specific).
- Decide whether shadcn primitives (Button, Dialog, Popover, Input used in day-control widgets) need `.native.tsx` siblings now or deferred until mobile needs a specific widget that uses them.

## References

- ADR-0133 — Web Composes, Mobile Executes
- ADR-0156 §8 — Day-Control Widget Placement Staging
- T4a completion (commit `881cb254`) — widgets extracted to `packages/ui/src/day-control/`
- T4b follow-up: `docs/followups/OVERVIEW-V2-DEBT-TICKETS.md`
- Metro documentation: https://docs.expo.dev/guides/customizing-metro/
- React Native platform-specific extensions: https://reactnative.dev/docs/platform-specific-code
