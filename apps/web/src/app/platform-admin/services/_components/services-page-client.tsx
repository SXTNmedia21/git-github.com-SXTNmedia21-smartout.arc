"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RefreshCw, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { useServiceHealth } from "../_hooks/use-service-health";
import { ServiceCard } from "./service-card";

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

      {/* Last check timestamp */}
      {data?.services[0]?.checkedAt && (
        <p className="text-muted-foreground text-xs">
          Last check: {new Date(data.services[0].checkedAt).toLocaleTimeString("no-NO")}
        </p>
      )}

      {/* Service cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && !data
          ? Array.from({ length: 3 }).map((_, i) => (
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
      </div>
    </div>
  );
}

// cn utility import
import { cn } from "@/lib/utils";

export function ServicesPageClient() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContent />
    </QueryClientProvider>
  );
}
