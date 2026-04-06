---
title: "Blueprint — Environment & UI Control for Botsson"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: Botsson
tags: [blueprint, environment, ui-control, tools]
---

# Blueprint — Environment & UI Control for Botsson

How Botsson agents perceive, query, and manipulate the user interface. Covers the current Smartout patterns, their gaps, and the unified architecture Botsson needs.

---

## 1. Current State: How Agents See and Control UI

Three distinct patterns exist in the Smartout codebase today. Each solves a specific problem but none provides a general-purpose environment layer.

### 1.1 Onboarding Wizard — Client-Side Tool Registration

**Files:**

- `apps/web/src/app/onboarding/hooks/useBotsson.ts`
- `apps/web/src/app/onboarding/hooks/useScrollProgress.ts`

**Pattern:**
The onboarding wizard uses Ultravox `temporaryTool` registration to give the voice agent direct access to page-specific actions. The hook `useBotsson` defines 13 client tools and registers their implementations on the `UltravoxSession`:

| Tool                   | Purpose                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `getOnboardingState`   | Returns full wizard state as JSON (section, business data, season, departments, scrape status) |
| `updateBusiness`       | Patches business fields (name, orgNumber, website, etc.)                                       |
| `updateSeason`         | Patches season fields (name, startDate, endDate)                                               |
| `addDepartments`       | Adds department names to wizard state                                                          |
| `addLocations`         | Adds location objects with name and type                                                       |
| `addZones`             | Adds zones within a specific location                                                          |
| `addProcedures`        | Enables/creates procedures by name                                                             |
| `searchCompany`        | Searches Bronnøysundregistrene via API                                                         |
| `identifyCompany`      | Confirms company by org number, creates workspace                                              |
| `scrapeWebsite`        | Scrapes URL for contact info, locations, departments                                           |
| `advanceToNextSection` | Scrolls to next section                                                                        |
| `addKeyFact`           | Adds fact to visual panel (top-left key facts card)                                            |
| `saveMemory`           | Persists agent memory (constant or temporal)                                                   |
| `finalizeOnboarding`   | Activates workspace and redirects to dashboard                                                 |

**Section navigation** uses `data-section` attributes on DOM elements. `useScrollProgress` creates an `IntersectionObserver` (threshold 0.5) on a scroll container, reading `data-section` from intersecting elements to track which section is active. The `scrollToSection` callback uses `querySelector('[data-section="..."]')` + `scrollIntoView`.

**How the agent "sees" the page:** It calls `getOnboardingState` which returns a serialized snapshot of the React state. This is domain-specific — the function is hardcoded to return onboarding fields. The agent has no way to discover what UI elements exist on screen.

### 1.2 UI Capability Tools — Broadcast-Based Commands

**Files:**

- `packages/ai/src/capabilities/ui/tools.ts`
- `packages/ai/src/capabilities/ui/index.ts`

**Pattern:**
Five tools registered in the capability system, designed for the Stage Engine (server-side agent). They communicate with the client via a `broadcast` callback injected through `UIToolContext`:

| Tool                | Action                                         | Parameters                          |
| ------------------- | ---------------------------------------------- | ----------------------------------- |
| `navigate_to`       | Sends `ui_command` with `action: "navigate"`   | `target` (section/step ID)          |
| `fill_field`        | Sends `ui_command` with `action: "fill_field"` | `field`, `value`                    |
| `highlight_element` | Sends `ui_command` with `action: "highlight"`  | `target` (CSS selector), `duration` |
| `show_panel`        | Sends `ui_command` with `action: "show_panel"` | `panel` name, `data` object         |
| `show_toast`        | Sends `ui_command` with `action: "toast"`      | `message`, `variant`                |

**Key characteristic:** These are fire-and-forget. The agent sends a command but gets no confirmation that the UI actually executed it. The return value is always a static string like `"Navigated to ${target}"` regardless of whether navigation succeeded.

**No read path:** None of these tools let the agent query current UI state. The agent must know the target IDs and field names in advance — they are baked into the system prompt.

### 1.3 Agent SDK Pattern — Dashboard Tools

The Stage Engine agents (`packages/ai/src/agents/`) use the capability registry to get tools. For UI interaction on the dashboard, the same `navigate_to` tool from the UI capability is available. The agent architecture defines authority levels (`autonomous`, `confirm`, `suggest`, `read_only`, `disabled`) per capability, but the UI capability has no authority gating — all tools are always available.

### 1.4 Client Tool Registration Lifecycle (Ultravox)

The `useBotsson` hook follows this lifecycle:

```
1. Component mounts → useBotsson(actions) called
2. User clicks "Start" → startSession()
3. New UltravoxSession created
4. 13 tools registered via session.registerToolImplementation(name, handler)
5. POST /api/wizard/start with CLIENT_TOOLS definitions (schema only)
6. Ultravox server receives tool schemas, can invoke them
7. Agent calls tool → Ultravox invokes client handler → handler calls actions ref → returns JSON
8. Session ends → leaveCall() + cleanup
```

The `actionsRef` pattern ensures tool handlers always reference the latest React state without causing re-registration.

---

## 2. Gaps Botsson Must Fill

### 2.1 Environment Awareness

**Gap:** No generic `getUIEnvironment` tool exists. The agent cannot ask "what is currently on screen?" outside the onboarding wizard. `getOnboardingState` is hardcoded to onboarding fields.

**Impact:** Every new page that wants agent interaction must build its own state-reader tool from scratch. There is no shared contract for "here is what the user sees."

### 2.2 Element Discovery

**Gap:** No semantic query system. The agent cannot ask "find all buttons on this page" or "what form fields are visible." The `highlight_element` tool requires a CSS selector the agent must already know.

**Impact:** Agents cannot adapt to dynamic UIs. If a component conditionally renders, the agent has no way to discover it appeared.

### 2.3 UI State Queries

**Gap:** No generic state introspection. The agent cannot ask "is this field filled?" or "what value is in the company name input?" The onboarding wizard returns full state, but that is the only page with this capability.

**Impact:** The agent cannot verify its own actions. After calling `fill_field`, it cannot confirm the value was actually set.

### 2.4 Guided Interaction

**Gap:** No step-by-step guidance system. The agent can highlight an element and navigate to a section, but cannot create a guided walkthrough (step 1, step 2, step 3 with progress tracking). `advanceToNextSection` is onboarding-specific.

**Impact:** Training scenarios (Botsson's core use case) need guided flows where the agent walks the employee through a multi-step procedure.

### 2.5 Form Discovery

**Gap:** No form schema introspection. The agent cannot ask "what fields does this form have?" or "which fields are required?" It must have this information pre-encoded in the system prompt.

**Impact:** Adding a new form field requires updating the system prompt. The UI and the agent's knowledge of the UI drift apart.

### 2.6 Action Verification

**Gap:** Broadcast tools are fire-and-forget. The agent gets `"Navigated to departments"` even if the navigation failed or the element does not exist. No ack/nack protocol.

**Impact:** The agent builds on false assumptions. It believes it navigated somewhere but the user is still on the previous section.

### 2.7 Cross-Channel Consistency

**Gap:** Voice (Ultravox) and text (future AG-UI/CopilotKit) channels use completely different tool registration patterns. Voice uses `temporaryTool` with client-side handlers. The capability system uses server-side broadcast. There is no shared tool definition layer.

**Impact:** Every tool must be defined twice — once for voice, once for text. Behavior divergence is inevitable.

---

## 3. Unified Architecture

### 3.1 Four-Layer Model

```
┌─────────────────────────────────────────────────────┐
│  Agent (voice or text)                              │
│  - Calls tools by name                              │
│  - Receives structured JSON responses               │
├─────────────────────────────────────────────────────┤
│  Tool Handlers (Botsson/src/tools/)                  │
│  - Framework-agnostic tool definitions              │
│  - Zod schemas for input validation                 │
│  - Adapters for Ultravox / AG-UI / CopilotKit       │
├─────────────────────────────────────────────────────┤
│  UI Bridge (Botsson/src/bridge/)                     │
│  - Request/response protocol (not fire-and-forget)  │
│  - Serializes UI queries and commands               │
│  - Handles ack/timeout/error                        │
├─────────────────────────────────────────────────────┤
│  Environment Map (Botsson/src/environment/)          │
│  - useEnvironmentMap hook                           │
│  - Semantic element registry                        │
│  - State snapshot provider                          │
│  - Action enumeration                               │
└─────────────────────────────────────────────────────┘
```

The agent never touches the DOM. It calls tool handlers. Tool handlers send requests through the UI Bridge. The bridge communicates with the Environment Map running in the client. The Environment Map reads the DOM, component state, and semantic tags to build responses.

### 3.2 Semantic Element Tagging

Components opt in to agent visibility by adding data attributes:

| Attribute              | Purpose                                 | Example                                                           |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `data-Botsson-id`      | Unique stable identifier                | `"company-name-input"`                                            |
| `data-Botsson-intent`  | What this element does (human-readable) | `"Enter the company name"`                                        |
| `data-Botsson-type`    | Element category                        | `"input"`, `"button"`, `"section"`, `"form"`, `"panel"`, `"list"` |
| `data-Botsson-context` | Serialized context JSON                 | `'{"required":true,"fieldType":"text","maxLength":100}'`          |

**Naming convention:** `data-Botsson-id` values use kebab-case: `{page}-{component}-{element}`. Examples:

- `onboarding-business-name-input`
- `dashboard-schedule-add-shift-button`
- `training-protocol-step-3`

**Why data attributes, not a React context registry:** Data attributes work across frameworks (React, vanilla, future mobile webview). They survive SSR. They are queryable from the Environment Map hook via `querySelectorAll`. And they align with Playwright selectors (see section 5.3).

### 3.3 Core Tool Set (16 tools)

#### Environment Awareness (4 tools)

| Tool              | Description                                                                                                               | Returns                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `getEnvironment`  | Full snapshot of current page: URL, active section, visible elements (id + intent + type), form states, available actions | `EnvironmentSnapshot`                                            |
| `findElements`    | Query elements by type, intent keyword, or id pattern                                                                     | `ElementMatch[]` with id, intent, type, visibility, interactable |
| `getElementState` | Get detailed state of a specific element: value, checked, disabled, validation errors                                     | `ElementState`                                                   |
| `getFormSchema`   | Get all fields of a form: names, types, required, current values, validation rules                                        | `FormSchema`                                                     |

#### Interaction (4 tools)

| Tool           | Description                                                   | Returns                                    |
| -------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `clickElement` | Click a button, link, or interactive element by Botsson-id    | `{ success, resultingState? }`             |
| `fillField`    | Set a form field value by Botsson-id                          | `{ success, previousValue, newValue }`     |
| `selectOption` | Select from dropdown/radio/checkbox by Botsson-id + value     | `{ success, selectedValue }`               |
| `navigate`     | Navigate to a page route or scroll to a section by Botsson-id | `{ success, currentRoute, activeSection }` |

#### Visual Guidance (5 tools)

| Tool           | Description                                            | Returns                                |
| -------------- | ------------------------------------------------------ | -------------------------------------- |
| `highlight`    | Highlight element(s) with pulse/glow animation         | `{ success, elementCount }`            |
| `showTooltip`  | Attach a tooltip to an element with instructional text | `{ success }`                          |
| `startGuide`   | Begin a multi-step guided walkthrough                  | `{ guideId, totalSteps, currentStep }` |
| `advanceGuide` | Move to next step in active guide                      | `{ guideId, currentStep, isComplete }` |
| `dismissGuide` | End an active guide                                    | `{ success }`                          |

#### Wait & Listen (3 tools)

| Tool             | Description                                                                   | Returns                             |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| `waitForElement` | Block until an element with Botsson-id appears or becomes visible (timeout)   | `{ found, timedOut, element? }`     |
| `waitForValue`   | Block until a field reaches a specific value or matches a pattern             | `{ matched, currentValue }`         |
| `onUserAction`   | Register a one-shot listener for click/input/navigation on a specific element | `{ actionType, elementId, value? }` |

### 3.4 Environment Map Hook

```typescript
// Botsson/src/environment/useEnvironmentMap.ts

type EnvironmentSnapshot = {
  route: string;
  pageTitle: string;
  activeSection: string | null;
  elements: SemanticElement[];
  forms: FormSnapshot[];
  actions: AvailableAction[];
  timestamp: number;
};

type SemanticElement = {
  id: string; // data-Botsson-id
  intent: string; // data-Botsson-intent
  type: string; // data-Botsson-type
  visible: boolean; // IntersectionObserver
  interactable: boolean; // not disabled, not aria-hidden
  context: Record<string, unknown>; // parsed data-Botsson-context
  rect: { top: number; left: number; width: number; height: number };
};

type FormSnapshot = {
  formId: string;
  fields: {
    id: string;
    name: string;
    type: string;
    value: string;
    required: boolean;
    valid: boolean;
    errorMessage?: string;
  }[];
  isValid: boolean;
  isDirty: boolean;
};

type AvailableAction = {
  elementId: string;
  actionType: "click" | "fill" | "select" | "navigate";
  label: string;
};
```

**How it works:**

1. On mount, `useEnvironmentMap` scans the DOM for all `[data-Botsson-id]` elements
2. An `IntersectionObserver` tracks visibility of each tagged element
3. A `MutationObserver` watches for added/removed tagged elements (dynamic renders)
4. Form state is read from tagged `<form>` elements using `FormData` + validation API
5. The snapshot is rebuilt on every mutation/intersection change (debounced 100ms)
6. The bridge layer can request the latest snapshot synchronously

**Performance guardrails:**

- Only tagged elements are tracked (opt-in, not whole DOM)
- Snapshot rebuild is debounced
- Element rect positions are only recalculated on explicit `getEnvironment` calls, not on every mutation
- Maximum 500 tracked elements (warn if exceeded)

---

## 4. Tool Handler Implementation

### 4.1 Factory Pattern

```typescript
// Botsson/src/tools/createUIHandlers.ts

type UIBridge = {
  getSnapshot: () => EnvironmentSnapshot;
  executeCommand: (command: UICommand) => Promise<UICommandResult>;
  waitFor: (condition: WaitCondition, timeoutMs: number) => Promise<WaitResult>;
};

function createUIHandlers(bridge: UIBridge) {
  return {
    getEnvironment: defineTool({
      name: "getEnvironment",
      description: "Get a snapshot of what is currently visible on the user's screen.",
      schema: z.object({
        includeOffscreen: z
          .boolean()
          .optional()
          .describe("Include elements not currently in viewport (default: false)"),
      }),
      execute: async ({ includeOffscreen }) => {
        const snapshot = bridge.getSnapshot();
        const elements = includeOffscreen
          ? snapshot.elements
          : snapshot.elements.filter((e) => e.visible);
        return JSON.stringify({ ...snapshot, elements });
      },
    }),

    findElements: defineTool({
      name: "findElements",
      description: "Search for UI elements by type, intent keyword, or id pattern.",
      schema: z.object({
        type: z
          .string()
          .optional()
          .describe("Filter by element type: input, button, section, form, panel, list"),
        intentKeyword: z
          .string()
          .optional()
          .describe("Keyword to match in element intent description"),
        idPattern: z.string().optional().describe("Glob or substring to match against element IDs"),
      }),
      execute: async ({ type, intentKeyword, idPattern }) => {
        const snapshot = bridge.getSnapshot();
        let matches = snapshot.elements;
        if (type) matches = matches.filter((e) => e.type === type);
        if (intentKeyword)
          matches = matches.filter((e) =>
            e.intent.toLowerCase().includes(intentKeyword.toLowerCase()),
          );
        if (idPattern) matches = matches.filter((e) => e.id.includes(idPattern));
        return JSON.stringify({ count: matches.length, elements: matches });
      },
    }),

    clickElement: defineTool({
      name: "clickElement",
      description: "Click a button, link, or interactive element.",
      schema: z.object({
        elementId: z.string().describe("The data-Botsson-id of the element to click"),
      }),
      execute: async ({ elementId }) => {
        const result = await bridge.executeCommand({
          action: "click",
          targetId: elementId,
        });
        return JSON.stringify(result);
      },
    }),

    fillField: defineTool({
      name: "fillField",
      description: "Set the value of a form field.",
      schema: z.object({
        elementId: z.string().describe("The data-Botsson-id of the input field"),
        value: z.string().describe("The value to set"),
      }),
      execute: async ({ elementId, value }) => {
        const result = await bridge.executeCommand({
          action: "fill",
          targetId: elementId,
          value,
        });
        return JSON.stringify(result);
      },
    }),

    navigate: defineTool({
      name: "navigate",
      description: "Navigate to a page or scroll to a section.",
      schema: z.object({
        target: z
          .string()
          .describe("Route path (e.g. '/dashboard/schedule') or Botsson-id of a section"),
      }),
      execute: async ({ target }) => {
        const result = await bridge.executeCommand({
          action: "navigate",
          target,
        });
        return JSON.stringify(result);
      },
    }),

    startGuide: defineTool({
      name: "startGuide",
      description:
        "Start a multi-step guided walkthrough. Define the steps with element IDs and instructions.",
      schema: z.object({
        steps: z.array(
          z.object({
            elementId: z.string().describe("Element to focus on"),
            instruction: z.string().describe("What to tell the user"),
            waitForAction: z
              .boolean()
              .optional()
              .describe("Wait for user to interact before advancing"),
          }),
        ),
      }),
      execute: async ({ steps }) => {
        const result = await bridge.executeCommand({
          action: "start_guide",
          steps,
        });
        return JSON.stringify(result);
      },
    }),
  };
}
```

### 4.2 Request/Response Protocol

Unlike the current fire-and-forget broadcast, the UI Bridge uses a request/response protocol:

```typescript
type UICommand = {
  id: string; // UUID, for correlating response
  action: string;
  targetId?: string;
  value?: string;
  target?: string;
  steps?: GuideStep[];
};

type UICommandResult = {
  id: string; // Matches command ID
  success: boolean;
  error?: string; // Why it failed (element not found, disabled, etc.)
  data?: Record<string, unknown>; // Action-specific result data
};
```

**Transport options:**

- **Same-process (client tools):** Direct function call through the bridge interface
- **Cross-process (server agent):** WebSocket or Supabase Realtime channel with command/response correlation by ID
- **Timeout:** All commands timeout after 5 seconds. Agent receives `{ success: false, error: "timeout" }`

---

## 5. Integration Points

### 5.1 Ultravox Voice Integration

Botsson tools are registered as Ultravox `temporaryTool` definitions, same as the current onboarding pattern. The difference: tool handlers call through the UI Bridge instead of directly manipulating React state.

```
Ultravox agent calls tool
  → Client receives invocation
  → Handler calls bridge.executeCommand()
  → Bridge calls Environment Map
  → Environment Map executes DOM action
  → Result flows back through bridge
  → Handler returns JSON to Ultravox
```

The `useBotsson` pattern (actionsRef for stable references, registerToolImplementation lifecycle) is preserved. The change is what happens inside the handler.

### 5.2 AG-UI / CopilotKit Text Integration

Text-based agents use the same tool definitions but through a different transport. AG-UI runs tools server-side with results streamed to the client. The bridge operates over WebSocket:

```
AG-UI agent calls tool (server)
  → WebSocket message to client
  → Client bridge receives command
  → Environment Map executes
  → Result sent back via WebSocket
  → AG-UI receives response
```

Same tool definitions, same Environment Map, different transport.

### 5.3 Playwright E2E Alignment

`data-Botsson-id` attributes double as Playwright selectors:

```typescript
// E2E test
await page.locator('[data-Botsson-id="onboarding-business-name-input"]').fill("Sjøbris");

// Agent tool call
fillField({ elementId: "onboarding-business-name-input", value: "Sjøbris" });
```

Same identifiers, same semantics. When an agent walkthrough works, the equivalent Playwright test works. When a Playwright test breaks, the agent walkthrough is also broken. One set of IDs to maintain.

---

## 6. Proposed File Structure

```
packages/Botsson/src/
├── environment/
│   ├── useEnvironmentMap.ts       # Core hook: IntersectionObserver + MutationObserver + snapshot
│   ├── types.ts                   # EnvironmentSnapshot, SemanticElement, FormSnapshot
│   ├── element-registry.ts        # DOM scanning, attribute parsing, element tracking
│   └── form-inspector.ts          # Form state extraction (fields, values, validation)
│
├── bridge/
│   ├── types.ts                   # UICommand, UICommandResult, WaitCondition
│   ├── client-bridge.ts           # Same-process bridge (client tools)
│   ├── ws-bridge.ts               # WebSocket bridge (server agents)
│   └── command-executor.ts        # Executes commands against the DOM (click, fill, scroll)
│
├── tools/
│   ├── createUIHandlers.ts        # Factory: bridge → tool definitions
│   ├── environment-tools.ts       # getEnvironment, findElements, getElementState, getFormSchema
│   ├── interaction-tools.ts       # clickElement, fillField, selectOption, navigate
│   ├── guidance-tools.ts          # highlight, showTooltip, startGuide, advanceGuide, dismissGuide
│   └── wait-tools.ts              # waitForElement, waitForValue, onUserAction
│
├── adapters/
│   ├── ultravox.ts                # Convert tool definitions → Ultravox temporaryTool format
│   ├── ag-ui.ts                   # Convert tool definitions → AG-UI tool format
│   └── copilotkit.ts              # Convert tool definitions → CopilotKit action format
│
├── guides/
│   ├── guide-engine.ts            # Multi-step walkthrough state machine
│   ├── guide-overlay.tsx          # React overlay component (spotlight + tooltip)
│   └── types.ts                   # GuideStep, GuideState
│
└── index.ts                       # Public API exports
```

---

## 7. Current vs Proposed

| Dimension                 | Current (Smartout)                                           | Proposed (Botsson)                                                 |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Environment awareness** | `getOnboardingState` — hardcoded to one page                 | `getEnvironment` — generic, works on any tagged page               |
| **Element discovery**     | None. Agent must know IDs in advance                         | `findElements` — query by type, intent, id pattern                 |
| **State queries**         | Full state dump (onboarding only)                            | `getElementState`, `getFormSchema` — per-element, per-form         |
| **Interaction**           | `fill_field` (broadcast, no ack)                             | `fillField` (bridge, ack + previous/new value)                     |
| **Navigation**            | `navigate_to` (broadcast, no ack)                            | `navigate` (bridge, ack + resulting route/section)                 |
| **Visual guidance**       | `highlight_element`, `show_panel`                            | `highlight`, `showTooltip`, `startGuide` (multi-step walkthroughs) |
| **Verification**          | None. Always returns success string                          | Every command returns `{ success, error?, data? }`                 |
| **Guided flows**          | `advanceToNextSection` (onboarding-specific)                 | `startGuide` / `advanceGuide` / `dismissGuide` (generic)           |
| **Form introspection**    | None                                                         | `getFormSchema` — fields, types, required, values, validation      |
| **Wait/listen**           | None                                                         | `waitForElement`, `waitForValue`, `onUserAction`                   |
| **Element tagging**       | `data-section` (onboarding only)                             | `data-Botsson-id/intent/type/context` (all pages)                  |
| **Transport**             | Broadcast (fire-and-forget) or direct function call          | Bridge with request/response correlation                           |
| **Multi-channel**         | Ultravox (voice) and capability system (server) are separate | Single tool definition set, adapters per channel                   |
| **E2E alignment**         | `data-section` for scroll tracking only                      | `data-Botsson-id` used by both agent and Playwright                |
| **Tool count**            | 5 (UI capability) + 13 (onboarding client tools)             | 16 unified tools covering all scenarios                            |
| **Authority gating**      | None on UI capability                                        | Per-tool authority levels inherited from capability system         |

---

## Open Questions

1. **Snapshot size** — Full `getEnvironment` on a complex dashboard page could return hundreds of elements. Should we paginate, or is filtering via `findElements` sufficient?
2. **React state vs DOM** — Form values can be read from DOM (`input.value`) but React-controlled components may have state that differs from DOM. Should the Environment Map also hook into React internals (fiber tree)?
3. **Mobile (React Native)** — Data attributes are web-only. React Native would need an equivalent registry pattern using `accessibilityLabel` or a custom native module. Defer or design now?
4. **Latency budget** — Voice interactions need sub-200ms tool responses. Is DOM scanning + snapshot serialization fast enough, or do we need a pre-built index?
5. **Guide overlay z-index** — The spotlight/tooltip overlay must render above all app content but below modals. Need a z-index contract with the design system.
