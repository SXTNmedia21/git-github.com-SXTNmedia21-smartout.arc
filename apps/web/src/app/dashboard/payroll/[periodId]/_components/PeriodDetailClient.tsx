/**
 * PeriodDetailClient — client boundary for /dashboard/payroll/[periodId].
 *
 * Renders the period detail view with:
 *   - PeriodHeader (date range, status badge, Recalculate + Lock buttons)
 *   - Tabs: Linjer | Avvik
 *   - LinesTable — per-profile payroll summary
 *   - DeviationList — deviation rows with acknowledge UI
 *   - LockModal — confirmation before irreversible period lock
 *
 * ADR-0133: This surface is web-only (manager authoring). Mobile reads lønnsgrunnlag
 * via the read-only /dashboard/my-salary surface.
 *
 * Recalculate calls POST /api/payroll/recalculate-period.
 * Lock calls POST /api/payroll/lock-period.
 * Acknowledge updates payroll.deviation via anon client (RLS-scoped).
 */
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayrollPeriod } from "../_hooks/use-payroll-period";
import { usePayrollLines } from "../_hooks/use-payroll-lines";
import { usePayrollDeviations } from "../_hooks/use-payroll-deviations";
import { useWorkspaceFramework, buildFrameworkLabel } from "../_hooks/use-workspace-framework";
import { useAcknowledgeDeviation } from "../_hooks/use-acknowledge-deviation";
import { useLockPeriod } from "../_hooks/use-lock-period";
import { PeriodHeader } from "./PeriodHeader";
import { LinesTable } from "./LinesTable";
import { DeviationList } from "./DeviationList";
import { LockModal } from "./LockModal";
import { ManualSupplementForm } from "./ManualSupplementForm";
import { ExportTab } from "./ExportTab";

type Props = {
  periodId: string;
};

export function PeriodDetailClient({ periodId }: Props) {
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [supplementModalOpen, setSupplementModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const { data: period, isLoading: isPeriodLoading } = usePayrollPeriod(periodId);
  const {
    data: lines,
    isLoading: isLinesLoading,
    refetch: refetchLines,
  } = usePayrollLines(periodId);
  const {
    data: deviations,
    isLoading: isDevsLoading,
    refetch: refetchDevs,
  } = usePayrollDeviations(periodId);
  const { mutate: acknowledge, isPending: isAcknowledging } = useAcknowledgeDeviation(periodId);
  const { mutate: lockPeriod, isPending: isLocking } = useLockPeriod(periodId);
  const { data: frameworkInfo } = useWorkspaceFramework(period?.workspace_id ?? "");

  if (isPeriodLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-64 animate-pulse rounded" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="p-4 text-sm text-red-600">
        Lønnsperioden ble ikke funnet eller du har ikke tilgang.
      </div>
    );
  }

  const deviationErrors =
    deviations?.filter((d) => d.severity === "error" && !d.acknowledged_at).length ?? 0;

  const periodLabel = `${format(new Date(period.start_date), "d. MMM", { locale: nb })} – ${format(new Date(period.end_date), "d. MMM yyyy", { locale: nb })}`;

  const isOpen = period.status === "open";

  // Fix 1: tariff label for drawer header (Bokføringsloven §13 audit stamp).
  // Framework comes from live workspace_framework_binding until ADR-0252 migration
  // ships framework_snapshot_id on payroll.period.
  const frameworkLabel = frameworkInfo
    ? buildFrameworkLabel(frameworkInfo, period.locked_at ?? null)
    : null;

  async function handleRecalculate() {
    if (!period) return;
    setIsRecalculating(true);
    try {
      const res = await fetch("/api/payroll/recalculate-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: period.workspace_id, period_id: periodId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        deviations?: number;
        errors?: number;
      };
      if (!data.ok) {
        toast.error(`Beregning feilet: ${data.error ?? "ukjent feil"}`);
        return;
      }
      toast.success(`Beregning fullført. ${data.deviations ?? 0} avvik, ${data.errors ?? 0} feil.`);
      void refetchLines();
      void refetchDevs();
    } catch {
      toast.error("Nettverksfeil under beregning.");
    } finally {
      setIsRecalculating(false);
    }
  }

  function handleLockConfirm() {
    if (!period) return;
    lockPeriod(
      { workspaceId: period.workspace_id, periodId },
      {
        onSuccess: (result) => {
          setLockModalOpen(false);
          if (result.ok) {
            toast.success("Perioden er låst.");
          } else if (result.error === "unacked_errors") {
            toast.error(`Kan ikke låse — ${result.unacked ?? 0} ubehandlet feil-avvik.`);
          } else {
            toast.error(result.error ?? "Låsing feilet.");
          }
        },
        onError: (err) => {
          setLockModalOpen(false);
          toast.error((err as Error).message ?? "Låsing feilet.");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PeriodHeader
        period={period}
        deviationErrors={deviationErrors}
        isRecalculating={isRecalculating}
        onRecalculate={handleRecalculate}
        onLock={() => setLockModalOpen(true)}
      />

      {/* "+ Manuelt tillegg" — only visible on open periods (ADR-0133) */}
      {isOpen && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSupplementModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Manuelt tillegg
          </Button>
        </div>
      )}

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Linjer {lines?.length ? `(${lines.length})` : ""}</TabsTrigger>
          <TabsTrigger value="deviations">
            Avvik{" "}
            {deviations?.length
              ? `(${deviationErrors > 0 ? `${deviationErrors} feil` : deviations.length})`
              : ""}
          </TabsTrigger>
          <TabsTrigger value="export">Eksport</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="mt-4">
          {/* Fix 5: isAdmin + periodStatus + workspaceId forwarded for "Foreslå endring" gate.
              isAdmin=true: payroll surface is already manager-gated by RLS — same rationale
              as ExportTab (line 196). BFF re-validates before any write (ADR-0292). */}
          <LinesTable
            lines={lines ?? []}
            isLoading={isLinesLoading}
            periodId={periodId}
            periodStatus={period.status}
            workspaceId={period.workspace_id}
            isAdmin={true}
            frameworkLabel={frameworkLabel ?? undefined}
          />
        </TabsContent>

        <TabsContent value="deviations" className="mt-4">
          <DeviationList
            deviations={deviations ?? []}
            isLoading={isDevsLoading}
            isPeriodOpen={isOpen}
            onAcknowledge={(deviationId, resolution) =>
              acknowledge(
                { deviationId, resolution, periodId },
                {
                  onSuccess: () => toast.success("Avvik bekreftet."),
                  onError: () => toast.error("Kunne ikke bekrefte avvik."),
                },
              )
            }
            isAcknowledging={isAcknowledging}
          />
        </TabsContent>

        {/* Eksport tab — visible to all users with period access (managers+).
            isAdmin=true: the payroll surface is already manager-gated by RLS.
            The BFF enforces the real admin check for unmasked PII exports.
            ADR-0133: web-only authoring surface. */}
        <TabsContent value="export" className="mt-4">
          <ExportTab
            periodId={periodId}
            periodStatus={period.status}
            isAdmin={true}
            workspaceId={period.workspace_id}
          />
        </TabsContent>
      </Tabs>

      <LockModal
        open={lockModalOpen}
        onOpenChange={setLockModalOpen}
        onConfirm={handleLockConfirm}
        isLoading={isLocking}
        periodLabel={periodLabel}
      />

      {/* ManualSupplementForm — Screen 06 (T3.1). Mounted only when period is open. */}
      {isOpen && (
        <ManualSupplementForm
          open={supplementModalOpen}
          onOpenChange={setSupplementModalOpen}
          periodId={periodId}
          workspaceId={period.workspace_id}
          onSuccess={() => {
            void refetchLines();
          }}
        />
      )}
    </div>
  );
}
