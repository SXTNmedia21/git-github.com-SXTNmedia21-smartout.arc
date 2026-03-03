---
title: "User Journey — Onboarding as Mission"
status: done
updated: 2026-03-19
created: 2026-03-19
module: ai
tags: [journey, onboarding, stage-engine, websocket, agent]
---

# User Journey — Onboarding as Mission

## Journey: Admin completes onboarding via voice agent (Lise)

**Precondition:** User has signed up and landed on the onboarding page. Stage Engine is running. Ultravox API key is configured.

1. User clicks "Start" on the onboarding hero section
2. Frontend calls `/api/wizard/start` which creates an engine session via Stage Engine
3. Stage Engine loads `onboarding-interview` mission with linked journey data
4. Ultravox call is created with stage-specific system prompt
5. Frontend connects WebSocket to `/ws/:sessionId` via `useJourneySocket` hook
6. Lise greets the user: "Heeei! Goy at du har kommet hit!"
7. As user provides info (name, business), Lise calls UI tools:
   - `fill_field("businessName", "Burger Bar")` — populates form in real-time
   - `navigate_to("business")` — scrolls to business section
   - `show_panel("keyFacts")` — displays confirmed facts panel
   - `addKeyFact("Navn", "Pontus")` — adds key fact to panel
8. Frontend receives UICommand events via WebSocket and executes them
9. When user manually changes a field, frontend sends UserAction via WebSocket
10. Stage Engine buffers user actions and injects them into agent's next turn
11. Lise advances through stages: greeting -> discovery -> confirm-business -> season -> departments -> wrapup
12. At each stage, agent has journey step context (screen, action, expects, dataReads, dataWrites)
13. Mission completes when all stages are done

**Postcondition:** Workspace is configured with business info, season, departments. Agent memories are persisted.

**Error paths:**

- WebSocket disconnects: frontend shows reconnecting state, agent continues via Ultravox
- Ultravox call fails: user sees error toast, can retry
- Stage Engine unreachable: `/api/wizard/start` returns error, user sees fallback UI
- Invalid JWT token: WebSocket closes with 4001 code

---

## Journey: Agent broadcasts UI commands during conversation

**Precondition:** Active engine session with WebSocket connection established.

1. Agent decides to navigate the user to a section (e.g., season setup)
2. Agent calls `navigate_to` tool with target "season"
3. Tool calls `ctx.broadcast()` with UICommand event
4. `broadcastToSession()` sends JSON to all WebSocket connections for this session
5. Frontend `useJourneySocket` hook receives the event via `onMessage`
6. `onCommand` callback triggers UI update (scroll, highlight, fill, etc.)
7. Frontend confirms action by sending UserAction back via WebSocket

**Postcondition:** User's screen reflects the agent's instruction.

**Error paths:**

- No WebSocket connections: broadcast is a no-op, agent continues normally
- Frontend ignores unknown command actions: gracefully skipped
- Malformed messages from frontend: Zod validation rejects, silently ignored

---

## Journey: Developer adds new UI tool to agent capability

**Precondition:** packages/ai and services/stage-engine are set up.

1. Developer creates new tool in `packages/ai/src/capabilities/ui/tools.ts` using `defineTool()`
2. Tool uses `ctx.broadcast?.()` to send UICommand events
3. Developer adds tool to the tools array in `packages/ai/src/capabilities/ui/index.ts`
4. Developer adds corresponding UICommand action to `packages/types/src/mission-protocol.ts`
5. Frontend handler in `useJourneySocket` `onCommand` callback processes the new action
6. Run `pnpm turbo typecheck` to verify

**Postcondition:** New tool available to any agent with UI capability enabled.

**Error paths:**

- Missing broadcast callback: tool returns result string but no event is sent (graceful degradation)
- Type mismatch: typecheck catches schema mismatches between protocol types and tool implementation
