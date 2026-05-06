---
title: "Journey — Stage-engine + ci-conductor rapporterer tilbake til engine_world"
feature: engine-world-phase-1
journey: agent-rapporterer-tilstand
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: ai
tags: [journey, engine-world, stage-engine, gated-mutation, security-definer]
---

# Journey: Agent rapporterer tilstand til engine_world

**Role:** Two paths — (a) user-facing through gated capability, (b) platform-level via SECURITY DEFINER RPC

**Precondition:**
- Phase 1 migration applied (RPC `engine_world_observe_platform` exists, `engine.world_observe` capability level upgraded to `confirm`)
- ADR-0281 carve-out clause + ADR-0282 drafted
- `report_observation` tool registered in `packages/ai/src/capabilities/engine-world/tools.ts`
- Stage-engine async writer hook live in `agent-router.ts`

## Happy Path A — User-facing gated write via `report_observation`

1. User says (chat): "Marker workspace status som operasjonell etter siste fix"
2. Botsson classifies intent → `engine_world` capability → `report_observation` tool
3. Tool wraps `gatedMutation` per ADR-0204 → `gate_action` checks `engine.world_observe` capability level for user's profile
4. If level allows (`confirm` or higher): UI prompt confirms → User accepts → tool body UPSERTs engine_world row via supabase client (RLS allows authenticated workspace member)
5. Tool emits `engine_world observation_written` (existing space-form event from registry)
6. Telemetry routes to PostHog + Logger + activity_trail + engine_event per registry config
7. User sees confirmation; next chat turn `<world_state>` injection reflects new row

**Postcondition A:** New engine_world row visible to all workspace members + platform readers. activity_trail entry with `actor_id = profile_id`, `denied_by_gate = NULL`.

## Happy Path B — Stage-engine async writer (platform-level)

1. Botsson dispatch completes in `agent-router.ts` (response sent to client)
2. AFTER dispatch, async writer fires (no await): `void supabaseAdmin.rpc('engine_world_observe_platform', { p_surface_id: 'stage_engine.dispatch', p_surface_type: 'service', p_status: 'green', p_details: { p95_ms: <agg>, error_rate: <agg> }, p_ttl_seconds: 600, p_observed_by: 'stage-engine' }).then(null, recordError)`
3. RPC runs SECURITY DEFINER → bypasses gate_action (per ADR-0282 carve-out) → UPSERT engine_world row with `workspace_id IS NULL` (platform-level)
4. p95/error-rate aggregation pre-computed via `setInterval` timer (5min window), not per-request
5. activity_trail row written with `actor_kind = 'platform'`, `denied_by_gate = NULL` (audit substitute per ADR-0282)
6. Next user query reading `<world_state>` sees fresh `stage_engine.dispatch` row

**Postcondition B:** Platform-level surface visible to all workspaces. Request path latency unaffected.

## Happy Path C — ci-conductor counter-report (Phase 2 wire-up, but writer surface ready in Phase 1)

1. ci-incident-conductor classifies a CI failure → calls `engine_world_observe_platform` RPC (service_role) → writes `ci.workflow.<name>` with `status: 'red'`
2. After auto-fix or manual resolution: same RPC writes `status: 'green'`
3. Both writes emit `engine_world status_changed` event (existing space-form, registry.ts:8187)
4. Botsson chat reader sees transition in next `<world_state>` injection

**Postcondition C:** CI state visible to Botsson without re-running diagnostics.

## Error Paths

- **Scenario A:** User without sufficient capability level calls `report_observation` → `gate_action` returns deny → tool returns gate-denied error → No engine_world row written → activity_trail entry with `denied_by_gate = 'engine.world_observe'`
- **Scenario A:** RLS rejects insert (e.g. user in workspace X tries to write workspace Y row) → tool catches PostgresError → returns user-readable error
- **Scenario B:** RPC errors (SECURITY DEFINER context fails, e.g. p_surface_type invalid enum) → `recordError` logs, no throw to request path → request response unaffected → activity_trail entry with `error_kind = 'engine_world_write_failed'`
- **Scenario B:** Aggregation timer not yet fired (<5min since service start) → writer skips p95/error-rate fields → row written with `details: {}` → readers see surface as healthy by default
- **Scenario:** Voice channel attempts `report_observation` → capability `writeAllowedChannels` excludes voice → tool selector hides tool from voice prompt → No write attempt
- **Scenario:** TTL expired on existing surface → next reader marks `is_stale: true` → status surface degrades gracefully to "unknown"

## Verification

- [ ] Implementation matches both Path A and Path B
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Path A: gated write succeeds with authorized profile, denies with unauthorized profile per ADR-0099
- [ ] Path B: stage-engine async write does NOT add measurable latency to request path (verify via load test or timing assertion)
- [ ] activity_trail audit substitute works for SECURITY DEFINER writes (ADR-0282 audit clause verified)
- [ ] Manually tested: voice channel cannot trigger `report_observation` (capability channel split enforced)
- [ ] Telemetry: `engine_world observation_written` and `engine_world status_changed` emit on both paths; routing reaches PostHog + activity_trail
- [ ] No parallel dot-form `world.*` events appear anywhere in registry or emit calls

**Mark `status: verified` in frontmatter when all eight boxes are checked.**
