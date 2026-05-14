"use client";

/**
 * BotssonChat — Admin chat surface for Mr. Botsson.
 *
 * Renders a typed-input chat that talks to /api/botsson/chat. Each user message triggers
 * one turn of runBotssonAgent on the server, which executes capability tools (contract,
 * future: schedule, payroll, etc.) and returns assistant text + any InputRequestDescriptors
 * that tools need filled in.
 *
 * V0 scope:
 *   - Single-workspace chat
 *   - Conversation history kept in component state (not persisted across page reloads)
 *   - Renders text messages, tool execution outcomes, and inline BotssonInputRequest forms
 *   - Optional primeContext to seed the conversation when admin opens chat from a specific
 *     page (e.g. "Lag kontrakt for Lise" from /dashboard/people/[id])
 *
 * NOT in V0:
 *   - Streaming responses (await full turn, then render)
 *   - Conversation persistence to engine_sessions
 *   - Voice fallback (admin can switch to Ultravox via the playground separately)
 *   - InputRequest submit → second turn wiring (typed answers post back as a new user
 *     message — full continuation flow lives in V1 once we wire request_id correlation)
 *
 * Phase 3.5 addition — Client-tool roundtrip (ADR-0327):
 *   When the server returns `client_tool_calls`, the browser executes each registered
 *   implementation, collects results, and POSTs them back as `client_tool_results`.
 *   The conversation resumes from the LLM's next turn. Loop-safe: 3 rounds max.
 */

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button, BotssonInputRequest, type BIRDescriptor } from "@smartout/ui";
import { useBotsson } from "./BotssonProvider";
import { useRegisteredTools } from "./tool-registry";
import type {
  ClientToolCall,
  ClientToolCallResult,
  ClientToolImplementation,
} from "@smartout/ai/harness/types";

// ── Types ───────────────────────────────────────────────────────────────────
type ChatRole = "user" | "assistant";

/**
 * Shape of a /api/botsson/chat response.
 * When `client_tool_calls` is present, the conversation is mid-turn (roundtrip pending).
 * When absent (or empty), `text` holds the final assistant message.
 */
type ChatApiResponse = {
  text?: string;
  sessionId?: string;
  intent?: { capability: string; confidence: number };
  client_tool_calls?: ClientToolCall[];
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  /** Tool execution outcomes for this turn — shown as small chips under the message. */
  toolResults?: Array<{ tool_name: string; result: string }>;
  /** InputRequest forms attached to this assistant turn. Render inline below the text. */
  inputRequests?: BIRDescriptor[];
};

export type BotssonChatPrimeContext = {
  kind: "create_contract" | "view_employee" | "general";
  profileId?: string;
  profileName?: string;
};

export type BotssonChatProps = {
  workspaceId: string;
  /** Optional context that primes the first turn when admin enters from a specific page. */
  primeContext?: BotssonChatPrimeContext;
  /** Greeting line shown above the empty chat. Defaults to a sensible Norwegian opener. */
  greeting?: string;
  className?: string;
  /** Override the chat API endpoint. Defaults to /api/botsson/chat (admin).
   *  For employee-facing flows, use /api/emma/chat. */
  chatEndpoint?: string;
  /** Mission identifier to pass with the first turn (e.g. 'contract_intake'). */
  mission?: string;
  /** Additional mission context to pass with the first turn. */
  missionContext?: Record<string, unknown>;
};

// ── Client-tool roundtrip ───────────────────────────────────────────────────

/** Maximum number of client-tool roundtrips per user turn (loop-safety cap). */
const MAX_ROUNDTRIPS = 3;

/**
 * Executes all client tools in a `client_tool_calls` batch and returns their results.
 *
 * - Looks up each tool by name in `implementations`.
 * - Calls the implementation with the LLM-supplied arguments.
 * - On throw: captures the error message as `is_error: true` result.
 * - Unknown tool: returns a descriptive "not registered" result with `is_error: true`.
 *
 * Exported for unit-testing without a React environment.
 */
export async function resolveClientToolCalls(
  calls: ClientToolCall[],
  implementations: Record<string, ClientToolImplementation>,
): Promise<ClientToolCallResult[]> {
  return Promise.all(
    calls.map(async (call): Promise<ClientToolCallResult> => {
      const impl = implementations[call.name];
      if (!impl) {
        return {
          tool_call_id: call.tool_call_id,
          result: `Client tool '${call.name}' not registered in this page scope.`,
          is_error: true,
        };
      }
      try {
        const result = await impl(call.arguments);
        return { tool_call_id: call.tool_call_id, result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { tool_call_id: call.tool_call_id, result: msg, is_error: true };
      }
    }),
  );
}

/**
 * Sends a chat request to `endpoint` and handles client-tool roundtrips.
 *
 * - If the response contains `client_tool_calls`, resolves them locally and POSTs back.
 * - Repeats up to `MAX_ROUNDTRIPS` times, then rejects with a loop-cap error.
 * - Preserves `sessionId` across all rounds so the LLM sees a continuous conversation.
 *
 * Returns the final text + sessionId when the LLM responds without tool calls.
 *
 * Exported for unit-testing without a React environment.
 */
export async function executeClientToolRoundtrip({
  endpoint,
  initialBody,
  implementations,
}: {
  endpoint: string;
  initialBody: Record<string, unknown>;
  implementations: Record<string, ClientToolImplementation>;
}): Promise<{ text: string; sessionId?: string }> {
  let body = { ...initialBody };
  let roundtrip = 0;

  while (true) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error ?? `Request failed (${response.status})`);
    }

    const data = (await response.json()) as ChatApiResponse;

    // Propagate session_id from every round so subsequent rounds stay in context
    if (data.sessionId) {
      body = { ...body, sessionId: data.sessionId };
    }

    // No client tool calls — this is the final LLM response
    if (!data.client_tool_calls || data.client_tool_calls.length === 0) {
      return { text: data.text ?? "(ingen respons)", sessionId: data.sessionId };
    }

    // Loop-safety: stop after MAX_ROUNDTRIPS client-tool rounds
    roundtrip += 1;
    if (roundtrip >= MAX_ROUNDTRIPS) {
      throw new Error("Botsson kept asking for tools — gi opp this turn");
    }

    // Resolve all client tool calls in parallel
    const client_tool_results = await resolveClientToolCalls(
      data.client_tool_calls,
      implementations,
    );

    // POST results back — stage-engine resumes the LLM run
    body = {
      ...body,
      client_tool_results,
    };
  }
}

// ── Component ───────────────────────────────────────────────────────────────
export function BotssonChat({
  workspaceId,
  primeContext,
  greeting,
  className,
  chatEndpoint = "/api/botsson/chat",
  mission,
  missionContext,
}: BotssonChatProps) {
  const { currentSessionId, setCurrentSessionId } = useBotsson();
  // Page-registered client-tool implementations — used for client-tool roundtrips (ADR-0327)
  const registeredTools = useRegisteredTools();
  const sessionId = currentSessionId ?? undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Reset messages when session changes externally (load-session or new-chat from Provider).
  // Conversation repopulates via BotssonHistory if user opened from history;
  // or starts fresh if startNewChat was called.
  useEffect(() => {
    setMessages([]);
    setInputValue("");
    setError(null);
  }, [currentSessionId]);

  async function sendTurn(userText: string) {
    if (!userText.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: userText.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSending(true);
    setError(null);

    try {
      // Stage-engine handles conversation history via persistent sessions.
      // We send session_id on subsequent turns — no need to replay history from client.
      const currentPage = typeof window !== "undefined" ? window.location.pathname : undefined;

      const initialBody: Record<string, unknown> = {
        workspaceId,
        userMessage: userText,
        sessionId,
        pageContext: currentPage,
        // Only attach primeContext on the very first turn (admin chat)
        primeContext: !sessionId ? primeContext : undefined,
        // Mission context for employee-facing flows (e.g. contract_intake)
        ...(mission && !sessionId ? { mission, missionContext } : {}),
      };

      // Phase 3.5: client-tool roundtrip — if server emits client_tool_calls, we resolve
      // each implementation in the browser and POST back client_tool_results. Up to
      // MAX_ROUNDTRIPS times, then surface an error message.
      const result = await executeClientToolRoundtrip({
        endpoint: chatEndpoint,
        initialBody,
        implementations: registeredTools.implementations,
      });

      // Persist session_id for subsequent turns
      if (result.sessionId && result.sessionId !== currentSessionId) {
        setCurrentSessionId(result.sessionId);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: result.text,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ukjent feil";
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendTurn(inputValue);
  }

  // ── InputRequest submission ──────────────────────────────────────────────
  // V0 strategy: when admin submits an inline form, send the typed values as a new user
  // turn formatted as JSON. The agent picks it up via natural language and continues. V1
  // will use a dedicated continuation endpoint with request_id correlation.
  function handleInputRequestSubmit(request_id: string, values: Record<string, string>) {
    const payload = JSON.stringify({ request_id, values });
    void sendTurn(`[input_response]\n${payload}`);
  }

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`} data-component="botsson-chat">
      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-center text-sm">
            <Bot className="h-8 w-8 opacity-40" />
            <p>{greeting ?? "Hei. Hva trenger du hjelp med?"}</p>
            {primeContext?.kind === "create_contract" && primeContext.profileName ? (
              <p className="text-xs">
                Klar til å lage kontrakt for{" "}
                <span className="text-foreground font-medium">{primeContext.profileName}</span>.
              </p>
            ) : null}
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              onInputRequestSubmit={handleInputRequestSubmit}
            />
          ))
        )}
        {isSending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Botsson tenker …</span>
          </div>
        ) : null}
        {error ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
            {error}
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-card/60 flex items-end gap-2 border-t p-3"
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendTurn(inputValue);
            }
          }}
          placeholder="Skriv en melding til Botsson … (Enter for å sende, Shift+Enter for ny linje)"
          rows={2}
          disabled={isSending}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSending || !inputValue.trim()}
          aria-label="Send melding"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

// ── Single message bubble ───────────────────────────────────────────────────
function ChatMessageBubble({
  message,
  onInputRequestSubmit,
}: {
  message: ChatMessage;
  onInputRequestSubmit: (request_id: string, values: Record<string, string>) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-role={message.role}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {/* Hide raw [input_response] payloads from the visual stream */}
          {message.text.startsWith("[input_response]")
            ? "(skjema sendt)"
            : message.text.split("\n").map((line, i) => (
                <p key={i} className={i > 0 ? "mt-1" : ""}>
                  {line}
                </p>
              ))}
        </div>

        {/* Tool execution chips — small status display under the bubble */}
        {message.toolResults && message.toolResults.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {message.toolResults.map((tr, i) => (
              <span
                key={i}
                className="border-border bg-background/60 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]"
                title={tr.result}
              >
                {tr.tool_name}
              </span>
            ))}
          </div>
        ) : null}

        {/* Inline InputRequest forms — Botsson is asking for typed input */}
        {message.inputRequests && message.inputRequests.length > 0
          ? message.inputRequests.map((req) => (
              <BotssonInputRequest
                key={req.request_id}
                request={req}
                onSubmit={onInputRequestSubmit}
                className="w-full"
              />
            ))
          : null}
      </div>
    </div>
  );
}
