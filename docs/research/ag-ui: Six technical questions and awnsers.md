# AG-UI: Six Technical Questions — Definitive Answers

> Research depth: protocol docs, npm package inspection, GitHub issues, DeepWiki source maps, and official AG2/CopilotKit blog posts. Each answer is rated by confidence level.

---

## Q1 — Voice + AG-UI coexistence

**Can AG-UI's HttpAgent run alongside a real-time voice stream (Ultravox/LiveKit)? Does AG-UI have audio event types?**

### Answer: AG-UI is voice-aware in spec but has no dedicated audio event types yet. Voice runs in parallel on a separate channel — they do NOT share a transport.

The AG-UI overview explicitly states:

> "Agents simultaneously mix structured + unstructured IO (e.g. text & voice, alongside tool calls and state updates)"

And the Codecademy reference lists "Multimodality support: Streams images, audio, and file attachments alongside text" as a feature. **However**, there are no `AUDIO_START`, `AUDIO_CHUNK`, or `AUDIO_END` event types in the current 17-event spec. The documented events are:

- Lifecycle: `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED`
- Text: `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`
- Tool calls: `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`
- State: `STATE_SNAPSHOT`, `STATE_DELTA`
- Special: `CUSTOM`, `REASONING_*`

Audio is described as a roadmap capability ("typed attachments and real-time media") not a shipped event type.

### The correct architecture for Smartout

Voice (Ultravox) and AG-UI run **side by side on separate channels** but share a **threadId**:

```
┌──────────────────────────────────┐
│  Browser                         │
│                                  │
│  Ultravox WS ─── voice audio ──► │ ─► Ultravox cloud
│                                  │
│  AG-UI SSE ─── text/tool events  │ ─► Your /api/agent endpoint
│                                  │
│  Shared: threadId, in-memory state│
└──────────────────────────────────┘
```

The bridge is: Ultravox's transcript arrives → you call `useCopilotChat().appendMessage()` (CopilotKit) or push a `TEXT_MESSAGE_*` sequence into the AG-UI event stream → the AG-UI agent sees it as a user message and fires tool calls → tool call events (`showNotepad`, `highlightComponent`) come back over the SSE channel → your React state updates → voice TTS response is sent to Ultravox.

**They don't share a transport. They share application state and threadId.**

### Gotcha

When Ultravox triggers a tool call natively (on its own voice turn), you need to bridge those tool call results back into the AG-UI state manually. There is no official Ultravox ↔ AG-UI adapter today.

**Confidence: High** — event type list confirmed from protocol docs + CopilotKit blog.

---

## Q2 — Client-only AG-UI (no backend server)

**Can HttpAgent / AbstractAgent run purely in the browser without a backend endpoint?**

### Answer: AbstractAgent middleware CAN run client-side. CopilotKit CANNOT. These are two different things.

The AG-UI protocol defines two integration patterns:

1. **HTTP Server pattern** — agent runs as a backend service, browser connects via SSE to `your-server.com/agent`
2. **Middleware pattern** — agent runs as a TypeScript class extending `AbstractAgent`, generating events in-process via an RxJS `Observable<BaseEvent>`, **no HTTP server required**

The middleware pattern explicitly runs wherever your JS runs — including in a browser:

```typescript
import { AbstractAgent, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";
import Anthropic from "@anthropic-ai/sdk";

class BrowserAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((observer) => {
      observer.next({ type: "RUN_STARTED", threadId: input.threadId, runId: input.runId });

      // Call Claude directly from browser (API key exposed — fine for showroom)
      const anthropic = new Anthropic({
        apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_KEY,
        dangerouslyAllowBrowser: true,
      });

      // Stream events from LLM → push to observer
      // RUN_STARTED → TEXT_MESSAGE_* → TOOL_CALL_* → STATE_DELTA → RUN_FINISHED

      observer.complete();
    });
  }
}
```

**CopilotKit, however, hardcodes a `runtimeUrl` backend requirement.** A GitHub discussion (#2210) titled "Support client-side AG-UI agent adapters without hosted CopilotKit runtime" confirms this is a known gap. The CopilotKit team's response:

> "Right now, CopilotKit assumes your agents run in a backend (the runtimeUrl). Running agents fully in the browser means no request validation, no secret handling — API keys would be exposed."

This is a security concern for production, but for the **showroom / demo context (ephemeral, no real secrets), it's totally acceptable**.

### For Smartout's showroom

Use raw `@ag-ui/client` (`AbstractAgent` subclass) **without CopilotKit**. Wire it directly to the Anthropic SDK with `dangerouslyAllowBrowser: true`. Your ephemeral state lives in the Observable stream + React state. No server needed.

For the full workspace (production), you'd keep the same `AbstractAgent` interface but route `run()` to a Next.js API route instead of calling the LLM directly from the browser.

**Confidence: High** — confirmed from DeepWiki source map of `@ag-ui/client/src/agent/abstract-agent.ts` and GitHub discussion #2210.

---

## Q3 — Duo agent protocol (two AG-UI agents, same session)

**Is there a documented pattern for two AG-UI agents communicating through shared state or event forwarding?**

### Answer: No first-class peer-to-peer pattern exists. There is an orchestrator workaround. Multi-agent is explicitly on the roadmap.

The AG2 engineering blog (Feb 2026) documents the current state most honestly:

> "Native multi-agent support is an active focus for us. We're working with the CopilotKit team on bringing first-class multi-agent patterns to the AG-UI protocol. If you're interested in this direction, watch the AG2 repository for updates."

The currently documented workaround is **orchestrator-based state sharing via `STATE_SNAPSHOT`**:

```
Agent A (voice conductor) ──► STATE_SNAPSHOT { active_agent: "scheduler" }
                                      │
                              Frontend reads active_agent
                                      │
Agent B (scheduler specialist) ◄── Frontend routes next run to Agent B
```

Agent A sets a flag in shared state. The frontend reads `active_agent` from the state snapshot and routes the next `runAgent()` call to Agent B. They don't communicate directly — the frontend is the broker.

CopilotKit's `open-multi-agent-canvas` example uses this pattern: multiple agents registered with separate `agentId`s, frontend switches between them via state, each shares the same `threadId` for context continuity.

### For Smartout's duo (Botsson voice + domain specialist)

```typescript
// threadId is the session identifier — both agents share it
const THREAD_ID = crypto.randomUUID();

// Agent A: Botsson (voice conductor)
const botsson = new HttpAgent({ url: "/api/agent/botsson" });

// Agent B: Shift specialist
const shiftAgent = new HttpAgent({ url: "/api/agent/shift" });

// Frontend state
const [activeAgent, setActiveAgent] = useState<"botsson" | "shift">("botsson");

// Botsson emits: STATE_DELTA { op: "replace", path: "/active_agent", value: "shift" }
// Frontend effect:
useEffect(() => {
  if (agentState.active_agent === "shift") {
    setActiveAgent("shift");
    // Route next user turn to shiftAgent
  }
}, [agentState.active_agent]);
```

Agents don't see each other's events directly — they share state through the common `threadId` message history that's passed as `input.messages` to each `run()` call.

**Confidence: High** — confirmed from AG2 blog (Feb 2026), CopilotKit multi-agent canvas repo, AG2 "Feedback Factory" example.

---

## Q4 — Frontend tool rendering lifecycle

**When `showNotepad` fires, does the rendered component persist after the run ends, or disappear?**

### Answer: Render persists in chat message list (tied to the ActionExecutionMessage). For overlay components outside the chat, you need a separate React state layer.

In CopilotKit's `useCopilotAction` / `useFrontendTool`, the render function is called with `status` values:

- `"inProgress"` — tool call started, args may be streaming
- `"executing"` — tool call being processed
- `"complete"` — tool finished, result available

The rendered output is **attached to the `ActionExecutionMessage` in CopilotKit's message list**, not to the run lifecycle. When `RUN_FINISHED` fires, the message list is preserved. So **yes, the render persists** — it stays visible in the chat/message history, frozen at `status === "complete"`.

Real evidence from GitHub issue #2266 — the `render` function is called with `status: "complete"` repeatedly as subsequent conversations reference the same message, confirming the component stays alive in the message store.

### The problem for Smartout

The Showroom isn't a chat list — it's an overlay on a dashboard. A notepad that "appears" when the agent calls `showNotepad` should persist as a **floating panel**, not in a chat message scroll.

The correct pattern:

```typescript
// 1. Agent tool call triggers handler — handler updates external React state
const [openPanels, setOpenPanels] = useState<Panel[]>([]);

useFrontendTool({
  name: "showNotepad",
  parameters: z.object({ title: z.string(), initialContent: z.string() }),
  handler: async ({ title, initialContent }) => {
    // This is the source of truth for overlay persistence
    setOpenPanels(prev => [...prev, { id: crypto.randomUUID(), type: "notepad", title, content: initialContent }]);
    return { opened: true };
  },
  render: ({ status }) => status === "executing" ? <span>Opening notepad...</span> : null,
  // render() is ephemeral inline feedback — external state is the persistent layer
});

// 2. Overlay renders from external state — fully independent of run lifecycle
<ShowroomOverlay>
  {openPanels.map(panel => <FloatingPanel key={panel.id} {...panel} />)}
</ShowroomOverlay>
```

The render function gives inline feedback during execution. The `setOpenPanels` call in the handler is what keeps the panel alive. These are two separate concerns.

**Confidence: High** — confirmed from useFrontendTool docs, GitHub #2266 behavior logs, AG2 UI patterns.

---

## Q5 — AG-UI standalone vs CopilotKit dependency

**Is `@ag-ui/client` truly standalone for React? What does it export?**

### Answer: @ag-ui/client is protocol-only. No React hooks, no provider, no UI. CopilotKit provides the React layer. You can use @ag-ui/client without CopilotKit, but you'll write all React integration yourself.

`@ag-ui/client` npm package description:

> "provides agent implementations that handle the full lifecycle of AG-UI communication: connecting to servers, processing streaming events, managing state mutations, and providing reactive subscriber hooks"

What it actually exports:

- `HttpAgent` — connects to an AG-UI server endpoint via SSE
- `AbstractAgent` — base class for custom/middleware agents
- `transformChunks` — converts chunk events to start/content/end triples
- `verifyEvents` — optional state machine validation
- `defaultApplyEvents` — applies event stream to a state object
- Event type definitions and TypeScript interfaces
- RxJS Observable-based streaming pipeline

**No React hooks. No React context. No provider. No UI components.**

`@ag-ui/core` is even more minimal — just event types, message models, and run input interfaces.

CopilotKit's `@copilotkit/react-core` is what adds:

- `CopilotKit` provider (React context)
- `useAgent` / `useCoAgent` hooks (React wrappers around `@ag-ui/client`)
- `useCopilotReadable`, `useCopilotAction`, `useFrontendTool`
- `useCopilotChat` (programmatic message control)

### For building without CopilotKit

Entirely feasible, but you're writing these yourself:

```typescript
// Your own React hook wrapping AbstractAgent
function useShowroomAgent(agent: AbstractAgent) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(
    async (userMessage: string) => {
      setIsRunning(true);
      const input: RunAgentInput = {
        threadId: THREAD_ID,
        runId: crypto.randomUUID(),
        messages: [...messages, { role: "user", content: userMessage }],
        tools: SHOWROOM_TOOLS,
        state,
      };

      agent.runAgent(input, {
        onEvent: (event) => {
          // Apply events to state
          const updated = defaultApplyEvents([event], { messages, state });
          setMessages(updated.messages);
          setState(updated.state);

          // Handle tool calls
          if (event.type === "TOOL_CALL_END") {
            handleToolCall(event);
          }
        },
        onComplete: () => setIsRunning(false),
      });
    },
    [messages, state],
  );

  return { messages, state, isRunning, run };
}
```

This is ~150 lines of boilerplate that CopilotKit already gives you. The tradeoff is full control vs time cost.

**Verdict for Smartout**: Use `@ag-ui/client` + `@copilotkit/react-core` (without `@copilotkit/react-ui`) if you want CopilotKit's hooks but your own overlay UI. Use raw `@ag-ui/client` alone only if you have strong reasons to avoid the CopilotKit dependency entirely.

**Confidence: High** — confirmed from npm package description, DeepWiki source map, GitHub discussion #2210.

---

## Q6 — State delta granularity and selective React re-renders

**Can `StateDeltaEvent` target `/notepad/0/text` and trigger only that component to re-render?**

### Answer: The JSON Patch can target any path. But CopilotKit's useCoAgent does NOT do selective re-renders — it applies full state replacement. Zustand with custom patch middleware is required for component-level granularity.

AG-UI's `STATE_DELTA` carries RFC 6902 JSON Patch operations:

```json
{
  "type": "STATE_DELTA",
  "delta": [{ "op": "replace", "path": "/notepad/0/text", "value": "New shift note content" }]
}
```

The patch can target any depth. **The path is just a string — the protocol doesn't know or care about React.**

What `defaultApplyEvents()` in `@ag-ui/client` does: it receives the full state object + a delta array, applies the JSON patch using a standard RFC 6902 implementation, and returns a **new state object**. This is a pure function — it produces a new reference for the entire state tree.

CopilotKit's `useCoAgent` calls something equivalent and sets the entire agent state via React state setter. This means **every component subscribed to the agent state re-renders** when any delta arrives — React's default reconciliation applies, but the state object reference is new, so all consumers re-render.

### For selective re-renders: use Zustand with path subscriptions

```typescript
// Store slice with Zustand
const useShowroomStore = create<ShowroomState>((set) => ({
  notepad: [{ id: "1", text: "" }],
  schedule: {},

  applyDelta: (patches: RFC6902Patch[]) => {
    set((state) => {
      // Apply patches surgically using fast-json-patch
      return applyPatch(state, patches).newDocument;
    });
  },
}));

// Component subscribes to ONLY /notepad/0/text
function NotepadItem({ id }: { id: string }) {
  // Zustand selector — only re-renders when this specific value changes
  const text = useShowroomStore(state => state.notepad.find(n => n.id === id)?.text);
  return <textarea value={text} />;
}

// In your AG-UI event handler
onEvent: (event) => {
  if (event.type === "STATE_DELTA") {
    useShowroomStore.getState().applyDelta(event.delta);
    // NotepadItem only re-renders if notepad[0].text actually changed
  }
}
```

With Zustand selectors, only components subscribed to the changed path re-render. This is the correct pattern for a showroom with many concurrently visible components.

Library: `fast-json-patch` (npm) applies RFC 6902 patches efficiently. Zustand's selector system handles the re-render scoping.

**Gotcha**: `applyPatch` from `fast-json-patch` mutates by default — pass `{ mutate: false }` or clone first to keep Zustand's immutability guarantees.

**Confidence: High** — confirmed from AG-UI source code (`@ag-ui/client/src/apply/default.ts`), RFC 6902 spec, Zustand selector documentation.

---

## Summary table

| #   | Question                  | Answer                                                                     | Custom work required?                                        |
| --- | ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Voice + AG-UI coexistence | Parallel channels, shared threadId. No audio event types in spec yet.      | Bridge: pipe Ultravox transcripts → AG-UI messages           |
| 2   | Client-only agent         | `AbstractAgent` middleware runs in-browser. CopilotKit requires a backend. | Use raw `@ag-ui/client` + `AbstractAgent` for showroom       |
| 3   | Duo agent protocol        | Orchestrator pattern via shared state. No P2P agent protocol yet.          | Frontend state broker between agents                         |
| 4   | Tool render lifecycle     | Persists in message list. Overlay panels need external React state.        | `handler()` → setState for persistent overlay panels         |
| 5   | AG-UI standalone          | `@ag-ui/client` is protocol-only, no React. CopilotKit provides hooks.     | Write own hooks (~150 lines) or accept CopilotKit dependency |
| 6   | State delta granularity   | Patches can target any path. CopilotKit doesn't do selective re-renders.   | Zustand + `fast-json-patch` + selectors                      |
