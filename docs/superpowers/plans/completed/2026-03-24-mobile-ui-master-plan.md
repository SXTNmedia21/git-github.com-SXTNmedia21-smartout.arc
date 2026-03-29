# Mobile UI Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete end-to-end implementation of the Mobile App UI based on the 3 core specs: Mobile Employee App (V1 / Vaktløkka), ShiftClock (Punchklokke), and Mobile Payroll UI.

**Architecture:** React Native + Expo. Uses `expo-router` for navigation (4 tabs + AI FAB). Zustand for offline-first state (`useShiftPhase`). UI components are built with `react-native-reanimated` for motion and a central design-token system (`@smartout/design-tokens`).

**Tech Stack:** React Native, Expo, Reanimated, Expo Router, Lucide Icons.

---

### Task 1: Navigation Shell & AI FAB Rebuild

**Files:**

- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Create/Modify: `apps/mobile/src/components/navigation/TabBar.tsx`
- Create/Modify: `apps/mobile/src/components/navigation/AIFab.tsx`
- Create/Modify: `apps/mobile/src/components/navigation/QuickActions.tsx`

- [x] **Step 1: Write the failing test / define component interface**
      Ensure `TabBar` receives standard BottomTabBarProps and renders a central custom button.
- [x] **Step 2: Implement `TabBar.tsx`**
      Build a custom bottom tab bar with 5 slots, where the 3rd slot is the floating `AIFab`.
- [x] **Step 3: Implement `AIFab.tsx` & `QuickActions.tsx`**
      Build the Botsson FAB with spring animations. Add swipe-up gesture for QuickActions (using Reanimated `PanGestureHandler` or simple `Pressable` overlay).
- [x] **Step 4: Update `(app)/_layout.tsx`**
      Wire the new `TabBar` into `<Tabs tabBar={...}>`. Also wrapped app group with `BottomSheetModalProvider` for punch-clock supplement sheet.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/_layout.tsx apps/mobile/src/components/navigation/
git commit -m "feat(mobile): rebuild navigation shell with custom tab bar and AI FAB"
```

### Task 2: Home Screen (Vaktløkka) - 4 Phases UI

**Files:**

- Modify: `apps/mobile/app/(app)/(home)/index.tsx`
- Create: `apps/mobile/src/components/home/NoShiftView.tsx`
- Create: `apps/mobile/src/components/home/BeforeShiftView.tsx`
- Create: `apps/mobile/src/components/home/DuringShiftView.tsx`
- Create: `apps/mobile/src/components/home/AfterShiftView.tsx`

- [x] **Step 1: Write the failing test / define interfaces**
      Define props for each phase view (e.g., `BeforeShiftViewProps`).
- [x] **Step 2: Implement Phase Views**
  - `NoShiftView`: "Ingen planlagt vakt i dag".
  - `BeforeShiftView`: Upcoming shift details, team avatars.
  - `DuringShiftView`: Active shift info, live earnings counter placeholder.
  - `AfterShiftView`: Summary of the day, tasks completed.
- [x] **Step 3: Assemble in `index.tsx`**
      Use `useShiftPhase` to switch between these views using `Animated.View` entering transitions (FadeIn).
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(home\)/index.tsx apps/mobile/src/components/home/
git commit -m "feat(mobile): implement home screen vaktlokka 4-phase views"
```

### Task 3: ShiftClock (Aktiv Vakt Fullscreen)

**Files:**

- Modify: `apps/mobile/app/(app)/(home)/punch-clock.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockHeader.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockActions.tsx`
- Create: `apps/mobile/src/components/shift-clock/SupplementSheet.tsx`

- [x] **Step 1: Write the failing test / define state**
      Map out the IDLE → CLOCKED_IN → ON_BREAK → SUMMARY states.
- [x] **Step 2: Implement IDLE & Animation**
      Build the large glowing orange punch button (implemented in previous plan, needs integration).
- [x] **Step 3: Implement CLOCKED_IN View**
      2x2 grid of actions (Pause, Notat, Tillegg, Ring leder). Feed / Chat / Notes tabs: deferred (spec follow-up).
- [x] **Step 4: Implement SupplementSheet**
      Bottom sheet for manual supplements with required comment input.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/\(home\)/punch-clock.tsx apps/mobile/src/components/shift-clock/
git commit -m "feat(mobile): implement shift clock active view and supplement sheet"
```

### Task 4: Mobile Payroll UI

**Files:**

- Create: `apps/mobile/app/(app)/(me)/payroll/index.tsx`
- Create: `apps/mobile/src/components/payroll/PayrollHomeCard.tsx`
- Create: `apps/mobile/src/components/payroll/AbsenceDetail.tsx`
- Create: `apps/mobile/src/components/payroll/TimebankDetail.tsx`
- Create: `apps/mobile/src/components/payroll/SupplementsDetail.tsx`
- Create: `apps/mobile/src/components/payroll/PayslipList.tsx`

- [x] **Step 1: Implement `PayrollHomeCard.tsx`**
      Adaptive card showing estimated/registered/settled earnings.
- [x] **Step 2: Implement Detail Views**
      Absence (vacation/sick days), Timebank (overtime), and Supplements (colored badges for evening/weekend). Added `SupplementsDetailScreen`, `AbsenceDetail` / `TimebankDetail` aliases.
- [x] **Step 3: Implement Payslip List**
      Historical list of payslips with Netto hero (`PayslipList` export → `PayslipScreen`).
- [x] **Step 4: Assemble Payroll Hub**
      Wire these into `apps/mobile/app/(app)/(me)/payroll/index.tsx` + `payroll/supplements.tsx`. Me tab + home card link to hub.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/\(me\)/payroll apps/mobile/src/components/payroll/
git commit -m "feat(mobile): implement mobile payroll ui screens"
```
