"use client";

/**
 * SessionList — left-rail list of active sessions in the Guardian Monitor.
 *
 * Primary source: `sessions` prop (live `SessionInfo[]` from useGuardianSocket).
 * Recorder overlay (ADR-0184): the component calls useRecorderSessions()
 * internally and merges turn_count / flagged_count / max_attention_score
 * onto each live row by session_id. Sessions without any recorded turns
 * simply render the base row as before.
 *
 * Prop contract (sessions, subscribedSession, onSelect) is unchanged — the
 * caller in GuardianMonitor.tsx keeps working without edits.
 */

import { useMemo } from "react";
import { Flag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionInfo } from "../_hooks/useGuardianSocket";
import { useRecorderSessions, type RecorderSessionRow } from "../_hooks/useRecorderSessions";

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
  // Godmode (no workspace filter) — platform-admin surface sees all workspaces.
  // RLS decides whether the caller actually has godmode_read_asr access.
  const { sessions: recorderSessions } = useRecorderSessions();

  const recorderBySessionId = useMemo(() => {
    const map = new Map<string, RecorderSessionRow>();
    for (const r of recorderSessions) map.set(r.session_id, r);
    return map;
  }, [recorderSessions]);

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
          const recorder = recorderBySessionId.get(session.session_id);
          const highAttention = recorder !== undefined && recorder.max_attention_score > 0.7;

          return (
            <button
              key={session.session_id}
              onClick={() => onSelect(session.session_id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{session.profile_name}</span>
                <span className="text-muted-foreground text-xs">{timeAgo(session.started_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {session.channel}
                </Badge>
                {session.current_stage ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {session.current_stage}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {session.mission_id ?? "agent mode"}
                </span>
                {recorder ? (
                  <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
                    <span title="Turns recorded">{recorder.turn_count}t</span>
                    {recorder.flagged_count > 0 ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-amber-700"
                        title="Flagged turns"
                      >
                        <Flag className="h-2.5 w-2.5" />
                        {recorder.flagged_count}
                      </span>
                    ) : null}
                    {highAttention ? (
                      <span className="font-semibold text-amber-700" title="Max attention score">
                        ⚠ {recorder.max_attention_score.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
