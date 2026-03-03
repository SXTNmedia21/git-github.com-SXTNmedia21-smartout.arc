"use client";

// UI Events:
// - visual: 4 SignalCards showing active sessions, health, avg duration, tool calls
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - nav: tab switch to live monitor (via parent tabs)

import { Activity, Heart, Clock, Wrench } from "lucide-react";
import { SignalCard } from "@/components/dashboard/SignalCard";
import type { SignalStatus } from "@/app/dashboard/_hooks/dashboard-types";
import { useGuardianHealth } from "../_hooks/useGuardianHealth";
import { useSessionHistory } from "../_hooks/useSessionHistory";
import { AlertsList } from "./AlertsList";

type GuardianOverviewProps = {
  activeSessions: number;
};

function healthToStatus(overall: "healthy" | "warning" | "critical"): SignalStatus {
  if (overall === "healthy") return "good";
  if (overall === "warning") return "warning";
  return "critical";
}

export function GuardianOverview({ activeSessions }: GuardianOverviewProps) {
  const { data: health, isLoading: healthLoading } = useGuardianHealth();
  const { data: sessionStats, isLoading: sessionsLoading } = useSessionHistory("today");

  const healthStatus = health?.overall ?? "healthy";
  const healthSignalCount = health?.totalSignals ?? 0;
  const avgDuration = sessionStats?.avgDurationMinutes ?? 0;

  return (
    <div className="space-y-6">
      {/* Signal Cards -- top row */}
      <div className="grid grid-cols-4 gap-4">
        <SignalCard
          label="Aktive sesjoner"
          value={activeSessions}
          status={activeSessions > 10 ? "warning" : "good"}
          icon={<Activity className="h-[18px] w-[18px]" />}
          trend={
            sessionStats
              ? {
                  direction: sessionStats.total > 0 ? "up" : "flat",
                  label: `${sessionStats.total} i dag`,
                }
              : undefined
          }
        />
        <SignalCard
          label="Helsestatus"
          value={
            healthLoading
              ? "..."
              : healthStatus === "healthy"
                ? "Frisk"
                : healthStatus === "warning"
                  ? "Advarsel"
                  : "Kritisk"
          }
          status={healthToStatus(healthStatus)}
          icon={<Heart className="h-[18px] w-[18px]" />}
          secondary={
            healthSignalCount > 0 ? `${healthSignalCount} aktive signaler` : "Ingen signaler"
          }
        />
        <SignalCard
          label="Snitt varighet"
          value={sessionsLoading ? "..." : avgDuration > 0 ? `${avgDuration}m` : "\u2014"}
          status={avgDuration > 15 ? "warning" : "good"}
          icon={<Clock className="h-[18px] w-[18px]" />}
          trend={
            sessionStats
              ? {
                  direction:
                    sessionStats.completionRate >= 80
                      ? "up"
                      : sessionStats.completionRate >= 50
                        ? "flat"
                        : "down",
                  label: `${sessionStats.completionRate}% fullfort`,
                }
              : undefined
          }
        />
        <SignalCard
          label="Sesjoner i dag"
          value={sessionsLoading ? "..." : (sessionStats?.total ?? 0)}
          status="good"
          icon={<Wrench className="h-[18px] w-[18px]" />}
          secondary={
            sessionStats
              ? `${sessionStats.completed} fullfort, ${sessionStats.abandoned} avbrutt`
              : undefined
          }
        />
      </div>

      {/* Active Alerts */}
      <div>
        <h2 className="text-foreground mb-3 text-sm font-bold tracking-widest uppercase">
          Aktive varsler
        </h2>
        <AlertsList />
      </div>
    </div>
  );
}
