---
id: L-0275
title: "data-testid additions belong to Track H (test-author scope), not build tracks"
status: accepted
date: 2026-05-15
discovered_in: feat/dagslinjen-quickadd (Track G + H)
related_adrs: []
tags: [process, e2e-testing, scope-discipline]
---

# data-testids are a Track H polish step, not a Track C/D/E concern

## Discovery

Track G (Playwright E2E specs author) was instructed to write specs for
4 journeys but **not** to add `data-testid` attributes to components
written by Tracks C/D/E. Track G correctly:

- Left `TODO(Track H): add data-testid="..."` comments inline in specs
- Listed 10+ missing testids in its handoff
- Used best-effort selectors (`aria-label`, role+name, text-content)
  in the meantime

Track H (this) then added all 12 testids in a single commit
(`30f3cdacf`) as a focused polish step.

## Why this separation works

- **Build tracks (C/D/E)** focus on behavior + design tokens + Nordic
  Split + i18n. They shouldn't be slowed by speculative test selectors.
- **Test author (Track G)** discovers the actual selector friction at
  write-time and reports back with a concrete list, not a hand-wave.
- **Closer (Track H)** has the full picture (specs + component code)
  and can add testids consistently across 5 files in one commit
  without bikeshed.

## Lesson

For future sorties with parallel-track build + test-author + closer:

1. Build agents: do NOT pre-emptively sprinkle `data-testid` everywhere.
   Only add them when behavior depends on test infrastructure.
2. Test-author: list every missing testid in handoff with proposed
   naming convention.
3. Closer: add them in a single `test(scope): add data-testid hooks for
   E2E specs` commit. Verify with one `grep -rn "data-testid"` after.

This is a clean separation of concerns and survives parallel work.

## Naming convention (informal)

- Root containers: `data-testid="<component-name-kebab>"`
- Action sub-elements: `data-testid="<component-name>-action-<action>"`
- Error spans: `data-testid="<field-name>-error"`

Used in this sortie: `slot-quickadd-popover`, `slot-quickadd-action-booking`,
`scope-filter-pill`, `daily-note-sheet`, `audience-section-toggle`,
`audience-error`, `notify-at-input`, `notify-at-error`,
`shift-start-dialog`, `timeline-empty-state`, `note-body`.

## Promote to ADR?

No — this is process discipline, not an architectural decision.
Document in `feature-dev` skill or council-style guide if it becomes
canonical.
