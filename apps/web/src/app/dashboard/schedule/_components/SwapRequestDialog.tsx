"use client";

/**
 * SwapRequestDialog — lets an employee (or admin on behalf of) request a shift swap.
 *
 * Flow:
 * 1. Shows "Din vakt" details (date, time, position)
 * 2. Fetches eligible colleagues (same workspace, published shifts)
 * 3. User selects a target shift → client-side validateSwap() runs
 * 4. Shows blockers/warnings with semantic status badges
 * 5. Confirm button calls useInitiateSwap()
 *
 * Connected to: use-shift-swap.ts (mutations), validate-swap (D3 validation)
 * Connected to: use-employees.ts (colleague names), use-shifts.ts (shift data)
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeftRight, AlertTriangle, XCircle, CheckCircle, Loader2 } from "lucide-react";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { validateSwap } from "@smartout/utils";
import type { ShiftForValidation, SwapValidationResult } from "@smartout/utils";
import { useQuery } from "@tanstack/react-query";

import { useInitiateSwap } from "../_hooks/use-shift-swap";
import type { Shift } from "./schedule-types";

type SwapRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shift being offered for swap */
  shift: Shift;
};

/** Minimal profile row for the colleague picker */
type ColleagueProfile = {
  profile_id: string;
  display_name: string;
};

/** A target shift with its owner's name */
type EligibleShift = ShiftForValidation & {
  display_name: string;
};

export function SwapRequestDialog({ open, onOpenChange, shift }: SwapRequestDialogProps) {
  const { workspace } = useWorkspace();
  const initiateSwap = useInitiateSwap();

  const [selectedTargetShift, setSelectedTargetShift] = useState<EligibleShift | null>(null);
  const [reason, setReason] = useState("");
  const [validationResult, setValidationResult] = useState<SwapValidationResult | null>(null);

  // ── Fetch eligible shifts from other employees ────────────────────────────
  const eligibleQuery = useQuery({
    queryKey: ["schedule", "swap-eligible", shift.id, workspace.workspace_id],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();

      // Get published/assigned shifts for other employees in the same workspace
      const { data: shifts, error: shiftsError } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, employee_id, shift_date, start_time, end_time, work_hours, position_id, status",
        )
        .eq("workspace_id", workspace.workspace_id)
        .neq("employee_id", shift.employeeId!)
        .in("status", ["published", "assigned"])
        .gte("shift_date", new Date().toISOString().split("T")[0]);

      if (shiftsError) throw shiftsError;

      // Get profile display names for the eligible employees
      const employeeIds = [
        ...new Set(
          (shifts ?? []).map((s) => s.employee_id).filter((id): id is string => id !== null),
        ),
      ];

      if (employeeIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .in("profile_id", employeeIds);

      const profileMap = new Map<string, string>();
      for (const p of (profiles ?? []) as ColleagueProfile[]) {
        profileMap.set(p.profile_id, p.display_name ?? "Ukjent");
      }

      return (shifts ?? []).map(
        (s): EligibleShift => ({
          schedule_shift_id: s.schedule_shift_id,
          employee_id: s.employee_id,
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
          work_hours: Number(s.work_hours),
          position_id: s.position_id,
          status: s.status,
          display_name: profileMap.get(s.employee_id ?? "") ?? "Ukjent",
        }),
      );
    },
  });

  // ── Group eligible shifts by employee ─────────────────────────────────────
  const groupedByEmployee = useMemo(() => {
    if (!eligibleQuery.data) return [];
    const map = new Map<string, { name: string; shifts: EligibleShift[] }>();
    for (const s of eligibleQuery.data) {
      if (!s.employee_id) continue;
      const existing = map.get(s.employee_id);
      if (existing) {
        existing.shifts.push(s);
      } else {
        map.set(s.employee_id, {
          name: s.display_name,
          shifts: [s],
        });
      }
    }
    return Array.from(map.entries()).map(([id, data]) => ({
      employeeId: id,
      ...data,
    }));
  }, [eligibleQuery.data]);

  // ── Run validation when a target shift is selected ────────────────────────
  function handleSelectTarget(target: EligibleShift) {
    setSelectedTargetShift(target);

    // Build the requester shift in validation format
    const requesterShift: ShiftForValidation = {
      schedule_shift_id: shift.id,
      employee_id: shift.employeeId,
      shift_date: shift.dateId,
      start_time: shift.startTime,
      end_time: shift.endTime,
      work_hours: shift.workHours,
      position_id: shift.positionId ?? null,
      status: shift.status,
    };

    // All shifts belonging to the target employee (for overlap/hours checks)
    const targetEmployeeShifts = (eligibleQuery.data ?? []).filter(
      (s) => s.employee_id === target.employee_id,
    );

    const result = validateSwap({
      requesterShift,
      targetShift: target,
      targetEmployeeShifts,
      requesterEmployeeShifts: [], // Would need requester's other shifts — simplified for Phase 1
      targetHasAbsence: false, // Would need absence data — simplified for Phase 1
      requesterHasAbsence: false,
      now: new Date(),
    });

    setValidationResult(result);
  }

  // ── Submit the swap request ───────────────────────────────────────────────
  function handleConfirm() {
    if (!selectedTargetShift?.employee_id) return;

    initiateSwap.mutate(
      {
        requesterShiftId: shift.id,
        targetProfileId: selectedTargetShift.employee_id,
        targetShiftId: selectedTargetShift.schedule_shift_id,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetState();
        },
      },
    );
  }

  function resetState() {
    setSelectedTargetShift(null);
    setReason("");
    setValidationResult(null);
  }

  const canSubmit = selectedTargetShift && validationResult?.eligible && !initiateSwap.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Foreslå bytte
          </DialogTitle>
          <DialogDescription>Velg en kollega og vakt å bytte med</DialogDescription>
        </DialogHeader>

        {/* ── Your shift details ──────────────────────────────────── */}
        <div className="border-border bg-muted/50 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium">Din vakt</p>
          <p className="text-sm font-semibold">
            {shift.dateId} &middot; {shift.startTime} - {shift.endTime}
          </p>
          <p className="text-muted-foreground text-xs">{shift.role}</p>
        </div>

        {/* ── Colleague picker ────────────────────────────────────── */}
        <div className="space-y-2">
          <Label className="text-sm">Velg kollega og vakt</Label>
          <ScrollArea className="max-h-48">
            {eligibleQuery.isLoading && (
              <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Laster kolleger...
              </div>
            )}
            {groupedByEmployee.length === 0 && !eligibleQuery.isLoading && (
              <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                Ingen tilgjengelige kolleger for denne vakten
              </div>
            )}
            <div className="space-y-1" role="listbox">
              {groupedByEmployee.map((group) =>
                group.shifts.map((targetShift) => (
                  <button
                    key={targetShift.schedule_shift_id}
                    role="option"
                    aria-selected={
                      selectedTargetShift?.schedule_shift_id === targetShift.schedule_shift_id
                    }
                    className={`hover:bg-accent focus-visible:ring-ring flex w-full items-center justify-between rounded-md p-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                      selectedTargetShift?.schedule_shift_id === targetShift.schedule_shift_id
                        ? "bg-accent"
                        : ""
                    }`}
                    onClick={() => handleSelectTarget(targetShift)}
                  >
                    <div>
                      <span className="font-medium">{group.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {targetShift.shift_date} &middot; {targetShift.start_time} -{" "}
                        {targetShift.end_time}
                      </span>
                    </div>
                  </button>
                )),
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Validation result ───────────────────────────────────── */}
        {validationResult && (
          <div className="space-y-2">
            {validationResult.blockers.length > 0 && (
              <div className="space-y-1">
                {validationResult.blockers.map((blocker, i) => (
                  <Badge
                    key={i}
                    variant="destructive"
                    className="flex w-full items-center justify-start gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {blocker}
                  </Badge>
                ))}
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <div className="space-y-1">
                {validationResult.warnings.map((warning, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="border-warning text-warning flex w-full items-center justify-start gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {warning}
                  </Badge>
                ))}
              </div>
            )}
            {validationResult.tariff_delta !== undefined && (
              <p className="text-muted-foreground text-xs">
                Kostnadsendring: {validationResult.tariff_delta} kr/t
              </p>
            )}
            {validationResult.eligible && validationResult.warnings.length === 0 && (
              <Badge
                variant="outline"
                className="border-success text-success flex w-full items-center justify-start gap-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Ingen blokkeringer eller advarsler
              </Badge>
            )}
          </div>
        )}

        {/* ── Reason ──────────────────────────────────────────────── */}
        {selectedTargetShift && (
          <div className="space-y-1">
            <Label htmlFor="swap-reason" className="text-sm">
              Begrunnelse (valgfri)
            </Label>
            <Textarea
              id="swap-reason"
              placeholder="F.eks. Legetime, bytte av fridag..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {initiateSwap.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sender...
              </>
            ) : (
              "Bekreft bytte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
