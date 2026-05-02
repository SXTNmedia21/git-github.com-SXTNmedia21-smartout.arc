---
title: Admin Onboarding License
status: draft
updated: 2026-03-06
created: 2026-03-06
module: onboarding
tags: [license, protocol, policy, tests, onboarding]
---

# Admin Onboarding License

## Package Identity

- Package ID: `JP-R001-ADMIN-ONBOARDING`
- License ID: `L-001`
- Roadmap ID: `R-001`
- Journey ID: `J-001`
- Mission ID: `M-001`

Related package docs:

- `./Journey.md`
- `./Mission.md`
- `../../09-gold-package-admin-onboarding.md` (archived; reference example)

## Purpose

Define the protocol contract for admin onboarding: required tasks, policy constraints, and mandatory verification gates.

## Required Task Blocks

1. Account creation and authenticated session
2. Company identification and confirmation
3. Business baseline setup (season, departments, locations)
4. Procedure baseline selection
5. Contract baseline generation
6. Final workspace activation

## Policy Constraints

- Workspace data must remain tenant-scoped and auditable.
- Identity sources should keep provenance metadata.
- Missing external data may degrade suggestions, not block manual completion.
- Final activation must pass validation gates.

## Verification Gates

### User Test

- User can understand each onboarding step and correct suggestions.
- User reaches completion without hidden states or dead ends.

### Knowledge Test

- Admin can explain what was auto-generated vs manually confirmed.
- Admin knows where to edit departments, procedures, and policies after onboarding.

### Function Test

- Finalization creates required entities with valid relationships.
- Required hooks/events persist transition and audit metadata.
- Failure path returns actionable errors with recovery options.

### E2E Test

- Signup -> onboarding -> finalize -> dashboard route.
- Assertions for created workspace entities and mission-stage linkage.

## Exit Conditions

License is satisfied when all required task blocks and verification gates pass for the onboarding package.
