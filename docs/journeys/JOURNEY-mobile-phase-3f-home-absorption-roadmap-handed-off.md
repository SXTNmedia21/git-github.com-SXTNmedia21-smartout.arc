---
title: "Journey — Phase 3f 4-sortie roadmap handed off in HANDOFF + ADR-0268 amendment"
feature: mobile-phase-3f-home-absorption
journey: roadmap-handed-off
status: verified
verified_at: 2026-05-14
verified_by: HANDOFF + ADR-0268 amendment + COUNCIL-LOG G2 entry all reference 4-sortie roadmap
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, handoff, roadmap, council-g2]
---

# Journey: Phase 3f 4-sortie roadmap handed off in HANDOFF + ADR-0268 amendment

**Role:** developer (this is a developer-facing handoff journey closing 3f.1)

**Precondition:**
- Council G2 verdict 2026-05-14 split the original single-sortie Phase 3f into 4 sub-sorties (3f.1/3f.2/3f.3/3f.4) due to 11× LOC budget overrun
- This sortie ships 3f.1 only; 3f.2/3f.3/3f.4 must be discoverable by future operators

## Happy Path

1. Developer reads `docs/HANDOFF-mobile-phase-3f-home-absorption.md` → finds 4-sortie roadmap + per-sortie scope + ADR-flagged item resolution per sortie
2. Developer reads ADR-0268 amendment 2026-05-14 → finds Council G2 verdict cross-reference + sortie roadmap + L-0250/L-0251 cross-references
3. Developer reads `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` → finds authoritative retarget map for 3f.2/3f.3/3f.4
4. Developer reads `docs/council/COUNCIL-LOG.md` 2026-05-14 G2 entry → finds full Council verdict + 5 reviewers' positions + 7th L-0147 precedent
5. Future operator picks up 3f.2 (or 3f.3 or 3f.4) with full context: retarget map, ADR-flagged items, compliance fix queue, ordering rules

**Postcondition:**
- HANDOFF file exists with 4-sortie roadmap
- ADR-0268 amendment references Council G2 + roadmap
- Audit doc + COUNCIL-LOG entry + 2 learning files all cross-reference each other
- 3f.2/3f.3/3f.4 are discoverable + actionable

## Error Paths

- **Scenario:** Future operator runs 3f.2 with stale audit (e.g. new router.push added between 3f.1 and 3f.2) → audit doc instructs re-run of 7-class grep before execution
- **Scenario:** ADR-0268 amendment text omits a sortie or misorders the sequence → cross-reference back to COUNCIL-LOG.md G2 entry as authoritative
- **Scenario:** Operator misses ADR-flagged items (temp-deviation, edit-profile, spokesperson, team*, availability) → audit doc §"ADR-flagged items (Council G2 handoff)" table lists each + required fix + owner sortie

## Verification

- [x] HANDOFF-mobile-phase-3f-home-absorption.md exists on feat branch
- [x] 4-sortie roadmap (3f.1/3f.2/3f.3/3f.4) documented with per-sortie scope
- [x] ADR-0268 amendment 2026-05-14 references Council G2 verdict + roadmap
- [x] COUNCIL-LOG.md G2 entry references 4-sortie split + ADR-flagged items
- [x] Audit doc cross-references L-0250 + L-0251 + 5 ADR-flagged items
- [x] Decision log row updated for ADR-0268 amendment

**Status flipped to verified 2026-05-14 — all six verification boxes checked.**
