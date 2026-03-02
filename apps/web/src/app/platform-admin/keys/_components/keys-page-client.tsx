"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Upload,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SERVICE_REGISTRY, type ServiceTab, TAG_LABELS, type ServiceTag } from "./service-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecretRow = {
  id: string;
  provider: string;
  environment: string;
  vault_secret_name: string;
  description: string | null;
  is_active: boolean;
  last_rotated_at: string | null;
  created_at: string;
};

type StagedValue = string;

const TAB_ORDER: ServiceTab[] = ["client", "server", "runtime", "webhooks"];

const TAB_LABELS_MAP: Record<ServiceTab, string> = {
  client: "Client Keys",
  server: "Server Keys",
  runtime: "Runtime & Infrastructure",
  webhooks: "Webhooks & Tokens",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeysPageClient() {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "configured" | "staged" | "missing">(
    "all",
  );
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [collapsedTabs, setCollapsedTabs] = useState<Set<ServiceTab>>(new Set());

  // Global environment — applies to ALL staged secrets on push
  const [environment, setEnvironment] = useState<"live" | "test">("test");

  // Config dialog state
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState(false);

  // Staged config — local values not yet pushed to Supabase
  const [staged, setStaged] = useState<Map<string, StagedValue>>(new Map());

  // ---------------------------------------------------------------------------
  // Fetch existing secrets from Supabase
  // ---------------------------------------------------------------------------

  const fetchSecrets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform-admin/secrets");
      const json = await res.json();
      if (res.ok && json.data) setSecrets(json.data);
    } catch {
      toast.error("Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const secretMap = useMemo(() => {
    const map = new Map<string, SecretRow>();
    for (const s of secrets) map.set(s.vault_secret_name, s);
    return map;
  }, [secrets]);

  const allServices = useMemo(() => {
    return SERVICE_REGISTRY.map((svc) => ({
      ...svc,
      secret: secretMap.get(svc.key) ?? null,
      stagedValue: staged.get(svc.key) ?? null,
    }));
  }, [secretMap, staged]);

  const filteredServices = useMemo(() => {
    return allServices.filter((svc) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !svc.label.toLowerCase().includes(q) &&
          !svc.envVar.toLowerCase().includes(q) &&
          !svc.provider.toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter === "configured" && !svc.secret) return false;
      if (statusFilter === "staged" && !svc.stagedValue) return false;
      if (statusFilter === "missing" && (svc.secret || svc.stagedValue)) return false;
      if (tagFilter !== "all" && svc.tag !== tagFilter) return false;
      return true;
    });
  }, [allServices, search, statusFilter, tagFilter]);

  // Group filtered services by tab
  const groupedFiltered = useMemo(() => {
    const groups: Record<ServiceTab, typeof filteredServices> = {
      client: [],
      server: [],
      runtime: [],
      webhooks: [],
    };
    for (const svc of filteredServices) groups[svc.tab].push(svc);
    return groups;
  }, [filteredServices]);

  const configuredCount = allServices.filter((s) => s.secret).length;
  const stagedCount = staged.size;

  const editService = useMemo(
    () => (editKey ? SERVICE_REGISTRY.find((s) => s.key === editKey) : null),
    [editKey],
  );

  // ---------------------------------------------------------------------------
  // Stage a secret (local config, not yet pushed)
  // ---------------------------------------------------------------------------

  function handleStage() {
    if (!editKey || !editValue.trim()) return;
    setStaged((prev) => {
      const next = new Map(prev);
      next.set(editKey, editValue.trim());
      return next;
    });
    toast.success(`${editService?.label ?? editKey} staged`);
    closeDialog();
  }

  function handleUnstage(key: string) {
    setStaged((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function closeDialog() {
    setEditKey(null);
    setEditValue("");
    setShowValue(false);
  }

  // ---------------------------------------------------------------------------
  // Push all staged secrets to Supabase (uses global environment)
  // ---------------------------------------------------------------------------

  async function handlePush() {
    if (staged.size === 0) return;
    setPushing(true);

    const entries = Array.from(staged.entries());
    let success = 0;
    let failed = 0;

    for (const [key, value] of entries) {
      const svc = SERVICE_REGISTRY.find((s) => s.key === key);
      if (!svc) continue;

      try {
        const res = await fetch("/api/platform-admin/secrets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: svc.provider,
            vault_secret_name: svc.key,
            secret_value: value,
            environment,
            description: `${svc.label} (${environment})`,
            rotation_reminder_days: 90,
          }),
        });

        if (res.ok) {
          success++;
          setStaged((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    if (success > 0) toast.success(`${success} secret${success > 1 ? "s" : ""} pushed to Vault`);
    if (failed > 0) toast.error(`${failed} failed — retry those`);

    setPushing(false);
    fetchSecrets();
  }

  // ---------------------------------------------------------------------------
  // Delete secret from Supabase
  // ---------------------------------------------------------------------------

  async function handleDelete(secret: SecretRow) {
    if (!confirm(`Delete ${secret.vault_secret_name}?`)) return;

    setDeletingId(secret.id);
    try {
      const res = await fetch("/api/platform-admin/secrets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: secret.id }),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(typeof json.error === "string" ? json.error : "Failed to delete");
        return;
      }

      toast.success("Deleted");
      fetchSecrets();
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Section collapse
  // ---------------------------------------------------------------------------

  function toggleTab(tab: ServiceTab) {
    setCollapsedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tab)) next.delete(tab);
      else next.add(tab);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function statusDot(svc: (typeof allServices)[number]) {
    if (svc.stagedValue) return "bg-amber-500";
    if (svc.secret) return "bg-emerald-500";
    return "bg-zinc-300 dark:bg-zinc-600";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Secrets Config</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {configuredCount}/{SERVICE_REGISTRY.length} in Vault
            {stagedCount > 0 && (
              <span className="ml-2 font-medium text-amber-500">· {stagedCount} staged</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSecrets}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          {stagedCount > 0 && (
            <Button onClick={handlePush} disabled={pushing}>
              {pushing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Push {stagedCount} to Supabase
            </Button>
          )}
        </div>
      </div>

      {/* Filters + Global Environment */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Environment — global, prominent */}
        <Select value={environment} onValueChange={(v) => setEnvironment(v as "live" | "test")}>
          <SelectTrigger className="h-9 w-[120px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="test">Test</SelectItem>
          </SelectContent>
        </Select>

        <div className="bg-border h-5 w-px" />

        {/* Search */}
        <div className="relative max-w-[200px]">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({allServices.length})</SelectItem>
            <SelectItem value="configured">In Vault ({configuredCount})</SelectItem>
            <SelectItem value="staged">Staged ({stagedCount})</SelectItem>
            <SelectItem value="missing">
              Missing ({allServices.length - configuredCount})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Tag filter */}
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {Object.entries(TAG_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground ml-auto text-xs">
          {filteredServices.length} shown
        </span>
      </div>

      {/* Grouped by category */}
      <div className="mt-4 space-y-4">
        {TAB_ORDER.map((tab) => {
          const tabServices = groupedFiltered[tab];
          if (tabServices.length === 0 && (search || statusFilter !== "all" || tagFilter !== "all"))
            return null;
          const collapsed = collapsedTabs.has(tab);
          const tabConfigured = tabServices.filter((s) => s.secret).length;
          const tabStaged = tabServices.filter((s) => s.stagedValue).length;

          return (
            <div key={tab}>
              {/* Category header */}
              <button
                type="button"
                className="flex w-full items-center gap-2 py-2 text-left"
                onClick={() => toggleTab(tab)}
              >
                {collapsed ? (
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                )}
                <span className="text-sm font-semibold">{TAB_LABELS_MAP[tab]}</span>
                <span className="text-muted-foreground text-xs">
                  {tabConfigured + tabStaged}/{tabServices.length}
                </span>
                {tabStaged > 0 && (
                  <Badge
                    variant="outline"
                    className="border-amber-500 px-1.5 py-0 text-[10px] text-amber-500"
                  >
                    {tabStaged} staged
                  </Badge>
                )}
              </button>

              {/* Service rows */}
              {!collapsed && (
                <div className="ml-6 space-y-1">
                  {tabServices.map((svc) => {
                    const isDeleting = deletingId === svc.secret?.id;

                    return (
                      <div
                        key={svc.key}
                        className="flex items-center justify-between rounded-md border px-4 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${statusDot(svc)}`} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{svc.label}</span>
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                {TAG_LABELS[svc.tag as ServiceTag]}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground mt-0.5 truncate text-xs">
                              <code className="text-[11px]">{svc.envVar}</code>
                              {svc.stagedValue && (
                                <span className="ml-2 text-amber-500">— staged</span>
                              )}
                              {!svc.stagedValue && svc.secret && (
                                <span className="ml-2">
                                  — {svc.secret.environment}
                                  {svc.secret.last_rotated_at && (
                                    <span>
                                      {" "}
                                      ·{" "}
                                      {new Date(svc.secret.last_rotated_at).toLocaleDateString(
                                        "no-NO",
                                      )}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          {svc.stagedValue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-amber-500 hover:text-amber-600"
                              onClick={() => handleUnstage(svc.key)}
                            >
                              Unstage
                            </Button>
                          )}

                          <Button
                            variant={svc.secret || svc.stagedValue ? "ghost" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditKey(svc.key);
                              setEditValue("");
                              setShowValue(false);
                            }}
                          >
                            {svc.secret ? "Update" : svc.stagedValue ? "Edit" : "Configure"}
                          </Button>

                          {svc.secret && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 w-7 p-0"
                              onClick={() => handleDelete(svc.secret!)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Configure / Stage Dialog */}
      <Dialog
        open={!!editKey}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editService?.label ?? "Configure Secret"}</DialogTitle>
            <DialogDescription>
              Stage locally. Push to Supabase Vault when ready.
              <br />
              Environment: <strong>{environment}</strong> (set globally above)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>
                Secret Value
                {editService?.prefix && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    (starts with {editService.prefix})
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showValue ? "text" : "password"}
                  placeholder={editService?.prefix ? `${editService.prefix}...` : "Paste value..."}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="pr-10 font-mono text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {editService?.prefix &&
                editValue.length > 3 &&
                !editValue.startsWith(editService.prefix) && (
                  <p className="text-xs text-amber-500">
                    Expected prefix &quot;{editService.prefix}&quot;
                  </p>
                )}
            </div>

            {editService?.docsUrl && (
              <p className="text-muted-foreground text-xs">
                Get your key at{" "}
                <a
                  href={editService.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {editService.provider} dashboard
                </a>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleStage} disabled={!editValue.trim()}>
              Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
