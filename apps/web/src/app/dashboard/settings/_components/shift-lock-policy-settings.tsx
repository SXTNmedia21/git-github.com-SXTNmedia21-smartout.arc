"use client";

// ============================================
// shift-lock-policy-settings.tsx
// Manages workspace temporal shift lock rollout mode.
// Why: admins need a safe way to run shadow rollout before enforce.
// ============================================

import { useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

type LockMode = "enforce" | "shadow" | "off";

type ShiftLockPolicyRow = {
  workspace_id: string;
  lock_mode: LockMode;
  updated_at: string | null;
};

type ShiftLockAuditRow = {
  operation: "update" | "delete";
  reason_code: string;
  lock_mode: LockMode;
  is_enforced: boolean;
  created_at: string;
};

type ShiftLockSettingsPayload = {
  mode: LockMode;
  updatedAt: string | null;
  source: "default" | "explicit";
  latestAudit: ShiftLockAuditRow[];
};

type UntypedError = { message: string } | null;

type UntypedSelectResult = {
  data: unknown;
  error: UntypedError;
};

type UntypedListResult = {
  data: unknown[] | null;
  error: UntypedError;
};

type UntypedQueryBuilder = {
  select: (columns: string) => UntypedQueryBuilder;
  eq: (column: string, value: string) => UntypedQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => UntypedQueryBuilder;
  limit: (count: number) => Promise<UntypedListResult>;
  maybeSingle: () => Promise<UntypedSelectResult>;
  single: () => Promise<UntypedSelectResult>;
  upsert: (values: unknown, options?: { onConflict?: string }) => UntypedQueryBuilder;
};

type UntypedSupabaseClient = {
  from: (table: string) => UntypedQueryBuilder;
};

/**
 * Returns short mode description for admins.
 *
 * @param mode - Selected rollout mode.
 * @returns Human-readable mode explanation text.
 */
function getModeDescription(mode: LockMode): string {
  if (mode === "enforce") return "Blocks locked mutations and writes audit records.";
  if (mode === "shadow") return "Allows mutations but logs every violation for safe rollout.";
  return "Disables temporal lock checks and audit handling.";
}

/**
 * Maps mode to badge variant.
 *
 * @param mode - Selected rollout mode.
 * @returns Visual badge variant.
 */
function getModeBadgeVariant(mode: LockMode): "default" | "secondary" | "destructive" | "outline" {
  if (mode === "enforce") return "default";
  if (mode === "shadow") return "secondary";
  return "outline";
}

/**
 * Formats timestamp for compact UI display.
 *
 * @param iso - ISO timestamp from database.
 * @returns Localized timestamp string.
 */
function formatTimestamp(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}

/**
 * Security settings panel for temporal shift lock rollout mode.
 *
 * Why: this is the control-plane for switching from shadow to enforce.
 *
 * @returns Settings UI component.
 */
export function ShiftLockPolicySettings() {
  const ws = useWorkspaceOptional();
  const workspaceId = ws?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const rawSupabase = supabase as unknown as UntypedSupabaseClient; // SAFETY: Supabase join returns union type; runtime shape matches the cast

  const [selectedMode, setSelectedMode] = useState<LockMode>("enforce");

  const query = useQuery({
    queryKey: dashboardKeys.shiftLockPolicy(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async (): Promise<ShiftLockSettingsPayload> => {
      const policyQuery = rawSupabase.from("schedule_shift_lock_policy");

      const { data: policy, error: policyError } = await policyQuery
        .select("workspace_id, lock_mode, updated_at")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();

      if (policyError) throw new Error(policyError.message);

      const auditQuery = rawSupabase.from("schedule_shift_lock_audit");

      const { data: auditRows, error: auditError } = await auditQuery
        .select("operation, reason_code, lock_mode, is_enforced, created_at")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(5);

      if (auditError) throw new Error(auditError.message);

      if (!policy) {
        return {
          mode: "enforce",
          updatedAt: null,
          source: "default",
          latestAudit: (auditRows ?? []) as ShiftLockAuditRow[],
        };
      }

      return {
        mode: (policy as ShiftLockPolicyRow).lock_mode,
        updatedAt: (policy as ShiftLockPolicyRow).updated_at,
        source: "explicit",
        latestAudit: (auditRows ?? []) as ShiftLockAuditRow[],
      };
    },
  });

  const saveMode = useMutation({
    mutationFn: async (mode: LockMode) => {
      const policyQuery = rawSupabase.from("schedule_shift_lock_policy");

      const { data, error } = await policyQuery
        .upsert(
          {
            workspace_id: workspaceId!,
            lock_mode: mode,
          },
          { onConflict: "workspace_id" },
        )
        .select("workspace_id, lock_mode, updated_at")
        .single();

      if (error) throw new Error(error.message);
      return data as ShiftLockPolicyRow;
    },
    onSuccess: async (data) => {
      await emit({
        event: "shift_lock_policy updated",
        workspace_id: workspaceId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: { lock_mode: data.lock_mode },
        },
      });

      queryClient.invalidateQueries({
        queryKey: dashboardKeys.shiftLockPolicy(workspaceId ?? "none"),
      });
      toast.success(`Shift lock mode updated to "${data.lock_mode}"`);
    },
    onError: (error: Error) => {
      toast.error(`Could not save shift lock mode: ${error.message}`);
    },
  });

  useEffect(() => {
    if (query.data) {
      setSelectedMode(query.data.mode);
    }
  }, [query.data]);

  const hasUnsavedChange = useMemo(
    () => !!query.data && selectedMode !== query.data.mode,
    [query.data, selectedMode],
  );

  if (!workspaceId) {
    return (
      <div className="text-muted-foreground rounded-lg border p-4 text-sm">
        Workspace context is missing. Open this page from a workspace dashboard.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
        <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-foreground text-sm font-medium">Could not load shift lock policy</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{query.error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-semibold">Shift Lock Policy</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Controls whether started/past-date shifts are blocked, shadow-logged, or fully open.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Temporal Lock Rollout
          </CardTitle>
          <CardDescription>
            Use <span className="font-medium">shadow</span> during rollout. Switch to{" "}
            <span className="font-medium">enforce</span> after audit is clean. High-access users can
            override in enforce mode, and each override is audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <p className="text-muted-foreground text-xs uppercase">Current mode</p>
            <div className="flex items-center gap-3">
              <Badge variant={getModeBadgeVariant(query.data!.mode)}>{query.data!.mode}</Badge>
              <span className="text-muted-foreground text-sm">
                Last updated: {formatTimestamp(query.data!.updatedAt)}
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-muted-foreground text-xs uppercase">Change mode</p>
            <Select
              value={selectedMode}
              onValueChange={(value) => setSelectedMode(value as LockMode)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enforce">enforce</SelectItem>
                <SelectItem value="shadow">shadow</SelectItem>
                <SelectItem value="off">off</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">{getModeDescription(selectedMode)}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => saveMode.mutate(selectedMode)}
              disabled={!hasUnsavedChange || saveMode.isPending}
            >
              {saveMode.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save mode"
              )}
            </Button>
            {query.data!.source === "default" ? (
              <span className="text-muted-foreground text-xs">
                Using DB default fallback (enforce)
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent lock audit</CardTitle>
          <CardDescription>Latest temporal lock events in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.data!.latestAudit.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lock audit entries yet.</p>
          ) : (
            <div className="space-y-2">
              {query.data!.latestAudit.map((row, idx) => (
                <div
                  key={`${row.created_at}-${idx}`}
                  className="bg-muted/40 flex items-center justify-between rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={row.is_enforced ? "destructive" : "secondary"}>
                      {row.is_enforced ? "blocked" : "shadow"}
                    </Badge>
                    <span className="text-sm">{row.reason_code}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {row.operation} · {formatTimestamp(row.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
