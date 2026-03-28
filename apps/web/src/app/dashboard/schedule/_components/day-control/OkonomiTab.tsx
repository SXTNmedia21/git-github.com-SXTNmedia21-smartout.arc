"use client";

/**
 * OkonomiTab — Financial overview and revenue registration for a single day.
 *
 * Shows budget vs actual, lets on-shift employees submit a daily settlement,
 * and displays KPIs once approved. Follows the same pattern as OversiktTab
 * for fetching department context.
 */

import { useContext, useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useScheduleBudget } from "../../_hooks/useScheduleBudget";
import { useSettlementForDate, useSubmitSettlement } from "../../_hooks/useSettlement";
import { SectionHeader, KpiCard, formatNok } from "./shared";

type FormState = {
  revenueTotal: string;
  revenueCard: string;
  revenueCash: string;
  revenueVat: string;
  revenueTransactions: string;
  cashCounted: string;
};

const EMPTY_FORM: FormState = {
  revenueTotal: "",
  revenueCard: "",
  revenueCash: "",
  revenueVat: "",
  revenueTransactions: "",
  cashCounted: "",
};

/** Fetch first department for the workspace (same pattern as OversiktTab). */
function usePrimaryDepartment(workspaceId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["primary-department", workspaceId],
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId!)
        .order("name")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}

/** Fetch current user's profile_id in this workspace. */
function useCurrentProfile(workspaceId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["current-profile", workspaceId],
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", workspaceId!)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });
}

export function OkonomiTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const { data: dept } = usePrimaryDepartment(workspaceId);
  const { data: currentProfile } = useCurrentProfile(workspaceId);
  const departmentId = dept?.department_id;

  const { data: budgetTargets, isLoading: budgetLoading } = useScheduleBudget(
    workspaceId,
    dateId ?? "",
    dateId ?? "",
  );
  const { data: settlement, isLoading: settlementLoading } = useSettlementForDate(
    departmentId,
    dateId,
  );
  const submitMutation = useSubmitSettlement();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  // Reset form when date changes
  useEffect(() => {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }, [dateId]);

  const todayBudget = budgetTargets?.[0];
  const hasSettlement = !!settlement;
  const isApproved = settlement?.status === "approved" || settlement?.status === "locked";
  const isSubmitted = settlement?.status === "submitted";

  if (!dateId || !workspaceId) return null;

  if (budgetLoading || settlementLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  function handleSubmit() {
    if (!departmentId || !dateId || !currentProfile?.profile_id) return;
    const total = parseFloat(form.revenueTotal);
    if (isNaN(total) || total <= 0) return;

    submitMutation.mutate({
      profileId: currentProfile.profile_id,
      input: {
        departmentId,
        reconciliationDate: dateId,
        revenueTotal: total,
        revenueCard: form.revenueCard ? parseFloat(form.revenueCard) : null,
        revenueCash: form.revenueCash ? parseFloat(form.revenueCash) : null,
        revenueVat: form.revenueVat ? parseFloat(form.revenueVat) : null,
        revenueTransactions: form.revenueTransactions
          ? parseInt(form.revenueTransactions, 10)
          : null,
        cashCounted: form.cashCounted ? parseFloat(form.cashCounted) : null,
      },
    });
  }

  const field = (label: string, key: keyof FormState, placeholder: string, required = false) => (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="number"
        step="0.01"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        className={`w-full rounded-lg border px-3 py-2 text-sm ${
          isDark
            ? "border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/50"
            : "border-border bg-card text-foreground placeholder:text-muted-foreground/50"
        }`}
      />
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* Status banner */}
      {hasSettlement && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            isApproved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : isSubmitted
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-border bg-muted/20 text-muted-foreground"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isSubmitted ? (
            <Clock className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {isApproved
            ? "Godkjent"
            : isSubmitted
              ? "Venter pa godkjenning"
              : `Status: ${settlement?.status}`}
        </div>
      )}

      {/* Budget vs Actual */}
      <section>
        <SectionHeader label="Budsjett vs Faktisk" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KpiCard
            label="Budsjett"
            value={todayBudget ? formatNok(todayBudget.targetRevenue) : "---"}
          />
          <KpiCard
            label="Registrert"
            value={settlement ? formatNok(Number(settlement.revenue_total ?? 0)) : "---"}
          />
          <KpiCard
            label="Lonnskostnad"
            value={
              settlement?.total_labor_cost
                ? formatNok(Number(settlement.total_labor_cost))
                : "Beregnes ved godkjenning"
            }
          />
        </div>
      </section>

      {/* KPI cards when approved */}
      {isApproved && settlement && (
        <section>
          <SectionHeader label="Nokkeltall" />
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Omsetning/time"
              value={
                settlement.revenue_per_worked_hour
                  ? `${formatNok(Number(settlement.revenue_per_worked_hour))}/t`
                  : "---"
              }
            />
            <KpiCard
              label="Lonnsprosent"
              value={
                settlement.labor_percentage
                  ? `${Number(settlement.labor_percentage).toFixed(1)}%`
                  : "---"
              }
            />
          </div>
        </section>
      )}

      {/* Registration form */}
      {!hasSettlement && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors"
        >
          Registrer dagsoppgjor
        </button>
      )}

      {!hasSettlement && showForm && (
        <section>
          <SectionHeader label="Dagsoppgjor" />
          <div className="space-y-3">
            {field("Total omsetning", "revenueTotal", "0.00", true)}
            <div className="grid grid-cols-2 gap-3">
              {field("Kort", "revenueCard", "0.00")}
              {field("Kontant", "revenueCash", "0.00")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("MVA", "revenueVat", "0.00")}
              {field("Transaksjoner", "revenueTransactions", "0")}
            </div>
            {field("Kontantkasse opptalt", "cashCounted", "0.00")}

            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !form.revenueTotal}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send inn
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
