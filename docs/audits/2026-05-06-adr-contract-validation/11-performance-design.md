---
title: "Audit Slice 11 — Performance & Design Governance"
status: done
updated: 2026-05-06
created: 2026-05-06
module: performance-design
tags: [audit, adr-0019, performance, design-tokens, nordic-split, turbopack]
---

# Slice 11 — Performance & Design Governance

**ADR:** ADR-0019 (Performance and Build Governance System)  
**Anchor:** `docs/cross-cutting/performance-governance.md` (FILE MISSING — see finding #1)  
**Surfaces:** `apps/web/next.config.ts`, `packages/design-tokens/`, `apps/web/src/app/globals.css`  
**Date:** 2026-05-06

---

## Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | HIGH | `perf:audit` script exists but is never wired into CI — ADR-0019's `perf-budgets` CI job is missing |
| 2 | HIGH | `typescript.ignoreBuildErrors: true` is active in `next.config.ts` with no expiry gate |
| 3 | HIGH | 373 `orange-*` Tailwind palette classes in `apps/web/src/app/` bypass the `--brand-orange` CSS variable token |
| 4 | MEDIUM | Turbopack `resolveAlias` and webpack `config.resolve.alias` have a semantic mismatch on the root `@smartout/ai` key |
| 5 | MEDIUM | `docs/cross-cutting/performance-governance.md` is referenced in ADR-0019 but does not exist on disk |
| 6 | MEDIUM | `globals.css` contains 5 hardcoded `rgba()` values that should reference CSS custom properties |
| 7 | LOW | Komm semantic tokens (23 variables) have no dark-mode overrides in `tokens.css` `.dark` block |
| 8 | LOW | `autofill-shimmer` animation keyframe in `globals.css` uses `rgba(245, 158, 11, ...)` — Tailwind amber literal, not a CSS variable |

---

## Delta from 2026-05-02 Baseline

| Area | Baseline | Now | Change |
|------|----------|-----|--------|
| Turbopack alias block | Missing entirely | Present (12 aliases) | IMPROVED — block exists but root key semantic mismatch persists |
| `--webpack` flag in dev script | Dropped (Wave 1) | Absent | RESOLVED per baseline note |
| Sentry rewrite | Fixed Wave 1 | Correct (`VERCEL_ENV === "production"`) | RESOLVED |
| zinc/gray Tailwind classes | 140-file debt reported | 0 active `zinc-*`/`gray-*` in `apps/web/src/app/` | RESOLVED |
| `orange-*` classes | Not tracked | 373 instances | NEW FINDING |
| `perf-budgets` CI job | Absent | Still absent | UNCHANGED — BLOCKER |

---

## Findings

### F-11-01 — HIGH: `perf:audit` script decoupled from CI

**File:** `.github/workflows/ci.yml`  
**ADR contract:** ADR-0019 §Implementation — CI job `perf-budgets` (warn mode initially), `PERF_ENFORCEMENT=warn|fail`

`package.json` defines `perf:audit:web` and `perf:audit:landing` scripts, and both `apps/web/perf-budgets.json` and `apps/landing/perf-budgets.json` exist. However, a grep across all 9 workflow files finds zero calls to `perf:audit`, `perf-budgets`, or `PERF_ENFORCEMENT`. The ADR-0019 CI job `perf-budgets` does not exist in any workflow.

`ci.yml` has `build-health` (runs `pnpm build:health`) which is a different check. There is no route-budget or response-time enforcement gate.

**Risk:** Performance regressions on the 4 budgeted routes (`/`, `/dashboard`, `/dashboard/schedule`, `/login`) are invisible in CI. ADR intent of warn-to-fail progression is entirely bypassed.

**Fix:** Add a `perf-budgets` job to `ci.yml` that calls `pnpm perf:audit`, initially with `PERF_ENFORCEMENT=warn`. Wire as a required check once stable.

---

### F-11-02 — HIGH: `ignoreBuildErrors: true` active with no expiry

**File:** `apps/web/next.config.ts:185`

```typescript
typescript: {
  // Skip-rules first-rollout 2026-05-04: tolerate type errors during
  // production build while we close the merge-induced telemetry-brand
  // gap. Type errors still surface in dev/CI; this only prevents `next
  // build` from blocking deploy on them.
  ignoreBuildErrors: true,
},
```

The comment cites a specific merge event (2026-05-04) and "telemetry-brand gap" as justification. No deadline or Linear ticket is referenced. This flag is present on the `development` branch as of 2026-05-06.

**Risk:** Production builds can deploy with type errors silently. CI `typecheck` job still runs `tsc --noEmit` separately, so types are checked — but the build gate itself is bypassed, which can mask module-resolution issues that only surface at build time (not `tsc --noEmit`).

**Fix:** Create a Linear ticket with a hard deadline (suggest max 2 weeks from 2026-05-04 = 2026-05-18). Remove flag once the telemetry-brand merge gap is closed. Add a CI lint rule or comment-enforced expiry check.

---

### F-11-03 — HIGH: 373 `orange-*` palette classes bypass brand token

**Files:** Multiple files under `apps/web/src/app/`

```bash
$ grep -rn "text-orange-|bg-orange-|border-orange-" apps/web/src/app --include="*.tsx" | wc -l
373
```

Representative examples:
- `apps/web/src/app/page.tsx:426` — `border-orange-500/20 bg-orange-500/10 text-orange-500`
- `apps/web/src/app/walt/_components/WaltShell.tsx:70` — `bg-orange-500 ... hover:bg-orange-600`
- `apps/web/src/app/select-plan/page.tsx:127` — `border-orange-500/20 ... rgba(249,115,22,...)`

The design system provides `--brand-orange: oklch(0.65 0.22 40)` and `--color-brand-orange` mapped in `globals.css @theme inline`. Using raw `orange-500` decouples these from the Nordic Split token system, meaning a future brand hue shift would require a 373-site find-and-replace rather than a single CSS variable update.

**Note:** The baseline tracked `zinc`/`gray` as the "140-file debt" — those are now 0. The `orange-*` vector was not previously tracked and represents the current active debt.

**Fix:** Replace `bg-orange-500` → `bg-brand-orange`, `text-orange-500` → `text-brand-orange`, `border-orange-500/20` → `border-brand-orange/20`. The opacity modifier syntax is supported with CSS variables. This is a grep-replace sortie, not architectural work.

---

### F-11-04 — MEDIUM: Turbopack root `@smartout/ai` alias semantic gap

**File:** `apps/web/next.config.ts:62` vs `next.config.ts:103`

Webpack uses a regex anchor: `config.resolve.alias["@smartout/ai$"]` — the trailing `$` ensures this only matches the exact bare import, not subpaths like `@smartout/ai/missions`. Without the anchor, webpack would also intercept `@smartout/ai/missions` before its dedicated alias.

Turbopack `resolveAlias` uses a plain string key: `"@smartout/ai": "../../packages/ai/dist/index.js"`. Turbopack's alias semantics for plain string keys may match prefix-style (intercepting `@smartout/ai/missions` before that subpath's alias is evaluated), or exact-match. This is **untested** per the 2026-05-02 baseline note: "Turbopack switch BLOCKED... equivalence untested."

All 12 alias entries are present in both configs (count verified), but the root key semantic difference is a latent build-correctness risk that can produce silent wrong-module resolution when `next dev --turbo` is eventually enabled.

**Fix:** Verify Turbopack `resolveAlias` string-key semantics in Next.js 16 docs. If prefix-matching, subpath aliases must be listed before the root alias in the config object (or use a glob/regex if supported). Add a `turbopack:verify` CI check or integration test.

---

### F-11-05 — MEDIUM: `docs/cross-cutting/performance-governance.md` missing

**ADR reference:** ADR-0019 §Implementation: "Governance docs: `docs/cross-cutting/performance-governance.md`"

```bash
$ ls /home/sxtnl/dev/smartout.ai/docs/cross-cutting/
(directory does not exist)
```

The cross-cutting directory itself does not exist on disk. ADR-0019 also references `docs/cross-cutting/performance-checklist.md` and `docs/architecture/PERFORMANCE_BUILD_GOVERNANCE.md`.

**Risk:** Agents and developers have no authoritative governance reference. ADR-0019's "route ownership and PR checklist behavior" intent is entirely unenforceable without this file.

**Fix:** Create `docs/cross-cutting/` and stub `performance-governance.md` with at minimum: route budget table, PERF_ENFORCEMENT states, and escalation path. Can be done in a direct development commit.

---

### F-11-06 — MEDIUM: Hardcoded `rgba()` in `globals.css`

**File:** `apps/web/src/app/globals.css`

Lines 333–336 (glow-pulse animation):
```css
box-shadow: 0 0 0 0 var(--glow-brand, rgba(255, 107, 53, 0));
box-shadow: 0 0 10px 3px var(--glow-brand, rgba(255, 107, 53, 0.3));
```

Lines 512–518 (autofill-shimmer animation):
```css
box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.3);
box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
```

The glow-pulse instances use `--glow-brand` with an rgba fallback — acceptable pattern. The autofill-shimmer instances use bare rgba without a CSS variable wrapper. Both colors are Nordic Split brand colours (orange / amber), but bypassing the token system.

**Fix:** Replace autofill-shimmer rgba with `var(--brand-orange, oklch(0.65 0.22 40))` and `var(--warning, oklch(0.75 0.15 75))` as appropriate.

---

### F-11-07 — LOW: Komm tokens missing dark-mode overrides

**File:** `packages/design-tokens/src/tokens.css`

23 `--komm-*` variables are defined in `:root` (light mode). None appear in the `.dark {}` block. By CSS cascade, they inherit light-mode values in dark mode. For communication-type semantic colors this may cause contrast issues on dark surfaces.

`tokens.ts` has no `kommDark` export, confirming this is a known omission rather than a sync error.

**Fix:** Evaluate contrast ratios of current komm values on `oklch(0.12 0.015 50)` dark background. Add dark-mode overrides for any that fail WCAG AA (4.5:1 for text, 3:1 for UI elements).

---

### F-11-08 — LOW: `@smartout/training` in `transpilePackages` — verify needed

**File:** `apps/web/next.config.ts:86`

`@smartout/training` is in `transpilePackages` but is not in `optimizePackageImports`. If the package is ESM-only and ships compiled, `transpilePackages` is unnecessary and adds build overhead. Low risk but worth confirming the package ships CJS-needing transpilation.

---

## Design Token System — Positive Findings

The Nordic Split token system is well-structured:

- **Semantic/primitive split** — `tokens.ts` clearly separates brand primitives (`brand.*`), semantic aliases (`semantic.*`), surface colors (`light.*`/`dark.*`), and domain tokens (`department.*`, `status.*`, `priority.*`). Correct pattern.
- **OKLCH throughout** — All token values use OKLCH color space with hue in 40–60 for warm tones. Consistent with Nordic Split spec.
- **CSS custom property mapping** — `tokens.css` mirrors `tokens.ts` values as CSS variables. `globals.css @theme inline` correctly maps them to Tailwind's `--color-*` namespace.
- **Font registration correct** — `layout.tsx` registers `Instrument_Serif` → `--font-instrument-serif`, `Geist` → `--font-geist-sans`, `Geist_Mono` → `--font-geist-mono`. `globals.css` maps `--font-heading: var(--font-instrument-serif)`. All three fonts are loaded correctly.
- **`native.ts` parity** — Native hex conversions align with OKLCH originals. Motion tokens (`chevronMs`, `sheetSlideMs`) are synchronized between `tokens.ts` and `native.ts`.
- **Sentry config** — `shouldUploadSourceMaps = process.env.VERCEL_ENV === "production"` correctly limits source-map upload to production. Non-prod build time savings preserved.
- **`serverExternalPackages: ["posthog-node"]`** — Correctly externalizes the server-only PostHog package for client bundles.

---

## Top 3 Findings

1. **F-11-01 (HIGH)** — `perf:audit` CI job absent. ADR-0019's core enforcement loop is disconnected. Budget files exist; CI job does not.
2. **F-11-02 (HIGH)** — `ignoreBuildErrors: true` has no expiry gate. Production build type-error silence can mask module-resolution regressions.
3. **F-11-03 (HIGH)** — 373 `orange-*` palette bypass instances. The brand token `--brand-orange` exists and is correctly mapped; nothing uses it in these 373 locations.
