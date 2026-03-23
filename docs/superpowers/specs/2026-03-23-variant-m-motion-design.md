---
title: Variant M ("Motion") Landing Redesign Spec
status: draft
updated: 2026-03-23
created: 2026-03-23
module: landing
tags: [variant-m, framer-motion, motion, ai-native, ren-og-varm, website-factory]
---

# Variant M ("Motion") Landing Redesign Spec

> Blueprint for the complete re-architecture of Variant M (`?v=M`), establishing "App in Motion" and "AI Native" as the core narrative for Smartout, supported by heavy `framer-motion` scroll animations and the _Ren og Varm_ design system tokens.

## 1. Executive Summary

The user has requested that Variant M becomes a full "App in Motion" experience, moving away from static software marketing to dynamic, AI-native storytelling. The layout must progress logically through key Smartout value props (Hero -> Vaktplan -> Website Factory -> Pricing Why -> Comparison -> AI Assistant Ownership).

Critically, the entire experience—including subpages linked from Variant M—must strictly adhere to the _Ren og Varm_ design tokens (`text-foreground`, `bg-background`, `text-success`) to ensure flawless dark/light mode transitions, and must maintain the `?v=M` routing state across navigation.

## 2. Narrative Arc (The "M" Progression)

The landing page (`VariantMLanding.tsx`) will be structured in the following sequential sections:

1. **Hero (Take a step into the future)**: Sleek, motion-heavy background. "AI is doing the job for a thousand others, why shouldn't it do it for you?"
2. **App in Motion (Vaktplan / Uke 42)**: Expansive scroll animation. A schedule building itself dynamically with shift blocks flying in.
   - **Interactive Elements**: Not just visual. If a user clicks a shift card, a detailed popover emerges showing "Requirements, Supplements/Tariff, etc."
   - **Daily Operations Layer**: Alongside the schedule, dynamic cards for "Daily Message" (Dagens beskjed) and "Vacation Requests" (Ferieforespørsler) slide in, showing a complete, busy operational screen.
   - **Lise Botsson Interactive**: Clicking the Lise Botsson bubble expands it to explain: "Smartout is AI-driven with an AI learning framework designed to get to know you and your company."
3. **Interactive Polling / Engagement**: Interspersed throughout the page, elegant polling questions to engage the user (e.g., "How many staff members do you have?", "What is the biggest problem in your restaurant?"). Clicking an option provides immediate visual feedback and transitions the narrative based on their choice.
4. **Website Factory**: "A solid instrument". Visualizing the translation of workspace data into a fully-fledged, elegant public website.
5. **Pricing Why**: "Why is Smartout Free? Because we only charge for the time we save you." A dedicated section explaining the core philosophy versus the premium upgrade.
6. **Comparison (Sammenligning)**: "What can you expect when using Smartout compared to other services?" A bridge to the existing `/compare` page, or an embedded insight.
7. **Data & Roles**: What we do for you. Analytics and role-based delegation.
8. **AI Assistant Ownership**: The finale. Lise Botsson acting as the operational owner who works while the human owner rests.

## 3. Subpages & Navigation Architecture

### Variant State Preservation

When a user arrives at `/?v=M`, the `useVariant()` hook (already updated) stores `M` in `localStorage`. However, to ensure seamless navigation _without_ hydration flickers, the `<Navigation />` component and all internal Next.js `<Link>` components must be updated.

**Implementation detail:**
Update `Navigation.tsx` (and `Footer.tsx`) to append `?v=M` to hrefs dynamically if the current active variant is M. E.g., clicking "Vaktplan" should route to `/features/shiftplanner?v=M`.

### Subpages to Refactor for M-Variant

The following existing (or new) subpages must be overridden to render a `VariantM`-specific layout when `v=M` is present:

- `/features/shiftplanner` (Vaktplan)
- `/features/website-factory` (New subpage based on `website-factory-design.md`)
- `/pricing` (Pricing Why)

All these pages must use `framer-motion` for entrance animations and exclusively use CSS variables (`var(--background)`, `var(--card)`, etc.) from the `@smartout/design-tokens` package.

## 4. Technical Constraints & Rules

- **No Hardcoded Colors**: `emerald-500`, `zinc-900`, `#050505` are strictly forbidden. Use `bg-success`, `bg-background`, `bg-card`, etc.
- **Framer Motion**: Heavy use of `useScroll` and `useTransform` for parallax and scroll-linked animations (e.g., the Vaktplan building itself).
- **GDPR & Tracking**: All CTA buttons must use the `TrackedCta` component from `apps/landing/src/components/tracking.tsx`.
- **Light/Dark Mode**: Relies on `next-themes` and the `ThemeProvider` installed at the root layout.

## 5. Implementation Plan (Steps)

1. **Nav/Routing**: Update `Navigation.tsx` to conditionally append `?v=M` to links.
2. **Homepage Expansion**: Expand `VariantMLanding.tsx` to include the 7-step narrative arc defined in section 2.
3. **Complex Vaktplan Animation**: Build the interactive, non-cutoff Vaktplan component inside the homepage.
4. **Pricing Why Section**: Build the "Time saved" narrative block.
5. **Website Factory Subpage**: Create `/features/website-factory/page.tsx` adhering to the M-variant design language.
