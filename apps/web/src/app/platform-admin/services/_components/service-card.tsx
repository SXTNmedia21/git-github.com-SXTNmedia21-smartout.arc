"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Clock } from "lucide-react";
import { SERVICE_REGISTRY } from "./service-config";

type PlannedServiceCardProps = {
  name: string;
  description: string;
  serviceKey: string;
};

export function PlannedServiceCard({ name, description, serviceKey }: PlannedServiceCardProps) {
  return (
    <Link href={`/platform-admin/services/${serviceKey}`}>
      <Card className="cursor-pointer border-dashed opacity-60 transition-opacity hover:opacity-80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="relative inline-flex h-3 w-3 rounded-full bg-zinc-500" />
            </span>
            <h3 className="text-sm font-semibold">{name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground border-zinc-500/30 text-xs">
              <Clock className="mr-1 h-3 w-3" />
              Planned
            </Badge>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-muted-foreground text-xs">Not installed</p>
        </CardContent>
        <CardFooter className="pt-0">
          <p className="text-muted-foreground text-xs">{description}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}

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
    <Link href={`/platform-admin/services/${name}`}>
      <Card
        className={cn(
          "cursor-pointer transition-colors",
          status === "down" && "border-red-500/40 bg-red-500/5",
          status === "degraded" && "border-orange-500/30",
          status === "healthy" && "hover:border-primary/40",
        )}
      >
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", config.badge)}>
              {config.label}
            </Badge>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </div>
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
    </Link>
  );
}
