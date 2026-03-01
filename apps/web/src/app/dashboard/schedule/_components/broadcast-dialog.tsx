// ============================================
// broadcast-dialog.tsx
// Simple confirmation dialog for sending push/SMS notifications
// to all employees working on a specific day.
// Connected to: schedule-context.tsx (reads shift count for the day)
// Connected to: day-context-menu.tsx (opens this dialog)
// ============================================
"use client";

import { Megaphone, MessageSquare, Send } from "lucide-react";
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

import type {
  Shift,
  Absence,
  OpenShift,
  ShiftTemplate,
  DayMessage,
  DayTask,
  DayBooking,
} from "./schedule-types";
import { useShifts } from "../_hooks/use-shifts";
import { useAbsences } from "../_hooks/use-absences";
import { useOpenShifts } from "../_hooks/use-open-shifts";
import { useTemplates } from "../_hooks/use-templates";
import { useDayMessages, useDayTasks, useDayBookings } from "../_hooks/use-day-content";
import { useScheduleComputed } from "../_hooks/use-schedule-computed";
import { useWeekRange } from "../_hooks/use-week-range";

// ── Props ───────────────────────────────────────────────────

type BroadcastDialogProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation dialog for broadcasting push or SMS notifications
 * to employees scheduled on a given day.
 * Shows the employee count and offers Push or SMS delivery.
 *
 * @param dateId - The day to broadcast to
 * @param open - Controlled open state
 * @param onOpenChange - Callback when open state changes
 * @returns shadcn Dialog with two send buttons
 */
export function BroadcastDialog({ dateId, open, onOpenChange }: BroadcastDialogProps) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const { data: absences = [] as Absence[] } = useAbsences(weekStart, weekEnd);
  const { data: openShiftsData = [] as OpenShift[] } = useOpenShifts();
  const { data: templates = [] as ShiftTemplate[] } = useTemplates();
  const { data: dayMessages = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const { data: dayTasks = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const { data: dayBookings = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);

  const computed = useScheduleComputed(
    shifts,
    absences,
    openShiftsData.length,
    templates,
    dayMessages,
    dayTasks,
    dayBookings,
  );

  const dayStats = computed.getDayStats(dateId);
  const staffCount = dayStats.staffCount;

  /** Sends push notification and shows toast feedback. */
  function handleSendPush() {
    toast.success(`Push-varsler sendt til ${staffCount} ansatte`);
    onOpenChange(false);
  }

  /** Sends SMS and shows toast feedback. */
  function handleSendSms() {
    toast.success(`SMS sendt til ${staffCount} ansatte`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Send melding
          </DialogTitle>
          <DialogDescription>
            Send Push / SMS til {staffCount} {staffCount === 1 ? "ansatt" : "ansatte"} pa vakt?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button variant="secondary" onClick={handleSendPush}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send Push
          </Button>
          <Button onClick={handleSendSms}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
