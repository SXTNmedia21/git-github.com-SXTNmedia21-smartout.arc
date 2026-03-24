"use client";

/**
 * ShiftClockActions — 2x2 grid of action buttons for the active shift view.
 *
 * Contains: BreakToggle, NoteInput trigger, SupplementSheet trigger, CallLeaderButton.
 * All icons are Lucide React. Layout adapts to the current shift state
 * (e.g., BreakToggle changes appearance when on break).
 */

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreakToggle } from "./BreakToggle";
import { SupplementSheet } from "./SupplementSheet";
import { CallLeaderButton } from "./CallLeaderButton";
import type { BreakEntry, GPSSnapshot, SupplementOption } from "@smartout/shift-clock";

type ShiftClockActionsProps = {
  isOnBreak: boolean;
  currentBreak: BreakEntry | null;
  onStartBreak: (gps?: GPSSnapshot | null) => Promise<void>;
  onEndBreak: (gps?: GPSSnapshot | null) => Promise<void>;
  onOpenNotes: () => void;
  onSwitchToChat: () => void;
  availableSupplements: SupplementOption[];
  claimedSupplementRuleIds: Set<string>;
  onClaimSupplement: (supplementRuleId: string, comment?: string) => Promise<unknown>;
  claimedCount: number;
  isLoading?: boolean;
};

export function ShiftClockActions({
  isOnBreak,
  currentBreak,
  onStartBreak,
  onEndBreak,
  onOpenNotes,
  onSwitchToChat,
  availableSupplements,
  claimedSupplementRuleIds,
  onClaimSupplement,
  claimedCount,
  isLoading,
}: ShiftClockActionsProps) {
  return (
    <div className="grid grid-cols-4 gap-3 px-4">
      <BreakToggle
        isOnBreak={isOnBreak}
        currentBreak={currentBreak}
        onStartBreak={onStartBreak}
        onEndBreak={onEndBreak}
        isLoading={isLoading}
      />

      <Button
        variant="outline"
        className="border-border/50 bg-card/50 hover:bg-card/80 flex h-auto flex-col items-center gap-2 rounded-2xl px-4 py-4 backdrop-blur-sm transition-colors"
        onClick={onOpenNotes}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <FileText className="h-5 w-5 text-violet-400" />
        </div>
        <span className="text-muted-foreground text-xs">Notat</span>
      </Button>

      <SupplementSheet
        availableSupplements={availableSupplements}
        claimedSupplementRuleIds={claimedSupplementRuleIds}
        onClaim={onClaimSupplement}
        claimedCount={claimedCount}
        isLoading={isLoading}
      />

      <CallLeaderButton onSwitchToChat={onSwitchToChat} />
    </div>
  );
}
