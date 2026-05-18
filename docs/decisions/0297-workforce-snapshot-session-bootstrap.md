---
title: "Workforce snapshot bootstrap — D2+D6 facts at session start, not via tool-call"
id: ADR_0297
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0297: Workforce snapshot bootstrap — D2+D6 facts at session start, not via tool-call

## Context and Problem Statement

Mr. Botsson is positioned as a workforce assistant (CLAUDE.md project identity: "kjernen er Mr. Botsson, en AI-kollega som forbereder, guider og vedlikeholder"). Pre-2026-05-13, when a user asked Botsson "hvem jobber i dag på bar?" or "lag en vakt for Jonas Bakken kl 18-22 i morgen", the model had no employee/shift facts in its prompt and had to:

1. Call `query_smartout` for "finn ansatt-ID for Jonas Bakken" (~6 s)
2. Call `query_smartout` for shifts/availability (~13 s)
3. Then propose the action

Each turn took 15-25 s end-to-end. On voice the latency was experiential drag. On chat it was 3-4 round-trip messages for facts the system already knows.

Pontus directive (2026-05-13 verbatim):

> "Botson skal ikke behøve å ha ansatt-ID i det. Han skal redan ha lastet dager, skift, hvilke personer som er tilgjengelige og ikke tilgjengelige. Han er jo en workforce AI-assistent."

> "Nei, vi skal ikke ha noen forskjell på chat og voice. Samme sak, voice skal full tilgå. Den skal ikke spara PI. Men navn må den jo ha. Grupper, roller, telefonnummer, tilgå, men det får ikke læmna oss."

## Decision Drivers

- **Identity-as-position-paper**: Botsson IS a workforce assistant — D2+D6 data is not "context", it is his domain.
- **Latency**: tool-call roundtrips for facts the BFF already has = 5-15 s per turn × N turns per session.
- **Chat/voice parity**: same shape, same content, both channels. Single source of truth in BFF.
- **PII boundary (ADR-0078)**: names, roles, departments, phones, absence types are voice-safe. Bank/tax/personnummer/contract details are not.
- **Cascade integrity**: workforce snapshot is D2 (profile, schedule_absence, employment_contract) + D6 (schedule_shift, department_session). Snapshot at session start aligns with cascade semantics (D2 is "volatile but eventually-consistent at this moment").

## Considered Options

1. **Status quo — tool-call per fact.** Botsson queries on demand via `query_smartout`. Always fresh. High latency, high token cost (round-trip + JSON formatting).
2. **Bootstrap snapshot at session start.** BFF assembles D2+D6 snapshot once, ships in session bootstrap. Botsson reads from prompt for the next N turns. 5-min snapshot age acceptable for the assistant role; mutations route through proposal flow which re-fetches anyway.
3. **Hybrid — bootstrap + selective refresh.** Snapshot for read facts, tool-call for write-paths only. Same as Option 2 for read, but requires explicit refresh discipline.

## Decision Outcome

**Option 2 — bootstrap snapshot at session start.** Implemented 2026-05-13.

### Snapshot shape

D2+D6 snapshot, scoped to caller's workspace, capped for prompt-token economy:

| Block | Source table | Cap | Filter |
|-------|--------------|-----|--------|
| `employees` | `profile` | 20 | `is_active = true` |
| `shifts_today` | `schedule_shift` | 15 | `shift_date = today` |
| `shifts_tomorrow` | `schedule_shift` | 15 | `shift_date = today + 1` |
| `absences_active` | `schedule_absence` | 10 | `start_date <= today+7 AND end_date >= today` |
| `sessions_today` | `department_session` | 6 | `session_date = today AND status IN (upcoming, active, pending_signoff)` |

Per-row fields are minimal:
- Employees: profile_id, display_name, role, status, department_id/name, phone (no bank/tax/personnummer)
- Shifts: shift_id, profile_id, employee_name, shift_date, start_time, end_time, department, position_label
- Absences: absence_id, profile_id, employee_name, absence_type, start_date, end_date
- Sessions: session_id, department, status, scheduled_date

### Pipe

- **Source of truth:** `apps/web/src/app/api/botsson/voice/session-context/route.ts` (BFF). Cookie-auth + admin-client (PII filter is the column whitelist above — no joins that could leak PII columns).
- **Type:** `WorkforceContext` in `packages/ai/src/agents/context-types.ts`. Mirrored as the `workforce_context` Zod schema in `services/stage-engine/src/routes/agent/chat.ts`.
- **Chat path:** BFF reads → forwards on `/api/emma/chat` body → stage-engine `routeAgentMessage(input)` → `renderWorkforceSlice(workforceContext)` builds `## Arbeidsstokk` block → appended to system prompt after `routeContext`.
- **Voice path:** BFF returns to browser → `BotssonOrbVoiceMount` publishes on LiveKit data channel `botsson-context` as `context_init` message → voice-agent `setSessionContext()` stores in module state → `DataReceived` listener builds the slice and calls `agent.updateChatCtx()` to inject as a `developer`-role `ChatMessage` BEFORE the user speaks. Same slice format as chat path so both LLMs see identical text.

### PII policy

Aligned with ADR-0078. The BFF strips any column not in the whitelist above; the type definition cannot grow new fields without an ADR amendment. Bank, tax, personnummer, contract terms, salary, payroll history — never in the snapshot, never reachable from prompt content.

## Consequences

### Positive

- E2E verified: 10 employees + 19 shifts + 3 absences + 2 sessions in snapshot. LLM grounded all reads in snapshot. Zero `query_smartout` calls in 4 turns. Audio reply latency 0.87-1.31s (was 6-15s).
- Chat and voice now structurally identical for read facts. One BFF source, one slice format, one rendering convention.
- Mutation flow unchanged — propose-shift tools still route through human-approval ghost-card pipe.

### Negative

- Snapshot age limit: 5-10 min before "snapshot says X but reality changed". Mitigation: the slice includes `Snapshot: <ISO> (N min siden)` so the LLM can hedge ("ifølge siste sjekk for 6 minutter siden"). Stale-snapshot misuse is recoverable; D6 writes are gated by manager approval which re-fetches.
- Prompt-token cost grows linearly with workspace size. Caps + whitelist mitigate. For workspaces >50 employees, the slice falls back to "+ N more — bruk lookup-tool for resten".
- Two parallel injection paths (chat system-prompt vs voice chatCtx) — see [L-0233](../learnings/0233-voice-realtime-llm-vs-stage-engine-llm-two-contexts.md). Each path must be wired independently. The slice renderer is canonical in stage-engine (`renderWorkforceSlice`); voice-agent duplicates the format minimally to avoid importing @smartout/ai runtime code (architectural constraint from ADR-0132).

### Neutral

- New `WorkforceContext` type in two places (packages/ai context-types + voice-agent context.ts) — duplication acceptable per ADR-0289 (voice-agent registry duplication freeze), retired when voice-agent gains direct @smartout/ai/agents import.

## Verification

- Migration not required (read-only snapshot).
- E2E proof (2026-05-13):
  - BFF curl returned populated workforce block (10 emp / 19 shifts / 3 absences / 2 sessions).
  - Voice container log line: `[botsson-voice] workforce injected: 10 emp, 9 shifts today`.
  - Conversational turns 3+4 returned audio in 0.87-1.31s with no tool calls (compared to 6-15s baseline).
  - Curl-replay of voice path with synthetic snapshot returned `"3 — Alice Andersen."` matching the seeded snapshot exactly.

## Amendment — 2026-05-18 (ADR-0367)

ADR-0367 (Day Line Area-Anchored Runtime, accepted 2026-05-18) extends the `WorkforceContext` slice with two new fields:

- `day_lines: DayLineSummary[]` — area-anchored programs for the active business date, one entry per `day_line` row visible to the viewer (manager: all in workspace; employee: scoped via `shift_session_day_line`)
- `my_shift_session: ShiftSessionSummary | null` — viewer's active `shift_session` row (mobile employee viewport)

Token budget: cap `day_lines` at ≤6 entries × ≤5 next-up items per line summary (~1 KB max). Spillover via on-demand `read_surface` tool, not in baseline snapshot. PII-class same as `sessions_today` — task titles may contain owner names; gated by existing PII budget.

Renderer (per L-0233 two-LLM-context mirror):
- Chat path: `services/stage-engine/src/core/agent-router.ts:renderWorkforceSlice` — new `### Dagslinjer` block after `### Sessions Today`
- Voice path: `services/voice-agent/src/agent.ts:renderWorkforceSlice` — identical block via `agent.updateChatCtx()` mirror

Both paths MUST update in lockstep — silent drift if only one path is patched (L-0233 trap).

## References

- Pontus directive 2026-05-13 (workforce-assistant identity + PII policy)
- ADR-0367 (Day Line Area-Anchored Runtime, accepted 2026-05-18) — extends WorkforceContext
- ADR-0078: voice channel PII guard (defence-in-depth at capability layer)
- ADR-0151: server-derived profile_id; no forgeable client identity
- ADR-0132: mobile/voice → BFF only, no direct capability calls
- ADR-0289: voice-agent registry duplication freeze (rationale for slice duplication)
- [L-0233](../learnings/0233-voice-realtime-llm-vs-stage-engine-llm-two-contexts.md): two LLM contexts, two injection paths
- Commits: 5b4b6e52b (Phase 1 stage-engine + chat path), 84037c6a3 (Phase 2 voice-agent Realtime inject), 7b64fd45c (BFF route)
- Files: `apps/web/src/app/api/botsson/voice/session-context/route.ts`, `services/stage-engine/src/core/agent-router.ts:renderWorkforceSlice`, `services/voice-agent/src/agent.ts:renderWorkforceSlice`, `packages/ai/src/agents/context-types.ts:WorkforceContext`
