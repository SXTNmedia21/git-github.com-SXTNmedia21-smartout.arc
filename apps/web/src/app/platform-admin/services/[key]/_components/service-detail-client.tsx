"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ExternalLink, Container, ScrollText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { SERVICE_REGISTRY } from "../../_components/service-config";
import { SERVICE_MAP, type ServiceEntry } from "../../../keys/_components/service-registry";
import { CONTRACT_MAP } from "../../_components/service-contracts";
import { EndpointTestCard } from "./endpoint-test-card";
import type { ServicesHealthResponse } from "@/app/api/platform-admin/services/health/route";

type SecretRow = {
  id: string;
  vault_secret_name: string;
  is_active: boolean;
  environment: string;
  last_rotated_at: string | null;
};

type Props = { serviceKey: string };

export function ServiceDetailClient({ serviceKey }: Props) {
  const service = SERVICE_REGISTRY.find((s) => s.key === serviceKey)!;

  const [health, setHealth] = useState<ServicesHealthResponse | null>(null);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [healthRes, secretsRes] = await Promise.all([
      fetch("/api/platform-admin/services/health"),
      fetch("/api/platform-admin/secrets"),
    ]);
    if (healthRes.ok) setHealth(await healthRes.json());
    if (secretsRes.ok) {
      const json = await secretsRes.json();
      if (json.data) setSecrets(json.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Health entry for this service
  const healthEntry = useMemo(() => {
    if (!health) return null;
    return health.services.find((s) => s.name === serviceKey) ?? null;
  }, [health, serviceKey]);

  // Related env var entries from keys registry
  const envVarEntries = useMemo(() => {
    return service.envVarKeys
      .map((key) => SERVICE_MAP.get(key))
      .filter((e): e is ServiceEntry => e !== undefined);
  }, [service.envVarKeys]);

  // Secret lookup
  const secretMap = useMemo(() => {
    return new Map(secrets.map((s) => [s.vault_secret_name, s]));
  }, [secrets]);

  // Service contract endpoints
  const contract = CONTRACT_MAP.get(serviceKey);

  const configuredCount = envVarEntries.filter((e) => secretMap.has(e.key)).length;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/platform-admin/services"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Services
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{service.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{service.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {service.docsUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={service.docsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Docs
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Planned banner */}
      {service.status === "planned" && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-4 py-3">
          <Clock className="text-muted-foreground h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Planned service — not yet installed</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Port {service.port} reserved. Will appear in health checks once deployed.
            </p>
          </div>
        </div>
      )}

      {/* Health */}
      {service.status === "active" && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium">Health</h2>
          {loading && !healthEntry ? (
            <div className="h-10 animate-pulse rounded bg-zinc-800/30" />
          ) : healthEntry ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  {healthEntry.status === "healthy" && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-3 w-3 rounded-full",
                      healthEntry.status === "healthy" && "bg-emerald-500",
                      healthEntry.status === "degraded" && "bg-orange-500",
                      healthEntry.status === "down" && "bg-red-500",
                    )}
                  />
                </span>
                <div>
                  <p className="text-sm font-medium capitalize">{healthEntry.status}</p>
                  {healthEntry.error && healthEntry.status !== "healthy" && (
                    <p className="text-muted-foreground text-xs">{healthEntry.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {healthEntry.version && (
                  <span className="text-muted-foreground text-xs">{healthEntry.version}</span>
                )}
                {healthEntry.responseTime != null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs tabular-nums",
                      healthEntry.responseTime < 200
                        ? "border-emerald-500/20 text-emerald-500"
                        : healthEntry.responseTime < 500
                          ? "border-orange-500/20 text-orange-500"
                          : "border-red-500/20 text-red-500",
                    )}
                  >
                    {healthEntry.responseTime}ms
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs tabular-nums">
                  port {service.port}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Service not responding.</p>
          )}
        </Card>
      )}

      {/* Configuration */}
      {envVarEntries.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Configuration</h2>
            <span className="text-muted-foreground text-xs">
              {configuredCount}/{envVarEntries.length} in Vault
            </span>
          </div>
          <div className="space-y-2">
            {envVarEntries.map((entry) => {
              const secret = secretMap.get(entry.key);
              const configured = !!secret;
              return (
                <div
                  key={entry.key}
                  className="flex items-center justify-between rounded-md border px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        configured ? "bg-emerald-500" : "bg-zinc-400",
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium">{entry.label}</p>
                      <code className="text-muted-foreground text-[11px]">{entry.envVar}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {secret?.environment && (
                      <Badge variant="outline" className="text-[10px]">
                        {secret.environment}
                      </Badge>
                    )}
                    {secret?.last_rotated_at && (
                      <span className="text-muted-foreground text-xs">
                        {new Date(secret.last_rotated_at).toLocaleDateString("no-NO")}
                      </span>
                    )}
                    <Link href="/platform-admin/keys">
                      <Button
                        variant={configured ? "ghost" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                      >
                        {configured ? "Update" : "Configure"}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* API Endpoints (from service contract) */}
      {contract && contract.endpoints.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium">API Endpoints ({contract.endpoints.length})</h2>
          <div className="space-y-1">
            {contract.endpoints.map((ep) => (
              <EndpointTestCard
                key={`${ep.method}-${ep.path}`}
                endpoint={ep}
                serviceKey={serviceKey}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Actions (placeholder for service layer) */}
      {service.dockerContainer && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium">Actions</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Container className="mr-1 h-3.5 w-3.5" />
              Restart Container
            </Button>
            <Button variant="outline" size="sm" disabled>
              <ScrollText className="mr-1 h-3.5 w-3.5" />
              View Logs
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Container: <code>{service.dockerContainer}</code> — management requires the Service
            Layer.
          </p>
        </Card>
      )}
    </div>
  );
}
