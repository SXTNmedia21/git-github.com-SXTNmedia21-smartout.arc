---
title: "Journey — Landing Token Migration"
status: done
updated: 2026-03-28
created: 2026-03-27
module: landing
tags: [journey, landing, design-tokens]
---

# Journey — Landing Token Migration

## Journey: Visitor — Browse Landing Page

**Precondition:** Visitor navigates to the SmartOut landing page (any variant).

1. Visitor loads landing page → System renders all blocks (Hero, Features, Stats, Testimonials, CTA, FAQ, Pricing, etc.) using design token CSS variables (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`) → Visitor sees consistent warm OKLCH color palette throughout
2. Visitor scrolls through always-dark sections (footer, demo shell, ThemeProvider blocks) → System applies `dark-section` utility class that overrides CSS variables to dark palette locally → Visitor sees proper dark styling without global theme switching
3. Visitor interacts with Poll component → System renders poll steps with token-based styling and i18n translations → Visitor sees localized question flow (nb/en) with consistent design tokens
4. Visitor interacts with Mockup component → System renders interactive dashboard mockup with token-based styling and i18n translations → Visitor sees localized mockup content with consistent design tokens
5. Visitor views footer → System renders footer with `dark-section` class, token-based link colors and borders → Visitor sees consistent dark footer with proper hover states

**Postcondition:** Entire landing page renders with design tokens — no hardcoded zinc/gray/white color values in landing-specific components.

**Error paths:**

- If CSS variables are not loaded (broken import), components fall back to browser defaults (unstyled) — this would be caught by visual regression
- If i18n namespace fails to load, poll/mockup show translation keys as raw strings

---

## Journey: Developer — Maintain Landing Styles

**Precondition:** Developer needs to update landing page colors or add a new block.

1. Developer reads design tokens in `packages/design-tokens/src/tokens.css` → System provides all CSS variable definitions including `dark-section` utility → Developer understands the available palette
2. Developer creates new block component → Uses token classes (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`) instead of hardcoded colors → New block automatically inherits theme
3. Developer needs an always-dark region → Adds `dark-section` class to wrapper element → All child components using token classes automatically render in dark palette without additional styling
4. Developer updates brand colors → Changes OKLCH values in `tokens.css` → All landing blocks, footer, demo shell, and utility components update automatically

**Postcondition:** Developer can maintain and extend landing page styling through token changes only, without touching individual component color values.

**Error paths:**

- Developer uses hardcoded color (e.g. `text-zinc-400`) → Inconsistent with token palette, will not respond to theme changes — caught by code review
- Developer nests `dark-section` inside another `dark-section` → No harm, CSS variables re-declare same values

---

## Journey: International Visitor — Browse in English

**Precondition:** Visitor navigates to /en/ or clicks EN in language switcher.

1. Visitor clicks EN toggle in navigation → LanguageSwitcher sets `smartout-locale=en` cookie and navigates to `/en{current_path}` → Visitor sees EN highlighted in the toggle
2. Visitor arrives at `/en/pricing` → System renders English pricing page with translated content (tiers, features, CTAs) → Visitor sees pricing in English
3. Visitor clicks nav links → Navigation auto-prefixes all links with `/en/` via `useLocale()` hook → Visitor stays in English context
4. Visitor clicks NO toggle → LanguageSwitcher sets `smartout-locale=nb` cookie and navigates to stripped path → Visitor returns to Norwegian

**Postcondition:** Visitor can browse pricing and about pages in English. Navigation maintains locale context.

**Error paths:**

- Visitor navigates to `/en/compare` (no English page yet) → 404 — page file not created yet
- Client-side navigation loses locale on hard refresh → Middleware reads cookie and sets `x-locale` header correctly

---

## Journey: Visitor — Theme Toggle

**Precondition:** Visitor is on any landing page.

1. Visitor clicks theme toggle (sun/moon icon) → ThemeProvider switches class on html element → Body transitions smoothly via `transition-colors duration-300` → Visitor sees gradual color change over 300ms
2. Visitor preference persists → next-themes stores in localStorage → On return visit, theme is restored

**Postcondition:** Theme transitions are smooth, not abrupt.

**Error paths:**

- System preference changes while on page → `enableSystem` detects and transitions smoothly
