"use client";

import { useMemo } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGuardianSocket } from "../_hooks/useGuardianSocket";
import { SessionList } from "./SessionList";
import { EventFeed } from "./EventFeed";
import { SessionDetails } from "./SessionDetails";
import { WhisperInput } from "./WhisperInput";

export function GuardianMonitor() {
  const { connected, sessions, events, subscribedSession, subscribe, whisper } =
    useGuardianSocket();

  const selectedSession = useMemo(
    () => sessions.find((s) => s.session_id === subscribedSession) ?? null,
    [sessions, subscribedSession],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="text-foreground h-5 w-5" />
          <h1 className="text-foreground text-lg font-semibold">Guardian Monitor</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div
            className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-destructive")}
          />
          <span className="text-muted-foreground">{connected ? "Live" : "Disconnected"}</span>
        </div>
      </div>

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
            <span className="text-muted-foreground text-xs font-medium">Details</span>
          </div>
          <div className="h-[calc(100%-33px)]">
            <SessionDetails session={selectedSession} events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
