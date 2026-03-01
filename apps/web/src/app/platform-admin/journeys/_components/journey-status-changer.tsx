// ============================================
// journey-status-changer.tsx — Inline Status Transition Widget
// Renders a clickable status badge that opens a popover with
// valid next statuses. On selection, shows a confirmation dialog
// and calls the server-side transition API.
// Connected to: apps/web/src/lib/journey/status-transitions.ts (getValidTransitions)
// Connected to: apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts
// Connected to: packages/types/src/journey.ts (JourneyStatus type)
// ============================================

"use client";

import { useState } from "react";
import type { JourneyStatus } from "@smartout/types";
import { getValidTransitions } from "@/lib/journey/status-transitions";
import { STATUS_META } from "@/lib/journey/status-transitions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  Lightbulb,
  Wand2,
  ClipboardList,
  FileText,
  Hammer,
  Eye,
  TestTube2,
  FlaskConical,
  CheckCircle2,
  Rocket,
  CircleDot,
  CircleMinus,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";

/**
 * Map from lucide icon name strings to actual React components.
 * Duplicated from journey-list-client because this component is
 * imported independently and needs its own icon references.
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Wand2,
  ClipboardList,
  FileText,
  Hammer,
  Eye,
  TestTube2,
  FlaskConical,
  CheckCircle2,
  Rocket,
  CircleDot,
  CircleMinus,
  AlertTriangle,
};

type JourneyStatusChangerProps = {
  journeyId: string;
  currentStatus: JourneyStatus;
  onStatusChanged: (journeyId: string, newStatus: JourneyStatus) => void;
};

/**
 * Inline status badge that allows changing a journey's status
 * through the valid state machine transitions.
 *
 * Why popover instead of dropdown: Popover gives us full layout
 * control for showing transition arrows and colored badges.
 *
 * @param journeyId - The journey to update
 * @param currentStatus - Current status (determines valid transitions)
 * @param onStatusChanged - Callback when status is successfully changed
 */
export function JourneyStatusChanger({
  journeyId,
  currentStatus,
  onStatusChanged,
}: JourneyStatusChangerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<JourneyStatus | null>(null);

  const validTransitions = getValidTransitions(currentStatus);
  const currentMeta = STATUS_META[currentStatus];
  const CurrentIcon = ICON_MAP[currentMeta.icon];

  /**
   * Performs the status transition via the server-side API:
   * 1. Calls the transition endpoint which validates + updates + logs
   * 2. Notifies the parent via callback on success
   */
  async function handleTransition(newStatus: JourneyStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform-admin/journeys/${journeyId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 422) {
          toast.error("Invalid transition", { description: data.error });
        } else {
          toast.error("Failed to update status", { description: data.error });
        }
        return;
      }
      const targetMeta = STATUS_META[newStatus];
      toast.success(`Status changed to ${targetMeta.label}`);
      onStatusChanged(journeyId, newStatus);
      setOpen(false);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="hover:bg-muted/50 inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors"
            style={{
              borderColor: currentMeta.color,
              color: currentMeta.color,
            }}
            onClick={(e) => {
              // Prevent table row click from firing
              e.stopPropagation();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              CurrentIcon && <CurrentIcon className="h-3 w-3" />
            )}
            {currentMeta.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
          {validTransitions.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-xs">No transitions available</p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground px-2 py-1 text-xs font-medium">Move to...</p>
              {validTransitions.map((target) => {
                const targetMeta = STATUS_META[target];
                const TargetIcon = ICON_MAP[targetMeta.icon];
                return (
                  <button
                    key={target}
                    onClick={() => {
                      setPendingTransition(target);
                      setOpen(false);
                    }}
                    disabled={loading}
                    className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="text-muted-foreground h-3 w-3" />
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs"
                      style={{
                        borderColor: targetMeta.color,
                        color: targetMeta.color,
                      }}
                    >
                      {TargetIcon && <TargetIcon className="h-3 w-3" />}
                      {targetMeta.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
      <AlertDialog
        open={pendingTransition !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingTransition(null);
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Change journey status?</AlertDialogTitle>
            <AlertDialogDescription>
              Move from <span className="font-semibold">{currentMeta.label}</span> to{" "}
              <span className="font-semibold">
                {pendingTransition ? STATUS_META[pendingTransition].label : ""}
              </span>
              . This will be logged in the event trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTransition) handleTransition(pendingTransition);
                setPendingTransition(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
