---
title: "Onboarding as Mission — Design"
status: draft
updated: 2026-03-18
created: 2026-03-18
module: onboarding
tags: [stage-engine, websocket, agent, mission, journey, ui-interaction]
---

# Onboarding as Mission — Design

## Summary

Connect the Journey system (user's path) with the Mission system (agent's path) so the agent always knows what the user should be doing. Build a bidirectional WebSocket protocol between the Stage Engine and the frontend so the agent can interact with UI elements during any mission. Onboarding is the first consumer.

## Core Insight

| Concept     | What it defines                                                | Who it serves                     |
| ----------- | -------------------------------------------------------------- | --------------------------------- |
| **Journey** | The user's path: steps, screens, components, expected outcomes | The user (and the agent as a map) |
| **Mission** | The agent's behavior: instructions, personality, tools, goals  | The agent                         |

They are interconnected. A mission always references a journey. The journey is the definitive path the user takes; the mission is how the agent helps along that path.

When Lise spins up for onboarding:

1. She loads her **mission** → personality, tools, goals, stage instructions
2. She loads the **journey** → step-by-step map of what the user does, what screens they're on, what should happen

The agent doesn't guess — it reads the journey and knows exactly what the user should be doing at each point.

## Key Decisions

| Decision          | Choice                        | Rationale                                                             |
| ----------------- | ----------------------------- | --------------------------------------------------------------------- |
| Mission ↔ Journey | Linked via FK                 | Mission references journey. Stages reference steps. Agent loads both. |
| UI control        | Bidirectional                 | Agent drives UI + reacts to user actions                              |
| Scope             | Generic core, onboarding skin | Reusable protocol, domain-specific UI components                      |
| Transport         | WebSocket on Stage Engine     | Per PRD D13. Sub-50ms latency. Hono native support                    |
| Channel support   | Voice + text (user chooses)   | Channel-agnostic UI interaction layer                                 |
| State truth       | Client-first (React)          | Agent reads/writes state via tools, React is source of truth          |

## Architecture

```
                    Journey Portal (defines journeys)
                              │
                    journey + journey_step (user's map)
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Stage Engine (Hono, port 3000)                          │
│                                                          │
│  engine_missions ──FK──→ journey                         │
│  engine_stages   ──FK──→ journey_step                    │
│                                                          │
│  ┌─────────────────┐  ┌───────────────────────────────┐  │
│  │ /ws/:sessionId  │  │ Connection Manager             │  │
│  │ WebSocket route  │←→│ Map<sessionId, Set<WebSocket>>│  │
│  └─────────────────┘  └───────────┬───────────────────┘  │
│                                    │                      │
│  ┌─────────────────┐  ┌───────────▼───────────────────┐  │
│  │ Agent Router    │←→│ UI Capability                  │  │
│  │ (intent→tools)  │  │ navigate, fillField, highlight │  │
│  └─────────────────┘  │ showPanel, toast               │  │
│                        └──────────────────────────────┘  │
│  ┌─────────────────┐                                     │
│  │ Mission Manager │  Loads mission + journey together   │
│  │ (stage + step)  │  Agent knows user's path at all     │
│  └─────────────────┘  times                              │
└─────────────────────────────────────────────────────────┘
          │ WebSocket                    │ REST/Voice
          ▼                              ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  Frontend (Next.js)  │  │ Ultravox (voice) / Chat      │
│  useJourneySocket()  │  │ Agent input channel           │
│  React state = truth │  │                               │
└──────────────────────┘  └──────────────────────────────┘
```

## 1. Schema Changes — Mission ↔ Journey Link

### engine_missions gets journey_id

```sql
ALTER TABLE engine_missions
  ADD COLUMN journey_id uuid REFERENCES journey(journey_id);
```

When a mission is linked to a journey, the agent loads the full journey with steps at session start. This gives the agent the complete user path.

### engine_stages gets journey_step_id

```sql
ALTER TABLE engine_stages
  ADD COLUMN journey_step_id uuid REFERENCES journey_step(journey_step_id);
```

Each mission stage can map to one or more journey steps. When the agent is at a stage, it loads the corresponding journey step(s) and knows:

- `screen` → which route the user is on
- `component` → which UI component is active
- `action` → what the user should do
- `expects` → what the system should show
- `data_reads` / `data_writes` → what data is involved

### Example: Onboarding Mission

```
engine_missions:
  id: "onboarding-interview"
  journey_id: → journey("Sign Up & Create Workspace")

engine_stages:
  stage: "business"
  journey_step_id: → journey_step("User enters website URL")
  goal: "Help user provide company information"
  instructions: "Ask warmly, offer to scan website, use addKeyFact..."
  tools: [fillField, triggerScrape, showPanel, navigate]
```

The agent at stage "business" loads the journey step and knows:

- Screen: `/onboarding`
- Component: `BusinessSection`
- Action: "User enters website URL → clicks Scan & Generate"
- Expects: "System extracts company data"
- Data writes: `[company.name, company.org_number, company.website]`

## 2. WebSocket Protocol

Generic event types shared between Stage Engine and any frontend via `packages/types`:

### Agent → Frontend (UI Commands)

```typescript
type UICommand = {
  type: "ui_command";
  sessionId: string;
  command:
    | { action: "navigate"; target: string }
    | { action: "highlight"; target: string; duration?: number }
    | { action: "fill_field"; field: string; value: string }
    | { action: "show_panel"; panel: string; data?: Record<string, unknown> }
    | { action: "hide_panel"; panel: string }
    | { action: "toast"; message: string; variant?: "info" | "success" | "warning" }
    | { action: "custom"; name: string; payload: Record<string, unknown> };
  timestamp: number;
};
```

### Frontend → Agent (User Actions)

```typescript
type UserAction = {
  type: "user_action";
  sessionId: string;
  action:
    | { event: "field_changed"; field: string; value: string }
    | { event: "step_entered"; stepOrder: number; screen: string }
    | { event: "button_clicked"; button: string }
    | { event: "form_submitted"; form: string; data: Record<string, unknown> }
    | { event: "custom"; name: string; payload: Record<string, unknown> };
  timestamp: number;
};
```

### System Events

```typescript
type SystemEvent = {
  type: "session_state" | "agent_typing" | "error" | "journey_progress";
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: number;
};
```

The `custom` action is an escape hatch for domain-specific needs. The `journey_progress` system event tracks which journey step the user is on.

## 3. Stage Engine WebSocket Layer

### New Route

```
GET /ws/:sessionId → WebSocket upgrade
```

### Connection Lifecycle

1. Frontend connects with auth token (JWT in query param or cookie)
2. Stage Engine validates session ownership (workspace + profile match)
3. Connection stored in `ConnectionManager` (`Map<sessionId, Set<WebSocket>>`)
4. Agent tools call `broadcastToSession(sessionId, event)` to push UI commands
5. Frontend messages buffered and injected as context into agent's next turn
6. Disconnect on session expiry/abandon or client close

### New Files

| File                                                 | Purpose                                         |
| ---------------------------------------------------- | ----------------------------------------------- |
| `services/stage-engine/src/ws/connection-manager.ts` | Manage WebSocket connections per session        |
| `services/stage-engine/src/ws/protocol.ts`           | Event type definitions (mirrors packages/types) |
| `services/stage-engine/src/routes/ws.ts`             | WebSocket route handler with auth               |
| `packages/types/src/mission-protocol.ts`             | Shared types for frontend + backend             |

### UI Capability

New capability registered in `packages/ai/src/capabilities/`:

```typescript
const uiCapability: CapabilityDefinition = {
  name: "ui",
  tools: [navigateTool, highlightTool, fillFieldTool, showPanelTool, toastTool],
  readOnlyTools: [],
};
```

Each tool's `execute` function broadcasts a `UICommand` over WebSocket via the connection manager.

## 4. Mission Stages — Onboarding

6 stages, sequential mode. Each stage links to journey step(s):

| Stage ID     | Journey Steps                                 | Goal                                          | Agent Tools                                   |
| ------------ | --------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `hero`       | 1 (navigate to /onboarding)                   | Greet, set tone, explain process              | navigate, toast                               |
| `business`   | 2-5 (URL input, scan, auth, org verification) | Collect company info via scan or manual entry | fillField, navigate, showPanel, triggerScrape |
| `branding`   | 6-7 (branding, season education)              | Configure branding and introduce seasons      | fillField, showPanel                          |
| `structure`  | 8-11 (season, departments, teams, locations)  | Set up organizational structure               | fillField, showPanel, navigate                |
| `operations` | 12-13 (procedures, review)                    | Create procedures and review everything       | fillField, showPanel, navigate                |
| `activation` | 14-16 (finalize, invite, done)                | Activate workspace and invite team            | navigate, toast                               |

### Stage Advancement (Bidirectional)

- **Agent-initiated:** Agent calls `navigate({ target: "departments" })` → frontend scrolls/navigates. Stage Engine advances stage when journey step progress indicates it.
- **User-initiated:** User clicks next / scrolls → frontend sends `step_entered` event → Stage Engine advances mission stage to match.

### Per-Stage Context

When the agent enters a stage, it receives:

1. **Mission stage data:** goal, instructions, success_criteria, personality_override
2. **Journey step data:** action, expects, screen, component, data_reads, data_writes
3. **Available tools:** filtered by stage

This means the agent knows BOTH what to do (mission) and what the user should be doing (journey).

## 5. Frontend Integration

### Generic Hook (reusable by any mission)

```typescript
function useJourneySocket(sessionId: string): {
  sendAction: (action: UserAction["action"]) => void;
  lastCommand: UICommand | null;
  isConnected: boolean;
  journeyProgress: { currentStep: number; totalSteps: number };
};
```

### Onboarding Hook (domain-specific)

```typescript
function useOnboardingMission(sessionId: string): {
  reportFieldChange: (field: string, value: string) => void;
  reportStepEntered: (stepOrder: number) => void;
};
```

### What Changes in Existing Code

| File                   | Change                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| `useBotsson.ts`        | Voice mode: client tools emit WebSocket events instead of direct state mutation |
| `WizardContext.tsx`    | Connect `useJourneySocket`, bridge WebSocket events to wizard state             |
| Section components     | Add `onFieldChange` callbacks that report to agent                              |
| `useScrollProgress.ts` | Report `step_entered` events via WebSocket                                      |
| `page.tsx`             | Create mission session on mount, pass sessionId down                            |
| New: chat component    | Text mode input for non-voice users                                             |

### Channel Flows

**Voice mode (Lise):**

```
User speaks → Ultravox → /adapters/ultravox → agent processes
→ agent calls UI tool → WebSocket broadcast → frontend reacts
```

**Text mode:**

```
User types → POST /agent/chat → agent processes
→ agent calls UI tool → WebSocket broadcast → frontend reacts
```

Same UI interaction layer, different input channel.

## 6. Data Flow Example

User says "Vi heter Oslo Burger Bar" (voice or text):

1. Agent is at stage `business`, journey step says "User enters website URL" with data_writes: `[company.name]`
2. Agent classifies intent → business info update
3. Agent calls `fillField({ field: "businessName", value: "Oslo Burger Bar" })`
4. Tool broadcasts `UICommand` via WebSocket
5. Frontend receives, calls `setBusiness({ name: "Oslo Burger Bar" })`
6. Agent calls `showPanel("keyFacts", { label: "Bedrift", value: "Oslo Burger Bar" })`
7. Frontend shows key fact in panel
8. Agent knows from journey step that next expected action is "scan website" → proactively asks "Har dere en nettside jeg kan skanne?"
9. User provides URL → agent calls `triggerScrape`
10. Scrape results → agent fills multiple fields via `fillField` commands
11. Agent checks journey step success criteria → all data_writes filled → ready to advance

## 7. Migration Path

The existing onboarding (scroll-based, Ultravox-only, client tools) continues working. The new system is built alongside it:

1. **Phase 1:** Schema changes (journey_id on missions, journey_step_id on stages)
2. **Phase 2:** WebSocket layer in Stage Engine
3. **Phase 3:** UI capability + tools
4. **Phase 4:** Onboarding mission definition (6 stages linked to journey steps)
5. **Phase 5:** Frontend hooks + integration
6. **Phase 6:** Switch onboarding to new system, deprecate old Ultravox-only flow

## Non-Goals

- Multi-instance Stage Engine scaling (single instance for now)
- Server-side state management (client-first)
- Auto-generating missions from journeys (manual linking)
- Replacing the journey portal (it stays as the spec/tracking system)
