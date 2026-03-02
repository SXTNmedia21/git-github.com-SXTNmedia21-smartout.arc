"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SERVICE_REGISTRY } from "./service-config";

type ServiceCardProps = {
  name: string;
  status: "healthy" | "degraded" | "down";
  responseTime: number | null;
  checkedAt: string;
  version: string | null;
  error?: string;
};

const statusConfig = {
  healthy: {
    dot: "bg-emerald-500",
    label: "Healthy",
    badge: "border-emerald-500/20 text-emerald-500",
  },
  degraded: {
    dot: "bg-orange-500",
    label: "Degraded",
    badge: "border-orange-500/20 text-orange-500",
  },
  down: { dot: "bg-red-500", label: "Down", badge: "border-red-500/20 text-red-500" },
} as const;

export function ServiceCard({
  name,
  status,
  responseTime,
  checkedAt,
  version,
  error,
}: ServiceCardProps) {
  const config = statusConfig[status];
  const def = SERVICE_REGISTRY.find((s) => s.key === name);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {status === "healthy" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", config.dot)} />
          </span>
          <h3 className="text-sm font-semibold">{def?.name ?? name}</h3>
        </div>
        <Badge variant="outline" className={cn("text-xs", config.badge)}>
          {config.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-1 pb-3">
        {responseTime !== null && (
          <p className="text-muted-foreground text-xs">
            Response:{" "}
            <span
              className={cn(
                "font-mono tabular-nums",
                responseTime < 200
                  ? "text-emerald-500"
                  : responseTime < 500
                    ? "text-orange-500"
                    : "text-red-500",
              )}
            >
              {responseTime}ms
            </span>
          </p>
        )}
        {version && <p className="text-muted-foreground text-xs">Version: {version}</p>}
        {error && status !== "healthy" && (
          <p className="max-w-full truncate text-xs text-red-400">{error}</p>
        )}
        {checkedAt && (
          <p className="text-muted-foreground text-xs">
            Checked: {new Date(checkedAt).toLocaleTimeString("no-NO")}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <p className="text-muted-foreground text-xs">{def?.description ?? ""}</p>
      </CardFooter>
    </Card>
  );
}
