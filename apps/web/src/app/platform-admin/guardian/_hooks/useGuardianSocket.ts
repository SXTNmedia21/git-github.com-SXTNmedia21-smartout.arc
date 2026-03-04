"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@smartout/supabase/client";

/** Event broadcast from engine to dashboard */
export type GuardianEvent = {
  type: "event";
  session_id: string;
  workspace_id: string;
  event_type: string;
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
};

/** Active session info */
export type SessionInfo = {
  session_id: string;
  mission_id: string | null;
  profile_name: string;
  channel: string;
  status: string;
  current_stage: string | null;
  started_at: string;
};

type GuardianSessionList = {
  type: "sessions";
  sessions: SessionInfo[];
};

type ServerMessage = GuardianEvent | GuardianSessionList;

const STAGE_ENGINE_URL = process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ?? "http://localhost:5010";

export function useGuardianSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [events, setEvents] = useState<GuardianEvent[]>([]);
  const [subscribedSession, setSubscribedSession] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    async function connect() {
      if (disposed) return;

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const wsUrl = STAGE_ENGINE_URL.replace(/^http/, "ws") + "/guardian/ws";
      ws = new WebSocket(`${wsUrl}?token=${session.access_token}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerMessage;

        if (msg.type === "sessions") {
          setSessions(msg.sessions);
        } else if (msg.type === "event") {
          setEvents((prev) => [...prev.slice(-200), msg]);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((cmd: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  const subscribe = useCallback(
    (sessionId: string) => {
      send({ type: "subscribe", session_id: sessionId });
      setSubscribedSession(sessionId);
      setEvents([]);
    },
    [send],
  );

  const unsubscribe = useCallback(
    (sessionId: string) => {
      send({ type: "unsubscribe", session_id: sessionId });
      setSubscribedSession(null);
    },
    [send],
  );

  const changeStage = useCallback(
    (sessionId: string, targetStageId: string) => {
      send({
        type: "change_stage",
        session_id: sessionId,
        target_stage_id: targetStageId,
      });
    },
    [send],
  );

  const whisper = useCallback(
    (sessionId: string, message: string) => {
      send({ type: "whisper", session_id: sessionId, message });
    },
    [send],
  );

  return {
    connected,
    sessions,
    events,
    subscribedSession,
    subscribe,
    unsubscribe,
    changeStage,
    whisper,
  };
}
