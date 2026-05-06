---
title: "Plan — engine-world-phase-1"
feature: engine-world-phase-1
spec: ../superpowers/specs/2026-05-06-engine-world-phase-1.md
status: draft
updated: 2026-05-06
created: 2026-05-06
module: ai
tags: [plan, engine-world, agent-coordination, stage-engine]
---

# Plan — engine-world-phase-1

> Branch: `feat/engine-world-phase-1` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-3` | Module: ai

**Spec:** [engine_world Phase 1 — write path + heartbeat publisher](../superpowers/specs/2026-05-06-engine-world-phase-1.md)

Council-approved (2026-05-06): system-steward + system-agent-coordinator + botsson-harness-builder. F1–F10 folded into spec. User directive: stage-engine integration core-level Phase 1.

## Journeys (the contract)

- [JOURNEY-engine-world-phase-1-agent-leser-status](../journeys/JOURNEY-engine-world-phase-1-agent-leser-status.md) — Botsson chat svarer "is CI green?" via injected `<world_state>` + `read_surface` tool
- [JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand](../journeys/JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand.md) — stage-engine + ci-conductor skriver tilbake via gated `report_observation` + platform-RPC
- [JOURNEY-engine-world-phase-1-heartbeat-publiserer-surfaces](../journeys/JOURNEY-engine-world-phase-1-heartbeat-publiserer-surfaces.md) — heartbeat job populerer engine_world hvert 5. min fra Vercel/GitHub/Supabase MCP

## Goal

Activate engine_world from read-only plumbing (Phase 0, PR #332) to a live shared world model. Phase 1 lights up write path, telemetry, first heartbeat publisher, and core-level stage-engine integration (reader injection + async writer).

## Tasks

### Phase A — Migration + types + ADR
- [ ] Apply Phase 0 migration `20260525000000_engine_world.sql` to local DB (`supabase db reset` or `migration up`)
- [ ] Regen `packages/supabase/src/database.types.ts` from local
- [ ] Verify `engine_world`, `engine_world_surface_type`, `engine_world_status` in regen diff
- [ ] Bump ADR-0281 frontmatter `status: proposed` → `accepted`
- [ ] Add carve-out clause to ADR-0281 § "Decision Outcome": platform writes via `engine_world_observe_platform` exempt from gate_action; user-facing `report_observation` stays gated

### Phase B — RPC + capability default registry upgrade (NEW migration)
- [ ] New migration `<NEXT_TS>_engine_world_phase_1.sql`:
  - `CREATE OR REPLACE FUNCTION engine_world_observe_platform(p_surface_id, p_surface_type, p_status, p_details, p_ttl_seconds, p_observed_by)` SECURITY DEFINER, returns void, UPSERT into engine_world
  - `UPDATE capability_default_registry SET level = 'confirm' WHERE capability = 'engine.world_observe'`
- [ ] Apply locally + regen types
- [ ] Verify RPC callable from service_role context

### Phase C — Capability + write tool
- [ ] `packages/ai/src/capabilities/engine-world/index.ts`: split `allowedChannels` per operation — reads `["chat","voice"]`, writes `["chat","system"]`. Mechanism per existing capability convention (separate `readAllowedChannels` / `writeAllowedChannels` fields, or per-tool override — inspect capability schema before choosing)
- [ ] `packages/ai/src/capabilities/engine-world/tools.ts`: add `report_observation` tool wrapping `gatedMutation` per ADR-0204 (memory/onboarding precedent). Capability slug `engine.world_observe`. Input schema: `surface_id`, `surface_type`, `status`, `details` (object), `ttl_seconds` (default 1800)
- [ ] Verify in `packages/ai/src/router/tool-selector.ts` that gate slug `engine.world_observe` is never union-typed lookup against `CapabilityName` (which has `engine_world` no dot). If lookup exists, refactor to string constant
- [ ] Telemetry: emit existing event `engine_world observation_written` from tool body. Do NOT register parallel `world.*` names. Cite `packages/telemetry/src/registry.ts:8175,8187`

### Phase D — Stage-engine integration (core-level)

**Reader (services/stage-engine/src/core/agent-router.ts L353-L356):**
- [ ] Inject `<world_state>` block alongside missionSummary/userContext/workspaceContext/routeContext (L367-L400)
- [ ] Fetch via supabaseAdmin: 50 most-recent non-stale rows, platform-level + workspace-scoped filter on agent's `workspace_id`
- [ ] Render compact whitelist only: `surface_id|surface_type|status|is_stale`. NO `details` JSONB (F6 prompt-injection mitigation)
- [ ] Channel-restrict: voice path doesn't exist via `/agent/chat` yet (LiveKit per ADR-0135 separate); document absence

**Writer (post-dispatch async, agent-router.ts):**
- [ ] After dispatch completes: `void supabaseAdmin.rpc('engine_world_observe_platform', {...}).then(null, recordError)`
- [ ] Surfaces written: `stage_engine.dispatch` (last result + p95 latency), `stage_engine.session.<workspace_id>` (active count + last transition), `capability.<name>` (last invocation status + 5min error rate)
- [ ] p95/error-rate aggregation via `setInterval` timer, NOT per-request
- [ ] Pattern matches existing recorder calls (agent-router.ts L191, L222, L329)
- [ ] `channel: "system"` passed explicitly

### Phase E — ADR-0282 (NEW) + heartbeat publisher
- [ ] Draft `docs/decisions/0282-engine-world-platform-rpc-bypass.md` (status: proposed acceptable for Phase 1 ship). Content: SECURITY DEFINER bypass justification, audit substitute (activity_trail entry with `actor_kind = 'platform'`, `denied_by_gate = NULL`), allowed callers (heartbeat, ci-conductor, stage-engine)
- [ ] Register ADR-0282 in `docs/decisions/0000-decision-log.md`
- [ ] Heartbeat job `engine-world-refresh` — script + HEARTBEAT.md entry. First publishers (cooldown 5m):
  - `vercel.web` — Vercel deployment status (production)
  - `supabase.prod` — migration tail vs schema_migrations
  - `pr.<id>` — open PR list per-PR row
  - `worktree.<name>` — `git worktree list` snapshot
- [ ] Heartbeat writes via `engine_world_observe_platform` RPC (service_role)

### Phase F — Doc + map
- [ ] Add L4 row to `docs/architecture/BOTSSON-SYSTEM-MAP.md` capability table: `engine_world` 🟢
- [ ] Add L5 row to BOTSSON-SYSTEM-MAP.md persistence table: `engine_world` table 🟢
- [ ] Update `docs/STATE-SUMMARY.md` if engine_world becomes a priority surface

### Phase G — Verification
- [ ] `pnpm --filter @smartout/ai typecheck` 0 errors
- [ ] `pnpm --filter @smartout/telemetry typecheck` 0 errors
- [ ] Stage-engine typecheck 0 errors (`cd services/stage-engine && npx tsc --noEmit`)
- [ ] `report_observation` round-trip: write succeeds with authorized profile, denies with unauthorized per ADR-0099
- [ ] Heartbeat run writes ≥1 surface row per category; observable via `select * from engine_world` + Botsson `read_surface_class`
- [ ] `<world_state>` injection visible in stage-engine debug log; whitelist enforced (no `details` leak)
- [ ] Cross-ref test: Phase 4 voice prompt (after Phase 4 merges) gains `<world_state>` injection without channel-guard work

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] ADR-0281 status `accepted` + carve-out clause added
- [ ] ADR-0282 drafted + registered in decision log
- [ ] BOTSSON-SYSTEM-MAP.md updated (L4 + L5)
- [ ] No parallel `world.*` event names in telemetry registry — only existing space-form
- [ ] All migrations applied clean on `supabase db reset`
- [ ] At least one E2E test exists per journey (recommended)

## Hard constraints

- NEVER deploy migration to prod manually — pipeline only (preview → main, CI applies)
- NEVER inject `details` JSONB into `<world_state>` prompt block — whitelist scalar fields only
- NEVER `await` engine_world async writes in stage-engine request path
- NEVER add parallel dot-form telemetry event names — registry already has space-form

## Linear

- (To be created) — Phase 1 implementation tracker
- (To be created) — ADR-0282 review

## Parallel sortie cross-ref

`feat/botsson-fase-4-proposal-pipeline` (wt-2) runs parallel. File-disjoint. After both merge: voice prompts gain `<world_state>` injection automatically through shared `/agent/chat` endpoint. Merge order free.
