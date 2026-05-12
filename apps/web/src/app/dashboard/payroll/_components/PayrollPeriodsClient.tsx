/**
 * PayrollPeriodsClient — client boundary for /dashboard/payroll.
 *
 * Displays a year-filtered list of payroll periods for the workspace.
 * Each period card links to /dashboard/payroll/[periodId] for detail.
 *
 * Layout: page header (with "Ny periode" button) + year filter + period card list.
 */
"use client";

import { useState, useMemo } from "react";
import { Plus, Receipt } from "lucide-react";
import { usePayrollPeriods } from "../_hooks/use-payroll-periods";
import { PeriodCard } from "./PeriodCard";
import { PeriodFilters } from "./PeriodFilters";
import { EmptyState } from "./EmptyState";
import { CreatePeriodDialog } from "./CreatePeriodDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function PayrollPeriodsClient() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [createOpen, setCreateOpen] = useState(false);

  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";

  const { data: summaries, isLoading, error } = usePayrollPeriods();

  const filtered = useMemo(() => {
    if (!summaries) return [];
    return summaries.filter((s) => new Date(s.period.end_date).getFullYear() === year);
  }, [summaries, year]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="text-muted-foreground h-5 w-5" />
          <h1 className="text-foreground text-lg font-semibold">Lønnsperioder</h1>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilters year={year} onYearChange={setYear} />
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!workspaceId}>
            <Plus className="h-4 w-4" />
            Ny periode
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive rounded-lg border p-4 text-sm">
          Kunne ikke laste lønnsperioder. Prøv igjen.
        </div>
      ) : !summaries?.length ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          Ingen lønnsperioder for {year}.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <PeriodCard key={s.period.id} summary={s} />
          ))}
        </div>
      )}

      {workspaceId && (
        <CreatePeriodDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
