"use client";

// UI Events:
// - action: subscribe(sessionId) — select a session to monitor
// - action: whisper(sessionId, message) — send admin whisper to agent
// - visual: 3-panel layout (sessions | events | details)

import { useMemo } from "react";
import type { GuardianEvent, SessionInfo } from "../_hooks/useGuardianSocket";
import { SessionList } from "./SessionList";
import { EventFeed } from "./EventFeed";
import { SessionDetails } from "./SessionDetails";
import { WhisperInput } from "./WhisperInput";

type GuardianMonitorProps = {
  sessions: SessionInfo[];
  events: GuardianEvent[];
  subscribedSession: string | null;
  subscribe: (sessionId: string) => void;
  whisper: (sessionId: string, message: string) => void;
};

export function GuardianMonitor({
  sessions,
  events,
  subscribedSession,
  subscribe,
  whisper,
}: GuardianMonitorProps) {
  const selectedSession = useMemo(
    () => sessions.find((s) => s.session_id === subscribedSession) ?? null,
    [sessions, subscribedSession],
  );

  return (
    <div className="border-border flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-lg border">
      {/* Three-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_320px]">
        {/* Left: Session list */}
        <div className="border-border border-r">
          <div className="border-border border-b px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">
              Sessions ({sessions.length})
            </span>
          </div>
          <div className="h-[calc(100%-33px)]">
            <SessionList
              sessions={sessions}
              subscribedSession={subscribedSession}
              onSelect={subscribe}
            />
          </div>
        </div>

        {/* Center: Event feed + whisper */}
        <div className="border-border flex flex-col border-r">
          <div className="border-border border-b px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">Event Feed</span>
          </div>
          <div className="min-h-0 flex-1">
            <EventFeed events={events} />
          </div>
          <WhisperInput sessionId={subscribedSession} onWhisper={whisper} />
        </div>

        {/* Right: Session details */}
        <div>
          <div className="border-border border-b px-3 py-2">
            <span className="text-muted-foreground text-xs font-medium">Detaljer</span>
          </div>
          <div className="h-[calc(100%-33px)]">
            <SessionDetails session={selectedSession} events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
