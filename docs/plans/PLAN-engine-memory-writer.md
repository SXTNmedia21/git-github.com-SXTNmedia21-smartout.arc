---
title: "Plan — Engine Memory Writer (Phase A3)"
status: ready
updated: 2026-04-22
created: 2026-04-22
module: ai-agent
tags: [plan, engine-memory, botsson, learning, campaign-a3]
---

# Plan — Engine Memory Writer

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase A, item A3

## Goal

Koble produsent-siden på den eksisterende `engine_memory`-tabellen. Reader finnes allerede (`context/collector.ts:73-76`). Writer mangler. Dette er en pure "koble det som allerede er bygget" — ingen ny tabell, ingen ny capability struktur. `memory`-intenten eksisterer allerede i `intentSchema` som stub; vi materialiserer stubben mot eksisterende schema.

## Context

`engine_memory` table (migration `20260302000000`, extended `20260307000000` with agent profile fields):
- Columns: `profile_id`, `workspace_id`, `memory_type` (preference/fact/summary), `content`, `embedding vector(1536)`, `importance [0,1]`, `scope` (personal/team/workspace), `expires_at`.
- Reader: loads top 10 by importance, scope-filtered, non-expired, into prompt as `## Minner` block.
- Writer: **none in app code.**

Without a writer, every conversation starts cold (sessions aside). Users repeat preferences, the agent re-discovers facts, relationships don't score up.

## Scope

**In:**
1. New helper in `packages/ai/src/context/memory-writer.ts`: `saveMemory({ profileId, workspaceId, content, memoryType, scope, importance, expiresAt? })`.
   - Computes embedding via OpenRouter embeddings API (or local model — decide during impl).
   - Inserts via service-role supabase client (RLS permits).
   - Idempotency: hash of (profile_id, content) in a nullable `idempotency_key` column — skip insert if duplicate within 24h window.
2. New tool `save_memory` in agent tool set — available only when agent resolves a clear preference/fact:
   - Scope defaults to `personal` (profile-scoped) unless prompt indicates team/workspace relevance.
   - Importance derived from a small LLM call or fixed per `memory_type` initially.
   - Gated by `gate_action(capability='memory', action_type='save')` — default-allow per ADR-0099.
3. Auto-write trigger at session end: `buildSessionSummary()` (new) called by session-manager expiry loop, writes a `memory_type='summary'` row scoped `personal`, `importance=0.6`, `expires_at=now()+90 days`.
4. TTL enforcement: schedule `cleanExpiredMemories()` via pg_cron (every 6h). Currently defined but not scheduled.
5. Unit + integration tests.

**Out:**
- Turn N-5 summarizer (P1 per observability plan).
- Cross-workspace memory sharing.
- Embedding quality tuning (stick with OpenRouter default; revisit only if retrieval ranking looks bad).

## Tasks

- [ ] Decide embedding source — OpenRouter vs local. Default: OpenRouter if latency <200ms, else fall back to pgvector's built-in alternatives. Spike in test before committing.
- [ ] Add `idempotency_key` column to `engine_memory` if not present (migration).
- [ ] Write `saveMemory()` helper + embedding call.
- [ ] Register `save_memory` tool in a new or existing capability — propose: new `memory` capability (currently a stub intent). This materializes the stub into a real capability, wired into registry + router.
- [ ] Wire session-end summary writer in `services/stage-engine/src/core/session-manager.ts`.
- [ ] Schedule `cleanExpiredMemories()` via `pg_cron` — new migration.
- [ ] Tests: save, retrieve-after-save, idempotency (duplicate content within 24h skipped), expiry.
- [ ] Typecheck + preview smoke.

## Acceptance Criteria

- [ ] `save_memory` tool callable from Botsson agent mode
- [ ] New row in `engine_memory` after save, with non-null `embedding`, correct `profile_id` + `workspace_id` + `scope`
- [ ] Retrieval in next session surfaces saved memory in `## Minner` prompt section (top 10 by importance)
- [ ] Duplicate save within 24h returns existing row id, no new insert
- [ ] Expired memories (`expires_at < now()`) purged by cron
- [ ] Telemetry: `memory saved`, `memory retrieved`, `memory expired` events emit → activity_trail + PostHog (ADR-0116 pattern)
- [ ] HANDOFF written

## Risks

1. **Embedding cost** — OpenRouter charges per token. Default policy: only embed when saving, not when retrieving (already embedded at save time). Budget monitored via telemetry.
2. **PII in memory content** — users may ask agent to remember sensitive facts. Gate: refuse memory write on tool-level if content matches PII heuristics (personnummer, bank number, addresses). Use existing PII filter from onboarding intake.
3. **Incorrect scope assignment** — `workspace` scope leaks personal memories across users. Default to `personal` unless agent explicitly states otherwise in the tool call args. Server re-validates scope against caller's role.
4. **Retrieval ranking drift** — 10 memories may not be the right number. Make it a per-workspace config, default 10.

## Dependencies

- Phase A2 (profile_id derivation) recommended — ensures memory is written under correct actor.
- Embedding model choice: independent, decide during impl.

## Post-Implementation

- [ ] `memory` capability registered in `packages/ai/src/capabilities/registry.ts`
- [ ] ADR if new architectural pattern emerges (e.g., "embeddings via OpenRouter as platform default")
- [ ] CAMPAIGN A3 → complete
- [ ] Move to `docs/plans/completed/`
