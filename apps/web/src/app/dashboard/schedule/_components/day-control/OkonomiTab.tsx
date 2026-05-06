"use client";

/**
 * OkonomiTab — Financial overview and revenue registration for a single day.
 *
 * Shows budget vs actual, lets on-shift employees submit a daily settlement,
 * and displays KPIs once approved. Follows the same pattern as OversiktTab
 * for fetching department context.
 *
 * Phase 4 (ADR-0228): Tips tile added — gated on useTipsEnabled().
 */

import { useContext, useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, Clock, AlertCircle, Send, Coins, ArrowRight } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useScheduleBudget } from "../../_hooks/useScheduleBudget";
import { useSettlementForDate, useSubmitSettlement } from "../../_hooks/useSettlement";
import { SectionHeader, KpiCard, formatNok } from "./shared";
import { useTipsEnabled } from "@/hooks/use-tips-enabled";
import { useTipsPool } from "@/hooks/queries/use-tips-pool";
import { PotRegistrationModal } from "@/components/tips/PotRegistrationModal";

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

/** Fetch the active department_session_id for a department + date. */
function useDepartmentSessionId(
  workspaceId: string | undefined,
  departmentId: string | undefined,
  dateId: string | null,
): string | null {
  const supabase = createClient();
  const { data } = useQuery({
    queryKey: ["dept-session-id", departmentId, dateId],
    enabled: !!workspaceId && !!departmentId && !!dateId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("department_id", departmentId!)
        .eq("session_date", dateId!)
        .in("status", ["active", "upcoming", "pending_signoff", "closed"])
        .limit(1)
        .maybeSingle();
      return row?.department_session_id ?? null;
    },
  });
  return data ?? null;
}

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

  // Tips — Phase 4 (ADR-0228)
  const { enabled: tipsEnabled } = useTipsEnabled();
  const departmentSessionId = useDepartmentSessionId(workspaceId, departmentId, dateId);
  const { data: tipsView } = useTipsPool(departmentSessionId);
  const [tipsModalOpen, setTipsModalOpen] = useState(false);

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
        {label} {required && <span className="text-destructive">*</span>}
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
              ? "border-success/30 bg-success/10 text-success"
              : isSubmitted
                ? "border-warning/30 bg-warning/10 text-warning"
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
          <span>
            {isApproved
              ? "Godkjent"
              : isSubmitted
                ? "Venter pa godkjenning"
                : `Status: ${settlement?.status}`}
          </span>
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

      {/* Tips tile — gated on tips_enabled (ADR-0228, Phase 4) */}
      {tipsEnabled && departmentSessionId && (
        <section>
          <SectionHeader label="Tips">
            <Coins className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
          </SectionHeader>

          {!tipsView?.pool ? (
            /* No pool yet — empty state */
            <div className="border-border rounded-xl border border-dashed p-4 text-center">
              <p className="text-muted-foreground mb-3 text-sm">Ingen pot registrert</p>
              <button
                type="button"
                onClick={() => setTipsModalOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Coins className="h-4 w-4" aria-hidden />
                Registrer tips
              </button>
            </div>
          ) : (
            /* Pool exists — show amount, status badge, top 3 distributions, link */
            <div className="border-border bg-card space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground block text-xs font-medium">Pot</span>
                  <span className="text-foreground font-mono text-lg font-bold">
                    {formatNok(Number(tipsView.pool.amount_nok))}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    tipsView.pool.status === "approved"
                      ? "bg-success/10 text-success border-success/30 border"
                      : "bg-warning/10 text-warning border-warning/30 border"
                  }`}
                >
                  {tipsView.pool.status === "approved" ? "Godkjent" : "Registrert"}
                </span>
              </div>

              {/* Top 3 distributions preview */}
              {tipsView.distributions.length > 0 && (
                <div className="space-y-1">
                  {tipsView.distributions.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate">
                        {d.profile_id.slice(0, 8)}…
                      </span>
                      <span className="text-foreground font-mono font-medium">
                        {formatNok(
                          d.adjusted_amount !== null && d.adjusted_amount !== undefined
                            ? Number(d.adjusted_amount)
                            : Number(d.calculated_amount),
                        )}
                      </span>
                    </div>
                  ))}
                  {tipsView.distributions.length > 3 && (
                    <p className="text-muted-foreground text-xs">
                      + {tipsView.distributions.length - 3} til
                    </p>
                  )}
                </div>
              )}

              {/* Link to Signoff/Reconciliation for approval */}
              {tipsView.pool.status !== "approved" && (
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                  onClick={() => {
                    /* Signoff tab link — handled by parent DayControlPanel tab navigation */
                  }}
                >
                  Godkjenn pa Oppgjor
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          )}

          <PotRegistrationModal
            departmentSessionId={departmentSessionId}
            open={tipsModalOpen}
            onOpenChange={setTipsModalOpen}
          />
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
