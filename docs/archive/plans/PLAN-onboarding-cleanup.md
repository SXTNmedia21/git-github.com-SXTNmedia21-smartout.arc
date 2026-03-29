---
title: "Plan — onboarding-cleanup"
status: done
updated: 2026-03-26
created: 2026-03-26
module: onboarding
tags: [plan, cleanup, compliance]
---

# Plan — onboarding-cleanup

> Branch: `feat/onboarding-cleanup` | Module: onboarding

## Goal

Clean up the onboarding wizard: delete dead showcase code, fix safety gaps, add Zod validation to AI tools, i18n compliance, unify redirects, and fix design token violations.

## Scope

### In scope

- Delete `apps/web/src/app/onboarding/showcase/` (~44 files, ~2000 lines)
- Fix saveMemory (client-side only, missing API persistence)
- Add emit() to finalization step
- Add server-side re-entry guard (middleware redirect)
- Zod schemas on all 14 Botsson tools
- i18n keys for brandPanel messages
- Unify 3 redirect patterns into 1
- Fix layout hue (oklch with wrong hue → token)
- Replace hardcoded hex colors with CSS variables
- Formalize easing constants (replace hardcoded cubic-bezier)
- Accessibility audit (contrast, focus, aria)

### Out of scope

- New features or UI changes
- Onboarding flow restructuring
- Mobile onboarding

## Tasks

| #   | Phase | Task                                              | Estimate |
| --- | ----- | ------------------------------------------------- | -------- |
| 0.1 | 0     | Delete showcase/ directory (~44 files)            | 5 min    |
| 1.1 | 1     | Fix saveMemory — ensure API persistence works     | 15 min   |
| 1.2 | 1     | Add emit() to finalizeOnboarding                  | 10 min   |
| 1.3 | 1     | Add server-side guard (middleware redirect)       | 15 min   |
| 2.1 | 2     | Add Zod schemas to all 14 Botsson tools           | 30 min   |
| 2.2 | 2     | Replace brandPanel hardcoded text with i18n keys  | 15 min   |
| 2.3 | 2     | Unify redirect logic into single function         | 15 min   |
| 3.1 | 3     | Fix layout bg to use CSS variable / correct hue   | 10 min   |
| 3.2 | 3     | Replace hardcoded hex (#1a1a1a) with tokens       | 10 min   |
| 3.3 | 3     | Formalize easing constants, replace inline arrays | 15 min   |
| 3.4 | 3     | Accessibility pass (contrast, focus, aria)        | 20 min   |

## Acceptance Criteria

- [ ] showcase/ directory deleted, no imports referencing it
- [ ] saveMemory persists to API when workspace context exists
- [ ] emit() fires on onboarding finalization with "onboarding completed" event
- [ ] Server middleware redirects completed users away from /onboarding
- [ ] All 14 tools have Zod .parse() on input params
- [ ] brandPanel uses i18n keys, no hardcoded Norwegian
- [ ] Single redirect utility used by all completion paths
- [ ] No hardcoded hex colors in onboarding code
- [ ] Easing values use shared constants from design tokens
- [ ] pnpm turbo typecheck passes with 0 errors
