# ADR-0021: Global Scrollbar Standard via Design Tokens

**Status:** Accepted
**Date:** 2026-02-28

## Context and Problem Statement

The project had inconsistent scrollbar styling. Some components used a `.custom-scrollbar` utility class for slim, dark scrollbars while others relied on default browser scrollbars — resulting in an inconsistent, unprofessional look. The custom scrollbar was also hardcoded for dark mode only, with no light mode adaptation.

## Decision Drivers

- Scrollbars must look consistent across the entire project — both `apps/web` and `apps/landing`
- The project supports light and dark mode via design tokens; scrollbars must respect this
- Developers should not need to remember to add a class — it should be automatic
- The scrollbar style should be defined once and inherited everywhere

## Considered Options

1. **Per-component `.custom-scrollbar` class** — the previous approach. Requires manual opt-in on every scrollable element. Easy to forget.
2. **Global `*` selector with CSS custom properties** — apply scrollbar styling to all elements via `@layer base`, using design token variables for theme awareness.
3. **Tailwind plugin** — create a custom Tailwind plugin for scrollbar utilities. Adds build complexity for little gain.

## Decision Outcome

Chosen option: **Option 2 — Global `*` selector with CSS custom properties**, because it requires zero developer effort, adapts to light/dark mode automatically, and centralizes the definition in the design token system.

### Implementation

**Design tokens** (`packages/design-tokens/src/tokens.css`):

```css
:root {
  --scrollbar-thumb: oklch(0.78 0 0); /* light gray on white */
  --scrollbar-thumb-hover: oklch(0.65 0 0); /* darker on hover */
  --scrollbar-track: transparent;
}

.dark {
  --scrollbar-thumb: oklch(0.35 0 0); /* dark gray on dark */
  --scrollbar-thumb-hover: oklch(0.45 0 0); /* lighter on hover */
  --scrollbar-track: transparent;
}
```

**Global CSS** (both `apps/web/globals.css` and `apps/landing/globals.css`):

```css
@layer base {
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }
  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  *::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
  *::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    border-radius: 20px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-thumb-hover);
  }
}
```

## Rules & Consequences enforced for Agents

- **Good, because** every scrollbar in both apps is now consistent with zero effort — no class to remember
- **Good, because** it respects light/dark mode via the same design token system used for all other colors
- **Good, because** it uses both WebKit pseudo-elements and Firefox `scrollbar-width`/`scrollbar-color` for cross-browser support
- **Bad, because** overriding for a specific element requires `style` attributes or more specific selectors (unlikely to be needed)
- **Agent Impact:** Never add `.custom-scrollbar` classes — scrollbar styling is global. If scrollbar tokens need adjustment, edit `packages/design-tokens/src/tokens.css` (the `--scrollbar-*` variables). Never define scrollbar styles inline or in component CSS.
