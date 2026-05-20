---
title: "Slice 11 — Performance + Design System Governance"
audit_run: "2026-05-20-adr-contract-validation-02"
slice: 11
adrs: [ADR-0019, ADR-0366]
status: complete
verdict: MEDIUM
created: 2026-05-20
updated: 2026-05-20
auditor: claude-sonnet-4-6
---

# Slice 11 — Performance + Design System Governance

## Summary

**3 findings: 0 CRITICAL / 0 HIGH / 2 MEDIUM / 1 LOW**

ADR-0366 OKLCH literal ban status is materially improved from baseline (283 → 6 total hits across scoped surfaces), but two compliance gaps remain open. ADR-0019 performance budgets are structurally in place — files exist for both apps — but the CI enforcement job mandated by the ADR does not exist in any workflow, making the budget files advisory-only. No `tailwind.config.ts` outside Remotion (compliant). Design-tokens package exports are correctly structured and scoped.

---

## Findings

### FIND-11-01 — MEDIUM: `nordic-split/no-oklch-literal` ESLint rule absent (ADR-0366 §Enforcement)

**File:** `packages/eslint-config/plugins/smartout/index.mjs` + `rules/` directory
**Evidence:** `plugins/smartout/rules/` contains exactly three rules:
- `no-direct-supabase-write.mjs`
- `no-gated-write-in-capabilities.mjs`
- `no-empty-string-identifier-fallback.mjs`

`no-oklch-literal` is absent. The plugin `index.mjs` registers only these three rules — no `nordic-split/no-oklch-literal` entry exists. ADR-0366 §Enforcement explicitly mandates:
> "ESLint rule `nordic-split/no-oklch-literal` (new) scans `apps/**` for `oklch(` inside JSX class strings, inline `style={}` objects, and CSS-in-JS template literals."

**Status:** Same finding as baseline `2026-05-20-adr-contract-validation` slice 11. No change. The H2 sortie cleaned literal hits in app code but the enforcement gate was not shipped.

**Risk:** Without the lint rule, the 280+ literals cleaned by the H2 sortie can silently re-accumulate. Council R1 Tidslinjen identified this as a recurring pattern (L-0083 mobile analogy — only stabilized when ESLint shipped).

**Remediation:** New rule file `packages/eslint-config/plugins/smartout/rules/no-oklch-literal.mjs` + registration in `index.mjs`. Scope: `apps/**` JSX `className`, inline `style={}`, CSS-in-JS. Exception: `packages/design-tokens/**` and `globals.css` `@theme` block.

---

### FIND-11-02 — MEDIUM: `apps/landing` — 6 OKLCH literals outside token layer (ADR-0366)

**Files:**
- `apps/landing/src/app/globals.css` lines 134-135, 159, 172 (4 hits in `@layer utilities`)
- `apps/landing/src/app/free-forever/page.tsx` lines 181, 185 (2 hits in JSX `className`)

**Detail:**

`globals.css` `@layer utilities` hits (property values in class rules, not CSS custom props):
```css
/* line 134-135 — .section-divider gradient */
oklch(1 0 0 / 0.06) 20%,
oklch(1 0 0 / 0.06) 80%,

/* line 159 — .docs-prose table hover */
background-color: oklch(1 0 0 / 0.02);

/* line 172 — .docs-prose ol counter color */
color: oklch(0.7 0 0);
```

`free-forever/page.tsx` hits (inline Tailwind arbitrary values):
```tsx
bg-[radial-gradient(circle_at_top,oklch(1_0_0/0.06),transparent_40%)]
bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,...)]
```

These are direct OKLCH literals used as CSS property values or Tailwind gradient strings — not token definitions. ADR-0366 §Decision forbids `oklch(...)` literals in `apps/landing/**`.

**Status:** These are the 4 `globals.css @layer utilities` hits called out in the baseline synthesis as "remain". The 2 `page.tsx` hits are a net-new finding not separated out in baseline (baseline count included both files).

**Note:** `oklch(1 0 0 / …)` (pure white with alpha) and `oklch(0.7 0 0)` (neutral gray) have no warm-hue semantic tokens in `tokens.css`. Migration requires adding tokens (e.g. `--overlay-white-06`, `--text-subtle`) before consuming.

**Risk:** Landing app colors bypass dark-mode token layer. `oklch(0.7 0 0)` hardcoded gray may fail contrast in dark mode.

**Remediation:** Add neutral overlay + subtle-text tokens to `packages/design-tokens/src/tokens.css`, then replace literals in `globals.css` (`var(--overlay-white-06)` etc.) and `free-forever/page.tsx`. Scope: ~6 lines. Deferred to migration sortie per ADR-0366 §Implementation Notes.

---

### FIND-11-03 — LOW: ADR-0019 `perf-budgets` CI job absent from all workflows

**File:** `.github/workflows/ci.yml` + all other workflow files
**Evidence:** `grep -rn "perf-budget\|PERF_ENFORCEMENT"` across `.github/` returns zero results. Budget files exist at `apps/web/perf-budgets.json` (4 routes) and `apps/landing/perf-budgets.json` (4 routes) but no CI job reads or enforces them.

ADR-0019 §Implementation Notes mandates:
> "CI jobs: `perf-budgets` (warn mode initially). Enforcement switch: CI env `PERF_ENFORCEMENT=warn|fail`."

**Budget coverage:** `apps/web/perf-budgets.json` covers 4 routes (`/`, `/dashboard`, `/dashboard/schedule`, `/login`). Actual route count in `apps/web/src/app`: 165 `page.tsx` files, 88 under `/dashboard`. Coverage is 4/88 dashboard routes (~4.5%). The baseline synthesis noted this as 4/24 — that figure appears to count only "important routes"; by total count the gap is larger.

**Risk:** LOW rather than MEDIUM because `typescript.ignoreBuildErrors = false` in `next.config.ts` (re-enabled per ADR-0019 reference in comment) and `pnpm turbo typecheck` run in CI both catch type-level regressions. The missing `perf-budgets` job is a performance regression gap, not a correctness gap. Warn mode was the intended initial state anyway.

**Remediation:** Add `perf-budgets` job to `ci.yml` in warn mode (`PERF_ENFORCEMENT=warn`). Expand budget coverage to at minimum the 10 highest-traffic dashboard routes. Full coverage roadmap per `docs/cross-cutting/performance-governance.md`.

---

## Per-ADR Rollup

| ADR | Status | Finding | Verdict |
|-----|--------|---------|---------|
| ADR-0366 (OKLCH literal ban) | proposed | ESLint enforcement rule absent (FIND-11-01); 6 landing-app literals remain (FIND-11-02) | MEDIUM |
| ADR-0019 (perf + build governance) | accepted | `perf-budgets` CI job absent; budget files exist but unenforced (FIND-11-03) | LOW |

---

## Verified Compliant

| Surface | Check | Result |
|---------|-------|--------|
| `apps/web/src/app/globals.css` | OKLCH in `@theme inline` block + `.dark` block: 23 hits are all CSS custom property definitions — allowed per ADR-0366 §Decision ("Source of truth" exception for globals.css `@theme` block) | PASS |
| `apps/web/src/app/globals.css` | `.dark` block 4 hits (`--color-pin`, `--color-phase-*`): custom property value assignments in root CSS, explicitly in globals.css — allowed exception | PASS |
| `apps/web/src/components/helpdesk-orb/` | 3 OKLCH hits (Orb.tsx + LighthouseAvatar.tsx): runtime-parameterized gradients using JS template literals with dynamic chroma — confirmed as baseline-known intentional exemption (different surface from static literals) | INTENTIONAL |
| `packages/design-tokens/src/workspace-accent.ts` | Runtime `oklch(0.62 0.14 ${hue})` generation — design-tokens package is the declared source of truth; explicitly exempted by ADR-0366 §Enforcement | PASS |
| `packages/design-tokens/src/native.ts` | OKLCH values appear in comments only (`// oklch(0.99 0.004 60) — warm cream`), actual values are hex strings | PASS |
| `apps/web/next.config.ts` | Tailwind v4 CSS config only — no `tailwind.config.ts` present. `optimizePackageImports` correctly lists 14 heavy packages. `typescript.ignoreBuildErrors: false` (re-enabled per ADR-0019 comment) | PASS |
| `apps/web/perf-budgets.json` | File exists, well-formed JSON, routes have `maxResponseTimeMs` + `maxHtmlSizeKb` budgets | PASS (file only) |
| `apps/landing/perf-budgets.json` | File exists, well-formed JSON | PASS (file only) |
| `packages/design-tokens/src/` | Token naming follows Nordic Split conventions: semantic (`--background`, `--warn-soft`), domain (`--dept-kitchen`), brand (`--brand-orange`). No ad-hoc one-off names at package level. | PASS |
| `packages/design-tokens/package.json` | Exports: `"."` → `tokens.ts`, `"./tokens.css"` → CSS layer, `"./native"` → React Native hex map. All three consumption paths covered per ADR-0366 §Decision #2. | PASS |

---

## In-Progress / Deferred (not new findings)

- **ADR-0366 status `proposed`** — awaiting ratification. The migration sortie ran and cleaned app code (H2 sortie 2026-05-18); the ADR itself has not been moved to `accepted`. Not scored separately — lint rule absence (FIND-11-01) is the enforcement gap.
- **Dark-mode tuning for `--color-phase-*`** — comment in globals.css `.dark` block: "dark tuning deferred to follow-up". Intentional deferral, not a finding.
- **Budget route expansion** — ADR-0019 §Rules states agents must update budgets when changing route complexity. 4-route coverage is a known starting baseline; the gap is the missing CI job, not the count itself.

---

## Top 3 Findings

1. **FIND-11-01 (MEDIUM)** — `nordic-split/no-oklch-literal` ESLint rule mandated by ADR-0366 §Enforcement not shipped. Without it the H2 cleanup is unguarded and will re-accumulate.
2. **FIND-11-02 (MEDIUM)** — 6 OKLCH literals in `apps/landing` outside the token layer (4 in `@layer utilities` CSS class rules, 2 in JSX Tailwind arbitrary gradients). Require new neutral tokens before migration.
3. **FIND-11-03 (LOW)** — ADR-0019 `perf-budgets` CI job absent from all workflows. Budget files present but unenforced; `PERF_ENFORCEMENT=warn` mode never activated.
