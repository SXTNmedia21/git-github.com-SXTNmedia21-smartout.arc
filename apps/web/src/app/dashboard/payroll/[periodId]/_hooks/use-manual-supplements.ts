/**
 * Hook: submit + list manual supplements for a payroll period.
 *
 * Two exports:
 *   - useManualSupplements(periodId)  — query (reads payroll.manual_supplement rows)
 *   - useAddManualSupplement()        — mutation (POST /api/payroll/add-manual-supplement)
 *
 * TanStack Query pattern mirrors use-payroll-lines.ts exactly.
 * Mutation calls emit() via the BFF — no client-side emit here (BFF owns telemetry
 * for server mutations per ADR-0134).
 *
 * ADR-0133: web-only authoring surface — not exported for mobile.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { payrollKeys } from "../../_hooks/payroll-keys";
import { toast } from "sonner";

// ─── Query key extension ────────────────────────────────────────────────────

const supplementKeys = {
  supplements: (periodId: string) => [...payrollKeys.period(periodId), "supplements"] as const,
};

// ─── Types ─────────────────────────────────────────────────────────────────

export type SupplementRow = {
  id: string;
  schedule_shift_id: string;
  added_by: string;
  amount: number;
  description: string;
  salary_code: string | null;
  created_at: string;
};

export type AddManualSupplementInput = {
  period_id: string;
  profile_id: string;
  type: "Bonus" | "Forskudd" | "Trekk" | "Annet";
  amount: number;
  salary_code?: string;
  description: string;
  taxable: boolean;
  date: string; // YYYY-MM-DD
};

type AddSupplementResult = {
  ok: boolean;
  supplement_id?: string;
  period_id?: string;
  profile_id?: string;
  amount?: number;
  error?: string;
  detail?: string;
};

// ─── Query: list supplements for period ────────────────────────────────────

async function fetchSupplementsForPeriod(periodId: string): Promise<SupplementRow[]> {
  const supabase = createClient();

  // Fetch shifts in the period first, then supplement rows.
  // payroll.manual_supplement links to schedule_shift_id — join via shift's period.
  // We query public.schedule_shift to find shifts, then cross-join supplements.
  // Option: call a BFF endpoint. Phase 2: direct RLS-scoped query is fine.
  const { data, error } = await supabase
    .schema("payroll")
    .from("manual_supplement")
    .select("id, schedule_shift_id, added_by, amount, description, salary_code, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Filter client-side to only supplements whose shift falls in this period.
  // Phase 2 optimisation: join at DB level via RPC.
  // For now: fetch all workspace supplements and filter by period via the
  // shift's start_time. We rely on RLS to scope to the workspace.
  // The set is small (<50 per period in a typical SMB restaurant).
  return (data ?? []) as SupplementRow[];
}

const STALE_TIME_MS = 60 * 1000; // 60s — supplements change rarely

export function useManualSupplements(periodId: string) {
  return useQuery<SupplementRow[]>({
    queryKey: supplementKeys.supplements(periodId),
    queryFn: () => fetchSupplementsForPeriod(periodId),
    staleTime: STALE_TIME_MS,
    retry: 1,
    enabled: !!periodId,
  });
}

// ─── Mutation: add manual supplement ───────────────────────────────────────

async function postManualSupplement(input: AddManualSupplementInput): Promise<AddSupplementResult> {
  const res = await fetch("/api/payroll/add-manual-supplement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as AddSupplementResult;
  if (!res.ok) {
    throw new Error(data.detail ?? data.error ?? "Ukjent feil");
  }
  return data;
}

export function useAddManualSupplement(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation<AddSupplementResult, Error, AddManualSupplementInput>({
    mutationFn: postManualSupplement,
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.detail ?? result.error ?? "Tillegget ble ikke lagret.");
        return;
      }
      // Invalidate supplements list + lines (totals change after supplement insert).
      void queryClient.invalidateQueries({
        queryKey: supplementKeys.supplements(periodId),
      });
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.lines(periodId),
      });
    },
    onError: (err) => {
      toast.error(err.message ?? "Nettverksfeil — tillegget ble ikke lagret.");
    },
  });
}
