---
title: "Audit Slice 11 — Performance & Design Governance"
status: done
updated: 2026-05-10
created: 2026-05-10
module: performance-design
tags: [audit, adr-0019, performance, design-tokens, nordic-split, turbopack]
---

# Slice 11 — Performance & Design Governance

**ADR:** ADR-0019 (Performance and Build Governance System)  
**Anchor:** `docs/architecture/cross-cutting/performance-governance.md`  
**Surfaces:** `apps/web/next.config.ts`, `packages/design-tokens/`, `apps/web/src/app/globals.css`  
**Branch:** `campaign/botsson-arena`  
**Date:** 2026-05-10  
**Baseline:** 2026-05-06 audit (`docs/audits/2026-05-06-adr-contract-validation/11-performance-design.md`)

---

## Summary

| ID | Severity | Status vs 2026-05-06 | Finding |
|----|----------|----------------------|---------|
| F-PD-01 | HIGH | UNCHANGED | `perf:audit` CI job absent — ADR-0019 enforcement loop disconnected |
| F-PD-02 | HIGH | UNCHANGED | `typescript.ignoreBuildErrors: true` has no expiry gate |
| F-PD-03 | HIGH | WORSENED (+14) | 387 `orange-*` palette classes in `apps/web/src/app/` bypass `--brand-orange` token |
| F-PD-04 | MEDIUM | UNCHANGED | `--brand-orange-light` used in 5 className locations but missing `@theme inline` bridge |
| F-PD-05 | MEDIUM | UNCHANGED | 20 tokens in `tokens.css :root` have no matching `--color-*` entry in `@theme inline` |
| F-PD-06 | MEDIUM | UNCHANGED | Turbopack root `@smartout/ai` alias semantic gap vs webpack `$`-anchored regex |
| F-PD-07 | MEDIUM | UNCHANGED | `docs/cross-cutting/performance-governance.md` missing (ADR-0019 reference) |
| F-PD-08 | LOW | UNCHANGED | `rgba()` fallbacks in `globals.css` autofill-shimmer animation bypass token system |
| F-PD-09 | LOW | UNCHANGED | 23 Komm semantic tokens have no dark-mode overrides in `tokens.css .dark` block |
| F-PD-10 | INFO | NEW | Emoji reactions in Komm are data-driven (user content), not hardcoded UI — permitted |

---

## Delta from 2026-05-06 Baseline

| Area | 2026-05-06 | 2026-05-10 | Change |
|------|-----------|-----------|--------|
| `orange-*` in `apps/web/src/app/` | 373 | 387 | WORSENED +14 |
| zinc/gray/slate hardcoded | 0 | 4 (contracts print preview) | MINOR REGRESSION |
| `perf:audit` CI job | Absent | Absent | UNCHANGED |
| `ignoreBuildErrors` | Active, no expiry | Active, no expiry | UNCHANGED |
| tailwind.config.ts | Absent (correct) | Absent (correct) | RESOLVED / CLEAN |
| Font loading | Correct | Correct | CLEAN |
| `@theme inline` bridge | Partial | Partial | UNCHANGED |
| Komm dark-mode | Missing | Missing | UNCHANGED |

No Phase-E commits touched `apps/web/src/app/globals.css`, `packages/design-tokens/`, or `next.config.ts` (only E6 env/import cleanup). The worsening of F-PD-03 was from the development sync merge (`1319bd4eb`), not Phase-E work.

---

## Findings

### F-PD-01 — HIGH: `perf:audit` CI job absent (UNCHANGED)

**File:** `.github/workflows/ci.yml`  
**ADR contract:** ADR-0019 §Implementation — CI job `perf-budgets` (warn mode), `PERF_ENFORCEMENT=warn|fail`

`perf-budgets.json` exists at `apps/web/perf-budgets.json` (4 routes: `/`, `/dashboard`, `/dashboard/schedule`, `/login`). `package.json` defines `perf:audit:web` and `perf:audit:landing` scripts. Zero workflow files call these scripts or set `PERF_ENFORCEMENT`. The ADR-0019 `perf-budgets` CI job does not exist in any workflow.

**Risk:** Performance regressions on the 4 budgeted routes are invisible in CI. ADR-0019's warn-to-fail progression is entirely bypassed. Route budget file is maintained but never evaluated.

**Fix:** Add a `perf-budgets` job to `ci.yml` calling `pnpm perf:audit`, initially with `PERF_ENFORCEMENT=warn`. Wire as a required check once baseline is established.

---

### F-PD-02 — HIGH: `typescript.ignoreBuildErrors: true` active, no expiry (UNCHANGED)

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

Comment references 2026-05-04 merge event. No Linear ticket, no deadline. Still active on 2026-05-10 (6 days past the initiating event). `tsc --noEmit` runs separately in CI, but build-time module resolution errors are masked.

**Risk:** Production builds can deploy with type errors. Module resolution regressions that only surface at build time (not `tsc --noEmit`) are silent.

**Fix:** Open a Linear ticket with hard deadline. Remove once telemetry-brand gap is closed. Suggested deadline: 2026-05-18 per prior audit recommendation.

---

### F-PD-03 — HIGH: 387 `orange-*` palette classes bypass `--brand-orange` token (WORSENED)

**Scope:** `apps/web/src/app/` only (prior audit scope: same)  
**Count:** 387 (up from 373 on 2026-05-06 baseline — +14 from development sync)

The design system provides `--brand-orange: oklch(0.65 0.22 40)` mapped via `--color-brand-orange` in `globals.css @theme inline`. Using raw `orange-500` decouples from the Nordic Split token system.

Representative sites:
- `apps/web/src/app/dashboard/settings/_components/ChangeProposalDialog.tsx:145` — `bg-orange-500 text-white`
- `apps/web/src/app/dashboard/hms/_components/DeviationDetailDrawer.tsx:20-23` — `bg-red-500 text-white`, `bg-yellow-500`, `bg-blue-500` (semantic colors that should use `--destructive`, `--warning`, `--info`)
- `apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx:217,1171,1541` — `bg-orange-500 text-white hover:bg-orange-600` (3 instances)
- `apps/web/src/app/dashboard/schedule/page.tsx:1617` — `bg-orange-500/[0.03]`

Components outside `apps/web/src/app/` add another ~125 instances (total TSX count: 512).

**Note on `text-white` / `bg-white`:** 537 instances of `bg-white`/`text-white`/`bg-black`/`text-black` across `apps/web/src/`. In UI primitives (`components/ui/`), these are expected (shadcn base styles). In custom components, most are used over colored backgrounds (e.g., `bg-orange-500 text-white`) and are semantically correct as a contrast pair — but they still bypass the token system. The contract preview print surfaces (`contracts-data-table.tsx:855`, `contract-preview-editor.tsx:73,76,81`) use `bg-white text-zinc-900` intentionally for print fidelity — ACCEPTABLE as a known-FP for print-mode rendering.

**Fix:** `bg-orange-500` → `bg-brand-orange`, `text-orange-500` → `text-brand-orange`, `hover:bg-orange-600` → `hover:bg-brand-orange-dark`. Opacity modifier syntax works with CSS variables. `bg-red-500`/`bg-yellow-500`/`bg-blue-500` in `DeviationDetailDrawer` → `bg-destructive`/`bg-warning`/`bg-info`. This is a grep-replace sortie.

---

### F-PD-04 — MEDIUM: `--brand-orange-light` used in className but missing `@theme inline` bridge

**Files:**
- `apps/web/src/app/dashboard/shift-clock/SupplementSheet.tsx:187` — `hover:bg-brand-orange-light`
- `apps/web/src/app/dashboard/shift-clock/ShiftClockTabs.tsx:247` — `hover:text-brand-orange-light`
- `apps/web/src/app/dashboard/shift-clock/NoteInput.tsx:56` — `hover:text-brand-orange-light`
- `apps/web/src/app/dashboard/shift-clock/ShiftClockSummary.tsx:180` — `hover:bg-brand-orange-light`
- `apps/web/src/components/wizard/AnimatedWizardShell.tsx:241` — `var(--brand-orange-light)` (inline style)

`--brand-orange-light` is declared in `packages/design-tokens/src/tokens.css :root` and also in `.dark {}`. However, `globals.css @theme inline` has `--color-brand-orange-dark: var(--brand-orange-dark)` but **no** `--color-brand-orange-light: var(--brand-orange-light)`. Per L-0223, a `--<name>:` declaration in `:root` needs a matching `--color-<name>: var(--<name>);` in `@theme inline`.

**Risk:** Tailwind utility classes `bg-brand-orange-light`, `text-brand-orange-light` resolve to an undefined CSS variable, producing **no color** (transparent/invisible hover state). The inline `var(--brand-orange-light)` in `AnimatedWizardShell` works correctly because it uses the CSS variable directly, not the Tailwind bridge.

**Fix:** Add to `globals.css @theme inline`:
```css
--color-brand-orange-light: var(--brand-orange-light);
```

---

### F-PD-05 — MEDIUM: 20 tokens in `tokens.css :root` have no `@theme inline` bridge (UNCHANGED)

**Files:** `packages/design-tokens/src/tokens.css`, `apps/web/src/app/globals.css`

Tokens declared in `tokens.css :root` (and thus available as CSS custom properties) that have **no** corresponding `--color-<name>: var(--<name>)` line in `globals.css @theme inline`:

| Missing bridge | Risk level |
|----------------|-----------|
| `--brand-orange-light` | ACTIVE USE — see F-PD-04 |
| `--brand-purple`, `--brand-purple-light`, `--brand-purple-dark` | Not currently used in className |
| `--warn-soft`, `--warn-soft-foreground` | Not used as Tailwind class |
| `--data-estimate` | Not used as Tailwind class |
| `--destructive-muted` | Not used as Tailwind class |
| `--hero-warm-deep` | Not used as Tailwind class |
| `--priority-urgent`, `--priority-high`, `--priority-normal`, `--priority-low` | Not used as Tailwind class |
| `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-track` | Used in CSS property directly, not Tailwind |
| `--panel`, `--panel-deep`, `--glow-warm`, `--glow-deep` | Used inline via `var()`, not Tailwind class |
| `--workspace-accent` | Used inline via `var()`, not Tailwind class |

Only `--brand-orange-light` is actively used as a Tailwind class without a bridge (active bug). The others are either used correctly as direct `var()` references or not yet used. Preventive bridges are recommended for the brand-purple family and priority tokens given they're design-system primitives.

**Fix:** Add bridges for `--brand-orange-light` (blocking), then `--brand-purple*` and `--priority-*` (preventive). Scroll and panel tokens are CSS-only and do not need Tailwind bridges.

---

### F-PD-06 — MEDIUM: Turbopack root alias semantic gap (UNCHANGED)

**File:** `apps/web/next.config.ts:62` vs `:103`

Webpack uses regex anchor: `config.resolve.alias["@smartout/ai$"]` — exact match only, not subpath prefix. Turbopack uses plain string: `"@smartout/ai": "../../packages/ai/dist/index.js"` — Turbopack's `resolveAlias` string-key semantics for prefix matching are untested.

All 12 `@smartout/ai/*` subpath aliases are present in both configs. The risk is whether the Turbopack root key intercepts subpath imports before their dedicated aliases are evaluated when `next dev --turbo` is used.

**Risk:** Silent wrong-module resolution (`@smartout/ai/missions` resolves to `index.js` instead of `missions/index.js`) when Turbopack is enabled for dev. Phase-E refactored `@smartout/ai` imports (stripping `startMissionCall` barrel export) — this makes the alias behavior more important, not less.

**Fix:** Verify Turbopack `resolveAlias` prefix-match behavior in Next.js 16 docs. If prefix-matching, reorder subpath aliases before the root key.

---

### F-PD-07 — MEDIUM: `docs/cross-cutting/performance-governance.md` missing (UNCHANGED)

**ADR reference:** ADR-0019 §Implementation references `docs/cross-cutting/performance-governance.md` and `docs/cross-cutting/performance-checklist.md`.

The governance doc lives at `docs/architecture/cross-cutting/performance-governance.md` (found by search), not at the ADR-cited path. The ADR-cited path `docs/cross-cutting/` does not exist as a directory. This is a path drift, not a missing doc.

**Risk:** Agents following ADR-0019 to find the governance doc will navigate to a non-existent path. Actual doc exists at a different path.

**Fix:** Either update ADR-0019 to reference `docs/architecture/cross-cutting/performance-governance.md`, or create a redirect stub at `docs/cross-cutting/performance-governance.md` that points to the canonical location.

---

### F-PD-08 — LOW: `rgba()` hardcodes in `globals.css` animations (UNCHANGED)

**File:** `apps/web/src/app/globals.css`

Lines 512–518 (autofill-shimmer keyframe):
```css
box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.3);
box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
```

Lines 333–336 (glow-pulse keyframe): Uses `var(--glow-brand, rgba(255, 107, 53, 0))` — the `var()` wrapper is correct; rgba is only the fallback. This is acceptable.

The autofill-shimmer lines have no CSS variable wrapper. `rgba(245, 158, 11)` is Tailwind amber-500, not a Nordic Split token.

**Fix:** Replace with `oklch(0.75 0.15 75 / 0)` and `oklch(0.75 0.15 75 / 0.3)` (matches `--warning` token) or wrap as `var(--warning, oklch(0.75 0.15 75))`.

---

### F-PD-09 — LOW: Komm tokens missing dark-mode overrides (UNCHANGED)

**File:** `packages/design-tokens/src/tokens.css`

23 `--komm-*` variables defined in `:root` only. None appear in `.dark {}`. By CSS cascade, they inherit light-mode values in dark mode. `tokens.ts` has no `kommDark` export, confirming intentional omission.

Current komm values use chroma 0.12–0.25, which may provide insufficient contrast on `oklch(0.12 0.015 50)` dark background. For communication channels that indicate urgency (`komm-problem: oklch(0.577 0.245 27.325)`) this is the highest risk.

**Fix:** Evaluate WCAG AA contrast for each komm token against dark background. Add `.dark {}` overrides for failing values. Low priority unless Komm dark-mode is actively used in production.

---

## Positive Findings (CONFIRMED CLEAN)

- **Tailwind v4 CSS-based config** — No `tailwind.config.ts` in `apps/web/`. Config is CSS-only in `globals.css`. CLEAN.
- **Font loading** — `layout.tsx` registers all three fonts with correct CSS variable names (`--font-geist-sans`, `--font-geist-mono`, `--font-instrument-serif`). `globals.css @theme inline` maps `--font-heading: var(--font-instrument-serif)`. CLEAN.
- **Icon library** — No non-Lucide icon imports found in `apps/web/src/`. CLEAN.
- **Emoji in UI** — Emoji usage in `komm/` is data-driven (user-generated reactions from DB field `r.emoji`, not hardcoded icon constants). The `QUICK_EMOJIS` constants are reaction pickers for UGC, not UI decoration. PERMITTED per design intent.
- **Nordic Split OKLCH token values** — All `tokens.css` values use OKLCH with warm-hue range (hue 40–60 for brand/surface, appropriate range for domain/semantic). CLEAN.
- **`tokens.ts` ↔ `tokens.css` ↔ `native.ts` sync** — Values are in sync. Motion tokens (`chevronMs`, `sheetSlideMs`) present in all three files. CLEAN.
- **`@theme inline` coverage** — Core shadcn tokens (background, foreground, card, popover, primary, secondary, muted, accent, border, input, ring, destructive, chart-1 through 5, sidebar family), domain tokens (dept, status), komm tokens, and onboarding/join wizard tokens all correctly bridged.
- **`optimizePackageImports`** — All heavy client packages (`lucide-react`, `framer-motion`, `recharts`, `date-fns`, etc.) listed. CLEAN.
- **`next/dynamic` usage** — Heavy components correctly lazy-loaded: `VoiceAssistant`, `GlobalCallAlert`, `GlobalSearchPalette`, `GlobalCreateMenu`, `EmmaOverlay`, `NotificationBell`, `HospitalityOperationsCockpit`, `StrategicView`, `ReconciliationView`, etc. CLEAN.
- **Suspense boundaries** — Correctly applied at page level for streaming routes (year-wheel, my-salary, reconciliation, website, my-cv, settings tabs). CLEAN.
- **`React.cache`** — Used in `apps/web/src/app/dashboard/_data/queries.ts`, `help/_data/queries.ts`, and `lib/platform-admin.ts` for request deduplication. CLEAN.
- **`Promise.all` for parallel async** — Used consistently for independent Supabase calls in API routes and data fetchers. CLEAN.
- **Sentry config** — `shouldUploadSourceMaps = VERCEL_ENV === "production"` correctly scoped. CLEAN.
- **`serverExternalPackages: ["posthog-node"]`** — Correctly externalizes server-only package for client builds. CLEAN.
- **`design-tokens` barrel export (`index.ts`)** — Exports from `./tokens` and `./workspace-accent` only; no re-export of `native.ts`. Consumers import `nativeTheme` from `native.ts` directly. CLEAN.

---

## Top Findings

1. **F-PD-04 (MEDIUM/ACTIVE BUG)** — `hover:bg-brand-orange-light` and `hover:text-brand-orange-light` resolve to no color in 4 Tailwind class uses. The `@theme inline` bridge is missing. One-line fix.
2. **F-PD-03 (HIGH)** — 387 `orange-*` palette bypass instances (up from 373). `--brand-orange` is correctly defined and bridged; nothing uses it in these 387 locations.
3. **F-PD-01 (HIGH)** — `perf:audit` CI job absent. ADR-0019's route performance enforcement loop is disconnected. Budget files maintained but never evaluated.
