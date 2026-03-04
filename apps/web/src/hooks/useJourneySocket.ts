// apps/web/src/hooks/useJourneySocket.ts
// Generic hook for WebSocket communication with Stage Engine.
// Connects to /ws/:sessionId, receives UICommands, sends UserActions.
// Connected to: packages/types/src/mission-protocol.ts
// Connected to: services/stage-engine/src/routes/ws.ts

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { UICommand, UserAction } from "@smartout/types";

type UseJourneySocketOptions = {
  sessionId: string;
  token: string;
  stageEngineUrl?: string;
  onCommand?: (command: UICommand) => void;
};

type UseJourneySocketReturn = {
  sendAction: (action: UserAction["action"]) => void;
  isConnected: boolean;
  lastCommand: UICommand | null;
};

export function useJourneySocket({
  sessionId,
  token,
  stageEngineUrl = "ws://localhost:5010",
  onCommand,
}: UseJourneySocketOptions): UseJourneySocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCommand, setLastCommand] = useState<UICommand | null>(null);
  const onCommandRef = useRef(onCommand);
  useEffect(() => {
    onCommandRef.current = onCommand;
  });

  useEffect(() => {
    if (!sessionId || !token) return;

    const url = `${stageEngineUrl}/ws/${sessionId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "ui_command") {
          setLastCommand(data as UICommand);
          onCommandRef.current?.(data as UICommand);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, token, stageEngineUrl]);

  const sendAction = useCallback(
    (action: UserAction["action"]) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const message: UserAction = {
        type: "user_action",
        sessionId,
        action,
        timestamp: Date.now(),
      };
      wsRef.current.send(JSON.stringify(message));
    },
    [sessionId],
  );

  return { sendAction, isConnected, lastCommand };
}
