---
title: "Component-folder location aligns with route-folder location during route moves"
id: L-0251
status: accepted
created: 2026-05-14
updated: 2026-05-14
module: governance
related_adrs:
  - ADR-0268
related_learnings:
  - L-0250
tags: [mobile, components, refactor, route-absorption, council-g2]
---

# L-0251: Component-folder location aligns with route-folder location during route moves

## Context

Discovered during Council G2 review of mobile-phase-3f-home-absorption sortie 2026-05-14.

`apps/mobile/src/components/home/` is a SEPARATE folder from the route folder `apps/mobile/app/(app)/(home)/`. The component folder contains 8 view components (NoShiftView, BeforeShiftView, DuringShiftView, DuringShiftView.v2, AfterShiftView, HomeHeader, NotificationSheet, SettingsSheet). These components are consumed by:

- Intra-folder: each other (e.g. SettingsSheet ↔ HomeHeader, DuringShiftView mutually with phase siblings).
- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:36,254` — imports `AfterShiftView` from `@/components/home/AfterShiftView`. **External consumer outside the (home) namespace.**
- `apps/mobile/app/(app)/(home)/shift-hub.tsx` (will delete) — imports 6 components from the component folder.

When the route folder `(home)/` deletes, the component folder is unaffected. `ShiftClockView` still consumes `AfterShiftView` from its current location. **No broken imports result from route deletion.**

However, the component-folder NAME (`components/home/`) becomes a misnomer once the `(home)` route is gone. Future readers will assume there's a `(home)` tab that consumes these components. The naming/location alignment between component-folder and route-folder is a latent semantic debt.

## Class of trap

**Component-folder semantic drift** after route restructuring. The folder name reflects an obsolete route group. Subsequent edits run two risks:

1. Developer assumes the `(home)` route exists, attempts to add new route file, finds folder missing, confusion.
2. Move-detection during code review: `(home)/X.tsx` deletion + `(home-named) component/home/X.tsx` retention looks asymmetric — reviewer may believe folder rename was intended but missed.

Same class as L-0157 ("Formalize reality" framing) — letting names drift from reality.

## Rule

When deleting or absorbing a route group:

1. **Audit the parallel component folder** with the same naming root. If `app/(app)/(X)/` deletes, check `src/components/X/` for content + consumers.
2. **Decide deliberately:** rename component folder to match new canonical location (e.g. `components/home/` → `components/shift/` if absorbed into `(shifts)` tab), OR document the retention with explicit rationale.
3. **Defer rename only when safe** — when component-folder consumers number > 5 sites, rename happens in a dedicated cleanup sortie. Otherwise rename atomically with the route-folder move.
4. **NEVER silently keep the old name.** Future readers chase the obsolete reference.

## Application — this sortie (3f.1)

`apps/mobile/src/components/home/` retained in 3f.1 because:
- `ShiftClockView` consumer outside the folder exists (1 site).
- Intra-folder consumers number 5+ (Phase-view components mutually consume).
- A rename now would block 3f.2/3f.3/3f.4 with phantom import errors on every absorbed file.

Decision deferred to **3f.4** (final cleanup sortie): rename `components/home/` to canonical location (likely `components/shift/` since AfterShiftView ↔ shift-clock dependency dominates).

Documented in `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` §Component-folder note.

## Pattern frequency

1st observed instance (Council G2 2026-05-14). Watch for 2nd occurrence; if 3rd observed, promote to SKILL.md route-restructuring checklist: "When deleting/absorbing a route group `(X)/`, audit `src/components/X/` for content + consumers, decide rename-or-retain explicitly."

## Related
- L-0250 — Route-group absorption requires inbound-importer audit (sibling rule, same Council session)
- L-0147 — Chair Self-Reversal Protocol (Steward caught both rules simultaneously)
- L-0157 — "Formalize reality" framing as deletion-plan smell
- ADR-0268 §"Tab removal sequence" — route-group deletion mandate triggering this audit
- `apps/mobile/src/components/home/` — retained component folder; rename deferred to 3f.4
- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:36,254` — external consumer pinning AfterShiftView in place
