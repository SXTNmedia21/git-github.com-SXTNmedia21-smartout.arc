---
title: "HANDOFF — engine_world Phase 1 + Phase 2"
status: ready
created: 2026-05-06
updated: 2026-05-06
module: ai
tags: [handoff, engine-world, agent-coordination, capability, stage-engine, adr-0281, adr-0290]
---

# HANDOFF — engine_world Phase 1 + Phase 2

## Summary

engine_world shipped from Phase 0 read-only plumbing to a fully wired
shared agent state surface. Phase 1 lit up writes (gated user tool +
SECURITY DEFINER platform RPC), telemetry, heartbeat publisher, and
core-level stage-engine integration. Phase 2 closed the audit gap,
wired ci-conductor + deploy-conductor + per-workspace session writer,
and prepared journeys + E2E specs.

Phase 2E committed at `6d8fa66e4` (2026-05-06 15:00). E2E specs exist and are
committed. Journey statuses remain `draft` — specs are written but require a
live test run to flip to `verified` (Phase 3 gate).

## Decisions

| ADR | Status | What |
|-----|--------|------|
| ADR-0281 | accepted (2026-05-06) | engine_world shared agent state — table, RPC, capability, stage-engine reader/writer |
| ADR-0290 | accepted (2026-05-06) | Platform-level writes via SECURITY DEFINER RPC bypass gate_action; activity_trail audit-substitute with actor_kind discriminator |

## Decisions made during this sortie (registered in 0000-decision-log.md)

- **Channel-split mechanism (Phase 1C):** Layer 3 per-tool `allowedChannels` guard following ADR-0275 onboarding pattern, NOT capability-level read/write split fields. `read_world_state` allows `["chat","voice"]`; `report_observation` allows `["chat","system"]`.
- **Session-event bus architecture (Phase 2B):** Option A — new lightweight `session-event-bus.ts`, NOT extension of guardian-bus. Guardian bus carries verdicts; session bus carries workspace-scoped session lifecycle events.
- **Audit substitute for platform writes (Phase 2A):** `activity_trail` schema migration adds `actor_kind TEXT NOT NULL DEFAULT 'user'` + CHECK constraint preserving user-actor invariant while permitting platform NULLs. Closes ADR-0290 Phase 2 commitment.
- **Helper script ownership (Phase 2C/2D):** `infra/scripts/engine-world-write.sh` as shared helper — both ci-conductor and deploy-conductor source it. Single update point for RPC call pattern.

## Phase ledger

| Phase | Commit SHA | What |
|-------|-----------|------|
| 1A | 95844d5cf | Migration applied + types regenerated + ADR-0281 accepted |
| 1B | 43f192001 | RPC `engine_world_observe_platform` + capability level upgrade (read_only → confirm) |
| 1C | 09aa36937 | `report_observation` tool + channel split per ADR-0275 pattern |
| 1D | a6c7cfade | Stage-engine reader (`engine-world-reader.ts`) + async writer + setInterval timer |
| 1E | 601e42aef | ADR-0290 (renumbered from 0282) + heartbeat publisher (12 surfaces) |
| 1F | 36500fa8c | BOTSSON-SYSTEM-MAP updated + verification + branch pushed |
| 2A | 0a0e014fe | `activity_trail` platform-actor schema migration (closes ADR-0290 Phase 2 commitment) |
| 2B | 11c8d2d96 | `session-event-bus.ts` + per-workspace session writer |
| 2D | e39c57cb2 | deploy-conductor wire-up (promote-preview/drift-check/smoke-probe) |
| 2C | f4555d9d0 | ci-incident-conductor wire-up (log.sh + apply-fix.sh + ci-agent.yml) |
| 2E | 6d8fa66e4 | E2E specs committed (3 journeys × unit-style tests, no running server required) |
| 2F | (this commit) | HANDOFF + decision-log ADR-0281 registration + typecheck fix |

Note: Phase 2C commit (f4555d9d0) landed after Phase 2D (e39c57cb2) in git history due to parallel sub-agent execution order. Both are on branch HEAD and fully correct.

## Learnings (worth promoting to memory)

1. **ADR-ID squatting** — Always grep `docs/decisions/<NNNN>-*` before claiming next slot. ADR-0282 was already taken by voice-plane-consolidation; we escalated to 0290 mid-Phase 1E with sed-replace cleanup across 12 references.

2. **`activity_trail` platform-actor gap** — Original schema had NOT NULL on `workspace_id` + `actor_id` + `entity_id` with no `actor_kind` discriminator. Phase B SQL migration wrapped audit INSERT in EXCEPTION block (silently no-op'd platform writes). Phase 2A schema migration adds `actor_kind TEXT DEFAULT 'user'` + CHECK constraint preserving user-actor invariant while permitting platform NULLs. Side effect: `row.actor_id` in Supabase-generated types becomes `string | null` — any hook that assigns it to `string` field without null coalesce will fail typecheck (caught in Phase 2F, fixed in `use-activity-feed.ts:79`).

3. **Stage-engine subpath imports** — `services/stage-engine` consumes `@smartout/ai/router/*`, `/capabilities/types`, `/lib/*`, `/prompts/*`. Fresh worktrees need `pnpm --filter @smartout/ai build` BEFORE `tsc --noEmit` resolves. Subpath exports declared in package.json but require dist/ to exist.

4. **ai SDK ToolSet type variance** — `generateText({ tools: vercelTools })` returns generic `GenerateTextResult<ToolSet, ...>` but assignment to inferred narrower type fails covariant check. Fix: `tools: vercelTools as ToolSet` cast at the generateText call site, NOT on the result variable.

5. **`op run --env-file=.env.template -- npx supabase gen types` corrupts output** — 1Password substitutes `admin` substring (in `admin_profile_id`) with `<concealed by 1Password>`. Run gen types WITHOUT `op run` wrap; only local DB on port 54321 needed.

6. **`engine-world-write.sh` collector pattern** — REST API to `/rest/v1/rpc/engine_world_observe_platform` with service_role JWT, fire-and-forget `|| true`. Both ci-conductor + deploy-conductor source `infra/scripts/engine-world-write.sh` for this pattern. Single maintenance point.

## Known issues / debt

- **Journey verification pending run** — E2E specs committed (Phase 2E, `6d8fa66e4`). Specs are unit-style (inline logic, no browser/server). Journey statuses remain `draft` until a passing CI run flips them to `verified`. Phase 3 gate.
- **`stage_engine.session.<ws>` smoke test deferred** — Phase 2B writer compiles + wires session-event-bus correctly but smoke test deferred to Phase 2E E2E suite (no live session infra in worktree).
- **`deploy.preview.gate.<name>` per-gate granularity** — Phase 2D shipped 3 deploy.* surfaces; per-gate writes (6 per HOP A run) deferred as V1+ optimization.
- **ci-conductor read-before-triage protocol documented but not exercised** — Agent definition includes the read-flow but actual recurrence-detection logic (5th occurrence threshold per L-0202) needs Phase 3 wire-up.
- **Path A negative test + Path B latency assertion** — Left as `test.skip()` in Phase 2E specs for V0; Phase 3 wires gate-deny path + adds load harness.

## Journey status

| Journey | Status | E2E spec written | Note |
|---------|--------|-----------------|------|
| agent-leser-status | draft | Committed (6d8fa66e4) | `apps/e2e/engine-world/agent-leser-status.spec.ts` — 6 tests incl. F6 whitelist, empty/null sentinels |
| agent-rapporterer-tilstand | draft | Committed (6d8fa66e4) | `apps/e2e/engine-world/agent-rapporterer-tilstand.spec.ts` — gatedMutation + channel guard + emit verification |
| heartbeat-publiserer-surfaces | draft | Committed (6d8fa66e4) | `apps/e2e/engine-world/heartbeat-publiserer-surfaces.spec.ts` — heartbeat publisher coverage |

All 3 journeys at `status: draft` — specs are committed but require a passing CI run to flip to `verified`. Phase 3 gate.

## Next steps (Phase 3)

1. **Run E2E specs + flip journey statuses** — Run `apps/e2e/engine-world/*.spec.ts` (unit-style, no server needed). On green, flip 3 journey `status: draft` → `status: verified`.
2. **Phase 2E V0-skipped tests** — gate-deny round-trip for Path A (report_observation rejected by channel guard on voice); load harness for Path B latency assertion
3. **`deploy.preview.gate.<name>` per-gate writes** in promote-preview.sh (6 gates per HOP A run)
4. **ci-conductor recurrence detection** — wire 5th-occurrence (L-0202) using read-before-triage via `read_surface("ci.incident.recent")`
5. **Botsson system-prompt instructions** — add explicit "before answering 'is X up?', call read_surface(X)" instruction to mr-botsson prompt builder
6. **engine_world_history append-only mirror** — defer until counter-report use case demands trace replay (ADR-0281 Open Questions)

## Files added/modified (top-level summary)

### Migrations
- `supabase/migrations/20260526000000_engine_world_phase_1.sql` (Phase 1B — RPC + table constraints)
- `supabase/migrations/20260527000000_activity_trail_platform_actor.sql` (Phase 2A — actor_kind + nullable platform path)

### Capability
- `packages/ai/src/capabilities/engine-world/index.ts` (Phase 0 + Phase 1B level upgrade)
- `packages/ai/src/capabilities/engine-world/tools.ts` (Phase 1C — report_observation + channel split)
- `packages/ai/src/capabilities/engine-world/types.ts` (shared surface types)

### Stage Engine
- `services/stage-engine/src/core/engine-world-reader.ts` (Phase 1D — new file)
- `services/stage-engine/src/core/engine-world-writer.ts` (Phase 1D — new file)
- `services/stage-engine/src/core/session-event-bus.ts` (Phase 2B — new file)
- `services/stage-engine/src/core/agent-router.ts` (Phase 1D — reader hook integration)
- `services/stage-engine/src/core/session-manager.ts` (Phase 2B — emitSessionEvent calls)
- `services/stage-engine/src/core/stage-manager.ts` (Phase 2B — emitSessionEvent calls)

### Infra scripts
- `infra/scripts/engine-world-write.sh` (Phase 2D shared helper, adopted by Phase 2C)
- `infra/scripts/engine-world-refresh.sh` (Phase 1E heartbeat publisher)
- `infra/scripts/promote-preview.sh` (Phase 2D — engine-world write hooks)
- `infra/scripts/drift-check.sh` (Phase 2D — engine-world write hooks)
- `infra/scripts/smoke-probe.sh` (Phase 2D — engine-world write hooks)

### CI / Agent definitions
- `.github/workflows/ci-agent.yml` (Phase 2C)
- `.github/scripts/ci-agent/log.sh` (Phase 2C)
- `.github/scripts/ci-agent/apply-fix.sh` (Phase 2C)
- `.claude/agents/ci-incident-conductor.md` (Phase 2C)
- `.claude/agents/deploy-conductor.md` (Phase 2D)

### Docs
- `docs/decisions/0281-engine-world-shared-agent-state.md` (Phase 1A)
- `docs/decisions/0290-engine-world-platform-rpc-bypass.md` (Phase 1E)
- `docs/decisions/0000-decision-log.md` (ADR-0281 added, ADR-0290 status corrected — Phase 2F)
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` (Phase 1F — L4 engine_world row + L5 engine_world row)
- `docs/journeys/JOURNEY-engine-world-phase-1-agent-leser-status.md` (declared)
- `docs/journeys/JOURNEY-engine-world-phase-1-agent-rapporterer-tilstand.md` (declared)
- `docs/journeys/JOURNEY-engine-world-phase-1-heartbeat-publiserer-surfaces.md` (declared)
- `docs/plans/PLAN-engine-world-phase-1.md`
- `docs/superpowers/specs/2026-05-06-engine-world-phase-1.md`

### E2E tests (Phase 2E — committed 6d8fa66e4)
- `apps/e2e/engine-world/agent-leser-status.spec.ts`
- `apps/e2e/engine-world/agent-rapporterer-tilstand.spec.ts`
- `apps/e2e/engine-world/heartbeat-publiserer-surfaces.spec.ts`
- `apps/e2e/engine-world/_helpers.ts`
- `apps/e2e/tests/engine-world/` (3 additional spec files)

### Typecheck fix (Phase 2F)
- `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts` — null coalesce on `actor_id ?? "platform"` (Phase 2A schema change made `actor_id` nullable in generated types)

## Mantra

**Read before acting. Counter-report after acting. Truth lives in the table, not in agent memory.**
