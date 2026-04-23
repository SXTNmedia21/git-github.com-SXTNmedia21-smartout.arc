"use client";

import { useContext, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  History,
  Loader2,
  Lock,
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

type TabKey = "overview" | "revenue" | "shifts" | "deviations" | "tasks" | "audit";

const TABS: Array<{ key: TabKey; label: string; Icon: typeof CheckCircle2 }> = [
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
    ? { duration: 0.18 }
    : { type: "spring" as const, stiffness: 38, damping: 22, mass: 2.2 };

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

  const departmentName =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (detail as any).department_session?.department?.name ?? "—";

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
      <header className="border-border bg-card rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
              Admin-gjennomgang
            </p>
            <h1 className="font-heading text-foreground mt-1 text-3xl tracking-[-0.02em]">
              {new Date(detail.reconciliation_date + "T00:00:00").toLocaleDateString("nb-NO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{departmentName}</p>
          </div>
          <PhaseBadge phase={phase} />
        </div>
      </header>

      {/* Main grid — 1fr + 380px sticky approve panel */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
          <div
            role="tablist"
            aria-label="Oppgjør-seksjoner"
            className="border-border bg-card flex items-center gap-0.5 overflow-x-auto rounded-xl border p-1"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={`tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <t.Icon className="h-3.5 w-3.5" aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>

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
                  totalLaborCost={detail.total_labor_cost ? Number(detail.total_labor_cost) : null}
                  laborPercentage={detail.labor_percentage ? Number(detail.labor_percentage) : null}
                  deviationCount={deviations.length}
                  openDeviationCount={deviations.filter((d) => d.status === "open").length}
                  pendingShiftCount={shiftApprovals.filter((s) => s.status === "pending").length}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  openedAt={((detail as any).department_session?.opened_at as string) ?? null}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  closedAt={((detail as any).department_session?.closed_at as string) ?? null}
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
                  departmentSessionId={
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ((detail as any).department_session?.department_session_id as string) ?? null
                  }
                />
              )}
              {tab === "audit" && <RevisjonsloggTab reconciliationId={reconciliationId} />}
            </motion.div>
          </AnimatePresence>
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
                        {preflightBlockers.length === 1 ? "blokker" : "blokkere"} først — eller bruk
                        &laquo;Overstyr og godkjenn&raquo; i preflight-panelet over.
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
    </div>
  );
}

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
