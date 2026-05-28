---
title: UX Council — Dagslinjen + ConfirmDepartments frontend-designer review
status: done
created: 2026-05-29
updated: 2026-05-29
module: day-session
tags: [ux, framer-motion, accessibility, focus-ring, drag-drop, nordic-split]
---

# UX Council — Dagslinjen + ConfirmDepartments

**Reviewer:** frontend-designer (UX specialist agent)
**Scope:** `apps/web/src/app/dashboard/oppgaver/_chart/` + `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx`
**Date:** 2026-05-29
**Resolution:** P1–P3 fixed in Sortie F+ atomic commit. P4–P6 deferred.

---

## P-Priority Backlog

| P | File | Finding | Status |
|---|------|---------|--------|
| P1 | `AreaBand.tsx:155` | `bg-warning/10` wrong semantic for drop-target affordance; `warning` = danger/error. Fixed to `bg-primary/10`. | **FIXED** |
| P2 | `NowLine.tsx:33–43` | `pulseVariants` transition missing `type:"tween"`. Framer Motion silently overrides spring when keyframe arrays present; spring+duration:2 conflict. | **FIXED** |
| P3 | `ConfirmDepartments.tsx:240` | Input `focus-visible:ring-[var(--brand-orange)]/40` diverges from adjacent tooltip button `focus-visible:ring-ring`. Standardized to semantic `ring-ring`. | **FIXED** |
| P4 | `NowLine.tsx:72` | `<span>` time label inside `aria-hidden="true"` subtree — current time not announced to screen readers (WCAG 1.3.1 risk). Needs page-level current-time marker audit before fix to avoid duplicate announcements. | DEFERRED |
| P5 | `ConfirmDepartments.tsx:242–254` | Radix `<TooltipContent id={tooltipId}>` — Radix portals render outside the component tree; `aria-describedby` reference may fail if portal hasn't mounted. Needs Radix portal mount-state verification. | DEFERRED |
| P6 | `AreaBand.tsx:167`, `NowLine.tsx:72` | `text-[0.6rem]` = 9.6px — below WCAG SC 1.4.4 legibility threshold (14px min for normal text). Needs design-token proposal (`text-2xs`) before sweep. | DEFERRED |

---

## Cross-Cutting Findings

### Semantic token usage
- `bg-warning` is consistently used for the NowLine indicator (time-critical marker). Correct.
- Drop-target affordance (UnassignedLane) previously used `bg-warning/10` — wrong semantic. Now `bg-primary/10` matches "valid target" convention (Salesforce Scheduler, Deputy).
- `bg-accent/10` is an acceptable fallback if primary appears too strong in context.

### Framer Motion keyframe discipline
- Keyframe arrays (`[1, 0.5, 1]`) always require `type: "tween"` in the transition block.
- Spring physics (`stiffness`, `damping`, `mass`) are incompatible with duration-controlled loops.
- Prop-level `transition={{ type: "spring", ...motionTokens.springGentle }}` governs variant entry (idle→pulse one-shot): correct, untouched.
- Variant-level `transition` governs loop interior: now correctly `type:"tween"`.

### Focus ring standardization (onboarding)
- Pattern: inputs use custom brand-orange ring; buttons use semantic ring token.
- Resolution: standardize all interactive elements to `focus-visible:ring-ring`.
- Scope of this fix: `ConfirmDepartments.tsx` input only.
- Other onboarding steps using `ring-[var(--brand-orange)]` for focus are out of scope for this sortie — inventory separately.
- `ToggleRow` uses `hover:border-[var(--brand-orange)]/30` (hover, not focus) — intentional brand accent for hover affordance, leave as-is.

---

## Files Changed (Sortie F+)

- `apps/web/src/app/dashboard/oppgaver/_chart/AreaBand.tsx` — P1
- `apps/web/src/app/dashboard/oppgaver/_chart/NowLine.tsx` — P2
- `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx` — P3
