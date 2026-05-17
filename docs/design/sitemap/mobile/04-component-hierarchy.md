---
title: Mobile Component Hierarchy
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, components, hierarchy, sitemap]
---

# Component Hierarchy

Per major surface: top-level screen → child views → shared components → sheets/modals.

## Home Screen (`(home)/index.tsx`)

```
HomeScreen
  SyncIndicator                           apps/mobile/src/components/common/SyncIndicator.tsx
  Animated.View (top bar)
    Pressable → settings
    NotificationBell                      apps/mobile/src/components/notifications/NotificationBell.tsx
  ActionBar                               apps/mobile/src/components/navigation/ActionBar.tsx
  ScrollView (phase content)
    ShiftCard (if shift present)          apps/mobile/src/components/shift/ShiftCard.tsx
      [PhaseStrip — hidden 2026-05-15, pending review]
    [conditional by phase]
    NoShiftView                           apps/mobile/src/components/home/NoShiftView.tsx
    BeforeShiftView                       apps/mobile/src/components/home/BeforeShiftView.tsx
    DuringShiftView / DuringShiftViewV2   apps/mobile/src/components/home/DuringShiftView.tsx
                                          apps/mobile/src/components/home/DuringShiftView.v2.tsx
    AfterShiftView                        apps/mobile/src/components/home/AfterShiftView.tsx
  NotificationSheet (ref)                 apps/mobile/src/components/home/NotificationSheet.tsx
```

## Punch-Clock Screen (`(home)/punch-clock.tsx`)

Inline implementation (not using ShiftClockView component):
```
PunchClockScreen
  ActionHeader (Stack.Screen header)     apps/mobile/src/components/navigation/ActionHeader.tsx
  [before_shift state]
    Animated hero (avatar, name, shift)
    "Stemple inn" CTA
  [during_shift state]
    Live timer (formatTimer)
    2×2 ActionGrid (Pause, Notater, Lønn, Ring)
    Task feed
    "Stemple ut" CTA
```

Hooks: `useShiftPhase`, `useMyProfile`, `useMyTasks`, `usePunch`, `useShiftClock`, `useLeaderPhone`

## Shifts List Screen (`(shifts)/index.tsx`)

```
ShiftListScreen
  SafeAreaView
    Header ("Vaktliste")
    ScopeChips                            apps/mobile/src/components/calendar/ScopeChips.tsx
    ScrollView
      ScopeSummary (inline component)
      [loading / error state]
      DayCrewCluster × 7 (inline component)
        CompactShiftRow ×N                apps/mobile/src/components/calendar/CompactShiftRow.tsx
```

## Shift Detail Screen (`(shifts)/[id].tsx`)

```
ShiftDetailScreen
  SafeAreaView
    Handle row + ChevronLeft back
    Shift header (Calendar icon, title, ref)
    Tab bar (Detaljer | Oppgaver | Emma)
    ScrollView
      [details tab]
        StatusRow
        DetailRow × N (Time, Posisjon, Din Vakt, Kolleger)
          Avatar                          apps/mobile/src/components/common/Avatar.tsx
      [tasks tab] — empty stub
      [emma tab]  — empty stub (Sparkles icon)
    Bottom action bar
      Confirm button (if not confirmed)
      Swap button (if published + own shift)
      "Stemple inn" → punch-clock CTA
```

## Chat Screen (`(chat)/index.tsx`)

```
ChatScreen
  SafeAreaView
    TopBar (Menu icon → settings, "Chat", notification bell)
    ActionBar
    Segment selector ("Chatkanaler" | "Skranke")
    [Chatkanaler segment]
      ActiveNowRow                        apps/mobile/src/components/chat/ActiveNowRow.tsx
      SectionList (ConversationSection ×N)
        ConversationRow with Avatar
        ConversationContextMenu           apps/mobile/src/components/chat/ConversationContextMenu.tsx
    [Skranke segment]
      FlatList
        QueueRow                          apps/mobile/src/components/helpdesk/QueueRow.tsx
    NewConversationSheet (ref)            apps/mobile/src/components/chat/NewConversationSheet.tsx
```

## Min Tid Screen (`(me)/index.tsx`)

```
MeScreen
  SafeAreaView
    TopBar (Menu → settings, "Min Side", NotificationBell)
    ActionBar
    ScrollView
      Welcome (greeting, subtitle)
      Stats grid (2×2)
        StatCard: Lønn → payroll
        StatCard: Timebank → payroll/timebank
        StatCard: Saldo → payroll/absence-balance
        StatCardCta: Nytt fravær → payroll/absence-request
      Recent payslips (hardcoded PAYSLIPS array — stub)
      Quick access
        Arbeidskontrakt → contract
        Personvern → settings
```

Note: payslips are hardcoded static data. No hook wired yet.

## Payroll Hub (`(me)/payroll/index.tsx`)

```
PayrollLayout (ErrorBoundary)
  PayrollScreen
    ActionHeader
    ScrollView
      Primary payroll card (usePayrollSummary)
      Bento 2×2 grid
        Absence → absence-request
        Timebank → timebank
        Supplements → supplements
        Payslips → payslip
      Recent payslips list (usePayslips)
        Payslip rows with lonnsgrunnlag link
```

## Calendar Screen (`(calendar)/index.tsx`)

```
CalendarWeekView
  SafeAreaView
    Header (month label + Month/Week toggle)
    WeekStrip                             apps/mobile/src/components/calendar/WeekStrip.tsx
    FilterChips                           apps/mobile/src/components/calendar/FilterChips.tsx
    ProgressRing                          apps/mobile/src/components/calendar/ProgressRing.tsx
    ScrollView
      [loading skeleton]
      ItemCard ×N                         apps/mobile/src/components/calendar/ItemCard.tsx
      EmptyDay                            apps/mobile/src/components/calendar/EmptyDay.tsx
    DetailSheet (ref)                     apps/mobile/src/components/calendar/DetailSheet.tsx
```

## ShiftClockView — Orphan Component

`apps/mobile/src/components/shift-clock/ShiftClockView.tsx` is a complete parallel implementation:
```
ShiftClockView
  [idle/before_shift] PunchAnimation
  [clocked_in]
    ShiftClockHeader
    ShiftClockActions
    content area
  [on_break]
    break timer via ShiftClockActions
  [summary]
    ShiftClockSummary
  [after_shift]
    AfterShiftView + HandoffForm + HoursConfirmation
```

This component is **not used by any route**. `punch-clock.tsx` has a parallel inline implementation.
