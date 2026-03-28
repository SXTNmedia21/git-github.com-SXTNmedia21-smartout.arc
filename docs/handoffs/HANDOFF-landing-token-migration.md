---
title: "Handoff — landing-token-migration"
feature: landing-token-migration
branch: feat/landing-token-migration
closed: 2026-03-28
module: landing
---

# Handoff — landing-token-migration

## Summary

Migrated the entire SmartOut landing page from hardcoded color values to design token CSS variable classes. Added `dark-section` utility, i18n for interactive components, English translations for pricing and about pages, URL-based locale detection, smooth theme transitions, and compare page link. Deleted 8 archived variant pages (~5,800 lines removed).

## What Was Done

### Design Token Migration (6 commits)

- **Footer** — Replaced all hardcoded colors with token classes (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-background`)
- **16 blocks** — HeroBlock, CtaSectionBlock, FaqBlock, FeaturesGridBlock, FeaturesIconsBlock, FeaturesListBlock, ImageSectionBlock, LogoStripBlock, PricingPreviewBlock, StatsBlock, TestimonialBlock, TextSectionBlock, CaseStudyBlock, ThemeProvider, VoiceWidgetBlock, WorkspaceAnalyzerBlock — all migrated to token classes
- **6 demo components** — AssistantPanel, DemoShell, JourneyCard, JourneyProgress, and 6 feature demos (Deviation, Haccp, Onboarding, PunchIn, Quiz, Schedule)
- **5 utility components** — next-page-banner, variant-badge, variant-dropdown, voice-assistant, workspace-analyzer

### dark-section Utility (1 commit)

- Added `.dark-section` class in `packages/design-tokens/src/tokens.css` that locally overrides all CSS variables to dark palette values
- Used in footer, ThemeProvider (CMS blocks), and DemoShell for always-dark regions
- Components inside use standard token classes — no special dark-mode awareness needed

### i18n for Interactive Components (2 commits)

- Added ~55 translation keys each for nb and en in `packages/i18n/locales/{nb,en}/landing.json`
- Wired i18n into `LandingInteractivePoll.tsx` and `LandingInteractiveMockup.tsx`

### English Pages + Locale System (3 commits)

- Created `/en/pricing/page.tsx` — full English translation of pricing page
- Created `/en/om-oss/page.tsx` — full English translation of about page
- Added `useLocale()` hook — detects locale from URL pathname (`/en/*` → "en")
- Updated Navigation to auto-prefix links with `/en/` when locale=en
- Updated LanguageSwitcher to detect locale from URL (no more stale state)
- Removed "AI som gjør teamet klar" tagline from variant badge/dropdown
- Added compare page link to pricing page

### Theme Transition (1 commit)

- Removed `disableTransitionOnChange` from ThemeProvider
- Added `transition-colors duration-300` on body for smooth dark/light toggle

### Cleanup (1 commit)

- Deleted 8 archived variant pages (A, E, F, I, K, S, T, V) — ~5,800 lines of dead code in `_archived/`

## Decisions

| #   | Decision                                                              | Rationale                                                              |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Use `dark-section` CSS class instead of `data-theme="dark"` attribute | CSS variable override is simpler, works with any element, no JS needed |
| 2   | Keep `dark-section` in tokens.css (not a Tailwind plugin)             | Aligns with Tailwind v4 CSS-based config approach, no build complexity |
| 3   | Delete archived variants rather than migrate them                     | Dead code with no route pointing to it, not worth maintaining          |
| 4   | Use explicit `var()` form for shadow values                           | Tailwind v4 shadow utility needs explicit `var(--shadow-*)` syntax     |
| 5   | Explicit English page files instead of middleware rewrites            | Middleware rewrites cause client-side 404 in Next.js App Router        |
| 6   | URL-based locale detection (`useLocale` hook) over server headers     | Client-side navigation doesn't trigger middleware, needs URL detection |
| 7   | Remove tagline from default variant                                   | User request — "AI som gjør teamet klar" no longer wanted              |

## Learnings

- **Tailwind v4 shadow gotcha:** Arbitrary shadow values require explicit `var()` wrapping — `shadow-[var(--shadow-sm)]` works, `shadow-sm` with custom CSS variable does not always resolve correctly in Tailwind v4
- **OKLCH warm hue consistency:** Using hue 50-55 across all dark-section variables keeps the warm Nordic tone even in dark regions, avoiding the cold gray look of neutral OKLCH values
- **dark-section pattern is reusable:** Any component tree can become always-dark by wrapping in `dark-section` — useful for embedded widgets, modals, or previews that should ignore the page theme
- **Middleware rewrites don't work for client-side nav:** Next.js App Router client-side transitions bypass middleware. Explicit page files needed for /en/ routes.
- **Next.js 16 deprecates middleware:** Warning appears but middleware still works. Future migration to `proxy.ts` needed.

## Known Issues / Debt

- **Remaining hardcoded colors:** Some shared components imported from `packages/ui` or `apps/web` may still use hardcoded zinc/gray values — those are outside the landing app scope
- **VariantMLanding.tsx** has minimal token changes (4 lines) — it may have additional hardcoded values that were not caught
- **Plan file** was committed as empty template — no substantive plan content was captured before implementation started

## Known Issues / Debt

- **Remaining hardcoded colors:** Some shared components imported from `packages/ui` or `apps/web` may still use hardcoded zinc/gray values — outside landing scope
- **Framer-motion mobile:** Pre-existing mobile animation issues not fixed (agent attempt reverted)
- **Missing /en/ pages:** Only /en/, /en/pricing, /en/om-oss, /en/docs have English. Other pages (compare, blog, features, etc.) still Norwegian on /en/ routes (404 until pages created)
- **Smartout logo:** Nav still uses Building2 icon — user wants actual logo SVG

## Next Steps

- Create English page files for remaining routes (/en/compare, /en/blog, /en/features/\*)
- Replace Building2 icon with Smartout logo SVG in navigation
- Migrate middleware.ts to proxy.ts (Next.js 16 deprecation)
- Fix framer-motion mobile issues manually
- Audit `packages/ui` for remaining hardcoded color values
