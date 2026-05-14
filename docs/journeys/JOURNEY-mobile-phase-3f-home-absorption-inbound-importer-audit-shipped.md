---
title: "Journey — 25-site inbound importer audit shipped as 3f.2 handoff"
feature: mobile-phase-3f-home-absorption
journey: inbound-importer-audit-shipped
status: verified
verified_at: 2026-05-14
verified_by: Council G2 verdict 2026-05-14 (5 reviewers, GO WITH CHANGES) + L-0250 captured
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, audit, council-g2, l-0250]
---

# Journey: 25-site inbound importer audit shipped as 3f.2 handoff

**Role:** developer (this is a developer-facing handoff journey)

**Precondition:**
- Council G2 verdict 2026-05-14: A1's "0 cross-folder route importers" claim REVERSED. 25+ sites identified.
- Audit must capture full inventory by importer class (7 patterns) so follow-up sorties can retarget atomically.

## Happy Path

1. Developer reads `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` → finds full 25-site inventory grouped by 7 importer classes (push deeplink registry, nav table, phase-view components, capability tool route table, prioritize-actions, cross-tab `router.push`, page context literal).
2. Per importer class, audit shows file:line + current target + recommended retarget + payload-compatibility notes.
3. Retarget mapping table per sortie (3f.1/3f.2/3f.3/3f.4) allocates the 25 sites to specific follow-up sorties.
4. Audit also captures the 2 server-side push triggers (deviation INSERT + session status-change) and confirms payload-compatible retarget (path-only change).
5. L-0250 captured: "Route-group absorption requires inbound-importer audit, not just route-tree audit" — rule for future councils.

**Postcondition:**
- `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` exists on this branch
- 3f.2/3f.3/3f.4 follow-up sorties have authoritative retarget map
- L-0250 registered in learning log

## Error Paths

- **Scenario:** Future sortie acts on stale audit (e.g. someone adds new `router.push("/(app)/(home)/X")` between 3f.1 and 3f.2) → 3f.2 must re-run the 7-class grep before execution; if delta found, update audit doc
- **Scenario:** Audit class taxonomy missing a pattern (8th class discovered later) → Update L-0250 + add to audit doc + flag in Council G2 retrospective

## Verification

- [x] `docs/audits/2026-05-14-phase-3f-inbound-importer-map.md` confirmed present on feat branch
- [x] All 7 importer classes enumerated with file:line citations
- [x] Retarget map allocates 25 sites across 3f.2/3f.3/3f.4
- [x] Council G2 verdict referenced + 5 reviewers cited
- [x] L-0250 created + registered in `docs/learnings/0000-learning-log.md`

**Status flipped to verified 2026-05-14 — all five verification boxes checked.**
