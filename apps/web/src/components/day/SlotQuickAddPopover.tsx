"use client";

// =============================================================================
// SlotQuickAddPopover.tsx
//
// Five-action popover anchored to a time-axis click on DayTimelineStrip.
// Opens with the clicked HH:MM as heading ("Legg til kl 14:00").
//
// Authority gate: hidden entirely for role === 'employee' (spec § 8).
// Write-path gating is handled server-side in Track E/F.
//
// Actions:
//   Booking      → opens ReservationSheet (prefilled time)
//   Notat        → opens DailyNoteSheet (prefilled time — Track E extends it)
//   Oppgave      → opens AddTaskDialog (prefilled time hint — TODO wire in follow-up)
//   Avvik        → opens DeviationDialog (prefilled time hint — TODO wire in follow-up)
//   Vaktstart    → opens ShiftStartDialog
//
// Telemetry: emits ui.dagslinjen.slot_quickadd.action_picked on each click.
// =============================================================================

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, StickyNote, CheckCircle2, AlertTriangle, LogIn } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@smartout/ui";
import { emit, nonEmpty } from "@smartout/telemetry";
import { motion as motionTokens } from "@smartout/design-tokens";

// Role type — mirrors WorkspaceRole from lib/context/bootstrap-contract.ts
type WorkspaceRole = "employee" | "manager" | "admin" | "owner";

type Action = "booking" | "note" | "task" | "deviation" | "shift_start";

type ActionButton = {
  action: Action;
  label: string;
  Icon: typeof Calendar;
  description: string;
};

const ACTION_BUTTONS: ActionButton[] = [
  {
    action: "booking",
    label: "Booking",
    Icon: Calendar,
    description: "Legg til bordreservasjon",
  },
  {
    action: "note",
    label: "Notat",
    Icon: StickyNote,
    description: "Skriv et sesjonnotat",
  },
  {
    action: "task",
    label: "Oppgave",
    Icon: CheckCircle2,
    description: "Opprett en oppgave",
  },
  {
    action: "deviation",
    label: "Avvik",
    Icon: AlertTriangle,
    description: "Registrer et avvik",
  },
  {
    action: "shift_start",
    label: "Vaktstart",
    Icon: LogIn,
    description: "Start vakt nå",
  },
];

export type SlotQuickAddPopoverProps = {
  /** Whether the popover is open */
  open: boolean;
  /** Called when popover open state changes */
  onOpenChange: (open: boolean) => void;
  /** The HH:MM time this popover represents */
  time: string;
  /** Actor profile id for telemetry (non-null from DashboardContext) */
  actorId: string | null;
  /** Workspace id for telemetry */
  workspaceId: string | null;
  /** Current user role — popover content is hidden for 'employee' */
  role: WorkspaceRole | null;
  /** Called when an action is chosen. Callers handle open-state of target sheets. */
  onAction: (action: Action, time: string) => void;
  /** Trigger element — the invisible hit-zone button from DayTimelineStrip */
  children: React.ReactNode;
};

export function SlotQuickAddPopover({
  open,
  onOpenChange,
  time,
  actorId,
  workspaceId,
  role,
  onAction,
  children,
}: SlotQuickAddPopoverProps) {
  // Authority gate: employees see read-only timeline, no popover content.
  const canWrite = role !== null && role !== "employee";

  function handleAction(action: Action) {
    // Telemetry — fire and forget; non-blocking.
    // Guard: only emit when both IDs are present (ADR-0134 requires non-null actor_id).
    if (actorId && workspaceId) {
      void emit({
        event: "ui.dagslinjen.slot_quickadd.action_picked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          data: { action, time },
        },
      });
    }
    onAction(action, time);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        sideOffset={6}
        // Prevent the popover from closing when clicking inside
        onInteractOutside={() => onOpenChange(false)}
        data-testid="slot-quickadd-popover"
      >
        <AnimatePresence>
          {open && canWrite && (
            <motion.div
              key="slot-quickadd-content"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{
                type: "spring",
                stiffness: motionTokens.springSnappy.stiffness,
                damping: motionTokens.springSnappy.damping,
                mass: motionTokens.springSnappy.mass,
              }}
              className="overflow-hidden rounded-[inherit]"
            >
              {/* Heading */}
              <div className="border-border border-b px-3 py-2.5">
                <p className="font-heading text-foreground text-sm leading-tight">
                  Legg til kl {time}
                </p>
              </div>

              {/* Action list */}
              <div className="py-1">
                {ACTION_BUTTONS.map(({ action, label, Icon, description }) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleAction(action)}
                    className={cn(
                      "hover:bg-muted focus-visible:bg-muted w-full px-3 py-2",
                      "flex items-center gap-2.5 text-left",
                      "text-foreground text-sm",
                      "focus-visible:outline-none",
                      "transition-colors",
                    )}
                    aria-label={`${label} kl ${time}`}
                    data-testid={`slot-quickadd-action-${action}`}
                  >
                    <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex flex-col">
                      <span className="leading-tight font-medium">{label}</span>
                      <span className="text-muted-foreground text-[11px] leading-tight">
                        {description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guard: employee sees nothing — popover stays closed at trigger level */}
        {open && !canWrite && (
          <div className="text-muted-foreground p-3 text-[12px]">
            Ingen tilgang — kun ledere kan legge til.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
