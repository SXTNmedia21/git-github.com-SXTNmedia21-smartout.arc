// apps/web/src/components/shift-timeline/ShiftSheet.tsx
"use client";

/**
 * ShiftSheet — the right-side panel that opens when an admin selects
 * a shift from the cockpit grid (or any other entry point that wants
 * to surface one shift in detail).
 *
 * Keeps a tight contract:
 *   - Controlled via `shiftId | null` (null = closed).
 *   - Renders the AdminShiftTimeline inside.
 *   - Header shows employee/date/department — passed in by the caller
 *     so the sheet stays decoupled from grid data shape.
 *   - Footer shows common admin actions (Approve / Request / Botsson).
 *
 * The sheet intentionally does not wire Botsson itself — it forwards
 * the callback up. Callers decide if Botsson renders alongside or in
 * a separate modal.
 */

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { AdminShiftTimeline } from "./AdminShiftTimeline";
import type { ShiftPhase } from "@smartout/ui";

export type ShiftSheetProps = {
  shiftId: string | null;
  onClose: () => void;
  header?: {
    employeeName?: string;
    dateLabel?: string;
    departmentName?: string;
  };
  onApprove?: (shiftId: string) => void;
  onRequestInterpretation?: (shiftId: string) => void;
  onOpenBotsson?: (ctx: { shiftId: string; phase: ShiftPhase }) => void;
};

export function ShiftSheet({
  shiftId,
  onClose,
  header,
  onApprove,
  onRequestInterpretation,
  onOpenBotsson,
}: ShiftSheetProps) {
  const { t } = useTranslation("shift");
  const open = shiftId !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" className="w-[480px] sm:max-w-none lg:w-[560px]">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl">
            {header?.employeeName ?? ""} {header?.dateLabel ? `· ${header.dateLabel}` : ""}
          </SheetTitle>
          {header?.departmentName && <SheetDescription>{header.departmentName}</SheetDescription>}
        </SheetHeader>

        <div className="mt-6">
          {shiftId && (
            <AdminShiftTimeline
              shiftId={shiftId}
              onOpenBotsson={(ctx) => onOpenBotsson?.({ shiftId: ctx.shiftId, phase: ctx.phase })}
            />
          )}
        </div>

        <SheetFooter className="mt-8 flex-col gap-2 sm:flex-row sm:justify-end">
          {shiftId && onApprove && (
            <Button variant="default" onClick={() => onApprove(shiftId)}>
              {t("timeline.action.approve")}
            </Button>
          )}
          {shiftId && onRequestInterpretation && (
            <Button variant="outline" onClick={() => onRequestInterpretation(shiftId)}>
              {t("timeline.action.request_interpretation")}
            </Button>
          )}
          {shiftId && onOpenBotsson && (
            <Button variant="ghost" onClick={() => onOpenBotsson({ shiftId, phase: "oppgjor" })}>
              {t("timeline.action.open_in_botsson")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
