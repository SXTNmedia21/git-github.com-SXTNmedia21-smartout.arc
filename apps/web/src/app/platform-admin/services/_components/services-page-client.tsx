"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Server } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { useServiceHealth } from "../_hooks/use-service-health";
import { ServiceCard, PlannedServiceCard } from "./service-card";
import { SERVICE_REGISTRY } from "./service-config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ServicesContent() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, isLoading, isFetching, refetch } = useServiceHealth(autoRefresh);

  const summary = useMemo(() => {
    if (!data) return null;
    const down = data.services.filter((s) => s.status === "down");
    const degraded = data.services.filter((s) => s.status === "degraded");
    const healthy = data.services.filter((s) => s.status === "healthy");
    return { down, degraded, healthy, total: data.services.length };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Server className="h-6 w-6" />
            Services
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time health of Smartout microservices
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-muted-foreground text-xs">
              Auto-refresh (30s)
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
            Check All
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {summary && (summary.down.length > 0 || summary.degraded.length > 0) && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            summary.down.length > 0
              ? "border-red-500/30 bg-red-500/10"
              : "border-orange-500/30 bg-orange-500/10",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              summary.down.length > 0 ? "text-red-500" : "text-orange-500",
            )}
          />
          <div>
            <p className="text-sm font-medium">
              {summary.down.length > 0
                ? `${summary.down.length} service${summary.down.length > 1 ? "s" : ""} down`
                : `${summary.degraded.length} service${summary.degraded.length > 1 ? "s" : ""} degraded`}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {[...summary.down.map((s) => s.name), ...summary.degraded.map((s) => s.name)].join(
                ", ",
              )}
              {summary.down.length > 0 && summary.down[0]?.error && ` — ${summary.down[0]?.error}`}
            </p>
          </div>
        </div>
      )}

      {summary &&
        summary.down.length === 0 &&
        summary.degraded.length === 0 &&
        summary.healthy.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-sm font-medium">All {summary.total} services operational</p>
          </div>
        )}

      {/* Last check timestamp */}
      {data?.services[0]?.checkedAt && (
        <p className="text-muted-foreground text-xs">
          Last check: {new Date(data.services[0].checkedAt).toLocaleTimeString("no-NO")}
        </p>
      )}

      {/* Service cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && !data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[180px] animate-pulse rounded-lg border bg-zinc-800/30" />
            ))
          : data?.services.map((svc) => (
              <ServiceCard
                key={svc.name}
                name={svc.name}
                status={svc.status}
                responseTime={svc.responseTime}
                checkedAt={svc.checkedAt}
                version={svc.version}
                error={svc.error}
              />
            ))}
        {/* Planned services — not health-checked */}
        {SERVICE_REGISTRY.filter((s) => s.status === "planned").map((svc) => (
          <PlannedServiceCard
            key={svc.key}
            name={svc.name}
            description={svc.description}
            serviceKey={svc.key}
          />
        ))}
      </div>
    </div>
  );
}

export function ServicesPageClient() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContent />
    </QueryClientProvider>
  );
}
