---
title: "AGENT_DRIVEN_UI_ARCHITECTURE"
status: draft
updated: 2026-04-10
created: 2026-03-01
module: ai
tags: []
---

# Agent-Driven Dynamic UI Architecture (v2)

This document defines the strict architectural patterns required to build highly dynamic, agent-controlled UI containers (like the Onboarding flow or Journey runners).

By decoupling specific aesthetics from the logic, this architecture allows us to **mass-produce** new pages, UI elements, and interactions that are instantly compatible with our AI agents and the Event Motor framework.

---

## 1. The Dual-Actor State Machine

A dynamic UI in Smartout is never a static form; it is a centralized state machine controlled by two independent actors:

1. **The User** (via standard DOM interactions: clicks, typing, scrolling)
2. **The Agent** (via a registered tool bridge that manipulates the same state)

To ensure synchronization, the architecture mandates a **Centralized Context Provider** (e.g., `DynamicJourneyContext`).

- Local component state (`useState` inside a specific input) is forbidden for data the agent needs to access.
- All data, navigational focus, and validation rules must live in the shared Context so the Agent can read and write to it simultaneously.

## 2. Decoupled Design Configuration (Templification)

To allow infinite aesthetic flexibility without breaking agent functionality, every major section or container must accept a `DesignConfig` object. This allows the system to instantly template and change the mood of a page.

### The `DesignConfig` Schema

Instead of hardcoding CSS classes, a container receives a state object defining its environment:

```typescript
interface DesignConfig {
  theme: {
    primaryColor: string; // Passed as CSS variable to children
    secondaryColor: string;
    backgroundMood: string; // Determines ambient background state
  };
  layout: {
    splitRatio: [number, number]; // e.g., [40, 60] for left/right split
    alignment: "center" | "start";
  };
  transitions: {
    entranceAnimation: string; // Identifier for the animation variant
    exitAnimation: string;
    durationMs: number;
  };
}
```

**Architectural Rule:** When the active step/section changes, the Context broadcasts the new `DesignConfig`. The wrapper component intercepts this and smoothly interpolates the CSS variables globally.

## 3. The Agent-UI Bridge (Tool Registry)

For an agent to control the UI frictionlessly, the UI must dynamically expose its capabilities as callable tools based on what is currently rendered.

### Dynamic Tool Registration

Components mount and unmount. When a component mounts, it registers its available actions to the active Agent Session (e.g., Ultravox connection).

- **Read Operations:** `getSectionState(sectionId)` — The agent requests the schema of the current UI (what fields exist, what is the validation requirement).
- **Write Operations:** `updateData(key, value)` — The agent writes directly to the Context.
- **Navigational Operations:** `advanceToNext()`, `scrollTo(elementId)` — The agent manipulates the UI viewport.

**CRITICAL UPGRADE (The "Agent-Generated UI" Hook):**
To support true AG-UDI (Agent-Generated UI) capabilities, the Tool Registry must include a `proposeComponentReplacement()` tool. If the Event Motor telemetry detects high user friction on a specific component, the Agent can dynamically swap out the component definition schema on the fly (e.g., replacing a dropdown with a radio-button group) and register the new interaction tools, without deploying code.

## 4. Interaction & Navigational Patterns

To allow the agent to guide the user seamlessly, the UI must support programmatic navigation that mirrors human interaction.

- **Scroll-Syncing:** The UI must observe an `activeSectionId` in the Context. If the Agent changes this ID, the UI automatically smooth-scrolls to bring that section into the viewport.
- **Focus Management (Agent Pointers):** If the Agent asks a question about a specific field (e.g., "What is your company's org number?"), the Agent can trigger a `highlightElement(fieldId)` event. The UI must respond by pulsing or focusing the requested element. _Upgrade: The agent should possess a literal "Cursor/Pointer" in the UI so the user can see exactly where the agent is "looking" or editing in real-time._
- **Progressive Disclosure:** UI elements should remain hidden or disabled until the Agent or User satisfies the previous step's requirements. This is calculated via a pure validation function in the Context.

## 5. Event Handling & Telemetry (The Event Bus)

To mass-produce UI elements that feed into the **Event Motor**, components must not directly call analytics APIs. Instead, the container implements a local Event Bus.

### Standardized Event Emitting

Every component wrap standard DOM events into Journey Events:

```typescript
type SystemEvent = {
  timestamp: number;
  actor: "user" | "agent" | "system";
  action:
    | "field_update"
    | "section_enter"
    | "validation_fail"
    | "tool_execution"
    | "agent_correction";
  targetId: string;
  metadata: Record<string, any>;
};
```

- When the user types, it emits `field_update`.
- When the agent auto-fills data, it emits `tool_execution` followed by `field_update`.
- **CRITICAL UPGRADE (The Conflict Event):** If the Agent auto-fills data and the User immediately deletes or changes it, the Event Bus must emit an `agent_correction` event. This is the highest-weight negative signal in the Vector Store, indicating the agent made a bad assumption.

## 6. Frictionless Scaling (Schema-Driven UI)

To rapidly build new journeys, the UI components themselves should be generated from a backend JSON schema rather than hardcoded React structures.

### The Component Factory Model

A Journey Definition from the database should define the UI:

```json
{
  "step_id": "collect_locations",
  "design_config": { "backgroundMood": "locations_active" },
  "elements": [
    { "type": "header", "content": "Where do you operate?" },
    { "type": "dynamic_list", "id": "locations_array", "schema": "location_obj" }
  ],
  "agent_context": "User must define at least one physical location."
}
```

A generic `<DynamicJourneyRenderer />` reads this JSON, applies the `DesignConfig` parameters, registers the required Agent Tools automatically, and mounts the standard inputs.

**Result:** A developer or platform admin can spin up an entirely new, fully agent-supported UI flow by writing a JSON definition in the database, requiring absolutely zero new frontend code deployments.
