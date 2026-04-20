# Mobile Shift Module Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the mobile shift module by wiring 4 orphaned components, adding shift swap UI, connecting roster to real data, and implementing end-of-shift flows.

**Architecture:** Mobile uses React Native + Expo with offline-first `enqueue()` mutations, Zustand stores for phase state, and TanStack Query for server data. All shift CRUD goes through Supabase RLS-protected queries and SECURITY DEFINER RPCs. Shared validation logic lives in `packages/utils/src/swap/`.

**Tech Stack:** React Native, Expo Router, TanStack Query, Zustand, Supabase, react-native-reanimated, expo-haptics

---

## File Structure

### New Files
- `apps/mobile/app/(app)/(shifts)/swap.tsx` — swap request screen
- `apps/mobile/src/hooks/mutations/use-swap.ts` — swap mutation hooks (initiate, respond, cancel)
- `apps/mobile/src/hooks/queries/use-swap-requests.ts` — query pending swaps
- `apps/mobile/src/hooks/queries/use-eligible-swap-shifts.ts` — query colleague shifts for swap
- `apps/mobile/src/components/shift/SwapRequestSheet.tsx` — bottom sheet for selecting target shift
- `apps/mobile/src/components/shift/SwapStatusBadge.tsx` — badge showing swap state
- `apps/mobile/src/components/shift/SwapInboxCard.tsx` — incoming swap request card

### Modified Files
- `apps/mobile/app/(app)/(shifts)/_layout.tsx` — add swap route
- `apps/mobile/app/(app)/(shifts)/[id].tsx` — add "Bytt vakt" action button
- `apps/mobile/app/(app)/(shifts)/index.tsx` — add swap inbox section
- `apps/mobile/app/(app)/(shifts)/roster.tsx` — replace placeholder data with useTeamShifts
- `apps/mobile/src/components/home/AfterShiftView.tsx` — wire HandoffForm + HoursConfirmation
- `apps/mobile/src/components/shift/HandoffForm.tsx` — minor fixes if needed
- `apps/mobile/src/components/shift/HoursConfirmation.tsx` — minor fixes if needed
- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx` — transition to after-shift flow

### Deleted Files
- `apps/mobile/src/components/shift/PunchButton.tsx` — dead code, punch logic is in punch-clock
- `apps/mobile/src/components/shift/ShiftCardRich.tsx` — dead code, unused anywhere

---

## Task 1: Delete Dead Components

**Files:**
- Delete: `apps/mobile/src/components/shift/PunchButton.tsx`
- Delete: `apps/mobile/src/components/shift/ShiftCardRich.tsx`

- [ ] **Step 1: Verify no imports exist**

```bash
grep -r "PunchButton" apps/mobile/src/ apps/mobile/app/ --include="*.tsx" --include="*.ts" -l
grep -r "ShiftCardRich" apps/mobile/src/ apps/mobile/app/ --include="*.tsx" --include="*.ts" -l
```

Expected: No files (or only the files themselves). If other files import them, they need updating first.

- [ ] **Step 2: Delete the files**

```bash
rm apps/mobile/src/components/shift/PunchButton.tsx
rm apps/mobile/src/components/shift/ShiftCardRich.tsx
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add -u apps/mobile/src/components/shift/
git commit -m "chore(mobile): remove dead PunchButton and ShiftCardRich components"
```

---

## Task 2: Wire Roster to Real Data

**Files:**
- Modify: `apps/mobile/app/(app)/(shifts)/roster.tsx`
- Verify: `apps/mobile/src/hooks/queries/use-team-shifts.ts`

- [ ] **Step 1: Read the existing hook**

Read `apps/mobile/src/hooks/queries/use-team-shifts.ts` fully. Verify the `useTeamShifts()` hook returns `{ weeks: RosterWeek[], isLoading, error }`. Note the `RosterWeek` and `RosterDay` types.

- [ ] **Step 2: Replace placeholder data in roster.tsx**

Open `apps/mobile/app/(app)/(shifts)/roster.tsx`. Find the hardcoded `WEEKS` constant and all placeholder types. Replace with the real hook data.

Remove:
- The entire `WEEKS` constant (hardcoded data)
- Local type definitions that duplicate the hook types (`WeekBlock`, `DayCell`, `ShiftSlot`)

Add at top:
```tsx
import { useTeamShifts } from "@/hooks/queries/use-team-shifts";
```

In the component body, replace `const weeks = WEEKS` with:
```tsx
const { weeks, isLoading, error } = useTeamShifts();
```

Add loading state:
```tsx
if (isLoading) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar />
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.brandOrange} />
      </View>
    </SafeAreaView>
  );
}
```

Add empty state:
```tsx
if (!weeks || weeks.length === 0) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar />
      <View style={styles.center}>
        <Text style={styles.emptyText}>Ingen vakter å vise</Text>
      </View>
    </SafeAreaView>
  );
}
```

Map the `RosterWeek` type to the existing rendering. The hook returns `weeks` with `{ weekNumber, startDate, endDate, days: RosterDay[] }` where `RosterDay` has `{ date, shifts: RosterShift[] }`. Adapt the grid cells to render `shift.display_name` and `shift.start_time` instead of `shift.name` and `shift.time`.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(shifts)/roster.tsx
git commit -m "feat(mobile): wire roster screen to real team shift data"
```

---

## Task 3: Wire End-of-Shift Flows

**Files:**
- Modify: `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`
- Modify: `apps/mobile/src/components/home/AfterShiftView.tsx`
- Verify: `apps/mobile/src/components/shift/HandoffForm.tsx`
- Verify: `apps/mobile/src/components/shift/HoursConfirmation.tsx`
- Verify: `apps/mobile/src/hooks/mutations/use-submit-handoff.ts`
- Verify: `apps/mobile/src/hooks/mutations/use-confirm-hours.ts`

- [ ] **Step 1: Read AfterShiftView props**

Read `apps/mobile/src/components/home/AfterShiftView.tsx`. Note the callback props:
- `onSubmitHandoff: (text: string) => void`
- `submittingHandoff: boolean`
- `onConfirmHours: () => void`
- `confirmingHours: boolean`
- `onDisputeHours: () => void`

These are already defined as optional props. The parent needs to provide them.

- [ ] **Step 2: Read the mutation hooks**

Read `apps/mobile/src/hooks/mutations/use-submit-handoff.ts` and `use-confirm-hours.ts`. Note return signatures — they use the `enqueue()` pattern.

- [ ] **Step 3: Wire AfterShiftView into ShiftClockView**

In `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`, find where `viewPhase === "summary"` renders `<ShiftClockSummary />`. After summary confirmation (or as an alternative phase), render AfterShiftView with mutation callbacks.

Add imports:
```tsx
import { AfterShiftView } from "@/components/home/AfterShiftView";
import { useSubmitHandoff } from "@/hooks/mutations/use-submit-handoff";
import { useConfirmHours } from "@/hooks/mutations/use-confirm-hours";
```

Add hooks in component body:
```tsx
const { submitHandoff, isSubmitting: submittingHandoff } = useSubmitHandoff();
const { confirmHours, isConfirming: confirmingHours } = useConfirmHours();
```

Add a new phase `"after_shift"` to the viewPhase state. After punch-out completes, transition to `"after_shift"` instead of (or after) `"summary"`.

Render when phase is `"after_shift"`:
```tsx
if (viewPhase === "after_shift") {
  return (
    <AfterShiftView
      shift={currentShift}
      timeEntry={activeTimeEntry}
      onSubmitHandoff={(text) => submitHandoff({ 
        sessionId: activeTimeEntry.session_id, 
        profileId, 
        workspaceId, 
        text 
      })}
      submittingHandoff={submittingHandoff}
      onConfirmHours={() => confirmHours({ 
        approvalId: activeTimeEntry.id,
        profileId,
        workspaceId
      })}
      confirmingHours={confirmingHours}
      onDisputeHours={() => {
        // Navigate to dispute form or open bottom sheet
        router.push("/(app)/(shifts)");
      }}
    />
  );
}
```

Adapt the prop shapes to match what the mutation hooks actually expect — read the hook files first.

- [ ] **Step 4: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/shift-clock/ShiftClockView.tsx
git commit -m "feat(mobile): wire end-of-shift handoff and hours confirmation flows"
```

---

## Task 4: Swap Query Hooks

**Files:**
- Create: `apps/mobile/src/hooks/queries/use-swap-requests.ts`
- Create: `apps/mobile/src/hooks/queries/use-eligible-swap-shifts.ts`

- [ ] **Step 1: Create useSwapRequests hook**

This queries `engine_state` for pending shift swap requests involving the current user (as requester or target).

```tsx
// apps/mobile/src/hooks/queries/use-swap-requests.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";

export type SwapRequest = {
  id: string;
  status: string;
  requesterProfileId: string;
  targetProfileId: string;
  requesterShiftId: string;
  targetShiftId: string;
  reason: string;
  startedAt: string;
};

export function useSwapRequests() {
  const profileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<SwapRequest[]>({
    queryKey: ["swap-requests", profileId],
    enabled: !!profileId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, context, status, started_at")
        .eq("process_key", "shift_swap")
        .in("status", ["active", "waiting"])
        .order("started_at", { ascending: false });

      if (error) throw error;

      return (data ?? [])
        .map((row) => {
          const ctx = row.context as Record<string, string>;
          return {
            id: row.id,
            status: ctx.status ?? "unknown",
            requesterProfileId: ctx.requester_profile_id ?? "",
            targetProfileId: ctx.target_profile_id ?? "",
            requesterShiftId: ctx.requester_shift_id ?? "",
            targetShiftId: ctx.target_shift_id ?? "",
            reason: ctx.reason ?? "",
            startedAt: row.started_at ?? "",
          };
        })
        .filter(
          (s) => s.requesterProfileId === profileId || s.targetProfileId === profileId,
        );
    },
  });
}
```

- [ ] **Step 2: Create useEligibleSwapShifts hook**

This fetches published shifts from colleagues in the same workspace for swap selection.

```tsx
// apps/mobile/src/hooks/queries/use-eligible-swap-shifts.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";

export type EligibleShift = {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
};

export function useEligibleSwapShifts(requesterShiftDate: string | null) {
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const profileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<EligibleShift[]>({
    queryKey: ["eligible-swap-shifts", workspaceId, requesterShiftDate],
    enabled: !!workspaceId && !!requesterShiftDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, employee_id, shift_date, start_time, end_time, role, profile:employee_id(display_name)")
        .eq("workspace_id", workspaceId!)
        .eq("is_published", true)
        .eq("shift_date", requesterShiftDate!)
        .neq("employee_id", profileId!)
        .not("employee_id", "is", null);

      if (error) throw error;

      return (data ?? []).map((s) => ({
        shiftId: s.schedule_shift_id,
        employeeId: s.employee_id!,
        employeeName: (s.profile as unknown as { display_name: string } | null)?.display_name ?? "Ukjent",
        shiftDate: s.shift_date,
        startTime: s.start_time,
        endTime: s.end_time,
        role: s.role,
      }));
    },
  });
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/queries/use-swap-requests.ts apps/mobile/src/hooks/queries/use-eligible-swap-shifts.ts
git commit -m "feat(mobile): add shift swap query hooks"
```

---

## Task 5: Swap Mutation Hooks

**Files:**
- Create: `apps/mobile/src/hooks/mutations/use-swap.ts`

- [ ] **Step 1: Create swap mutation hooks**

```tsx
// apps/mobile/src/hooks/mutations/use-swap.ts

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { emit } from "@smartout/telemetry";

export function useInitiateSwap() {
  const queryClient = useQueryClient();
  const profileId = useWorkspaceStore((s) => s.selectedProfileId);
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);

  const initiateSwap = useCallback(
    async (params: {
      requesterShiftId: string;
      targetProfileId: string;
      targetShiftId: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "initiate_shift_swap" as never,
        {
          p_requester_shift_id: params.requesterShiftId,
          p_target_profile_id: params.targetProfileId,
          p_target_shift_id: params.targetShiftId,
          p_reason: params.reason ?? null,
        } as never,
      );

      if (error) throw error;

      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

      void emit({
        event: "shift swap_requested",
        workspace_id: workspaceId ?? "",
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "engine_state", entity_id: String(data) },
          data: {
            swap_id: String(data),
            requester_shift_id: params.requesterShiftId,
            target_shift_id: params.targetShiftId,
            target_profile_id: params.targetProfileId,
          },
        },
      });

      return data as string;
    },
    [queryClient, profileId, workspaceId],
  );

  return { initiateSwap };
}

export function useRespondToSwap() {
  const queryClient = useQueryClient();
  const profileId = useWorkspaceStore((s) => s.selectedProfileId);
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);

  const respondToSwap = useCallback(
    async (params: { swapId: string; accepted: boolean; reason?: string }) => {
      const { error } = await supabase.rpc(
        "respond_to_shift_swap" as never,
        {
          p_swap_id: params.swapId,
          p_accepted: params.accepted,
          p_reason: params.reason ?? null,
        } as never,
      );

      if (error) throw error;

      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

      const event = params.accepted ? "shift swap_accepted" : "shift swap_rejected";
      void emit({
        event,
        workspace_id: workspaceId ?? "",
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "engine_state", entity_id: params.swapId },
          data: { swap_id: params.swapId },
        },
      });
    },
    [queryClient, profileId, workspaceId],
  );

  return { respondToSwap };
}

export function useCancelSwap() {
  const queryClient = useQueryClient();
  const profileId = useWorkspaceStore((s) => s.selectedProfileId);
  const workspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);

  const cancelSwap = useCallback(
    async (swapId: string) => {
      const { error } = await supabase.rpc(
        "cancel_shift_swap" as never,
        { p_swap_id: swapId } as never,
      );

      if (error) throw error;

      void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });

      void emit({
        event: "shift swap_cancelled",
        workspace_id: workspaceId ?? "",
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "engine_state", entity_id: swapId },
          data: {},
        },
      });
    },
    [queryClient, profileId, workspaceId],
  );

  return { cancelSwap };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/mutations/use-swap.ts
git commit -m "feat(mobile): add shift swap mutation hooks (initiate, respond, cancel)"
```

---

## Task 6: Swap UI Components

**Files:**
- Create: `apps/mobile/src/components/shift/SwapStatusBadge.tsx`
- Create: `apps/mobile/src/components/shift/SwapInboxCard.tsx`
- Create: `apps/mobile/src/components/shift/SwapRequestSheet.tsx`

- [ ] **Step 1: Create SwapStatusBadge**

Small badge showing swap status with color coding.

```tsx
// apps/mobile/src/components/shift/SwapStatusBadge.tsx

import { View, Text } from "react-native";
import { createStyles, useTheme } from "@/theme";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_recipient: { label: "Venter svar", color: "#f59e0b" },
  pending_manager: { label: "Venter godkjenning", color: "#3b82f6" },
  approved: { label: "Godkjent", color: "#10b981" },
  rejected: { label: "Avslått", color: "#ef4444" },
  cancelled: { label: "Kansellert", color: "#6b7280" },
  executed: { label: "Utført", color: "#10b981" },
};

type SwapStatusBadgeProps = {
  status: string;
};

export function SwapStatusBadge({ status }: SwapStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: "#6b7280" };
  const styles = useStyles();

  return (
    <View style={[styles.badge, { backgroundColor: config.color + "20" }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
}));
```

- [ ] **Step 2: Create SwapInboxCard**

Card showing an incoming swap request with accept/reject actions.

```tsx
// apps/mobile/src/components/shift/SwapInboxCard.tsx

import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import { ArrowLeftRight, Check, X } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { SwapStatusBadge } from "./SwapStatusBadge";
import type { SwapRequest } from "@/hooks/queries/use-swap-requests";

type SwapInboxCardProps = {
  swap: SwapRequest;
  isTarget: boolean;
  isRequester: boolean;
  requesterName: string;
  targetName: string;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onCancel: () => Promise<void>;
};

export function SwapInboxCard({
  swap,
  isTarget,
  isRequester,
  requesterName,
  targetName,
  onAccept,
  onReject,
  onCancel,
}: SwapInboxCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const [loading, setLoading] = useState<"accept" | "reject" | "cancel" | null>(null);

  async function handleAction(action: "accept" | "reject" | "cancel", fn: () => Promise<void>) {
    setLoading(action);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  }

  const showActions = (isTarget && swap.status === "pending_recipient") ||
    (isRequester && (swap.status === "pending_recipient" || swap.status === "pending_manager"));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ArrowLeftRight size={16} color={theme.colors.brandOrange} />
        <Text style={styles.title}>
          {isTarget ? `${requesterName} vil bytte` : `Sendt til ${targetName}`}
        </Text>
        <SwapStatusBadge status={swap.status} />
      </View>

      {swap.reason ? (
        <Text style={styles.reason}>{swap.reason}</Text>
      ) : null}

      {showActions && (
        <View style={styles.actions}>
          {isTarget && swap.status === "pending_recipient" && (
            <>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAction("accept", onAccept)}
                disabled={loading !== null}
              >
                {loading === "accept" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={14} color="#fff" />
                    <Text style={styles.acceptText}>Aksepter</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleAction("reject", onReject)}
                disabled={loading !== null}
              >
                {loading === "reject" ? (
                  <ActivityIndicator size="small" color={theme.colors.foreground} />
                ) : (
                  <>
                    <X size={14} color={theme.colors.foreground} />
                    <Text style={styles.rejectText}>Avslå</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
          {isRequester && (
            <Pressable
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={() => handleAction("cancel", onCancel)}
              disabled={loading !== null}
            >
              {loading === "cancel" ? (
                <ActivityIndicator size="small" color={theme.colors.muted} />
              ) : (
                <Text style={styles.cancelText}>Kanseller</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor: withOpacity(theme.colors.card, 0.8),
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.foreground,
  },
  reason: {
    fontSize: 13,
    color: theme.colors.muted,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  acceptBtn: {
    backgroundColor: theme.colors.brandOrange,
  },
  acceptText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  rejectBtn: {
    backgroundColor: withOpacity(theme.colors.muted, 0.15),
  },
  rejectText: {
    color: theme.colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  cancelBtn: {
    backgroundColor: withOpacity(theme.colors.destructive, 0.1),
  },
  cancelText: {
    color: theme.colors.destructive,
    fontSize: 13,
    fontWeight: "600",
  },
}));
```

- [ ] **Step 3: Create SwapRequestSheet**

Bottom sheet for selecting a target shift to swap with. Uses `@gorhom/bottom-sheet` (already in the project).

Read `apps/mobile/src/components/shift-clock/SupplementSheet.tsx` for the bottom sheet pattern used in the project. Follow the same import and styling pattern.

The sheet should:
1. Show the user's shift at the top ("Din vakt: {date} {time}")
2. List eligible colleague shifts from `useEligibleSwapShifts(shiftDate)`
3. Each row: colleague name, time, role
4. On tap: run `validateSwap()` from `@smartout/utils`, show blockers/warnings
5. If eligible: show "Send forespørsel" button
6. Optional reason TextInput

- [ ] **Step 4: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/shift/SwapStatusBadge.tsx apps/mobile/src/components/shift/SwapInboxCard.tsx apps/mobile/src/components/shift/SwapRequestSheet.tsx
git commit -m "feat(mobile): add swap UI components (badge, inbox card, request sheet)"
```

---

## Task 7: Wire Swap into Shift Screens

**Files:**
- Modify: `apps/mobile/app/(app)/(shifts)/_layout.tsx` — add swap route
- Modify: `apps/mobile/app/(app)/(shifts)/[id].tsx` — add "Bytt vakt" button
- Modify: `apps/mobile/app/(app)/(shifts)/index.tsx` — add swap inbox section

- [ ] **Step 1: Add swap route to layout**

In `apps/mobile/app/(app)/(shifts)/_layout.tsx`, add:
```tsx
<Stack.Screen name="swap" options={{ headerShown: false }} />
```

- [ ] **Step 2: Create swap screen**

Create `apps/mobile/app/(app)/(shifts)/swap.tsx`:
- Receives `shiftId` as a search param
- Loads the shift details
- Renders `SwapRequestSheet` as inline content (not bottom sheet — it's a full screen)
- On successful swap initiation, navigate back with success toast

- [ ] **Step 3: Add swap button to shift detail**

In `apps/mobile/app/(app)/(shifts)/[id].tsx`, find the action buttons section. Add a "Bytt vakt" button with `ArrowLeftRight` icon that navigates to the swap screen:

```tsx
<Pressable
  style={styles.actionButton}
  onPress={() => {
    Haptics.selectionAsync();
    router.push({ pathname: "/(app)/(shifts)/swap", params: { shiftId: shift.schedule_shift_id } });
  }}
>
  <ArrowLeftRight size={18} color={theme.colors.brandOrange} />
  <Text style={styles.actionLabel}>Bytt vakt</Text>
</Pressable>
```

Only show the swap button when: `shift.status === "published"` AND `shift.employee_id === profileId`.

- [ ] **Step 4: Add swap inbox to shifts list**

In `apps/mobile/app/(app)/(shifts)/index.tsx`, add a section above the shift list showing pending swap requests:

```tsx
import { useSwapRequests } from "@/hooks/queries/use-swap-requests";
import { SwapInboxCard } from "@/components/shift/SwapInboxCard";
import { useRespondToSwap, useCancelSwap } from "@/hooks/mutations/use-swap";
```

Before the week-grouped shift list, render:
```tsx
{swapRequests.data && swapRequests.data.length > 0 && (
  <View style={styles.swapSection}>
    <Text style={styles.sectionTitle}>Bytteforespørsler</Text>
    {swapRequests.data.map((swap) => (
      <SwapInboxCard
        key={swap.id}
        swap={swap}
        isTarget={swap.targetProfileId === profileId}
        isRequester={swap.requesterProfileId === profileId}
        requesterName="Kollega"
        targetName="Kollega"
        onAccept={() => respondToSwap({ swapId: swap.id, accepted: true })}
        onReject={() => respondToSwap({ swapId: swap.id, accepted: false })}
        onCancel={() => cancelSwap(swap.id)}
      />
    ))}
  </View>
)}
```

Note: For colleague names, you'll need to resolve profile display_name from the swap context profile IDs. Either join in the query hook or fetch separately.

- [ ] **Step 5: Verify typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/mobile --force
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(app)/(shifts)/
git commit -m "feat(mobile): wire shift swap UI into shift screens"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
pnpm turbo typecheck --force
```

Expected: 29/29 pass, 0 errors.

- [ ] **Step 2: Lint check**

```bash
pnpm turbo lint --filter=@smartout/mobile --force
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Verify no dead imports**

```bash
grep -r "ShiftCardRich\|PunchButton" apps/mobile/ --include="*.tsx" --include="*.ts" -l
```

Expected: No results (files were deleted in Task 1).

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore(mobile): final cleanup for shift module completion"
```
