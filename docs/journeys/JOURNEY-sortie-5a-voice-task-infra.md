---
title: "User Journeys — sortie-5a-voice-task-infra"
feature: voice-task-infra
status: verified
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-5a, journeys, voice-agent, task]
---

# User Journeys — Sortie 5a: voice-task-infra

These journeys cover the three primary voice-agent task flows enabled by
`tools-task.ts`. All flows run inside an active LiveKit voice session with
Mr. Botsson. The voice LLM is OpenAI Realtime API; all capability calls route
through `ask()` → stage-engine `/agent/chat` (ADR-0132).

---

## Journey A — Voice: Employee Lists Their Open Tasks

**Role:** Employee  
**Surface:** LiveKit voice session (mobile or web BotssonVoiceCall)  
**Precondition:**
- Employee has an active LiveKit voice session with Mr. Botsson.
- At least one open task exists across any source (session, personal, day_ad_hoc, emma).
- `context_init` message has already delivered `workspace_id` + `profile_id` to the adapter.

### Happy Path

1. Employee says: `"Vis mine oppgaver i dag"` (or variant: `"hva må jeg gjøre"`, `"hva står for tur"`).
2. Voice LLM matches description keywords in `list_my_tasks` tool (`"vis oppgavene mine"`, `"hva må jeg gjøre"`).
   → Voice LLM emits tool call: `list_my_tasks({})` (no window args needed for "i dag").
3. `execute()` calls `ask("Vis mine åpne oppgaver.", "list_my_tasks")`.
4. `ask()` POSTs to stage-engine `/agent/chat` with `{ query, label, channel: "voice", workspace_id, profile_id }`.
5. Stage-engine intent-classifier routes to `task.list_mine` capability tool.
6. Capability tool calls `fn_list_my_tasks` RPC → queries `session_task`, `personal_task`, `day_ad_hoc_task` tables scoped to `profile_id` + `workspace_id`.
7. Stage-engine returns serialized task list (titles, IDs, sources, due dates).
8. `ask()` resolves with response string; `execute()` returns the string to the voice LLM.
9. Voice LLM reads the list aloud: `"Du har 3 åpne oppgaver: 1) Sjekk kjøletemperatur på kjøkkenet — ferdig innen 18:00. 2) ..."`.

**Postcondition:**
- Employee has heard their task list read aloud.
- No database writes occurred.
- No telemetry emitted (read-only path; stage-engine emits `tool_call` + `tool_response` activity events for Arena LogView).

### Error Paths

| Error | What happens |
|---|---|
| No open tasks | Stage-engine returns `"Du har ingen åpne oppgaver akkurat nå."` Voice LLM reads this aloud. |
| Stage-engine unreachable | `ask()` resolves with error string from fetch catch. Voice LLM reads: `"Klarte ikke hente oppgavene dine nå."` |
| Profile not found in context_init | `ask()` forwards empty `profile_id`; stage-engine returns 400. Voice LLM apologises generically. |
| Voice LLM picks `query_smartout` instead | Fallback tool still reaches stage-engine; intent-classifier routes to list_mine. Slower but correct. |

---

## Journey B — Voice: Employee Completes a Task

**Role:** Employee  
**Surface:** LiveKit voice session  
**Precondition:**
- Employee has an active LiveKit voice session.
- Employee has received a task list (Journey A or prior context) from which a task ID and source are known.
- The target task exists in the database with status `open`.

### Happy Path

1. Employee says: `"Marker oppgaven om kjøling som ferdig"`.
2. Voice LLM references prior context (task list returned in Journey A) to resolve the task.
   → Voice LLM emits tool call: `complete_task({ id: "uuid-kjøling", source: "session" })`.
   (Voice LLM extracts `id` + `source` from the serialized list returned in step 9 of Journey A.)
3. `execute()` calls `ask("Marker oppgave uuid-kjøling (source: session) som ferdig.", "complete_task")`.
4. `ask()` POSTs to stage-engine `/agent/chat` with `channel: "voice"`.
5. Stage-engine routes to `task.complete` capability tool.
6. Capability tool body:
   - Verifies `source` is a known domain (`session | personal | day_ad_hoc | emma`).
   - Updates the relevant table row to `status = 'completed'`, `completed_at = now()`.
   - Emits `task.completed` telemetry event via `emit()`.
7. Stage-engine returns confirmation string: `"Oppgaven er markert som ferdig."`.
8. Voice LLM confirms aloud: `"Kjøleoppgaven er nå markert som ferdig."`.

**Postcondition:**
- Task row status = `completed` in the relevant table.
- `task.completed` telemetry event emitted to PostHog + activity_trail.
- If task was a `session_task` with a linked `session_hook`, hook completion logic fires (per D6 rules).

### Error Paths

| Error | What happens |
|---|---|
| Task ID not found | Stage-engine returns 404-equivalent message. Voice: `"Fant ikke oppgaven. Prøv å liste oppgavene på nytt."` |
| Task already completed | Stage-engine returns idempotent `"Oppgaven er allerede ferdig."` Voice reads this. |
| Wrong source enum value | Stage-engine capability tool validates source; returns error. Voice: `"Klarte ikke fullføre oppgaven."` |
| C4 authority check fails (session_task owned by another manager) | Stage-engine returns auth refusal. Voice reads refusal aloud. |

---

## Journey C — Voice: Chat-Only Refusal on Task Creation

**Role:** Manager  
**Surface:** LiveKit voice session  
**Precondition:**
- Manager has an active LiveKit voice session.
- Manager attempts to create a session task via voice (chat-only in V1 per ADR-0298 R6).

### Happy Path (from system perspective — refusal is the correct outcome)

1. Manager says: `"Lag oppgave til Anna i morgen om kjøleskapskontroll"`.
2. Voice LLM matches `create_session_task` tool description (`"Lag en D6 oppgave knyttet til en åpen vakt/session"`).
   → Voice LLM emits tool call: `create_session_task({ session_id: "...", title: "Kjøleskapskontroll til Anna", reason: "daglig rutine" })`.
   (Voice LLM may hallucinate a session_id from context or ask for it; either way the call proceeds.)
3. `execute()` calls `ask("Opprett session_task på {session_id}: 'Kjøleskapskontroll til Anna'. Begrunnelse: daglig rutine.", "create_session_task")`.
4. `ask()` POSTs to stage-engine `/agent/chat` with `channel: "voice"`.
5. Stage-engine routes to `task.create_session` capability tool.
6. Capability tool's channel guard (ADR-0288) detects `channel === "voice"` → returns refusal without writing to database:
   `"Si dette på tekst, så lager jeg oppgaven."` (hard-coded Norwegian, i18n deferred).
7. `ask()` resolves with the refusal string.
8. Voice LLM reads the refusal aloud: `"Si dette på tekst, så lager jeg oppgaven."`.
9. Manager switches to chat (BotssonShell text input or mobile chat tab).
10. Manager types the same request in chat → stage-engine sees `channel: "chat"` → task is created successfully.

**Postcondition:**
- No task row created in any table.
- No telemetry emitted (refusal is a guard exit, not a mutation).
- Manager understands they need to use the text channel.

### Error Paths

| Error | What happens |
|---|---|
| Voice LLM picks `create_task` (personal, tools-personal.ts) instead | `create_task` calls `ask()` → forwarded to stage-engine → same channel guard fires if capability routes it through task.create_personal. Refusal returned. Tool overlap is a UX issue (KI-1) not a correctness issue. |
| Voice LLM picks `query_smartout` fallback | Falls through to free-form stage-engine query; intent-classifier resolves to create_session → channel guard still fires. Same refusal. |
| Manager does not hear refusal (background noise) | Manager can repeat the request; system is idempotent — no harm in re-triggering the refusal. |
| Manager switches to chat but is not authenticated | Standard auth flow applies; not specific to this journey. |

---

## Notes on Voice-Agent Architecture

These journeys rely on the following invariants established by prior sorties and ADRs:

- **L-0233** — Voice Realtime LLM and stage-engine are two separate LLM contexts. Tool execution in voice does not modify the stage-engine prompt. `ask()` is a stateless HTTP call per invocation.
- **ADR-0132** — Voice-agent is a thin client. All capability invocations route via stage-engine. Voice-agent never calls capability tools directly or imports `@smartout/ai`.
- **ADR-0288** — Channel policy is enforced by stage-engine capability channel guards, not by the voice-agent tools themselves.
- **ADR-0298 R6** — Chat+voice safe: `list_mine`, `complete`. Chat-only V1: `create_personal`, `create_session`, `create_day_ad_hoc`, `cancel_personal`.
