---
title: "Plan — pwa-telemetry-build"
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [plan, pwa, build, vercel, telemetry]
---

# Plan — pwa-telemetry-build

> Branch: `feat/pwa-telemetry-build` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: mobile | Started: 2026-05-04

## Goal

Fix Vercel smartout-pwa Metro bundler failure caused by `@smartout/telemetry/dist/index.js` not existing on fresh Vercel checkout.

## Root Cause (Confirmed)

Vercel project `smartout-pwa` config:
- `rootDirectory: apps/mobile`
- `buildCommand: pnpm build:web`
- `outputDirectory: dist`

`apps/mobile/package.json` `build:web` script was `expo export --platform web && bash scripts/inject-pwa-meta.sh` — a raw pnpm script with no turbo invocation.

On Vercel's fresh checkout `pnpm install --frozen-lockfile` runs, which does NOT build workspace packages. Only packages that ship `src/` as `main` work immediately. Three packages that mobile depends on have `main: dist/index.js` and require an explicit build step:
- `@smartout/telemetry` — build: `npx tsc && node scripts/fix-esm-imports.mjs`
- `@smartout/types` — build: `npx tsc && node scripts/fix-esm-imports.mjs`
- `@smartout/utils` — build: `npx tsc && node scripts/fix-esm-imports.mjs`

By contrast, web/landing use `pnpm turbo build` (not `pnpm build:web`), which invokes turbo's `build` task that has `dependsOn: ["^build"]` — so upstream packages are built first.

## Hypothesis Verification

1. Vercel API confirmed `buildCommand: pnpm build:web` — no turbo involved
2. `packages/telemetry/dist/` did not exist in worktree after fresh `pnpm install --frozen-lockfile`
3. `pnpm --filter @smartout/mobile build:web` (old script) would reproduce the failure on any machine without pre-built dists
4. Web/landing both use the turbo `build` task with `dependsOn` — they build deps first

## Fix Candidates Evaluated

**Fix A** — Add `build:web` task to `turbo.json` + change Vercel `buildCommand` to `pnpm turbo build:web --filter=@smartout/mobile`
- Pro: cleanest turbo integration
- Con: **requires Vercel dashboard change** (operator action)

**Fix B** — Manually list deps in `build:web` script: `pnpm --filter @smartout/telemetry... build && expo export ...`
- Pro: no Vercel config change
- Con: brittle — must be manually updated when new `dist`-based packages are added; already 3 packages, likely to grow

**Fix C** — `turbo build --filter=@smartout/mobile^... && expo export --platform web && bash scripts/inject-pwa-meta.sh`
- Pro: turbo handles full upstream dep graph automatically; no Vercel config change; future-proof; aligns with monorepo convention
- Con: none
- **CHOSEN**

## Fix Applied

Changed `apps/mobile/package.json` `build:web` script:

```diff
- "build:web": "expo export --platform web && bash scripts/inject-pwa-meta.sh",
+ "build:web": "turbo build --filter=@smartout/mobile^... && expo export --platform web && bash scripts/inject-pwa-meta.sh",
```

`turbo build --filter=@smartout/mobile^...` builds all upstream workspace dependencies of `@smartout/mobile` (the `^...` syntax = all transitive deps but NOT `@smartout/mobile` itself). Turbo uses the `build` task's `dependsOn: ["^build"]` graph to order correctly.

## Local Verification Results

- `pnpm --filter @smartout/mobile build:web` → **EXIT 0** (turbo 4 tasks, expo bundled 6449 modules, `dist/` created)
- `pnpm --filter web build` → pre-existing failure (missing `@smartout/ai/dist`) — NOT caused by this fix (verified by stash test)
- `pnpm --filter landing build` → pre-existing failure (same root) — NOT caused by this fix (verified by stash test)

## Acceptance Criteria

- [x] PWA build succeeds locally with clean dist state
- [x] No regression introduced (web/landing failures pre-exist, not caused here)
- [x] Vercel does not require dashboard config change
- [x] Decision log updated
- [x] User journeys written
- [x] Handoff written

## Follow-ups (Out of Scope)

- `@smartout/ai/dist` missing: web and landing builds both fail locally due to missing `@smartout/ai` dist. This is a pre-existing issue on the development branch. Separate sortie required.
- Vercel Turbo Remote Cache: enabling remote cache for the Vercel `smartout-pwa` project would make turbo `^build` steps instant on re-deploys.
