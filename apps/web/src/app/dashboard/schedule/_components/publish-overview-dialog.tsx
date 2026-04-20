// ============================================
// publish-overview-dialog.tsx
// Confirmation dialog showing a summary of all draft shifts
// that will be published. Groups shifts by day with employee
// name, time, and role details. Runs cascade rule validation
// before confirming publish — blocked shifts require explicit
// acknowledgment ("Publiser likevel") before proceeding.
// Connected to: use-shifts.ts (usePublishShifts mutation)
// Connected to: schedule-types.ts (Shift type)
// Connected to: use-publish-validation.ts (cascade rule gate)
// ============================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, Clock, Users, X, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { Shift } from "./schedule-types";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import { usePublishValidation } from "../_hooks/use-publish-validation";

// ── Day labels for formatting ────────────────────────────────
const DAY_LABELS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function formatDate(dateId: string): string {
  const d = new Date(dateId + "T00:00:00");
  const dayName = DAY_LABELS[d.getDay()] ?? "";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${dayName} ${day}/${month}`;
}

// ── Props ───────────────────────────────────────────────────

type PublishOverviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: Shift[];
  employees: ScheduleEmployee[];
  onPublish: (shiftIds: string[]) => void;
  isPublishing?: boolean;
  onEditShift?: (shiftId: string) => void;
};

/**
 * Shows a grouped summary of all draft shifts before publishing.
 * Groups shifts by day, displaying employee name, time, and role.
 * Runs cascade rule validation and shows a warning/blocked banner
 * when framework rules are violated. Blocked shifts require the
 * user to click "Publiser likevel" once to acknowledge before the
 * actual publish fires on a second click.
 */
export function PublishOverviewDialog({
  open,
  onOpenChange,
  shifts,
  employees,
  onPublish,
  isPublishing = false,
  onEditShift,
}: PublishOverviewDialogProps) {
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [showHits, setShowHits] = useState(false);
  // Tracks whether the user has acknowledged blocked shifts once
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset per-dialog UI state whenever the dialog is opened/closed
  useEffect(() => {
    if (!open) {
      setDiscardedIds(new Set());
      setShowHits(false);
      setAcknowledged(false);
    }
  }, [open]);

  const draftShifts = useMemo(
    () =>
      shifts.filter(
        (s) => (s.status === "created" || s.status === "assigned") && !discardedIds.has(s.id),
      ),
    [shifts, discardedIds],
  );

  const employeeMap = useMemo(() => {
    const map = new Map<string, ScheduleEmployee>();
    for (const emp of employees) {
      map.set(emp.id, emp);
    }
    return map;
  }, [employees]);

  /** Group draft shifts by dateId, sorted chronologically */
  const groupedByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of draftShifts) {
      const existing = map.get(shift.dateId) ?? [];
      existing.push(shift);
      map.set(shift.dateId, existing);
    }
    // Sort days chronologically
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    // Sort shifts within each day by startTime
    for (const [, dayShifts] of sorted) {
      dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return sorted;
  }, [draftShifts]);

  // ── Cascade rule validation ──────────────────────────────
  const shiftsForValidation = useMemo(
    () =>
      draftShifts.map((s) => {
        const emp = s.employeeId ? employeeMap.get(s.employeeId) : undefined;
        return {
          id: s.id,
          employeeId: s.employeeId,
          employeeName: emp?.name ?? "Ikke tildelt",
          dateId: s.dateId,
          startTime: s.startTime,
          endTime: s.endTime,
        };
      }),
    [draftShifts, employeeMap],
  );

  const { result: validation, isLoading: validationLoading } = usePublishValidation(
    shiftsForValidation,
    open && draftShifts.length > 0,
  );

  const hasIssues = validation.warnings > 0 || validation.blocked > 0;

  // ── Publish handler ──────────────────────────────────────
  function handlePublish() {
    // First click when blocked: only acknowledge, do not publish yet
    if (validation.blocked > 0 && !acknowledged) {
      setAcknowledged(true);
      return;
    }
    const ids = draftShifts.map((s) => s.id);
    onPublish(ids);
    toast.success(`${ids.length} vakter publisert`);
    onOpenChange(false);
  }

  // ── Determine publish button appearance ─────────────────
  const publishButtonIsRed = validation.blocked > 0;
  const publishLabel =
    validation.blocked > 0 && !acknowledged ? "Publiser likevel" : "Publiser alle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="border-border relative overflow-hidden rounded-t-lg border-b px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Send className="h-4 w-4" />
              </div>
              Publiser vakter
            </DialogTitle>
            <DialogDescription className="text-xs">
              {draftShifts.length} {draftShifts.length === 1 ? "vakt" : "vakter"} vil bli publisert
            </DialogDescription>
          </DialogHeader>
        </div>

        {draftShifts.length === 0 ? (
          <div className="text-muted-foreground px-6 py-8 text-center text-sm">
            Ingen upubliserte vakter å publisere.
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4 px-6 py-4 pr-4">
              {groupedByDay.map(([dateId, dayShifts]) => (
                <div key={dateId}>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold">{formatDate(dateId)}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {dayShifts.length} {dayShifts.length === 1 ? "vakt" : "vakter"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {dayShifts.map((shift) => {
                      const emp = shift.employeeId ? employeeMap.get(shift.employeeId) : undefined;
                      return (
                        <div
                          key={shift.id}
                          className="group bg-muted/50 hover:bg-muted/80 relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                        >
                          {/* Main Clickable Area */}
                          <button
                            type="button"
                            className="absolute inset-0 z-0 h-full w-full rounded-lg"
                            onClick={() => onEditShift?.(shift.id)}
                            aria-label="Rediger vakt"
                          />

                          <div className="z-10 flex shrink-0">
                            {emp ? (
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${emp.avatarColor}`}
                              >
                                {emp.initials}
                              </div>
                            ) : (
                              <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
                                <Users className="text-muted-foreground h-3 w-3" />
                              </div>
                            )}
                          </div>
                          <div className="z-10 flex min-w-0 flex-1 items-center gap-2">
                            <span className="text-foreground truncate text-xs font-medium">
                              {emp?.name ?? "Ikke tildelt"}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              - {shift.role}
                            </span>
                          </div>
                          <div className="text-muted-foreground z-10 flex items-center gap-1 text-xs whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {shift.startTime}–{shift.endTime}
                          </div>
                          <div className="z-10 flex shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiscardedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(shift.id);
                                  return next;
                                });
                              }}
                              title="Ikke publiser denne"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* ── Validation summary ─────────────────────────────── */}
        {draftShifts.length > 0 && !validationLoading && (
          <div className="border-border border-t px-6 py-3">
            {hasIssues ? (
              <div
                className={`rounded-lg px-3 py-2 ${
                  validation.blocked > 0 ? "bg-red-500/10" : "bg-yellow-500/10"
                }`}
              >
                {/* Summary row — clickable to expand */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => setShowHits((v) => !v)}
                >
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${
                      validation.blocked > 0 ? "text-red-500" : "text-yellow-500"
                    }`}
                  />
                  <span
                    className={`flex-1 text-xs font-medium ${
                      validation.blocked > 0 ? "text-red-600" : "text-yellow-600"
                    }`}
                  >
                    {validation.blocked > 0 && <>{validation.blocked} blokkert</>}
                    {validation.blocked > 0 && validation.warnings > 0 && ", "}
                    {validation.warnings > 0 && (
                      <>
                        {validation.warnings} advarsel{validation.warnings !== 1 ? "er" : ""}
                      </>
                    )}
                    {" – regelbrudd"}
                  </span>
                  <ChevronRight
                    className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform ${
                      showHits ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Expandable hit list */}
                {showHits && validation.hits.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-5">
                    {validation.hits.map((hit, idx) => (
                      <li key={`${hit.shiftId}-${idx}`} className="flex items-start gap-1.5">
                        <span
                          className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                            hit.outcome === "blocked" ? "bg-red-500" : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-foreground text-xs">
                          <span className="font-medium">{hit.employeeName}</span>
                          {" — "}
                          {hit.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600">
                  {validation.totalShifts} {validation.totalShifts === 1 ? "vakt" : "vakter"} klar,
                  ingen regelbrudd
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-border flex-row gap-2 border-t px-6 py-4 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={draftShifts.length === 0 || isPublishing || validationLoading}
            className={
              publishButtonIsRed
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {publishLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
