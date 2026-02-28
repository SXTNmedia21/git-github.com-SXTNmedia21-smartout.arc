"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Activity, Server, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HealthStatusResponse } from "@/app/api/platform-admin/health/status/route";

import { OverallStatusBanner } from "./overall-status-banner";
import { ServiceStatusCard } from "./service-status-card";
import { ExternalServicesCard } from "./external-services-card";
import { IntegrityChecksCard } from "./integrity-checks-card";
import { ApiRegistryTable } from "./api-registry-table";

type MetricsSnapshot = {
  total_users: number;
  total_workspaces: number;
  active_workspaces_24h: number;
  mrr_nok: number;
  computed_at: string;
};

type HealthPageClientProps = {
  initialMetrics: MetricsSnapshot | null;
};

export function HealthPageClient({ initialMetrics }: HealthPageClientProps) {
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (includeIntegrity = false) => {
    setLoading(true);
    try {
      const url = includeIntegrity
        ? "/api/platform-admin/health/status?include=integrity"
        : "/api/platform-admin/health/status";
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as HealthStatusResponse;
        setHealth(data);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
      setIntegrityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  function handleRunIntegrity() {
    setIntegrityLoading(true);
    fetchHealth(true);
  }

  const metrics = health?.metrics ?? initialMetrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platform Health</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time service status, external integrations, and API registry
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-muted-foreground text-xs">
              Updated {lastRefresh.toLocaleTimeString("no-NO")}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchHealth()} disabled={loading}>
            <RefreshCw className={loading ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="services">
            <Server className="mr-1.5 h-3.5 w-3.5" />
            Services
          </TabsTrigger>
          <TabsTrigger value="api-registry">
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            API Registry
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Status Banner */}
          {loading && !health ? (
            <div className="h-12 animate-pulse rounded-lg bg-zinc-800/50" />
          ) : health ? (
            <OverallStatusBanner status={health.overall} />
          ) : null}

          {/* Service Cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {loading && !health
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[68px] animate-pulse rounded-lg border bg-zinc-800/30"
                  />
                ))
              : health?.services.map((svc) => (
                  <ServiceStatusCard
                    key={svc.name}
                    name={svc.name}
                    status={svc.status}
                    latency_ms={svc.latency_ms}
                    version={svc.version}
                    error={svc.error}
                  />
                ))}
          </div>

          {/* External Services */}
          {health && <ExternalServicesCard services={health.external} />}

          {/* KPI Row */}
          {metrics && (
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Total Users</p>
                <p className="text-2xl font-semibold">{metrics.total_users}</p>
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Workspaces</p>
                <p className="text-2xl font-semibold">{metrics.total_workspaces}</p>
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Active 24h</p>
                <p className="text-2xl font-semibold">{metrics.active_workspaces_24h}</p>
              </Card>
              <Card className="p-4">
                <p className="text-muted-foreground text-xs uppercase">MRR (NOK)</p>
                <p className="text-2xl font-semibold">{metrics.mrr_nok.toLocaleString("no-NO")}</p>
              </Card>
            </div>
          )}

          {/* Integrity Checks */}
          <IntegrityChecksCard
            checks={health?.integrity ?? null}
            loading={integrityLoading}
            onRun={handleRunIntegrity}
          />

          {metrics?.computed_at && (
            <p className="text-muted-foreground text-xs">
              Metrics last computed: {new Date(metrics.computed_at).toLocaleString("no-NO")}
            </p>
          )}
        </TabsContent>

        {/* ── Services Tab ── */}
        <TabsContent value="services" className="space-y-4">
          {loading && !health ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-lg border bg-zinc-800/30" />
              ))}
            </div>
          ) : health ? (
            <div className="space-y-3">
              {health.services.map((svc) => (
                <ServiceStatusCard
                  key={svc.name}
                  name={svc.name}
                  status={svc.status}
                  latency_ms={svc.latency_ms}
                  version={svc.version}
                  error={svc.error}
                />
              ))}
              <ExternalServicesCard services={health.external} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Failed to load service status.</p>
          )}
        </TabsContent>

        {/* ── API Registry Tab ── */}
        <TabsContent value="api-registry">
          <ApiRegistryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
