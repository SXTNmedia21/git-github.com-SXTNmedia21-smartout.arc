---
title: HANDOFF — engine_world Phase 0 (read-only world-model surface)
status: ready
created: 2026-05-05
updated: 2026-05-05
module: ai
tags: [handoff, engine-world, agent-coordination, capability, adr-0281]
---

# HANDOFF — engine_world Phase 0

## What shipped

| Path | Purpose |
|---|---|
| `supabase/migrations/20260525000000_engine_world.sql` | Table + 2 enums + RLS (JWT + API key) + 5 indexes + updated_at trigger + capability_default_registry seed for `engine.world_observe` |
| `packages/ai/src/capabilities/engine-world/types.ts` | Zod schemas + TypeScript types (SurfaceType, SurfaceStatus, SurfaceRecord, ReadSurfaceOutput, ReadSurfaceClassOutput) |
| `packages/ai/src/capabilities/engine-world/tools.ts` | `read_surface` + `read_surface_class` tools |
| `packages/ai/src/capabilities/engine-world/index.ts` | Capability definition (chat+voice, read_only default) |
| `packages/ai/src/capabilities/types.ts` | `engine_world` added to `CapabilityName` union |
| `packages/ai/src/capabilities/registry.ts` | engineWorldCapability registered |
| `packages/ai/src/router/intent-classifier.ts` | `engine_world` added to enum + system prompt |
| `docs/decisions/0281-engine-world-shared-agent-state.md` | ADR (proposed) |

Branch: `feat/engine-world` @ `5a05cf280` (post-amend SHA).
PR open URL: https://github.com/SXTNmedia21/smartout.ai/pull/new/feat/engine-world

## Verification

- ✅ `pnpm --filter @smartout/ai typecheck` — 0 errors
- ✅ `pnpm --filter @smartout/ai lint` — 0 errors (62 pre-existing warnings)
- ✅ Capability registry inclusion check (ADR-0112) passes
- ✅ Migration L-0042 timestamp ordering verified (tip 20260524000000 → new 20260525000000)
- ⚠️  Supabase migration NOT yet applied to local or prod — run `supabase db push --linked` after PR merge

## Botsson access

Read tools are exposed via `tool-selector.ts` automatically:

- Path 1: high-confidence intent classification → `intent.capability='engine_world'` → `selectToolsForCapability` returns readOnlyTools
- Path 2: low-confidence fallback → loops all capabilities → engine_world tools included
- Channel guard passes for both `chat` and `voice` (allowedChannels in capability definition)
- defaultAuthority='read_only' + readOnlyTools array means tools are accessible without engine_authority_config row

User can ask "is CI green?" / "hvor er status på preview?" / "kostnad i dag?" — Botsson classifies as `engine_world` and exposes read tools.

## What's NOT in Phase 0

- ❌ `report_observation` write tool — Phase 1 sortie
- ❌ Heartbeat-side writer (RPC for service_role bypass) — Phase 1 sortie
- ❌ Heartbeat job populating real surfaces — Phase 1 sortie
- ❌ Telemetry events (`world.observed`, `world.transitioned_*`) — Phase 1 (per L-0182 phantom-emit prevention)
- ❌ Wired consumers (ci-incident-conductor, deploy-conductor counter-reports) — Phase 2 sortie
- ❌ Botsson system-prompt instructions for stack-status queries — Phase 2 sortie

## Phase 1 entry criteria

Before opening Phase 1 sortie:

1. ✅ This PR merged to development
2. Migration applied to dev DB (`supabase db push --linked`)
3. Supabase types regenerated (`npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`)
4. ADR-0281 status promoted from `proposed` → `accepted`

## Phase 1 sortie scope

| Item | Effort |
|---|---|
| `report_observation` tool — UPSERT engine_world via gatedMutation per ADR-0204 | 1 file (~150 lines) |
| `engine_world_observe_platform` SECURITY DEFINER RPC for service_role writes | 1 migration |
| Telemetry events `world.observed`, `world.transitioned_red`, `world.transitioned_green` registered in `packages/telemetry/src/registry.ts` | ~30 lines |
| Heartbeat job `engine-world-refresh` — first writers (vercel.web, supabase.prod, pr.<active>, worktree.<active>) | 1 script + HEARTBEAT.md entry |
| Update ADR-0281 status to `accepted` | 1 line |

## Phase 2 sortie scope

| Agent | Wiring |
|---|---|
| ci-incident-conductor | Read before triage; emit `world.transitioned_red` on classify; emit `green` on auto-fix |
| deploy-conductor | Read for 6-gate decisions; emit surface state per phase |
| Botsson | System-prompt instruction "before answering 'is X up?', call read_surface(X)"; emit on user-prompted refresh |
| harness-builder | Read campaign + worktree surfaces in closure-ready logic |

## Rollback path

engine_world table has no FK from other tables (intentional). If Phase 0 needs revert:

```sql
DROP TABLE IF EXISTS public.engine_world CASCADE;
DROP TYPE IF EXISTS public.engine_world_surface_type;
DROP TYPE IF EXISTS public.engine_world_status;
DELETE FROM public.capability_default_registry WHERE capability = 'engine.world_observe';
```

Code-side rollback: revert the 7 file commit on feat/engine-world branch. Capability deregisters automatically on registry rebuild.

## Mantra

**Read before acting. Counter-report after acting. Truth lives in the table, not in agent memory.**
