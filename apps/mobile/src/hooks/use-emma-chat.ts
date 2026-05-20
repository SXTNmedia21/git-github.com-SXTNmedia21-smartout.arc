/**
 * useEmmaChat — Mobile text-chat control plane bridge.
 *
 * POSTs typed user messages to the web BFF (`/api/emma/chat`) and returns
 * the agent response. Used by BotssonProvider when `mode === 'text'`.
 *
 * Architecture (ADR-0132 — mobile thin client):
 *
 *   ┌─────────────┐  POST  ┌──────────────────┐  proxy  ┌──────────────┐
 *   │  this hook  │───────▶│ /api/emma/chat   │────────▶│ stage-engine │
 *   │             │        │  (Bearer JWT)    │         │ /agent/chat  │
 *   │ onResponse()│◀───────│  channel='chat'  │◀────────│ channel=chat │
 *   └─────────────┘        └──────────────────┘         └──────────────┘
 *
 * Channel pin: the BFF forces `channel='chat'` server-side (ADR-0078).
 * This hook passes `channel: 'chat'` as a hint but the server re-pins.
 *
 * Telemetry:
 *   - mobile.chat.message_sent  — on each send() call
 *   - mobile.chat.response_received — on successful BFF round-trip
 *   - mobile.chat.error — on any error (network, 401, 5xx)
 *
 * ADR-0134 / L-0177: every emit() uses getProfileContext() which throws
 * on missing/empty IDs — fail fast, no corrupt telemetry.
 */

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getEmmaChatUrl } from "@/lib/web-api";
import { getProfileContext } from "@/lib/profile-context";
import { emit, nonEmpty } from "@smartout/telemetry";

export type ChatTurnResponse = {
  /** The agent's text response, ready to display. */
  text: string;
  /** Stage-engine session id — caller persists for continuity. */
  sessionId: string;
  /** Routed intent for analytics. */
  intent?: { capability: string; confidence: number };
};

type ChatError = {
  code: string;
  message: string;
  status: number;
};

type UseEmmaChatState = {
  /** True while a message is in flight to the BFF. */
  isSending: boolean;
  /** Last error, if any. Cleared on the next successful send. */
  error: ChatError | null;
};

type UseEmmaChatParams = {
  /**
   * Workspace scope — REQUIRED for telemetry per ADR-0134.
   * When null the hook is inert — send() returns immediately.
   */
  workspaceId: string | null;
  /** Current stage-engine session id (null = cold start). */
  sessionId?: string | null;
  /** Called when the BFF returns a successful response. */
  onResponse?: (response: ChatTurnResponse) => void;
  /** Called just before the fetch so callers can append optimistic entry. */
  onSend?: (text: string) => void;
};

type UseEmmaChatResult = UseEmmaChatState & {
  /**
   * Send a typed message to the BFF.
   *
   * Returns the ChatTurnResponse on success, or null on error.
   * The caller is responsible for optimistic-append + rollback:
   * - Append user entry before calling send() via `onSend` callback
   * - On null return: rollback + show toast
   */
  send: (text: string) => Promise<ChatTurnResponse | null>;
};

export function useEmmaChat({
  workspaceId,
  sessionId,
  onResponse,
  onSend,
}: UseEmmaChatParams): UseEmmaChatResult {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  // Refs allow the latest prop values inside the async send() without
  // requiring the function to be re-created on each render.
  const workspaceIdRef = useRef(workspaceId);
  const sessionIdRef = useRef(sessionId);
  const onResponseRef = useRef(onResponse);
  const onSendRef = useRef(onSend);

  // Keep refs in sync with latest props (same pattern as useVoiceTranscripts).
  workspaceIdRef.current = workspaceId;
  sessionIdRef.current = sessionId;
  onResponseRef.current = onResponse;
  onSendRef.current = onSend;

  const send = useCallback(async (text: string): Promise<ChatTurnResponse | null> => {
    const ws = workspaceIdRef.current;
    if (!ws) return null;

    setIsSending(true);
    setError(null);

    // Fire onSend before the fetch so callers can append optimistic entry.
    onSendRef.current?.(text);

    const sendStart = Date.now();

    // Resolve auth — Bearer token from the active Supabase session.
    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !sess.session?.access_token) {
      const chatError: ChatError = {
        code: "NOT_AUTHENTICATED",
        message: "Ikke pålogget. Logg inn og prøv igjen.",
        status: 401,
      };
      setError(chatError);
      setIsSending(false);
      // Telemetry: fire-and-forget. Fail-soft — never breaks chat UX.
      void emitChatError(ws, chatError.code, 401);
      return null;
    }

    const accessToken = sess.session.access_token;
    const currentSessionId = sessionIdRef.current;

    // Telemetry: message_sent (L-0298: emit() call-site in same commit as registry entry).
    void emitMessageSent(ws, text, currentSessionId ?? null);

    let res: Response;
    try {
      res = await fetch(getEmmaChatUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          workspaceId: ws,
          userMessage: text,
          sessionId: currentSessionId ?? undefined,
          // ADR-0078: hint only — BFF re-pins to 'chat' server-side.
          // Field is not accepted by the BFF schema (see route.ts) but
          // kept here as documentation. The server always forces "chat".
        }),
      });
    } catch (networkErr) {
      const chatError: ChatError = {
        code: "NETWORK",
        message: networkErr instanceof Error ? networkErr.message : "Nettverksfeil",
        status: 0,
      };
      setError(chatError);
      setIsSending(false);
      void emitChatError(ws, chatError.code, 0);
      return null;
    }

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      const errorCode = errBody.error ?? "BFF_ERROR";
      let friendlyMessage: string;
      if (res.status === 401) {
        friendlyMessage = "Sesjonen er utløpt. Logg inn på nytt.";
      } else if (res.status >= 500) {
        friendlyMessage = "Botsson har problemer akkurat nå. Prøv om litt.";
      } else {
        friendlyMessage = errBody.message ?? `Feil fra Botsson (${res.status})`;
      }
      const chatError: ChatError = {
        code: errorCode,
        message: friendlyMessage,
        status: res.status,
      };
      setError(chatError);
      setIsSending(false);
      void emitChatError(ws, errorCode, res.status);
      return null;
    }

    const data = (await res.json()) as {
      text: string;
      sessionId: string;
      intent?: { capability: string; confidence: number };
    };

    setIsSending(false);

    const latencyMs = Date.now() - sendStart;
    const response: ChatTurnResponse = {
      text: data.text,
      sessionId: data.sessionId,
      intent: data.intent,
    };

    onResponseRef.current?.(response);

    // Telemetry: response_received (L-0298 call-site).
    void emitResponseReceived(ws, latencyMs, data.text, data.intent?.capability);

    return response;
  }, []); // Empty deps — all values accessed via refs.

  return { isSending, error, send };
}

// ─── Telemetry helpers ────────────────────────────────────────────────────────
// Fire-and-forget. Per ADR-0134 / L-0177: getProfileContext() throws on
// missing/empty IDs — telemetry NEVER emits with empty actor_id.

async function emitMessageSent(
  workspaceId: string,
  text: string,
  currentSessionId: string | null,
): Promise<void> {
  try {
    const { profileId } = await getProfileContext();
    void emit({
      event: "mobile.chat.message_sent",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: {
          length: text.length,
          session_id_present: currentSessionId !== null,
          device_type: "mobile",
        },
      },
    });
  } catch {
    /* Swallow — telemetry must never break chat UX. */
  }
}

async function emitResponseReceived(
  workspaceId: string,
  latencyMs: number,
  responseText: string,
  intent?: string,
): Promise<void> {
  try {
    const { profileId } = await getProfileContext();
    void emit({
      event: "mobile.chat.response_received",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: {
          latency_ms: latencyMs,
          response_length: responseText.length,
          intent,
          device_type: "mobile",
        },
      },
    });
  } catch {
    /* Swallow — telemetry must never break chat UX. */
  }
}

async function emitChatError(
  workspaceId: string,
  reason: string,
  statusCode: number,
): Promise<void> {
  try {
    const { profileId } = await getProfileContext();
    void emit({
      event: "mobile.chat.error",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: {
          reason,
          status_code: statusCode,
          device_type: "mobile",
        },
      },
    });
  } catch {
    /* Swallow — telemetry must never break chat UX. */
  }
}
