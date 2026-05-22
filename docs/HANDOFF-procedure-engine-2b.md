---
title: "Handoff — Procedure Engine 2B (Botsson Bilde→Rutine)"
feature: procedure-engine-2b
branch: feat/procedure-engine-2b
closed: 2026-05-22
module: procedure-engine
---

# Handoff — Procedure Engine 2B

## Summary

Mobile-first photo→routine. A manager long-presses the FAB → BotssonSheet → picks a
photo of an existing checklist → stage-engine vision (`generateObject`) extracts a
structured draft → the manager reviews/edits on a full screen → an atomic RPC commits
procedure + routine + steps + session_hooks (+ optional in-txn location). Routines are
**born ungoverned** — no protocol required (brownfield-first). Built subagent-driven
across 16 tasks (5 phases); all commits on `feat/procedure-engine-2b`.

## Journeys Delivered

| Journey | Status | Test |
|---------|--------|------|
| photo-to-draft | draft → verify on device | Detox (deferred) + MANUAL MT-1/4/5 |
| review-and-commit | draft → verify on device | Detox (deferred) + MANUAL MT-1/3/6 |
| vision-extract-atomic-commit | verified (backend) | draft-schema unit + routine-extract route test + SQL atomicity |
| agent-provenance-ungoverned | verified (backend) | commit-route emits both events; SQL columns asserted |
| inline-location-create | verified (backend) | RPC new_location path + rollback assertion; MANUAL MT-2 |

> Backend journeys verified by unit/SQL. Mobile-surface journeys (photo-to-draft,
> review-and-commit) need the on-device MANUAL walk to flip to `verified` — Detox is a
> fast-follow.

## Architecture (as built)

`Arch B — dedicated BFF routes` (not the chat agent loop). Pipe:
- L1 mobile: long-press FAB → BotssonSheet image button → `expo-image-picker` → `uploadRoutineSource` → `routine-source` bucket.
- L2 BFF: `POST /api/mobile/routine/extract` (Bearer JWT → service-role signed URL → forward) and `POST /api/mobile/routine/commit` (gate_action → RPC → emit).
- L3 stage-engine: `POST /routine/extract` runs `generateObject` vision (only multimodal touch point; agent loop untouched).
- L5 DB: `fn_create_routine_from_draft` atomic commit RPC.

## Decisions Made

| Decision | ADR |
|----------|-----|
| Brownfield-first ungoverned routines (nullable protocol_id + governance_status) | 0393 |
| ADR-0133 carve-out: AI-mediated capture-to-author from camera evidence + C4 | 0394 |
| Multimodal image-storage contract (Storage path + tool-scoped vision, Arch B) | 0395 |

All registered in `docs/decisions/0000-decision-log.md`.

## Commits

| Phase | SHA | What |
|-------|-----|------|
| A1 | 436f71b95 | brownfield governance migration |
| A2 | f8a31ebfc | routine-source bucket + RLS |
| A3 | 93a8fe40c | fn_create_routine_from_draft RPC (+ hardening) |
| A4 | a7b2196f2 | regen database types |
| B5 | b4a337829 | shared DraftSchema |
| B6 | ec1a1c3a5 | stage-engine /routine/extract |
| C7 | 79c1ae422 | telemetry: created_from_image + governance_unassigned |
| C8 | 6c93f3f1b | BFF /api/mobile/routine/extract |
| C9 | 62594c193 | BFF /api/mobile/routine/commit (+ authority seed) |
| D10 | dead28fc5 | uploadRoutineSource helper |
| D11 | 63a16da78 | useRoutineExtract hook + mobile.routine.photo_extracted |
| D12 | fa504a0f9 | image button + draft card in BotssonSheet |
| D13 | 0e2ef310b | review screen + form |
| E15 | a52e119c3 | ADRs 0393/0394/0395 |

## Learnings

| Learning | Context |
|----------|---------|
| `get_workspace_ids_for_user()` takes `auth.uid()` | The no-arg form (in the plan) would break on `db reset`. Canonical RLS form is `get_workspace_ids_for_user(auth.uid())`. Caught at Task 2. |
| `location` schema ≠ assumed | No `city`/`country_code`; has NOT-NULL `slug` + a `source` CHECK (`operational\|bubble_migration\|v3_engine`). New locations use `source='v3_engine'` + generated slug. Step-0 schema verification caught it (Task 3). |
| `routine_team.workspace_id` + `procedure.workspace_id` are NOT NULL | The RPC must stamp workspace_id on those inserts. |
| RPC hardening (L-0177 family) | Added fail-fast guards: actor-belongs-to-workspace, new-location null-name guard, `department_location` workspace filter. Found by code review on the load-bearing RPC. |
| Don't weaken prod schema for a test | Task 9 relaxed `location_id` from `.uuid()` to `.min(1)` to fit a fixture; corrected — fixed the fixture, restored the guard. |
| expo-image-picker v55 | `MediaTypeOptions` deprecated → use `mediaTypes: ['images']`. |
| Vision lives in stage-engine only | `generateObject` + OpenRouter are stage-engine-only; `packages/ai` has no LLM client. The extract route owns the single multimodal call. |

## Known Issues / Debt

- **Pre-existing branch typecheck debt (NOT 2B):** `@smartout/payroll-calculate` module-not-found (≈9 payroll BFF routes) + 2 governance component errors predate this sortie. Likely just needs `pnpm --filter @smartout/payroll-calculate build`. Triage before promote — it will fail a naive full `pnpm turbo typecheck` gate.
- **Pre-existing mobile error:** `apps/mobile/src/hooks/queries/use-procedure-steps.ts:46` TS2345 — unrelated, predates 2B.
- **Slug collision (latent, ADR-0393 area):** `location.slug` has no UNIQUE constraint today, so duplicate-name locations are accepted silently. If a future migration adds `UNIQUE(workspace_id, slug)`, the in-txn location insert will start raising on same-name locations — add slug de-duplication then.
- **Real vision not yet exercised:** `extractRoutineFromImage` is unit-tested with a mocked `generateObject`. The actual claude-sonnet-4.6 vision call is verified only via the on-device MANUAL walk (MT-1) — run it before promote.
- **Detox deferred** for the two mobile-surface journeys (fast-follow).
- **Web cut (V1.1) not built** — backend is surface-agnostic; web is pure L1 composition later.
- **Nudge-to-govern surface not built** — V1 emits `routine.governance_unassigned`; the surface that nudges attaching a protocol later is a future phase.

## Next Steps

1. Run the MANUAL on-device walk (MT-1..MT-6) and flip `photo-to-draft` + `review-and-commit` journeys to `verified`.
2. Triage the pre-existing payroll-calculate typecheck debt so the closure typecheck gate is clean.
3. Detox happy-path test for the mobile flow.
4. Web cut (V1.1): file-picker in BotssonChat + review Sheet, reusing the same BFF routes + RPC.
5. Nudge-to-govern surface that reads `routine.governance_unassigned`.
