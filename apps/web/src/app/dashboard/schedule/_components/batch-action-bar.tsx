// ============================================
// batch-action-bar.tsx
// Floating action bar shown when one or more days are selected.
// Provides batch publish, unpublish, and clear selection actions.
// Connected to: schedule-context.tsx (selectedDays state)
// ============================================
"use client";

import { Send, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Shift } from "./schedule-types";
import { useScheduleUI } from "./schedule-ui-context";
import { useShifts, usePublishShifts, useUnpublishShifts } from "../_hooks/use-shifts";
import { useWeekRange } from "../_hooks/use-week-range";

/**
 * Floating bar at the bottom of the viewport for batch day operations.
 * Appears when selectedDays.size > 0, with a slide-up animation.
 * Offers publish-all, unpublish-all, and clear-selection actions.
 *
 * @returns Animated fixed-position action bar, or null when no days selected
 */
export function BatchActionBar() {
  const { selectedDays, clearSelectedDays } = useScheduleUI();
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const publishShifts = usePublishShifts(weekStart);
  const unpublishShifts = useUnpublishShifts(weekStart);
  const count = selectedDays.size;

  if (count === 0) return null;

  /**
   * Publishes all draft shifts across selected days.
   */
  function handlePublishAll() {
    const draftIds = shifts
      .filter(
        (s: Shift) =>
          selectedDays.has(s.dateId) && (s.status === "created" || s.status === "assigned"),
      )
      .map((s: Shift) => s.id);
    if (draftIds.length > 0) {
      publishShifts.mutate(draftIds);
    }
    clearSelectedDays();
  }

  /**
   * Unpublishes all published shifts across selected days.
   */
  function handleUnpublishAll() {
    const publishedIds = shifts
      .filter((s: Shift) => selectedDays.has(s.dateId) && s.status === "published")
      .map((s: Shift) => s.id);
    if (publishedIds.length > 0) {
      unpublishShifts.mutate(publishedIds);
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 duration-200">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/95 px-6 py-3 shadow-2xl backdrop-blur-xl">
        <span className="text-foreground text-sm font-medium">
          {count} {count === 1 ? "dag" : "dager"} valgt:
        </span>

        <Button size="sm" variant="secondary" onClick={handlePublishAll}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Publiser alle
        </Button>

        <Button size="sm" variant="secondary" onClick={handleUnpublishAll}>
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          Avpubliser alle
        </Button>

        <Button size="sm" variant="ghost" onClick={clearSelectedDays}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Fjern valg
        </Button>
      </div>
    </div>
  );
}
