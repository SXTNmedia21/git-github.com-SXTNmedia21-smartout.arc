---
title: "engine_world platform-level writes bypass gate_action"
id: ADR_0290
status: accepted
layer: decision
created: 2026-05-06
updated: 2026-05-11
module: ai
tags: [engine-world, gate-action, telemetry, platform-rpc, audit]
relates_to:
  - ADR_0099 # unified authority gate
  - ADR_0204 # gatedMutation orchestrator
  - ADR_0281 # engine_world shared agent state
---

# ADR-0290: engine_world Platform-Level Writes Bypass gate_action

## ID escalation note

ADR-0282 was taken by `0282-voice-plane-consolidation-livekit-only.md` (voice plane
consolidation, 2026-05-04). This engine_world platform-RPC decision escalated to the
next free slot: **ADR-0290**. References in:
- `supabase/migrations/20260526000000_engine_world_phase_1.sql` — updated to 0290
- `docs/decisions/0281-engine-world-shared-agent-state.md` §"Authority gate carve-out" — updated to 0290
- `docs/superpowers/specs/2026-05-06-engine-world-phase-1.md` — updated to 0290

## Context and Problem Statement

`engine_world` has two write paths with different callers, contexts, and authority semantics:

**(a) User-facing writes** — `report_observation` capability tool. Called by a workspace
member (or Botsson on behalf of a workspace member) through the standard BFF chain.
Has a JWT, a `workspace_id`, a `profile_id`. Gate_action is the correct enforcement
point here — these writes affect the shared world model from an actor context that
carries trust boundaries.

**(b) Platform-level writes** — heartbeat jobs (`engine-world-refresh`), ci-incident-conductor,
stage-engine post-dispatch async writer. These callers run in service_role context (no
JWT, no workspace_id, no profile_id). They write infrastructure observations (Vercel
status, migration lag, worktree state) that are by definition platform-level (`workspace_id
IS NULL`).

Forcing path (b) through `gate_action` is structurally wrong: `gate_action` evaluates
a capability grant against a workspace authority config. Platform-level callers have
no workspace to gate against. The gate would either throw on missing context or default
to a deny — neither behaviour is correct for infrastructure telemetry.

The Phase B migration shipped `engine_world_observe_platform` as a SECURITY DEFINER RPC
that bypasses gate_action. This ADR documents the justification, constraints, and audit
substitute for that bypass.

## Decision Drivers

- Platform telemetry must work without manual workspace/profile setup on every host.
- Service-role bypass needs explicit authorization in writing — not a side-effect of
  "nothing prevents it."
- An audit substitute must exist; silent bypass with zero trace is unacceptable.
- The user-facing write path (path a) must remain fully gated — this ADR must not
  inadvertently weaken ADR-0099 or ADR-0204 for workspace-scoped writes.

## Considered Options

### Option A — Route platform writes through a synthetic service_role workspace

Create a reserved `workspace_id` representing the platform and route all platform
writes as workspace-scoped writes under that ID. Rejected: pollutes workspace-scoped
RLS queries with platform noise; violates the table design intent (`workspace_id IS NULL`
= platform surface); adds a fake workspace to all workspace lists.

### Option B — SECURITY DEFINER RPC for platform callers (chosen)

Separate RPC `engine_world_observe_platform` with SECURITY DEFINER + explicit
REVOKE/GRANT. Platform callers use this path. Workspace callers use the standard
gated capability tool. Clean separation of authority levels.

### Option C — Remove RLS from engine_world for service_role

Grant service_role INSERT on `engine_world` directly. Rejected: removes the
enforcement boundary entirely; any service_role code anywhere could write arbitrary
surfaces without documentation; harder to audit who is the intended caller.

## Decision Outcome

**Chosen: Option B.**

### Write paths

| Caller | Path | Authority | ADR |
|--------|------|-----------|-----|
| Workspace member via `report_observation` | `gatedMutation` + `engine.world_observe` capability gate | JWT workspace authority | ADR-0099 + ADR-0204 |
| Heartbeat jobs | `engine_world_observe_platform` RPC | service_role SECURITY DEFINER | This ADR |
| ci-incident-conductor | `engine_world_observe_platform` RPC | service_role SECURITY DEFINER | This ADR |
| stage-engine async writer | `engine_world_observe_platform` RPC | service_role SECURITY DEFINER | This ADR |

### REVOKE/GRANT contract

```sql
REVOKE ALL ON FUNCTION public.engine_world_observe_platform FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO service_role;
-- authenticated GRANT revoked 2026-05-11 by F-DB01-FIX migration
-- 20260528010000_revoke_engine_world_observe_platform_from_clients.sql
-- (audit 2026-05-10 F-DB-01 / G2 closure). Original "defense-in-depth"
-- rationale was overcautious — direct authenticated calls to this RPC
-- were never a sanctioned pattern, only the report_observation gated
-- capability tool (ADR-0290 path a). The grant created a cross-tenant
-- pollution vector without a corresponding caller need.
```

**Closure note (2026-05-11):** the `authenticated` GRANT shipped in Phase 1
(`20260526000000_engine_world_phase_1.sql:189`) and was re-asserted by Phase 2A
(`20260527000000_activity_trail_platform_actor.sql:188`). Migration `20260528010000`
(F-DB01-FIX) supersedes both — Postgres applies migrations in timestamp order, so
the REVOKE at `20260528010000` wins. The only sanctioned write path for user-facing
contexts is the `report_observation` gated capability tool (path a). The platform
RPC is service_role only (path b). See Open Questions §1 below for resolution detail.

To add a new platform caller: add it to the list in this ADR + add a comment in
the RPC caller site. Do not add new service_role callers without this documentation
update.

## Audit Substitute

### Phase 2A status (accepted 2026-05-27)

Migration `20260527000000_activity_trail_platform_actor.sql` landed the following schema changes:

- `activity_trail.actor_kind TEXT NOT NULL DEFAULT 'user'` added with CHECK `('user' | 'platform')`
- `workspace_id`, `actor_id`, `entity_id` dropped NOT NULL (FK constraints retained — Postgres FK allows NULL)
- CHECK constraint `activity_trail_user_actor_fields_required` re-enforces the user-actor invariant:
  `actor_kind = 'user'` requires all three non-null; `actor_kind = 'platform'` permits NULL
- New RLS policy `Godmode read platform activity`: godmode-only SELECT for `actor_kind = 'platform'` rows
- `engine_world_observe_platform` RPC updated: EXCEPTION block removed; real audit INSERT with
  `actor_kind = 'platform'` now writes successfully

Smoke test confirmed (2026-05-27): `SELECT engine_world_observe_platform(...)` returns 1 row with no
WARNING; `SELECT actor_kind, event FROM activity_trail WHERE event = 'engine_world.platform_write'`
returns `platform | engine_world.platform_write`. ADR moves from `proposed` → `accepted`.

`packages/telemetry/src/providers/activity-trail.ts` early-return at line 90 (`if (event.workspace_id === null) { return; }`) is **intentionally retained**. That guard applies to `emit()`-path events (PostHog/Logger routing), not to RPC-direct DB writes. The engine_world_observe_platform RPC writes activity_trail directly, bypassing the telemetry provider entirely. The guard correctly routes settlement-span events (ADR-0262) to billing_activity_log, not activity_trail. No change to the provider needed.

### Phase 1 status (code-verified 2026-05-06)

The Phase B migration wraps an `activity_trail` INSERT attempt in `EXCEPTION WHEN ... THEN
RAISE WARNING`. The INSERT always fails NOT NULL because `activity_trail` requires:
- `workspace_id UUID NOT NULL`
- `actor_id UUID NOT NULL` (FK to profile)
- `entity_id UUID NOT NULL`
- `event TEXT NOT NULL`, `action_verb TEXT NOT NULL`, `category TEXT NOT NULL`,
  `entity_type TEXT NOT NULL`

Platform writes have `workspace_id = NULL`, `actor_id = NULL`, `entity_id = NULL`.
The INSERT always raises `not_null_violation`. The RPC succeeds; the audit row is
never written.

Additionally, `packages/telemetry/src/providers/activity-trail.ts:90-93` contains
an early return for `event.workspace_id === null`:
```ts
if (event.workspace_id === null) {
  return;
}
```
This means that even if `emit()` is called with `engine_world observation_written`
for a platform write, the `activity_trail` destination silently no-ops. The event
still reaches PostHog and Logger destinations.

**Phase 1 audit reality:**
- PG log: WARNING per RPC exception block (low-visibility, requires server log access)
- PostHog: receives `engine_world observation_written` if heartbeat calls `emit()` after RPC
- Logger (stdout): same as PostHog
- activity_trail: **NO ROW WRITTEN** — confirmed gap

### Three options evaluated

**Option 1 — Schema migration:** Add `actor_kind TEXT DEFAULT 'user'` to `activity_trail`;
make `workspace_id`, `actor_id`, `entity_id` nullable when `actor_kind = 'platform'`.
Reconcile existing FK, RLS policies, and downstream queries. Highest fidelity but
most invasive — changes a high-traffic audit table. Reserved for Phase 2.

**Option 2 — New `engine_event_platform` table:** Purpose-built audit table for
platform writes. Cleaner separation but adds a table to an already-large schema.
Unnecessary if option 3 or 1 covers the need.

**Option 3 — Telemetry pipeline as audit (chosen for Phase 1):** Heartbeat job
calls `emit({ event: "engine_world observation_written", workspace_id: null, ... })`
after each RPC call. The event routes to PostHog + Logger (confirmed destinations
for `workspace_id: null` emits — `activity_trail` and `engine_event` destinations
skip silently per the early-return guard). PostHog + Logger are the Phase 1 audit
trail for platform writes. This requires the heartbeat script to call `emit()` — not
optional. PG WARNING in RPC is a last-resort fallback if emit() is not called.

**Chosen: Option 3 for Phase 1. Option 1 for Phase 2 (delivered in Phase 2A — see status above).**

The Phase 1 audit story is:
- Every platform write calls `emit({ event: "engine_world observation_written" })` from
  the heartbeat script after the RPC succeeds.
- PostHog captures the event with `surface_id`, `surface_type`, `status`, `observed_by`.
- Logger captures it to stdout (visible in Vercel logs / docker logs).
- PG WARNING is a secondary signal if emit() fails or is skipped.
- activity_trail gap is accepted for Phase 1 and tracked in this ADR.

Phase 2 closure condition: schema migration (option 1) lands; `activity_trail` receives
platform rows with `actor_kind = 'platform'`; this ADR updates to `accepted`.

### Tracking

SMA ticket for Phase 2 schema migration must be opened when this ADR ships. Label:
`engine-world`, `audit-gap`, `phase-2`. Until it closes, the audit gap is a known
accepted risk, not an unknown bug.

## Consequences

### Good
- Heartbeat + stage-engine async writes work without spurious gate_action invocations.
- Clear separation: platform telemetry via RPC, workspace mutations via capability gate.
- Audit story for Phase 1 is honest: PostHog + Logger, not pretended activity_trail rows.
- No new tables in Phase 1 (option 3 reuses existing telemetry pipeline).

### Bad
- REVOKE/GRANT pattern requires migration discipline — don't add new callers without
  updating this ADR and commenting the caller site.
- Phase 1 ships with activity_trail gap for platform writes. Must not be left open
  indefinitely — Phase 2 schema migration is the closure.
- If heartbeat job fails to call `emit()` after the RPC, the only audit signal is the
  PG WARNING (low-visibility). Heartbeat caller MUST call emit() — this is a caller
  contract, not a DB-enforced rule.
- `authenticated` GRANT is defense-in-depth, not an invitation. Document any future
  authenticated caller here before merging.

## Rules

1. **Never add a new caller to `engine_world_observe_platform` without updating this ADR.**
2. **Every caller MUST call `emit({ event: "engine_world observation_written" })` after
   the RPC succeeds.** This is the Phase 1 audit path.
3. **User-facing `report_observation` tool goes through `gatedMutation` only** — never
   calls this RPC directly.
4. **Phase 2 schema migration is mandatory** — this ADR does not close until
   `activity_trail` can receive platform rows. Target: when Phase 2 engine_world
   consumer wiring lands.
5. **Voice channel writes are excluded:** `report_observation` declares
   `allowedChannels: ["chat", "system"]`. Voice reads are fine; voice writes are
   explicitly blocked per ADR-0281 §"Channel guard".

## Open Questions

1. ~~**Should `authenticated` GRANT be revoked?**~~ **Resolved 2026-05-11 (G2 closure).**
   Revoked via migration `20260528010000_revoke_engine_world_observe_platform_from_clients.sql`.
   Audit 2026-05-10 F-DB-01 flagged the GRANT as a promotion-blocker — `authenticated`
   client could invoke the SECURITY DEFINER RPC and write arbitrary `surface_id` into
   platform-shared state. Original "defense-in-depth" framing in §REVOKE/GRANT contract
   was incorrect — the GRANT created a cross-tenant write vector without a corresponding
   caller need. The only sanctioned authenticated write path remains the
   `report_observation` gated capability tool (path a). Regression net: SQL test at
   `supabase/tests/engine-world-observe-platform-permissions.sql` will fail any future
   migration that re-grants EXECUTE to authenticated, anon, or PUBLIC.
2. **ADR-0078 channel pinning amendment (SMA-299):** When Phase 4 voice-prompts land,
   reconcile with this carve-out. Platform writes have no channel context; voice reads
   of engine_world surfaces are still covered by ADR-0281 §"Channel guard".

## References

- Migration: `supabase/migrations/20260526000000_engine_world_phase_1.sql`
- RPC: `public.engine_world_observe_platform`
- Telemetry routing: `packages/telemetry/src/registry.ts` lines 11038-11045
- Telemetry provider guard: `packages/telemetry/src/providers/activity-trail.ts` lines 90-93
- ADR-0281 carve-out clause: `docs/decisions/0281-engine-world-shared-agent-state.md` §"Authority gate carve-out"
- Heartbeat job: `infra/scripts/engine-world-refresh.sh`
