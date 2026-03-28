"use client";

// ============================================
// CockpitTopStrip.tsx
// Shows the V1 cockpit summary strip with
// high-signal status counters and recency.
// Exists to keep first-screen situational
// awareness visible without deep scanning.
// ============================================

import { AlertTriangle, Clock3, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSeverityToneStyles, type CockpitSeverityTone } from "./severity-styles";

type CockpitTopStripProps = {
  isLoading: boolean;
  onDutyCount: number;
  criticalCount: number;
  warningCount: number;
  eventCount: number;
  lastUpdatedAt: string | null;
};

/**
 * Formats the last update timestamp for concise cockpit display.
 *
 * Why: Operators need fast recency context without parsing full ISO timestamps.
 *
 * @param occurredAt - Most recent event timestamp in ISO format.
 * @returns Human-readable local time, or fallback text if timestamp is absent.
 */
function formatLastUpdated(occurredAt: string | null): string {
  if (!occurredAt) {
    return "No recent updates";
  }

  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Update time unavailable";
  }

  return `Updated ${parsed.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Renders the cockpit top strip with four action-oriented signal counters.
 *
 * Why: V1 keeps cognitive load low by surfacing only immediately useful metrics.
 *
 * @param props - Aggregated first-screen counters and loading state.
 * @returns Top-strip card containing compact operations signals.
 */
export function CockpitTopStrip({
  isLoading,
  onDutyCount,
  criticalCount,
  warningCount,
  eventCount,
  lastUpdatedAt,
}: CockpitTopStripProps) {
  const metrics = [
    {
      id: "on-duty",
      label: "On duty",
      value: onDutyCount,
      icon: Users,
      tone: "neutral" as CockpitSeverityTone,
    },
    {
      id: "critical",
      label: "Critical now",
      value: criticalCount,
      icon: ShieldAlert,
      tone: "critical" as CockpitSeverityTone,
    },
    {
      id: "warning",
      label: "Watch list",
      value: warningCount,
      icon: AlertTriangle,
      tone: "warning" as CockpitSeverityTone,
    },
    {
      id: "activity",
      label: "Feed events",
      value: eventCount,
      icon: Clock3,
      tone: "info" as CockpitSeverityTone,
    },
  ] as const;

  return (
    <Card data-testid="cockpit-top-strip" className="border-border shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-foreground text-sm font-semibold">Hospitality operations cockpit</p>
            <p className="text-muted-foreground text-xs">
              First-screen action view for active service pressure.
            </p>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-border">
            {formatLastUpdated(lastUpdatedAt)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="bg-muted/40 border-border/60 flex items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <metric.icon
                className={`h-4 w-4 shrink-0 ${getSeverityToneStyles(metric.tone).icon}`}
              />
              <div className="min-w-0">
                <p
                  className={`text-lg leading-none font-bold tabular-nums ${getSeverityToneStyles(metric.tone).text}`}
                >
                  {isLoading ? "--" : metric.value}
                </p>
                <p className="text-muted-foreground mt-1 truncate text-[11px] font-medium">
                  {metric.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
