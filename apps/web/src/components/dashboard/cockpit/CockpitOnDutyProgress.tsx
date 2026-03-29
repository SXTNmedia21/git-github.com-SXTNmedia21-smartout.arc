"use client";

/**
 * CockpitOnDutyProgress — Rich shift cards showing who is on duty.
 * Each card is clickable and opens the shift detail drawer.
 */

import { Clock, Coffee, AlertTriangle, Timer } from "lucide-react";
import type { LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { getSeverityToneStyles, type CockpitSeverityTone } from "./severity-styles";
import { useTranslation } from "@smartout/i18n";

type CockpitOnDutyProgressProps = {
  entries: LiveShiftEntry[];
  isLoading: boolean;
};

function getStatusTone(status: LiveShiftEntry["status"]): CockpitSeverityTone {
  if (status === "late") return "critical";
  if (status === "waiting") return "warning";
  if (status === "on_break") return "info";
  return "good";
}

function getStatusIcon(status: LiveShiftEntry["status"]) {
  if (status === "late") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (status === "on_break") return <Coffee className="h-3.5 w-3.5" />;
  if (status === "waiting") return <Timer className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

function getStatusLabel(status: LiveShiftEntry["status"], t: (key: string) => string): string {
  if (status === "clocked_in") return t("cockpit.status_clocked_in");
  if (status === "on_break") return t("cockpit.status_on_break");
  if (status === "waiting") return t("cockpit.status_waiting");
  if (status === "late") return t("cockpit.status_late");
  return status;
}

function summarize(entries: LiveShiftEntry[]): Record<LiveShiftEntry["status"], number> {
  return entries.reduce<Record<LiveShiftEntry["status"], number>>(
    (acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    },
    { clocked_in: 0, on_break: 0, waiting: 0, late: 0 },
  );
}

export function CockpitOnDutyProgress({ entries, isLoading }: CockpitOnDutyProgressProps) {
  const totals = summarize(entries);
  const { openDrawer } = useEntityDrawer();
  const { t } = useTranslation("dashboard");

  return (
    <section data-testid="cockpit-on-duty-progress">
      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t("cockpit.on_duty_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {totals.clocked_in > 0 && (
              <Badge variant="outline" className={getSeverityToneStyles("good").badge}>
                <Clock className="mr-1 h-3 w-3" /> {totals.clocked_in}{" "}
                {t("cockpit.badge_clocked_in")}
              </Badge>
            )}
            {totals.on_break > 0 && (
              <Badge variant="outline" className={getSeverityToneStyles("info").badge}>
                <Coffee className="mr-1 h-3 w-3" /> {totals.on_break} {t("cockpit.badge_on_break")}
              </Badge>
            )}
            {totals.waiting > 0 && (
              <Badge variant="outline" className={getSeverityToneStyles("warning").badge}>
                <Timer className="mr-1 h-3 w-3" /> {totals.waiting} {t("cockpit.badge_waiting")}
              </Badge>
            )}
            {totals.late > 0 && (
              <Badge variant="outline" className={getSeverityToneStyles("critical").badge}>
                <AlertTriangle className="mr-1 h-3 w-3" /> {totals.late} {t("cockpit.badge_late")}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("cockpit.loading_shifts")}</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("cockpit.no_shifts")}</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(0, 10).map((entry) => {
                const tone = getStatusTone(entry.status);
                return (
                  <button
                    type="button"
                    key={entry.shiftId}
                    onClick={() => openDrawer("shift", entry.shiftId)}
                    className="hover:bg-muted/60 border-border bg-muted/20 flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors"
                  >
                    {/* Avatar circle with initials */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        tone === "critical"
                          ? "bg-destructive/10 text-destructive"
                          : tone === "warning"
                            ? "bg-warning/10 text-warning"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {entry.initials}
                    </div>

                    {/* Name + role */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{entry.employeeName}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {entry.role || t("cockpit.no_role")}
                      </p>
                    </div>

                    {/* Duration / start time */}
                    <div className="flex shrink-0 items-center gap-2">
                      {entry.duration ? (
                        <span className="text-muted-foreground text-xs font-medium tabular-nums">
                          {entry.duration}
                        </span>
                      ) : entry.startTime ? (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {t("cockpit.starts_at", { time: entry.startTime })}
                        </span>
                      ) : null}

                      {/* Status pill */}
                      <div
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getSeverityToneStyles(tone).badge}`}
                      >
                        {getStatusIcon(entry.status)}
                        <span className="hidden sm:inline">{getStatusLabel(entry.status, t)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
