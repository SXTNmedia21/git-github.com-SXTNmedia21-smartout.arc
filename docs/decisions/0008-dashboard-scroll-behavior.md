---
title: "ADR-0008: Dashboard Scroll Behavior & Dynamic Layout"
id: ADR_0008
status: accepted
layer: decision
created: 2026-02-25
updated: 2026-02-25
---

# ADR-0008: Dashboard Scroll Behavior & Dynamic Layout

## Status

Accepted

## Date

2026-02-25

## Context

When navigating between modules and rendering potentially large lists (like the People Data Table or Communications chat), we noticed that components were contributing to a full window scroll. A full page scroll breaks the "app-like" experience since the top context bar and left sidebar navigation should remain fixed and always visible.

However, vertically stacking large metadata components (like Metric Cards, Search inputs, and Filters) consumes significant vertical screen real estate, squeezing the main scrollable functional components (like Tables or Chats) into a small viewport.

## Decision

We will implement fixed dashboard page structures (`flex-1 min-h-0 h-full flex flex-col overflow-hidden`) combined with internally scrollable dynamic blocks.

To preserve vertical real estate while providing rich context:

1. **Dynamic Headers**: Top metadata cards and secondary action bars (like search/filters) will automatically shrink, hide, or collapse when the user scrolls down within the main content block.
2. **Scroll Tracking**: The primary scrolling container (e.g., the Data Table wrapper or Chat Message list) will track `scrollTop` to determine scroll direction.
3. **Restoration**: Scrolling back up should instantly restore the hidden headers to allow quick access to context and filters without losing position.

## Rationale

- Ensures the shell constraints (fixed navigations) are strictly respected regardless of content height.
- Maximizes screen real estate for the primary focus area (lists/tables) during continuous reading/scrolling.
- Offers a premium, native-app feel compared to standard web page scrolling.

## Consequences

- Components must implement their own internal scroll wrappers (`overflow-y-auto`).
- Page-level states (e.g., `isCompact`) are required to orchestrate the synchronization between the scrolling component and the dynamic headers.
- Developers need to use CSS transitions on `max-height`, `opacity`, and `padding`/`margins` to animate the collapsing elements smoothly.
