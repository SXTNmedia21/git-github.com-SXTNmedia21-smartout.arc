---
title: Mobile Phase 3f — (home) Absorption + Route Deletion
status: draft
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [mobile, phase-3f, refactor, drift-fix, adr-0268, adr-0133, deeplinks]
adr: ADR-0268
prior-sortie: docs/HANDOFF-mobile-adr-0268-audit.md
---

# Mobile Phase 3f — `(home)` Absorption + Route Deletion

## Context

ADR-0268 §"Tab removal sequence" (line 64) defers `(home)` business-logic absorption to "Phase 3f". Prior sortie `mobile-adr-0268-audit` (closed 2026-05-14, merge `fd77b4b0c`) accepted ADR-0268, deleted the dead `(home)/index.tsx` redirect-stub, and retargeted 3 deeplinks (`task_assigned`, `join_request`, `contract_declined`) away from `(home)`. Three items remained:

- `(home)/shift-hub.tsx` + ~18 sibling files still live under `(home)/` (rich business logic: NoShiftView, BeforeShiftView, DuringShiftView, AfterShiftView, clockout, punch-clock, deviation, haccp, safety-round, training, etc.)
- `<Tabs.Screen name="(home)" options={{ href: null }} />` still registered in `_layout.tsx` as hidden route
- `packages/notifications/src/deep-links.ts` lines 50 + 64-65 still target `(home)/deviation` + `(home)/clockout`

This sortie is THE Phase 3f mandated by ADR-0268.

## Goal

Absorb `(home)/*` business logic into the canonical 5-tab surfaces (Kalender D6 read, Vakter D6 read+execute, Chat communication, Min Tid D6 personal). Delete dead `(home)` route group. Retarget remaining `(home)` deeplinks. Preserve ADR-0132 (BFF), ADR-0133 (Execute-only boundary), ADR-0134 (telemetry fail-fast), ADR-0135 (LiveKit voice).

## Scope

- Absorption mapping decision per file (Council-gated at G2): each `(home)/*.tsx` either lands in target tab, gets deleted as dead, or defers to a documented future sortie.
- Move `shift-hub.tsx` phase-aware views (NoShift/Before/During/After) to target tab (Kalender DayView vs Vakter — Council decides).
- Move `clockout.tsx` to Vakter execute-verb path; retarget `reconciliation_pending_signoff` deeplink.
- Move or delete: `deviation.tsx`, `haccp.tsx`, `safety-round.tsx`, `temp-deviation.tsx`, `punch-clock.tsx`, `spokesperson-approval.tsx`, `team.tsx`, `team/[id].tsx`, `training.tsx`, `course-detail.tsx`, `hms.tsx`, `flow-player.tsx`, `operations.tsx`, `availability.tsx`, `edit-profile.tsx`, `settings.tsx` (audit determines fate).
- Delete `(home)/_layout.tsx` + remove `<Tabs.Screen name="(home)" href:null />` from `(app)/_layout.tsx`.
- Update `packages/notifications/src/deep-links.ts` — zero references to `(home)/` post-merge.

## Out of scope

- New native superpowers (camera evidence, biometric C4) — future sortie.
- V2 i18n migration of mobile strings (separate HANDOFF item).
- `(queue)/[ticketId].tsx` dead route cleanup (separate HANDOFF item — Council G2 may opt to bundle).

## Risks

1. ~20 files = potential sortie scope overrun. Council G2 may split into 3f.1/3f.2/3f.3 sub-phases.
2. `shift-hub.tsx` phase-aware views tightly coupled; partial absorption breaks all four.
3. Reconciliation deeplink audit-critical — clockout flow must not break mid-rollout.
4. Duplicate consumers (e.g. `deviation.tsx` may already exist in Vakter sub-screen).
5. In-flight push notifications targeting old paths during deploy window — hidden-route fallback or redirect shim required.
6. ADR-0133 boundary risk: `(home)/spokesperson-approval.tsx`, `team.tsx`, `settings.tsx`, `edit-profile.tsx` may contain compose/author verbs that must move to web, not absorb.

## References

- ADR-0268 `docs/decisions/0268-tabbar-canonical-layout.md` §"Tab removal sequence" lines 60-67 (canonical mandate)
- ADR-0133 (mobile Execute boundary)
- ADR-0134 (mobile telemetry fail-fast)
- Prior sortie HANDOFF: `docs/HANDOFF-mobile-adr-0268-audit.md`
- A1 audit (this sortie) — file inventory
- A2 audit (this sortie) — data + consumer trace
- Council G2 verdict — absorption mapping (forthcoming)
