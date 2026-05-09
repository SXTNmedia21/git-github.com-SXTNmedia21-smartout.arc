---
title: "useShiftLifecycle Platform-Neutral Contract"
id: ADR-0108
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: schedule
tags: [adr, hooks, mobile-parity, cascade, shift, lifecycle, platform-neutral]
---

# ADR-0108: useShiftLifecycle Platform-Neutral Contract

**Status:** Accepted
**Date:** 2026-04-15
**Council:** 2026-04-15 Council 6.4 (supervisor audit of Phase 6 shift-timeline UI)

## Context and Problem Statement

`useShiftLifecycle` (ADR-0095 Phase 5) was introduced as the "cross-platform read hook" over `v_shift_lifecycle` and exported from `packages/schedule` with a comment claiming it was platform-agnostic and safe to import from `apps/mobile`.

Supervisor audit on 2026-04-15 found the hook was not, in fact, platform-neutral:

- File begins with the `"use client"` directive, which is a Next.js-only compile marker and is rejected by Metro / RN bundlers.
- Hook body calls `createClient()` from `@smartout/supabase/client`, whose implementation imports `createBrowserClient` from `@supabase/ssr`, reads `window.location.hostname`, and reads `process.env.NEXT_PUBLIC_ROOT_DOMAIN`.
- Any import of the hook from React Native therefore pulls in browser-only APIs at module-evaluation time and crashes the bundle.

This directly violates the Mobile Parity rule in `CLAUDE.md` ("shared logic goes in `packages/`, not `apps/web/`") and makes ADR-0095's mobile promise unfulfillable without a refactor.

## Decision Drivers

- **Mobile Parity (CLAUDE.md):** shared data hooks must work on both web and RN without per-platform forks.
- **Dependency inversion:** hooks should accept platform-specific I/O, not construct it.
- **Provenance (ADR-0095 spirit):** the `v_shift_lifecycle` read must remain a single shared implementation so web and mobile converge on the same `phase` semantics.
- **Minimal disruption:** existing web call sites (`EmployeeShiftTimeline`, `AdminShiftTimeline` on `feat/shift-timeline-ui`) should need at most a one-line change.
- **Regression safety:** once the hook is purified, nothing should silently re-add a browser coupling on a future commit.

## Considered Options

- **(A) Leave the hook as-is and document "do not import from mobile".** Rejected — violates Mobile Parity and keeps a time bomb in the shared package.
- **(B) Split the hook into `useShiftLifecycle.web.ts` / `useShiftLifecycle.native.ts` with Metro platform extensions.** Rejected — duplicates logic, drifts over time, and hides the coupling rather than removing it.
- **(C) Dependency injection: hook accepts a `SupabaseClient` via options, web provides a thin wrapper.** Chosen.

## Decision Outcome

Chosen option: **(C) Dependency injection with a web wrapper.**

### Contract

1. `useShiftLifecycle(shiftId, { supabase, ...opts })` — `supabase: SupabaseClient` is a required option.
2. The base hook file in `packages/schedule/src/hooks/useShiftLifecycle.ts` **must not** contain:
   - a `"use client"` directive
   - imports or references to `createBrowserClient`, `@smartout/supabase/client`, `@smartout/supabase/server`, `@smartout/supabase/admin`
   - references to `window`, `document`, or `process.env`
3. Types (`ShiftLifecycleRow`, `ShiftLifecyclePhase`, `UseShiftLifecycleOptions`) and the query-key factory (`shiftLifecycleQueryKey`) are re-exported from `@smartout/schedule` so both web and mobile share invalidation semantics.
4. Web consumers import from `apps/web/src/hooks/useShiftLifecycle.ts`. That file is `"use client"`, memoizes a browser Supabase client via `useMemo`, and forwards to the base hook. Its options type is `Omit<BaseOptions, "supabase">` — callers retain the pre-refactor ergonomics.
5. Mobile consumers (`apps/mobile`) inject their RN-specific Supabase client directly into the base hook. A dedicated mobile wrapper may be added when the timeline ships on mobile; it is out of scope for this ADR.
6. A source-level regression test in `packages/schedule/src/hooks/__tests__/useShiftLifecycle.test.ts` reads the hook file and asserts it contains none of the forbidden strings. This makes regressions fail CI rather than shipping.

### Agent impact

- **All future cross-platform hooks** in `packages/*` follow this contract: accept platform I/O via parameters (or a neutral context), never construct it inline, never use `"use client"` in the shared package.
- **Supervisor pass:** any PR adding `"use client"`, `window.*`, `document.*`, `process.env.*`, or `createBrowserClient` to a file under `packages/*/src/hooks/` is rejected.
- **New hook checklist:** (1) types-only imports are safe cross-platform, (2) runtime imports must be `@tanstack/*`, `@supabase/supabase-js` types, `zod`, or similarly neutral, (3) a web wrapper in `apps/web/src/hooks/` injects the browser client, (4) mobile wrapper (when built) lives under `apps/mobile/`.

## Rules & Consequences enforced for Agents

- **Good, because** it unlocks mobile consumption of `v_shift_lifecycle` with zero logic duplication, preserves ADR-0095's single-source-of-truth intent, and the source-inspection test prevents silent regressions.
- **Good, because** the web wrapper API is a strict narrowing of the previous signature — migration is a one-line import path change or (if the component already received Supabase via prop) a direct pass-through.
- **Bad, because** this adds one extra file per platform consumer. The cost is small relative to the mobile-parity violation being closed.
- **Agent Impact:** When creating a new hook in `packages/*` that touches Supabase, start with dependency injection. Do not add `"use client"` in `packages/*`. When touching `useShiftLifecycle`, treat the source-inspection test as a hard gate.

## References

- ADR-0095 — Shift Lifecycle Five-Layer Architecture
- ADR-0056 — Cascade produces, Event Engine consumes
- `CLAUDE.md` — Mobile Parity rule
- Council 6.4 notes, 2026-04-15 (supervisor audit)
