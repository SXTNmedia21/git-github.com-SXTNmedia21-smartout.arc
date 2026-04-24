"use client";

import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Server, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { useServiceHealth } from "../_hooks/use-service-health";
import { useServiceConfigs, type ServiceConfigRow } from "../_hooks/use-service-configs";
import { ServiceCard, DbServiceCard } from "./service-card";
import { AddServiceDialog } from "./add-service-dialog";
import { SetupBanner } from "./setup-banner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

type TypeFilter = "all" | "docker" | "vercel" | "edge-function" | "external";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "docker", label: "Docker" },
  { value: "vercel", label: "Vercel" },
  { value: "edge-function", label: "Edge Functions" },
  { value: "external", label: "External" },
];

function ServicesContent() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const {
    data: healthData,
    isLoading: healthLoading,
    isFetching,
    refetch,
  } = useServiceHealth(autoRefresh);
  const { data: configs, isLoading: configsLoading } = useServiceConfigs();

  const healthMap = useMemo(() => {
    if (!healthData) return new Map();
    return new Map(healthData.services.map((s) => [s.name, s]));
  }, [healthData]);

  const filteredConfigs = useMemo(() => {
    if (!configs) return [];
    if (typeFilter === "all") return configs;
    return configs.filter((c) => c.type === typeFilter);
  }, [configs, typeFilter]);

  const summary = useMemo(() => {
    if (!healthData) return null;
    const down = healthData.services.filter((s) => s.status === "down");
    const degraded = healthData.services.filter((s) => s.status === "degraded");
    const healthy = healthData.services.filter((s) => s.status === "healthy");
    return { down, degraded, healthy, total: healthData.services.length };
  }, [healthData]);

  const isLoading = healthLoading && configsLoading;

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
            Service configuration and real-time health monitoring
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
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Service
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

      {/* Setup banner */}
      {configs && <SetupBanner services={configs} />}

      {/* Type filter chips */}
      <div className="flex items-center gap-2">
        {TYPE_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? (configs?.length ?? 0)
              : (configs?.filter((c) => c.type === f.value).length ?? 0);
          return (
            <Badge
              key={f.value}
              variant={typeFilter === f.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
              <span className="text-muted-foreground ml-1 text-[10px]">{count}</span>
            </Badge>
          );
        })}
      </div>

      {/* Service cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && !configs
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted/30 h-[180px] animate-pulse rounded-lg border" />
            ))
          : filteredConfigs.map((svc) => {
              const health = healthMap.get(svc.slug);
              return (
                <DbServiceCard
                  key={svc.service_id}
                  config={svc}
                  healthStatus={health?.status ?? null}
                  responseTime={health?.responseTime ?? null}
                  version={health?.version ?? null}
                  error={health?.error}
                />
              );
            })}
      </div>

      {filteredConfigs.length === 0 && !isLoading && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No services found for this filter.
        </p>
      )}

      <AddServiceDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
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
