---
title: "AI Runtime Runbook"
id: AI_RUNTIME_RUNBOOK
version: "2.0"
status: canonical
layer: architecture
created: 2026-03-06
updated: 2026-05-04
author: platform
depends_on:
  - AI_RUNTIME_SYSTEM_DEFINITION_V1
  - ARCH_STAGE_ENGINE
tags:
  - ai
  - runtime
  - operations
  - guardian
  - stage-engine
---

# AI Runtime Runbook

Operational procedures for keeping the AI runtime healthy. Verified against `development @ 3f6e657f` (2026-05-04). Replaces v1.0 — drops envelope/preflight jargon, adds concrete commands + thresholds.

## 1. Scope

| Component | Path | Port |
|---|---|---|
| Stage Engine | `services/stage-engine` | 5010 |
| Voice Agent | `services/voice-agent` | LiveKit worker (no inbound port) |
| Capability layer | `packages/ai/src/capabilities/` | n/a — invoked from stage-engine |
| Guardian event bus | `core/guardian-bus.ts` + `core/pg-notify-bus.ts` | WS via stage-engine `/guardian` |
| Recorder | `core/session-recorder.ts` | flushes to `agent_session_recording` |
| Authority gate | `engine_authority_config` + `gatedMutation` (ADR-0204) | n/a — per-tool |

Out of scope: web BFF (`/api/emma/chat`), mobile client, Edge Functions.

## 2. Core Health Checks

Run in order. Any FAIL → jump to matching §.

### 2.1 Stage Engine alive

```bash
curl -fsS https://api.smartout.ai/health
# expect: {"status":"ok","service":"stage-engine","version":"X.Y.Z","timestamp":"..."}
```

Local: `curl http://localhost:5010/health`.

FAIL → §3.

### 2.2 Recorder fire-and-forget invariant

```bash
curl -fsS https://api.smartout.ai/recorder/metrics
# expect:
# {
#   "buffer_size": <int>,        # rows queued, normal 0–50
#   "drop_count": <int>,         # buffer overflow drops, baseline 0
#   "error_count": <int>,        # failed Supabase INSERTs, baseline 0
#   "recorder_blocking_emma": false   # MUST be false (ADR-0184 Q8b)
# }
```

Thresholds:

| Metric | Green | Yellow | Red |
|---|---|---|---|
| `buffer_size` | <50 | 50–500 | >500 (back-pressure) |
| `drop_count` per hour | 0 | 1–10 | >10 |
| `error_count` per hour | 0 | 1–5 | >5 |
| `recorder_blocking_emma` | `false` | `false` | `true` (ADR-0184 violated → §3) |

### 2.3 Session creation succeeds

Creates a probe session against the dev workspace (NEVER against prod-data workspace):

```bash
curl -fsS -X POST https://api.smartout.ai/sessions \
  -H "x-api-key: $STAGE_ENGINE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "agent",
    "workspace_id": "<dev-workspace-uuid>",
    "channel": "chat",
    "context": { "probe": true }
  }'
# expect: 201 + {"session_id": "...", "status": "active"}
```

Then verify the row landed:

```sql
SELECT id, mode, status, channel, created_at
  FROM engine_sessions
 WHERE context->>'probe' = 'true'
 ORDER BY created_at DESC LIMIT 1;
```

### 2.4 Guardian event flow

After creating the probe session, the stream should have at minimum a `session.created` event. Query within last 5 min:

```sql
SELECT event_type, actor, summary, created_at
  FROM guardian_log
 WHERE session_id = '<probe-session-id>'
 ORDER BY created_at;
-- expect at least: session.created
```

If `guardian_log` row exists but no WS-broadcast was seen → §4 (broadcast lag, not write lag).

### 2.5 Telemetry emit reaches engine_event

Every Botsson tool-call should append to `engine_event` (workflow brain) AND `activity_trail` (audit brain). Quick reconciliation over last hour:

```sql
SELECT
  date_trunc('minute', created_at) AS minute,
  COUNT(*) AS count
FROM engine_event
WHERE created_at > now() - interval '1 hour'
GROUP BY 1 ORDER BY 1 DESC LIMIT 60;
```

Baseline: at least 1 row per active session per minute during business hours. Zero rows for 10+ minutes during active workspace = §7.

### 2.6 Authority gate has fallback rows

Verify no capability is missing its default row:

```sql
SELECT capability_id, COUNT(DISTINCT workspace_id) AS workspaces_with_row
  FROM engine_authority_config
 GROUP BY capability_id
 ORDER BY workspaces_with_row;
-- ALL active capabilities must appear; missing rows = silent default-allow risk (§5)
```

Cross-reference against the active capability registry: `grep -c "^export const" packages/ai/src/capabilities/registry.ts` (currently 25).

## 3. Incident: Stage Engine Unhealthy

Symptoms: `/health` returns non-200, request timeouts, agent-router errors in logs.

### Triage

```bash
# Container running?
docker ps --filter "name=stage-engine" --format "{{.Status}}"

# Recent logs (droplet)
docker logs --tail 200 stage-engine 2>&1 | grep -E "ERROR|FATAL|panic|listen.*EADDR"

# Sentry (last 1 hour)
# Open Sentry web UI → project: stage-engine → time: 1h → severity: error+
```

### Common causes + fixes

| Symptom in logs | Cause | Action |
|---|---|---|
| `Error: connect ECONNREFUSED ...:5432` | Postgres unreachable | Verify Supabase reachable; check `DATABASE_URL`; restart `stage-engine` |
| `EADDRINUSE: address already in use :::5010` | Stale process | `docker compose restart stage-engine` |
| `[secrets] Failed to load` | 1Password vault unreachable | Check `op` health; verify `OP_SERVICE_ACCOUNT_TOKEN` |
| `[pg-notify-bus] Connection terminated` (repeatedly) | LISTEN connection dropping | Restart container; if persistent → check Postgres `wal_level` + connection limits |
| `[recorder] Buffer at capacity` | Recorder back-pressure | §2.2 — likely Supabase write contention |

### Last resort

Restart pod, force pg-notify-bus reconnect:

```bash
docker compose restart stage-engine
sleep 5
curl -fsS https://api.smartout.ai/health && curl -fsS https://api.smartout.ai/recorder/metrics
```

If still red after restart + 60s settle → escalate `medium`.

## 4. Incident: Guardian Event Stream Anomaly

### 4a. Storm (too many events)

Symptoms: WS clients on platform-admin/guardian see >10 events/sec for one session, browser falls behind.

```sql
-- Top sessions by event count last 5 min
SELECT session_id, COUNT(*) AS events, MAX(created_at) AS latest
  FROM guardian_log
 WHERE created_at > now() - interval '5 minutes'
 GROUP BY session_id
 ORDER BY events DESC LIMIT 10;
```

Threshold: >100 events from one session in 5 min = anomaly. Common causes:

- Guardian-evaluator looping on the same session (current_stage_id never advances despite `auto_advance` firing) — inspect `engine_sessions.current_stage_id` over time.
- An agent-mode session with broken whisper-consume (`is_consumed=false` row keeps re-injecting) — check `agent_session_whisper` for unconsumed rows older than 1 hour.

Mitigation: temporarily set `engine_sessions.status='abandoned'` for the offending session; investigate offline.

### 4b. Silence (no events flowing)

Symptoms: platform-admin /guardian-feed shows nothing despite active sessions in `engine_sessions`.

```bash
# Verify pg-notify trigger fires
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres <<'SQL'
LISTEN guardian_events;
-- in another tab, INSERT a probe row into guardian_log; if nothing arrives → trigger broken
SQL
```

```sql
-- Trigger exists?
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.guardian_log'::regclass;
-- expect: guardian_log_notify | O (enabled)
```

If trigger missing/disabled → re-apply `supabase/migrations/20260422120001_guardian_log_pg_notify.sql`.

If trigger fires but stage-engine doesn't broadcast → restart stage-engine to force LISTEN-reconnect. Check log line `[pg-notify-bus] LISTEN guardian_events` appears at boot.

## 5. Incident: Authority Misconfiguration / Default-Allow Drift

Symptoms: capability tool executes without `gate_action` row, or blocks for users who should pass.

### 5.1 Find tools that ran without authority record

```sql
-- Mutation events from last 24h that have NO matching gate_action
SELECT
  e.event_name,
  e.workspace_id,
  e.id AS event_id,
  e.created_at
FROM engine_event e
LEFT JOIN gate_action g
  ON g.workspace_id = e.workspace_id
 AND g.created_at BETWEEN e.created_at - interval '5 seconds' AND e.created_at + interval '5 seconds'
 AND (g.payload->>'event_id')::uuid = e.id
WHERE e.event_name LIKE '%.created'
   OR e.event_name LIKE '%.updated'
   OR e.event_name LIKE '%.published'
   AND e.created_at > now() - interval '24 hours'
  AND g.id IS NULL
ORDER BY e.created_at DESC;
```

Each row = a mutation that bypassed authority gate. Map back to capability via tool name in `event_name`.

### 5.2 Find capabilities missing authority defaults

See §2.6 query. Any `capability_id` not appearing → registry capability without DB-side authority. Insert default `proposed`-mode row (NEVER `auto`):

```sql
INSERT INTO engine_authority_config (workspace_id, capability_id, mode)
SELECT w.workspace_id, '<capability-id>', 'proposed'
  FROM workspace w
  WHERE NOT EXISTS (
    SELECT 1 FROM engine_authority_config
     WHERE capability_id = '<capability-id>'
       AND workspace_id = w.workspace_id
  );
```

### 5.3 Restore last-known-good

If a misconfig migration is in flight and authority went bad globally:

```bash
# Find latest authority-related migration
ls -lt supabase/migrations/*authority*.sql | head -3

# Inspect its content — if rollback needed, write a forward-only revert migration
# NEVER run "supabase db reset" against prod (ADR-0270 + cloud-cuts-section)
```

## 6. Incident: Prompt Build Failures

Symptoms: agent-mode chat returns vague replies, mission-mode stages skip required fields, log shows `[prompt-builder]` errors.

### 6.1 Whisper injection failures

```sql
-- Whispers stuck unconsumed >1h (prompt-builder couldn't read or mark)
SELECT session_id, COUNT(*) AS stuck_whispers, MIN(created_at) AS oldest
  FROM agent_session_whisper
 WHERE is_consumed = false
   AND created_at < now() - interval '1 hour'
 GROUP BY session_id;
```

Per session: if stuck count grows monotonically and corresponding session is `status='active'` → prompt-builder DB-read failing silently. Check stage-engine logs for `[prompt-builder]` warnings and Supabase RLS denials on `agent_session_whisper`.

### 6.2 Memory-context overflow

Recorder `error_count` rising with `[recorder] insert failed: row too large` in logs → memory-manager packing too much context into a single recording. Mitigation:

```sql
-- Inspect oversized recordings
SELECT id, session_id, length(content::text) AS bytes, created_at
  FROM agent_session_recording
 ORDER BY length(content::text) DESC
 LIMIT 20;
```

If single rows >100KB → memory-manager TTL purge not running. Check `cleanExpiredMemories` log line `[cleanup] Cleaned expired memory(ies)` (interval = `CLEANUP_INTERVAL_MINUTES`, default 30 min).

### 6.3 Stage-prompt missing inputs

Symptom: agent doesn't ask for fields it should. Cause: `engine_stages.instructions` empty or `journey_step.data_writes` mismatch.

```sql
-- Stages with empty instructions (mission-mode hazard)
SELECT m.id AS mission_id, s.stage_id, s.stage_order
  FROM engine_stages s
  JOIN engine_missions m ON m.id = s.mission_id
 WHERE coalesce(s.instructions, '') = ''
    OR coalesce(s.success_criteria, '') = '';
```

## 7. Incident: Telemetry / Emit Drift

Symptoms: dashboards undercount, audit log rows missing, downstream automations don't fire.

### 7.1 Quick reconciliation — audit vs workflow brain

```sql
-- Last 1 hour: events in engine_event but NOT in activity_trail (or vice versa)
WITH window_events AS (
  SELECT id, event_type FROM engine_event
   WHERE created_at > now() - interval '1 hour'
), window_audit AS (
  SELECT id, event_name FROM activity_trail
   WHERE created_at > now() - interval '1 hour'
)
SELECT
  (SELECT COUNT(*) FROM window_events) AS engine_events,
  (SELECT COUNT(*) FROM window_audit)  AS audit_rows,
  (SELECT COUNT(*) FROM window_events) - (SELECT COUNT(*) FROM window_audit) AS divergence;
```

Baseline: divergence within ±5% expected (one is workflow-trigger, other is audit, slightly different schemas). >10% sustained = drift.

### 7.2 Find missing required fields

```sql
-- Events without required envelope fields
SELECT id, event_type, created_at
  FROM engine_event
 WHERE created_at > now() - interval '1 hour'
   AND (
     workspace_id IS NULL
     OR payload->>'actor_id' IS NULL
     OR payload->>'actor_id' = ''
   );
```

L-0177 trap: empty-string `actor_id` corrupts routing. Any row here = a tool emitting without resolving identity → §5.

### 7.3 Replay

`engine_event` is append-only — there is no "patch and re-emit" today. To force trigger-replay:

```sql
-- Inspect inactive triggers for affected event_type
SELECT * FROM engine_trigger WHERE event_type = '<dropped-event>' AND is_active = false;
-- If trigger was disabled: re-enable + INSERT a synthetic event with the same payload
```

Mark replays in `payload->'meta'->'replay_of'` so downstream consumers can dedupe via idempotency-key (per ADR-0270 sketch).

## 8. Mandatory Recovery Gate

Before closing any incident, verify ALL of:

1. **Mission-mode probe completes** — create probe session with mode='mission' against a fixture mission_id, walk it to status='complete'. Verify `engine_sessions.completed_at` populated.
2. **Mutation-tool gate fires** — invoke a side-effecting capability tool; confirm a `gate_action` row was written with `status='allowed'` (or `'proposed'` then `'accepted'`) BEFORE the domain mutation.
3. **Guardian event reaches platform-admin WS** — connect to `wss://api.smartout.ai/guardian` with godmode JWT; observe at least one `session.created` event from the probe in §1 within 2 seconds.
4. **Audit field completeness** — `activity_trail` row for the probe mutation has non-null `workspace_id`, non-empty `actor_id`, non-null `created_at`, and `event_name` matches the registry entry.

(Old §8.2 — "agent-mode turn completes with stage_id = agent.default" — removed. `agent.default` was never a real stage; agent-mode sessions have `mission_id IS NULL` AND `current_stage_id IS NULL`. The invariant for agent-mode is `engine_sessions.mode='agent' AND mission_id IS NULL`, asserted by DB check `chk_mission_mode_requires_mission`.)

## 9. Escalation Matrix

| Severity | Who | When |
|---|---|---|
| **low** | on-call engineer | single-session anomaly, no compliance signal, recoverable by restart |
| **medium** | on-call + AI runtime owner | multi-session impact, persists >15 min after restart, OR §5 default-allow detected for any capability |
| **high** | on-call + AI runtime owner + security/compliance owner | authority bypass executed (§5.1 returns rows), audit fields missing for executed mutations (§7.2 returns rows), guardian event stream lost >30 min |

High severity also triggers automatic Linear ticket via `drift-check` heartbeat (ADR-0265).

## 10. Baseline Thresholds (steady-state, business hours)

| Surface | Metric | Baseline | Yellow | Red |
|---|---|---|---|---|
| Stage Engine | `/health` 5xx rate | 0% | <0.5% | ≥0.5% |
| Recorder | `buffer_size` | <50 | 50–500 | >500 |
| Recorder | `error_count` per hour | 0 | 1–5 | >5 |
| Recorder | `recorder_blocking_emma` | `false` | `false` | `true` |
| Guardian | events per active session per minute | 0.2–5 | 5–20 | >20 |
| Guardian | `guardian_log` write latency p95 | <100 ms | 100–500 ms | >500 ms |
| Auth gate | `gate_action` rows per mutation | 1:1 | — | <1:1 (§5.1) |
| Telemetry | engine_event vs activity_trail divergence | ±5% | 5–10% | >10% |
| Sessions | abandoned/expired ratio per day | <5% | 5–15% | >15% |
| Memory | `engine_memory` row count growth | bounded by TTL | growing | unbounded (§6.2) |

Loop intervals (current defaults — verify via `/health` boot logs):

| Loop | Env var | Default |
|---|---|---|
| Guardian eval | `GUARDIAN_INTERVAL_MS` | 120 000 ms (2 min) |
| Calendar guardian | `CALENDAR_INTERVAL_MS` | 300 000 ms (5 min) |
| Cleanup (session expiry + memory TTL) | `CLEANUP_INTERVAL_MINUTES` | 30 min |
| Session expiry threshold | `SESSION_EXPIRY_HOURS` | 24 h |
| Recorder flush | hardcoded | 500 ms |

If a doc says "30 s guardian loop" — the doc is stale; trust this table or `/health` boot logs.

## 11. Linked from

- [`docs/architecture/STAGE-ENGINE.md`](./STAGE-ENGINE.md) — system map for all tables/loops referenced here
- [`docs/architecture/HARNESS-ARCHITECTURE.md`](./HARNESS-ARCHITECTURE.md) — full pipe + roadmap
- [`docs/protocols/DEPLOYMENT.md`](../protocols/DEPLOYMENT.md) — deploy gates that interact with this runbook
- ADR-0184 (recorder), ADR-0185 (whisper), ADR-0186 (guardian-bus), ADR-0204 (gatedMutation), ADR-0265 (deploy pipeline)
