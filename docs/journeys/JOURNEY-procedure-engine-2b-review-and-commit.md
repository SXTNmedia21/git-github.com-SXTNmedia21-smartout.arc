---
title: "Journey — Manager reviews the draft and commits a routine"
feature: procedure-engine-2b
journey: review-and-commit
status: draft
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
tags: [journey]
---

# Journey: Manager reviews the draft and commits a routine

**Role:** manager

**Precondition:** A routine draft is held in client state (see photo-to-draft).

## Happy Path

1. Manager taps "Gjennomgå og opprett" → the full review screen opens.
2. Manager edits the routine name, edits/removes steps, picks a location (AI-prefilled if the hint matched), optionally selects teams.
3. Manager taps "Opprett rutine" → app calls `POST /api/mobile/routine/commit`.
4. Server derives identity from JWT, passes `gate_action` (C4), runs the atomic RPC, returns `routine_id`.
5. App clears the draft and returns to the previous screen; the routine now exists.

**Postcondition:** A routine + its procedure + N steps + session_hooks (+ routine_team) exist for the workspace.

## Error Paths

- **gate_action denies** → commit route returns 403; review screen shows "ikke tillatt", draft preserved.
- **No location chosen and no new location entered** → submit disabled (cannot commit without a location).
- **RPC failure** → atomic rollback; error surfaced; draft preserved for retry.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E/Detox test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end on device

**Mark `status: verified` in frontmatter when all three boxes are checked.**
