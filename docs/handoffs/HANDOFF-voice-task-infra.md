---
title: "Sortie 5a — voice-task-infra HANDOFF"
slug: sortie-5a-voice-task-infra
status: done
revision: v1
layer: handoff
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0303
campaign: sortie-5-task-cutover
related_sorties: [Sortie-3 (ADR-0301), Sortie-4 (ADR-0302)]
target_branch: feat/sortie-5-task-cutover-voice-task-infra
tags: [sortie-5a, handoff, voice-agent, task, ADR-0298]
---

# Sortie 5a — voice-task-infra HANDOFF

## Summary

Sortie 5a wires the LiveKit voice-agent task surface that was missing after Sortie 3
shipped the task capability tools in `packages/ai/src/capabilities/task/`. ADR-0298
row 5 (voice-agent tooling) required a dedicated `tools-task.ts` mirroring the
capability surface. Without it, voice users could not list or complete tasks via
Mr. Botsson — the voice-agent had no typed entry points and would fall through to
the generic `query_smartout` tool, with unpredictable routing.

Three commits land in this sortie:

1. `efdcb26b9` — spec + plan committed before worktree creation (per ADR-0075 plan-first rule).
2. `e5381c2c4` — `services/voice-agent/src/tools-task.ts`: 6 thin `llm.tool()` wrappers.
3. `dcb56f4cf` — `services/voice-agent/src/adapter.ts` wiring + `tools-personal.ts` soft-deprecation.

Phase 4 (vitest coverage) is a pending commit on this branch; the test file
`services/voice-agent/__tests__/tools-task.test.ts` was committed as part of closure.

**Prereq satisfied:** Sortie 5b can now hard-delete `operations.complete_task` and promote
ADR-0298 from `proposed` to `accepted`.

---

## Decisions

### D1 — Factory `AskFn` injection pattern (mirrors tools-personal.ts)

`buildTaskTools(ask: AskFn)` receives the `ask()` helper as a parameter rather than
importing it directly from `adapter.ts`. This matches the existing
`buildPersonalTools(ask)` and `buildCapabilityQueryTools(ask)` pattern and is the
established way to avoid circular imports: `adapter.ts` owns `ask()` and injects it
at build time; individual tool files never import from `adapter.ts`.

### D2 — Channel enforcement delegated to stage-engine (ADR-0288)

The four chat-only tools (`create_personal_task`, `create_session_task`,
`create_day_task`, `cancel_personal_task`) are exposed to the voice LLM. They call
`ask()` which forwards `channel="voice"` to stage-engine. Stage-engine's capability
channel guard (ADR-0288) returns the Norwegian refusal text
`"Si dette på tekst, så lager jeg oppgaven"` when channel is voice.

The voice-agent does NOT implement its own channel block. Stage-engine is the single
source of truth for channel policy. This matches how all other channel-guarded tools
work (payroll, AML, contract mutations).

Rationale: voice-agent is a thin forwarding layer; duplicating channel logic here
would create two diverging sources of truth and make ADR-0288 amendments brittle.

### D3 — tools-personal.ts `create_task` soft-deprecated (retained for backward-compat)

`tools-personal.ts:53` `create_task` description updated to:
`"MERK (ADR-0298 row 5a): bruk create_personal_task i task-namespace hvis tilgjengelig — denne er fallback."`

The tool is NOT deleted. Existing voice sessions that have already resolved a tool
list mid-flight would break if a tool disappeared. The deprecation hint biases the
voice LLM toward `create_personal_task` without forcing a hard cut mid-session.
Hard rename deferred to Sortie 5c.

### D4 — No new ADR for Sortie 5a

Sortie 5a is a sub-sortie inside campaign `sortie-5-task-cutover`. The campaign
closure ADR (ADR-0303) is written by Sortie 5b after hard-delete completes.
Sortie 5a records no independent ADR — all decisions here are implementation
details within ADR-0298 scope.

---

## Learnings

### L-A — Factory `AskFn` injection preserves circular-import safety

Declaring `type AskFn = (query: string, label: string) => Promise<string>` locally
in each tool file and accepting it as a parameter is the correct pattern for
voice-agent tool modules. Any attempt to import `ask` directly from `adapter.ts`
would create a circular dependency because `adapter.ts` imports the tool files.
This pattern is already established in `tools-personal.ts` and `tools-capability.ts`
and must be followed by all future tool files in this service.

### L-B — Norwegian description language is mandatory for voice tool selection

The voice LLM (OpenAI Realtime API) picks which tool to call based on description
keyword matching. All existing tools in `tools-personal.ts` use Norwegian descriptions.
A tool with an English description in a Norwegian-language session would be
systematically underselected. Descriptions must use Norwegian trigger phrases that
match natural speech patterns (e.g. `"vis oppgavene mine"`, `"marker som ferdig"`)
not just technical English labels.

### L-C — `additionalProperties: false` enforced at LLM layer, not runtime

The JSON schema `additionalProperties: false` constraint on every tool's `parameters`
is consumed by the voice LLM to constrain tool call generation — it does NOT throw at
runtime when the `execute()` function receives the args object. The TypeScript
parameter type on `execute: async (args: {...}) => ...` is the runtime contract.
These are two separate validation boundaries. L-0237 (from prior work) confirms this
boundary distinction applies to voice tool schemas the same as capability tools.

---

## Known Issues / Debt

### KI-1 — `tools-personal.ts` `create_task` overlaps with `create_personal_task`

Two tools with overlapping descriptions exist simultaneously in `buildAllBotssonTools()`.
The voice LLM may pick either depending on exact phrasing. The deprecation hint in
`create_task` biases toward the new tool but does not eliminate ambiguity.
Hard rename / deletion of `create_task` is deferred to Sortie 5c (ADR-0304 alias
cutover, target ~2026-06-12) after production voice sessions have migrated.

### KI-2 — No real LiveKit Room.connect harness in CI

`services/voice-agent/__tests__/tools-task.test.ts` covers unit-level tool execution
via mocked `ask()`. There is no CI test that spins up a real LiveKit Room, connects
the voice agent, and verifies tool dispatch end-to-end. The existing test infrastructure
(`no-nc.test.ts`) is file-scan only. Full voice-path E2E is deferred to Sortie 5b
or a dedicated voice-harness sortie.

### KI-3 — Channel refusal text is hard-coded Norwegian in stage-engine

The refusal returned by stage-engine on `channel="voice"` for chat-only tools is
`"Si dette på tekst, så lager jeg oppgaven"` — a hard-coded Norwegian string in
the stage-engine capability channel guard. i18n of this refusal text is deferred.
Acceptable V1 UX for a Norwegian-first product.

---

## Next Steps

### Sortie 5b (next sub-sortie — follow-on immediate)

- Hard-delete `operations.complete_task` capability tool.
- Migrate ~6 known callers in `apps/web/` and `apps/mobile/` to `task.complete`.
- Drop `aliasTaskVerbs` shim from intent-classifier (subject to eval-gate pass).
- Update `CLAUDE.md` task-handling section to reflect final single-verb surface.
- Promote ADR-0298 from `proposed` → `accepted`.
- Write ADR-0303 (campaign closure, covers all Sorties 1–5b decisions).

### Sortie 5c (deferred ~2026-06-12)

- ADR-0304: alias cutover.
- Hard-delete `tools-personal.ts` `create_task` (after verifying 30-day production
  voice-session telemetry shows `create_personal_task` fully absorbed the load).
- Drop `task.added_manual` telemetry alias from `packages/telemetry/src/registry.ts`.
