"use client";

/**
 * ShiftClockView — Fullscreen employee shift view.
 *
 * Renders different layouts based on the current phase from useShiftClock():
 * - idle (variant A): PunchButton with shift info and countdown (scheduled shift)
 * - idle (variant B): Open shifts + ad-hoc start option (no scheduled shift, adhoc enabled)
 * - clocked_in: Header + Actions + Tabs + PunchOut button at bottom
 * - on_break: Same as clocked_in but with orange break indicator
 * - summary: ShiftClockSummary with stats and "Ferdig" button
 *
 * This is the primary employee-facing component. It fills the entire viewport
 * and takes over the standard dashboard layout.
 */

import { useCallback, useContext, useMemo, useState } from "react";
import { LogOut, Calendar, Plus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useShiftClock } from "@/hooks/shift-clock/useShiftClock";
import { useShiftClockConfig } from "@/hooks/shift-clock/useShiftClockConfig";
import { useShiftChat } from "@/hooks/shift-clock/useShiftChat";
import { useShiftNotes } from "@/hooks/shift-clock/useShiftNotes";
import { useSupplements } from "@/hooks/shift-clock/useSupplements";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { PunchButton } from "./PunchButton";
import { ShiftClockHeader } from "./ShiftClockHeader";
import { ShiftClockActions } from "./ShiftClockActions";
import { ShiftClockTabs } from "./ShiftClockTabs";
import { ShiftClockSummary } from "./ShiftClockSummary";

// Shape of an open (unassigned) shift for today
type OpenShift = {
  schedule_shift_id: string;
  start_time: string;
  end_time: string;
  department_id: string | null;
  role: string;
  zone: string | null;
};

type ShiftClockViewProps = {
  /**
   * Controlled active tab — provided by page.tsx when the Botsson bridge
   * needs to switch tabs via uiActions. When omitted, the view manages its
   * own tab state (default: "tasks").
   */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
};

export function ShiftClockView({
  activeTab: externalActiveTab,
  onTabChange,
}: ShiftClockViewProps = {}) {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const {
    state,
    punchIn,
    punchOut,
    startBreak,
    endBreak,
    createAdhocShift,
    takeOpenShift,
    isLoading,
  } = useShiftClock();
  const { data: config } = useShiftClockConfig();

  // Active tab for the shift tabs section.
  // When page provides externalActiveTab + onTabChange, operate in controlled mode
  // so the Botsson bridge can switch tabs without a second internal state.
  const [internalActiveTab, setInternalActiveTab] = useState("tasks");
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  // Query open (unassigned, published) shifts for today — only fetched when
  // we're in idle phase and ad-hoc shifts are enabled for this workspace
  const isIdleWithAdhoc = state.phase === "idle" && config?.adhocShiftsEnabled === true;
  const openShiftsQuery = useQuery<OpenShift[]>({
    queryKey: ["shift-clock-open-shifts", workspace.workspace_id],
    enabled: isIdleWithAdhoc,
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, start_time, end_time, department_id, role, zone")
        .eq("workspace_id", workspace.workspace_id)
        .eq("shift_date", today)
        .eq("status", "published")
        .is("employee_id", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // ── Resolve next scheduled shift for this employee today ──
  const punchWindow = config?.punchWindowMinutes ?? 30;
  const nextShiftQuery = useQuery({
    queryKey: ["shift-clock-next-shift", profileId, workspace.workspace_id],
    enabled: state.phase === "idle" && !!profileId,
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, start_time, end_time, role, zone, department_id, department:department_id(name)",
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("employee_id", profileId!)
        .eq("shift_date", today)
        .eq("status", "published")
        .order("start_time", { ascending: true })
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Find first shift that hasn't ended yet (accounting for punch window)
      const now = new Date();
      const windowMs = punchWindow * 60_000;
      for (const shift of data) {
        const endDate = new Date(today + "T" + shift.end_time);
        // Handle overnight shifts (end_time < start_time means next day)
        if (shift.end_time < shift.start_time) endDate.setDate(endDate.getDate() + 1);
        if (endDate.getTime() > now.getTime()) return shift;
      }
      return null;
    },
    staleTime: 120_000,
    refetchInterval: 180_000,
    refetchIntervalInBackground: false,
  });

  const nextShift = nextShiftQuery.data;
  const nextShiftDeptName =
    nextShift?.department &&
    typeof nextShift.department === "object" &&
    "name" in nextShift.department
      ? (nextShift.department as { name: string }).name
      : "";

  // ── Resolve department session for chat ──
  const sessionQuery = useQuery({
    queryKey: ["shift-clock-session", state.shiftId],
    enabled: !!state.shiftId && state.phase !== "idle",
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      // Get department from the active shift
      const { data: shift } = await supabase
        .from("schedule_shift")
        .select("department_id")
        .eq("schedule_shift_id", state.shiftId!)
        .single();
      if (!shift?.department_id) return null;

      const { data: session } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("department_id", shift.department_id)
        .eq("session_date", today)
        .in("status", ["upcoming", "active"])
        .limit(1)
        .single();
      return session?.department_session_id ?? null;
    },
    staleTime: 5 * 60_000,
  });

  // Chat hook — uses resolved session ID
  const chat = useShiftChat({
    departmentSessionId: sessionQuery.data ?? null,
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

  // Punch-in handler — uses resolved next shift
  const handlePunchIn = useCallback(async () => {
    const shiftId = state.shiftId ?? nextShift?.schedule_shift_id;
    if (!shiftId) return { allowed: false, warnings: ["Ingen planlagt vakt funnet"] };
    const result = await punchIn(shiftId);
    return { allowed: result.allowed, warnings: result.warnings };
  }, [punchIn, state.shiftId, nextShift?.schedule_shift_id]);

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

  // Start a brand-new ad-hoc shift with no pre-existing schedule_shift
  const handleCreateAdhocShift = useCallback(async () => {
    await createAdhocShift(
      null, // no department context available at idle state; manager can assign later
      config?.adhocRequiresApproval ?? true,
    );
  }, [createAdhocShift, config?.adhocRequiresApproval]);

  // Claim and punch in on an existing unassigned open shift
  const handleTakeOpenShift = useCallback(
    async (shiftId: string) => {
      await takeOpenShift(shiftId);
    },
    [takeOpenShift],
  );

  // ── IDLE phase: full-screen PunchButton ──────────────────
  if (state.phase === "idle") {
    // Variant B — no scheduled shift, but workspace has ad-hoc shifts enabled.
    // Show open shifts to claim and a "Start ad-hoc shift" fallback.
    if (isIdleWithAdhoc) {
      const openShifts = openShiftsQuery.data ?? [];

      return (
        <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-10">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <Calendar className="text-muted-foreground h-10 w-10" />
            <h2 className="font-heading text-foreground text-xl font-semibold">
              Ingen planlagt vakt
            </h2>
            <p className="text-muted-foreground text-sm">Vil du starte en vakt?</p>
          </div>

          {/* Open shifts section — only shown when at least one exists */}
          {openShifts.length > 0 && (
            <div className="w-full max-w-md space-y-3">
              <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
                <Users className="h-3.5 w-3.5" />
                Åpne vakter i dag
              </p>
              <ul className="space-y-2">
                {openShifts.map((shift) => {
                  // start_time / end_time are bare PostgreSQL time strings ("HH:MM:SS").
                  // new Date("HH:MM:SS") produces Invalid Date — prepend today's date to
                  // get a valid local datetime before formatting.
                  const today = new Date().toISOString().slice(0, 10);
                  const fmt = (time: string) =>
                    new Date(`${today}T${time}`).toLocaleTimeString("no", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                  return (
                    <li
                      key={shift.schedule_shift_id}
                      className="border-border bg-card flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-0.5">
                        <p className="text-foreground text-sm font-medium">
                          {fmt(shift.start_time)} – {fmt(shift.end_time)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {shift.role}
                          {shift.zone ? ` · ${shift.zone}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handleTakeOpenShift(shift.schedule_shift_id)}
                        disabled={isLoading}
                      >
                        Ta vakt
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Separator */}
          {openShifts.length > 0 && (
            <div className="text-muted-foreground flex w-full max-w-md items-center gap-3 text-xs">
              <div className="border-border flex-1 border-t" />
              <span>eller</span>
              <div className="border-border flex-1 border-t" />
            </div>
          )}

          {/* Ad-hoc shift start */}
          <div className="w-full max-w-md space-y-2">
            <Button
              variant="outline"
              size="lg"
              className="border-border w-full border-dashed"
              onClick={() => void handleCreateAdhocShift()}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Start ny ad-hoc vakt
            </Button>
            {config?.adhocRequiresApproval && (
              <p className="text-muted-foreground text-center text-xs">
                Krever godkjenning fra leder
              </p>
            )}
          </div>
        </div>
      );
    }

    // Variant A — standard idle with upcoming scheduled shift
    if (!nextShift) {
      // No shift found for today — show a clear empty state
      return (
        <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-4 px-6">
          <Calendar className="text-muted-foreground h-10 w-10" />
          <h2 className="font-heading text-foreground text-xl font-semibold">Ingen vakt i dag</h2>
          <p className="text-muted-foreground text-sm">Du har ingen planlagte vakter for i dag.</p>
        </div>
      );
    }

    const startHHMM = nextShift.start_time.slice(0, 5);
    const endHHMM = nextShift.end_time.slice(0, 5);

    return (
      <div className="h-full w-full">
        <PunchButton
          shiftInfo={{
            time: `${startHHMM} - ${endHHMM}`,
            department: nextShiftDeptName || nextShift.role,
            zone: nextShift.zone ?? "",
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
        department={nextShiftDeptName || "—"}
        zone={nextShift?.zone ?? ""}
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
