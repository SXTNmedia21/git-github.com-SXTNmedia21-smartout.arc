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
  CalendarPlus,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Shift } from "./schedule-types";
import { useScheduleUI } from "./schedule-ui-context";
import { usePublishShifts, useUnpublishShifts, usePasteDay } from "../_hooks/use-shifts";
import { SaveTemplateDialog } from "./save-template-dialog";
import { LoadTemplateSheet } from "./load-template-sheet";
import { DayMessageDialog } from "./day-message-dialog";
import { DayInfoDialog } from "./day-info-dialog";
import { BroadcastDialog } from "./broadcast-dialog";

// ── Props ───────────────────────────────────────────────────

type DayContextMenuProps = {
  dateId: string;
  dateLabel: string;
  isDark: boolean;
  dayShifts: Shift[];
  weekStart: string;
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
export function DayContextMenu({
  dateId,
  dateLabel,
  isDark: _isDark,
  dayShifts,
  weekStart,
}: DayContextMenuProps) {
  const {
    clipboard,
    selectedDays,
    toggleDaySelection,
    setCreateShiftContext,
    setSelectedDay,
    setClipboard,
    copyDay,
  } = useScheduleUI();
  const publishShifts = usePublishShifts(weekStart);
  const unpublishShifts = useUnpublishShifts(weekStart);
  const pasteDay = usePasteDay(weekStart);

  // Local dialog/sheet state
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [dayMessageOpen, setDayMessageOpen] = useState(false);
  const [dayInfoOpen, setDayInfoOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Derived conditions for enabling/disabling menu items
  const hasShifts = dayShifts.length > 0;
  const hasUnpublished = dayShifts.some(
    (s: Shift) => s.status === "created" || s.status === "assigned",
  );
  const hasPublished = dayShifts.some((s: Shift) => s.status === "published");
  const hasClipboard = clipboard !== null;
  const isSelected = selectedDays.has(dateId);

  const staffCount = new Set(dayShifts.map((shift) => shift.employeeId).filter(Boolean)).size;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 w-6"
          >
            <MoreVertical className="h-3.5 w-3.5" />
            <span className="sr-only">Dagmeny for {dateLabel}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="z-50 w-52">
          {/* Selection & Create */}
          <DropdownMenuItem onClick={() => toggleDaySelection(dateId)}>
            {isSelected ? (
              <SquareCheck className="mr-2 h-4 w-4" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Velg dag
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setCreateShiftContext({ dateId })}>
            <Plus className="mr-2 h-4 w-4" />
            Opprett vakt
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Publish / Unpublish */}
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Publisering
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!hasUnpublished}
            onClick={() => {
              const draftIds = dayShifts
                .filter((s: Shift) => s.status === "created" || s.status === "assigned")
                .map((s: Shift) => s.id);
              if (draftIds.length > 0) publishShifts.mutate(draftIds);
            }}
          >
            <Send className="mr-2 h-4 w-4" />
            Publiser dag
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!hasPublished}
            onClick={() => {
              const publishedIds = dayShifts
                .filter((s: Shift) => s.status === "published")
                .map((s: Shift) => s.id);
              if (publishedIds.length > 0) unpublishShifts.mutate(publishedIds);
            }}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Avpubliser dag
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Copy / Paste */}
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Kopier / Lim inn
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!hasShifts}
            onClick={() => copyDay(dateId, dateLabel, dayShifts)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Kopier dag
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!hasClipboard || pasteDay.isPending}
            onClick={() => {
              if (clipboard) {
                pasteDay.mutate(
                  { targetDateId: dateId, shifts: clipboard.shifts },
                  { onSuccess: () => setClipboard(null) },
                );
              }
            }}
          >
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Lim inn dag
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Templates */}
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Maler
          </DropdownMenuLabel>
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
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Kommunikasjon
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setDayInfoOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Legg til daginfo
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setDayMessageOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Opprett melding
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setBroadcastOpen(true)}>
            <Megaphone className="mr-2 h-4 w-4" />
            Send melding
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Day inspector */}
          <DropdownMenuItem onClick={() => setSelectedDay(dateId)}>
            <List className="mr-2 h-4 w-4" />
            Se dagsliste
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs and sheets controlled by local state */}
      {saveTemplateOpen ? (
        <SaveTemplateDialog
          dayShifts={dayShifts}
          open={saveTemplateOpen}
          onOpenChange={setSaveTemplateOpen}
        />
      ) : null}

      {loadTemplateOpen ? (
        <LoadTemplateSheet
          dateId={dateId}
          existingShiftCount={dayShifts.length}
          open={loadTemplateOpen}
          onOpenChange={setLoadTemplateOpen}
        />
      ) : null}

      {dayMessageOpen ? (
        <DayMessageDialog dateId={dateId} open={dayMessageOpen} onOpenChange={setDayMessageOpen} />
      ) : null}

      {dayInfoOpen ? (
        <DayInfoDialog dateId={dateId} open={dayInfoOpen} onOpenChange={setDayInfoOpen} />
      ) : null}

      {broadcastOpen ? (
        <BroadcastDialog
          staffCount={staffCount}
          open={broadcastOpen}
          onOpenChange={setBroadcastOpen}
        />
      ) : null}
    </>
  );
}
