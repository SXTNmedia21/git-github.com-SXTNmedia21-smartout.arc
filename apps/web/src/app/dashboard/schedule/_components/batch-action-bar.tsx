// ============================================
// batch-action-bar.tsx
// Floating action bar shown when one or more days are selected.
// Provides batch publish, unpublish, and clear selection actions.
// Connected to: schedule-context.tsx (selectedDays state)
// ============================================
"use client";

import { Send, Undo2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useSchedule } from "./schedule-context";

/**
 * Floating bar at the bottom of the viewport for batch day operations.
 * Appears when state.selectedDays.size > 0, with a slide-up animation.
 * Offers publish-all, unpublish-all, and clear-selection actions.
 *
 * @returns Animated fixed-position action bar, or null when no days selected
 */
export function BatchActionBar() {
  const { state, dispatch } = useSchedule();
  const count = state.selectedDays.size;

  if (count === 0) return null;

  /**
   * Unpublishes each selected day individually.
   * The reducer handles filtering published shifts per day.
   */
  function handleUnpublishAll() {
    for (const dateId of state.selectedDays) {
      dispatch({ type: "UNPUBLISH_DAY", payload: { dateId } });
    }
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 duration-200">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/95 px-6 py-3 shadow-2xl backdrop-blur-xl">
        <span className="text-foreground text-sm font-medium">
          {count} {count === 1 ? "dag" : "dager"} valgt:
        </span>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "PUBLISH_SELECTED_DAYS" })}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Publiser alle
        </Button>

        <Button size="sm" variant="secondary" onClick={handleUnpublishAll}>
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          Avpubliser alle
        </Button>

        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "CLEAR_SELECTED_DAYS" })}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Fjern valg
        </Button>
      </div>
    </div>
  );
}
