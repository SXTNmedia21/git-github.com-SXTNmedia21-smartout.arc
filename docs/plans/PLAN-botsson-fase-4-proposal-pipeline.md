---
title: "Plan — botsson-fase-4-proposal-pipeline"
feature: botsson-fase-4-proposal-pipeline
spec: ../../superpowers/plans/2026-05-06-botsson-fase-4-proposal-pipeline.md
status: draft
updated: 2026-05-06
created: 2026-05-06
module: Botsson
tags: [plan]
---

# Plan — botsson-fase-4-proposal-pipeline

> Branch: `feat/botsson-fase-4-proposal-pipeline` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2` | Module: Botsson

**Spec / canonical plan:** [Fase 4 — Proposal Pipeline](../../superpowers/plans/2026-05-06-botsson-fase-4-proposal-pipeline.md) (Revisjon 2, ab7aa83b3)

## Journeys (the contract)

- [JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift](../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md) — Botsson voice proposes shift create/update/delete → ghost card appears
- [JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift](../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md) — User accepts ghost card → schedule_shift INSERT
- [JOURNEY-botsson-fase-4-proposal-pipeline-reject-emits-trail](../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-reject-emits-trail.md) — User rejects ghost card → activity_trail row written
- [JOURNEY-botsson-fase-4-proposal-pipeline-auth-recorder-pipe](../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-auth-recorder-pipe.md) — Authorization + workspace_context bridge → 200 + agent_session_recording row
- [JOURNEY-botsson-fase-4-proposal-pipeline-cross-workspace-auth-boundary](../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-cross-workspace-auth-boundary.md) — Cross-workspace token rejected at stage-engine

## Goal

Wire Botsson voice into the existing ghost-card proposal pipeline so voice-driven shift mutations flow through human acceptance instead of auto-applying. Closes the auto-approve regression introduced in `22410af2` (2026-03-29) and reinstates "Botsson foreslår, mennesket aksepterer."

## Tasks

Follow the canonical plan. Specialist-team orchestration via `supervisor` (opus). Dispatch order: Phase A (auth-bridge) → Phase B (types + tools) → Phase C (browser + remove auto-approve) → Phase D (E2E) → Phase E (closeout). Task 14 requires Pontus.

### Status

- [x] **Task 1** — JWT minted 2026-05-06, exp 2026-08-04 (+90d). Both vaults synced. SMA-295 due 2026-05-31. See SMA-295 comment for verification trail.
- [x] **Task 2** — adapter.ts auth header + workspace_context. Commit `70edc7d04`. Plan-spec drift on field names logged (real WorkspaceContext exposes name/niche/season/framework/cycle directly).
- [x] **Task 3** — Phase A PASS-WITH-CAVEAT. JWT validated by stage-engine, profile resolved server-side, recorder row writes confirmed (`agent_session_recording`). Caveat: OpenRouter 500 on tools-attached generateText — pre-existing, separate Linear ticket needed, NOT Phase A scope. Container env trap: must run `docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml ...` to get host.docker.internal SUPABASE_URL.
- [ ] Tasks 4–15 — see canonical plan (Phase B+ unblocked)

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 9 E2E scenarios (Task 14.1–14.9) green or documented as V0-known limit
- [ ] No auto-approve callsites remain (grep guard)
- [ ] `agent_session_recording` rows created for authenticated voice sessions
- [ ] Decision log updated (ADR-0289 + any Phase-discovered ADRs)

## Linear

- SMA-295 — Phase 4 implementation tracker
- SMA-296 — Auth bridge (Phase A)
- SMA-297 — Workspace authority chain doc (B1, follow-up)
- SMA-298 — Voice-tool-retry idempotency (V0 deferred)
- SMA-299 — ADR-0078 amendment for proposal-domain tools (R1)
- SMA-300 — Path-context staleness fix (V0 deferred)
