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

- Showcase code was dead (never deployed, no routes linking to it) — safe to delete
- saveMemory fix deferred (pending decision: remove tool vs queue-and-flush)
- Layout hue question flagged for Pontus (intentional departure or drift?)

## Known issues / debt

- saveMemory tool still client-side only (no API persistence) — needs separate decision
- Layout hue may need adjustment pending Pontus review
- Accessibility audit (contrast, focus, aria) partially done — full audit is follow-up work

## Next steps

- Decide saveMemory strategy (remove tool or add API endpoint)
- Pontus to confirm layout hue intent
- Full accessibility audit as separate feature
