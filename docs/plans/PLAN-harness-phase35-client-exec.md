---
title: "Plan — harness-phase35-client-exec"
status: complete
updated: 2026-05-14
created: 2026-05-14
module: harness
tags: [plan, harness, adr-0327, phase35, client-tool-roundtrip]
---

# Plan — harness-phase35-client-exec

> Branch: `feat/harness-phase35-client-exec` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: harness | Started: 2026-05-14

## Canonical plan reference

No standalone superpowers plan doc was written for this sortie. Authoritative sources:

- **Goal + acceptance criteria:** `.claude/state/harness-phase35-client-exec/goal.md`
- **ADR:** `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` (Phase 3.5 section)
- **Predecessor HANDOFF:** `docs/HANDOFF-harness-phase3-chat.md`

This `docs/plans/PLAN-*.md` file is the pointer required by the close-feature gate. See harness-phase3-chat precedent (`docs/plans/PLAN-harness-phase3-chat.md`).

## Goal

Close the two `DEAD-PIPE-ADR-0327-C1` TODOs (Phase 3.5a) and ship the full client-tool-execution roundtrip protocol (Phase 3.5b) so LLM-invoked client tools actually fire in the browser. Phase 3.5a: `routeAgentMessage` accepts optional `bundle` parameter; chat route passes resolved bundle to LLM via merged ToolSet. Phase 3.5b: stage-engine emits `client_tool_calls` for client-tool invocations; BFF propagates field; BotssonChat invokes implementations and re-POSTs `client_tool_results`; stage-engine resumes conversation.

## Tasks

### Wave 1 — Types + contracts (parallel)

- [x] Prep commit: `ClientToolCall` + `ClientToolCallResult` types in `harness/types.ts`; `routeAgentMessage` optional `bundle` + `clientToolNames` params; `DEAD-PIPE-ADR-0327-C1` stubs

### Wave 2 — Implementation (parallel A/B/C)

- [x] A1: BFF chat route — `client_tool_results` inbound + `client_tool_calls` outbound propagation + Zod schema update
- [x] B1: Stage-engine — bundle→LLM merge via `jsonSchema()` + `tool()` helpers; post-`generateText` tool-call scan; `client_tool_calls` response field
- [x] C1: BotssonChat — `resolveClientToolCalls` + `executeClientToolRoundtrip` with 3-round loop cap

### Wave 3 — Tests + typecheck

- [x] Stage-engine chat-pipeline tests: 9/9 pass
- [x] BFF route tests: 13/13 pass (Phase 3 carryover 10 + 3.5b new 3)
- [x] BotssonChat roundtrip tests: 10/10 pass
- [x] TS strict narrowing fix (BFF test capturedBody cast)
- [x] Repo-wide typecheck: 52/52 pass

### Wave 4 — Docs

- [x] JOURNEY-harness-phase35-client-exec.md (4 journeys, verified: true)
- [x] HANDOFF-harness-phase35-client-exec.md
- [x] PLAN-harness-phase35-client-exec.md (this file)

## Acceptance Criteria

- [x] `routeAgentMessage` accepts optional `bundle?: ToolBundle` param; merges when present
- [x] Chat route removes `DEAD-PIPE-ADR-0327-C1` TODOs; passes `resolved.bundle` to `routeAgentMessage`
- [x] Stage-engine integration test: LLM `tools` includes both capability + client-shipped tools (AC3)
- [x] Stage-engine emits `client_tool_calls` when LLM picks client tool (AC4)
- [x] BFF propagates `client_tool_calls` to client response body (AC5)
- [x] BFF accepts + forwards `client_tool_results` request field (AC6)
- [x] BotssonChat detects `client_tool_calls`, invokes implementations, re-POSTs results (AC7)
- [x] Typecheck passes: `pnpm turbo typecheck` (52/52 packages) (AC9)
- [x] All existing Phase 3 tests pass: 6 route pipeline + 10 resolver + 5→10 BFF (AC10 extended)
- [x] User journeys written + 4 verification protocols pass (42/42) (AC11)
- [x] HANDOFF written (AC12)
