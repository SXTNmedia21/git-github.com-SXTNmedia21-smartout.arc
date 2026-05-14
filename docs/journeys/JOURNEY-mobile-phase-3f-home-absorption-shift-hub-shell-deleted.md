---
title: "Journey — (home)/shift-hub.tsx shell deleted; component-folder views retained"
feature: mobile-phase-3f-home-absorption
journey: shift-hub-shell-deleted
status: verified
verified_at: 2026-05-14
verified_by: Council G2 verdict — A2 code-trace confirmed 0 inbound router.push; component folder src/components/home/ survives
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, cleanup, council-g2, l-0251]
---

# Journey: `(home)/shift-hub.tsx` shell deleted; component-folder views retained

**Role:** developer (this is a developer-facing cleanup journey)

**Precondition:**
- Council G2 verified `apps/mobile/app/(app)/(home)/shift-hub.tsx` has zero inbound `router.push` consumers in this worktree
- Component folder `apps/mobile/src/components/home/` (8 view components) survives independently because `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:36,254` consumes `AfterShiftView` from outside the (home) route group
- L-0251 captured: component-folder location aligns with route-folder during moves; rename of `components/home/` deferred to 3f.4

## Happy Path

1. Developer runs `git show <feat-tip>:apps/mobile/app/(app)/(home)/shift-hub.tsx` → command fails with "fatal: path 'shift-hub.tsx' does not exist" — file deleted
2. Developer runs `pnpm --filter @smartout/mobile typecheck` → 0 errors
3. Developer reads `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:36,254` → still imports `AfterShiftView` from `@/components/home/AfterShiftView`. Import resolves; component folder retained
4. Developer verifies `(home)/_layout.tsx` still registers `<Stack.Screen name="shift-hub" />` (no harm — Expo Router tolerates registered-but-missing route until folder delete in 3f.4)

**Postcondition:**
- `(home)/shift-hub.tsx` absent on feat branch tip
- `apps/mobile/src/components/home/` retained with all 8 view components
- `ShiftClockView.tsx` import path unchanged
- No broken imports anywhere in `apps/mobile/` or `packages/`
- Typecheck green

## Error Paths

- **Scenario:** Developer accidentally deletes `apps/mobile/src/components/home/` thinking it's the same as the route folder → Restore from git. L-0251 documents the distinction.
- **Scenario:** `_layout.tsx:23` Stack.Screen registration for `shift-hub` causes Expo Router runtime warning → Tolerated until 3f.4 final cleanup. Warning is non-blocking.
- **Scenario:** Hidden inbound `router.push("/(app)/(home)/shift-hub")` found post-merge (audit miss) → Audit doc updated; 3f.2 retargets to canonical location.

## Verification

- [x] `apps/mobile/app/(app)/(home)/shift-hub.tsx` confirmed deleted
- [x] `apps/mobile/src/components/home/` confirmed present + all 8 components intact
- [x] `ShiftClockView.tsx:36` import resolves
- [x] `pnpm --filter @smartout/mobile typecheck` 0 errors
- [x] Council G2 verdict referenced
- [x] L-0251 created + registered in learning log

**Status flipped to verified 2026-05-14 — all six verification boxes checked.**
