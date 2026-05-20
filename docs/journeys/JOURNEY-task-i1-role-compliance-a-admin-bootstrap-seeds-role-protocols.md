---
title: "Journey — Admin bootstrap seeds role→mandatory protocols from I1"
feature: task-i1-role-compliance-a
journey: admin-bootstrap-seeds-role-protocols
status: draft
verified_at: null
e2e_test: null
created: 2026-05-21
updated: 2026-05-21
module: task-manager
tags: [journey]
---

# Journey: Admin bootstrap seeds role→mandatory protocols from I1

**Role:** admin (workspace creation / I1 bootstrap; system-initiated seeding)

**Precondition:** A hospitality workspace is being finalized via the onboarding flow (`finalize-workspace` → `bootstrap-cascade`). The Hospitality Intelligence package (`hospitalityPackage`) carries `roleCapabilityProfiles` (role → mandatory protocol slugs). Governance protocols for the workspace exist (seeded or template-applied) so protocol slugs resolve to protocol rows.

## Happy Path

1. Admin completes onboarding and finalizes the workspace → System runs bootstrap → System reads `hospitalityPackage.roleCapabilityProfiles` → for each role profile, resolves `mandatoryProtocolSlugs` to the workspace's `protocol` rows → writes `profession` + `profession_training(profession_id, protocol_id, is_required=true, workspace_id)` rows → Admin sees a finalized workspace where each role has its mandatory protocols recorded in the spine.
2. (Idempotency) Admin re-runs / resumes bootstrap → System upserts `profession_training` → no duplicate rows.

**Postcondition:** `profession_training` is populated for the workspace: every hospitality role (bartender, kokk, servitør, skiftleder, renhold) has its `is_required=true` protocol mappings. **No behavior change** — readiness gate / shift publish unaffected (consumed only in 0379b).

## Error Paths

- **Scenario:** a `mandatoryProtocolSlug` does not resolve to a workspace protocol → System skips that mapping and logs (does not fail the whole bootstrap); seeding is best-effort + idempotent, re-runnable after governance is seeded.
- **Scenario:** non-hospitality / `defaultPackage` workspace (no `roleCapabilityProfiles`) → System seeds nothing; spine stays empty; no error.
- **Scenario:** bootstrap step fails mid-way → idempotent upsert allows safe resume; partial seed never corrupts.

## Verification

- [ ] Implementation matches the steps above (bootstrap seeds `profession_training` from I1 profiles)
- [ ] Integration test: finalize a fresh hospitality workspace on Supabase Local → assert `profession_training` rows exist per role with correct `is_required`
- [ ] Manually tested end-to-end; idempotent re-run produces no duplicates; zero behavior change confirmed on readiness/shift surfaces

**Mark `status: verified` in frontmatter when all three boxes are checked.**
