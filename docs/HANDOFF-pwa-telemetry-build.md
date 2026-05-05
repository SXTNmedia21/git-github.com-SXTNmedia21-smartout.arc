---
title: "Handoff — pwa-telemetry-build"
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [handoff, pwa, build, vercel, mobile]
---

# Handoff — pwa-telemetry-build

## Summary

Fixed Vercel `smartout-pwa` Metro bundler failure. Root cause: `pnpm build:web` was a raw pnpm script that bypassed turbo's dep graph, so `@smartout/telemetry/dist/index.js` (and `@smartout/types`, `@smartout/utils`) never got built on Vercel's fresh checkout. One-line fix to `apps/mobile/package.json`.

**One file changed:** `apps/mobile/package.json` — `build:web` script.

---

## What Was Built

Changed `apps/mobile/package.json`:

```diff
- "build:web": "expo export --platform web && bash scripts/inject-pwa-meta.sh",
+ "build:web": "turbo build --filter=@smartout/mobile^... && expo export --platform web && bash scripts/inject-pwa-meta.sh",
```

The `turbo build --filter=@smartout/mobile^...` prefix instructs turbo to build all upstream workspace dependencies of `@smartout/mobile` before expo runs. The `^` means "exclude the package itself", `...` means "all transitive dependencies". Turbo handles ordering via the `build.dependsOn: ["^build"]` graph in `turbo.json`.

---

## Decisions Made

No new ADR was required. This is a script fix, not an architectural decision. The turbo filter syntax is documented monorepo convention — consistent with how `pnpm turbo build` works at the root.

---

## Learnings

**Vercel buildCommand bypasses turbo.** When Vercel is configured with `buildCommand: pnpm build:web` and `rootDirectory: apps/mobile`, Vercel runs that command directly. It does NOT use `turbo run build:web` — there is no `build:web` task in `turbo.json`. This means `dependsOn: ["^build"]` is never consulted. Any workspace package with `main: dist/index.js` must have its `dist/` built by the script itself.

**Install does not build.** `pnpm install --frozen-lockfile` installs package files but does NOT run `build` scripts. Packages with `main: src/index.ts` work immediately. Packages with `main: dist/index.js` need an explicit build step.

**Three packages currently need pre-building for mobile:**
- `@smartout/telemetry` — `main: dist/index.js`, `build: npx tsc && ...`
- `@smartout/types` — `main: dist/index.js`, `build: npx tsc && ...`
- `@smartout/utils` — `main: dist/index.js`, `build: npx tsc && ...`

**Fix C > Fix B.** A manual `pnpm --filter @smartout/telemetry... build` approach would need updating every time a new dist-based package is added. `turbo build --filter=@smartout/mobile^...` is self-maintaining.

**Web + landing already fail locally.** Both `pnpm --filter web build` and `pnpm --filter landing build` fail on this branch with `Module not found: Can't resolve '@smartout/ai'`. This is a pre-existing condition on the development branch — `packages/ai/dist/` is missing. Verified by stash test (failure existed before my change). Not in scope for this sortie.

---

## Known Issues / Debt

1. **`@smartout/ai/dist` missing on development branch.** Web and landing builds fail locally (and presumably on Vercel if triggered without pre-built ai dist). Needs a separate sortie to investigate — likely same pattern: something changed in ai package requiring dist build but CI/Vercel config not updated.

2. **No Vercel Remote Cache for smartout-pwa.** Every Vercel deploy rebuilds turbo deps from scratch. Enabling remote cache would make repeat deploys much faster. Low priority until deploy frequency increases.

3. **`turbo.json` has no `build:web` task.** This works fine (turbo runs the underlying pnpm script), but adding a `build:web` task with proper `inputs`/`outputs` would enable turbo caching for the expo export step too. Deferred — not needed for correctness.

---

## Next Steps

1. Pontus reviews and merges `feat/pwa-telemetry-build` → `development`
2. Trigger a Vercel deploy on `smartout-pwa` with a `[deploy]` tag commit to verify in CI
3. Separate sortie: investigate `@smartout/ai/dist` missing — fix web/landing local builds
