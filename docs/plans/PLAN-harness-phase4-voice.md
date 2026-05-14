---
title: "Plan — harness-phase4-voice"
status: complete
updated: 2026-05-14
created: 2026-05-14
module: harness
tags: [plan, harness, adr-0327, phase4, voice, livekit, client-tool-roundtrip]
---

# Plan — harness-phase4-voice

> Branch: `feat/harness-phase4-voice` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: harness | Started: 2026-05-14

## Canonical plan reference

No standalone superpowers plan doc was written for this sortie. Authoritative sources:

- **Goal + acceptance criteria:** `.claude/state/harness-phase4-voice/goal.md`
- **Investigation findings:** `.claude/state/harness-phase4-voice/investigation-findings.md`
- **ADR:** `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` (Phase 4 section)
- **Predecessor HANDOFF:** `docs/HANDOFF-harness-phase35-client-exec.md`

This `docs/plans/PLAN-*.md` file is the pointer required by the close-feature gate. See Phase 3.5 precedent (`docs/plans/PLAN-harness-phase35-client-exec.md`).

## Goal

Close the voice-surface dead pipe per ADR-0327 Phase 4. Replace `LiveKitVoiceSession.registerTool` no-op stub with real implementation. Wire bidirectional RPC protocol over three LiveKit data-channel topics (`botsson-tools-register`, `botsson-tool-call`, `botsson-tool-result`). Voice-agent builds async tool stubs via `buildClientToolStub` and registers them on the Realtime LLM via `agent.updateTools()`. PII tools stripped via `voice-tool-resolver.ts` (ADR-0078). Feature-flagged via `HARNESS_ADAPTER_VOICE`.

## Tasks

### Wave 0 — Investigation (read-only)

- [x] Confirm `agent.updateTools()` API exists in `@livekit/agents@1.3`
- [x] Confirm tool `execute` body is the correct interception point (no pre-execution hook)
- [x] Define topic protocol (3 topics, no collisions with existing `botsson-activity`/`botsson-context`)
- [x] Write `investigation-findings.md` with locked API contracts + Wave 1 dispatch plan

### Wave 1 — Implementation (parallel A1 / A2 / A3)

- [x] A1 (agent-sdk browser): Fill `LiveKitVoiceSession` — `registerTool` real impl, `publishToolDefinitions`, `DataReceived` RPC handler, 6 unit tests
- [x] A2 (voice-agent server): `client-tool-rpc.ts` — `buildClientToolStub` + pending RPC Map + `resolveToolResult`; `agent.ts` DataReceived extension for 3 new topics; 7 unit tests
- [x] A3 (voice-tool-resolver): `voice-tool-resolver.ts` — HarnessAdapter capability call + PII authority + audit logging; `agent.ts` integration; 7 unit tests

### Wave 2 — Verification

- [x] agent-sdk tests: 6/6 pass
- [x] voice-agent client-tool-rpc tests: 7/7 pass
- [x] voice-agent voice-tool-resolver tests: 7/7 pass
- [x] Repo-wide typecheck: 52/52 pass

### Wave 3 — Docs

- [x] JOURNEY-harness-phase4-voice.md (5 journeys, verified: true)
- [x] HANDOFF-harness-phase4-voice.md
- [x] PLAN-harness-phase4-voice.md (this file)

## Acceptance Criteria

- [x] `LiveKitVoiceSession.registerTool` stub replaced with real implementation (AC1)
- [x] Browser publishes definitions on `botsson-tools-register` topic at session start (AC2)
- [x] Voice-agent `DataReceived` handles `botsson-tools-register` (AC3)
- [x] Voice-agent merges client stubs with capability tools via `agent.updateTools()` (AC4)
- [x] PII tools stripped for voice channel — ADR-0078 holds (AC6)
- [x] LLM-invoked client tool → voice-agent publishes `botsson-tool-call` → browser invokes impl → `botsson-tool-result` returned (AC7 + AC8)
- [x] 10s timeout safety on RPC wait (AC9)
- [x] All tests pass: 20/20 sortie + 52/52 typecheck (AC10 + AC11 + AC12)
- [x] JOURNEY written + verified: true (AC13)
- [x] HANDOFF written (AC14)
