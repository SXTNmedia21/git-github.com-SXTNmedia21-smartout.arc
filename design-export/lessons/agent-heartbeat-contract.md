---
topic: agent-heartbeat-contract
status: active
updated: 2026-06-01T02:00:00Z
created: 2026-05-31T21:15:00Z
supersedes:
---

# Decision lesson — agent-heartbeat-contract

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Active-agent tracking for the SmartOut Control Center uses a **telemetry-heartbeat** contract over
the existing `activity_trail` spine — no new table. Canonical shape (one row per heartbeat):

- `event` = **`agent.heartbeat`** (lifecycle transitions may also use `agent.started` / `agent.completed` / `agent.failed` / `agent.retried`)
- `source` = the **agent identity** (e.g. `Mr-Botsson`, `sxtn-orchestrator`, `stage-engine`)
- `action_verb` = the **status**: `working | idle | completed | failed | started | retried`
- `category` = `agent` · `entity_type` = `agent` · `entity_label` = current task · `actor_kind` = `platform`
- `data` jsonb = free-form payload; common keys `model, tokens, latency_ms, error_count, success_rate, workload` (any may be absent — consumers render only present keys, never a fake 0)

**State machine** (computed by the feeder from the newest heartbeat per source, NOT stored):
`active` if `now - last_seen < 30s`; `idle` if `< 120s`; else `stale`; a last status of
`failed`/`error` overrides to `failed`. TTL is published in `cc-data.json.agents_ttl`
(`active_sec:30, idle_sec:120`).

Emit with `dashboards/agent-ping.sh <agent> <status> [task] [json-extra]` or directly
`emit_telemetry('info','agent','agent.heartbeat','<agent>','{...}'::jsonb)`. The dashboard shows an
**honest empty state** until a real agent pings — never synthetic agent cards ([[no-ghost-data]]).
Counts/last_seen come from live `count(*)`/`max()` reads ([[live-db-connection-before-db-claims]]).

**CONDUCTOR DUTY (load-bearing).** A subagent dispatched via the `Agent` tool CANNOT emit its own
heartbeat — it has no access to the parent's sinks. So the **orchestrator emits on the child's
behalf**: append a feed event at dispatch (`logon`/`working`) and on return (`delivered`/`logoff`),
and keep the pulse (`heartbeat.sh`) running. Dev sink = `.sxtn-staging/telemetry-map/activity/feed.jsonl`
(`{ts,channel:"telemetry",agent,domain,event,detail,artifact,gate}`); prod = `emit_telemetry(... 'agent.heartbeat' ...)`.
**An un-logged dispatched agent is a "dark agent" — work the operator cannot see. Coordination
without observability is flying blind: a conductor that does not log every agent it spawns is not
actually conducting.** (Caught 2026-06-01: ran a 7-agent fleet invisibly until Pontus pointed here.)

## Why

SmartOut's `agent_*` tables (agent_profile, agent_session_envelope, …) exist but are empty/unused,
and `agent_session_envelope` is an encrypted PII envelope, not a status board — so there was no
queryable "is this agent active" signal. A heartbeat over the telemetry spine reuses the pipeline +
the control center's existing event taxonomy, needs no migration/RLS, and makes "active" a simple
TTL on the newest heartbeat. Keeping state DERIVED (not stored) means an agent that stops pinging
drifts active→idle→stale automatically — proven live (4 demo agents went active→stale when pings
stopped, then were cleaned to honest-empty). Any agent — capability, stage-engine, or a Claude Code
subagent — appears the moment it adds one heartbeat call, and never before.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T21:15:00Z — initial: agent-tracking = telemetry-heartbeat over activity*trail (event `agent.heartbeat`, source=agent, action_verb=status, data payload), TTL state active<30s/idle<120s/stale/failed-override computed by feeder, emit via agent-ping.sh; honest-empty until real ping. SmartOut agent*\* tables were empty + session_envelope is encrypted, so the spine was the right home.
- 2026-06-01T01:55:00Z — added CONDUCTOR DUTY: the orchestrator must emit feed/heartbeat events ON BEHALF OF every subagent it dispatches (children can't reach the parent's sinks). Triggered by running a 7-agent telemetry-recon/build fleet entirely dark — invisible to the Control Center — until Pontus pointed at this lesson. Coordination without observability = flying blind.
- 2026-06-01T02:00:00Z — RECURRED: dispatched sxtn-ui-builder on the oversikt port with NO feed logon/delivered event — ran dark again, Pontus re-pointed at this lesson. Remediated by retroactively appending logon+delivered to feed.jsonl. Hardening rule: emit the `logon` feed event in the SAME turn as the `Agent` dispatch (before/with the tool call), and `delivered` the moment the subagent returns — never as an afterthought. A dispatch without a paired feed write is an incomplete dispatch.
