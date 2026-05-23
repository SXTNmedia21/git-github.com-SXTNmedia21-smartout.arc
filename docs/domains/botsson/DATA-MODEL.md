---
title: "Botsson — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, data-model, database, tables, telemetry]
---

# Botsson — Data Model

> Tables, FKs, enums, RLS, and telemetry the persona surface owns or primarily reads. **Code wins.** All table existence verified vs `supabase/migrations/` 2026-05-23.
>
> Most session/engine tables are **harness-owned** (`engine_sessions`, `engine_state`, `engine_event`, etc.). This file documents what botsson-domain actually owns vs reads.

## Ownership matrix

| Table | Schema | Domain relation | Migration anchor |
|---|---|---|---|
| `agent_session_recording` | `public` | **Owns** (persona observability) | `20260515120100_agent_session_recording.sql` |
| `agent_session_envelope` | `public` | **Owns** (PII encrypt/break-glass) | `20260515120200_agent_session_envelope.sql` |
| `agent_session_whisper` | `public` | **Owns** (admin intervention) | `20260515120300_agent_session_whisper.sql` |
| `engine_memory` | `public` | **Reads + Writes** (long-term memory) | `20260302000000_engine_memory.sql` |
| `agent_profile` | `public` | **Reads** (per-workspace persona config) | `20260307000000_agent_profile_system.sql` |
| `agent_relationship` | `public` | **Reads** (per-profile relationship scores) | `20260307000000_agent_profile_system.sql` |
| `engine_authority_config` | `public` | **Reads** (C4 — what tools are authorized) | harness-owned |
| `engine_sessions` | `public` | **Reads** (session history, conversation replay) | harness-owned |
| `engine_stages` | `public` | **Reads** (stage chain for sequential missions) | harness-owned |

---

## Owned tables (detail)

### `agent_session_recording`

Per-turn recording. Fire-and-forget ring buffer in `session-recorder.ts`. Recorder never blocks Emma (ADR-0184 Q8b).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | TEXT | Ties to engine_sessions |
| `workspace_id` | UUID | RLS |
| `profile_id` | UUID | The employee whose turn this is |
| `turn_index` | INT | Ordering within session |
| `turn_kind` | enum | 8 values: `prompt_built`, `classifier_io`, `llm_request`, `llm_response`, `authority_load`, `guardian_eval`, `memory_read`, `memory_write` |
| `phase` | enum | 10 values per phase of processing |
| `content_redacted` | JSONB | PII-redacted turn content |
| `meta` | JSONB | Classifier I/O, tool calls, latency |
| `attention_score` | NUMERIC(3,2) | 0–1, guardian-evaluated severity |
| `is_flagged` | BOOLEAN | Admin or user flag |
| `created_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | Retention: 90d redacted / 365d flagged / metadata permanent |

**RLS:** JWT admin-scope + godmode for platform-admin cross-workspace read.

### `agent_session_envelope`

pgcrypto-encrypted raw turn content for break-glass PII reveal.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `recording_id` | UUID FK → `agent_session_recording` | |
| `encrypted_content` | BYTEA | pgcrypto-encrypted |
| `pii_class` | TEXT | Classification of PII type |
| `redact_after` | TIMESTAMPTZ | TTL 30d via pg_cron |
| `decrypted_at` | TIMESTAMPTZ | Audit timestamp on break-glass |

**Break-glass:** `decrypt_envelope(envelope_id)` RPC (godmode-only). Requires `is_godmode` + `recorder.pii_reveal='confirm'` authority. 5s UI window + audit in `activity_trail`.

### `agent_session_whisper`

Platform-admin injections to next turn. NEVER user-facing (ADR-0185 Trust Gate).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | TEXT | |
| `workspace_id` | UUID | |
| `admin_profile_id` | UUID | The admin who injected |
| `content` | TEXT | Whisper content (wrapped in `<admin_note>` tag by prompt-builder) |
| `is_consumed` | BOOLEAN | Flipped when prompt-builder reads it |
| `created_at` | TIMESTAMPTZ | |

**Consumption:** `services/stage-engine/src/core/prompt-builder.ts` reads unconsumed whispers per session and wraps in `<admin_note>` tag.

---

## Read tables (detail)

### `engine_memory`

Long-term per-workspace / per-profile memories. Read + write via `memory` capability + `memory-writer.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID | RLS |
| `profile_id` | UUID | nullable = workspace-wide |
| `content` | TEXT | Memory content |
| `memory_type` | TEXT | `constant` (permanent) or `temporal` (expires) |
| `scope` | TEXT | `personal`, `workspace`, `team` |
| `importance` | NUMERIC | 0–1 |
| `expires_at` | TIMESTAMPTZ | null = permanent |
| `embedding` | VECTOR | pgvector; currently NULL (retrieval by importance, not similarity) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Loading query** (from `context/collector.ts`): top 10 by `importance DESC, created_at DESC`, excludes personal memories from other profiles, excludes expired.

**Auto-summary:** on session close, `session-manager.ts:writeSessionSummary` writes summary to `engine_memory`.

**Authority guard:** `save_memory` tool hidden unless `engine_authority_config` has entry for workspace. Dev workspaces seeded via `20260528000000_seed_memory_authority_dev_workspaces.sql`.

### `agent_profile`

Per-workspace Botsson configuration. Falls back to defaults when row missing.

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | UUID PK | |
| `display_name` | TEXT | "Mr. Botsson" default |
| `greeting` | TEXT | Default greeting |
| `language` | TEXT | "no" default |
| `default_voice` | TEXT | "mark" default |
| `voice_speed`, `voice_temperature`, `voice_stability` | NUMERIC | Voice tuning |
| `formality`, `assertiveness`, `warmth`, `humor`, `verbosity` | NUMERIC | 5D personality base (0.0–1.0) |
| `adapt_to_role`, `adapt_to_situation`, `adapt_to_authority` | BOOLEAN | Adaptation flags |

### `agent_relationship`

Per-profile relationship scores; drives posture adaptation.

| Column | Type | Notes |
|---|---|---|
| `profile_id` | UUID | |
| `workspace_id` | UUID | |
| `familiarity_score` | NUMERIC | 0–1 |
| `trust_score` | NUMERIC | 0–1 |
| `sentiment_score` | NUMERIC | 0–1 |
| `relationship_score` | NUMERIC | Composite; posture adjusts at >0.6 and <0.2 |
| `total_conversations` | INT | First-time detection |
| `last_interaction` | TIMESTAMPTZ | |

---

## Key FKs and relations

```
engine_sessions (harness-owned)
  └─ agent_session_recording.session_id (TEXT, not FK)
       └─ agent_session_envelope.recording_id (UUID FK)

profile (core-structure-owned)
  └─ agent_relationship.profile_id
  └─ agent_session_recording.profile_id
  └─ engine_memory.profile_id (nullable)

workspace (core-structure-owned)
  └─ agent_profile.workspace_id (1:1)
  └─ agent_session_recording.workspace_id
  └─ engine_memory.workspace_id
  └─ agent_relationship.workspace_id
```

---

## Enums

| Name | Values | Notes |
|---|---|---|
| `turn_kind` | `prompt_built`, `classifier_io`, `llm_request`, `llm_response`, `authority_load`, `guardian_eval`, `memory_read`, `memory_write` | `agent_session_recording.turn_kind` |
| `memory_type` | `constant`, `temporal` | `engine_memory.memory_type` |
| `scope` | `personal`, `workspace`, `team` | `engine_memory.scope` |
| `authority_level` | `autonomous`, `confirm`, `suggest`, `read_only`, `disabled` | `engine_authority_config` (harness-owned) |

---

## Telemetry events (`botsson.*` family)

Registered in `packages/telemetry/src/registry.ts`. Verified 2026-05-23 by grep (`botsson\.` in registry.ts):

| Event | Line ±hint | Emitter |
|---|---|---|
| `botsson.turn_started` | `registry.ts:4798` | stage-engine turn handler |
| `botsson.turn_completed` | `registry.ts:4810` | stage-engine turn handler |
| `botsson.intent_classified` | `registry.ts:4823` | agent-router |
| `botsson.tool_invoked` | `registry.ts:4836` | tool adapter (ADR-0116 auto-emit) |
| `botsson.tool_failed` | `registry.ts:4850` | tool adapter |
| `botsson.step_cap_hit` | `registry.ts:4864` | session-manager |
| `botsson.session.created` | `registry.ts:4882` | session-manager |
| `botsson.session.archived` | `registry.ts:4894` | BFF DELETE `/api/botsson/sessions/[id]` |
| `botsson.authority_filtered` | `registry.ts:4912` | tool-selector (ADR-0116) |

Additional telemetry consumed by botsson surface:

| Event | Source domain | Notes |
|---|---|---|
| `voice.first_speech_ts_ms` | voice-agent | `services/voice-agent/src/agent.ts:138` |
| `voice.turn_end_ts_ms` | voice-agent | `services/voice-agent/src/agent.ts` |
| `voice.user_recut` | voice-agent | VAD recut detection |
| `voice.session_abandonment` | voice-agent | Inactivity timeout |
| `recorder.turn_flagged` | session recorder | Per-turn admin flag |
| `recorder.session_flagged` | session recorder | Fan-out flag |
| `recorder.user_flag_submitted` | session recorder | Arena LogView user escalation |

---

## RLS summary

| Table | Policy |
|---|---|
| `agent_session_recording` | JWT admin-scope (workspace-scoped read/write) + godmode for platform-admin cross-workspace |
| `agent_session_envelope` | Godmode only for decrypt; admin for metadata |
| `agent_session_whisper` | Admin + platform-admin write; no user read |
| `engine_memory` | JWT workspace-scoped; admin write; employee read own + workspace-scope |
| `agent_profile` | Workspace-scoped; admin write |
| `agent_relationship` | Workspace-scoped; harness write via service-role |
