---
title: "Audit Slice 07 — DB RLS + Telemetry (2026-05-10)"
status: done
updated: 2026-05-10
created: 2026-05-10
module: platform
tags: [audit, rls, telemetry, emit, adr-0004, adr-0029, adr-0107, adr-0151, adr-0281, adr-0290, engine_world, voice]
---

# Audit Slice 07 — DB RLS + Telemetry

**Repo:** campaign/botsson-arena
**Baseline:** 2026-05-02 audit (`docs/audits/2026-05-02-adr-contract-validation/07-db-rls-telemetry.md`)
**ADR cluster:** 0004, 0011, 0012, 0029, 0044, 0107, 0151
**Surface audited:**
- `supabase/migrations/` — full list, focus on post-May-02 additions
- `packages/telemetry/src/registry.ts`
- `services/voice-agent/src/agent.ts` (Phase E voice quality telemetry)

---

## Summary (Top Findings)

| # | ID | Severity | One-line summary |
|---|---|---|---|
| 1 | F-DB-01 | HIGH | `engine_world_observe_platform` GRANT to `authenticated` — no function-level guard, documented risk but open attack surface |
| 2 | F-DB-02 | MEDIUM | 6 workspace-scoped tables missing `api_key_read_*` policy (ADR-0029) |
| 3 | F-DB-03 | LOW | `salary_type` + `end_date_reason` still have no RLS (baseline WARN persists from 2026-05-02) |
| 4 | F-DB-04 | INFO | `outreach sms_sent` + `outreach call_initiated` registered in registry with no code producer (acknowledged pre-declaration, not phantom) |
| 5 | F-DB-05 | PASS | Phase E voice quality events fully wired: registry + producers + destinations correct |
| 6 | F-DB-06 | PASS | engine_world Phase 1+2 (`actor_kind` discriminator + CHECK) correctly implemented |
| 7 | F-DB-07 | PASS | Baseline CV-1 (channel_department_access + channel_team_access zero-policy lockout) FIXED |
| 8 | F-DB-08 | INFO | `engine_world` platform rows readable by all authenticated users — explicitly accepted per ADR-0281 |

---

## F-DB-01 — HIGH: engine_world_observe_platform GRANT to authenticated without function-level guard

**Files:**
- `supabase/migrations/20260526000000_engine_world_phase_1.sql:133-135`
- `supabase/migrations/20260527000000_activity_trail_platform_actor.sql:185-188`

**Detail:**

Both Phase 1 and Phase 2A grant `EXECUTE` on `engine_world_observe_platform` to `authenticated` (not just `service_role`). The function is `SECURITY DEFINER`, meaning any logged-in user can call `supabase.rpc('engine_world_observe_platform', {...})` directly from client-side JS and write platform-level rows to `engine_world` (workspace_id=NULL) — bypassing `gate_action` entirely.

ADR-0290 documents this as a deliberate choice:

> "The authenticated grant is retained as defense-in-depth...Direct authenticated calls to this RPC are not a supported pattern and should not be added without a new ADR. The grant does not make it safe — it makes it possible for the one sanctioned caller."

The ADR acknowledges the risk but does not add any guard inside the function body (no `is_godmode` check, no role assertion, no caller verification). The "sanctioned" path is `report_observation` tool → `gatedMutation` → JWT write to `engine_world` (workspace-scoped). But nothing prevents a motivated client-side caller from hitting the platform path directly and writing `surface_id='vercel.web'`, `status='red'` etc. to engine_world platform rows.

**Recommendation:** Add an `is_godmode` or explicit `current_setting('role')` guard inside the function body, OR scope the grant to `service_role` only and document that authenticated callers always go through `report_observation`. The current state is an undocumented capability gap between the ADR intent and the enforced surface.

**Severity rationale:** Not exploitable for data exfiltration (engine_world holds infra status, not PII). Impact is polluting platform telemetry or causing false-alarm triggers. Severity is HIGH because the vector is trivially exploitable from client JS.

---

## F-DB-02 — MEDIUM: 6 workspace-scoped tables missing api_key_read_* policy (ADR-0029)

ADR-0029 (workspace-api gateway) states:

> "New workspace-scoped tables MUST get both a JWT-based and `api_key_read_*` RLS policy"

The following tables have `workspace_id NOT NULL` and JWT policies but no `api_key_read_*` policy:

| Table | Migration | Has JWT? | Has api_key? | Notes |
|---|---|---|---|---|
| `agent_session_recording` | `20260515120100` | YES (`jwt_admin_read_asr`, `godmode_read_asr`) | NO | Intentionally admin-only, but external read path blocked entirely |
| `agent_session_whisper` | `20260515120300` | YES (`jwt_admin_rw_whisper`, `godmode_rw_whisper`) | NO | Admin-injected metadata; external API read likely not needed |
| `employment_contract_detail` | `20260515100300` | YES (`select_employment_contract_detail`, `admin_insert_employment_contract_detail`) | NO | Workspace HR data; external integrations (payroll) may need read access |
| `payroll_ledger_archive` | `20260515100500` | YES (`select_payroll_archive`) | NO | Migration archive; external payroll system may need read access |
| `gate_evaluation` | `20260505110000` | YES (`admin_read_gate_evaluation`) | NO | Internal audit log; API key read unlikely needed |
| `engine_state_archive` | `20260508100100` | service_role only | NO | Internal archive; no JWT read path either |

**Note on billing schema tables** (`settlement_period`, `settlement_run`, `settlement_artifact`, `billing_dispatch_rule`, etc.): these are accessed via the `billing.accountant_company_grant` model, not the standard workspace API key pattern. ADR-0118 documents billing as company-scoped. Not counted as ADR-0029 violations.

**Recommendation:** For `employment_contract_detail` and `payroll_ledger_archive` — add `api_key_read_*` policies. For the others (`agent_session_recording`, `agent_session_whisper`, `gate_evaluation`) — add an explicit ADR-0029 exemption comment in the migration if external API read is intentionally not supported.

---

## F-DB-03 — LOW: salary_type + end_date_reason still lack RLS (baseline WARN persists)

**File:** `supabase/migrations/20260519100100_contracts_module_foundation.sql`

These two platform-level lookup tables were flagged in the 2026-05-02 baseline as WARN (no `ENABLE ROW LEVEL SECURITY`). They remain unaddressed.

| Table | workspace_id | RLS enabled | Verdict |
|---|---|---|---|
| `salary_type` | none (platform-level) | NO | No protection against write via service_role misconfiguration |
| `end_date_reason` | none (platform-level) | NO | Same |

Pattern precedent: `tariff_rate_table` and `public_holiday` (platform-level tables) have RLS with a SELECT-for-authenticated policy. These tables should follow the same pattern.

**Recommendation:** Add `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "authenticated_read" ... FOR SELECT TO authenticated USING (true)` on both tables. Blocks unauthenticated reads and establishes the pattern.

---

## F-DB-04 — INFO: outreach events pre-declared, no producer yet

**Files:**
- `packages/telemetry/src/registry.ts:11198-11205` (routing entries)
- `packages/telemetry/src/registry.ts:8299-8320` (interface definitions)
- `packages/ai/src/router/tool-selector.ts:121-126` (TRANSITIONAL comment)

Events `outreach sms_sent` and `outreach call_initiated` are registered in the routing map with full 4-destination routing, but no code producer exists. The `outreach` capability has no implementation yet under `packages/ai/src/capabilities/outreach/`.

The tool-selector explicitly documents this:

```
//   - outreach  → TRANSITIONAL: intent enum added 2026-05-05 by commit
//                  8e94fd92a ahead of the outreach capability landing.
//                  The `outreach` capability + tools register in a follow-up sortie.
```

This is an **acknowledged pre-declaration**, not an L-0083 phantom. The registry and type system are forward-compatible.

**No action required.** Verify the outreach capability sortie closes this before Phase F production launch (events with `engine_event` routing have no fanout until the producer lands).

---

## F-DB-05 — PASS: Phase E voice quality events fully wired

**Files:**
- `packages/telemetry/src/registry.ts:4374-4426` (interface definitions)
- `packages/telemetry/src/registry.ts:9847-9865` (routing entries)
- `services/voice-agent/src/agent.ts:138-261` (producers)

All four Phase E voice runtime quality events are correctly implemented end-to-end:

| Event | Interface | Routing | Producer | Destinations |
|---|---|---|---|---|
| `voice.first_speech_ts_ms` | `VoiceFirstSpeechTs` (line 4374) | line 9850 | `agent.ts:178` (`UserStateChanged`) | `["posthog", "logger"]` |
| `voice.turn_end_ts_ms` | `VoiceTurnEndTs` (line 4387) | line 9854 | `agent.ts:225` (`UserInputTranscribed`, `isFinal`) | `["posthog", "logger"]` |
| `voice.user_recut` | `VoiceUserRecut` (line 4402) | line 9858 | `agent.ts:196` (`UserStateChanged`, gap<2000ms) | `["posthog", "logger"]` |
| `voice.session_abandonment` | `VoiceSessionAbandonment` (line 4415) | line 9862 | `agent.ts:247` (`RoomEvent.Disconnected`, `firstSpeechFired=false`) | `["posthog", "logger"]` |

Routing is `posthog + logger` only (no `activity_trail`, no `engine_event`). This is correct per the registry comment at line 9847-9849:

> "OBSERVATIONAL only — no activity_trail (no audit need) and no engine_event (no workflow trigger). PostHog + logger for Phase F1 data-driven tuning."

The interface types are also included in the `EventRegistry` union at lines 8010-8013. Workspace_id is handled with a `null`-safe `nonEmpty()` guard pattern (agent.ts:163-166) that correctly permits `null` for pre-context events.

**PASS. No action required.**

---

## F-DB-06 — PASS: engine_world Phase 1+2 — actor_kind discriminator correctly implemented

**Files:**
- `supabase/migrations/20260525000000_engine_world.sql` — Phase 0: table, enums, RLS, capability seed
- `supabase/migrations/20260526000000_engine_world_phase_1.sql` — Phase 1: SECURITY DEFINER RPC (EXCEPTION block), capability level upgrade
- `supabase/migrations/20260527000000_activity_trail_platform_actor.sql` — Phase 2A: actor_kind column, CHECK constraint, real audit row

Migration ordering is correct (timestamps 20260525 → 20260526 → 20260527). No duplicate timestamps.

Phase 2A verification against memory entry `learning_activity_trail_platform_gap.md`:

| Requirement | Status |
|---|---|
| `actor_kind TEXT NOT NULL DEFAULT 'user'` with CHECK `('user', 'platform')` | PASS — line 42-44 of Phase 2A |
| Drop NOT NULL on `workspace_id`, `actor_id`, `entity_id` | PASS — lines 58-65 |
| Conditional CHECK preserving user-actor invariant | PASS — lines 73-79 |
| `entity_type TEXT NOT NULL` retained | PASS — unchanged |
| Godmode-only SELECT for `actor_kind='platform'` rows | PASS — lines 93-102 |
| RPC EXCEPTION block removed; real INSERT with `actor_kind='platform'` | PASS — Phase 2A replaces Phase 1 function via `CREATE OR REPLACE` |

Phase 1 function comment explicitly noted the audit gap as intentional:

> "Phase E ADR-0290 author must reconcile if activity_trail gains a nullable platform-actor path."

Phase 2A closes this gap cleanly.

**PASS. No action required.**

---

## F-DB-07 — PASS: Baseline CV-1 fixed (channel_department_access + channel_team_access)

**File:** `supabase/migrations/20260520170000_channel_access_rls_policies.sql`

The 2026-05-02 baseline CV-1 (CRITICAL) flagged zero-policy lockout on `channel_department_access` and `channel_team_access`. Migration `20260520170000` ships all required policies:

- JWT SELECT, INSERT, UPDATE, DELETE for workspace members / admins
- API key SELECT for both tables

Policies verified at lines 27-88. **CV-1 is CLOSED.**

---

## F-DB-08 — INFO: engine_world platform rows visible to all authenticated users

**File:** `supabase/migrations/20260525000000_engine_world.sql:117-128`

The `engine_world_read_jwt` policy exposes rows where `workspace_id IS NULL` (platform-level: CI status, service health, PR states) to all authenticated users. This is intentional and documented in ADR-0281:

> "RLS exposes platform-level rows to all authenticated sessions plus workspace-scoped rows to workspace members."

All Smartout employees can see CI workflow status, Vercel deployment states, and campaign states via `engine_world`. This may be more visibility than needed for non-admin roles, but is consistent with the ADR decision. Not a finding — flagged for awareness.

---

## Migration Timestamp Audit (post-May-02)

| Range | Duplicate timestamps | Out-of-order dependencies | Verdict |
|---|---|---|---|
| 20260503 – 20260527 | None detected | None detected | PASS |

engine_world dependency chain confirmed correct: Phase 0 (20260525) < Phase 1 (20260526) < Phase 2A (20260527).

---

## Telemetry Registry Summary

| Event cluster | Interfaces defined | In EventRegistry union | In routing map | Producers found | Status |
|---|---|---|---|---|---|
| `voice.first_speech_ts_ms` + 3 siblings | YES (4374-4426) | YES (8010-8013) | YES (9850-9863) | YES (`agent.ts:138-261`) | PASS |
| `engine_world observation_written` + `status_changed` | YES | YES | YES (11213-11219) | YES (`packages/ai/src/capabilities/engine-world/tools.ts:285,300`) | PASS |
| `outreach sms_sent` + `call_initiated` | YES (8299-8320) | YES | YES (11198-11205) | NO — capability not yet shipped | INFO (pre-declaration) |
| `voice.session_started/ended/transcript_in/response_out` | YES (4308-4366) | YES | YES (9830-9844) | assumed in BFF/mobile (not re-verified this pass) | PASS (unchanged from baseline) |

---

## Per-ADR Rollup

| ADR | Title | Status | Notes |
|---|---|---|---|
| ADR-0004 | Unified telemetry — every mutation emits | NOT RE-VERIFIED this pass | Baseline CV-2/CV-3/CV-4 still open per 2026-05-02 report |
| ADR-0011 | user_identity table naming | PASS | No regressions |
| ADR-0012 | Subscription data on company table | PASS | No regressions |
| ADR-0029 | workspace-api gateway + RLS dual-policy | PARTIAL FAIL | 6 tables missing api_key_read_* (F-DB-02) |
| ADR-0044 | Invitation table naming | PASS | No regressions |
| ADR-0107 | BotssonProvider channel derivation | PASS | No regressions |
| ADR-0151 | profile_id derived server-side | PASS (voice path) | `agent.ts` uses `getSessionContextSnapshot()`, not body-supplied IDs |
| ADR-0281 | engine_world shared agent state | PASS | Implementation matches ADR |
| ADR-0290 | engine_world platform RPC bypass | PASS (with caveat) | Phase 2A closed the audit gap; authenticated grant risk documented in F-DB-01 |
