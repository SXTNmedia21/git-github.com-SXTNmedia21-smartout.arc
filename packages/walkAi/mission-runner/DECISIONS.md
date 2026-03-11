# Stage Engine — DECISIONS.md

> **Project:** Smartout Stage Engine (Universal Agent Gateway)
> **Date:** 2026-03-01
> **Status:** Discovery Complete — All decisions locked
> **Next:** Breakdown (Mode 2)

---

## Purpose

A universal, channel-agnostic stage engine that orchestrates any AI agent through defined missions and stages. The engine is a gateway — all agent communication (store, fetch, stage transitions, context) flows through it. Works across voice (Ultravox, LiveKit), SMS, chat, email, and autonomous Python agents.

---

## Locked Decisions

### D1: All tools go through the engine

Agents never call Supabase or external services directly. The engine is the single point of contact. This gives us validation, logging, and consistency for free.

### D2: MVP = two generic tools (store + fetch) with inbox model

`store` writes to a generic inbox table — not directly to specific entity tables. Data is structured and routed later. `fetch` retrieves context. These are the only two tools for MVP.

### D3: Sessions always start with identity + context

The engine must know who is talking (user_id, workspace_id, profile) before anything else. It loads context about that person and prepares it for the agent's first prompt.

### D4: The engine is a gateway

It sits between agents and everything else. Agents see only the engine. The engine sees Supabase, MCPs, external services. Nothing bypasses it.

### D5: Tech stack — Hono + Docker + Caddy on DigitalOcean

| Component     | Choice                       | Why                                          |
| ------------- | ---------------------------- | -------------------------------------------- |
| Runtime       | Hono (TypeScript)            | Lightweight, fast, same language as monorepo |
| Container     | Docker                       | Isolated, reproducible                       |
| Reverse proxy | Caddy                        | Free HTTPS, automatic SSL renewal            |
| Hosting       | DigitalOcean Droplet ($6/mo) | Simple, sufficient for gateway               |
| Database      | Supabase (external)          | Already exists, RLS, Realtime                |

### D6: Separate containers in shared Docker network

Stage Engine runs in its own container. Other microservices (MCPs, n8n) run in separate containers on the same Docker network. Internal communication via `http://service-name:port`. Caddy handles external HTTPS.

```
Docker network: smartout-internal
├── stage-engine (port 3000)
├── interview-mcp (port 3001)  ← future
├── salary-mcp (port 3002)     ← future
└── n8n (port 5678)            ← existing
```

### D7: Missions have modes — sequential, free, hybrid

- **Sequential:** Stages run in defined order. Agent must complete stage 1 before stage 2.
- **Free:** Agent sees all stages and chooses based on conversation.
- **Hybrid:** Fixed start/end but free stages in between.

All missions are saved — even ad-hoc/custom ones created at runtime.

### D8: Missions bind to context for auto-loading

Missions are linked to a context source (page URL, phone number, landing page, etc.). When a user navigates to `/dashboard/schedule`, the engine auto-loads the schedule-assistant mission. When a phone call comes in, the engine loads the mission based on caller + purpose.

### D9: Agent and Stage are separate layers

```
Agent (who):              Stage (the assignment):
├── Name                  ├── Goal
├── Voice                 ├── Perspective / attitude
├── Personality           ├── Emotions (frustration, joy...)
├── Tone                  ├── Rules (non-negotiable)
├── Agent DNA             ├── Creative freedom (temperature)
└── Identity              └── Escalation instructions
```

The agent is WHO. The stage is WHAT and HOW right now. A stage can temporarily adjust the agent's tone but never changes who the agent is.

### D10: Communication style = high stakes + creative freedom

Missions are framed as critical assignments — not bureaucratic forms. Rules are sacred and non-negotiable. But within those walls, the agent has freedom to be creative, motivating, and personal. Strict walls, free interior.

### D11: Stages can temporarily override tone but never identity

A stage can say "be frustrated here" or "be extra warm here" — but the agent remains itself. The personality layer is immutable during a session. The stage layer is ephemeral.

### D12: Observer = Director Agent (Python, fast model)

A background process that runs alongside every active session:

| Responsibility      | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| Sentiment analysis  | Continuous analysis on transcription                      |
| Summarization       | Rolling summary of the conversation                       |
| Knowledge assistant | Loads manuals/info when agent needs help                  |
| UI control          | Navigates pages, highlights elements, controls animations |
| Deferred messages   | Sends invisible instructions to the voice agent           |
| Data validation     | Double-checks that stored data is correct                 |

MVP Director: sentiment analysis + per-stage summarization + forced stage advances.
Future Director: UI control, knowledge loading, animations.

### D13: Director communicates two-way — frontend via WebSocket, agent via deferred messages

The director reads transcription/event logs and can:

- Send deferred messages to the agent (invisible to user)
- Send WebSocket events to the frontend (highlight, navigate, animate)
- The agent and frontend always know what the other is doing

### D14: Authentication via Supabase dual-auth (existing infrastructure)

Stage Engine uses the same auth as all Smartout services:

| Client              | Auth method                                           |
| ------------------- | ----------------------------------------------------- |
| Ultravox tools      | Service key (`smo_svc_live_*`) via `x-api-key` header |
| n8n workflows       | Service key (`smo_svc_live_*`)                        |
| Dashboard backend   | JWT (Supabase Auth) via Bearer token                  |
| Other microservices | Service key (internal Docker network + key)           |
| Health endpoint     | No auth (public, per Security Protocol §15.5)         |

Validation uses existing `platform_api_key` table with SHA-256 hash lookup. No custom auth logic — Supabase handles everything.

### D15: No new key prefixes

Stage Engine uses existing `smo_svc_live_*` keys for service-to-service auth. Follows Security Protocol — no invented prefixes.

---

## Architecture Summary

```
┌──────────────────────────────────────────────────┐
│           Stage Engine Gateway (Hono/DO)          │
│                                                    │
│  API: store / fetch / start / advance / status     │
│  Auth: Supabase dual-auth (JWT + service key)      │
│  Sessions: identity → context → mission → stages   │
│  Missions: sequential / free / hybrid              │
│  Context: auto-load by page/phone/channel          │
│                                                    │
└──────┬────────┬────────┬────────┬─────────────────┘
       │        │        │        │
  ┌────▼──┐ ┌──▼───┐ ┌──▼──┐ ┌──▼──────┐
  │Ultravox│ │LiveKit│ │ SMS │ │ Python  │
  │adapter │ │adapter│ │(n8n)│ │ agent   │
  └────────┘ └──────┘ └─────┘ └─────────┘

  ┌──────────────────────────────────────────────┐
  │  Director Agent (Python, fast model)          │
  │  MVP: sentiment + summarization + stage force │
  │  Future: UI control + knowledge + animations  │
  └──────────────────────────────────────────────┘
```

---

## Explicitly Out of Scope (MVP)

| Feature                                           | Revisit when                   |
| ------------------------------------------------- | ------------------------------ |
| Named tools (create_department, etc.)             | After inbox model is validated |
| Output generation (documents from collected data) | After store/fetch proven       |
| UI control from Director                          | After MVP Director works       |
| Knowledge loading from Director                   | After MVP Director works       |
| LiveKit adapter                                   | After Ultravox adapter works   |
| Python agent adapter                              | After one adapter works        |
| Multi-language prompts                            | After English/Norwegian works  |
| Analytics/completion tracking                     | After sessions are running     |
| Mission template marketplace                      | After custom missions work     |

---

## Reference Material

- Interview MCP source: `C:\Users\sxtnl\Dev\Genesis\mcp-servers\intervju-mcp\`
- Ultravox Call Stages: https://docs.ultravox.ai/agents/call-stages
- Ultravox Guiding Agents: https://docs.ultravox.ai/agents/guiding-agents
- Security Protocol: `docs/protocols/SECURITY.md`
- Secret API Infrastructure: `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`
- V1 Revised Architecture: `docs/architecture/SMARTOUT_V1_REVISED_ARCHITECTURE.md`

---

_All decisions locked. Ready for Breakdown._
