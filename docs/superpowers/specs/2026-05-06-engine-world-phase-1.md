---
title: "engine_world Phase 1 — write path + heartbeat publisher"
status: draft
created: 2026-05-06
updated: 2026-05-06
module: ai
tags: [spec, engine-world, agent-coordination, heartbeat, telemetry]
relates_to:
  - ADR_0281
  - ADR_0099
  - ADR_0186
  - ADR_0204
  - L_0182
---

# engine_world Phase 1 — write path + heartbeat publisher

## Goal

Activate `engine_world` from read-only plumbing (Phase 0, shipped in PR #332)
to a live shared world model. Phase 1 lights up the write path, telemetry,
and the first heartbeat-driven publisher so agents can begin counter-reporting.

## Parallel sortie cross-reference

Phase 4 proposal-pipeline (`feat/botsson-fase-4-proposal-pipeline`, wt-2,
commits `dba647f27` + `b7ddbc5e7`) runs in parallel. Wirer voice →
stage-engine auth + ghost-card pipeline. File-disjoint with this sortie:
Phase 4 touches `services/voice-agent/`, `BotssonOrbVoiceMount.tsx`,
`BotssonShell.tsx`, `dashboard/schedule/_components/*`. This sortie touches
`services/stage-engine/src/core/agent-router.ts`,
`packages/ai/src/capabilities/engine-world/*`, new RPC migration. After
both merge, Phase 4 voice-prompts gain `<world_state>` injection
automatically through shared `/agent/chat` endpoint. No channel-guard work
needed — Phase 4's structural-isolation pattern (proposal-only, no domain
write) is orthogonal to engine_world's gated reads/writes. Merge order
free; parallel-safe.

## Council verdict (pre-build, 2026-05-06)

3-agent council (system-steward + system-agent-coordinator + botsson-harness-builder)
returned **APPROVE WITH CHANGES** unanimously. User directive: stage-engine
integration is **mandatory in Phase 1, core-level** — overrides council
recommendation to defer to Phase 2. All other findings (F1–F10) folded into
this spec.

## In scope

### Migration + types
- Apply Phase 0 migration `20260525000000_engine_world.sql` to local DB
- Regenerate `packages/supabase/src/database.types.ts`
- Promote ADR-0281 status: `proposed` → `accepted`

### Capability + write path
- New tool `report_observation` — UPSERT via `gatedMutation` per ADR-0204,
  capability slug `engine.world_observe`
- **F2 fix:** new follow-up migration upgrades `engine.world_observe` default
  registry level from `read_only` → `confirm` (workspace policy can override).
  Without this, every gated write deny-loops.
- **F3 fix:** capability declaration splits read/write channel allowlist —
  reads `["chat", "voice"]`, writes `["chat", "system"]`. Voice never writes.

### SECURITY DEFINER RPC (NEW migration in Phase 1)
- **F4 fix:** ship `CREATE FUNCTION engine_world_observe_platform(...)` DDL
  in Phase 1 migration before any caller wires up. Phase 0 only had a comment
  placeholder — runtime would throw without this.
- Caller surface: heartbeat jobs, ci-incident-conductor, stage-engine
  (service_role context).

### Telemetry — adopt EXISTING registry names
- **F1 fix:** registry already declares the events (commit `c67bd7d47`,
  `packages/telemetry/src/registry.ts:8175,8187,11038,11042`). Use those
  names, do NOT add parallel dot-form set:
  - `"engine_world observation_written"` (was: `world.observed`)
  - `"engine_world status_changed"` (was: `world.transitioned_red`/`_green` —
    collapses into one event with `to_status` field)
- L-0182 compliance: producers + consumers ship in same phase. Phase 1
  producer = `report_observation` + stage-engine writer. Phase 1 consumer =
  capability-level audit + Botsson voice/chat reader.

### Heartbeat publisher
- Job `engine-world-refresh` — first publishers via
  `engine_world_observe_platform` RPC:
  - `vercel.web` — Vercel deployment status (production)
  - `supabase.prod` — migration tail vs schema_migrations
  - `pr.<id>` — open PR list (per-PR row)
  - `worktree.<name>` — `git worktree list` snapshot

### Stage-engine integration (mandatory in Phase 1, core-level)

`services/stage-engine` is both reader and writer of engine_world. Per user
directive 2026-05-06, this lands in Phase 1 (not deferred to Phase 2).
Council mitigations F5–F8 are mandatory.

**Reader side — exact hook point (F5):**
File: `services/stage-engine/src/core/agent-router.ts`.
Inject between L353 (`fetchActiveStateSummary`) and L356 (`selectTools`),
alongside the existing missionSummary/userContext/workspaceContext/routeContext
injection block (L367–L400). NOT in `collector.ts` or `prompt-builder.ts` —
those cross ADR-0173 frozen-4 boundary or are mission-mode only.

Behavior:
- Fetch recent platform-level surfaces (CI, deploy, prod-DB) +
  workspace-scoped surfaces filtered by agent's `workspace_id`.
- Cap at 50 most-recent non-stale rows.
- Inject into prompt as compact `<world_state>` block.

**Prompt-injection mitigation (F6):**
The `engine_world.details` JSONB column accepts attacker-controlled content
(PR titles, branch names, free-text observations from any service). Inject
ONLY whitelisted scalar fields:
```
<world_state>
  surface_id|surface_type|status|is_stale
  vercel.web|service|green|false
  ci.workflow.test|ci_workflow|red|false
  ...
</world_state>
```
DO NOT include `details` JSONB in the prompt. Surface IDs + status answer
"is CI green?" without leaking free text. If `details` becomes necessary
later, ADR-0283 must precede with redaction + length-cap test.

**Writer side — pattern (F7):**
After dispatch completes, stage-engine writes own surfaces via
`engine_world_observe_platform` RPC (service_role):
- `stage_engine.dispatch` — last dispatch result + p95 latency
- `stage_engine.session.<workspace_id>` — active session count + last
  transition
- `capability.<name>` — last invocation status + error rate (5-min window)

Pattern (matches existing recorder calls in `agent-router.ts` L191, L222, L329):
```ts
void supabaseAdmin
  .rpc('engine_world_observe_platform', { ... })
  .then(null, (err) => recordError('engine_world_write_failed', err));
```
- No `await` in request path.
- p95 / error-rate aggregation via `setInterval` timer (5-min window),
  NOT per-request rollup (otherwise every request does aggregation).

**Channel guard (F3 + clarified):**
- Reads: capability `allowedChannels: ["chat", "voice"]` — current (Phase 0).
- Writes: capability `allowedChannels: ["chat", "system"]` — Phase 1 split.
  Voice path through `/agent/chat` does not exist yet; LiveKit per ADR-0135
  routes separately. BFF (`/api/emma/chat:235`) hardcodes `channel: "chat"`,
  so voice surface restriction is enforced by absence — document this.
- Stage-engine async writer passes `channel: "system"` explicitly.

**Authority gate carve-out (F8):**
ADR-0281 §"Phase 1" gets new clause: "engine_world platform writes via
`engine_world_observe_platform` are exempt from gate_action — they are
platform telemetry, not capability invocations. The user-facing
`report_observation` tool remains under `engine.world_observe` capability
gate." Audit substitute: each platform write logs to `activity_trail` with
`actor_kind = 'platform'` and `denied_by_gate = NULL`.

### New ADRs spawned by this spec
- **ADR-0282** — Platform-level engine_world writes via SECURITY DEFINER RPC
  (bypass of gate_action with audit substitute). Required by F9.
- **ADR-0283** — `<world_state>` prompt-substrate pattern (deferred until
  `details` JSONB enters the prompt block; not blocking Phase 1 since F6
  mitigation drops `details`). Recorded as future-work in ADR-0281 Open Questions.

### Capability slug audit (F-recommended)
Verify in `packages/ai/src/capabilities/tool-selector.ts` that the gate
slug `"engine.world_observe"` is never looked up against `CapabilityName`
union (which has `"engine_world"`, no dot). If a runtime lookup exists, add
the slug to the union or refactor to string constant. Inspect before build.

### BOTSSON-SYSTEM-MAP.md updates (Phase 1 ship requirement)
L4 capability table — add row:
```
| engine_world | `engine-world/` | 🟢 | Phase 0 read tools (PR #332). Phase 1 adds report_observation (gatedMutation, ADR-0204) + SECURITY DEFINER RPC + heartbeat publisher + stage-engine read/write integration. |
```
L5 persistence table — add row:
```
| `engine_world` | 🟢 | Migration 20260525000000. UPSERT via engine_world_observe_platform (SECURITY DEFINER). TTL-based staleness. workspace_id nullable for platform-level surfaces. |
```

## Out of scope (Phase 2)

- Wiring ci-incident-conductor / deploy-conductor / harness-builder agents
  to read+write engine_world (stage-engine itself wires in Phase 1 per user
  directive)
- Botsson system-prompt instructions for stack-status queries beyond the
  injected `<world_state>` block
- Cross-workspace surface dedup
- engine_world_history append-only mirror
- ADR-0283 (prompt-substrate pattern) — only needed if `details` JSONB
  enters the prompt block

## Acceptance criteria

- Migration applies clean on fresh local DB (`supabase db reset`)
- Types regen leaves diff in `packages/supabase/src/database.types.ts` only
- `engine.world_observe` registry level upgraded from `read_only` → `confirm`
- `engine_world_observe_platform` RPC exists and accepts service_role calls
- `report_observation` round-trip via gated capability — write succeeds with
  authorized profile, blocks with unauthorized profile per ADR-0099
- Stage-engine `agent-router.ts` injects `<world_state>` block between L353
  and L356; whitelist enforced (no `details` JSONB)
- Stage-engine async writer fires `void rpc().then(null, recordError)` after
  dispatch; no per-request aggregation
- Heartbeat job `engine-world-refresh` writes ≥1 surface row per category on
  first run; observable via `select * from engine_world` and via
  Botsson `read_surface_class` tool
- Telemetry registry uses EXISTING space-form names
  (`engine_world observation_written`, `engine_world status_changed`); no
  parallel dot-form set
- ADR-0281 frontmatter `status: accepted` + carve-out clause for platform
  RPC bypass added
- ADR-0282 drafted (proposed status acceptable for Phase 1 ship)
- BOTSSON-SYSTEM-MAP.md L4 + L5 rows added in same commit
- `pnpm --filter @smartout/ai typecheck` green
- `pnpm --filter @smartout/telemetry typecheck` green
- `pnpm --filter stage-engine typecheck` green (or whichever filter applies)

## References

- ADR-0281: docs/decisions/0281-engine-world-shared-agent-state.md
- HANDOFF Phase 0: docs/handoffs/HANDOFF-engine-world-phase-0.md
- Capability folder: packages/ai/src/capabilities/engine-world/
- Phase 0 migration: supabase/migrations/20260525000000_engine_world.sql
