"use client";

/**
 * DayLineStrip
 *
 * Composes one complete day_line card:
 *   DayLineStripHeader   — identity, status pill, edit-hours button
 *   OpenCloseEditPopover — self-contained hours-edit popover (manages own open state)
 *   SlotPicker           — 3-lane slot-add popover anchored at click point
 *
 * Status is derived via deriveDayLineStatus — never read from a stored field.
 * The strip delegates all slot-add action dispatch to the parent via onSlotAction
 * so TimelineTab can open the correct dialog.
 *
 * testID: day-line-strip-{day_line_id}
 *
 * References: ADR-0367 C-T1.
 */

import { useState } from "react";
import { deriveDayLineStatus } from "@/lib/cascade/derive-day-line-status";
import { DayLineStripHeader } from "./DayLineStripHeader";
import { OpenCloseEditPopover } from "./OpenCloseEditPopover";
import { SlotPicker, type SlotPickerAction } from "./SlotPicker";
import type { DayLineRow } from "./_hooks/use-day-lines.types";
import type { WorkspaceRole } from "@/lib/context/bootstrap-contract";

export type DayLineStripProps = {
  line: DayLineRow;
  /** Session lifecycle state — used for status derivation. */
  sessionStatus: "draft" | "open" | "closed";
  /** True when daily_reconciliation.locked_at is non-null for this date. */
  reconciliationLocked: boolean;
  /** Whether the current user can edit (manager / admin / owner). */
  canEdit: boolean;
  /** Current user workspace role — forwarded to SlotPicker for write-gate. */
  role: WorkspaceRole | null;
  /** Called when user picks a slot-add action. */
  onSlotAction: (action: SlotPickerAction, time: string, dayLineId: string) => void;
};

export function DayLineStrip({
  line,
  sessionStatus,
  reconciliationLocked,
  canEdit,
  role,
  onSlotAction,
}: DayLineStripProps) {
  const [slotPickerOpen, setSlotPickerOpen] = useState(false);
  const [slotPickerTime, setSlotPickerTime] = useState("--:--");
  const [slotAnchorRect, setSlotAnchorRect] = useState<DOMRect | null>(null);

  const status = deriveDayLineStatus({
    line: { cancelled_at: line.cancelled_at, business_date: line.business_date },
    sessionStatus,
    reconciliationLocked,
  });

  function handleSlotPickerOpenChange(open: boolean) {
    setSlotPickerOpen(open);
    if (!open) setSlotAnchorRect(null);
  }

  function handleSlotAction(action: SlotPickerAction, time: string) {
    onSlotAction(action, time, line.day_line_id);
    setSlotPickerOpen(false);
    setSlotAnchorRect(null);
  }

  const editAllowed = canEdit && status !== "locked" && status !== "cancelled";

  return (
    <div
      className="border-border bg-background rounded-[--radius] border"
      data-testid={`day-line-strip-${line.day_line_id}`}
    >
      <DayLineStripHeader
        line={line}
        status={status}
        onEditHours={() => {
          /* no-op — OpenCloseEditPopover manages its own open state below */
        }}
        readOnly={!canEdit}
      />

      {/* Hours-edit popover — self-contained; its own PopoverTrigger is the entry point. */}
      {editAllowed && (
        <div className="px-3 pb-2">
          <OpenCloseEditPopover line={line} />
        </div>
      )}

      {/* SlotPicker — anchored at the clicked coordinate within the strip */}
      <SlotPicker
        open={slotPickerOpen}
        onOpenChange={handleSlotPickerOpenChange}
        time={slotPickerTime}
        role={role}
        onAction={handleSlotAction}
        dayLineId={line.day_line_id}
        plannedOpen={line.planned_open}
        plannedClose={line.planned_close}
        anchor={
          slotAnchorRect ? (
            <span
              aria-hidden
              style={{
                position: "fixed",
                left: slotAnchorRect.left + slotAnchorRect.width / 2,
                top: slotAnchorRect.top,
                width: 1,
                height: slotAnchorRect.height,
                pointerEvents: "none",
              }}
            />
          ) : null
        }
      />

      {/* Future: CT3 task chips + DayTimelineStrip will mount here */}
    </div>
  );
}
