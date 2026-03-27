---
title: "Handoff — landing-token-migration"
feature: landing-token-migration
branch: feat/landing-token-migration
closed: 2026-03-27
module: landing
---

# Handoff — landing-token-migration

## Summary

Migrated the entire SmartOut landing page from hardcoded color values (zinc-_, white, gray-_, hex codes) to design token CSS variable classes. Added a `dark-section` utility for always-dark regions. Added i18n support for Poll and Mockup interactive components. Deleted 8 archived variant landing pages (~5,800 lines removed).

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

### Cleanup (1 commit)

- Deleted 8 archived variant pages (A, E, F, I, K, S, T, V) — ~5,800 lines of dead code in `_archived/`

## Decisions

| #   | Decision                                                              | Rationale                                                              |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Use `dark-section` CSS class instead of `data-theme="dark"` attribute | CSS variable override is simpler, works with any element, no JS needed |
| 2   | Keep `dark-section` in tokens.css (not a Tailwind plugin)             | Aligns with Tailwind v4 CSS-based config approach, no build complexity |
| 3   | Delete archived variants rather than migrate them                     | Dead code with no route pointing to it, not worth maintaining          |
| 4   | Use explicit `var()` form for shadow values                           | Tailwind v4 shadow utility needs explicit `var(--shadow-*)` syntax     |

## Learnings

- **Tailwind v4 shadow gotcha:** Arbitrary shadow values require explicit `var()` wrapping — `shadow-[var(--shadow-sm)]` works, `shadow-sm` with custom CSS variable does not always resolve correctly in Tailwind v4
- **OKLCH warm hue consistency:** Using hue 50-55 across all dark-section variables keeps the warm Nordic tone even in dark regions, avoiding the cold gray look of neutral OKLCH values
- **dark-section pattern is reusable:** Any component tree can become always-dark by wrapping in `dark-section` — useful for embedded widgets, modals, or previews that should ignore the page theme

## Known Issues / Debt

- **Remaining hardcoded colors:** Some shared components imported from `packages/ui` or `apps/web` may still use hardcoded zinc/gray values — those are outside the landing app scope
- **VariantMLanding.tsx** has minimal token changes (4 lines) — it may have additional hardcoded values that were not caught
- **Plan file** was committed as empty template — no substantive plan content was captured before implementation started

## Next Steps

- Audit `packages/ui` components used by landing for remaining hardcoded color values
- Consider extending `dark-section` pattern to dashboard embedded previews
- Visual regression testing for all landing page variants in both light context and dark-section regions
