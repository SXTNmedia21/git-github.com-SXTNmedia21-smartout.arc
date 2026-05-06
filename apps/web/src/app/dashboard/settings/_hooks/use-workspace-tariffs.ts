"use client";

// Hook for loading workspace tariff rates with platform baseline comparison.
//
// Tariff rates follow an append-only pattern — adjustments insert a new
// effective-dated row rather than mutating existing rows. This preserves
// history and auditability.
//
// Exports:
//   useWorkspaceTariffs() — fetch workspace + platform rates, merged for display
//   adjustRate            — insert new effective-dated workspace rate row

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TariffRateDisplay = {
  id: string;
  rateType: string;
  amount: number;
  unit: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  source: string;
  isWorkspaceOverride: boolean;
  platformAmount: number | null;
  seniorityYears: number | null;
};

export type AdjustRatePayload = {
  rateType: string;
  amount: number;
  unit: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  seniorityYears?: number | null;
};

// ─── Query key ────────────────────────────────────────────────────────────────

function tariffRatesKey(workspaceId: string) {
  return ["settings", "tariff-rates", workspaceId] as const;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkspaceTariffs() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: tariffRatesKey(wsId ?? "none"),
    queryFn: async (): Promise<TariffRateDisplay[]> => {
      // Load workspace + platform rates in parallel
      const [wsRes, platformRes] = await Promise.all([
        supabase
          .from("tariff_rate_table")
          .select(
            "id, rate_type, amount, unit, effective_from, effective_until, source, seniority_years",
          )
          .eq("workspace_id", wsId!)
          .order("rate_type", { ascending: true })
          .order("effective_from", { ascending: false }),
        supabase
          .from("tariff_rate_table")
          .select(
            "id, rate_type, amount, unit, effective_from, effective_until, source, seniority_years",
          )
          .is("workspace_id", null)
          .order("rate_type", { ascending: true })
          .order("effective_from", { ascending: false }),
      ]);

      if (wsRes.error) throw new Error(wsRes.error.message);
      if (platformRes.error) throw new Error(platformRes.error.message);

      // Build platform baseline lookup: rate_type → most recent amount
      const platformByType = new Map<string, number>();
      for (const row of platformRes.data ?? []) {
        if (!platformByType.has(row.rate_type)) {
          platformByType.set(row.rate_type, row.amount);
        }
      }

      // Workspace rates with platform comparison
      const wsRates: TariffRateDisplay[] = (wsRes.data ?? []).map((row) => ({
        id: row.id,
        rateType: row.rate_type,
        amount: row.amount,
        unit: row.unit,
        effectiveFrom: row.effective_from,
        effectiveUntil: row.effective_until,
        source: row.source,
        isWorkspaceOverride: true,
        platformAmount: platformByType.get(row.rate_type) ?? null,
        seniorityYears: row.seniority_years,
      }));

      // Platform rates not overridden by workspace
      const wsRateTypes = new Set((wsRes.data ?? []).map((r) => r.rate_type));
      const platformOnly: TariffRateDisplay[] = (platformRes.data ?? [])
        .filter((r) => !wsRateTypes.has(r.rate_type))
        .map((row) => ({
          id: row.id,
          rateType: row.rate_type,
          amount: row.amount,
          unit: row.unit,
          effectiveFrom: row.effective_from,
          effectiveUntil: row.effective_until,
          source: row.source,
          isWorkspaceOverride: false,
          platformAmount: row.amount,
          seniorityYears: row.seniority_years,
        }));

      return [...wsRates, ...platformOnly];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });

  const adjustRate = useMutation({
    mutationFn: async (payload: AdjustRatePayload) => {
      const { error } = await supabase.from("tariff_rate_table").insert({
        workspace_id: wsId!,
        rate_type: payload.rateType,
        amount: payload.amount,
        unit: payload.unit,
        effective_from: payload.effectiveFrom,
        effective_until: payload.effectiveUntil ?? null,
        seniority_years: payload.seniorityYears ?? null,
        source: "internal" as const,
        law_version: "2025",
        provenance: {
          adjusted_by: profileId,
          adjusted_at: new Date().toISOString(),
          type: "workspace_admin_adjustment",
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "button clicked",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { trackingId: "tariff-rate-adjusted" },
      });
      queryClient.invalidateQueries({
        queryKey: tariffRatesKey(wsId!),
      });
      toast.success("Tariffsats oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });

  return {
    rates: query.data ?? [],
    isLoading: query.isLoading,
    adjustRate,
  };
}
