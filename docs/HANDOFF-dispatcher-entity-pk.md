---
title: "Handoff — Dispatcher ENTITY_PK extension (L-0085 fix)"
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [handoff, engine-dispatch, helpdesk, phase-2-prep]
---

# Handoff — Dispatcher ENTITY_PK extension (L-0085 fix)

Sub-sortie D of the Helpdesk campaign. Extends the `engine-dispatch`
Edge Function so Phase 2 capability tools can mutate `channel`,
`channel_message`, and `engine_state` rows via `update_entity`
dispatcher steps.

## Summary

L-0085 identified a hand-maintained ceiling in
`supabase/functions/engine-dispatch/index.ts`: the `ENTITY_PK` map and
the inline `case "update_entity":` allowlist silently no-op for any
entity type not listed. This sub-sortie adds the three entries that
Phase 2 helpdesk work needs (`channel`, `channel_message`,
`engine_state`), keeps the two structures in sync, and adds a Deno
whitelist-shape test that guards against future divergence.

No business logic changed. No migrations. No Server Actions. No new
capability tools. Phase 2 does that work — this sortie only raises the
ceiling so it can land without dispatcher-side blockers.

## Files changed

| Path | Change |
|---|---|
| `supabase/functions/engine-dispatch/index.ts` | Added `channel`, `channel_message`, `engine_state` to `ENTITY_PK` (line 494 region) and to the `update_entity` inline allowlist (line 720 region). Inline comments cite L-0085, ADR-0165, and the 2026-04-20 date. |
| `supabase/functions/engine-dispatch/entity_pk_test.ts` | New Deno test. Three `Deno.test` cases: ENTITY_PK contains new Helpdesk entries, ENTITY_PK keeps existing entries (regression guard), update_entity allowlist mirrors ENTITY_PK. |
| `docs/journeys/JOURNEY-dispatcher-entity-pk.md` | Journey documentation — three scenarios (capability author, ticket resolution, reviewer audit). |
| `docs/HANDOFF-dispatcher-entity-pk.md` | This file. |

## ENTITY_PK entries added

```ts
channel: "id",
channel_message: "id",
engine_state: "id",
```

All three use the default `id` UUID primary key. Verified against:

- `supabase/migrations/20260422300000_channel_communications.sql:130`
  (`channel.id`) and `:197` (`channel_message.id`).
- `supabase/migrations/20260304100000_engine_process_tables.sql:130`
  (`engine_state.id`).

## Handler trace results

### `update_entity` (index.ts:715–755) — SUFFICIENT

The handler already reads `ENTITY_PK[entity]` to resolve the PK column
and runs a generic `.from(entity).update(setValues).eq(pkColumn, state.entity_id)`.
The only entity-specific branch is the allowlist check, which has now
been extended. No further architecture change required. Zero-row-change
errors are already surfaced via `status='blocked'` + `last_error` (the
hardening from ultrareview rp6ofqyfv bug_013 earlier this campaign).

**Status:** works correctly for the three new entities without additional
code beyond the allowlist + map extension.

### `assign_task` (index.ts:662–680) — INTENTIONALLY UNCHANGED

The handler only creates a `session_task` when `state.entity_type ===
"department_session"`. For other entity types it silently advances. For
a helpdesk ticket (`entity_type === "engine_state"` or `"channel"`),
extending this handler would require inventing a new destination table
(there's no ticket_task analog). The Progressive Channel council
explicitly scoped helpdesk ticket assignment to the `helpdesk_query`
capability's application-layer `assign_ticket` tool, not a dispatcher
step. Extending the dispatcher here would be speculative and
unexercised by Phase 2 call-sites.

**Status:** deferred. Revisit if a concrete Phase 2 use-case emerges.

### `start_process` (index.ts:883–892) — NO CHANGE NEEDED

Propagates `state.entity_type` and `state.entity_id` into sub-process
state without gating on entity type. Already works for the new entities.

### `GATED_MUTATION_TYPES` (index.ts:598–606) — UNCHANGED

This is the ADR-0099 action-type allowlist (`update_entity` is listed
as a gated mutation type). The gate runs against every `update_entity`
call regardless of entity type, so no change is required for the new
entities — they go through the same `gate_action` RPC call. Authority
config for Phase 2 helpdesk processes will live in
`engine_authority_config` rows (out of scope here).

### Other switch branches

Grepped `entity_type` / `entity_id` across the full 2691-line file
(46 hits). No other branch has a hardcoded entity-type case for
`department_session`-style routing that would need extending for the
helpdesk entities. Branches like `queue_shift_approval` (line 1854)
explicitly check `entity_type === "schedule_shift"` but are feature-
specific and irrelevant to helpdesk.

## Tests

`deno test --allow-read supabase/functions/engine-dispatch/entity_pk_test.ts`
passes 3/3:

- ENTITY_PK contains Helpdesk + channel entries (L-0085)
- ENTITY_PK keeps existing entries (regression guard)
- update_entity allowlist mirrors ENTITY_PK (L-0085 divergence guard)

The test parses the source file rather than importing it because
`index.ts` registers a top-level `Deno.serve` handler on import that
would start the HTTP server under the test runner. Parsing is hermetic,
dependency-free, and sufficient to catch the divergence class L-0085
describes.

**Existing Playwright test** `apps/e2e/governance-training-mvp/engine-dispatch.spec.ts`
remains the behavioral coverage for `update_entity`. The new Deno test
complements it by guarding the static shape of the two structures.

## Decisions made (all pre-existing ADRs — no new ADRs needed)

- **L-0085 already documents the motivation** — no new learning file.
- **No new ADR** — the scope is narrow infrastructure enablement that
  ADR-0165's Phase 2 consumer already anticipated.
- **Deno test over Vitest** — Edge Functions are Deno-native; adding a
  sibling Deno test keeps the toolchain consistent with the rest of
  `supabase/functions/`.
- **Parse source vs import for test** — import would trigger the
  top-level `Deno.serve` handler. Parse-and-assert is the minimum
  hermetic approach until the dispatcher is refactored to export its
  constants.

## Learnings

- The `update_entity` handler has TWO structures that must stay in sync
  (ENTITY_PK + the inline allowlist). L-0085 captured the ceiling; this
  sortie captured the divergence risk as a mechanical test.
- Handler tracing confirmed `update_entity` is generic. Only `assign_task`
  has entity-specific routing, and that routing points at
  `department_session`-specific tables — Phase 2 ticket assignment
  belongs in capability-layer tools, not the dispatcher.

## Known debt

1. **Hand-maintained ENTITY_PK map.** L-0085's long-term recommendation
   is to code-generate the map from `packages/supabase/src/database.types.ts`.
   Not done in this sub-sortie — scope remained "add three entries" so
   Phase 2 isn't blocked. Code-gen is a bigger refactor that deserves
   its own ADR about the source-of-truth contract between dispatcher
   and generated types.
2. **Two structures to maintain per entity.** Every new entity still
   requires updates in both `ENTITY_PK` AND the inline allowlist inside
   `case "update_entity"`. The new Deno test guards against divergence
   but doesn't eliminate the duplication. Consolidation (derive the
   allowlist from `Object.keys(ENTITY_PK)`) is a one-line refactor
   available whenever the dispatcher is next touched.
3. **`assign_task` for non-session entities is an unpaved road.** If a
   Phase 2 capability genuinely needs to route task creation through a
   dispatcher step for a non-`department_session` entity, the handler
   needs extension. Today no such use-case exists; flag when one
   appears.

## Next steps

1. **Phase 2 capability work** (separate sub-sortie): author
   `helpdesk_query` capability tools that consume the new dispatcher
   capabilities. ADR-0165 is the roadmap.
2. **Optional consolidation** (opportunistic): when the dispatcher is
   next touched, collapse the inline allowlist into
   `Object.keys(ENTITY_PK)` to halve the maintenance surface.
3. **Optional code-gen** (ADR candidate): replace `ENTITY_PK` with a
   generated registry driven by `database.types.ts`. L-0085 long-term
   fix.

## Verification checklist

- [x] ENTITY_PK map extended with three new entries
- [x] `update_entity` inline allowlist mirrors the map
- [x] Source-file comments cite L-0085 + ADR-0165 + 2026-04-20 date
- [x] Deno whitelist test passes (3/3)
- [x] No behavioral changes to pre-existing entities verified via test
- [x] Journey documentation written
- [x] Handoff written (this file)
- [x] No new ADR required (L-0085 + ADR-0165 cover the motivation)
- [x] No migrations required
- [x] No Server Action / capability-tool changes (out of scope)
