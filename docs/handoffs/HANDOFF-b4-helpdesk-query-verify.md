---
title: "HANDOFF — Phase B4 helpdesk_query verification"
status: done
updated: 2026-04-24
created: 2026-04-24
module: MODULE_BOTSSON
tags: [handoff, helpdesk, capability, authority-seed, adr-0162, adr-0165, campaign-b4, invariant-12]
---

# HANDOFF — Phase B4 helpdesk_query verification

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase B, item B4
> **Branch:** `feat/botsson-arena-b4-helpdesk-query-verify` (from `campaign/botsson-arena`)
> **Predecessor:** Phase B3 — `docs/plans/PLAN-helpdesk-phase-1.md`
> **Nature:** verification sortie — registration, seed, and tooling landed earlier on `campaign/botsson-arena`; this sortie produces falsifiable evidence, hardens the test surface with Invariant 12 artefact assertions, and flips the system-map row to 🟢.

## Summary

`helpdeskQueryCapability` is wired end-to-end. The six-row acceptance matrix is green against live Supabase Local state and the scoped test + typecheck suites. Three new Invariant 12 artefact-assertion tests prove the capability produces its declared domain artefact (`engine_state` row with correct `assignee_id` + `entity_id` + `context`) rather than returning a well-shaped-but-hollow success payload. A falsifiability probe on the `getTicket` assertion confirmed the test fails when the expected value drifts from the mocked DB row.

No behavioural code changes. The only production-file change in the handoff body is a system-map status flip. All implementation changes are in the test file (net-new assertions) and plan/map docs (status updates).

## Capability flow — one-screen prose map

```
User (web/chat) asks "jeg har et HR-spørsmål"
  → intent-classifier picks `helpdesk_query` (packages/ai/src/router/intent-classifier.ts:155)
  → agent-router (C4) reads engine_authority_config(workspace, 'helpdesk_query')
     → level='confirm' + min_role='manager' (ADR-0162)
     → employee downgraded to 'suggest' (read-only in UI); manager+ sees full tool set
  → channel guard: allowedChannels=['chat'] (ADR-0163) — voice path blocked
  → tool fan-out:
        read-only  : list_my_queue, get_ticket
        suggest    : open_ticket
        confirm    : resolve_ticket (terminal; requires assignee or company admin)
  → open_ticket execution:
        1. Reads channel row (helpdesk_enabled=true OR legacy channel_type='desk')
        2. Verifies workspace + responsible_profile_id exists
        3. Branches on privacy_mode:
              public                → entity_id = desk.id (reuses channel)
              private_per_requester → spawn query_thread sub-channel + 2 members
        4. Inserts engine_state (process_id='helpdesk_query_lifecycle',
           assignee_id=desk.responsible_profile_id, context={desk_channel_id,
           requester_profile_id, summary})
        5. emit('helpdesk.query.opened') → channel_event projection → Komm UI
  → resolve_ticket execution:
        1. Reads engine_state (workspace-scoped)
        2. Authorizes: assignee OR company_member with role ∈ {owner, admin}
           (admin lookup scoped to the ticket's workspace's company — no cross-
            tenant escalation per the scope check at tools.ts:322-344)
        3. Updates engine_state → status='complete', stamps completed_at
           + updated_at (L-0079 terminal-update discipline, mirrored test below)
        4. emit('helpdesk.query.resolved') → channel_event projection
```

No phantom contracts. Every emit has a matching registry entry (verified by
grepping `packages/telemetry/src/registry.ts` — both `helpdesk.query.opened`
and `helpdesk.query.resolved` present with full payload schemas).

## Acceptance matrix — what was run and what returned

| # | Criterion | Verification | Evidence |
|---|-----------|-------------|----------|
| 1 | Capability registered | `grep helpdeskQueryCapability packages/ai/src/capabilities/registry.ts` | 2 hits — import at :18, registration at :39. `CapabilityName` union in types.ts:24 includes `helpdesk_query`. Intent-classifier enum in router/intent-classifier.ts:56 includes it. |
| 2 | Authority seeded (no default-allow) | `SELECT … FROM engine_authority_config WHERE capability='helpdesk_query' AND level IS NOT NULL` on Supabase Local | 6/6 workspaces seeded with `level='confirm'`, `min_role='manager'`, `requires_four_eyes=false`, `observer_escalation_hours=72`. `SELECT w.workspace_id FROM workspace w WHERE NOT EXISTS (…)` returned 0 rows — no workspace lacks a seed. |
| 3 | Existing tests pass | `pnpm --filter @smartout/ai test -- helpdesk_query --run` | 19 original tests green in 482ms. After new assertions: 22/22 green in 409ms. |
| 4 | New E2E asserts artefact (Invariant 12) | Added 3 tests under `describe("helpdesk_query — artefact assertions (B4 Invariant 12)")`. Falsifiability probe: deliberately broke one `.toBe(OWNER_B4)` → test failed with `Received: bbbbbbbb-… Expected: ffffffff-…` → confirms it reads DB row, not hardcoded stub. Probe reverted. | `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts:435-649` |
| 5 | ADR-0165 discriminator used | `grep helpdesk_enabled` + `grep channel_type.*desk` under `packages/ai/src/capabilities/helpdesk_query/` | `helpdesk_enabled` present in tool select + runtime check. `channel_type === "desk"` appears exactly once as a legacy-accept OR clause at tools.ts:60 (commented as "the legacy channel_type='desk' enum is deprecated-not-dropped" per ADR-0165 backfill window). Zero new rows write `channel_type: 'desk'`. |
| 6 | Scoped typecheck 0 errors | `pnpm --filter @smartout/ai typecheck` | `npx tsc --noEmit` clean. Initial run flagged 2× `NonEmptyString` brand mismatches on the new `profileId` overrides; fixed by wrapping in `nonEmpty(REQUESTER_B4, "profileId")` (the same helper `makeCtx()` uses for the defaults). |

## The three new tests — what they assert

1. **`getTicket returns the exact responsible_profile_id stored on the engine_state row`** — "hvem er ansvarlig for denne ticket?" answered with `toBe(OWNER_B4)` AND `.not.toBe(PROFILE_ID)` + `.not.toBe(REQUESTER_B4)`. Fails loudly if the capability ever swaps `assignee_profile_id` with `requester_profile_id` or returns the caller's id.
2. **`openTicket writes engine_state.assignee_id = desk.responsible_profile_id (private mode)`** — captures every `.insert()` payload via a wrapped `sb.from`. Asserts the `engine_state` row going to the DB carries `assignee_id=OWNER_B4`, `entity_type='channel'`, `entity_id=THREAD_B4` (the spawned sub-channel), `process_id='helpdesk_query_lifecycle'`, and `context.{desk_channel_id, requester_profile_id, summary}` exactly matching the inputs. Also asserts both `channel_member` inserts (requester + rep) land on the right thread in the right workspace.
3. **`openTicket in public mode anchors engine_state on the helpdesk channel itself (ADR-0165 Rule 4)`** — same capture pattern, public-mode path. Asserts `entity_id=DESK_B4` (no sub-channel), zero `channel_member` inserts, zero `channel` inserts. Prevents accidental regression where public mode silently spawns a thread or mutates membership.

All three use distinct sentinel UUIDs (`aaaaaaaa-…`, `bbbbbbbb-…`, …) so a misread from the wrong row is visible in the assertion output.

## Authority-seed snapshot (Supabase Local, 2026-04-24)

```
             workspace_id             |   capability   |  level  | min_role | requires_four_eyes | observer_escalation_hours
--------------------------------------+----------------+---------+----------+--------------------+---------------------------
 00000000-0000-0000-0000-0000000000a1 | helpdesk_query | confirm | manager  | f                  |                        72
 b0000000-0000-0000-0000-000000000000 | helpdesk_query | confirm | manager  | f                  |                        72
 b1000000-0000-0000-0000-000000000000 | helpdesk_query | confirm | manager  | f                  |                        72
 b2000000-0000-0000-0000-000000000000 | helpdesk_query | confirm | manager  | f                  |                        72
 b3000000-0000-0000-0000-000000000000 | helpdesk_query | confirm | manager  | f                  |                        72
 b4000000-0000-0000-0000-000000000000 | helpdesk_query | confirm | manager  | f                  |                        72
```

total_workspaces = 6, seeded_workspaces = 6, missing = 0. L-0066 CVE-class trap (default-allow) not present.

## Gaps found, gaps fixed

**None of substance.** The capability was already correct. What this sortie added:

- Three falsifiable artefact-assertion tests (Invariant 12 evidence — the tests now fail loudly if the capability ever drops `assignee_id`, swaps it with the requester, or silently routes public mode into a spawned thread).
- System-map row flipped 🟡 → 🟢 with a concrete line of verification evidence.
- Campaign plan B4 checkbox flipped with a link back to this handoff.

No behavioural fixes were necessary.

## Decisions

No new ADRs. The capability obeys:

- ADR-0160 (channel_event projection), 0161 (ticket = `engine_state`), 0162 (authority seed), 0163 (chat-only PII), 0165 (`helpdesk_enabled` progressive discriminator).
- Invariant 11 (tool produces domain artefact — verified by insert-capture tests).
- Invariant 12 (falsifiable status claims — every row in the acceptance matrix cites a deterministic command + its output).
- L-0066 (no default-allow combos — seed verified 6/6).
- L-0079 (terminal `engine_state` transitions stamp `completed_at` — pre-existing regression test at tools.test.ts:384 covers this).
- L-0087 (schema-validated Supabase mock — inherited; new tests use the same `mockSupabase` helper).

## Learnings

**L-B4-01 — Falsifiability probes are cheap and decisive.** Before declaring a new assertion "green", briefly inject a wrong expected value and confirm the test fails with a meaningful message. Took 30 seconds, proved the test actually reads from the DB row rather than tautologically agreeing with itself. Consider this a default step for any new artefact-assertion test going forward.

**L-B4-02 — `NonEmptyString` brand at ctx override sites.** `makeCtx()` in this package's tests wraps every UUID through `nonEmpty(…, "fieldName")` to satisfy the `AgentToolContext` brand. When overriding `profileId` in a test-specific context, the override value must also go through `nonEmpty()` — `tsc` catches this, but `vitest` does not (runtime is happy with a raw string). Pattern: `makeCtx({ profileId: nonEmpty(MY_UUID, "profileId"), … })`.

**L-B4-03 — Legacy-accept OR clauses need comment-weight, not migration-weight.** The `desk.helpdesk_enabled === true || desk.channel_type === "desk"` line is the single safe form during the ADR-0165 backfill window. It stays until the legacy enum is dropped. The inline comment at tools.ts:45-48 plus the ADR-0165 reference are the contract — no code-level migration needed for B4.

## Known debt / next steps

- **B5 dispatch handlers** (`create_deviation`, `validate_settlement`, `lock_checkout`) still absent — unrelated to helpdesk, tracked on campaign plan.
- **Legacy `channel_type='desk'` enum drop** — deferred until all helpdesk channels carry `helpdesk_enabled=true` (backfill is live per migration `20260515160000_channel_helpdesk_backfill.sql`). Future sortie: drop the OR clause at tools.ts:60 and the enum value in a follow-up migration once a grep over production data confirms no stragglers.
- **Mobile thin-client surface** for helpdesk (read + reply + resolve) deferred to Phase 3 — `journey.run_guided` and `helpdesk_query.list_my_queue` are the only capabilities currently approved for mobile exposure, and neither has a BFF route yet. Blocked on ADR-0135 mobile-LiveKit bridge.
- **Representative-role authorization** in `resolve_ticket` — currently only the assignee or company admin may resolve. Reps who are members of the channel but not the assignee are explicitly out of scope (documented in tool body at tools.ts:309-311). Revisit if/when reassignment is implemented.

## Files changed

- `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts` — +3 tests (artefact assertions), +1 import implicitly covered (`nonEmpty` already imported).
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — helpdesk_query row 🟡 → 🟢 with verification evidence.
- `docs/plans/CAMPAIGN-botsson-arena.md` — B4 checkbox `[x]` + link to this handoff.
- `docs/HANDOFF-b4-helpdesk-query-verify.md` — this file.

No changes to capability source, registry, types, intent-classifier, authority seed, or any migration.

## Commands to re-run the acceptance matrix

```bash
# Row 1
grep -n "helpdeskQueryCapability" packages/ai/src/capabilities/registry.ts

# Row 2 (Supabase Local must be running)
docker exec supabase_db_smartout.ai psql -U postgres -d postgres -c \
  "SELECT workspace_id, capability, level, min_role, requires_four_eyes \
   FROM engine_authority_config WHERE capability = 'helpdesk_query' \
   AND level IS NOT NULL ORDER BY workspace_id;"

# Row 3 + 4
pnpm --filter @smartout/ai test -- helpdesk_query --run

# Row 5
grep -n "helpdesk_enabled\|channel_type.*desk" \
  packages/ai/src/capabilities/helpdesk_query/*.ts

# Row 6
pnpm --filter @smartout/ai typecheck
```

All six commands return the evidence documented above.
