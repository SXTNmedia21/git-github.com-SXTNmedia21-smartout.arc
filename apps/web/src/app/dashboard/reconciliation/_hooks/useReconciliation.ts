"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Database } from "@smartout/supabase";

type ReconciliationStatus = Database["public"]["Enums"]["reconciliation_status"];

// ── Fetch all reconciliations for workspace ──────────────────

export function useReconciliationList(filters?: {
  status?: ReconciliationStatus;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["reconciliation-list", workspace.workspace_id, filters],
    queryFn: async () => {
      let query = supabase
        .from("daily_reconciliation")
        .select("*, department_session!inner(status, session_date, department:department_id(name))")
        .eq("workspace_id", workspace.workspace_id)
        .order("reconciliation_date", { ascending: false })
        .limit(60);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.departmentId) {
        query = query.eq("department_id", filters.departmentId);
      }
      if (filters?.dateFrom) {
        query = query.gte("reconciliation_date", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("reconciliation_date", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Fetch single reconciliation with all related data ────────

export function useReconciliationDetail(reconciliationId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["reconciliation-detail", reconciliationId],
    enabled: !!reconciliationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select(
          `*,
          settlement_image(*),
          settlement_validation(*),
          shift_approval(*, schedule_shift:shift_id(employee_id, start_time, end_time)),
          deviation(*)`,
        )
        .eq("reconciliation_id", reconciliationId!)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// ── Approve reconciliation ───────────────────────────────────

export function useApproveReconciliation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reconciliationId,
      profileId,
      notes,
    }: {
      reconciliationId: string;
      profileId: string;
      notes?: string;
    }) => {
      // Calculate KPIs
      const { data: recon } = await supabase
        .from("daily_reconciliation")
        .select("revenue_total, total_actual_hours, total_labor_cost")
        .eq("reconciliation_id", reconciliationId)
        .single();

      const revenuePerHour =
        recon?.revenue_total && recon?.total_actual_hours
          ? Number(recon.revenue_total) / Number(recon.total_actual_hours)
          : null;
      const laborPercentage =
        recon?.revenue_total && recon?.total_labor_cost
          ? (Number(recon.total_labor_cost) / Number(recon.revenue_total)) * 100
          : null;

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .update({
          status: "approved",
          approved_by: profileId,
          approved_at: new Date().toISOString(),
          approval_notes: notes ?? null,
          revenue_per_worked_hour: revenuePerHour,
          labor_percentage: laborPercentage,
          updated_at: new Date().toISOString(),
        })
        .eq("reconciliation_id", reconciliationId)
        .select()
        .single();

      if (error) throw error;

      // Fire engine event
      await supabase.functions.invoke("engine-dispatch", {
        body: {
          event_type: "reconciliation.approved",
          workspace_id: data.workspace_id,
          payload: {
            reconciliation_id: reconciliationId,
            department_id: data.department_id,
            reconciliation_date: data.reconciliation_date,
          },
          idempotency_key: `recon-approved-${reconciliationId}`,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-list"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-detail"] });
    },
  });
}

// ── Reject reconciliation ────────────────────────────────────

export function useRejectReconciliation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reconciliationId,
      reason,
    }: {
      reconciliationId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .update({
          status: "open",
          approval_notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("reconciliation_id", reconciliationId)
        .select()
        .single();

      if (error) throw error;

      // Fire engine event to resume waiting states
      await supabase.functions.invoke("engine-dispatch", {
        body: {
          event_type: "reconciliation.admin_action",
          workspace_id: data.workspace_id,
          payload: {
            reconciliation_id: reconciliationId,
            action: "rejected",
            reason,
          },
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-list"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-detail"] });
    },
  });
}

// ── Approve shift hours ──────────────────────────────────────

export function useApproveShiftHours() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approvalId,
      approvedHours,
      profileId,
      justification,
    }: {
      approvalId: string;
      approvedHours: number;
      profileId: string;
      justification?: string;
    }) => {
      const { data, error } = await supabase
        .from("shift_approval")
        .update({
          approved_hours: approvedHours,
          status: justification ? "edited" : "approved",
          edit_justification: justification ?? null,
          approved_by: profileId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("approval_id", approvalId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-detail"] });
    },
  });
}

// ── Resolve deviation ────────────────────────────────────────

export function useResolveDeviation() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviationId,
      profileId,
      notes,
    }: {
      deviationId: string;
      profileId: string;
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("deviation")
        .update({
          status: "resolved",
          resolution_notes: notes,
          resolved_by: profileId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("deviation_id", deviationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-detail"] });
    },
  });
}
