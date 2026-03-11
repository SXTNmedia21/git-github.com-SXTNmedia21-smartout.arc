"use client";

import { useEffect, useRef } from "react";
import { useWalkAi } from "./WalkAiProvider";

export function PlaygroundLog({ open }: { open: boolean }) {
  const { agent, identity, voiceTuning, state } = useWalkAi();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agent.debugLog.length, agent.transcript.length, open]);

  if (!open) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">Event Stream</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {agent.debugLog.length} events | {agent.transcript.length} msgs
        </span>
      </div>

      <div className="h-80 overflow-y-auto p-3 space-y-1 font-mono text-[11px]">
        {/* Session config snapshot */}
        <LogEntry
          time={null}
          type="config"
          content={`persona=${identity.persona} rank=${identity.rank} blend=${identity.blend} temp=${voiceTuning.temperature} speaker=${voiceTuning.firstSpeaker}`}
        />

        {/* Interleaved: debug log + transcript */}
        {buildTimeline(agent.debugLog, agent.transcript).map((entry, i) => (
          <LogEntry key={i} {...entry} />
        ))}

        {/* Status line */}
        <LogEntry
          time={null}
          type="state"
          content={`status=${agent.status} density=${state.density} orb=${state.orbStatus} muted=${agent.isMuted} connected=${agent.isConnected}`}
        />

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ━━━ Timeline builder ━━━ */

type TimelineEntry = {
  time: number | null;
  type: string;
  content: string;
};

function buildTimeline(
  debugLog: Array<{ timestamp: number; type: string; content: string }>,
  transcript: Array<{ role: string; text: string }>,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Debug entries with timestamps
  for (const d of debugLog) {
    entries.push({ time: d.timestamp, type: d.type, content: d.content });
  }

  // Transcript entries (no timestamp, append at end)
  for (const t of transcript) {
    entries.push({
      time: null,
      type: t.role === "agent" ? "agent" : "user",
      content: t.text,
    });
  }

  // Sort by timestamp (nulls at end)
  entries.sort((a, b) => {
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time - b.time;
  });

  return entries;
}

/* ━━━ Single log line ━━━ */

const TYPE_COLORS: Record<string, string> = {
  status: "text-blue-400",
  tool_call: "text-amber-400",
  event: "text-purple-400",
  context_push: "text-cyan-400",
  api_request: "text-orange-400",
  api_response: "text-green-400",
  api_error: "text-red-400",
  config: "text-muted-foreground",
  state: "text-muted-foreground",
  agent: "text-green-400",
  user: "text-foreground",
};

function LogEntry({ time, type, content }: TimelineEntry) {
  const timeStr = time ? new Date(time).toLocaleTimeString("no", { hour12: false }) : "──:──:──";
  const color = TYPE_COLORS[type] ?? "text-muted-foreground";

  return (
    <div className="flex gap-2 leading-tight">
      <span className="text-muted-foreground/50 shrink-0">{timeStr}</span>
      <span className={`shrink-0 ${color}`}>[{type}]</span>
      <span className="text-foreground/80 break-all">{content}</span>
    </div>
  );
}
