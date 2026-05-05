---
title: HANDOFF — fix-mobile-landing-build
status: done
updated: 2026-04-30
created: 2026-04-30
module: tooling
tags: [build, expo, turbo, dx, handoff]
---

# HANDOFF — fix-mobile-landing-build

## Summary

User reported mobile + landing "not building." Investigation found **no
compile bug in either app.** Both pass typecheck (0 errors), lint (0 errors),
and Turbo build with current code on `development @ 929644d3b`. The reported
failure modes were two infrastructure gotchas:

1. **Landing direct invocation skips Turbo `^build`.** `pnpm --filter landing
   build` runs `next build` without first building workspace deps.
   `@smartout/ai` exports point at `dist/`, which only exists after Turbo
   builds it. Symptom: `Module not found: Can't resolve '@smartout/ai/agents/docs'`.

2. **Stale Metro process holds Expo port.** Earlier session left `node` PID
   bound to `:8082`. Fresh `expo start` in non-interactive shell prompts
   `Use port 8083 instead?`, gets no input, exits silently with
   `› Skipping dev server`.

Sortie ships docs + a `start:clean` wrapper to make the right path discoverable.

## What was built

| File | Change |
|---|---|
| `apps/mobile/scripts/start-clean.sh` | New. Frees `:8082` (or `$EXPO_PORT`) before `npx expo start`. |
| `apps/mobile/package.json` | Added `"start:clean": "bash scripts/start-clean.sh"`. |
| `apps/mobile/README.md` | New. Explains `start:clean`, build via Turbo, ADR pointers. |
| `apps/landing/README.md` | Replaced stock Next boilerplate with Smartout-specific build instructions. |
| `docs/journeys/JOURNEY-fix-mobile-landing-build.md` | Three journeys: landing build, mobile dev start, mobile CI typecheck. |

## Decisions

None — no architectural change. Documentation + wrapper script only.
No ADR created.

## Learnings

1. **Direct `pnpm --filter <app> build` is not equivalent to `pnpm turbo run
   build --filter=<app>`.** First skips `^build`; second respects it.
   The trap is invisible until a workspace dep actually has unbuilt
   `dist/`-referenced exports — most workspaces don't, so the failure
   surfaces only on landing today (because of `@smartout/ai/agents/docs` +
   `@smartout/ai/missions`).
2. **Expo CLI in non-interactive shells exits silently on port collision.**
   `npx expo start` prompts for port-swap when busy, no `--yes`-style flag
   exists for `--port` retry. Killing the holder pre-spawn is the only
   reliable fix.
3. **Mobile typecheck via raw `tsc --noEmit` works without Turbo** because
   `@smartout/supabase` ships raw `.ts` and most other deps have cached
   `dist/`. Don't trust this — always go via Turbo for parity with CI.
4. **`pnpm-lock.yaml` may regenerate on `pnpm install` in a fresh worktree**
   even when no manifest changed. Lockfile diff in this sortie is from
   peer-dep resolution touching whitespace, not new packages.

## Known issues / debt

- `apps/landing/src/app/api/wizard/start/route.ts` and
  `apps/landing/src/app/api/docs-agent/route.ts` import from `@smartout/ai`
  via subpath exports that REQUIRE `dist/` to exist. Consider adding a
  `predev`/`prebuild` script in landing that runs
  `pnpm -w turbo run build --filter=@smartout/ai`, OR switch landing to
  source-relative imports if perf permits.
- 107 lint warnings remain in `apps/mobile/src/lib/{push,supabase,sync}.ts`
  for ADR-0091 direct-write violations. Pre-existing. Out of scope.
- Mobile `package.json` does not declare a Turbo-aware `build` script.
  CI already uses `pnpm turbo run typecheck` so no immediate gap, but
  worth adding for symmetry.

## Next steps

1. Merge sortie via `close-feature.sh 5`.
2. Optional follow-up: add `predev` to `apps/landing/package.json` so first
   developer setup doesn't need to learn the Turbo lesson the hard way.
3. Optional: similar wrapper for landing if port `:3055` collisions become
   common.

## Verification

- `pnpm turbo run build --filter=landing` → 7 tasks successful, exit 0
- `pnpm turbo run typecheck --filter=@smartout/mobile --filter=landing` → 8 tasks successful, exit 0
- `pnpm --filter @smartout/mobile lint` → 0 errors, 107 warnings (pre-existing)
- `pnpm --filter @smartout/mobile typecheck` → exit 0
- Metro smoke-test: `start:clean` brought up `http://localhost:8082/status`
  returning `packager-status:running` after killing stale PID 56623.
