---
title: "Journey — Admin bootstrap seeds role→mandatory protocols from I1"
feature: task-i1-role-compliance-a
journey: admin-bootstrap-seeds-role-protocols
status: verified
verified_at: 2026-05-21
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

- [x] Implementation matches the steps above — `fn_seed_profession_training` RPC (`supabase/migrations/20260621000200`) + bootstrap-cascade Step 11 `profession_seed` seed `profession`+`profession_training` from inlined I1 profiles, hospitality-gated, idempotent, best-effort.
- [x] Integration verified on Supabase Local — 5 `profession` rows seeded; transactional test with `Handhygiene-protokoll` present → 5 `profession_training` rows (`is_required=true`, `weight=1.0`); workspace with no matching protocols → 0 trainings (correct best-effort); idempotent re-run → 0 duplicates. _(Automated bootstrap E2E harness deferred — follow-up.)_
- [x] Manually tested on Supabase Local; idempotent confirmed; zero behavior change confirmed (guardrail audit — no readiness/gate/trigger/season files in diff).

**Verified 2026-05-21.** Note: integration proven via SQL counts on Supabase Local (not a committed automated bootstrap-E2E — recommended follow-up).
