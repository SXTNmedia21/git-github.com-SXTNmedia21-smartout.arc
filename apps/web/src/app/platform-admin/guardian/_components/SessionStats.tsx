"use client";

// UI Events:
// - visual: completion/abandoned rate cards, by-mission/by-channel breakdown
// - color-regime: rate-based (>=80% good, >=50% warning, <50% critical)

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionStats as SessionStatsData } from "../_hooks/useSessionHistory";

type SessionStatsProps = {
  stats: SessionStatsData | undefined;
  isLoading: boolean;
};

function StatCard({
  label,
  value,
  suffix,
  variant,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  variant?: "good" | "warning" | "critical";
}) {
  const valueColor =
    variant === "critical"
      ? "text-red-400"
      : variant === "warning"
        ? "text-orange-400"
        : "text-foreground";

  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${valueColor}`}>{value}</span>
        {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
      </div>
    </Card>
  );
}

function rateVariant(rate: number): "good" | "warning" | "critical" {
  if (rate >= 80) return "good";
  if (rate >= 50) return "warning";
  return "critical";
}

export function SessionStats({ stats, isLoading }: SessionStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[80px] animate-pulse rounded-lg bg-zinc-800/30" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-muted-foreground text-sm">Ingen sesjonsdata tilgjengelig.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Totalt" value={stats.total} suffix="sesjoner" />
        <StatCard
          label="Fullforingsrate"
          value={`${stats.completionRate}%`}
          variant={rateVariant(stats.completionRate)}
        />
        <StatCard
          label="Avbrutt"
          value={`${stats.abandonedRate}%`}
          variant={stats.abandonedRate > 20 ? "warning" : "good"}
        />
        <StatCard
          label="Snitt varighet"
          value={stats.avgDurationMinutes > 0 ? stats.avgDurationMinutes : "—"}
          suffix={stats.avgDurationMinutes > 0 ? "min" : undefined}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-2 gap-4">
        {/* By Channel */}
        <Card className="p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
            Per kanal
          </h4>
          {Object.keys(stats.byChannel).length === 0 ? (
            <p className="text-muted-foreground text-xs">Ingen data</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byChannel)
                .sort(([, a], [, b]) => b - a)
                .map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {channel}
                    </Badge>
                    <span className="text-foreground text-sm font-medium">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* By Mission */}
        <Card className="p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
            Per oppdrag
          </h4>
          {Object.keys(stats.byMission).length === 0 ? (
            <p className="text-muted-foreground text-xs">Ingen data</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byMission)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([mission, count]) => (
                  <div key={mission} className="flex items-center justify-between gap-2">
                    <span className="text-foreground truncate text-xs font-medium">
                      {mission === "agent_mode" ? "Agent-modus" : mission}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
