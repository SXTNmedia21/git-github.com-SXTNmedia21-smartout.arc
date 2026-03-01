// ============================================
// day-context-menu.tsx
// DropdownMenu for day column headers in the schedule grid.
// Provides all day-level operations: publish, copy/paste,
// templates, messages, and batch selection.
// Connected to: schedule-context.tsx (state + dispatch)
// Connected to: save-template-dialog.tsx, load-template-sheet.tsx,
//               day-message-dialog.tsx, broadcast-dialog.tsx
// ============================================
"use client";

import { useState } from "react";
import {
  BookmarkPlus,
  BookOpen,
  ClipboardPaste,
  Copy,
  FileText,
  List,
  Megaphone,
  MoreVertical,
  Plus,
  Send,
  Square,
  SquareCheck,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSchedule } from "./schedule-context";
import { SaveTemplateDialog } from "./save-template-dialog";
import { LoadTemplateSheet } from "./load-template-sheet";
import { DayMessageDialog } from "./day-message-dialog";
import { BroadcastDialog } from "./broadcast-dialog";

// ── Props ───────────────────────────────────────────────────

type DayContextMenuProps = {
  dateId: string;
  dateLabel: string;
  isDark: boolean;
};

/**
 * Context menu for day column headers in the schedule grid.
 * Replaces the bare MoreVertical button with a full dropdown
 * covering all day-level operations from MODULE_03 §5.
 *
 * @param dateId - The day identifier (e.g. "d1")
 * @param dateLabel - Human-readable label (e.g. "Man 22/12")
 * @param isDark - Whether the header uses dark styling
 * @returns DropdownMenu with all day operations
 */
export function DayContextMenu({ dateId, dateLabel, isDark }: DayContextMenuProps) {
  const { state, dispatch, computed } = useSchedule();

  // Local dialog/sheet state
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [dayMessageOpen, setDayMessageOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Derived conditions for enabling/disabling menu items
  const dayShifts = computed.getShiftsForDay(dateId);
  const hasShifts = dayShifts.length > 0;
  const hasUnpublished = dayShifts.some(
    (s) => s.status === "created" || s.status === "assigned",
  );
  const hasPublished = dayShifts.some((s) => s.status === "published");
  const hasClipboard = state.clipboard !== null;
  const isSelected = state.selectedDays.has(dateId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${isDark ? "text-white/60 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
            <span className="sr-only">Dagmeny for {dateLabel}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {/* Selection toggle */}
          <DropdownMenuItem
            onClick={() => dispatch({ type: "SELECT_DAY", payload: { dateId } })}
          >
            {isSelected ? (
              <SquareCheck className="mr-2 h-4 w-4" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Velg dag
          </DropdownMenuItem>

          {/* Create shift */}
          <DropdownMenuItem
            onClick={() =>
              dispatch({
                type: "SET_CREATE_SHIFT_CONTEXT",
                payload: { dateId },
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Opprett vakt
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Publish / Unpublish */}
          <DropdownMenuItem
            disabled={!hasUnpublished}
            onClick={() => dispatch({ type: "PUBLISH_DAY", payload: { dateId } })}
          >
            <Send className="mr-2 h-4 w-4" />
            Publiser dag
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!hasPublished}
            onClick={() => dispatch({ type: "UNPUBLISH_DAY", payload: { dateId } })}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Avpubliser dag
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Copy / Paste */}
          <DropdownMenuItem
            disabled={!hasShifts}
            onClick={() =>
              dispatch({ type: "COPY_DAY", payload: { dateId, dateLabel } })
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Kopier dag
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!hasClipboard}
            onClick={() =>
              dispatch({ type: "PASTE_DAY", payload: { targetDateId: dateId } })
            }
          >
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Lim inn dag
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Templates */}
          <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)}>
            <BookmarkPlus className="mr-2 h-4 w-4" />
            Lagre som mal
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setLoadTemplateOpen(true)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Last inn mal
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Day info & broadcast */}
          <DropdownMenuItem onClick={() => setDayMessageOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Opprett daginfo
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setBroadcastOpen(true)}>
            <Megaphone className="mr-2 h-4 w-4" />
            Send melding
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Day inspector */}
          <DropdownMenuItem
            onClick={() => dispatch({ type: "SET_SELECTED_DAY", payload: dateId })}
          >
            <List className="mr-2 h-4 w-4" />
            Se dagsliste
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs and sheets controlled by local state */}
      <SaveTemplateDialog
        dateId={dateId}
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
      />

      <LoadTemplateSheet
        dateId={dateId}
        open={loadTemplateOpen}
        onOpenChange={setLoadTemplateOpen}
      />

      <DayMessageDialog
        dateId={dateId}
        open={dayMessageOpen}
        onOpenChange={setDayMessageOpen}
      />

      <BroadcastDialog
        dateId={dateId}
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
      />
    </>
  );
}
