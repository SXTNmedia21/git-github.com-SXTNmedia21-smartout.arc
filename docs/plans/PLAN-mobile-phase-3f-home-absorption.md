---
title: "Plan — mobile-phase-3f-home-absorption"
feature: mobile-phase-3f-home-absorption
spec: docs/superpowers/specs/2026-05-14-mobile-phase-3f-home-absorption.md
status: draft
updated: 2026-05-14
created: 2026-05-14
module: mobile
tags: [plan, mobile, phase-3f, refactor, adr-0268, deeplinks]
---

# Plan — mobile-phase-3f-home-absorption

> Branch: `feat/mobile-phase-3f-home-absorption` | Worktree: `~/dev/smartout.ai-wt-4` | Module: mobile

**Spec:** [Mobile Phase 3f — (home) Absorption + Route Deletion](../superpowers/specs/2026-05-14-mobile-phase-3f-home-absorption.md)

**Mandated by:** ADR-0268 §"Tab removal sequence" line 64 ("Logic in `shift-hub.tsx` merges into Kalender DayView OR a Vakter sub-screen. Phase 3f will decide concrete merge.")

**Prior sortie:** `docs/HANDOFF-mobile-adr-0268-audit.md` (closed 2026-05-14, merge `fd77b4b0c`)

## Journeys (the contract — REVISED for 3f.1 scope per Council G2 2026-05-14)

Council G2 verdict 2026-05-14 split original single-sortie plan into 4 sub-sorties (3f.1/3f.2/3f.3/3f.4) due to 11× LOC budget overrun + L-0147 7th precedent (25-site inbound importer audit reversal). Original 3 journeys (shift-hub-views-absorbed / clockout-reachable-from-vakter / home-route-group-deleted) covered full Phase 3f scope; deferred to follow-up sorties. **This sortie (3f.1) ships only audit + single-file delete + roadmap handoff.**

- [JOURNEY-mobile-phase-3f-home-absorption-inbound-importer-audit-shipped](../journeys/JOURNEY-mobile-phase-3f-home-absorption-inbound-importer-audit-shipped.md) — 25-site inbound importer audit doc captured for 3f.2 retarget
- [JOURNEY-mobile-phase-3f-home-absorption-shift-hub-shell-deleted](../journeys/JOURNEY-mobile-phase-3f-home-absorption-shift-hub-shell-deleted.md) — `(home)/shift-hub.tsx` deleted (verified safe by Council G2; `components/home/` retained)
- [JOURNEY-mobile-phase-3f-home-absorption-roadmap-handed-off](../journeys/JOURNEY-mobile-phase-3f-home-absorption-roadmap-handed-off.md) — 4-sortie roadmap captured in HANDOFF + ADR-0268 amendment + COUNCIL-LOG entry

## Goal

Absorb `(home)/*` business logic into canonical 5-tab surfaces. Delete `(home)` route group. Retarget last 2 deeplinks. Preserve ADR-0132/0133/0134/0135.

## Phases + Gates

| Phase | Tracks | Gate |
|-------|--------|------|
| 1. AUDIT | A1 file inventory (haiku), A2 data+consumer trace (opus), A3 deeplink+push trace (haiku) | G1: orchestrator synthesizes; draft mapping to Pontus |
| 2. COUNCIL | /run-council 5 reviewers + Phase 2.5 fact-check | G2: per-file verdict locked; sortie-split decision |
| 3. BUILD | B1 shift-hub (sonnet harness), B2 clockout+reconciliation, B3 remaining, B4 route delete + deeplinks, B5 telemetry audit | G3: typecheck green, no ADR-0133 violations |
| 4. VERIFY | C1 dual-perspective, C2 E2E protocols | G4: Council pre-merge review (4 reviewers) |
| 5. CLOSE | D1 journey verify + HANDOFF + decision log | /close-feature |

## Tasks

### Phase 1 — Audit (parallel)

- [ ] A1: Inventory every `(home)/*.tsx` — line count, imports, emit() count, importers (haiku)
- [ ] A2: Per-file data sources + consumers + ADR-0133 verb + recommended target (opus, code-tracer)
- [ ] A3: deep-links.ts + push handlers touching `(home)`; suggested retargets (haiku)
- [ ] G1: orchestrator compiles mapping; presents to Pontus

### Phase 2 — Council (after G1 OK)

- [ ] /run-council 5 reviewers + Phase 2.5 fact-check
- [ ] G2 verdict: per-file ABSORB/DELETE/DEFER + sortie-split decision
- [ ] Pontus approves verdict

### Phase 3 — Build (after G2)

- [ ] B1: Move shift-hub.tsx + 4 view components to Council target tab; preserve emit() per ADR-0134
- [ ] B2: Move clockout.tsx to Vakter execute-verb; retarget `reconciliation_pending_signoff` deeplink
- [ ] B3: Per Council mapping, absorb-or-delete remaining 15+ files
- [ ] B4: Delete `(home)/` folder; remove `<Tabs.Screen name="(home)">` from `_layout.tsx`; retarget `deviation_reported`
- [ ] B5: Telemetry preservation audit — ADR-0134 getProfileContext() at every moved emit()
- [ ] G3: `pnpm --filter @smartout/mobile typecheck` clean + `pnpm turbo typecheck` clean

### Phase 4 — Verify (after G3)

- [ ] C1: Dual-perspective verify PWA `localhost:8083` admin + employee
- [ ] C2: E2E protocol per absorbed flow
- [ ] Council G4 pre-merge — 4 reviewers verify mapping + no regressions

### Phase 5 — Close (after G4)

- [ ] D1: Flip 3 journeys to verified; HANDOFF; register absorption mapping in decision log
- [ ] /close-feature merge → development → cleanup wt-4

## Acceptance Criteria

- [ ] Every declared journey `status: verified`
- [ ] `(home)/` folder absent on feat branch tip
- [ ] `_layout.tsx` no longer registers `<Tabs.Screen name="(home)">`
- [ ] `packages/notifications/src/deep-links.ts` zero references to `(home)/`
- [ ] Every moved emit() uses `getProfileContext()` per ADR-0134
- [ ] No new authoring/compose UI on mobile (ADR-0133)
- [ ] `pnpm --filter @smartout/mobile typecheck` 0 errors
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] PWA boot green admin + employee
- [ ] E2E protocols per absorbed flow exist
- [ ] HANDOFF written
- [ ] Council G2 + G4 verdicts logged in COUNCIL-LOG.md

## AI Council usage

Per Pontus directive 2026-05-13: Council is primary verification.

**Mandatory Council:**
- G2: absorption mapping (architectural, load-bearing)
- G4: pre-merge review (regression risk across multiple absorbed surfaces)
- Any ADR-0133 compose-verb flag in `(home)/*`
- Sortie-scope split decision

**Skip Council:**
- Pure file renames with no semantic change
- Pure dead-code deletion where A2 + A1 both confirm zero consumers
- ADR-0134 telemetry preservation if pattern matches established template

**Pontus directly:**
- Naming questions (target sub-screen labels)
- Sub-phase split decision override

## Risks

| Risk | Mitigation |
|------|-----------|
| ~20 files = sortie scope overrun | G2 Council split into 3f.1/3f.2/3f.3 if LOC > 800 or > 4 working days |
| shift-hub view coupling — partial absorption breaks all four | B1 single agent owns all 4 views in atomic commit |
| Reconciliation flow audit-critical | B2 hard constraint; E2E gates merge |
| Duplicate consumers (deviation.tsx may exist in Vakter) | A2 detects; Council decides canonical |
| Push notification rollout: in-flight pushes | Hidden-route fallback OR Council-approved redirect shim |
| `(queue)/[ticketId].tsx` cleanup scope creep | Council G2 bundle-or-defer |
| `team/[id].tsx` separate cluster | A1 + A2 classify; Council decides |
| ADR-0133 compose-verb violations in spokesperson-approval/settings/edit-profile | A2 verb classification; non-compliant files deleted or web-only |

## Council escalation history (this sortie)

- **2026-05-14 G2** — GO WITH CHANGES (5 reviewers: steward chair, supervisor, agent-coord, harness, frontend). 4 conditions: (1) order inversion (retarget BEFORE absorb), (2) compliance fixes bundled with absorption for temp-deviation:162 + edit-profile, (3) 3f.1 scope revised to delete + audit + handoff only, (4) L-0147 7th precedent + L-0250 + L-0251 captured. Council split sortie into 4 sub-sorties.
- G4 deferred to 3f.4 (final cleanup).

## Council G2 sortie split (CANONICAL — supersedes original 5-phase plan)

| Sortie | Scope | LOC | Status |
|--------|-------|-----|--------|
| **3f.1** (THIS wt-4) | Audit doc + shift-hub.tsx delete + 4-sortie roadmap handoff | ~183 | ACTIVE |
| **3f.2** | Retarget 14 deeplinks + fix temp-deviation ADR-0287 + fix edit-profile ADR-0134/0287 + ABSORB → (shifts) cluster (8 files) | ~4475 | DEFERRED |
| **3f.3** | Retarget 6 deeplinks + L-0177 fail-fast spokesperson + ADR-0133 R5 amendment for availability + ABSORB → (me) cluster (6 files) | ~3450 | DEFERRED |
| **3f.4** | Retarget 4 deeplinks + verify operations vs existing calendar weekly strip + FAB-AddSheet replace hms.tsx + ABSORB operations → (calendar) + DEFER availability + final folder delete + `_layout.tsx` cleanup + page-context literal cleanup | ~600 | DEFERRED |

## 3f.1 final deliverables (this sortie)

1. `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` — 25-site audit with retarget map per sortie
2. `apps/mobile/app/(app)/(home)/shift-hub.tsx` DELETED (verified 0 inbound router.push)
3. `apps/mobile/src/components/home/` RETAINED (rename deferred to 3f.4 per L-0251)
4. ADR-0268 amendment 2026-05-14 — Council G2 verdict + 4-sortie roadmap registered
5. L-0250 (route-group inbound-importer audit rule) + L-0251 (component-folder alignment) captured
6. COUNCIL-LOG G2 entry — full verdict + 5-reviewer positions + L-0147 7th precedent
7. council_meta Phase 9 — 3 new Process Improvements
8. HANDOFF — 4-sortie roadmap + ADR-flagged items + retarget order requirement
