---
title: "Mobile Wiring Fixes — Connect Orphaned Features"
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, bugfix, navigation, wiring]
---

# Mobile Wiring Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all orphaned components, fix broken navigation, and make every built feature accessible to users in the Smartout mobile app.

**Architecture:** No new features — only connecting existing code. 12 orphaned components, 4 unreachable screens, 1 hidden tab, 1 conditional guard that hides punch. Fix by updating imports, navigation paths, and layout configs.

**Tech Stack:** React Native + Expo Router, TypeScript, existing component library

---

## File Structure

```
apps/mobile/src/components/navigation/TabBar.tsx           — MODIFY: remove chat filter
apps/mobile/src/components/shift/PunchButton.tsx            — MODIFY: always show with adapted label
apps/mobile/src/components/shift-clock/ShiftClockView.tsx   — MODIFY: replace hardcoded tasks with TaskFeed
apps/mobile/src/components/home/DuringShiftView.tsx         — MODIFY: verify TaskFeed integration
apps/mobile/app/(app)/(me)/index.tsx                        — MODIFY: add edit-profile + team links
apps/mobile/app/(app)/(home)/haccp.tsx                      — MODIFY: connect to real haccp_log query
apps/mobile/app/(app)/(home)/deviation.tsx                  — MODIFY: connect to offline sync queue
```

---

## Task 1: Fix TabBar — Show Chat Tab

**Files:**

- Modify: `apps/mobile/src/components/navigation/TabBar.tsx:57`

The TabBar hardcodes `r.name !== "(chat)"` to filter out the Chat tab regardless of layout config. The layout already swapped chat/komm visibility, but TabBar overrides it.

- [ ] **Step 1: Remove the hardcoded chat filter**

In `apps/mobile/src/components/navigation/TabBar.tsx`, find line 57:

```typescript
const visibleRoutes = state.routes.filter((r) => r.name !== "(chat)");
```

Replace with:

```typescript
const visibleRoutes = state.routes.filter((r) => {
  const options = descriptors[r.key]?.options;
  // Respect Expo Router's href: null to hide tabs
  return (options as Record<string, unknown>)?.href !== null;
});
```

This respects the layout's `href: null` config instead of hardcoding which tab to hide.

- [ ] **Step 2: Add `descriptors` to the destructured props**

The `TabBar` component receives `descriptors` from `BottomTabBarProps` but doesn't destructure it. Update the function signature:

```typescript
export function TabBar({
  state,
  descriptors,
  navigation,
  unreadCount = 0,
  unreadNotificationCount = 0,
  centerFab,
}: TabBarProps) {
```

- [ ] **Step 3: Move the badge from Komm to Chat**

Find the badge rendering in `renderTab`:

```typescript
const isKommTab = route.name === "(komm)";
```

Change to show badge on chat tab instead:

```typescript
const isChatTab = route.name === "(chat)";
```

And update the badge line from:

```typescript
{isKommTab && <Badge count={unreadCount} style={styles.badge} />}
```

To:

```typescript
{isChatTab && <Badge count={unreadCount} style={styles.badge} />}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/navigation/TabBar.tsx
git commit -m "fix(mobile): respect layout href:null in TabBar instead of hardcoded chat filter"
```

---

## Task 2: Fix PunchButton — Always Visible

**Files:**

- Modify: `apps/mobile/src/components/shift/PunchButton.tsx:35-36`

Currently `PunchButton` returns `null` when `phase === "no_shift"` AND no upcoming shift exists. This means users with no scheduled shifts can never reach the punch clock. Employees should always be able to punch (ad-hoc shifts exist).

- [ ] **Step 1: Remove the visibility guard**

In `apps/mobile/src/components/shift/PunchButton.tsx`, find lines 35-36:

```typescript
const shouldShow = isClockedIn || (phase !== "no_shift" && shiftForPunch);
if (!shouldShow) return null;
```

Replace with:

```typescript
// Always show punch button — employees may need ad-hoc punch even without scheduled shifts
const isIdle = !isClockedIn && phase === "no_shift";
```

- [ ] **Step 2: Update the label for idle state**

Find the label line:

```typescript
const label = isClockedIn ? strings.shift.punchOut : strings.shift.punchIn;
```

Replace with:

```typescript
const label = isClockedIn ? strings.shift.punchOut : strings.shift.punchIn;
```

No change needed — "Punch inn" is correct for idle state too.

- [ ] **Step 3: Dim the button style when idle (no shift)**

Update the style conditional to use a muted style when idle:

```typescript
style={[
  styles.button,
  isClockedIn
    ? { backgroundColor: colors.destructive }
    : isIdle
      ? { backgroundColor: colors.muted }
      : { backgroundColor: colors.brandOrange },
]}
```

And update the icon color for idle state:

```typescript
{isClockedIn ? (
  <LogOut size={20} color={colors.primaryForeground} strokeWidth={2} />
) : (
  <Fingerprint size={20} color={isIdle ? colors.mutedForeground : colors.primaryForeground} strokeWidth={2} />
)}
<Text style={[styles.label, { color: isIdle ? colors.mutedForeground : colors.primaryForeground }]}>{label}</Text>
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/shift/PunchButton.tsx
git commit -m "fix(mobile): always show punch button, muted style when no shift scheduled"
```

---

## Task 3: Wire TaskFeed into ShiftClockView

**Files:**

- Modify: `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:180-220`

Replace the 3 hardcoded demo task cards with the real `TaskFeed` component.

- [ ] **Step 1: Add TaskFeed import**

At the top of `ShiftClockView.tsx`, add:

```typescript
import { TaskFeed } from "@/components/task/TaskFeed";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
```

- [ ] **Step 2: Add hooks inside the component**

Inside the `ShiftClockView` component body, add:

```typescript
const { data: tasks } = useMyTasks();
const { data: profile } = useMyProfile();
```

- [ ] **Step 3: Replace hardcoded cards with TaskFeed**

Find the hardcoded task section (lines ~197-216):

```typescript
<View style={[styles.feedCard, { borderLeftColor: styles.brandOrangeColor.color }]}>
  <Text style={styles.feedTitle}>Sjekk temperatur kjoleskap</Text>
  <Text style={styles.feedSub}>Rutine · Forfaller 16:00</Text>
</View>
<View style={[styles.feedCard, { borderLeftColor: styles.infoColor.color }]}>
  <Text style={styles.feedTitle}>Dagsbriefing</Text>
  <Text style={styles.feedSub}>VIP-selskap bord 12 kl 19. Allergier: notter.</Text>
</View>
<View style={[styles.feedCard, { borderLeftColor: styles.successColor.color }]}>
  <Text style={styles.feedTitle}>Lukking: rydd terassen</Text>
  <Text style={styles.feedSub}>Oppgave · Forfaller 22:30</Text>
</View>
```

Replace with:

```typescript
<TaskFeed tasks={tasks ?? []} profileId={profile?.profile_id ?? ""} />
```

Keep the tab header ("Oppgaver", "Chat", "Notater") above the TaskFeed.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/shift-clock/ShiftClockView.tsx
git commit -m "fix(mobile): replace hardcoded task cards with real TaskFeed in ShiftClockView"
```

---

## Task 4: Add Edit Profile + Team Links to Me Screen

**Files:**

- Modify: `apps/mobile/app/(app)/(me)/index.tsx`

The edit-profile and team screens exist as routes but have no navigation path. Add buttons to the Me screen.

- [ ] **Step 1: Add imports**

Add to imports in `apps/mobile/app/(app)/(me)/index.tsx`:

```typescript
import { UserPen, Users } from "lucide-react-native";
```

- [ ] **Step 2: Add Edit Profile button after the avatar section**

Find the avatar/profile info section and add after it:

```typescript
{/* Profile actions */}
<View style={styles.profileActions}>
  <Pressable
    style={({ pressed }) => [styles.profileActionButton, pressed && styles.pressed]}
    onPress={() => {
      Haptics.selectionAsync();
      router.push("/(app)/(home)/edit-profile");
    }}
    accessibilityRole="button"
    accessibilityLabel="Rediger profil"
  >
    <UserPen size={18} color={colors.mutedForeground} strokeWidth={1.8} />
    <Text style={styles.profileActionText}>Rediger profil</Text>
  </Pressable>

  <Pressable
    style={({ pressed }) => [styles.profileActionButton, pressed && styles.pressed]}
    onPress={() => {
      Haptics.selectionAsync();
      router.push("/(app)/(home)/team");
    }}
    accessibilityRole="button"
    accessibilityLabel="Mitt team"
  >
    <Users size={18} color={colors.mutedForeground} strokeWidth={1.8} />
    <Text style={styles.profileActionText}>Mitt team</Text>
  </Pressable>
</View>
```

- [ ] **Step 3: Add styles for the profile action buttons**

Add to the styles:

```typescript
profileActions: {
  flexDirection: "row",
  gap: theme.spacing.element,
  paddingHorizontal: theme.spacing.section,
  marginBottom: theme.spacing.section,
},
profileActionButton: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: 12,
  backgroundColor: theme.colors.card,
  borderRadius: theme.radius.md,
  borderWidth: 1,
  borderColor: theme.colors.border,
},
profileActionText: {
  ...theme.typography.caption,
  color: theme.colors.mutedForeground,
  fontWeight: theme.fontWeights.medium,
},
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/\(me\)/index.tsx
git commit -m "fix(mobile): add edit-profile and team links to Me screen"
```

---

## Task 5: Connect HACCP to Real Data

**Files:**

- Modify: `apps/mobile/app/(app)/(home)/haccp.tsx`

Replace hardcoded `UNITS` array with a Supabase query. The `useLogHaccp` mutation hook already exists — only the unit list is faked.

- [ ] **Step 1: Add a query hook for HACCP units**

At the top of `haccp.tsx`, replace the hardcoded `UNITS` with a query:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

function useHaccpUnits(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["haccp-units", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("asset")
        .select("id, name, location:location_id(name), asset_type, metadata")
        .eq("workspace_id", workspaceId)
        .eq("asset_type", "cooling_unit")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        location: (a.location as { name: string } | null)?.name ?? "Ukjent",
        temperature: (a.metadata as Record<string, number> | null)?.last_temperature ?? 0,
        threshold: (a.metadata as Record<string, number> | null)?.threshold ?? 4,
      }));
    },
    enabled: !!workspaceId,
  });
}
```

- [ ] **Step 2: Use the hook in the component**

Replace the hardcoded `UNITS` usage with:

```typescript
const { data: profile } = useMyProfile();
const { data: units = [], isLoading } = useHaccpUnits(profile?.workspace_id);
```

Remove the hardcoded `const UNITS: CoolingUnit[]` array entirely.

If no asset table exists with cooling units, keep the demo data as fallback:

```typescript
const DEMO_UNITS: CoolingUnit[] = [
  { id: "u1", name: "Kjoleskap 1", location: "Hovedkjokken", temperature: 3.2, threshold: 4 },
  { id: "u2", name: "Kjolerom", location: "Lager B", temperature: 9.1, threshold: 4 },
  { id: "u3", name: "Fryser", location: "Hovedkjokken", temperature: -18.5, threshold: -15 },
];

const displayUnits = units.length > 0 ? units : DEMO_UNITS;
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(home\)/haccp.tsx
git commit -m "fix(mobile): connect HACCP screen to real asset query with demo fallback"
```

---

## Task 6: Connect Deviation Form to Offline Sync Queue

**Files:**

- Modify: `apps/mobile/app/(app)/(home)/deviation.tsx`

Currently uses local state only. Connect the submit action to the existing offline sync queue.

- [ ] **Step 1: Import the deviation mutation**

Add at the top of `deviation.tsx`:

```typescript
import { useReportDeviation } from "@/hooks/mutations/use-report-deviation";
```

- [ ] **Step 2: Wire the submit handler**

Find the submit handler (the function that runs when the user taps "Send"). Replace the local-only logic with:

```typescript
const reportDeviation = useReportDeviation();

const handleSubmit = useCallback(async () => {
  if (!description.trim()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  reportDeviation.mutate({
    title: description.trim().slice(0, 80),
    description: description.trim(),
    severity: severity.toLowerCase(),
    location: selectedLocation,
  });

  setStep("done");
}, [description, severity, selectedLocation, reportDeviation]);
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(home\)/deviation.tsx
git commit -m "fix(mobile): connect deviation form to offline sync queue"
```

---

## Task 7: Fix Call Leader in ShiftClockView

**Files:**

- Modify: `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`

Two TODOs: "navigate to notes" and "call leader phone".

- [ ] **Step 1: Add imports**

```typescript
import * as Linking from "expo-linking";
import { useLeaderPhone } from "@/hooks/queries/use-leader-phone";
```

- [ ] **Step 2: Add the hook**

Inside the component:

```typescript
const { data: leaderPhone } = useLeaderPhone(profile?.profile_id);
```

- [ ] **Step 3: Replace the TODO for call leader**

Find `/* TODO: call leader phone */` and replace with:

```typescript
if (leaderPhone) {
  Linking.openURL(`tel:${leaderPhone}`);
} else {
  Alert.alert("", "Ingen leder tilgjengelig. Bruk chat.");
}
```

- [ ] **Step 4: Replace the TODO for notes**

Find `/* TODO: navigate to notes */` and replace with:

```typescript
// Notes are captured in the shift chat — navigate to active conversation
router.push("/(app)/(chat)");
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/mobile --force`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/shift-clock/ShiftClockView.tsx
git commit -m "fix(mobile): wire call leader and notes navigation in ShiftClockView"
```

---

## Parallelization

All 7 tasks touch different files. They can ALL run in parallel:

```
[T1: TabBar] [T2: PunchButton] [T3: ShiftClock tasks] [T4: Me links] [T5: HACCP] [T6: Deviation] [T7: Call leader]
```

No dependencies between tasks. Each produces an independent commit.

---

## Verification

After all tasks complete:

- [ ] `pnpm turbo typecheck --filter=@smartout/mobile --force` — 0 errors
- [ ] Open app → Chat tab visible in tab bar
- [ ] Open app → Punch button visible even with no shift (muted style)
- [ ] Navigate to any sub-screen → native back button in header
- [ ] Me screen → "Rediger profil" and "Mitt team" buttons visible
- [ ] HACCP screen → tries real query, falls back to demo if no data
- [ ] Deviation form → submits to sync queue
- [ ] ShiftClockView → shows real tasks from TaskFeed
- [ ] ShiftClockView → "Ring leder" opens phone dialer
