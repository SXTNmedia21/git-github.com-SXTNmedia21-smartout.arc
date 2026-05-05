---
title: "Journey — pwa-telemetry-build"
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [journey, pwa, build, vercel, mobile]
---

# Journey — pwa-telemetry-build

## Journey: Developer deploys PWA to Vercel (post-fix)

**Precondition:** Code pushed to `feat/pwa-telemetry-build` (or merged to development). Vercel `smartout-pwa` project has `buildCommand: pnpm build:web`, `rootDirectory: apps/mobile`.

1. Developer pushes a commit tagged `[deploy]` → Vercel triggers build for `smartout-pwa`
2. Vercel runs `pnpm install --frozen-lockfile` in the repo root → workspace packages installed but NOT built
3. Vercel changes to `apps/mobile` (rootDirectory) and runs `pnpm build:web`
4. `build:web` now starts with `turbo build --filter=@smartout/mobile^...` → turbo resolves the full upstream dep graph (`@smartout/telemetry`, `@smartout/types`, `@smartout/utils`, and any future dist-based packages) and builds each in dependency order
5. All `dist/` directories are populated by turbo
6. `expo export --platform web` runs → Metro resolves `@smartout/telemetry` successfully (dist exists)
7. Metro bundles all modules → `dist/` output created
8. `bash scripts/inject-pwa-meta.sh` runs → PWA meta tags injected into `dist/index.html`
9. Vercel deploys the `dist/` directory as a static site

**Postcondition:** Vercel deployment succeeds. PWA is live with all workspace packages resolved.

**Error paths:**
- If a new workspace package is added with `main: dist/index.js` and a `build` script, it is automatically included in turbo's `^build` graph — no manual update needed.
- If turbo build fails for any upstream package, the error is surfaced before expo runs — clear failure attribution.

---

## Journey: Developer reproduced failure pre-fix (for understanding)

**Precondition:** Fresh git checkout, no pre-built dists.

1. Developer runs `pnpm install --frozen-lockfile` → workspace packages installed, no dist
2. Developer runs `pnpm --filter @smartout/mobile build:web` (old script: `expo export --platform web && ...`)
3. Metro starts bundling → encounters `import ... from '@smartout/telemetry'`
4. Metro resolves the package.json → finds `"main": "dist/index.js"` → looks for `dist/index.js`
5. `dist/index.js` does not exist → Metro throws `ELIFECYCLE Command failed with exit code 1`
6. Build log: `Error: While trying to resolve module @smartout/telemetry ... package successfully found. However, this package itself specifies a main module field that could not be resolved`

**Postcondition:** Build fails. Vercel deploy fails.

---

## Journey: Developer adds a new dist-based workspace package (future-proofing)

**Precondition:** Developer creates `packages/new-lib/package.json` with `"main": "dist/index.js"` and `"build": "npx tsc"`. Mobile `package.json` adds `"@smartout/new-lib": "workspace:*"`.

1. Developer adds the package dependency to mobile
2. Turbo workspace graph automatically includes `@smartout/new-lib` as an upstream dep of `@smartout/mobile`
3. On next Vercel deploy, `turbo build --filter=@smartout/mobile^...` picks up `@smartout/new-lib` and builds it
4. No changes needed to `build:web` script

**Postcondition:** New package works on Vercel without manual script updates.
