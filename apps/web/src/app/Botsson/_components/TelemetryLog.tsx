"use client";

import { useEffect, useRef } from "react";
import { useEmmaTelemetry, type TelemetryEntry } from "./emma-awareness";

const CATEGORY_COLORS: Record<string, string> = {
  auth: "text-blue-400",
  department: "text-cyan-400",
  shift: "text-amber-400",
  session: "text-purple-400",
  protocol: "text-green-400",
  contract: "text-orange-400",
  wizard: "text-pink-400",
  reconciliation: "text-rose-400",
  communication: "text-sky-400",
  handbook: "text-teal-400",
  invitation: "text-indigo-400",
  page: "text-muted-foreground",
  button: "text-muted-foreground",
};

export function TelemetryLog({ open }: { open: boolean }) {
  const { events, clearEvents } = useEmmaTelemetry();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length, open]);

  if (!open) return null;

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border flex items-center justify-between border-b px-4 py-2">
        <span className="text-foreground text-xs font-medium">Telemetry Feed</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-[10px]">
            {events.length} events
          </span>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="h-64 space-y-0.5 overflow-y-auto p-3 font-mono text-[11px]">
        {events.length === 0 && (
          <div className="text-muted-foreground/50 py-8 text-center">
            No telemetry events yet. Interact with the app to generate events.
          </div>
        )}

        {events.map((entry, i) => (
          <TelemetryEntry key={i} entry={entry} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TelemetryEntry({ entry }: { entry: TelemetryEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("no", { hour12: false });
  const color = CATEGORY_COLORS[entry.category] ?? "text-muted-foreground";

  return (
    <div className="flex gap-2 leading-tight">
      <span className="text-muted-foreground/50 shrink-0">{time}</span>
      <span className={`shrink-0 ${color}`}>[{entry.category}]</span>
      <span className="text-foreground/80 break-all">{entry.event}</span>
    </div>
  );
}
