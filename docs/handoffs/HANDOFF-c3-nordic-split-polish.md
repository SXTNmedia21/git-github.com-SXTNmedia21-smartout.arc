---
title: "C3 Nordic Split polish — handoff"
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [nordic-split, polish, botsson, onboarding, wizard, adr-0177]
---

# C3 Nordic Split polish — handoff

> Branch: `feat/botsson-arena-c3-nordic-split-polish`
> Base: `campaign/botsson-arena` @ `68833662`
> Scope: visual-polish only, no behavior change.

## Summary

Ran the deterministic audit-plan from `frontend-designer` against three
surfaces:

1. Botsson surfaces (`apps/web/src/app/Botsson/_components/*.{tsx,css}`)
2. Onboarding flow (`apps/web/src/app/onboarding/steps/*`, steps only —
   cinematic sections/components left as-is, see §Scope notes)
3. Wizard shell (`apps/web/src/components/wizard/AnimatedWizardShell.tsx`)

Fixed what the audit flagged deterministically against the
`smartout-nordic-split` skill. No visual redesign, no behavior changes.
Every fix is grep-verifiable.

## Scope notes — what was NOT touched

- **Onboarding `sections/` + `components/`** — these use a deliberate
  cinematic `bg-[oklch(0.08_0.015_50)]` layout backdrop with
  `bg-white/[0.xx]` translucent panels. This is intentional art direction
  for the first-run hero/welcome/departments flow, not a Nordic Split
  violation. The `layout.tsx` sets the warm OKLCH canvas explicitly.
  Changing these would require a redesign decision, not a polish pass.
- **`apps/web/src/app/(auth)/`** — does not exist. No route group by that
  name. `/api/auth/` exists but is backend. Skipped.
- **`apps/web/src/app/join/_components/`** — uses its own legacy pattern
  (orange-500 focus rings, white/0.xx overlays). Out of polish scope; a
  redesign here would touch behaviour.
- **Section-label h3s** (e.g. `text-xs uppercase tracking-wider`) — kept
  in Geist Sans per `docs/design/typography.md` §Type Scale row "Section
  Label". These are data dividers, not serif headings.
- **Wizard panel springs** — kept the council-tuned values
  (stiffness 38 / damping 22 / mass 2.2) from the 2026-04-22 Phase 3
  adjustment. Only gated behind `useReducedMotion`, no regression.

## What changed — commit-by-commit

| Commit     | Surface                       | Rule | Fix                                                                                                             |
| ---------- | ----------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| `b0669a53` | `BotssonOrb`, `BotssonShell`  | A    | `from-neutral-900 via-neutral-950 to-black` / `zinc-*` → `radial-gradient(oklch(0.18 0.012 50) → 0.06 …))`.     |
| `af2d6512` | `BotssonArena`, `Playground`, `EmmaProfile` | D    | `font-heading` added to page-heading / card-title h1/h2/h3. Markdown render h1/h2 path included. |
| `af8babe2` | `onboarding/steps/Confirm*`   | D    | All 8 `Confirm*` step h2 titles + `ConfirmPositions` dept h3 → `font-heading`.                                 |
| `52f72ce5` | `AnimatedWizardShell`         | D, F | Import `useReducedMotion`; gate step / brand-panel / brand-text motion behind it; `font-heading` on brand h2.  |

## Audit results — before / after

All audits run against `apps/web/src/app/Botsson/ apps/web/src/app/join/ apps/web/src/app/onboarding/ apps/web/src/components/wizard/`.

| Rule | Audit                          | Before | After | Notes                                                                                                   |
| ---- | ------------------------------ | ------ | ----- | ------------------------------------------------------------------------------------------------------- |
| A    | Hardcoded neutrals (800/900/950) | 2      | 0     | BotssonOrb core + BotssonShell notification orb.                                                         |
| B    | Duration-only motion           | ~55    | ~55   | Intentionally unchanged. Onboarding `sections/` uses custom `EASE_EXPO` cinematic ease — not a violation per skill (spring "preferred over" duration, not required). Wizard durations are council-tuned (2026-04-22 Phase 3). Fixing would regress. |
| C    | Blur-blob orbs                 | 0*     | 0     | `backdrop-blur-2xl` on a panel (not an orb) is correct glassmorphism.                                  |
| D    | Bare headings in scope         | 18     | 5     | 5 remaining are all `uppercase tracking-wider` section labels (Geist Sans per typography.md §Type Scale) + 1 `text-sm font-medium` label-style subtitle. |
| E    | Page bg anti-pattern           | 0*     | 0     | Onboarding layout uses `bg-[oklch(0.08_0.015_50)]`, not bare `bg-black`. Per-panel `bg-black/60` / `bg-white/[0.xx]` are translucent overlays on the OKLCH canvas, not page backgrounds. |
| F    | Motion without useReducedMotion| 19     | 18    | Wizard shell fixed. Onboarding `sections/` + `components/` not in polish scope (see §Scope notes). Botsson surfaces were already compliant pre-polish. |

(*) Initial false-positive counts. Manual review showed none of these
surfaces violated the rule as written.

## Representative fixes (before → after)

### 1. BotssonOrb dark core — rule A (neutrals → warm OKLCH)

```tsx
// Before
<div className="absolute inset-1 rounded-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-950"
     style={{ animation: "botsson-notify-throb 2s ease-in-out infinite" }} />

// After
<div className="absolute inset-1 rounded-full"
     style={{
       background:
         "radial-gradient(circle at 30% 30%, oklch(0.18 0.012 50) 0%, oklch(0.12 0.010 50) 55%, oklch(0.06 0.008 50) 100%)",
       animation: "botsson-notify-throb 2s ease-in-out infinite",
     }} />
```

Visual: subtly warmer dark. Preserves the living-orb look; no behavior
change. Hue 50 is inside the warm OKLCH range (40-60) per skill.

### 2. BotssonArena card-title h3 — rule D

```tsx
// Before
<h3 className="text-foreground text-sm font-bold">Samtale</h3>

// After
<h3 className="font-heading text-foreground text-sm font-bold">Samtale</h3>
```

Applied to `Samtale` / `Agent-innstillinger` / `Gjøremål` / `Logg` /
`Minne` / `Historikk` (six card-panel headers) plus the markdown-render
h1/h2 branches used for persistent notes.

### 3. AnimatedWizardShell — rule F (useReducedMotion)

```tsx
// Before
import { AnimatePresence, motion } from "framer-motion";
// …
<motion.div
  variants={panelEntrance}
  initial="hidden"
  animate="visible"
  exit={{ opacity: 0, x: "10%", transition: { duration: 0.5, ease: EASE } }}
/>

// After
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
// …
const prefersReducedMotion = useReducedMotion();
// …
<motion.div
  variants={prefersReducedMotion ? undefined : panelEntrance}
  initial={prefersReducedMotion ? { opacity: 0 } : "hidden"}
  animate={prefersReducedMotion ? { opacity: 1 } : "visible"}
  exit={
    prefersReducedMotion
      ? { opacity: 0, transition: { duration: 0.25 } }
      : { opacity: 0, x: "10%", transition: { duration: 0.5, ease: EASE } }
  }
/>
```

Council-tuned spring kept for users without the preference. Reduced-motion
users get opacity-only transitions, still conveying state change.

### 4. Confirm* onboarding step titles — rule D

```tsx
// Before — ConfirmBusiness.tsx (and 7 siblings)
<h2 className="text-foreground text-2xl font-bold">{t("confirm.business_title")}</h2>

// After
<h2 className="font-heading text-foreground text-2xl font-bold">{t("confirm.business_title")}</h2>
```

### 5. BotssonArena markdown render — rule D (dynamic heading path)

```tsx
// Before
if (trimmed.startsWith("## "))
  return (
    <h3 key={i} className="text-foreground mt-3 mb-0.5 text-sm font-semibold">
      {trimmed.slice(3)}
    </h3>
  );

// After
if (trimmed.startsWith("## "))
  return (
    <h3 key={i} className="font-heading text-foreground mt-3 mb-0.5 text-sm font-semibold">
      {trimmed.slice(3)}
    </h3>
  );
```

Applies to every Markdown rendering path in the persistent-note panel.

## Verification

- `pnpm --filter web typecheck` — 0 errors.
- `pnpm --filter web lint` — 0 errors, 949 pre-existing warnings (diff
  from baseline: 0 new warnings in the files I touched).
- Grep audits A / D-scoped — return 0 results against in-scope surfaces.

## Decisions

None worth an ADR. ADR-0177 (`Journey Runner UI contract`) is the
governing doc for `useReducedMotion`; this polish brings
AnimatedWizardShell into compliance.

## Learnings

### L — "Polish pass" should respect post-council tuning

`AnimatedWizardShell` panel entrance was deliberately tuned Phase 3 per
council 2026-04-22 Q8 candidate #2 (stiffness 38 / damping 22 / mass 2.2).
The audit's rule table is a general template; when a file has an inline
comment citing a recent council verdict, the tuned values override the
template. I gated behind `useReducedMotion` without touching the spring.

**How to apply:** When running deterministic audit-plans, grep for
`council` / `Phase N` / `Q\d+` in comments of files about to be mutated.
If a tuned value is there, either leave the file alone or only add
accessibility gates.

### L — "40% reduction" is a redesign principle, not a polish gate

The audit-plan listed "excessive nested borders/rounded" as an
anti-pattern. In the onboarding sections this is the cinematic look
(white/[0.06] borders on black/60 panels). Flattening would be a
redesign, not polish. Scoped out explicitly.

### L — `(auth)` route group does not exist

The audit-plan referenced `apps/web/src/app/(auth)/` but no such route
group is on campaign/botsson-arena tip. Authentication lives under
`/api/auth` (backend) plus `/join` and `/onboarding` surfaces. Skipped
without regret.

## Known issues / debt

- `AnimatedWizardShell.tsx:107:6` pre-existing warning: `useEffect has a
  missing dependency: 'telemetry'`. Not introduced by this polish; noting
  for later cleanup.
- Onboarding `sections/` + `components/` remain un-reduced-motion. A
  follow-up sortie could add `useReducedMotion` throughout the cinematic
  section, but that's a coherent change (~18 files, shared EASE_EXPO
  pattern) that deserves its own PR and motion QA.

## Next steps

1. User reviews this branch visually.
2. If approved, merge `feat/botsson-arena-c3-nordic-split-polish` into
   `campaign/botsson-arena` via the normal `/close-feature` flow.
3. Optional follow-up: C3.1 — reduced-motion pass across the onboarding
   cinematic track (not a visual change, pure accessibility).

## Files changed

```
 apps/web/src/app/Botsson/_components/BotssonArena.tsx          | 16 +++----
 apps/web/src/app/Botsson/_components/BotssonOrb.tsx            | 10 +++--
 apps/web/src/app/Botsson/_components/BotssonPlayground.tsx     |  4 +-
 apps/web/src/app/Botsson/_components/BotssonShell.tsx          |  2 +-
 apps/web/src/app/Botsson/_components/EmmaProfile.tsx           |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx          |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx       |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmLocations.tsx         |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmPositions.tsx         |  6 ++-
 apps/web/src/app/onboarding/steps/ConfirmProcedures.tsx        |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx       |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmRoles.tsx             |  2 +-
 apps/web/src/app/onboarding/steps/ConfirmSummary.tsx           |  2 +-
 apps/web/src/components/wizard/AnimatedWizardShell.tsx         | 50 ++++++++++++++--------
 14 files changed, 62 insertions(+), 42 deletions(-)
```

## Commit SHAs

- `b0669a53` polish(botsson): Nordic Split — replace neutrals with warm OKLCH (rule A)
- `af2d6512` polish(botsson): Nordic Split — font-heading on real headings (rule D)
- `af8babe2` polish(onboarding): Nordic Split — font-heading on Confirm* step titles (rule D)
- `52f72ce5` polish(wizard): Nordic Split — useReducedMotion + font-heading (rules D, F)

Branch tip: `52f72ce5`. Base: `68833662` (campaign/botsson-arena).

NOT pushed. NOT merged. Ready for user review.
