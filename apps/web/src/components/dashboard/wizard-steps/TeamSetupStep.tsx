"use client";

import { useState, useCallback, useMemo, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, CheckCircle2, Trash2, Send } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

type InviteRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  employmentForm: string;
  positionId: string;
  hourlyRate: number;
  status: "pending" | "sending" | "sent" | "error";
};

function createEmptyRow(): InviteRow {
  return {
    id: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    email: "",
    departmentId: "",
    employmentForm: "",
    positionId: "",
    hourlyRate: 0,
    status: "pending",
  };
}

// ─── InviteRowCard ──────────────────────────────────────────

function InviteRowCard({
  row,
  isDark,
  departments,
  positions,
  employmentForms,
  onUpdate,
  onRemove,
}: {
  row: InviteRow;
  isDark: boolean;
  departments: { department_id: string; name: string }[];
  positions: { position_id: string; name: string }[];
  employmentForms: { type: string; label: string }[];
  onUpdate: (id: string, patch: Partial<InviteRow>) => void;
  onRemove: (id: string) => void;
}) {
  const isSent = row.status === "sent";
  const isSending = row.status === "sending";
  const isError = row.status === "error";
  const isDisabled = isSent || isSending;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isSent
          ? isDark
            ? "border-emerald-800/40 bg-emerald-950/20"
            : "border-emerald-200 bg-emerald-50/30"
          : isError
            ? isDark
              ? "border-red-800/40 bg-red-950/20"
              : "border-red-200 bg-red-50/30"
            : isDark
              ? "border-zinc-800 bg-zinc-900/50"
              : "border-zinc-200 bg-white"
      }`}
    >
      {/* Row 1: Name + Email */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          placeholder="Fornavn"
          value={row.firstName}
          onChange={(e) => onUpdate(row.id, { firstName: e.target.value })}
          disabled={isDisabled}
          className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
        <Input
          placeholder="Etternavn"
          value={row.lastName}
          onChange={(e) => onUpdate(row.id, { lastName: e.target.value })}
          disabled={isDisabled}
          className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
        <Input
          placeholder="E-post"
          type="email"
          value={row.email}
          onChange={(e) => onUpdate(row.id, { email: e.target.value })}
          disabled={isDisabled}
          className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
        />
      </div>

      {/* Row 2: Department + Employment form + Position + Rate */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select
          value={row.departmentId}
          onValueChange={(v) => onUpdate(row.id, { departmentId: v })}
          disabled={isDisabled}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Avdeling" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.department_id} value={d.department_id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={row.employmentForm}
          onValueChange={(v) => onUpdate(row.id, { employmentForm: v })}
          disabled={isDisabled}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Ansettelsesform" />
          </SelectTrigger>
          <SelectContent>
            {employmentForms.map((f) => (
              <SelectItem key={f.type} value={f.type}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={row.positionId}
          onValueChange={(v) => onUpdate(row.id, { positionId: v })}
          disabled={isDisabled}
        >
          <SelectTrigger
            className={`h-9 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          >
            <SelectValue placeholder="Stilling" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => (
              <SelectItem key={p.position_id} value={p.position_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            value={row.hourlyRate || ""}
            onChange={(e) => onUpdate(row.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
            disabled={isDisabled}
            className={`h-9 pr-10 text-sm ${isDark ? "border-zinc-700 bg-zinc-800/50" : ""}`}
          />
          <span
            className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${
              isDark ? "text-zinc-500" : "text-zinc-400"
            }`}
          >
            kr/t
          </span>
        </div>
      </div>

      {/* Row 3: Status + Remove */}
      <div className="mt-2 flex items-center justify-end gap-2">
        {isSending && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
        {isSent && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {isError && <span className="text-xs font-medium text-red-500">Feilet</span>}
        {!isSent && !isSending && (
          <button
            onClick={() => onRemove(row.id)}
            className={`rounded-lg p-1.5 transition-colors ${
              isDark
                ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TeamSetupStep ──────────────────────────────────────────

export function TeamSetupStep({ isDark }: { isDark: boolean }) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  const [rows, setRows] = useState<InviteRow[]>([createEmptyRow()]);
  const [isSending, setIsSending] = useState(false);

  // ── Queries ──

  const { data: departmentsRaw } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });
  const departments = useMemo(() => departmentsRaw ?? [], [departmentsRaw]);

  const { data: positionsRaw } = useQuery({
    queryKey: ["positions", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("position")
        .select("position_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });
  const positions = useMemo(() => positionsRaw ?? [], [positionsRaw]);

  const { data: employmentPolicy } = useQuery({
    queryKey: ["employment-policy", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "hr")
        .eq("name", "Ansettelsesvilkår")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const employmentForms = useMemo(() => {
    const rules = employmentPolicy?.rules_json as Record<string, unknown> | null;
    const forms = (rules?.employment_forms ?? []) as { type: string; label: string }[];
    return forms.length > 0 ? forms : [{ type: "fast_heltid", label: "Fast heltid" }];
  }, [employmentPolicy]);

  const { data: wagePolicy } = useQuery({
    queryKey: ["payroll-policies", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "payroll")
        .eq("name", "Stillingslønn")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // ── Wage lookup helper ──

  const positionWageMap = useMemo(() => {
    const map = new Map<string, number>();
    const rules = wagePolicy?.rules_json as Record<string, unknown> | null;
    const positionWages = (rules?.positions ?? []) as {
      position_id: string;
      hourly_rate: number;
    }[];
    for (const pw of positionWages) {
      map.set(pw.position_id, pw.hourly_rate);
    }
    return map;
  }, [wagePolicy]);

  // ── Row handlers ──

  const handleUpdate = useCallback(
    (id: string, patch: Partial<InviteRow>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, ...patch };
          // Auto-fill hourly rate when position changes
          if (patch.positionId && patch.positionId !== r.positionId) {
            const wage = positionWageMap.get(patch.positionId);
            if (wage !== undefined) {
              updated.hourlyRate = wage;
            }
          }
          return updated;
        }),
      );
    },
    [positionWageMap],
  );

  const handleRemove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? [createEmptyRow()] : next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  // ── Send logic ──

  const handleSend = useCallback(async () => {
    const toSend = rows.filter((r) => r.status === "pending" && r.email.trim() !== "");
    if (toSend.length === 0) {
      toast.error("Ingen invitasjoner å sende");
      return;
    }

    setIsSending(true);
    let sentCount = 0;

    for (const row of toSend) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: "sending" as const } : r)),
      );

      try {
        const supabase = createClient();
        const { error } = await supabase.functions.invoke("create-invitation", {
          body: {
            workspace_id: workspace.workspace_id,
            company_id: workspace.company_id,
            invites: [
              {
                email: row.email.trim(),
                first_name: row.firstName.trim(),
                last_name: row.lastName.trim(),
                role: "employee",
                department_ids: row.departmentId ? [row.departmentId] : undefined,
              },
            ],
          },
        });

        if (error) throw error;

        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "sent" as const } : r)),
        );
        sentCount++;

        void emit({
          event: "button clicked",
          workspace_id: workspace.workspace_id,
          actor_id: profileId ?? "",
          properties: {
            trackingId: "team-invitation-sent",
            context: row.email,
          },
        });
      } catch {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "error" as const } : r)),
        );
      }
    }

    setIsSending(false);

    if (sentCount > 0) {
      toast.success(`${sentCount} invitasjon${sentCount !== 1 ? "er" : ""} sendt`);
    }
  }, [rows, workspace, profileId]);

  // ── Derived ──

  const pendingCount = rows.filter((r) => r.status === "pending" && r.email.trim() !== "").length;
  const sentCount = rows.filter((r) => r.status === "sent").length;

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Inviter teamet ditt
        </h3>
        <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Legg til ansatte som skal f&aring; tilgang. Du kan ogs&aring; gj&oslash;re dette senere.
        </p>
      </div>

      {/* Summary bar */}
      {sentCount > 0 && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            isDark ? "bg-emerald-950/30 text-emerald-400" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {sentCount} invitasjon{sentCount !== 1 ? "er" : ""} sendt
        </div>
      )}

      {/* Invite rows */}
      <div className="space-y-3">
        {rows.map((row) => (
          <InviteRowCard
            key={row.id}
            row={row}
            isDark={isDark}
            departments={departments}
            positions={positions}
            employmentForms={employmentForms}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAddRow}
          className={`flex items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Plus className="h-4 w-4" />
          Legg til
        </button>

        {pendingCount > 0 && (
          <button
            onClick={handleSend}
            disabled={isSending}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              isSending
                ? "cursor-not-allowed opacity-50"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send invitasjoner ({pendingCount})
          </button>
        )}
      </div>
    </div>
  );
}
