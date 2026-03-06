"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Container,
  ScrollText,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useServiceConfig,
  useUpdateServiceConfig,
  useRestartService,
  useDeleteService,
} from "../../_hooks/use-service-configs";
import { CONTRACT_MAP } from "../../_components/service-contracts";
import { EndpointTestCard } from "./endpoint-test-card";
import type { ServicesHealthResponse } from "@/app/api/platform-admin/services/health/route";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000 } },
});

type SecretRow = {
  id: string;
  vault_secret_name: string;
  is_active: boolean;
  environment: string;
  last_rotated_at: string | null;
};

type LogRow = {
  log_id: string;
  field_name: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  applied: boolean;
  created_at: string;
};

function DetailContent({ serviceKey }: { serviceKey: string }) {
  const { data: config, isLoading: configLoading } = useServiceConfig(serviceKey);
  const updateMutation = useUpdateServiceConfig(serviceKey);
  const restartMutation = useRestartService(serviceKey);
  const deleteMutation = useDeleteService(serviceKey);

  const [health, setHealth] = useState<ServicesHealthResponse | null>(null);
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable config fields
  const [editHostUrl, setEditHostUrl] = useState("");
  const [editPort, setEditPort] = useState("");
  const [editHealthEndpoint, setEditHealthEndpoint] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [configDirty, setConfigDirty] = useState(false);

  // Sync editable fields when config loads
  useEffect(() => {
    if (config) {
      setEditHostUrl(config.host_url ?? "");
      setEditPort(config.port?.toString() ?? "");
      setEditHealthEndpoint(config.health_endpoint ?? "/health");
      setEditDescription(config.description ?? "");
    }
  }, [config]);

  const fetchSideData = useCallback(async () => {
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
    fetchSideData();
  }, [fetchSideData]);

  // Health entry
  const healthEntry = useMemo(() => {
    if (!health) return null;
    return health.services.find((s) => s.name === serviceKey) ?? null;
  }, [health, serviceKey]);

  // Vault secrets for this service
  const serviceSecrets = useMemo(() => {
    if (!config?.vault_secrets) return [];
    const vaultNames = config.vault_secrets as string[];
    return vaultNames.map((name) => ({
      name,
      configured: secrets.some((s) => s.vault_secret_name === name),
      secret: secrets.find((s) => s.vault_secret_name === name),
    }));
  }, [config, secrets]);

  // Env schema
  const envSchema = useMemo(() => {
    if (!config?.env_schema) return [];
    return config.env_schema as Array<{
      key: string;
      required: boolean;
      change_type: string;
      description: string;
    }>;
  }, [config]);

  // Contract endpoints
  const contract = CONTRACT_MAP.get(serviceKey);

  function handleSaveConfig() {
    const updates: Record<string, unknown> = {};
    if (editHostUrl !== (config?.host_url ?? "")) updates.host_url = editHostUrl || null;
    if (editPort !== (config?.port?.toString() ?? ""))
      updates.port = editPort ? parseInt(editPort, 10) : null;
    if (editHealthEndpoint !== (config?.health_endpoint ?? "/health"))
      updates.health_endpoint = editHealthEndpoint;
    if (editDescription !== (config?.description ?? ""))
      updates.description = editDescription || null;

    if (Object.keys(updates).length === 0) return;

    updateMutation.mutate(updates as never, {
      onSuccess: () => {
        toast.success("Configuration saved");
        setConfigDirty(false);
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleRestart() {
    restartMutation.mutate(undefined, {
      onSuccess: () => toast.success("Container restarted"),
      onError: (err) => toast.error(err.message),
    });
  }

  function handleDelete() {
    if (!confirm("Delete this service? This cannot be undone.")) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Service deleted");
        window.location.href = "/platform-admin/services";
      },
      onError: (err) => toast.error(err.message),
    });
  }

  if (configLoading || !config) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-800/30" />
        <div className="h-64 animate-pulse rounded-lg border bg-zinc-800/30" />
      </div>
    );
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{config.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                config.type === "docker" && "border-blue-500/30 text-blue-400",
                config.type === "vercel" && "border-violet-500/30 text-violet-400",
                config.type === "edge-function" && "border-amber-500/30 text-amber-400",
                config.type === "external" && "border-zinc-500/30 text-zinc-400",
              )}
            >
              {config.type}
            </Badge>
            {config.is_critical && (
              <Badge variant="outline" className="border-red-500/30 text-xs text-red-400">
                Critical
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSideData} disabled={loading}>
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{config.description}</p>
      </div>

      {/* Health Card */}
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
              {config.port && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  port {config.port}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No health data available.</p>
        )}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="env">Environment ({envSchema.length})</TabsTrigger>
          <TabsTrigger value="secrets">Secrets ({serviceSecrets.length})</TabsTrigger>
          {contract && (
            <TabsTrigger value="endpoints">Endpoints ({contract.endpoints.length})</TabsTrigger>
          )}
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Host URL</Label>
                <Input
                  value={editHostUrl}
                  onChange={(e) => {
                    setEditHostUrl(e.target.value);
                    setConfigDirty(true);
                  }}
                  placeholder="http://localhost:5010"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={editPort}
                  onChange={(e) => {
                    setEditPort(e.target.value);
                    setConfigDirty(true);
                  }}
                  placeholder="5010"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Health Endpoint</Label>
              <Input
                value={editHealthEndpoint}
                onChange={(e) => {
                  setEditHealthEndpoint(e.target.value);
                  setConfigDirty(true);
                }}
                placeholder="/health"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  setConfigDirty(true);
                }}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted-foreground text-xs">
                Slug: <code>{config.slug}</code> | ID:{" "}
                <code className="text-[10px]">{config.service_id}</code>
              </p>
              <Button
                size="sm"
                disabled={!configDirty || updateMutation.isPending}
                onClick={handleSaveConfig}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Environment Tab */}
        <TabsContent value="env">
          <Card className="p-4">
            {envSchema.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No environment variables defined for this service.
              </p>
            ) : (
              <div className="space-y-2">
                {envSchema.map((env) => (
                  <div
                    key={env.key}
                    className="flex items-center justify-between rounded-md border px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          env.required ? "bg-amber-500" : "bg-zinc-400",
                        )}
                      />
                      <div>
                        <code className="text-sm font-medium">{env.key}</code>
                        <p className="text-muted-foreground text-xs">{env.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          env.change_type === "restart"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-emerald-500/30 text-emerald-400",
                        )}
                      >
                        {env.change_type}
                      </Badge>
                      {env.required && (
                        <Badge variant="outline" className="text-[10px] text-red-400">
                          required
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Secrets Tab */}
        <TabsContent value="secrets">
          <Card className="p-4">
            {serviceSecrets.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No Vault secrets linked to this service.
              </p>
            ) : (
              <div className="space-y-2">
                {serviceSecrets.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-md border px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          s.configured ? "bg-emerald-500" : "bg-zinc-400",
                        )}
                      />
                      <div>
                        <code className="text-sm font-medium">{s.name}</code>
                        {s.secret?.last_rotated_at && (
                          <p className="text-muted-foreground text-xs">
                            Rotated:{" "}
                            {new Date(s.secret.last_rotated_at).toLocaleDateString("no-NO")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link href="/platform-admin/keys">
                      <Button
                        variant={s.configured ? "ghost" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                      >
                        {s.configured ? "Update" : "Configure"}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Endpoints Tab */}
        {contract && (
          <TabsContent value="endpoints">
            <Card className="p-4">
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
          </TabsContent>
        )}

        {/* Actions Tab */}
        <TabsContent value="actions">
          <Card className="space-y-4 p-4">
            <h3 className="text-sm font-medium">Service Actions</h3>

            {config.type === "docker" && config.docker_service_name && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestart}
                  disabled={restartMutation.isPending}
                >
                  <Container className="mr-1.5 h-3.5 w-3.5" />
                  {restartMutation.isPending ? "Restarting..." : "Restart Container"}
                </Button>
                <p className="text-muted-foreground text-xs">
                  Container: <code>{config.docker_service_name}</code>
                </p>
              </div>
            )}

            {config.type === "vercel" && config.vercel_project_id && (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" disabled>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Sync Env Vars
                </Button>
                <p className="text-muted-foreground text-xs">
                  Project: <code>{config.vercel_project_id}</code>
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting..." : "Delete Service"}
              </Button>
              <p className="text-muted-foreground mt-2 text-xs">
                This permanently removes the service configuration. It does not stop or remove the
                actual service.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Props = { serviceKey: string };

export function ServiceDetailClient({ serviceKey }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <DetailContent serviceKey={serviceKey} />
    </QueryClientProvider>
  );
}
