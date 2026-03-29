"use client";

/**
 * Compact list of pending absence requests for admin approval.
 * Renders inside the schedule day control panel (OversiktTab).
 * Each row shows employee name, dates, type, and approve/reject buttons.
 * Connected to: use-pending-absences.ts (query), use-absences.ts (mutations)
 */

import { useState } from "react";
import { Check, X, Clock, AlertCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { usePendingAbsences } from "../_hooks/use-pending-absences";
import { useApproveAbsence, useRejectAbsence } from "../_hooks/use-absences";
import { useWeekRange } from "../_hooks/use-week-range";
import type { PendingAbsence } from "../_hooks/use-pending-absences";

/** Maps DB absence_type values to i18n suffix keys under schedule.absence_approval */
const ABSENCE_TYPE_KEYS: Record<string, string> = {
  sick_leave: "type_sick",
  vacation: "type_vacation",
  parental_leave: "type_parental",
  unpaid_leave: "type_unpaid",
  military: "type_military",
  training: "type_training",
  welfare: "type_welfare",
};

/** Format a date range as "3. mar" or "3. mar – 7. mar" (nb-NO locale) */
function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  return start === end ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

/** Count calendar days between two ISO date strings (inclusive) */
function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function PendingAbsenceList() {
  const { t } = useTranslation("dashboard");
  const { data: pending, isLoading } = usePendingAbsences();
  const { weekStart } = useWeekRange();
  const approve = useApproveAbsence(weekStart);
  const reject = useRejectAbsence(weekStart);
  const [rejectTarget, setRejectTarget] = useState<PendingAbsence | null>(null);

  // Don't render anything while loading or when there are no pending requests
  if (isLoading || !pending?.length) return null;

  const handleApprove = (id: string) => {
    approve.mutate(id);
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    reject.mutate(rejectTarget.id);
    setRejectTarget(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-foreground flex items-center gap-2 text-sm font-medium">
        <AlertCircle className="text-warning h-4 w-4" />
        {t("schedule.absence_approval.title")} ({pending.length})
      </div>

      <div className="space-y-1.5">
        {pending.map((absence) => {
          const typeKey = ABSENCE_TYPE_KEYS[absence.absenceType] ?? absence.absenceType;
          const days = dayCount(absence.startDate, absence.endDate);

          return (
            <div
              key={absence.id}
              className="border-border bg-card flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="text-warning h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{absence.employeeName}</p>
                  <p className="text-muted-foreground text-xs">
                    {t(`schedule.absence_approval.${typeKey}`)} ·{" "}
                    {formatDateRange(absence.startDate, absence.endDate)} ·{" "}
                    {t("schedule.absence_approval.days_count", {
                      count: days,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-success hover:bg-success/10 h-7 w-7"
                  onClick={() => handleApprove(absence.id)}
                  disabled={approve.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 h-7 w-7"
                  onClick={() => setRejectTarget(absence)}
                  disabled={reject.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog before rejecting an absence request */}
      <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedule.absence_approval.reject")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("schedule.absence_approval.confirm_reject")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("schedule.absence_approval.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("schedule.absence_approval.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
