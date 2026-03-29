"use client";

// ============================================
// CockpitActivityFeed.tsx
// Renders the latest normalized cockpit events
// for V1 first-screen operations awareness.
// Exists to keep context tight around the most
// recent operational changes and actions.
// ============================================

import type { CockpitEventEnvelope } from "@smartout/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSeverityToneStyles } from "./severity-styles";

type CockpitActivityFeedProps = {
  feed: CockpitEventEnvelope[];
  isLoading: boolean;
  onEventPress?: (event: CockpitEventEnvelope) => void;
};

/**
 * Formats event timestamps for compact feed labels.
 *
 * Why: Operators need quick temporal context without dense date strings.
 *
 * @param occurredAt - Event timestamp string.
 * @returns Human-readable local time, or fallback when invalid.
 */
function formatTime(occurredAt: string): string {
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }
  return parsed.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Renders the V1 cockpit activity feed slice.
 *
 * Why: Action-first cockpit still needs short-lived context on what just changed.
 *
 * @param props - Feed entries and loading indicator from first-screen read model.
 * @returns Compact newest-first event feed card.
 */
export function CockpitActivityFeed({ feed, isLoading, onEventPress }: CockpitActivityFeedProps) {
  return (
    <section data-testid="cockpit-activity-feed">
      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Activity feed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-5">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading recent activity...</p>
          ) : feed.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity has been logged today.</p>
          ) : (
            feed.slice(0, 8).map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={onEventPress ? () => onEventPress(event) : undefined}
                className="border-border bg-muted/20 hover:bg-muted/40 flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.summary}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {event.actorLabel ?? "System"} · {event.eventType}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatTime(event.occurredAt)}
                  </span>
                  <Badge variant="outline" className={getSeverityToneStyles(event.severity).badge}>
                    {event.severity}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
