---
title: Mobile 4-Tab Restoration + AI FAB
status: draft
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [mobile, refactor, drift-fix, fab, navigation, adr-0132, adr-0133, adr-0134, adr-0135]
canonical-plan: docs/superpowers/plans/completed/2026-03-24-mobile-ui-master-plan.md
---

# Mobile 4-Tab Restoration + AI FAB

## Context

Mobile drifted from the 2026-03-24 master-plan: 6 tabs live, plan specified 4 + center FAB. `digest` and `(komm)` tab groups added via helpdesk + daily-operation campaigns without ADR. `(home)/index.tsx` is a redirect-stub to `shift-hub.tsx`.

Pontus mental model: "Home er ikke side, Home = anker, FAB = reset" — matches master-plan exactly.

## Goal

Restore mobile to the 4-tab + AI FAB scaffold defined in the canonical plan. Preserve ADR-0132 (BFF routing), ADR-0133 (Execute-only boundary), ADR-0134 (telemetry fail-fast), ADR-0135 (LiveKit voice). No new authoring surfaces.

## Target surface

- 4 tabs: Hjem | Vakter | [FAB center] | Chat | Meg (rename to "Min tid" pending Pontus call)
- FAB = visual anchor at center tab slot. Tap opens AI chat sheet.
- AI chat sheet routes through `/api/emma/chat` (BFF, ADR-0132).

## Out of scope

- New native superpowers (camera evidence, biometric, GPS clock-in) — these come AFTER scaffold is correct.
- Web changes — refactor is mobile-only.
- Authoring UIs on mobile — ADR-0133 boundary.

## Risks

1. `digest` / `(komm)` may contain unique features not in 4-tab plan (data-loss risk → A2 audit).
2. `(komm)` may be load-bearing to ADR-0186 guardian fanout (cross-system risk → A2 ADR check).
3. `(home)/index.tsx` may be referenced by push-deeplink handler (A1 deeplink scan).
4. Rename Meg → Min tid may break deeplinks (B1 grep + ask Pontus).

## Reference

Canonical plan: [2026-03-24-mobile-ui-master-plan.md](../plans/completed/2026-03-24-mobile-ui-master-plan.md)
Memory: `project_mobile_4tab_drift_2026_05_03.md`
ADRs: 0132, 0133, 0134, 0135, 0186
