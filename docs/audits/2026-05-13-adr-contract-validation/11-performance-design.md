---
title: "Slice 11 — Performance & Design (ADR-0019)"
slice: 11
status: complete
created: 2026-05-13
updated: 2026-05-13
auditor: parallel-validator
scope: performance-governance, design-tokens, Nordic Split, Tailwind v4
---

# Slice 11 — Performance & Design

ADRs: 0019 (Performance & Build Governance).
Anchor: `docs/cross-cutting/performance-governance.md` (file MISSING from disk — see F-04).

## Method

Read web+landing `next.config.ts`, `apps/web/instrumentation.ts`, `apps/web/instrumentation-client.ts`, `globals.css`, `packages/design-tokens/src/tokens.css`, `apps/web/perf-budgets.json`, `apps/landing/perf-budgets.json`, `.github/workflows/ci.yml`. Greps for hardcoded zinc/slate/gray/neutral/stone color classes + `--webpack` flag remnants.

## Findings

### Baseline verifications (P1.5 wave 1 confirms)

| Check | State |
|---|---|
| `--webpack` flag absent from `dev`/`build` scripts | PASS — web `next dev -p 3060`, landing `next dev -p 3055`. No `--webpack` / `--turbopack` flag in either app. |
| Sentry moved to instrumentation.ts | PASS — `apps/web/instrumentation.ts` register() guards `NODE_ENV==="production"` + dispatches nodejs/edge `Sentry.init`; `instrumentation-client.ts` handles client init. |
| Source-map upload gated on VERCEL_ENV | PASS — `next.config.ts:199` `shouldUploadSourceMaps = process.env.VERCEL_ENV === "production"`; non-prod returns raw `nextConfig`. **Landing does NOT mirror this gate** — see F-02. |
| middleware.ts → proxy.ts | PASS — only `apps/web/src/proxy.ts` exists; no `middleware.ts` on disk anywhere in web app. |
| `tailwind.config.ts` absent (Tailwind v4 CSS-config) | PASS — no `tailwind.config.*` file anywhere in repo. `globals.css` uses `@import "tailwindcss"` + `@theme inline` + `@utility` directives. PostCSS config uses `@tailwindcss/postcss` plugin. |
| `next.config.ts` `typescript.ignoreBuildErrors` | PASS — explicitly `false` with ADR-0019 reference (SMA-353). |

### F-01 (HIGH) — `optimizePackageImports` desync between web and landing

`apps/web/next.config.ts:43-57` lists 14 packages (lucide-react, framer-motion, recharts, @dnd-kit/{core,sortable}, @smartout/ui, @smartout/types, @smartout/telemetry, date-fns, posthog-js, @tiptap/react, @tiptap/starter-kit, sonner). `apps/landing/next.config.ts:32` lists only 3 (`lucide-react, framer-motion, @radix-ui/react-icons`).

Landing imports `posthog-js`, `react-intersection-observer`, `framer-motion`, `tailwind-merge`, `lucide-react`, `@radix-ui/*`, `react-markdown`, `remark-gfm` (per `apps/landing/package.json`). At minimum `posthog-js` + `@radix-ui/react-*` (web has none of the per-component radix entries either — also a web miss for `@radix-ui/*`) should be in landing's list. ADR-0019 calls out "lazy-load heavy islands in shells" — `optimizePackageImports` is exactly the lever. Drift = silently larger landing bundle.

### F-02 (HIGH) — Landing Sentry source-map upload runs unconditionally on every build

`apps/landing/next.config.ts:89-93` wraps `withSentryConfig` at module-level with NO `VERCEL_ENV === "production"` gate. Every preview build + local build pays the 30-60s source-map upload tax. ADR-0019 §"Phased enforcement" + the 2026-04-29 P1.5 wave 1 gating only landed in web. **Direct parity fix:** mirror web's `shouldUploadSourceMaps` ternary.

### F-03 (MEDIUM) — Webpack alias block + Turbopack `resolveAlias` block duplicate; landing missing Turbopack section entirely

`apps/web/next.config.ts:67-82` has `turbopack.resolveAlias` (11 entries) AND `webpack:` callback at lines 95-157 (12 entries) — kept in sync manually. `apps/landing/next.config.ts:23` declares `turbopack: {}` but supplies NO `resolveAlias`, while lines 51-86 set 8 webpack aliases. If landing dev/build ever runs under Turbopack (Next 16 default in many paths), `@smartout/ai/*` subpath imports will fail to resolve. P1.5 wave-1 brief flagged this risk for web; landing was missed. Two journey-ops aliases on web (`runbook`, `agents/journey-ops`, `tools/journey-ops`) are NOT in landing — fine if landing doesn't use them, but webpack-only with no Turbopack twin is the broader issue.

### F-04 (MEDIUM) — Anchor doc `docs/cross-cutting/performance-governance.md` does not exist

`CLAUDE.md` claims path `docs/cross-cutting/performance-governance.md` ("Full performance governance"). ADR-0019 §Implementation Notes also cites it. `find docs/cross-cutting` returns nothing matching `*performance*`. Closest hit: `docs/architecture/PERFORMANCE_BUILD_GOVERNANCE.md` (ADR also references it). ADR's "Governance docs" bullet is **broken link**. Either the doc was deleted unrecorded, or never lifted from architecture/.

### F-05 (MEDIUM) — No `perf-budgets` CI job present

ADR-0019 §Implementation Notes mandates a CI job `perf-budgets` (warn-mode initially). `apps/web/perf-budgets.json` + `apps/landing/perf-budgets.json` exist and are well-formed, but `grep -rn perf-budgets .github/workflows/` returns ZERO matches. `ci.yml` has Lint, Type Check, Format Check, Vitest, **Build Health** (present — ADR-mandated), API Docs Guard, Harness Invariants, Migration jobs, Edge Functions deploy. No route-budget enforcement step. Either the job was never landed or was removed.

### F-06 (LOW) — Hardcoded color classes — 3 sites web, 26+ sites landing

Web: 1 `bg-neutral-500/20` + 4 `text-zinc-*` + 2 `border-zinc-200`. All in contract editor/preview (`contract-editor/document-outline.tsx`, `dashboard/contracts/_components/contract-{preview-editor,data-table}.tsx`). Plausibly intentional — printed/exported contract PDFs need fixed-paper colors regardless of dark/light theme. Worth annotating with a comment ("printed-output palette, not theme-bound") rather than fixing.

Landing: 26 `bg-zinc-*` + ~286 `text-{zinc,slate,gray,neutral,stone}-*` matches; `feature/*`, `om-oss`, `VoiceDemoWidget.tsx`. Landing's "Nordic Split" adoption is incomplete. ADR-0019 doesn't directly speak to colors but `smartout-nordic-split` skill mandates CSS vars. Out-of-slice but recorded.

`bg-white` / `text-white` = 516 hits — many legitimate (overlays, fixed-contrast badges) — not flagged.

### F-07 (LOW) — Landing missing `serverExternalPackages`

Web sets `serverExternalPackages: ["posthog-node", "livekit-client"]` (line 66). Landing imports `posthog-js` (browser) — likely OK — but missing `serverExternalPackages` declaration entirely. If landing ever uses `@smartout/telemetry` server-side (already in `transpilePackages`), `posthog-node` dynamic-imports will silently bundle into SSR.

## Counts

- **HIGH:** 2 (F-01 optimizePackageImports drift, F-02 landing source-map gate missing)
- **MEDIUM:** 3 (F-03 Turbopack alias drift, F-04 missing anchor doc, F-05 missing perf-budgets CI job)
- **LOW:** 2 (F-06 hardcoded colors, F-07 landing serverExternalPackages)
- **PASS:** 6 baseline P1.5-wave-1 verifications

## Top 3 critical one-liners

1. **F-02** — `apps/landing/next.config.ts:89` runs `withSentryConfig` unconditionally; web gates on `VERCEL_ENV==="production"` (web `next.config.ts:199`). Landing pays 30-60s source-map upload on every preview + local build. Direct parity fix.
2. **F-05** — ADR-0019 §Implementation Notes mandates a `perf-budgets` CI job; `apps/{web,landing}/perf-budgets.json` exist + well-formed, but ZERO references in `.github/workflows/*.yml`. Route-budget enforcement is absent — budgets are dead config.
3. **F-03** — `apps/landing/next.config.ts:23` has `turbopack: {}` with NO `resolveAlias` while 8 webpack aliases for `@smartout/ai/*` subpath imports are set. If Next 16 default-switches landing to Turbopack, AI subpath resolution breaks. Mirror web `next.config.ts:67-82`.
