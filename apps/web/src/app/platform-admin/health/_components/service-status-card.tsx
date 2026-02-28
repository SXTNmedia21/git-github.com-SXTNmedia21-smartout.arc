"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ServiceStatusCardProps = {
  name: string;
  status: "operational" | "degraded" | "down";
  latency_ms: number | null;
  version: string | null;
  error: string | null;
};

const statusDot: Record<string, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-orange-500",
  down: "bg-red-500",
};

export function ServiceStatusCard({
  name,
  status,
  latency_ms,
  version,
  error,
}: ServiceStatusCardProps) {
  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          {status === "operational" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={cn("relative inline-flex h-3 w-3 rounded-full", statusDot[status])} />
        </span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          {error && status !== "operational" && (
            <p className="text-muted-foreground max-w-[200px] truncate text-xs">{error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {version && <span className="text-muted-foreground text-xs">{version}</span>}
        {latency_ms !== null && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs tabular-nums",
              latency_ms < 200
                ? "border-emerald-500/20 text-emerald-500"
                : latency_ms < 500
                  ? "border-orange-500/20 text-orange-500"
                  : "border-red-500/20 text-red-500",
            )}
          >
            {latency_ms}ms
          </Badge>
        )}
      </div>
    </Card>
  );
}
