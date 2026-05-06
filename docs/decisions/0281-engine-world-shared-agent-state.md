---
title: "engine_world — shared world model for agent fleet"
id: ADR_0281
status: accepted
layer: decision
created: 2026-05-05
updated: 2026-05-06
relates_to:
  - ADR_0099 # unified authority gate (writes via gate_action)
  - ADR_0151 # server-side workspace_id derivation
  - ADR_0078 # channel restriction (engine_world reads OK on chat+voice)
  - ADR_0173 # capability frozen-4 boundary
  - ADR_0186 # pg_notify-based event bus pattern (Phase 2 reference)
  - ADR_0204 # gatedMutation orchestrator (Phase 1 dependency)
  - L_0094  # phantom-emit prevention
  - L_0182  # phantom-emit in schema migration phases
---

# ADR-0281: engine_world — Shared World Model for Agent Fleet

## Context and Problem Statement

Smartout has multiple agent surfaces (Botsson, ci-incident-conductor,
deploy-conductor, harness-builder, protocol-writer) plus heartbeat jobs that
each observe parts of system state but never share what they know. When
Botsson is asked "is CI green?" he has no answer; ci-incident-conductor
diagnosing a failure does not know whether the failure is correlated with a
recent deploy; the deploy-conductor cannot see whether the persistent preview
branch is `MIGRATIONS_FAILED` without re-running its own diagnostics.

The result: each agent re-derives world-state from scratch on every action.
Knowledge does not accumulate. Counter-reports between agents are impossible
because there is no shared substrate to write into.

This ADR introduces `engine_world`: a single Postgres table where every
agent and heartbeat job writes observations of "surfaces" (services, PRs,
worktrees, migrations, costs, CI workflows, campaigns), and every agent
reads before acting.

## Decision Drivers

- **Counter-report loop** — agents that act (auto-fix CI, smoke prod, sync
  campaigns) need a place to record what they did so the next agent reads
  the new state, not the stale one.
- **Botsson dashboard role** — voice/chat answers about system state should
  hit one place, not 5 dashboards (Vercel, Supabase, GitHub, Linear,
  Tailscale).
- **Heartbeat job scaling** — heartbeat already ships `drift-check`,
  `worktree-audit`, `google-places-quota-check`. Each writes report files;
  none expose state to agents at runtime. engine_world lets the same jobs
  publish into a query surface.
- **Cutover decision-trace** — during prod cutover (2026-05-04) every agent
  re-derived migration tail, schema_migrations gap, smoke result, drift
  state independently. A shared world model would have collapsed those
  diagnoses into one read.

## Considered Options

### Option 1 — Per-agent in-memory state (rejected)

Each agent keeps its own world-model in `engine_memory`. Simple but
breaks counter-reports — agents cannot see each other's observations.
Equivalent to today's silo. Rejected.

### Option 2 — Postgres table, public read, gated write (chosen)

One table `public.engine_world`. RLS allows any authenticated session to
read workspace-scoped + platform-level rows. Writes go through a gated
capability `engine.world_observe` (per ADR-0099) for workspace-scoped
surfaces; platform-level writes (heartbeat, ci-incident-conductor) use
service_role via SECURITY DEFINER report function.

### Option 3 — Redis pub/sub + Postgres replay log (deferred)

Lower latency, higher complexity. ADR-0186 already proves pg_notify is
sufficient for our event-bus needs. Redis introduces an external
dependency without measurable runtime benefit at our scale (10s of
surfaces, 100s of writes/day). Reconsider if surface count grows past
1000 or if read-after-write latency becomes a bottleneck.

## Decision Outcome

**Chosen: Option 2.**

### Schema (Phase 0 — landed in this branch)

```sql
CREATE TABLE public.engine_world (
  surface_id              TEXT PRIMARY KEY,
  surface_type            engine_world_surface_type NOT NULL,
  status                  engine_world_status NOT NULL DEFAULT 'unknown',
  details                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  workspace_id            UUID REFERENCES public.workspace(workspace_id),
  observed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_by             TEXT NOT NULL,
  observed_by_profile_id  UUID REFERENCES public.profile(profile_id),
  ttl_seconds             INTEGER NOT NULL DEFAULT 1800,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`workspace_id IS NULL` = platform-level surface (CI, infra, prod-DB
observations). RLS exposes platform-level rows to all authenticated sessions
plus workspace-scoped rows to workspace members.

`surface_type` enum (initial): service, pr, worktree, migration, cost,
ci_workflow, campaign, custom. The `custom` value is an escape hatch — when
it appears in production data, that signals a candidate for promotion to a
first-class type in a follow-up migration.

`ttl_seconds` is the staleness gate. Readers compute
`now() > observed_at + ttl_seconds` and treat stale rows as `unknown`.

### Capability (Phase 0 — landed)

`engine_world` capability registered with two read tools:

- `read_surface(surface_id)` — single-surface lookup, returns
  `{ found: true, surface: SurfaceRecord }` or `{ found: false }`. Includes
  computed `is_stale`.
- `read_surface_class(surface_type, include_stale=false)` — list-by-type,
  capped at 200 most-recent rows. Default excludes stale rows.

Channel: chat + voice. Authority: `read_only` default.

### Phase 1 (next sortie)

- `report_observation` tool — gated mutation per ADR-0204 wrapping
  `gatedMutation` with capability `engine.world_observe`. Writes UPSERT.
- Heartbeat-side writer: a SECURITY DEFINER RPC
  `engine_world_observe_platform(surface_id, surface_type, status,
  details, ttl_seconds, observed_by)` for platform-level writes that
  bypass gate_action (heartbeat jobs, ci-incident-conductor — they run
  with service_role, not workspace JWT).
- Heartbeat job `engine-world-refresh` — per-surface population from real
  signals (Vercel API, GitHub PR list, git worktree list, supabase MCP).
- Telemetry events: `world.observed`, `world.transitioned_red`,
  `world.transitioned_green`. Producer = report_observation; consumers =
  ci-incident-conductor (red transition), Botsson voice (status queries).
  Per L-0182, emit() ships in same phase as both producer + consumer
  registry entries — no phantom emit.

### Authority gate carve-out (Phase 1, ADR-0290)

Platform-level writes via `engine_world_observe_platform` (SECURITY
DEFINER RPC) are exempt from gate_action. They are platform telemetry,
not capability invocations. Audit substitute: each platform write writes
an activity_trail entry with `actor_kind = 'platform'`, `actor_id = NULL`,
`denied_by_gate = NULL`. Allowed callers: heartbeat jobs,
ci-incident-conductor, stage-engine post-dispatch async writer.

The user-facing `report_observation` tool (Phase 1 capability addition)
remains under `engine.world_observe` capability gate — workspace-scoped
writes go through the standard ADR-0099 + ADR-0204 gated path.

### Phase 2 (follow-up)

Wire existing agents:

- ci-incident-conductor — reads engine_world before triage, writes
  `world.transitioned_red` when failure classified, writes `green` after
  auto-fix or manual resolution.
- deploy-conductor — reads engine_world for 6-gate decisions, writes deploy
  surface state at each phase.
- Botsson voice/chat — reads engine_world to answer "is X up?" / "kostnad i
  dag?" / "hvor er CI?".
- harness-builder — reads campaign + worktree surfaces before sub-sortie
  closure (per skill Phase 4 closure-ready logic).
- heartbeat (`drift-check`, `worktree-audit`, `google-places-quota-check`)
  — already write reports to files; same data writes to engine_world too.

## Rules & Consequences

- **Good:** counter-reports become trivial (write back after acting); agents
  read once, act with full context; Botsson dashboard role lands without
  bespoke per-tool wiring; heartbeat jobs gain a query surface beyond
  static report files.
- **Good:** no new external dependencies — Postgres table + capability,
  same pattern as engine_state, engine_memory, activity_trail.
- **Bad:** another table to maintain. Mitigation: TTL + staleness flag
  ensures stale rows degrade gracefully; rows are sparse (≪ 1000 surfaces
  realistically); index covers staleness expression for cheap pruning.
- **Bad:** Phase 1 mutation path adds a new authority key
  (`engine.world_observe`) — must seed via capability_default_registry to
  avoid CVE per L-0179. Already inserted in Phase 0 migration.
- **Agent Impact:** every new capability that observes runtime state should
  ask "does this belong in engine_world?" before inventing a per-capability
  state table.

## Open Questions

1. **Snapshot history vs latest-only.** Phase 0 keeps only the latest row
   per `surface_id` (PRIMARY KEY). Counter-report semantics may want a
   history (engine_world_history table appended on each upsert). Defer to
   Phase 1 — start latest-only, add history if a use case demands trace
   replay.
2. **Cross-workspace platform surfaces.** Some surfaces (CI workflows,
   prod-DB tail) are platform-level (`workspace_id IS NULL`). Others
   (workspace-specific Stripe customer status) are workspace-scoped. The
   `surface_id` namespace is currently global string convention; consider a
   compound key `(workspace_id, surface_id)` if cross-workspace name clashes
   appear.
3. **Cost surfaces vs billing tables.** Cost surfaces (`cost.openrouter.daily`)
   overlap conceptually with `subscription_invoice_line` and Stripe data.
   engine_world stores point-in-time observations + spend deltas; billing
   tables stay the system of record. Document the distinction in Phase 1.

## References

- Phase 0 migration: `supabase/migrations/20260525000000_engine_world.sql`
- Capability: `packages/ai/src/capabilities/engine-world/`
- Plan: (to be authored alongside Phase 1 sortie)
- Sibling tables: `engine_state`, `engine_memory`, `engine_event`,
  `activity_trail` — all part of the engine-* family per CLAUDE.md
  data-model section.
