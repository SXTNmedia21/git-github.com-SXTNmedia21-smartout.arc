---
title: "Plan — mobile-restore-4tab-plan"
feature: mobile-restore-4tab-plan
spec: docs/superpowers/specs/2026-05-13-mobile-restore-4tab-plan.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: mobile
tags: [plan, mobile, refactor, fab, drift-fix]
---

# Plan — mobile-restore-4tab-plan

> Branch: `feat/mobile-restore-4tab-plan` | Worktree: `~/dev/smartout.ai-wt-4` | Module: mobile

**Spec:** [Mobile 4-Tab Restoration + AI FAB](../superpowers/specs/2026-05-13-mobile-restore-4tab-plan.md)

**Canonical reference:** [2026-03-24 Mobile UI Master Plan](../superpowers/plans/completed/2026-03-24-mobile-ui-master-plan.md)

## Journeys (the contract)

- [JOURNEY-mobile-restore-4tab-plan-employee-4tab-nav](../journeys/JOURNEY-mobile-restore-4tab-plan-employee-4tab-nav.md) — Employee navigates 4 tabs + FAB on mobile
- [JOURNEY-mobile-restore-4tab-plan-admin-4tab-nav](../journeys/JOURNEY-mobile-restore-4tab-plan-admin-4tab-nav.md) — Admin navigates 4 tabs + FAB on mobile
- [JOURNEY-mobile-restore-4tab-plan-fab-opens-ai-chat](../journeys/JOURNEY-mobile-restore-4tab-plan-fab-opens-ai-chat.md) — Center FAB opens AI chat sheet via BFF

## Goal

Restore mobile to 4-tab + AI FAB scaffold per 2026-03-24 master-plan. Eliminate drift (6 tabs → 4 tabs). Preserve ADR-0132/0133/0134/0135.

## Phases + Gates

| Phase | Tracks | Gate |
|-------|--------|------|
| 1. AUDIT | A1 mobile surface (haiku), A2 master-plan verify (opus) | G1: Council verifies scope + risks → Pontus sign-off |
| 2. BUILD | B1 tab layout, B2 FAB+sheet, B3 telemetry audit | G2: Council verifies ADR-0133 + ADR-0134 compliance, typecheck green |
| 3. VERIFY | C1 dual-perspective, C2 E2E | G3: PWA boot, both roles green |
| 4. CLOSE | D1 journey + handoff + decision log | G4: `/close-feature` |

## Tasks

### Phase 1 — Audit (parallel)

- [ ] A1: Map current mobile tab tree, count emit() sites, identify dead routes (haiku, Explore)
- [ ] A2: Verify 2026-03-24 master-plan still authoritative; check ADR-0186 fanout risk if (komm) removed (opus, system-steward)
- [ ] G1: Council reviews A1 + A2; Pontus signs off on scope

### Phase 2 — Build (after G1)

- [ ] B1: Refactor `apps/mobile/src/app/(tabs)/_layout.tsx` to 4 tabs; delete `(digest)` + `(komm)` route groups; fix `(home)/index.tsx` redirect-stub
- [ ] B2: Build center FAB component + AI chat bottom-sheet routing through `/api/emma/chat` (ADR-0132)
- [ ] B3: Audit telemetry — verify every `emit()` site preserved, `getProfileContext()` used everywhere (ADR-0134)
- [ ] G2: Council verifies no ADR-0133 violations; `pnpm --filter @smartout/mobile typecheck` clean

### Phase 3 — Verify (after G2)

- [ ] C1: Dual-perspective verification — admin + employee on PWA `localhost:8083`
- [ ] C2: E2E protocol P-mobile-4tab — 4 tabs visible, FAB tap reaches AI surface
- [ ] G3: both green

### Phase 4 — Close (after G3)

- [ ] D1: Write JOURNEY verification + HANDOFF + decision-log updates
- [ ] G4: `/close-feature`

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] `apps/mobile/src/app/(tabs)/_layout.tsx` registers exactly 4 tabs
- [ ] FAB renders center slot, tap opens AI chat sheet
- [ ] `(digest)` + `(komm)` route groups removed
- [ ] `(home)/index.tsx` no longer redirect-stub
- [ ] `pnpm --filter @smartout/mobile typecheck` passes with 0 errors
- [ ] `pnpm turbo typecheck` passes overall
- [ ] PWA boot on `localhost:8083` green for both admin + employee
- [ ] At least one E2E test per journey (recommended)
- [ ] Decision log updated for rename Meg → Min tid (if approved by Pontus)
- [ ] HANDOFF-mobile-restore-4tab-plan.md written

## AI Council — primary verification mechanism

Per Pontus directive 2026-05-13: Council is the verification + question-resolution mechanism, not a last-resort. Invoke `/run-council` whenever:

- Scope or boundary unclear (e.g. is X authoring per ADR-0133?)
- ADR cross-impact suspected (e.g. removing (komm) vs ADR-0186 fanout)
- Two build agents disagree
- Need independent challenge before locking a decision
- Gate review (G1, G2) — Council reviews tracks' outputs as verification
- Any unknown surfaces during audit or build

Skip Council only for:
- Pure UX naming calls → ask Pontus directly (e.g. rename Meg → Min tid)
- Routine implementation where ADRs already settle the rule

## Risks

| Risk | Owner | Mitigation |
|------|-------|-----------|
| (digest)/(komm) contain unique features | A2 + Council at G1 | Map before B1 deletes |
| (komm) ties to ADR-0186 guardian fanout | A2 + Council at G1 | ADR cross-check |
| `(home)/index.tsx` referenced by push deeplinks | A1 | Deeplink scan |
| FAB collides with LiveKit voice trigger | B2 + Council at G2 | Read ADR-0135 first |
| Rename Meg → Min tid breaks deeplinks | B1 | Grep "Meg" + ask Pontus |
