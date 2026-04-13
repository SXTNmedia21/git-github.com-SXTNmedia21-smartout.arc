---
title: "Clickable row actions require propagation contract"
id: LEARNING_0031
status: canonical
layer: learning
created: 2026-04-10
updated: 2026-04-10
tags: [platform-admin, ui, interaction, posthog, landing]
---

# Learning-0031: Clickable row actions require propagation contract

## Context

During council review of the Platform Admin -> PostHog phase-1 bridge, we introduced a second entry point (row-level quick action) in tables where rows already open detail sheets on click.

## Discovery

When interactive controls are placed inside clickable table rows, click events must be explicitly isolated. Without a propagation contract, one user action can trigger two competing behaviors (open detail + open external link), creating inconsistent and misleading UX.

## Impact

For all Smartout admin tables with row-level navigation:

- Any in-row action control must stop propagation from the row click handler.
- Action controls must have explicit accessibility labels and predictable keyboard behavior.
- External handoff controls must use consistent icon/copy between row and detail surfaces.

This is now a merge-gate check for row-action additions in clickable table patterns.

## References

- `docs/decisions/0037-landing-event-tracking.md` (2026-04-10 addendum)
- `docs/council/COUNCIL-LOG.md` (2026-04-10 session)
