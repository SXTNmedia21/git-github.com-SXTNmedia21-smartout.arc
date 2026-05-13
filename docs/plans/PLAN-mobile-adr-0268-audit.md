---
title: "Plan — mobile-adr-0268-audit"
feature: mobile-adr-0268-audit
spec: docs/superpowers/specs/2026-05-14-mobile-adr-0268-audit.md
status: draft
updated: 2026-05-14
created: 2026-05-14
module: mobile
tags: [plan, mobile, audit, adr-0268, i18n, helpdesk, drift-fix]
supersedes: PLAN-mobile-restore-4tab-plan.md (deleted)
---

# Plan — mobile-adr-0268-audit

> Branch: `feat/mobile-adr-0268-audit` (renamed from `feat/mobile-restore-4tab-plan` 2026-05-14 to honor ADR-0268 deletion-list intent) | Worktree: `~/dev/smartout.ai-wt-4` | Module: mobile

**Spec:** [Mobile ADR-0268 Accept-Checklist Audit + Cleanup](../superpowers/specs/2026-05-14-mobile-adr-0268-audit.md)

**Canonical ADR:** [ADR-0268: TabBar Canonical Layout](../decisions/0268-tabbar-canonical-layout.md)

## Pivot context

This sortie was originally `feat/mobile-restore-4tab-plan` aimed at restoring a 4-tab layout per a 2026-03-24 master-plan. Audit on 2026-05-13 (A2 system-steward, opus) found ADR-0268 (2026-05-04) had already adopted 5-tab canonical and explicitly rejected the 4-tab restore. Code already matches ADR-0268. Pivot = close remaining ADR-0268 accept-checklist items + clean dead `(home)` redirect-stub.

## Journeys (the contract)

- [JOURNEY-mobile-adr-0268-audit-komm-thread-continuity](../journeys/JOURNEY-mobile-adr-0268-audit-komm-thread-continuity.md) — Helpdesk threads remain reachable after `(komm)` tab-removal per ADR-0163 absorption
- [JOURNEY-mobile-adr-0268-audit-i18n-keys-registered](../journeys/JOURNEY-mobile-adr-0268-audit-i18n-keys-registered.md) — i18n keys for `Kalender`, `Vakter`, `Chat`, `Min Tid` resolved through `packages/i18n/` (no hardcoded Norwegian)
- [JOURNEY-mobile-adr-0268-audit-home-redirect-stub-cleaned](../journeys/JOURNEY-mobile-adr-0268-audit-home-redirect-stub-cleaned.md) — Dead `(home)/index.tsx` redirect-stub removed; deeplinks targeting `(home)` paths re-pointed

## Goal

Flip ADR-0268 from `proposed` → `accepted` by closing accept-checklist items 4 + 5 + cleaning dead code. No new feature surfaces. No re-implementation of the 5-tab layout (already live).

## Accept-checklist state

| # | Item | Status | Owner |
|---|------|--------|-------|
| 1 | wt-1 cancel/rebase | DONE 2026-05-13 (T4 audit) | — |
| 2 | wt-7 locked branch delete | DONE 2026-05-14 (rename) | this sortie |
| 3 | Phase 3f delivers 5-tab `_layout.tsx` | DONE (live in code per A1) | — |
| 4 | `(komm)` helpdesk thread continuity verified | OPEN | this sortie |
| 5 | i18n keys registered for Kalender/Vakter/Min Tid | OPEN | this sortie |
| 6 | `(home)/index.tsx` dead redirect-stub cleaned (not in ADR, housekeeping) | OPEN | this sortie |

## Phases + Gates

| Phase | Tracks | Gate |
|-------|--------|------|
| 1. AUDIT | T6 i18n keys present (sonnet), T7 (komm) thread continuity (sonnet + Council) | G1: facts gathered + Council on (komm) |
| 2. CLEANUP | T5 dead `(home)` redirect + deeplink retarget (sonnet) | G2: typecheck green, no 404 risk |
| 3. ACCEPT | T9 Council verifies ADR-0268 ready to flip status | G3: ADR status edit + commit |
| 4. CLOSE | journey verification + HANDOFF | G4: `/close-feature` |

## Tasks

### Phase 1 — Audit (parallel)

- [ ] T6: Audit `packages/i18n/` for keys `tabs.kalender`, `tabs.vakter`, `tabs.chat`, `tabs.minTid`. Add missing keys. ADR-0268 R5.
- [ ] T7: Council on `(komm)` helpdesk thread continuity. Verify ADR-0163 absorption wired. Threads reachable from Chat surface.
- [ ] G1: facts + Council verdict in plan history

### Phase 2 — Cleanup (after G1)

- [ ] T5: Delete `(home)/index.tsx` redirect-stub. Verify no referrers other than the deeplinks. Update `packages/notifications/src/deep-links.ts` lines 49, 50, 54, 58, 64–65 to target `(calendar)` or `(shifts)` per ADR-0268 §"Tab removal sequence". **Do not delete `shift-hub.tsx`** — its business logic absorption is a separate Phase 3f sortie per ADR-0268.
- [ ] G2: `pnpm --filter @smartout/mobile typecheck` clean

### Phase 3 — Accept (after G2)

- [ ] T9: Council reviews ADR-0268 accept-checklist completion. Verdict: GO/HOLD on status flip.
- [ ] Edit ADR-0268 frontmatter `status: proposed` → `status: accepted`. Register in decision log.
- [ ] G3: ADR accepted

### Phase 4 — Close (after G3)

- [ ] Write JOURNEY verification + HANDOFF-mobile-adr-0268-audit.md
- [ ] G4: `/close-feature`

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] i18n keys for all 4 tab labels resolved (no hardcoded Norwegian)
- [ ] `(komm)` helpdesk threads verified reachable post tab-removal (Council sign-off)
- [ ] `(home)/index.tsx` redirect-stub deleted
- [ ] Deeplinks in `packages/notifications/src/deep-links.ts` no longer target deleted `(home)` paths
- [ ] `pnpm --filter @smartout/mobile typecheck` 0 errors
- [ ] `pnpm turbo typecheck` overall 0 errors
- [ ] ADR-0268 status flipped to `accepted` + decision-log entry
- [ ] HANDOFF-mobile-adr-0268-audit.md written

## AI Council usage

Per Pontus directive 2026-05-13: Council is primary verification mechanism. Invoke `/run-council` at:

- **T7 (komm continuity)** — load-bearing ADR-0163 surface; Council verifies absorption is wired.
- **T9 (ADR-0268 accept)** — gate before status flip; Council challenges checklist completeness.
- Any unknown surfacing during audit.

Skip Council for:
- Pure i18n key add (T6) if existing pattern already in repo.
- Dead-code delete (T5) if A1 audit already mapped all referrers.

## Risks

| Risk | Mitigation |
|------|-----------|
| `(komm)` removal breaks ADR-0163 helpdesk flow | T7 Council; do not delete tab entry until continuity verified |
| Deeplinks 404 mid-rollout when `(home)` paths removed | T5 retargets BEFORE deletion |
| `shift-hub.tsx` accidentally deleted with `(home)` cleanup | T5 explicit "don't touch shift-hub.tsx" — Phase 3f sortie absorbs it later |
| i18n key addition collides with existing patterns | T6 reads existing key conventions first |
| ADR-0268 accept blocks on Phase 3f (komm absorption code not shipped) | T9 Council determines if status flip needs to wait for ADR-0163 code |

## Council escalation history (this sortie)

- 2026-05-13 — A2 system-steward (opus) HOLD verdict on original 4-tab restore plan. Pontus pivot decision to B.
