"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionInfo } from "../_hooks/useGuardianSocket";

type SessionListProps = {
  sessions: SessionInfo[];
  subscribedSession: string | null;
  onSelect: (sessionId: string) => void;
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function SessionList({ sessions, subscribedSession, onSelect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-sm">
        No active sessions
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {sessions.map((session) => {
          const isSelected = session.session_id === subscribedSession;
          return (
            <button
              key={session.session_id}
              onClick={() => onSelect(session.session_id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{session.profile_name}</span>
                <span className="text-muted-foreground text-xs">{timeAgo(session.started_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {session.channel}
                </Badge>
                {session.current_stage && (
                  <span className="text-muted-foreground truncate text-xs">
                    {session.current_stage}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {session.mission_id ?? "agent mode"}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
