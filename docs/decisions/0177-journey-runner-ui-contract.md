---
title: "Journey Runner UI contract — Fjernkontroll state machine + store-listing schema"
id: ADR-0177
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
---

# ADR-0177: Journey Runner UI contract — Fjernkontroll state machine + store-listing schema

## Context and Problem Statement

Spec v1.6.0 described the Fjernkontroll (remote control) UI and a store-listing surface but left the design contract loose — no Nordic Split token audit, no motion spec, no ARIA schema, no touch-target enforcement. Frontend-designer Phase 3 review identified hardcoded colors, missing `useReducedMotion()` guard, spring physics divergence from the design system, and absent ARIA live region on state transitions.

## Decision Drivers

- Nordic Split design system (OKLCH tokens, spring physics stiffness 35 / damping 22 / mass 2.2).
- WCAG AA contrast + 44pt minimum touch target (ADR-0068 sibling rule for drawer UIs).
- Fjernkontroll is a state-machine UI — every transition must be announced to assistive tech and respect reduced-motion preference.
- Store-listing cards are the surface that `close-feature.sh` reads into — schema divergence silently breaks the gate.

## Considered Options

1. **Full design contract** — state machine enumerated, tokens pinned, motion spec anchored, ARIA/touch enforced.
2. **Reference design system only** — "follow Nordic Split" without explicit contract.
3. **Implementation-deferred** — decide per-component during build.

## Decision Outcome

Chosen option: **"Full design contract"**, because (a) the prior council rejected v1.5.0 partly on under-specified UI, (b) Fjernkontroll has runtime branches that reviewers cannot verify post-hoc without a written state machine, (c) store-listing schema must be machine-readable by `close-feature.sh`.

### Fjernkontroll state machine (canonical)

| State | Transitions out | Visual signal | A11y announcement |
|---|---|---|---|
| `idle` | → `running` (on start), → `config` (on edit) | neutral orb | "Idle" |
| `running` | → `paused` (on pause), → `completed` (terminal), → `stuck` (on detector), → `failed` (on error) | pulsing orb, warm hue | "Running step {n} of {total}" |
| `paused` | → `running` (on resume), → `idle` (on reset) | steady orb, dimmed | "Paused at step {n}" |
| `stuck` | → `running` (on intervene), → `failed` (on timeout) | darkening orb, hue shift | "Stuck at step {n}. Intervene or abort." |
| `completed` | → `idle` (on dismiss) | success orb | "Completed in {duration}" |
| `failed` | → `idle` (on dismiss) | error orb (brand orange 40) | "Failed at step {n}: {error}" |

- All transitions wrapped in `useReducedMotion()` guard — when reduced-motion, transitions are opacity-only.
- Spring physics on orb transitions: stiffness 35, damping 22, mass 2.2 (Nordic Split canonical).
- ARIA live region (`role="status"` for non-terminal, `role="alert"` for `stuck`/`failed`) announces every transition.
- Zero hardcoded hex colors — `bg-background`, `text-foreground`, `border-border`, CSS variables only.
- Minimum touch target on all controls: 44pt (iOS HIG) / 48dp (Material).

### Store-listing card schema

```ts
interface JourneyStoreListingCard {
  journey_version_id: string;
  name: string;              // i18n key
  summary: string;           // i18n key
  status: JourneyVersionStatus;  // see ADR-0172
  ready_publish_at: string | null;
  last_dev_run: { run_id: string; completed_at: string | null; success: boolean } | null;
  capability_names: CapabilityName[];
  artefacts: { mission: boolean; guide: boolean; playwright: boolean; inference_pattern: boolean };
}
```

`close-feature.sh` validates `status === 'ready_publish'` + all four artefacts present before allowing merge.

## Rules & Consequences

- **Good, because** UI reviewable against a fixed specification; regressions detectable via visual-diff tests.
- **Good, because** `close-feature.sh` has a machine-readable contract to gate on.
- **Bad, because** state machine and schema must be versioned — breaking changes cascade to shell script + tests.
- **Agent Impact:** No UI ships without passing the Nordic Split token audit (no `zinc-*`, no `gray-*`, no hardcoded hex). Every transition wraps `useReducedMotion()`. Every state emits an ARIA announcement.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
