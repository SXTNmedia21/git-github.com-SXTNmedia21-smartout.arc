# Interview MCP — Voice Agent Orchestration

> External service hosted at `https://intervju-mcp.vercel.app`
> This folder is an **anchor point** — the service code lives in a separate repo.
> Configuration, missions, and integration docs live here.

---

## What It Does

The Interview MCP server manages voice agent sessions for Smartout.
It coordinates between the Smartout apps and Ultravox to start, track,
and log voice conversations with AI agents.

```
User clicks "Start conversation"
  → App calls POST /api/wizard/start
    → Route calls startMissionCall() from @smartout/ai/missions
      → Ultravox creates a WebRTC call with the mission's system prompt
        → User's browser joins via ultravox-client SDK
```

---

## Architecture

### Mission System (`@smartout/ai/missions`)

All agent personalities and prompts are defined in the monorepo at
`packages/ai/src/missions/`. This keeps voice agent configuration
version-controlled alongside the rest of the codebase.

| File                                   | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| `packages/ai/src/missions/types.ts`    | `AgentMission` type, `MissionId` enum       |
| `packages/ai/src/missions/registry.ts` | All mission definitions with system prompts |
| `packages/ai/src/missions/ultravox.ts` | `startMissionCall()` — Ultravox API wrapper |
| `packages/ai/src/missions/index.ts`    | Barrel exports                              |

### Available Missions

| ID                     | Agent           | Language | Used In        | Purpose                      |
| ---------------------- | --------------- | -------- | -------------- | ---------------------------- |
| `onboarding-interview` | Mr. Botsson     | NO       | Web onboarding | Maps org structure via voice |
| `landing-demo`         | Lise Botsson    | NO       | Landing page   | Demo — explains Smartout     |
| `mr-botsson`           | Mr. Botsson     | NO       | Dashboard AI   | General workspace assistant  |
| `haccp-inspector`      | HACCP Inspector | NO       | Operations     | Food safety checks           |
| `shift-assistant`      | Shift Assistant | NO       | Scheduling     | Shift planning help          |

### API Routes That Use Missions

| Route                    | App     | Default Mission |
| ------------------------ | ------- | --------------- |
| `POST /api/wizard/start` | landing | `landing-demo`  |
| `POST /api/wizard/start` | web     | `mr-botsson`    |

Both routes accept `{ mission_id: "..." }` in the request body to override.

---

## Environment Variables

| Variable                      | Required | Where     | Notes                                                               |
| ----------------------------- | -------- | --------- | ------------------------------------------------------------------- |
| `ULTRAVOX_API_KEY`            | Yes      | Both apps | Ultravox API key from ultravox.ai dashboard                         |
| `ULTRAVOX_AGENT_ID`           | No       | Both apps | Pre-configured agent ID (optional — inline prompts work without it) |
| `INTERVJU_MCP_WEBHOOK_SECRET` | No       | Landing   | Auth for the external MCP server                                    |

### Setup

1. Get an API key from [ultravox.ai](https://ultravox.ai)
2. Add to `apps/web/.env.local` and `apps/landing/.env.local`:
   ```
   ULTRAVOX_API_KEY=your_key_here
   ```
3. Store in 1Password under `Smartout > Ultravox API Key`

---

## Adding a New Mission

1. Add the mission ID to `MissionIdSchema` in `packages/ai/src/missions/types.ts`
2. Add the mission config to `MISSIONS` in `packages/ai/src/missions/registry.ts`
3. The mission is immediately available in both apps via `startMissionCall()`

Example:

```typescript
// In registry.ts
"my-new-mission": {
  id: "my-new-mission",
  name: "New Agent Name",
  description: "What this agent does",
  language: "no",
  voice: "mark",
  temperature: 0.4,
  maxDurationSeconds: 900,
  firstSpeaker: "agent",
  initialOutputMedium: "voice",
  systemPrompt: `Your system prompt here...`,
},
```

Then call it from any route:

```typescript
import { startMissionCall } from "@smartout/ai/missions";

const result = await startMissionCall({
  missionId: "my-new-mission",
  apiKey: process.env.ULTRAVOX_API_KEY,
});
```

---

## Ultravox SDK Reference

| Package           | Version | Purpose                                               |
| ----------------- | ------- | ----------------------------------------------------- |
| `ultravox-client` | ^0.5.0  | Browser WebRTC client (installed in landing + web)    |
| Ultravox API      | v0.7    | Server-side REST API (called from `startMissionCall`) |

### Key Ultravox Concepts

- **Agent**: A pre-configured voice personality in the Ultravox dashboard (optional)
- **Call**: A single voice session — created via API, joined via `ultravox-client`
- **System Prompt**: Defines agent behavior — sent inline or via agent config
- **Template Context**: Dynamic variables injected into the system prompt at call time
- **First Speaker**: Whether the agent or user speaks first

### Ultravox API Endpoints Used

| Endpoint                      | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `POST /api/calls`             | Create a call with inline system prompt    |
| `POST /api/agents/{id}/calls` | Create a call using a pre-configured agent |

---

## External MCP Server

The Interview MCP at `https://intervju-mcp.vercel.app` is a session tracking
service that logs voice conversations. It is **optional** — calls work without it.

| Endpoint                    | Purpose                          |
| --------------------------- | -------------------------------- |
| `POST /api/interview/start` | Register a new interview session |

The MCP server returns a `session_id` that gets attached to the Ultravox call
metadata for tracking purposes.

---

## Troubleshooting

**"Voice assistant is not configured"**
→ `ULTRAVOX_API_KEY` is not set in `.env.local`

**Call connects but agent doesn't speak**
→ Check `firstSpeaker` setting in the mission config
→ Verify the Ultravox API key is valid (not expired/rotated)

**"Unknown mission" error**
→ The `mission_id` sent in the request body doesn't match any key in `MISSIONS`
→ Check `packages/ai/src/missions/registry.ts` for available IDs

**Swedish fallback message appears**
→ The API route returned an error — check browser console for the response
→ Usually means `ULTRAVOX_API_KEY` is missing or the Ultravox API is down
