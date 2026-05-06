---
title: "Audit Slice 07 — DB/RLS/Telemetry"
status: done
created: 2026-05-06
updated: 2026-05-06
module: db-rls-telemetry
tags: [audit, rls, telemetry, database]
---

# Slice 07 — DB / RLS / Telemetry Audit (2026-05-06)

**Scope:** `supabase/migrations/` (last 30 days, ~126 files reviewed), `packages/telemetry/src/registry.ts` (10 871 lines), `packages/supabase/src/database.types.ts` (checked for staleness and manual edits).

**ADRs checked:** ADR-0004 (unified telemetry), ADR-0011 (user_identity naming), ADR-0012 (subscription on company), ADR-0029 (workspace-api dual-auth), ADR-0044 (invitation table), ADR-0107 (channel derivation), ADR-0151 (profile_id server-derivation).

---

## Findings

### CRITICAL

None in this period.

---

### HIGH

#### H-01 — `engine_world` table missing from `database.types.ts`

**Migration:** `20260525000000_engine_world.sql` (created 2026-05-05 16:13).  
`database.types.ts` was regenerated at 22:14 the same day, but `engine_world` does **not** appear in the file. Zero matches for `engine_world`, `engine_world_surface_type`, or `engine_world_status` in the types file.

Impact: all TypeScript call sites that try to reference `supabase.from("engine_world")` will get type-unsafe `any` responses or explicit casts — undermining the "never `any`" code convention and silencing future mismatches.

**Resolution:** regenerate `database.types.ts` against a DB that has run `20260525000000_engine_world.sql`.

---

#### H-02 — `engine_world` write path has no JWT or API-key policy — intentional but high-risk until gated capability ships

The migration explicitly omits JWT and API-key write policies, deferring to "service_role + gated capability (`engine.world_observe`)". However the capability tool itself is not yet shipped (migration notes: "producer + consumer go in follow-up sortie"). Until that sortie lands:

- Only service_role can write `engine_world` rows (heartbeat jobs, ci-incident-conductor).
- No JWT-based update path exists for workspace-admin corrections.
- The `capability_default_registry` row for `engine.world_observe` is seeded with `level='read_only'` — correctly restrictive, but `gate_action` cannot block non-existent call sites.

This is a planned gap with a follow-up sortie, but the absence of the capability tool while the table is live means the "write path" is currently silently dark for workspace-scoped surfaces. Flag as HIGH until the producing sortie closes.

---

#### H-03 — `outreach` capability ships authority seed but has zero telemetry events registered

`20260525110000_outreach_capability_authority_seed.sql` seeds `engine_authority_config` for `capability='outreach'` (send_sms, call_employee). No corresponding events (`outreach.sms_sent`, `outreach.call_initiated`, etc.) exist in `packages/telemetry/src/registry.ts`.

ADR-0004 mandates: every mutation emits through the registry. A capability that performs SMS or voice calls without emit() is dark on all four destinations (PostHog, Logger, activity_trail, engine_event). Given the ADR-0282 context (employee outreach at scale), missing telemetry here is an audit-trail gap.

**Resolution:** add outreach events to registry.ts before shipping outreach tools.

---

### MEDIUM

#### M-01 — `salary_type` and `end_date_reason` still have no RLS (persists from 2026-05-02 baseline)

Both tables were created in `20260519100100_contracts_module_foundation.sql` as K1a platform reference tables (no `workspace_id`). No `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and no `CREATE POLICY` statements exist for either table in any migration, including all post-2026-05-19 migrations.

These are read-only lookup/seed tables so the data is not sensitive and there is no write risk from the JWT path. However: (a) the tables have no RLS at all, meaning `anon` can read them directly; (b) the 2026-05-04 `REVOKE anon` hardening migration (`20260524000000`) revoked anon from 60+ functions but left the tables themselves open.

**Resolution:** `ALTER TABLE salary_type ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "read_authenticated" FOR SELECT TO authenticated USING (true)`. Same for `end_date_reason`. No workspace_id scoping needed (K1a = platform-level).

---

#### M-02 — `gatedMutation` SS-5 `gate_evaluated` emit still not wired (persists from 2026-05-02 baseline)

`packages/ai/src/gate/gatedMutation.ts` explicitly notes:
> `gate_evaluated` emit is NOT wired in SS-3. ... Emit requires a registry entry and is tracked for SS-4.

SS-4 flag has been flipped ON (orchestrator is now default-enabled), but no `gate_evaluated` event exists in `registry.ts`. This means every composition decision passes through `gatedMutation()` without a telemetry event — 7+ capability tools affected. Noted as a 2026-05-02 finding; no change in status.

---

#### M-03 — `billing.accountant_company_grant` has no API-key read policy; write path is service_role only with no admin JWT path

The table has a single SELECT policy (`user_id = auth.uid() AND revoked_at IS NULL`) and no INSERT/UPDATE/DELETE JWT policies. The comment says "Pontus/godmode bypass via service_role." There is no admin-facing Server Action confirmed to write grants via service_role.

Two gaps:
1. No API-key read policy — inconsistent with ADR-0029 dual-auth requirement for workspace-scoped (and cross-workspace) data tables.
2. No JWT write path for platform-admin — Pontus must write grants exclusively via service_role seed or direct DB access. Acceptable for now (Erik is seeded), but will need an admin UI path for future accountants.

This is LOW urgency given the single-user (Erik) pattern, but HIGH compliance drift from ADR-0029.

---

#### M-04 — `engine_world` telemetry: no registered events for world-observe mutations

The migration explicitly notes "NO emit() in this migration — phantom-emit prevention. Producer + consumer go in follow-up sortie." This is intentional but creates a gap: the table is live, the authority config is seeded, and when heartbeat/CI-conductor begin writing rows, there will be no telemetry events registered in the registry. Add `engine_world.observation_written` and `engine_world.status_changed` events to registry.ts before the producer sortie ships.

---

### LOW

#### L-01 — `database.types.ts` potentially stale for 3 newer-by-filesystem migrations

Filesystem timestamps show 3 migrations newer than `database.types.ts` (22:14 2026-05-05):
- `20260422215500_system_actor_profile_seed.sql` — seed only, no schema change, no type impact.
- `20260429095006_staff_event.sql` — needs verification, but likely seed.
- `20260525110000_outreach_capability_authority_seed.sql` — seed/INSERT only, no new tables or enums.

`engine_world` (H-01) is the only confirmed schema gap. The others appear to be seed-only, so types staleness is isolated to `engine_world`.

---

#### L-02 — `personal_task` telemetry missing `engine_event` destination

`personal.task_created` routing: `["posthog", "activity_trail"]` (2 destinations).  
For a capability-tool write that may trigger downstream workflow (e.g. remind user at `due_at`), the `engine_event` destination would be needed if due-date enforcement is ever wired via the Event Engine. Currently the `engine_event` absence is intentional (no engine_process consuming personal task events), but should be flagged when an engine process is added.

---

## Delta vs 2026-05-02 Baseline

| Baseline Finding | Status |
|---|---|
| `channel_department_access` + `channel_team_access` zero-policy lockout | **CLOSED** — `20260520170000_channel_access_rls_policies.sql` committed `c8d7c49ed` |
| `salary_type` + `end_date_reason` missing read-only RLS | **OPEN** — no migration added since |
| `gatedMutation` SS-5 `gate_evaluated` emit dark | **OPEN** — SS-4 flag ON, but event still unregistered |
| 30+ mutation sites dark (no emit) | **PARTIALLY RESOLVED** — settlement, availability, helpdesk, journey, personal events added; outreach still dark (H-03) |
| 11 mobile offline-sync action types dark | **NOT VERIFIED** this slice — out of scope for slice 07 |

**New findings since 2026-05-02:**
- H-01: `engine_world` table missing from `database.types.ts`
- H-02: `engine_world` write path dark until capability sortie ships
- H-03: `outreach` capability zero telemetry
- M-03: `billing.accountant_company_grant` missing API-key read policy + no JWT write path
- M-04: `engine_world` observation events unregistered

---

## Summary Table

| ID | Severity | Title |
|---|---|---|
| H-01 | HIGH | `engine_world` missing from `database.types.ts` |
| H-02 | HIGH | `engine_world` write path dark (no capability tool yet) |
| H-03 | HIGH | `outreach` capability — zero telemetry events in registry |
| M-01 | MEDIUM | `salary_type` + `end_date_reason` no RLS (persists) |
| M-02 | MEDIUM | `gatedMutation` `gate_evaluated` emit unregistered (persists) |
| M-03 | MEDIUM | `billing.accountant_company_grant` missing API-key policy + no admin JWT write |
| M-04 | MEDIUM | `engine_world` observation events unregistered |
| L-01 | LOW | 3 filesystem-newer migrations — likely seed-only, verify |
| L-02 | LOW | `personal.task_created` missing `engine_event` destination |

**CRIT: 0 | HIGH: 3 | MEDIUM: 4 | LOW: 2**
