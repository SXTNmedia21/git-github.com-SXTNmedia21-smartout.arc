"use client";

/**
 * CockpitTopStrip — Summary counters for the tactical cockpit.
 * Each metric is clickable and scrolls to the relevant section.
 */

import { AlertTriangle, Clock3, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSeverityToneStyles, type CockpitSeverityTone } from "./severity-styles";
import { useTranslation } from "@smartout/i18n";

type CockpitTopStripProps = {
  isLoading: boolean;
  onDutyCount: number;
  criticalCount: number;
  warningCount: number;
  eventCount: number;
  lastUpdatedAt: string | null;
};

function formatLastUpdated(
  occurredAt: string | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!occurredAt) return t("cockpit.no_updates");
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) return "—";
  const time = parsed.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  return t("cockpit.updated_at", { time });
}

function scrollToSection(testId: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CockpitTopStrip({
  isLoading,
  onDutyCount,
  criticalCount,
  warningCount,
  eventCount,
  lastUpdatedAt,
}: CockpitTopStripProps) {
  const { t } = useTranslation("dashboard");
  const metrics = [
    {
      id: "on-duty",
      label: t("cockpit.on_duty"),
      value: onDutyCount,
      icon: Users,
      tone: "neutral" as CockpitSeverityTone,
      scrollTo: "cockpit-on-duty-progress",
    },
    {
      id: "critical",
      label: t("cockpit.critical"),
      value: criticalCount,
      icon: ShieldAlert,
      tone: "critical" as CockpitSeverityTone,
      scrollTo: "cockpit-risk-queues",
    },
    {
      id: "warning",
      label: t("cockpit.monitoring"),
      value: warningCount,
      icon: AlertTriangle,
      tone: "warning" as CockpitSeverityTone,
      scrollTo: "cockpit-risk-queues",
    },
    {
      id: "activity",
      label: t("cockpit.events"),
      value: eventCount,
      icon: Clock3,
      tone: "info" as CockpitSeverityTone,
      scrollTo: "cockpit-activity-feed",
    },
  ] as const;

  return (
    <Card data-testid="cockpit-top-strip" className="border-border shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-foreground text-sm font-semibold">{t("cockpit.title")}</p>
            <p className="text-muted-foreground text-xs">{t("cockpit.subtitle")}</p>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-border">
            {formatLastUpdated(lastUpdatedAt, t)}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <button
              type="button"
              key={metric.id}
              onClick={() => scrollToSection(metric.scrollTo)}
              className="bg-muted/40 border-border/60 hover:bg-muted/70 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors"
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
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
