---
title: "Handoff — onboarding-cleanup"
status: done
updated: 2026-03-26
created: 2026-03-26
module: onboarding
tags: [handoff, onboarding, cleanup]
---

# Handoff — onboarding-cleanup

## Summary

Cleaned up the onboarding wizard: deleted ~9900 lines of dead showcase code, added safety guards (server-side redirect, Zod tool validation, emit telemetry), unified redirect logic, migrated to design tokens and i18n keys, formalized motion constants.

## What was built

1. **Showcase deletion** — Removed entire `apps/web/src/app/onboarding/showcase/` directory (~44 files)
2. **Safety guards** — Server-side re-entry guard via middleware redirect, emit() on finalization
3. **Zod tool schemas** — All 14 Botsson tools now validate input via Zod in `lib/tool-schemas.ts`
4. **i18n compliance** — brandPanel messages use i18n keys (nb + en locales)
5. **Unified redirects** — Single redirect utility in `lib/redirect.ts`
6. **Design tokens** — Replaced hardcoded hex colors with CSS variables
7. **Motion constants** — Shared easing values in `lib/motion.ts`

## Decisions made

| Decision                                               | Reason                                                    | Impact                    |
| ------------------------------------------------------ | --------------------------------------------------------- | ------------------------- |
| Delete showcase/ (44 files, 2000+ lines)               | Dead code, never deployed, no routes linking to it        | -9700 lines               |
| Server-side guard in layout.tsx (not middleware)       | Avoids DB query on every request, only checks /onboarding | Prevents re-entry         |
| Zod schemas in dedicated tool-schemas.ts               | Single source of truth for tool validation, not inline    | 14 tools validated        |
| brandPanel i18n via key resolution in renderBrandPanel | No WizardShell package type change needed                 | nb + en locales           |
| Unified redirect via lib/redirect.ts                   | Uses NEXT_PUBLIC_ROOT_DOMAIN env var consistently         | 3 redirect sites unified  |
| Easing constants in design-tokens                      | easingExpo + array variants, formalized                   | 24 inline arrays replaced |

## Learnings

| Learning                                                         | Context                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Ultravox client tools receive params as strings, need JSON.parse | Zod transform handles this cleanly via jsonArray/jsonObject helpers |
| Design tokens should include Framer Motion array equivalents     | CSS cubic-bezier strings aren't directly usable in framer-motion    |
| Server-side layout guards are cheaper than middleware guards     | Layout only runs for /onboarding requests, middleware runs on all   |

## Known issues / debt

- Accessibility audit (contrast, focus, aria) not yet done — follow-up work
- 2 blue accent oklch(250) orbs in HeroSection + AmbientBackground are intentional visual variety, not token violations
- 24 pre-existing walkAi/agent-sdk typecheck errors unrelated to this branch

## Next steps

- Full accessibility audit as separate feature
- Consider removing legacy onboarding_session table (fully replaced by workspace.intelligence_data)
