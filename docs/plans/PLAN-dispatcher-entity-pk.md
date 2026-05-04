---
title: "Plan — dispatcher-entity-pk"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [plan, engine-dispatch, helpdesk, phase-2-prep]
---

# Plan — dispatcher-entity-pk

> Branch: `feat/helpdesk-dispatcher-entity-pk` | Worktree: /home/sxtnl/dev/smartout.ai-helpdesk-wt-3 | Base: `campaign/helpdesk` | Module: helpdesk-channel | Started: 2026-04-20

## Goal

Extend the `engine-dispatch` Edge Function's hand-maintained `ENTITY_PK` map (and its mirrored inline allowlist) so Phase 2 helpdesk capability tools can mutate `channel`, `channel_message`, and `engine_state` rows through generic `update_entity` dispatcher steps. Fix L-0085's silent-noop ceiling without touching any business logic.

## Tasks

- [x] Read L-0085 + ADR-0165 to anchor motivation.
- [x] Trace `engine-dispatch/index.ts` handler architecture (`update_entity`, `assign_task`, `start_process`, `GATED_MUTATION_TYPES`).
- [x] Verify primary-key columns for `channel`, `channel_message`, `engine_state` against migrations — all three use default `id`.
- [x] Add the three entries to `ENTITY_PK` with comments citing L-0085 + ADR-0165 + date.
- [x] Add the three entries to the inline `update_entity` allowlist with the same citations.
- [x] Write Deno whitelist-shape test (`entity_pk_test.ts`) that parses the source file and guards both structures against divergence.
- [x] Run `deno test` — 3/3 green.
- [x] Write journey (`docs/journeys/JOURNEY-dispatcher-entity-pk.md`).
- [x] Write handoff (`docs/HANDOFF-dispatcher-entity-pk.md`).

## Acceptance Criteria

- [x] `ENTITY_PK` contains `channel`, `channel_message`, `engine_state` (all `"id"`).
- [x] `update_entity` inline allowlist mirrors ENTITY_PK.
- [x] Deno whitelist-shape test passes.
- [x] No behavioral change for existing entity types (regression guard test passes).
- [x] Journey + handoff documents written.
- [x] Decision log requires no new entry — L-0085 and ADR-0165 already cover motivation.
