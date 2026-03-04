// ============================================
// publish-overview-dialog.tsx
// Confirmation dialog showing a summary of all draft shifts
// that will be published. Groups shifts by day with employee
// name, time, and role details.
// Connected to: use-shifts.ts (usePublishShifts mutation)
// Connected to: schedule-types.ts (Shift type)
// ============================================
"use client";

import { useMemo } from "react";
import { Send, Clock, Users } from "lucide-react";
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
};

/**
 * Shows a grouped summary of all draft shifts before publishing.
 * Groups shifts by day, displaying employee name, time, and role.
 * Offers "Publiser alle" and "Avbryt" buttons.
 */
export function PublishOverviewDialog({
  open,
  onOpenChange,
  shifts,
  employees,
  onPublish,
  isPublishing = false,
}: PublishOverviewDialogProps) {
  const draftShifts = useMemo(
    () => shifts.filter((s) => s.status === "created" || s.status === "assigned"),
    [shifts],
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

  function handlePublish() {
    const ids = draftShifts.map((s) => s.id);
    onPublish(ids);
    toast.success(`${ids.length} vakter publisert`);
    onOpenChange(false);
  }

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
                          className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2"
                        >
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
                          <div className="min-w-0 flex-1">
                            <span className="text-foreground text-xs font-medium">
                              {emp?.name ?? "Ikke tildelt"}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-xs">{shift.role}</span>
                          <div className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            {shift.startTime}–{shift.endTime}
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

        <DialogFooter className="border-border flex-row gap-2 border-t px-6 py-4 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={draftShifts.length === 0 || isPublishing}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Publiser alle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
