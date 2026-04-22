---
title: "Plan — Botsson Observability Foundation (Phase A6)"
status: ready
updated: 2026-04-22
created: 2026-04-16
module: ai-agent
tags: [plan, botsson, stage-engine, telemetry, observability, logging, pg-notify, campaign-a6]
---

# Plan — Botsson Observability Foundation

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase A, item A6
> **Implementation spec:** `docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md` (detailed task-by-task)
> **Source council:** `docs/council/COUNCIL-LOG.md` 2026-04-16 review

## Goal

Gjør Botsson-runtime observerbar. Ingen nye systemer — vi erstatter eksisterende `console.*` med `pino`, aktiverer eksisterende men ubrukte `@smartout/telemetry` i stage-engine, speiler eksisterende pg_notify-mønster (fra Telegram-bro) over til guardian-bus, og fjerner eksisterende double-decision i authority-kall. Seks P0-items lander sammen som observability-gulvet capabilities allerede sitter på — vi bare slår på lyset.

## Why now

Phase A cannot verify its other fixes (contract-intake gate wrap, profile_id derivation, memory writer) without structured logs + Sentry + auto-emit telemetry. The observability floor is a prerequisite for the rest of Phase A, not a parallel track.

## Scope

**In:**
1. Structured logger (`pino`) with `requestId`-bound children — replaces `console.*` in stage-engine.
2. Sentry init + `captureWithContext()` — tagged with `requestId`, `session_id`, `workspace_id`.
3. Request ID middleware — UUID per request, in Hono context + `x-request-id` response header.
4. Auto-emit telemetry from `toVercelTools` adapter — every capability tool call emits `botsson.tool_invoked` / `botsson.tool_failed` without per-tool wiring.
5. Guardian bus pg_notify migration — replaces in-process `Set` with Postgres `LISTEN/NOTIFY` on `activity_trail` (pattern already in `stage-engine/src/index.ts:91-138` for Telegram).
6. Health ribbon endpoint — `GET /metrics/health` returning up/down + dep latency.
7. Authority double-decision cleanup — drop `applyMinRoleDowngrade`, use `gate.downgrade_to` for matched capability only.

**Out:**
- Haiku classifier swap (P1, needs eval baseline).
- `loadRecentMemories()` router wiring (P1).
- Turn N-5 summarizer (P1).
- `engine_session_event` projection (P2).
- Ultravox voice → activity_trail parity (P2).
- Diagnostic Drawer UI (P2).

## Tasks

Follow the detailed task list in `docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md`. High-level:

- [ ] **Phase 1 — Substrate:** pino logger + typed errors (`StageEngineError` base + 5 subclasses) + Sentry init.
- [ ] **Phase 2 — Request ID:** middleware + response header + logger child binding.
- [ ] **Phase 3 — Auto-emit adapter:** wrap `toVercelTools` `execute` with latency measurement + `emit()`. Register `botsson.tool_invoked` + `botsson.tool_failed` + 4 `agent.*` events in `packages/telemetry/src/registry.ts`.
- [ ] **Phase 4 — Health ribbon:** `GET /metrics/health` route returning stage-engine + pg + OpenRouter + Ultravox status.
- [ ] **Phase 5 — pg_notify bus:** new migration `20260416120000_activity_trail_pg_notify.sql` (AFTER INSERT trigger). Replace `guardian-bus.ts` with `pg-notify-bus.ts`. Feature-flag cutover with 1-week dual-write window.
- [ ] **Phase 6 — Authority cleanup:** drop `applyMinRoleDowngrade` in `agent-router.ts`; rely on `gate.downgrade_to` from `gate_action` RPC response for matched capability only.
- [ ] **Phase 7 — ADRs:** write + accept ADR-0084 (guardian-bus pg_notify), ADR-0087 (runtime telemetry standard).

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] `GET /metrics/health` returns 200 with dep statuses
- [ ] Integration test: tool call produces activity_trail row with `requestId`, `capability`, `tool_name`, `latency_ms`
- [ ] `x-request-id` header present on every response
- [ ] `console.log` count in `services/stage-engine/src/` reaches 0
- [ ] Sentry receives tagged errors in staging
- [ ] Guardian bus cutover: 1 week of dual-write, zero divergence observed, old bus removed
- [ ] ADR-0084 + ADR-0087 accepted and registered in decision log
- [ ] Decision log updated
- [ ] Journey doc written (if user-visible behavior changed)

## Risks

1. **activity_trail write volume 4–5× increase** — verify partitioning + retention before Phase 3 lands. Mitigation: check with db-guide skill, run load test on preview branch.
2. **Guardian-bus cutover** — in-process Set → pg_notify. Mitigation: feature flag + dual-write + 1 week soak. Do NOT drop `guardian_log` writes; backwards compat until P2 audit↔replay split.
3. **Sentry DSN leak** — DSN is not a secret per Sentry docs, but route via `NEXT_PUBLIC_*` only if client-exposed. Stage-engine is server-only → use server env var `SENTRY_DSN` from 1Password.

## Dependencies

- Requires `@smartout/telemetry` (already installed, currently unused by stage-engine).
- Requires `pino` + `@sentry/node` (new deps).
- Assumes Postgres 17 `pg_notify` + `LISTEN` support (stage-engine already uses this for Telegram bridge).

## Post-Implementation

- [ ] Update `docs/INDEX.md` with new ADRs
- [ ] Move this plan to `docs/plans/completed/` when Phase 6 cutover lands
- [ ] HANDOFF written at `docs/handoffs/HANDOFF-botsson-observability-foundation.md`
- [ ] Campaign A6 marked complete in `CAMPAIGN-botsson-arena.md`
