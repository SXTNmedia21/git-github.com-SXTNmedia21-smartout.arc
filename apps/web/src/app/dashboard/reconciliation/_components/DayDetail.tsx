"use client";

import { useContext, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Coins,
  DollarSign,
  FileText,
  History,
  Loader2,
  Lock,
  PenLine,
  Users,
  XCircle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PhaseBadge } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { motion as motionTokens } from "@smartout/design-tokens";

import {
  useReconciliationDetail,
  useApproveReconciliation,
  useRejectReconciliation,
} from "../_hooks/useReconciliation";
import { reconciliationStatusToPhase } from "../_lib/status-mapping";

import { RevenueSection } from "./RevenueSection";
import { ShiftApprovalSection } from "./ShiftApprovalSection";
import { DeviationSection } from "./DeviationSection";
import { PreflightGate, type PreflightBlocker } from "./PreflightGate";
import { AdminOverrideDialog } from "./AdminOverrideDialog";
import { OversiktTab } from "./tabs/OversiktTab";
import { RevisjonsloggTab } from "./tabs/RevisjonsloggTab";
import { OppgaverTab } from "./tabs/OppgaverTab";
import { ReconciliationRightRail } from "./ReconciliationRightRail";
import { useTipsEnabled } from "@/hooks/use-tips-enabled";
import { useTipsPool } from "@/hooks/queries/use-tips-pool";
import type { TipsPoolView } from "@/hooks/queries/use-tips-pool";
import { AdjustmentDialog } from "@/components/tips/AdjustmentDialog";
import type { Database } from "@smartout/supabase";

type TabKey = "overview" | "revenue" | "shifts" | "deviations" | "tasks" | "audit" | "tips";

// Base tabs — tips tab is spliced in conditionally after useTipsEnabled() resolves.
const BASE_TABS: Array<{ key: TabKey; label: string; Icon: typeof CheckCircle2 }> = [
  { key: "overview", label: "Oversikt", Icon: CheckCircle2 },
  { key: "revenue", label: "Omsetning", Icon: DollarSign },
  { key: "shifts", label: "Vakter", Icon: Users },
  { key: "deviations", label: "Avvik", Icon: FileText },
  { key: "tasks", label: "Oppgaver", Icon: ClipboardList },
  { key: "audit", label: "Revisjonslogg", Icon: History },
];

type Props = {
  reconciliationId: string;
  onBack: () => void;
};

export function DayDetail({ reconciliationId, onBack }: Props) {
  const dashCtx = useContext(DashboardContext);
  const profileId = dashCtx.profileId ?? "";
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();

  const { data: detail, isLoading } = useReconciliationDetail(reconciliationId);
  const approveMutation = useApproveReconciliation();
  const rejectMutation = useRejectReconciliation();

  const [tab, setTab] = useState<TabKey>("overview");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Tips — Phase 4 (ADR-0228)
  const { enabled: tipsEnabled } = useTipsEnabled();
  const departmentSessionId = detail?.department_session?.department_session_id ?? null;
  const { data: tipsView } = useTipsPool(tipsEnabled ? departmentSessionId : null);
  const [adjustingDistribution, setAdjustingDistribution] = useState<
    Database["public"]["Tables"]["tip_distribution"]["Row"] | null
  >(null);

  // Build tab list — inject Tips tab before "Revisjonslogg" when enabled
  const TABS: Array<{ key: TabKey; label: string; Icon: typeof CheckCircle2 }> = tipsEnabled
    ? [...BASE_TABS.slice(0, 5), { key: "tips", label: "Tips", Icon: Coins }, ...BASE_TABS.slice(5)]
    : BASE_TABS;

  const lockDayMutation = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("No detail");
      const supabase = createClient();
      const { error } = await supabase
        .from("daily_reconciliation")
        .update({
          locked_at: new Date().toISOString(),
          locked_by: profileId,
          status: "locked" as const,
        })
        .eq("reconciliation_id", detail.reconciliation_id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!detail) return;
      emit({
        event: "reconciliation locked",
        workspace_id: nonEmpty(detail.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "reconciliation", entity_id: detail.reconciliation_id },
          data: {
            reconciliation_id: detail.reconciliation_id,
            reconciliation_date: detail.reconciliation_date,
          },
        },
      });
      toast.success("Dagen er låst");
      qc.invalidateQueries({ queryKey: ["reconciliation-list"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-detail"] });
      qc.invalidateQueries({ queryKey: ["unreconciled-days"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-audit-trail"] });
    },
    onError: () => toast.error("Kunne ikke låse dagen"),
  });

  const shiftApprovals = useMemo(() => {
    if (!detail)
      return [] as Array<{
        approval_id: string;
        shift_id: string;
        planned_hours: number;
        calculated_hours: number | null;
        approved_hours: number | null;
        status: string;
        system_deviations: unknown;
        schedule_shift: {
          employee_id: string | null;
          start_time: string;
          end_time: string;
        } | null;
      }>;
    return (detail.shift_approval ?? []) as Array<{
      approval_id: string;
      shift_id: string;
      planned_hours: number;
      calculated_hours: number | null;
      approved_hours: number | null;
      status: string;
      system_deviations: unknown;
      schedule_shift: {
        employee_id: string | null;
        start_time: string;
        end_time: string;
      } | null;
    }>;
  }, [detail]);

  const deviations = useMemo(() => {
    if (!detail)
      return [] as Array<{
        deviation_id: string;
        domain: string;
        subcategory: string | null;
        severity: string;
        title: string;
        description: string | null;
        status: string;
        cost_impact: number | null;
        blocks_day_approval: boolean;
        resolution_notes: string | null;
      }>;
    return (detail.deviation ?? []) as Array<{
      deviation_id: string;
      domain: string;
      subcategory: string | null;
      severity: string;
      title: string;
      description: string | null;
      status: string;
      cost_impact: number | null;
      blocks_day_approval: boolean;
      resolution_notes: string | null;
    }>;
  }, [detail]);

  const images = useMemo(() => {
    if (!detail)
      return [] as Array<{
        image_id: string;
        source_type: string;
        ocr_confidence: number | null;
        storage_path: string;
      }>;
    return (detail.settlement_image ?? []) as Array<{
      image_id: string;
      source_type: string;
      ocr_confidence: number | null;
      storage_path: string;
    }>;
  }, [detail]);

  // Preflight blockers — J2 click-to-jump integration
  const preflightBlockers = useMemo<PreflightBlocker[]>(() => {
    const b: PreflightBlocker[] = [];
    const blockingDeviations = deviations.filter(
      (d) => d.blocks_day_approval && d.status === "open",
    );
    blockingDeviations.forEach((d) => {
      b.push({
        id: `dev-${d.deviation_id}`,
        text: d.title,
        hint: "Blokkerende avvik — løs eller overstyr",
        tab: "deviations",
      });
    });

    const pendingShifts = shiftApprovals.filter((s) => s.status === "pending");
    if (pendingShifts.length > 0) {
      b.push({
        id: "shifts-pending",
        text: `${pendingShifts.length} vakter venter på timegodkjenning`,
        hint: "Behandle hver vakt i Vakter-tab",
        tab: "shifts",
      });
    }

    return b;
  }, [deviations, shiftApprovals]);

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        {isLoading ? (
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
        ) : (
          <p className="text-muted-foreground text-sm">Kunne ikke laste avstemming.</p>
        )}
      </div>
    );
  }

  const phase = reconciliationStatusToPhase(detail.status);
  const isLocked = !!detail.locked_at;
  const isApproved = detail.status === "approved" || isLocked;
  const canApprove = detail.status === "awaiting_approval" && preflightBlockers.length === 0;

  const tabSpring = reduceMotion
    ? { duration: motionTokens.exitMs / 1000 }
    : { type: "spring" as const, ...motionTokens.spring };

  async function handleApprove() {
    await approveMutation.mutateAsync({
      reconciliationId,
      profileId,
      notes: approvalNotes || undefined,
    });
    qc.invalidateQueries({ queryKey: ["reconciliation-audit-trail"] });
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await rejectMutation.mutateAsync({
      reconciliationId,
      profileId,
      reason: rejectReason,
    });
    setShowRejectForm(false);
    setRejectReason("");
    qc.invalidateQueries({ queryKey: ["reconciliation-audit-trail"] });
  }

  function jumpToTab(targetTab: string, blockerId: string) {
    setTab(targetTab as TabKey);
    // Defer scroll to after tab transition mount
    window.setTimeout(() => {
      const el = document.getElementById(`blocker-target-${blockerId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  const departmentName = detail.department_session?.department?.name ?? "—";

  return (
    <div className="space-y-4">
      {/* Back header */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Tilbake til uke-oversikt
        </Button>
      </div>

      {/* Detail header */}
      <header className="border-border bg-card rounded-2xl border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
              {new Date(detail.reconciliation_date + "T00:00:00").toLocaleDateString("nb-NO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span>{departmentName}</span>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span>Admin-gjennomgang</span>
            </div>
          </div>
          <PhaseBadge phase={phase} />
        </div>
      </header>

      {/* 4-col shell — content + 380px approve-panel + 320px right rail (xl+).
          Rail hides on `deviations` tab (no-rail equivalent — content redundant with tab). */}
      <div className="flex gap-6">
        <div className={cn("grid min-w-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]")}>
          {/* Content lane */}
          <div className="space-y-4">
            {/* Preflight-gate at top. Override CTA lives INSIDE the gate per
              campaign Inv #13 — peer of approve, not escape-modal in aside. */}
            {!isApproved && (
              <PreflightGate
                blockers={preflightBlockers}
                onJump={jumpToTab}
                overrideSlot={
                  detail.status === "awaiting_approval" && preflightBlockers.length > 0 ? (
                    <AdminOverrideDialog
                      reconciliationId={reconciliationId}
                      blockerCount={preflightBlockers.length}
                    />
                  ) : null
                }
              />
            )}

            {/* Tab bar */}
            <PageTabNav
              tabs={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.Icon }))}
              active={tab}
              onChange={(k) => setTab(k as TabKey)}
              ariaLabel="Oppgjør-seksjoner"
            />

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                role="tabpanel"
                id={`tab-${tab}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={tabSpring}
              >
                {tab === "overview" && (
                  <OversiktTab
                    reconciliationDate={detail.reconciliation_date}
                    departmentName={departmentName}
                    revenueTotal={detail.revenue_total ? Number(detail.revenue_total) : null}
                    revenueCash={detail.revenue_cash ? Number(detail.revenue_cash) : null}
                    revenueCard={detail.revenue_card ? Number(detail.revenue_card) : null}
                    totalActualHours={
                      detail.total_actual_hours ? Number(detail.total_actual_hours) : null
                    }
                    totalLaborCost={
                      detail.total_labor_cost ? Number(detail.total_labor_cost) : null
                    }
                    laborPercentage={
                      detail.labor_percentage ? Number(detail.labor_percentage) : null
                    }
                    deviationCount={deviations.length}
                    openDeviationCount={deviations.filter((d) => d.status === "open").length}
                    pendingShiftCount={shiftApprovals.filter((s) => s.status === "pending").length}
                    openedAt={detail.department_session?.opened_at ?? null}
                    closedAt={detail.department_session?.closed_at ?? null}
                  />
                )}
                {tab === "revenue" && (
                  <RevenueSection
                    revenueTotal={detail.revenue_total ? Number(detail.revenue_total) : null}
                    revenueCard={detail.revenue_card ? Number(detail.revenue_card) : null}
                    revenueCash={detail.revenue_cash ? Number(detail.revenue_cash) : null}
                    revenueVat={detail.revenue_vat ? Number(detail.revenue_vat) : null}
                    revenueTransactions={detail.revenue_transactions}
                    revenueSource={detail.revenue_source}
                    images={images}
                  />
                )}
                {tab === "shifts" && (
                  <div id="blocker-target-shifts-pending">
                    <ShiftApprovalSection approvals={shiftApprovals} profileId={profileId} />
                  </div>
                )}
                {tab === "deviations" && (
                  <div>
                    {deviations
                      .filter((d) => d.blocks_day_approval && d.status === "open")
                      .map((d) => (
                        <div key={d.deviation_id} id={`blocker-target-dev-${d.deviation_id}`} />
                      ))}
                    <DeviationSection deviations={deviations} profileId={profileId} />
                  </div>
                )}
                {tab === "tasks" && (
                  <OppgaverTab
                    departmentSessionId={detail.department_session?.department_session_id ?? null}
                  />
                )}
                {tab === "audit" && <RevisjonsloggTab reconciliationId={reconciliationId} />}
                {tab === "tips" && (
                  <TipsTab
                    tipsView={tipsView ?? null}
                    departmentSessionId={departmentSessionId}
                    onAdjust={(dist) => setAdjustingDistribution(dist)}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* AdjustmentDialog — outside AnimatePresence to avoid remount on tab switch */}
            {adjustingDistribution && departmentSessionId && (
              <AdjustmentDialog
                distribution={{
                  id: adjustingDistribution.id,
                  profile_id: adjustingDistribution.profile_id,
                  calculated_amount: Number(adjustingDistribution.calculated_amount),
                  adjusted_amount:
                    adjustingDistribution.adjusted_amount !== null &&
                    adjustingDistribution.adjusted_amount !== undefined
                      ? Number(adjustingDistribution.adjusted_amount)
                      : null,
                }}
                departmentSessionId={departmentSessionId}
                open={!!adjustingDistribution}
                onOpenChange={(open) => {
                  if (!open) setAdjustingDistribution(null);
                }}
              />
            )}
          </div>

          {/* Sticky approve panel (does NOT animate on tab switch — prevents thrash) */}
          <aside aria-label="Godkjennings-panel" className="h-fit lg:sticky lg:top-4">
            <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
              {isLocked ? (
                <LockedState lockedAt={detail.locked_at!} />
              ) : isApproved ? (
                <ApprovedState
                  notes={detail.approval_notes}
                  onLock={() => lockDayMutation.mutate()}
                  isLocking={lockDayMutation.isPending}
                />
              ) : (
                <>
                  <p className="text-[10px] font-bold tracking-[0.14em] text-[color:var(--warning)] uppercase">
                    Venter godkjenning
                  </p>
                  <h2 className="font-heading text-foreground mt-1 mb-3 text-xl tracking-[-0.01em]">
                    Godkjenn oppgjør?
                  </h2>

                  {!showRejectForm ? (
                    <div className="space-y-3">
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Notater (valgfritt)…"
                        rows={2}
                        className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      />
                      <Button
                        type="button"
                        onClick={handleApprove}
                        disabled={
                          !canApprove ||
                          approveMutation.isPending ||
                          detail.status !== "awaiting_approval"
                        }
                        className="w-full gap-1.5"
                        aria-describedby={!canApprove ? "approve-disabled-reason" : undefined}
                      >
                        {approveMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        )}
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Godkjenn oppgjør
                      </Button>

                      {/* Admin override moved to PreflightGate overrideSlot per
                        Inv #13 (peer CTA, not escape). Keep the explainer
                        text here so the aside still clarifies why the button
                        is disabled. */}
                      {!canApprove && preflightBlockers.length > 0 && (
                        <p id="approve-disabled-reason" className="text-muted-foreground text-xs">
                          Løs {preflightBlockers.length}{" "}
                          {preflightBlockers.length === 1 ? "blokker" : "blokkere"} først — eller
                          bruk &laquo;Overstyr og godkjenn&raquo; i preflight-panelet over.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowRejectForm(true)}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring w-full rounded text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        Spør leder om revisjon
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Begrunnelse for avvisning…"
                        rows={3}
                        className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleReject}
                          disabled={!rejectReason.trim() || rejectMutation.isPending}
                          className="flex-1 gap-1.5"
                        >
                          {rejectMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          )}
                          <XCircle className="h-4 w-4" aria-hidden />
                          Avvis
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowRejectForm(false)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {/* Right rail — 320px ambient context. Hidden on deviations tab
            (no-rail equivalent: content redundant with the tab itself). */}
        {tab !== "deviations" && (
          <ReconciliationRightRail
            revenueTotal={detail.revenue_total ? Number(detail.revenue_total) : null}
            laborPercentage={detail.labor_percentage ? Number(detail.labor_percentage) : null}
            openDeviationCount={deviations.filter((d) => d.status === "open").length}
            blockingDeviationCount={
              deviations.filter((d) => d.status === "open" && d.blocks_day_approval).length
            }
            shiftLeaderName={detail.department_session?.duty_leader?.display_name ?? null}
            sessionClosedAt={detail.department_session?.closed_at ?? null}
            isApproved={isApproved}
            isLocked={isLocked}
            onLock={() => lockDayMutation.mutate()}
            isLocking={lockDayMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tips tab ────────────────────────────────────────────────────────────────

function formatNokDayDetail(amount: number): string {
  return (
    amount.toLocaleString("nb-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " kr"
  );
}

function TipsTab({
  tipsView,
  departmentSessionId,
  onAdjust,
}: {
  tipsView: TipsPoolView;
  departmentSessionId: string | null;
  onAdjust: (dist: Database["public"]["Tables"]["tip_distribution"]["Row"]) => void;
}) {
  if (!tipsView?.pool) {
    return (
      <div className="border-border rounded-xl border border-dashed p-8 text-center">
        <Coins className="text-muted-foreground mx-auto mb-3 h-8 w-8" aria-hidden />
        <p className="text-muted-foreground text-sm">Ingen tips-pot registrert for denne dagen</p>
      </div>
    );
  }

  const { pool, distributions, sumDistributed, diffFromPot } = tipsView;
  const hasDiff = diffFromPot !== 0;
  const isLocked = pool.status === "approved";

  return (
    <div className="space-y-4">
      {/* Pool header */}
      <div className="border-border bg-card flex items-center justify-between rounded-xl border p-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium">Pot</p>
          <p className="text-foreground font-mono text-lg font-bold">
            {formatNokDayDetail(Number(pool.amount_nok))}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isLocked
              ? "border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
              : "border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
          }`}
        >
          {isLocked ? "Godkjent" : "Registrert"}
        </span>
      </div>

      {/* Sum diff banner */}
      {hasDiff && (
        <div className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-3 py-2 text-xs font-medium text-[color:var(--warning)]">
          Differanse vs pot: {diffFromPot > 0 ? "+" : ""}
          {formatNokDayDetail(diffFromPot)} — juster andeler for å nullstille
        </div>
      )}

      {/* Distribution table */}
      {distributions.length > 0 ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold">
                  Ansatt
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-semibold">
                  Beregnet
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-semibold">
                  Justert
                </th>
                <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-semibold">
                  Aktivt beløp
                </th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((d) => {
                const effective =
                  d.adjusted_amount !== null && d.adjusted_amount !== undefined
                    ? Number(d.adjusted_amount)
                    : Number(d.calculated_amount);
                const hasAdjustment = d.adjusted_amount !== null && d.adjusted_amount !== undefined;

                return (
                  <tr
                    key={d.id}
                    className={cn(
                      "border-border border-b transition-colors last:border-0",
                      !isLocked ? "hover:bg-muted/30 cursor-pointer" : "cursor-default",
                    )}
                    onClick={() => {
                      if (!isLocked) onAdjust(d);
                    }}
                    aria-label={
                      !isLocked ? `Juster tips-andel for ${d.profile_id.slice(0, 8)}` : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {d.profile_id.slice(0, 8)}…
                        </span>
                        {!isLocked && (
                          <PenLine
                            className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-muted-foreground font-mono text-xs">
                        {formatNokDayDetail(Number(d.calculated_amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasAdjustment ? (
                        <span className="text-foreground font-mono text-xs font-semibold">
                          {formatNokDayDetail(Number(d.adjusted_amount))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-foreground font-mono text-xs font-semibold">
                        {formatNokDayDetail(effective)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-border border-t">
                <td colSpan={3} className="text-muted-foreground px-4 py-2.5 text-xs font-semibold">
                  Total fordelt
                </td>
                <td className="text-foreground px-4 py-2.5 text-right font-mono text-xs font-bold">
                  {formatNokDayDetail(sumDistributed)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Ingen distribusjoner funnet.</p>
      )}
    </div>
  );
}

// ─── Approve / Locked states ──────────────────────────────────────────────────

function ApprovedState({
  notes,
  onLock,
  isLocking,
}: {
  notes: string | null;
  onLock: () => void;
  isLocking: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" aria-hidden />
        <p className="text-foreground text-sm font-semibold">Godkjent</p>
      </div>
      {notes && <p className="text-muted-foreground mb-4 text-xs italic">&ldquo;{notes}&rdquo;</p>}
      <Button type="button" onClick={onLock} disabled={isLocking} className="w-full gap-1.5">
        {isLocking ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
        {isLocking ? "Låser…" : "Lås dag"}
      </Button>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        Når dagen låses blir timer overført til lønn, og tall frosne for rapport. Kan åpnes igjen av
        admin.
      </p>
    </div>
  );
}

function LockedState({ lockedAt }: { lockedAt: string }) {
  return (
    <div className="flex items-center gap-3">
      <Lock className="text-muted-foreground h-5 w-5" aria-hidden />
      <div>
        <p className="text-foreground text-sm font-semibold">Dagen er låst</p>
        <p className="text-muted-foreground text-xs">
          Låst{" "}
          {new Date(lockedAt).toLocaleDateString("nb-NO", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
