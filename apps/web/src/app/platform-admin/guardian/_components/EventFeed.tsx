"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GuardianEvent } from "../_hooks/useGuardianSocket";

type EventFeedProps = {
  events: GuardianEvent[];
};

// Semantic actor colors — deliberate exception from CSS variable rule.
// Each actor gets a distinct color for visual identification in the event feed.
const ACTOR_STYLES: Record<string, string> = {
  system: "text-muted-foreground",
  agent: "text-blue-400",
  user: "text-emerald-400",
  admin: "text-amber-400",
  guardian: "text-purple-400",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EventFeed({ events }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Select a session to see events
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-3">
        {events.map((event, i) => {
          const isMessage =
            event.event_type === "user.message" || event.event_type === "agent.response";
          const fullText = isMessage ? (event.data.text as string | undefined) : null;

          return (
            <div key={`${event.timestamp}-${i}`} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {formatTime(event.timestamp)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium",
                  ACTOR_STYLES[event.actor] ?? "text-foreground",
                )}
              >
                [{event.actor}]
              </span>
              <span className="text-foreground">{fullText ?? event.summary}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
