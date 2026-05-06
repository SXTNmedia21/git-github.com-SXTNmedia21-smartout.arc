"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Clock } from "lucide-react";
import type { ServiceConfigRow } from "../_hooks/use-service-configs";
import { platformAdminRoutes } from "@/lib/platform-admin-routes";

// --- Type badge colors ---
const typeColors: Record<string, string> = {
  docker: "border-blue-500/30 text-blue-400",
  vercel: "border-violet-500/30 text-violet-400",
  "edge-function": "border-amber-500/30 text-amber-400",
  external: "border-border text-muted-foreground",
};

// --- Status config ---
const statusConfig = {
  active: { dot: "bg-emerald-500", label: "Active" },
  stopped: { dot: "bg-red-500", label: "Stopped" },
  error: { dot: "bg-red-500", label: "Error" },
  unconfigured: { dot: "bg-muted-foreground", label: "Unconfigured" },
} as const;

const healthStatusConfig = {
  healthy: {
    dot: "bg-emerald-500",
    badge: "border-emerald-500/20 text-emerald-500",
  },
  degraded: {
    dot: "bg-orange-500",
    badge: "border-orange-500/20 text-orange-500",
  },
  down: { dot: "bg-red-500", badge: "border-red-500/20 text-red-500" },
} as const;

// --- DB-backed card ---
type DbServiceCardProps = {
  config: ServiceConfigRow;
  healthStatus: "healthy" | "degraded" | "down" | null;
  responseTime: number | null;
  version: string | null;
  error?: string;
};

export function DbServiceCard({
  config,
  healthStatus,
  responseTime,
  version,
  error,
}: DbServiceCardProps) {
  const sConfig = statusConfig[config.status as keyof typeof statusConfig];
  const hConfig = healthStatus ? healthStatusConfig[healthStatus] : null;

  return (
    <Link href={platformAdminRoutes.serviceDetail(config.slug)}>
      <Card
        className={cn(
          "hover:border-primary/40 cursor-pointer transition-colors",
          healthStatus === "down" && "border-red-500/40 bg-red-500/5",
          healthStatus === "degraded" && "border-orange-500/30",
          config.status === "unconfigured" && "border-dashed opacity-70",
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {healthStatus === "healthy" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-3 w-3 rounded-full",
                  hConfig?.dot ?? sConfig?.dot ?? "bg-muted-foreground",
                )}
              />
            </span>
            <h3 className="text-sm font-semibold">{config.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", typeColors[config.type])}>
              {config.type}
            </Badge>
            {config.is_critical && (
              <Badge variant="outline" className="border-red-500/30 text-[10px] text-red-400">
                Critical
              </Badge>
            )}
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
          {error && healthStatus !== "healthy" && (
            <p className="max-w-full truncate text-xs text-red-400">{error}</p>
          )}
          {config.port && (
            <p className="text-muted-foreground text-xs tabular-nums">port {config.port}</p>
          )}
        </CardContent>

        <CardFooter className="flex items-center gap-2 pt-0">
          <p className="text-muted-foreground flex-1 truncate text-xs">
            {config.description ?? ""}
          </p>
          {config.tags &&
            (config.tags as string[]).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-muted-foreground text-[9px]">
                {tag}
              </Badge>
            ))}
        </CardFooter>
      </Card>
    </Link>
  );
}

// --- Legacy cards (kept for backwards compat during migration) ---
type PlannedServiceCardProps = {
  name: string;
  description: string;
  serviceKey: string;
};

export function PlannedServiceCard({ name, description, serviceKey }: PlannedServiceCardProps) {
  return (
    <Link href={platformAdminRoutes.serviceDetail(serviceKey)}>
      <Card className="cursor-pointer border-dashed opacity-60 transition-opacity hover:opacity-80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="bg-muted-foreground relative inline-flex h-3 w-3 rounded-full" />
            </span>
            <h3 className="text-sm font-semibold">{name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground border-border text-xs">
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

export function ServiceCard({
  name,
  status,
  responseTime,
  checkedAt,
  version,
  error,
}: ServiceCardProps) {
  const config = healthStatusConfig[status as keyof typeof healthStatusConfig];

  return (
    <Link href={platformAdminRoutes.serviceDetail(name)}>
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
            <h3 className="text-sm font-semibold">{name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", config.badge)}>
              {status}
            </Badge>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pb-3">
          {responseTime !== null && (
            <p className="text-muted-foreground text-xs">
              Response: <span className="font-mono tabular-nums">{responseTime}ms</span>
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
      </Card>
    </Link>
  );
}
