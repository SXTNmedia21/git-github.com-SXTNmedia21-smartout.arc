"use client";

/**
 * ShiftClockView — Fullscreen employee shift view.
 *
 * Renders different layouts based on the current phase from useShiftClock():
 * - idle: PunchButton with shift info and countdown
 * - clocked_in: Header + Actions + Tabs + PunchOut button at bottom
 * - on_break: Same as clocked_in but with orange break indicator
 * - summary: ShiftClockSummary with stats and "Ferdig" button
 *
 * This is the primary employee-facing component. It fills the entire viewport
 * and takes over the standard dashboard layout.
 */

import { useCallback, useContext, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useShiftClock } from "@/hooks/shift-clock/useShiftClock";
import { useShiftChat } from "@/hooks/shift-clock/useShiftChat";
import { useShiftNotes } from "@/hooks/shift-clock/useShiftNotes";
import { useSupplements } from "@/hooks/shift-clock/useSupplements";
import { PunchButton } from "./PunchButton";
import { ShiftClockHeader } from "./ShiftClockHeader";
import { ShiftClockActions } from "./ShiftClockActions";
import { ShiftClockTabs } from "./ShiftClockTabs";
import { ShiftClockSummary } from "./ShiftClockSummary";

export function ShiftClockView() {
  const { profileId } = useContext(DashboardContext);
  const { state, punchIn, punchOut, startBreak, endBreak, isLoading } = useShiftClock();

  // Active tab for the shift tabs section
  const [activeTab, setActiveTab] = useState("tasks");

  // Chat hook — requires shift and session ids
  const chat = useShiftChat({
    departmentSessionId: null, // TODO: resolve from active department session
    scheduleShiftId: state.shiftId,
  });

  // Notes hook
  const notes = useShiftNotes(state.shiftId);

  // Supplements hook
  const supplements = useSupplements(state.shiftId);

  // Set of already-claimed supplement rule IDs for visual feedback
  const claimedRuleIds = useMemo(
    () =>
      new Set(
        supplements.claimedSupplements.map((s) => s.supplement_rule_id).filter(Boolean) as string[],
      ),
    [supplements.claimedSupplements],
  );

  // Punch-in handler for PunchButton
  const handlePunchIn = useCallback(async () => {
    // TODO: resolve actual shiftId from next scheduled shift
    const shiftId = state.shiftId ?? "placeholder";
    const result = await punchIn(shiftId);
    return { allowed: result.allowed, warnings: result.warnings };
  }, [punchIn, state.shiftId]);

  // No-op complete handler — PunchButton animation calls this when done
  const handlePunchComplete = useCallback(() => {
    // State already updated via query invalidation in the hook
  }, []);

  // Switch to chat tab when calling leader
  const handleSwitchToChat = useCallback(() => {
    setActiveTab("chat");
  }, []);

  // Switch to notes tab
  const handleOpenNotes = useCallback(() => {
    setActiveTab("notes");
  }, []);

  // Punch out with optional comment
  const handlePunchOut = useCallback(async () => {
    await punchOut();
  }, [punchOut]);

  // Dismiss summary and return to idle
  const handleDismissSummary = useCallback(() => {
    // The query will refetch and find no active entry, returning to idle
    // No explicit action needed — the hook handles this via refetch
  }, []);

  // ── IDLE phase: full-screen PunchButton ──────────────────
  if (state.phase === "idle") {
    return (
      <div className="h-full w-full">
        <PunchButton
          shiftInfo={{
            time: "16:00 - 23:00", // TODO: resolve from next scheduled shift
            department: "Restaurant",
            zone: "Sal",
          }}
          onPunchIn={handlePunchIn}
          onComplete={handlePunchComplete}
          disabled={isLoading}
        />
      </div>
    );
  }

  // ── SUMMARY phase: post-punch-out view ───────────────────
  if (state.phase === "summary") {
    return (
      <div className="bg-background h-full w-full">
        <ShiftClockSummary
          punchInTime={state.punchInTime!}
          punchOutTime={state.punchOutTime!}
          breaks={state.breaks}
          claimedSupplements={supplements.claimedSupplements.map((s) => ({
            id: s.id,
            description: s.description,
            amount: s.amount,
            status: s.status,
          }))}
          onDismiss={handleDismissSummary}
        />
      </div>
    );
  }

  // ── CLOCKED_IN or ON_BREAK phase: active shift view ──────
  const isOnBreak = state.phase === "on_break";

  return (
    <div className="bg-background flex h-full w-full flex-col">
      {/* Header with live timer */}
      <ShiftClockHeader
        punchInTime={state.punchInTime!}
        isOnBreak={isOnBreak}
        department="Restaurant"
        zone="Sal"
      />

      {/* Action buttons */}
      <ShiftClockActions
        isOnBreak={isOnBreak}
        currentBreak={state.currentBreak}
        onStartBreak={startBreak}
        onEndBreak={endBreak}
        onOpenNotes={handleOpenNotes}
        onSwitchToChat={handleSwitchToChat}
        availableSupplements={supplements.availableSupplements}
        claimedSupplementRuleIds={claimedRuleIds}
        onClaimSupplement={supplements.claimSupplement}
        claimedCount={supplements.claimedSupplements.length}
        isLoading={isLoading || supplements.isLoading}
      />

      {/* Tab section — fills remaining space */}
      <div className="mt-4 flex flex-1 flex-col overflow-hidden">
        <ShiftClockTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sessionMessages={chat.sessionMessages}
          shiftMessages={chat.shiftMessages}
          onSendSessionMessage={chat.sendSessionMessage}
          onSendShiftMessage={chat.sendShiftMessage}
          notes={notes.notes}
          onAddNote={notes.addNote}
          currentProfileId={profileId}
          isChatLoading={chat.isLoading}
          isNotesLoading={notes.isLoading}
        />
      </div>

      {/* Punch out button — fixed at bottom */}
      <div className="border-border/30 border-t p-4">
        <Button
          variant="outline"
          size="lg"
          className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full"
          onClick={() => void handlePunchOut()}
          disabled={isLoading || isOnBreak}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Stemple ut
        </Button>
      </div>
    </div>
  );
}
