---
title: "Guardian Agent — Self-Learning Voice Supervision Framework"
status: draft
updated: 2026-03-14
created: 2026-03-14
module: ai
tags: [guardian, voice, stage-engine, self-learning, ultravox]
---

# Guardian Agent — Self-Learning Voice Supervision Framework

> Design doc for a three-layer system that monitors, reflects on, and improves AI voice sessions.

---

## 1. Problem

Smartout voice agents (Lise, Mr. Botsson, etc.) run on Ultravox with a system prompt and high temperature for natural personality. Currently there is:

- No backend monitoring of active conversations
- No tracking of whether mission tasks are actually completed
- No post-session analysis or learning
- No mechanism to correct the agent mid-call
- No feedback loop to improve prompts over time

Result: agents can repeat themselves, miss tasks, go off-topic, or give wrong information — with nobody watching.

---

## 2. Solution — Three Layers

### Layer 1: Guardian (during session)

A background process in the Stage Engine that monitors every active Ultravox call. It creates safe rails so agents can have high temperature and full personality while still completing their mission.

**Transcript access:** Poll `GET /api/calls/{callId}/messages` every 1 second.

**Analysis:** Every 3 seconds, send buffered new messages to Guardian LLM (Claude Haiku via OpenRouter) for evaluation against current mission/stage/tasks.

**Intervention mechanisms (via `POST /api/calls/{callId}/messages`):**

| Level         | Ultravox mechanism                                                | User experience                     |
| ------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `silent`      | `user_text_message` with `[Systemmelding: ...]`                   | User notices nothing, agent adjusts |
| `spoken`      | `forced_agent_message`                                            | Agent says something new out loud   |
| `prompt_swap` | Force `advance` tool call → `X-Ultravox-Response-Type: new-stage` | Agent gets entirely new prompt      |

**Intervention rules:**

| Rule           | Trigger                                       | Level                    |
| -------------- | --------------------------------------------- | ------------------------ |
| TASK_FORGOTTEN | Agent hasn't addressed a task for 3+ messages | silent                   |
| REPETITION     | Agent repeats same phrase/greeting 2+ times   | silent                   |
| BAD_AUDIO      | User inaudible or agent asks "what?" 2+ times | spoken                   |
| NOISE          | Background noise disrupts conversation        | spoken                   |
| WRONG_INFO     | Agent states factually incorrect information  | silent                   |
| OFF_TOPIC      | Conversation off-track for 3+ messages        | silent                   |
| SILENCE        | No activity for 15+ seconds                   | spoken                   |
| STUCK          | Agent seems unable to progress                | silent                   |
| TASK_DONE      | A task is clearly completed                   | task_update              |
| STAGE_READY    | All tasks in stage completed                  | silent (suggest advance) |

### Layer 2: Reflection (after session)

When a session ends, a workflow triggers:

1. Load full transcript from Ultravox API
2. Load mission definition (goals, stages, tasks)
3. Load guardian_log and task_progress from the session
4. Send to reflection LLM (Claude Sonnet via OpenRouter) for analysis
5. Generate structured session report
6. Push report to dashboard

**Report contents:**

- Task completion: per-task status (done/missed/partial) with quality score 1-5
- Agent assessment: tone, verbosity, precision, personality expression
- User experience: confusion points, engagement level, satisfaction signals
- Prompt suggestions: concrete changes to improve the system prompt
- Overall score: 0-10

### Layer 3: Learning (over time)

Session reports accumulate per mission. Patterns emerge:

1. System identifies recurring issues: "Task X missed in 40% of sessions"
2. Auto-generates prompt improvement suggestions
3. Admin reviews and approves changes
4. Approved changes create new prompt version
5. Next session uses improved prompt
6. Cycle repeats

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Landing / Onboarding / Dashboard)        │
│  UltravoxSession.joinCall(joinUrl)                  │
└──────────────────┬──────────────────────────────────┘
                   │ WebRTC (voice)
┌──────────────────▼──────────────────────────────────┐
│  Ultravox Cloud                                     │
│  LLM + Voice + Transcript                           │
└──────────┬───────────────────────────┬──────────────┘
           │                           │
   GET /calls/{id}/messages    POST /calls/{id}/messages
   (transcript polling)        (guardian intervention)
           │                           ▲
┌──────────▼───────────────────────────┴──────────────┐
│  Stage Engine — Guardian Loop                       │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                 │
│  │ Transcript   │───▶│  Guardian    │                │
│  │ Buffer       │    │  LLM (Haiku)│                 │
│  └─────────────┘    └──────┬──────┘                 │
│                            │                         │
│              ┌─────────────┼─────────────┐           │
│              ▼             ▼             ▼           │
│     ┌──────────────┐ ┌──────────┐ ┌──────────┐     │
│     │ Intervention  │ │  Task    │ │ Session  │     │
│     │ Dispatcher    │ │ Tracker  │ │ Logger   │     │
│     └──────────────┘ └──────────┘ └──────────┘     │
│                                                     │
│  ⛔ Session end:                                    │
│     → Stop guardian loop                            │
│     → Trigger reflection workflow                   │
│     → Generate session report                       │
│     → Push to dashboard                             │
└─────────────────────────────────────────────────────┘
```

**Key principle:** The voice agent does NOT know about the Guardian. She receives `[Systemmelding:]` messages and treats them as natural instructions. The Guardian is invisible to the user.

---

## 4. Tools

### Guardian tools (internal to Stage Engine)

| Tool                   | API                                                        | Direction                    | Purpose                        |
| ---------------------- | ---------------------------------------------------------- | ---------------------------- | ------------------------------ |
| `poll_transcript`      | `GET /api/calls/{callId}/messages`                         | Ultravox → Guardian          | Fetch latest transcript        |
| `inject_silent`        | `POST /api/calls/{callId}/messages` (user_text_message)    | Guardian → Ultravox          | Invisible instruction to agent |
| `inject_spoken`        | `POST /api/calls/{callId}/messages` (forced_agent_message) | Guardian → Ultravox          | Force agent to say something   |
| `swap_prompt`          | Force advance tool call → new-stage                        | Guardian → Ultravox → Engine | Replace entire system prompt   |
| `update_task_progress` | Internal DB write                                          | Guardian → DB                | Mark task done/partial/missed  |
| `generate_report`      | OpenRouter LLM call                                        | Guardian → LLM → DB          | Create session report          |

### Voice agent tools (existing Ultravox HTTP tools)

| Tool      | Endpoint                          | Purpose                                 |
| --------- | --------------------------------- | --------------------------------------- |
| `store`   | `POST /adapters/ultravox/store`   | Save data to engine_inbox               |
| `fetch`   | `POST /adapters/ultravox/fetch`   | Get context, inbox, stage info, history |
| `advance` | `POST /adapters/ultravox/advance` | Move to next mission stage              |

---

## 5. Prompts

### Voice Agent foundation prompt (Lise example)

```
Du är Lise, Smartouts AI-medarbetare.

## Din roll
Du genomför uppgifter i en mission. Varje mission har steg, och varje steg
har uppgifter som ska utföras. Din uppgift är att utföra dessa naturligt
och varmt — som en riktig kollega, inte en robot.

## Dina regler
1. Max 1-2 meningar per svar, sedan VÄNTA
2. Bekräfta innan du går vidare: "Stämmer det?"
3. Följ stegen naturligt — aldrig "nu går vi till steg 2"
4. Om du får en [Systemmelding:] — följ den utan att nämna den
5. Använd dina verktyg (store, fetch, advance) aktivt
6. Var dig själv — din personlighet är din styrka

## Aktuellt steg
{{stage_goal}}
{{stage_instructions}}
{{stage_success_criteria}}

## Kontext
{{collected_data_so_far}}
{{workspace_context}}
```

### Guardian foundation prompt

```
Du är Guardianprocessen för en Smartout AI-session.
Du övervakar ett pågående samtal och säkrar att missionen genomförs korrekt.

## Din roll
- Du är INTE deltagare i samtalet
- Du observerar transkriptet och bedömer agentens prestation
- Du griper BARA in när det behövs — annars: { "action": "none" }
- Du är ramverket som ger agenten frihet att vara sig själv

## Mission
ID: {{mission_id}}
Mål: {{mission_goal}}

## Aktuellt steg
Steg: {{current_stage}} ({{stage_index}}/{{total_stages}})
Mål: {{stage_goal}}
Uppgifter: {{stage_tasks}}
Slutförd: {{completed_tasks}}
Återstår: {{remaining_tasks}}

## Senaste transkript (sedan sista kontroll)
{{new_transcript_messages}}

## Interventionsregler
1. TASK_FORGOTTEN — Agent ej adresserat en uppgift på 3+ meddelanden → silent
2. REPETITION — Agent upprepar samma fras 2+ gånger → silent
3. BAD_AUDIO — Användare ohörbar / agent frågar "vad?" 2+ gånger → spoken
4. NOISE — Bakgrundsljud stör → spoken
5. WRONG_INFO — Faktiskt felaktig information → silent (korrigering)
6. OFF_TOPIC — Avvikit 3+ meddelanden → silent (påminnelse)
7. SILENCE — Ingen aktivitet 15+ sekunder → spoken (mjuk prompt)
8. STUCK — Agent kan ej gå vidare → silent (hjälp)
9. TASK_DONE — Uppgift tydligt avklarad → task_update
10. STAGE_READY — Alla uppgifter avklarade → silent (föreslå advance)

## Svarsformat
{ "action": "none" }
ELLER
{
  "action": "inject",
  "level": "silent" | "spoken" | "prompt_swap",
  "message": "...",
  "reason": "kort förklaring",
  "rule": "TASK_FORGOTTEN" | "REPETITION" | etc.
}
ELLER
{
  "action": "task_update",
  "task_id": "...",
  "status": "done" | "partial",
  "quality": 1-5,
  "notes": "..."
}
```

### Reflection prompt (post-session)

```
Du är reflektionsprocessen för Smartout AI-sessioner.
Analysera denna avslutade session och skapa en strukturerad rapport.

## Mission
{{mission_definition}}

## Fullständigt transkript
{{full_transcript}}

## Guardian-logg (interventioner under sessionen)
{{guardian_log}}

## Task-progress (guardians bedömning)
{{task_progress}}

## Analysera och rapportera

### Task Completion
För varje uppgift i missionen:
- Status: done / partial / missed
- Kvalitet: 1-5
- Notering: vad gick bra/dåligt

### Agent Assessment
- Ton och personlighet (0-10)
- Precision i informationsdelning (0-10)
- Naturlighet i samtalet (0-10)
- Effektivitet (genomförde uppgifterna utan onödiga omvägar) (0-10)

### User Experience
- Var användaren förvirrad någonstans?
- Engagemangsnivå
- Nöjdhetssignaler

### Prompt Suggestions
Konkreta, implementerbara ändringar i systemprompten:
- Vad bör läggas till?
- Vad bör tas bort?
- Vad bör omformuleras?
Motivera varje förslag med data från sessionen.

### Overall Score (0-10)
Sammanfattande bedömning med motivering.
```

---

## 6. Data Model

### Extend `engine_sessions`

| New field          | Type               | Purpose                                                 |
| ------------------ | ------------------ | ------------------------------------------------------- |
| `ultravox_call_id` | TEXT               | Links session → Ultravox call (for polling + injection) |
| `guardian_log`     | JSONB DEFAULT '[]' | All guardian interventions during session               |
| `task_progress`    | JSONB DEFAULT '{}' | Per-task: status, quality, notes                        |

### New table: `engine_session_report`

| Field                | Type                      | Purpose                             |
| -------------------- | ------------------------- | ----------------------------------- |
| `id`                 | UUID PK                   | —                                   |
| `session_id`         | UUID FK → engine_sessions | Which session                       |
| `mission_id`         | TEXT FK → engine_missions | Which mission                       |
| `workspace_id`       | UUID FK                   | Workspace isolation                 |
| `transcript`         | JSONB                     | Full transcript (archive)           |
| `task_results`       | JSONB                     | Per-task completion, quality, notes |
| `agent_assessment`   | JSONB                     | Behavior analysis                   |
| `user_experience`    | JSONB                     | Confusion, satisfaction, engagement |
| `prompt_suggestions` | JSONB DEFAULT '[]'        | Concrete prompt change proposals    |
| `overall_score`      | REAL                      | 0-10 summary score                  |
| `created_at`         | TIMESTAMPTZ               | —                                   |

### New table: `engine_prompt_evolution`

| Field            | Type        | Purpose                                    |
| ---------------- | ----------- | ------------------------------------------ |
| `id`             | UUID PK     | —                                          |
| `mission_id`     | TEXT FK     | Which mission                              |
| `version`        | INTEGER     | Version number                             |
| `system_prompt`  | TEXT        | Full prompt (this version)                 |
| `changes`        | JSONB       | What changed and why                       |
| `source_reports` | UUID[]      | Which session_reports motivated the change |
| `approved_by`    | UUID FK     | Admin who approved (NULL = suggestion)     |
| `approved_at`    | TIMESTAMPTZ | NULL = pending, timestamp = approved       |
| `created_at`     | TIMESTAMPTZ | —                                          |

### Evolution flow

```
Session → Report → prompt_suggestions
                 ↓
Multiple reports → Pattern identified
                 ↓
engine_prompt_evolution (version N+1, approved_by = NULL)
                 ↓
Admin approves → approved_at set
                 ↓
Next session uses version N+1
```

---

## 7. Integration Points

### All calls through Stage Engine

Currently `landing-demo` calls Ultravox directly. After this feature, ALL calls route through Stage Engine's `/adapters/ultravox/create-call` endpoint. This ensures:

- Guardian loop starts for every call
- Session is created for every call
- Tools (store/fetch/advance) are available for every call
- Transcript and task tracking work for every call

### Landing page change

```diff
- const apiEndpoint = "/api/wizard/start";  // direct to Ultravox
+ const apiEndpoint = "/api/wizard/engine-start";  // through Stage Engine
```

### Dashboard integration

New dashboard section: `/dashboard/ai/sessions`

- List of recent sessions with scores
- Click to view: full report, transcript, guardian log
- Prompt evolution: see version history, pending suggestions, approve/reject

---

## 8. Cost Estimate

| Component         | Per session (10 min)      | Monthly (100 sessions) |
| ----------------- | ------------------------- | ---------------------- |
| Guardian polling  | ~200 Haiku calls × $0.001 | ~$20                   |
| Reflection report | 1 Sonnet call × $0.01     | ~$1                    |
| Ultravox call     | ~$0.50 (voice minutes)    | ~$50                   |
| **Total**         | **~$0.52**                | **~$71**               |

---

## 9. Implementation Order

1. **DB migrations** — Add fields to engine_sessions, create engine_session_report and engine_prompt_evolution tables
2. **Guardian loop** — Transcript polling + Haiku analysis + intervention dispatcher in Stage Engine
3. **Ultravox injection** — POST /calls/{id}/messages integration
4. **Route all calls through Stage Engine** — Landing + onboarding switch to engine-start
5. **Reflection workflow** — Post-session analysis + report generation
6. **Dashboard UI** — Session reports, scores, transcript viewer
7. **Learning loop** — Pattern detection + prompt evolution suggestions
8. **Admin approval UI** — Review and approve prompt changes

---

## 10. Sources

- [Ultravox Data Messages & Protocol](https://docs.ultravox.ai/apps/datamessages)
- [Ultravox API Reference](https://fixie-ai.github.io/ultradox/)
- Stage Engine Trainer Guide: `docs/reference/STAGE_ENGINE_TRAINER_GUIDE.md`
- Stage Engine Breakdown: `services/stage-engine/BREAKDOWN.md`
