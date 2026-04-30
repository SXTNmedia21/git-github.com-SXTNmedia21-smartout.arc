---
title: JOURNEY — Fix mobile + landing build invocation
feature: fix-mobile-landing-build
status: verified
verified_at: 2026-04-30
updated: 2026-04-30
created: 2026-04-30
module: tooling
tags: [build, expo, turbo, dx]
---

# JOURNEY — Fix mobile + landing build invocation

Two false-positive "build broken" reports — neither app had a compile bug.
Symptoms came from invocation patterns that bypass Turbo's `^build` chain
or collide with stale Metro processes. This sortie documents the correct
invocations and adds a `start:clean` wrapper for Expo.

## Journey: Developer builds landing locally

**Precondition:** clean checkout, `pnpm install` complete, `@smartout/ai`
not yet built (no `dist/`).

1. Developer runs `pnpm --filter landing build` →
   System runs `next build` directly without building workspace deps →
   Developer sees `Module not found: Can't resolve '@smartout/ai/agents/docs'`.
2. Developer reads `apps/landing/README.md` →
   Sees note pointing at `pnpm turbo run build --filter=landing` →
   Re-runs with Turbo →
   System builds `@smartout/types`, `@smartout/telemetry`, `@smartout/supabase`,
   `@smartout/utils`, `@smartout/ai` first, then `landing` →
   Build succeeds.

**Postcondition:** `apps/landing/.next/` populated, build exit 0.

**Error paths:**
- Workspace dep build fails → Turbo aborts before landing → error surfaces in
  the failing dep's logs, not landing's.
- `node_modules` stale → run `pnpm install` from repo root.

## Journey: Developer starts mobile dev server

**Precondition:** Expo SDK 55 installed, no Metro currently bound to `:8082`.

1. Developer runs `pnpm start:clean` (in `apps/mobile/`) →
   Wrapper script greps `ss -tlnp` for `:8082` →
   No PIDs found, skips kill →
   Spawns `npx expo start --port 8082` →
   Metro binds, HTTP 200 on `http://localhost:8082/status`.
2. Developer scans QR with Expo Go → app loads.

**Postcondition:** Metro `packager-status:running`, app reachable from device.

**Error paths:**
- Stale Metro from prior session holds `:8082` → wrapper detects PID, sends
  `kill -9`, waits 1s, then starts fresh Metro.
- Expo non-interactive shell + busy port → without wrapper, Expo prompts for
  port-swap input, gets none, exits silently with `› Skipping dev server`.
  Wrapper prevents this by freeing port pre-spawn.
- Different port needed → `EXPO_PORT=8090 pnpm start:clean`.

## Journey: Developer typechecks mobile in CI

**Precondition:** CI runner with `pnpm install` complete.

1. CI runs `pnpm turbo run typecheck --filter=@smartout/mobile` →
   Turbo resolves `^build` deps (`types`, `telemetry`, `supabase`, `utils`) →
   Builds them →
   Runs `tsc --noEmit` on mobile →
   Exit 0, 0 errors.

**Postcondition:** Mobile typecheck green, cacheable.

**Error paths:**
- Direct `pnpm --filter @smartout/mobile typecheck` works because mobile
  imports raw `.ts` from `@smartout/supabase` (which has a no-op build) and
  `@smartout/utils` (whose `dist/` is checked into Turbo cache). Turbo path
  is preferred for consistency with CI.
