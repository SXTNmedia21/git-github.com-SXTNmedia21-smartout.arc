---
title: "Unified Overlay System — EntityDrawer + EntityFormDialog"
id: ADR-0154
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
module: ui
tags: [ui, overlays, components, design-system, nordic-split]
---

# ADR-0154: Unified Overlay System — EntityDrawer + EntityFormDialog

## Context and Problem Statement

The Smartout web dashboard has accumulated **23+ bespoke overlays** (dialogs, sheets, drawers) across 51 routes. The schedule module alone ships 14 one-off dialogs; the organization module ships 11 near-identical `CreateX` / `EditX` dialog pairs. Three parallel overlay systems coexist without a rulebook: the `EntityDrawer` registry (a good pattern, used for READ inspection of 5 entity types), ad-hoc `Dialog` usages (used for WRITE — create/edit forms), and loose `Sheet` usages (used for supplemental data panels).

Three concrete symptoms are visible in the code today:

1. **Write overlays re-implement the same shell.** Every `CreateZoneDialog`, `EditZoneDialog`, `CreateAssetDialog`, `EditAssetDialog` (etc.) rebuilds header, footer, submit state, loading state, and toast wiring inline. Estimated duplication: ~20 dialog files × ~80 LOC of shell each = ~1 600 LOC of repeated overlay chrome.
2. **EntityDrawer is not the canonical inspector.** `apps/web/src/app/dashboard/schedule/_components/employee-drawer.tsx` is a second, parallel employee read-panel. `people/_components/employee-profile-card.tsx` is a third. They drift on motion, accent color, and pin behaviour.
3. **No overlay decision matrix exists.** New contributors (human or agent) pick between `Dialog`, `Sheet`, `AlertDialog`, and `EntityDrawer` on vibes. The result is inconsistent hierarchy — edit forms open as sheets on one page and dialogs on the next.

This ADR establishes the canonical overlay rules before the page-by-page UX pass on `apps/web/` so the design walk produces consolidation, not accretion.

## Decision Drivers

- **Reuse over re-implementation.** The Nordic Split design system's "40% Reduction Principle" requires stripping redundant containers — every duplicated dialog shell works against this.
- **Consistent mental model for users.** Inspect = pinnable drawer (right side, narrows content). Edit = modal dialog (focus-trapping, commits). Supplemental list = sheet. Destructive = alert. Users should be able to predict the overlay shape from the verb.
- **Aligns with ADR-0133 (web composes, mobile executes).** Authoring verbs (D1–D5) live on web; EntityFormDialog is the canonical authoring primitive. Mobile never ships this dialog — mobile executes via the drawer + C4 confirmation surfaces.
- **Agent-authorable.** Mr. Botsson and future capability tools need a single `openEntityForm(entityType, mode, id?)` surface to propose edits — impossible with 20 bespoke dialogs.
- **Code-review gatekeeping.** Without a written rule, reviewers have no anchor to reject a new bespoke dialog.

## Considered Options

1. **Keep the status quo** — let each page pick its overlay shape, document retroactively after refactor.
2. **One universal overlay component** — collapse Dialog + Sheet + Drawer into a single configurable component with a `mode` prop.
3. **Two-primitive system: EntityDrawer (read) + EntityFormDialog (write), with Sheet / AlertDialog / WizardForm as narrow-purpose supplements.**
4. **Five-primitive explicit matrix (this ADR's choice with formal decision table).**

Option 1 is the current failure mode. Option 2 over-abstracts — `Dialog` (focus-trap, modal) and `Sheet` (side panel, dismissible by click-away) have genuinely different UX semantics and a/11y contracts; collapsing them produces a leaky abstraction. Option 3 is close but leaves WizardForm and AlertDialog undocumented, which is where past drift originated. Option 4 writes the rule explicitly.

## Decision Outcome

Chosen option: **Option 4 — five-primitive overlay matrix, gated by ADR**, because it resolves the observed drift without over-abstracting distinct UX semantics, and produces an enforceable code-review rule.

### The Overlay Decision Matrix (canonical)

| Verb / Intent | Overlay Primitive | Source of Truth | Dismiss Behaviour |
|---|---|---|---|
| **Inspect entity** (view profile, shift details, session summary) | `EntityDrawer` (pinnable) | `components/dashboard/entity-drawer/EntityDrawer.tsx` + registry | Click-away or close button; remembers `isPinned` in localStorage |
| **Create or edit entity** (any D1–D5 authoring mutation) | `EntityFormDialog` (new — to be built in `@smartout/ui`) | `packages/ui/src/components/entity-form-dialog.tsx` *(new)* | Focus-trapped; explicit Cancel / Submit; dirty-state confirm on Cancel |
| **Supplemental list or data** (team members, saved templates, audit log) | `Sheet` (side panel) | `apps/web/src/components/ui/sheet.tsx` | Click-away or close button; no commit semantics |
| **Destructive confirmation** (delete, deactivate, end contract, publish) | `AlertDialog` | `apps/web/src/components/ui/alert-dialog.tsx` | Explicit Confirm / Cancel; no click-away dismissal |
| **Multi-step authoring** (contract creation, onboarding, season setup) | `WizardForm` (new — to be built) | `packages/ui/src/components/wizard-form.tsx` *(new)* | Progress-preserving back/next; explicit Cancel with dirty-confirm |

**No sixth overlay type is permitted** without amending this ADR.

### The Five Rules

1. **EntityDrawer is the ONLY entity inspector.** Every inspectable entity must register with the entity-drawer registry and ship a tab component. Bespoke inspector panels (`schedule/_components/employee-drawer.tsx`, `people/_components/employee-profile-card.tsx`) are scheduled for deletion. Ship the missing tabs (`team`, `shift_template`) before closing this ADR as accepted.

2. **One dialog shell: `EntityFormDialog`.** All create/edit overlays compose this component. The shell owns: header (title + optional icon + close button), field region (scrollable, form grid), footer (submit/cancel with loading + error state), dirty-state detection, optimistic-update hook wiring, Sonner toast on success/error. Entity-specific form fields are passed as children. Target: replace ~20 `CreateX` / `EditX` dialogs with ~20 thin form definitions.

3. **Resolve web ↔ `packages/ui` primitive duplication.** `packages/ui` is the cross-surface source (web + mobile + agent SDK). `apps/web/src/components/ui/` extends shadcn primitives for web-specific variants but **never re-implements** what `packages/ui` already exports. Duplicates to resolve: `Button`, `Card`, `Badge`, `Dialog`, `Popover`, `Input`, `Label`, `Separator`. Web extends via `className` composition, not re-export.

4. **Promote five missing primitives to `@smartout/ui`:** `PageHeader`, `EmptyState`, `ErrorState`, `StatusBadge` (unifies `PaymentStatusBadge`, `DispatchStatusBadge`, contract-status, shift-status), `DataTableShell`. Each appears in 4+ sites today and is inlined every time.

5. **Overlay matrix is ADR-gated.** Adding a new overlay pattern (custom slide-in, new modal variant, fullscreen takeover) requires an ADR that amends this one. Code review rejects new bespoke overlays.

## Rules & Consequences

### Good, because

- **Predictable UX for users.** Verb → overlay shape is deterministic. Inspecting an employee always opens the right-side pinnable drawer; editing always opens a focus-trapped centred dialog.
- **Reviewer-enforceable.** Reviewers now have a 5-row table to cite when rejecting a new bespoke dialog.
- **Agent-authorable surface.** Capability tools can expose `openEntityForm(entityType, mode, id?)` as a canonical surface — one registry entry per entity replaces 20 bespoke imports.
- **Aligns with Nordic Split.** Fewer containers, more hierarchy. Motion, accent colour, and glassmorphism rules apply uniformly across one drawer and one dialog instead of 23 divergent implementations.
- **Aligns with ADR-0133.** Authoring primitives live on web only. Mobile ships the drawer for execution + C4 confirmation; mobile never renders `EntityFormDialog` or `WizardForm`.

### Bad, because

- **Migration cost.** ~20 existing `CreateX` / `EditX` dialogs must be rewritten against `EntityFormDialog` once it ships. Estimated effort: 2–3 engineer-days after the primitive lands.
- **Registry ceremony.** Every new inspectable entity now requires a registry entry + tab component before shipping. This adds ~1 file per new entity type. Net positive but front-loaded.
- **`WizardForm` is still a design exercise.** Shape is not yet proven; the primitive ships after schedule + organization refactors validate `EntityFormDialog`. Risk: `WizardForm` ships late and contracts wizard lingers in bespoke form.

### Agent Impact

- **Frontend-designer agent:** Must cite the overlay decision matrix when recommending any new overlay. Must reject PRs that introduce bespoke dialogs.
- **Feature-dev agents:** When building a new authoring flow, default to `EntityFormDialog`. When building a new detail view, default to `EntityDrawer` tab + registry entry. Ask before introducing any sixth overlay type.
- **Capability layer (`packages/ai/src/capabilities/`):** Tools that propose entity edits expose `openEntityForm(entityType, mode, id?)` as the canonical client surface. No more `openBookingDialog`, `openEditPositionDialog` etc. in the tool registry.
- **Build-agents in worktrees:** Must read this ADR and the inventory at `docs/design/COMPONENT-INVENTORY.md` (to be written alongside this ADR's acceptance) before touching any overlay.

## Rollout Plan (for acceptance)

This ADR is **proposed** until the following are done:

1. `EntityFormDialog` primitive shipped to `@smartout/ui` with one reference consumer (recommend: `CreatePositionDialog` — small, contained, representative).
2. `team` and `shift_template` tabs shipped in EntityDrawer registry (closes rule 1).
3. `docs/design/COMPONENT-INVENTORY.md` + `docs/design/UNIFIED-COMPONENTS.md` written (the living tracker + rulebook).
4. Duplicate primitives between `packages/ui` and `apps/web/src/components/ui/` audited; re-implementation sites filed as follow-up tasks (does not block acceptance; deletion may be phased).

`WizardForm` and the five promoted primitives (`PageHeader`, `EmptyState`, `ErrorState`, `StatusBadge`, `DataTableShell`) are out of scope for this ADR's acceptance — they ship as follow-up work tracked in `COMPONENT-INVENTORY.md`. Their existence is mandated by rule 4; their shape is not prescribed here.

## Related

- **ADR-0075** — Session lifecycle & documentation separation (establishes where the inventory + rulebook live).
- **ADR-0133** — Web composes, mobile executes (authoring primitives are web-only; mobile ships drawer for execution).
- **Skill `smartout-nordic-split`** — 40% Reduction Principle, motion constants, glassmorphism recipe apply uniformly to the unified overlays.

---

> After acceptance: register in `docs/decisions/0000-decision-log.md`. Inventory + rulebook land alongside as `docs/design/COMPONENT-INVENTORY.md` and `docs/design/UNIFIED-COMPONENTS.md`.
