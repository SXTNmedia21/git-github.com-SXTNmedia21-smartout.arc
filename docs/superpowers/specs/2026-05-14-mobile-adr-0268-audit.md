---
title: Mobile ADR-0268 Accept-Checklist Audit + Cleanup
status: draft
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [mobile, audit, adr-0268, i18n, helpdesk, drift-fix]
adr: ADR-0268
supersedes: docs/superpowers/specs/archive/2026-05-13-mobile-restore-4tab-plan-SUPERSEDED.md
---

# Mobile ADR-0268 Accept-Checklist Audit + Cleanup

## Context

ADR-0268 "TabBar Canonical Layout" (proposed 2026-05-04) adopted 5-tab canonical (Kalender | Vakter | ⊕ FAB | Chat | Min Tid). Live code already matches the 5-tab layout per audit 2026-05-13 (A1 haiku, `apps/mobile/app/(app)/_layout.tsx:8-10` header reads "Canonical layout per ADR-0268"). ADR status is still `proposed`; accept gate is Phase 3f. Five accept-checklist items remain:

1. wt-1 cancel/rebase — **DONE** per audit 2026-05-13 (wt-1 carries unrelated `feat/sma-328-aml-14-15-trekk-consent`, old 4-tab branch deleted).
2. wt-7 locked branch delete — handled via rename of `feat/mobile-restore-4tab-plan` → `feat/mobile-adr-0268-audit` 2026-05-14.
3. Phase 3f delivers 5-tab `_layout.tsx` — **DONE** (live in code).
4. `(komm)` helpdesk thread continuity verified post tab-removal.
5. i18n keys registered for `Kalender`, `Vakter`, `Min Tid`.

Items 4 + 5 + cleanup of dead `(home)/index.tsx` redirect-stub are open.

## Goal

Drive ADR-0268 from `proposed` → `accepted` by closing the three remaining items + cleaning the dead `(home)` stub. Preserve ADR-0132 (BFF), ADR-0133 (Execute boundary), ADR-0134 (telemetry), ADR-0135 (LiveKit voice), ADR-0163 (kanaler-som-helpdesk).

## Scope

- Verify or register i18n keys: `tabs.kalender`, `tabs.vakter`, `tabs.chat`, `tabs.minTid`.
- Verify `(komm)` helpdesk threads still reachable after tab-removal per ADR-0163 absorption path.
- Delete dead `(home)/index.tsx` redirect-stub (and `(home)` route group if all referrers cleaned).
- Update any deeplinks pointing to deleted `(home)` routes (per A1: `task_assigned`, `deviation_reported`, `join_request`, `contract_declined`, `reconciliation_pending_signoff`).
- Flip ADR-0268 status `proposed` → `accepted` after Council verification.

## Out of scope

- Re-implementing the 5-tab layout — already lives in code.
- Native superpowers (camera, biometric, GPS) — future sortie.
- `(komm) → Chat` absorption implementation — ADR-0163 separate scope; this audit verifies continuity only.
- Min Tid content — ADR-0268 §"Min Tid V1 scope" allows thin relabel for V1.

## Risks

1. `(home)/shift-hub.tsx` content has business logic (NoShiftView, BeforeShiftView, DuringShiftView, AfterShiftView) per A1 audit. ADR-0268 §"Tab removal sequence" says "Logic in `shift-hub.tsx` merges into Kalender DayView OR Vakter sub-screen. Phase 3f will decide." Cleanup must not delete shift-hub.tsx without absorption plan — only the redirect-stub `(home)/index.tsx` is safe-delete.
2. Deeplinks targeting `(home)` paths still active per A1 (`packages/notifications/src/deep-links.ts`). Updating them needs care — push notifications in flight must not 404 mid-rollout.
3. `(komm)` removal may break helpdesk threads if ADR-0163 absorption isn't fully wired.

## References

- ADR-0268: [docs/decisions/0268-tabbar-canonical-layout.md](../../decisions/0268-tabbar-canonical-layout.md)
- ADR-0163: kanaler-som-helpdesk
- A1 audit output (2026-05-13): mobile surface inventory
- A2 audit output (2026-05-13): ADR-0268 supersession verification
- Memory: `mobile-4tab-drift-2026-05-03-superseded` (replaces prior 4-tab drift entry)
- Learning: `verify-adrs-before-acting-on-drift-memory` (2026-05-13)
