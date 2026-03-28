---
title: "Handoff — financial-esp-ux"
feature: financial-esp-ux
branch: feat/financial-esp-ux
closed: 2026-03-28
module: operations
---

# Handoff — financial-esp-ux

## Summary

Added UX wiring for the Financial ESP system: sidebar navigation to reconciliation, admin settings UI for financial close config (tolerance, cash count, approval rules), status badge on the Økonomi tab, and user journey documentation. This completes the discoverability layer — users can now find and configure the financial close workflow.

## What Was Done

- [x] Added "Avstemming" NavItem to sidebar navigation (between Rapporter and Administrasjon)
- [x] Created financial-close-settings.tsx with tolerance, cash count, and approval config UI
- [x] Added "Dagsoppgjor" tab to Settings under General section
- [x] Added settlement status badge to Økonomi tab in day-control drawer
- [x] Wrote 4 user journeys (employee submits, admin approves, admin configures, admin reads dashboards)
- [x] Council review: replaced hardcoded colors with semantic CSS variables (success/warning tokens)

## Decisions Made

| Decision                                              | Reason                                                         | Impact                                              |
| ----------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Avstemming in sidebar under Drift, not Administrasjon | It's an operational view accessed daily, not admin config      | Higher visibility for managers                      |
| financial_close_config defaults-first approach        | Config created on first admin visit, not bootstrap             | Simpler onboarding, I1 bootstrap can be added later |
| Semantic color tokens for status banners              | Council review flagged WCAG 1.4.1 and design system compliance | Consistent theming in dark/light mode               |

## Learnings

| Learning                                                  | Context                                                                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client-side KPI previews create dual-source-of-truth risk | Council found useApproveReconciliation calculates KPIs client-side AND engine action does it server-side. Optimistic UI OK for responsiveness, never for persisted outcomes. |
| Hardcoded Tailwind colors break theming silently          | emerald-500/amber-500 render differently from design tokens in dark mode. Always use semantic variables.                                                                     |

## Known Issues / Debt

- Form accessibility: htmlFor/aria-label not wired on all OkonomiTab inputs (P1)
- Pattern alignment: OkonomiTab should use shadcn Input/Select, not native HTML elements (P1)
- Motion: missing entrance animations on tab content and KPI cards (P2)
- font-mono: financial numbers should use tabular-nums for alignment (P2)
- i18n: hardcoded Norwegian strings in OkonomiTab and financial-close-settings (tracked)
- Dead code: payrollSettingsPromise in use-operations-data.ts (fetched, result discarded)
- Client-side KPI calc in useApproveReconciliation should be removed once engine action is confirmed working

## Next Steps

- Wire form accessibility (htmlFor, aria-label) on OkonomiTab and financial-close-settings
- Add entrance animations following Nordic Split spring physics
- Convert hardcoded Norwegian strings to i18n keys
- Remove dead payrollSettingsPromise code
- Add financial_close_config to I1 bootstrap step list
