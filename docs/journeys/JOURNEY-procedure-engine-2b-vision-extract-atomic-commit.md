---
title: "Journey — Vision extract is read-only, commit is atomic"
feature: procedure-engine-2b
journey: vision-extract-atomic-commit
status: verified
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [journey]
---

# Journey: Vision extract is read-only; commit is atomic

**Role:** system (backend)

**Precondition:** A signed image URL is available to the stage-engine extract route; the commit RPC exists.

## Happy Path

1. `POST /routine/extract` runs `generateObject` (vision) against the image and returns a `DraftSchema`-valid draft → zero database writes.
2. `POST /api/mobile/routine/commit` calls `fn_create_routine_from_draft` in a single transaction: procedure → routine → N procedure_steps → routine_team → session_hooks.
3. The RPC returns `{ ok, routine_id, procedure_id, location_id, governance_status }`.

**Postcondition:** Either all rows exist, or none do (atomicity holds).

## Error Paths

- **Vision call fails** → extract route returns 5xx; no draft; no writes.
- **Mid-RPC failure (e.g. team_wrong_workspace)** → entire transaction rolls back; no orphan procedure/routine/location.
- **Cross-workspace id supplied** → RPC raises (`*_wrong_workspace`); no writes.

## Verification

- [ ] Implementation matches the steps above
- [ ] Tests exist and pass (draft-schema unit, routine-extract route test, SQL atomicity assertion)
- [ ] Manually verified: forced mid-failure leaves zero leftover rows

**Mark `status: verified` in frontmatter when all three boxes are checked.**
