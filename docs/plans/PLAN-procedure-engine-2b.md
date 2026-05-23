---
title: "Plan — procedure-engine-2b"
feature: procedure-engine-2b
spec: docs/superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md
status: draft
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [plan]
---

# Plan — procedure-engine-2b

> Branch: `feat/procedure-engine-2b` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-7` | Base: `development` | Module: procedure-engine

**Spec:** [Procedure Engine 2B — Botsson Bilde→Rutine](../superpowers/specs/2026-05-22-procedure-engine-2b-bilde-til-rutine-design.md)
**Implementation plan (full, 16 tasks):** [2026-05-22-procedure-engine-2b-bilde-til-rutine](../superpowers/plans/2026-05-22-procedure-engine-2b-bilde-til-rutine.md)

## Journeys (the contract)

- [JOURNEY-procedure-engine-2b-photo-to-draft](../journeys/JOURNEY-procedure-engine-2b-photo-to-draft.md) — Manager long-presses FAB, picks/captures a checklist photo, draft card appears
- [JOURNEY-procedure-engine-2b-review-and-commit](../journeys/JOURNEY-procedure-engine-2b-review-and-commit.md) — Manager edits the draft (steps/location/teams) and confirms, routine created
- [JOURNEY-procedure-engine-2b-vision-extract-atomic-commit](../journeys/JOURNEY-procedure-engine-2b-vision-extract-atomic-commit.md) — Vision extract produces a draft with zero writes, atomic RPC commits all rows in one txn
- [JOURNEY-procedure-engine-2b-agent-provenance-ungoverned](../journeys/JOURNEY-procedure-engine-2b-agent-provenance-ungoverned.md) — Created routine carries image provenance and governance_status='unassigned'
- [JOURNEY-procedure-engine-2b-inline-location-create](../journeys/JOURNEY-procedure-engine-2b-inline-location-create.md) — A new location is created in-txn during commit when the manager picks "Ny lokasjon"

## Goal

Mobile-first: a manager photographs an existing checklist; Botsson vision-extracts a structured routine draft; the human reviews/edits; an atomic RPC commits it — born ungoverned (no protocol required).

## Tasks

See the full 16-task TDD plan: [2026-05-22-procedure-engine-2b-bilde-til-rutine](../superpowers/plans/2026-05-22-procedure-engine-2b-bilde-til-rutine.md). Phases:

- [ ] Phase A — schema (brownfield governance) + routine-source bucket + `fn_create_routine_from_draft` RPC + regen types
- [ ] Phase B — shared `DraftSchema` + stage-engine `POST /routine/extract` (generateObject vision)
- [ ] Phase C — telemetry events + `/api/mobile/routine/extract` + `/api/mobile/routine/commit`
- [ ] Phase D — mobile: upload helper + `useRoutineExtract` + image button + draft card + review screen
- [ ] Phase E — ADRs 0393/0394/0395 + journeys + manual test + handoff

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (ADR-0405/0406/0395 registered)
- [ ] Backend tests green (draft-schema, routine-extract, extract route, commit route)
- [ ] SQL atomicity + happy-path verified after `db reset`
- [ ] Manual on-device walk completes (Detox deferred per spec)
