---
title: Mobile Proposed Architecture — Full Tree
status: draft
updated: 2026-05-15
created: 2026-05-15
version: 1
module: mobile
tags: [mobile, architecture, sitemap, proposed, file-tree, deep-dive]
---

# Mobile Proposed Architecture — Full Tree

Companion to `10-UX-REVIEW.md` (v3). Shows the complete proposed structure: every route, every component directory, every hook, every layout, every modal/sheet — and how data flows through them. Every node tagged with status:

- `REUSE` — file exists, no change needed
- `RENAME` — file exists, moves via `git mv`
- `EDIT` — file exists, body changes
- `NEW` — file does not exist, must be created
- `DELETE` — file exists, removed
- `KEEP` — file exists, stays where it is

---

## 1. Top-Level App Tree

```
apps/mobile/
├── app/                              Expo Router file-based routing
│   ├── _layout.tsx                   EDIT — keep providers, no other change
│   ├── index.tsx                     KEEP — redirect → (auth)/welcome
│   ├── +not-found.tsx                KEEP
│   ├── (auth)/                       KEEP entire group
│   └── (app)/                        EDIT — tab semantics + group renames
│
├── src/
│   ├── components/                   See §6 — mostly REUSE
│   ├── hooks/                        See §7 — REUSE
│   ├── lib/                          KEEP — supabase client, sync queue, schemas
│   ├── providers/                    KEEP — auth-provider, query-provider
│   ├── theme/                        KEEP — Nordic Split tokens
│   ├── constants/                    KEEP — strings (i18n keys)
│   └── i18n/                         EDIT — add Nå/Plan/Meg/Hjelp labels
│
├── app.json / app.config.ts          VERIFY — expo.scheme = "smartout"
└── package.json                      KEEP — no new deps
```

---

## 2. Route Tree — `app/` Directory

### 2.1 Auth group (UNCHANGED)

```
app/(auth)/                                  KEEP — entire group untouched
├── _layout.tsx                              KEEP
├── welcome.tsx                              KEEP
├── verify.tsx                               KEEP
├── workspace-select.tsx                     KEEP
├── pending.tsx                              KEEP
└── invite/
    ├── [token].tsx                          KEEP
    └── confirm.tsx                          KEEP
```

### 2.2 App group — proposed

```
app/(app)/
├── _layout.tsx                              EDIT — Tabs.Screen names + AIFab refactor
│
├── (now)/                                   RENAME from (home)/
│   ├── _layout.tsx                          EDIT — thinned Stack registrations
│   ├── index.tsx                            EDIT — drop ActionBar, add sheet triggers
│   ├── punch-clock.tsx                      EDIT — body becomes <ShiftClockView />
│   └── clockout.tsx                         KEEP — push-deep-link target
│
│   [REMOVED from (now)]:
│   - deviation.tsx          → ported into NEW src/components/now-sheets/DeviationSheet.tsx
│   - haccp.tsx              → ported into NEW src/components/now-sheets/HACCPSheet.tsx
│   - safety-round.tsx       → ported into NEW src/components/now-sheets/SafetySheet.tsx
│   - temp-deviation.tsx     → ported into NEW src/components/now-sheets/TempDevSheet.tsx
│
│   [RENAMED to (me)]:
│   - training.tsx           → (me)/training/index.tsx
│   - course-detail.tsx      → (me)/training/course-detail.tsx
│   - flow-player.tsx        → (me)/training/flow-player.tsx
│   - team.tsx               → (me)/team/index.tsx
│   - team/[id].tsx          → (me)/team/[id].tsx
│   - settings.tsx           → (me)/settings.tsx
│   - edit-profile.tsx       → (me)/edit-profile.tsx
│   - availability.tsx       → (me)/availability.tsx
│   - spokesperson-approval.tsx → (me)/spokesperson-approval.tsx
│   - hms.tsx                → (me)/training/hms.tsx (HMS = compliance training surface)
│   - operations.tsx         → DECISION-D6 (see below)
│
├── (plan)/                                  RENAME from (shifts)/
│   ├── _layout.tsx                          EDIT — keep Stack.Screen list, rename group
│   ├── index.tsx                            EDIT — view-mode toggle (list | grid)
│   ├── [id].tsx                             KEEP — shift detail
│   ├── swap.tsx                             KEEP
│   ├── marketplace.tsx                      KEEP
│   ├── proposed-plan.tsx                    KEEP — push-deep-link target
│   ├── roster.tsx                           KEEP — read-only manager view
│   └── create.tsx                           DELETE (pending D1)
│
├── (chat)/                                  KEEP entire group
│   ├── _layout.tsx                          KEEP
│   ├── index.tsx                            EDIT — rename "Skranke" → "Hjelp" segment label
│   ├── [id].tsx                             KEEP
│   └── settings.tsx                         KEEP
│
├── (me)/                                    EDIT — absorb identity routes
│   ├── _layout.tsx                          EDIT — add Stack.Screens for moved files
│   ├── index.tsx                            EDIT — restructure hub (readiness + money + identity)
│   ├── notifications.tsx                    KEEP
│   ├── design-preview.tsx                   EDIT — wrap in `if (__DEV__)` guard
│   ├── channel-detail/[id].tsx              KEEP
│   │
│   ├── settings.tsx                         RENAME from (home)/settings.tsx
│   ├── edit-profile.tsx                     RENAME from (home)/edit-profile.tsx
│   ├── availability.tsx                     RENAME from (home)/availability.tsx
│   ├── spokesperson-approval.tsx            RENAME from (home)/spokesperson-approval.tsx
│   │
│   ├── contract/                            KEEP entire sub-stack
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   └── complete-data.tsx
│   │
│   ├── payroll/                             KEEP entire sub-stack
│   │   ├── _layout.tsx                      EDIT — fix payroll-supplements → supplements name
│   │   ├── index.tsx
│   │   ├── payslip.tsx
│   │   ├── payslip-detail.tsx
│   │   ├── lonnsgrunnlag-detail.tsx
│   │   ├── timebank.tsx
│   │   ├── absence-balance.tsx
│   │   ├── absence-request.tsx
│   │   └── supplements.tsx
│   │
│   ├── training/                            NEW sub-stack dir (files moved in)
│   │   ├── _layout.tsx                      NEW — Stack with headerShown: false
│   │   ├── index.tsx                        RENAME from (home)/training.tsx
│   │   ├── course-detail.tsx                RENAME from (home)/course-detail.tsx
│   │   ├── flow-player.tsx                  RENAME from (home)/flow-player.tsx
│   │   └── hms.tsx                          RENAME from (home)/hms.tsx
│   │
│   └── team/                                NEW sub-stack dir (files moved in)
│       ├── _layout.tsx                      NEW — Stack with headerShown: false
│       ├── index.tsx                        RENAME from (home)/team.tsx
│       └── [id].tsx                         RENAME from (home)/team/[id].tsx
│
└── journey/[id]/guided.tsx                  KEEP — push-deep-link target
```

### 2.3 Routes DELETED entirely

```
app/(app)/
├── (calendar)/                              DELETE entire group
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── month.tsx
│   └── day/[date].tsx
│
├── (komm)/                                  DELETE entire group (ADR-0165 supersession)
│   ├── _layout.tsx
│   ├── index.tsx
│   └── [channelId].tsx
│
└── (queue)/                                 DELETE entire group (legacy)
    ├── _layout.tsx
    ├── index.tsx
    └── [ticketId].tsx
```

---

## 3. Tab Bar Layout — `(app)/_layout.tsx`

### Before

```tsx
<Tabs
  initialRouteName="(home)"
  tabBar={(props) => <TabBar {...props} fabRef={fabRef} />}
>
  <Tabs.Screen name="(home)"     options={{ title: "Hjem" }} />
  <Tabs.Screen name="(shifts)"   options={{ title: strings.tabs.vakter }} />
  <Tabs.Screen name="(chat)"     options={{ title: strings.tabs.chat }} />
  <Tabs.Screen name="(me)"       options={{ title: strings.tabs.minTid }} />
  <Tabs.Screen name="(calendar)" options={{ href: null }} />
  <Tabs.Screen name="(komm)"     options={{ href: null }} />
  <Tabs.Screen name="(queue)"    options={{ href: null }} />
  <Tabs.Screen name="journey"             options={{ href: null }} />
  <Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
</Tabs>

<AddSheet ref={addSheetRef} selectedDate={new Date()} />
<BotssonSheet ref={botssonSheetRef} />
```

### After

```tsx
<Tabs
  initialRouteName="(now)"
  tabBar={(props) => <TabBar {...props} fabRef={fabRef} />}
>
  <Tabs.Screen name="(now)"  options={{ title: "Nå" }} />
  <Tabs.Screen name="(plan)" options={{ title: "Plan" }} />
  <Tabs.Screen name="(chat)" options={{ title: "Chat" }} />
  <Tabs.Screen name="(me)"   options={{ title: "Meg" }} />
  <Tabs.Screen name="journey"             options={{ href: null }} />
  <Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
</Tabs>

<BotssonSheet ref={botssonSheetRef} />
{/* AddSheet removed — see D6 */}
```

Tab bar slots: 4 visible (Nå, Plan, Chat, Meg) + center FAB (rendered by `TabBar` component).

---

## 4. FAB Behavior — `src/components/navigation/AIFab.tsx`

### State machine

```
                  ┌─── tap (gesture) ───┐
                  │                     │
                  ▼                     ▼
        useShiftPhase()         long-press (gesture)
              │                         │
              ▼                         ▼
        ┌──────────┐              ┌───────────────┐
        │          │              │ BotssonSheet  │
during_shift?    else             │  voice mode   │
        │          │              └───────────────┘
        ▼          ▼
   ┌────────┐  ┌───────────────┐
   │ Punch  │  │ BotssonSheet  │
   │ Sheet  │  │  chat mode    │
   │        │  │ (default)     │
   │renders │  └───────────────┘
   │ <Shift │
   │ Clock  │
   │ View/> │
   └────────┘
```

### File changes

| File | Status | Change |
|------|--------|--------|
| `src/components/navigation/AIFab.tsx` | EDIT | Collapse 3 gestures → 2 (tap + long-press), context-aware tap |
| `src/components/navigation/TabBar.tsx` | EDIT | Verify FAB rendering, no functional change |
| `src/components/ai/BotssonSheet.tsx` | EDIT | Add `mode: "chat" | "voice"` prop, voice mode is default for long-press |
| `src/components/shift-clock/ShiftClockView.tsx` | EDIT | Wrap render path to allow sheet usage (already standalone component) |
| `src/components/calendar/AddSheet.tsx` | DELETE | After D6 confirms no real authoring use case |
| `app/(app)/_layout.tsx` | EDIT | Drop `<AddSheet />` mount + `addSheetRef` |

### Gesture handler logic (pseudocode)

```ts
function handleFabTap() {
  const phase = useShiftPhase().phase;
  if (phase === "during_shift") {
    // Open punch sheet (renders ShiftClockView)
    punchSheetRef.current?.present();
  } else {
    // Open Botsson chat
    botssonSheetRef.current?.present({ mode: "chat" });
  }
}

function handleFabLongPress() {
  // Always voice
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  botssonSheetRef.current?.present({ mode: "voice" });
}
```

---

## 5. The Now Tab — Phase Architecture

### Surface composition

```
(now)/index.tsx                               EDIT
└── HomeScreen
    ├── SafeAreaView edges=["top"]
    ├── SyncIndicator                         REUSE src/components/common/
    ├── TopBar (Animated.View)                EDIT — drop brand text, ambient orb only
    │   └── NotificationBell                  REUSE src/components/notifications/
    │       └── opens NotificationSheet       REUSE src/components/home/
    ├── [REMOVED — ActionBar]                 No longer rendered on Nå
    └── ScrollView phaseContent
        ├── ShiftCard (if relevantShift)      REUSE src/components/shift/
        └── Phase view (switch on phase):
            ├── NoShiftView                   REUSE src/components/home/
            ├── BeforeShiftView               REUSE src/components/home/
            ├── DuringShiftView (or V2)       EDIT — add sheet trigger buttons
            └── AfterShiftView                REUSE src/components/home/
```

### DuringShiftView — sheet trigger pattern

```
DuringShiftView                               EDIT
├── Live timer                                REUSE — already implemented
├── Task feed                                 REUSE — useMyTasks()
├── Colleagues strip                          REUSE — useShiftColleagues()
├── Action grid (2×2)                         EDIT — replace nav pushes with sheet opens:
│   ├── "Pause"   → tap → break toggle        REUSE existing handler
│   ├── "Temp"    → tap → TempDevSheet.open() NEW behavior
│   ├── "HACCP"   → tap → HACCPSheet.open()   NEW behavior
│   ├── "Avvik"   → tap → DeviationSheet.open() NEW behavior
│   └── "Sikkerhet" → tap → SafetySheet.open() NEW behavior
└── "Stemple ut" CTA                          REUSE
```

### now-sheets — NEW component directory

```
src/components/now-sheets/                    NEW dir
├── HACCPSheet.tsx                            NEW (wraps existing HACCP form JSX)
├── TempDevSheet.tsx                          NEW (wraps existing temp-deviation form JSX)
├── SafetySheet.tsx                           NEW (wraps existing safety-round form JSX)
├── DeviationSheet.tsx                        NEW (wraps existing deviation form JSX)
└── index.ts                                  NEW (barrel export)
```

Each sheet wrapper:
```tsx
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef } from "react";

export const HACCPSheet = forwardRef<BottomSheetModal>((_, ref) => {
  return (
    <BottomSheetModal ref={ref} snapPoints={["75%", "95%"]}>
      <BottomSheetView>
        {/* paste existing JSX from (home)/haccp.tsx body here */}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
```

Zero logic rewrite. Only chrome changes.

---

## 6. Component Directory Tree

```
src/components/                               21 dirs
│
├── ai/                                       KEEP
│   ├── BotssonSheet.tsx                      EDIT — add mode prop
│   └── (other AI components)                 KEEP
│
├── auth/                                     KEEP
│
├── availability/                             KEEP (rendered by (me)/availability.tsx)
│
├── calendar/                                 EDIT — components stay, used by (plan)
│   ├── AddSheet.tsx                          DELETE (D6)
│   ├── ScopeChips.tsx                        REUSE — in (plan)/index.tsx
│   ├── ScopeSummary                          REUSE
│   ├── WeekStrip.tsx                         REUSE — imported into (plan)/index.tsx for grid view
│   ├── ItemCard.tsx                          REUSE — imported into (plan)/index.tsx for grid view
│   ├── FilterChips.tsx                       REUSE
│   ├── DetailSheet.tsx                       REUSE
│   ├── ProgressRing.tsx                      REUSE (already used on Me hub)
│   ├── EmptyDay.tsx                          REUSE
│   ├── CompactShiftRow.tsx                   REUSE — in (plan)/index.tsx list view
│   └── types.ts                              KEEP
│
├── chat/                                     KEEP
│
├── common/                                   KEEP — SyncIndicator, Avatar, others
│
├── helpdesk/                                 KEEP — QueueRow used by (chat) Skranke segment
│
├── home/                                     KEEP — phase views, NotificationSheet
│   ├── NoShiftView.tsx                       REUSE
│   ├── BeforeShiftView.tsx                   REUSE
│   ├── DuringShiftView.tsx                   EDIT — sheet triggers (or supersede by V2)
│   ├── DuringShiftView.v2.tsx                D2 — promote to default or delete
│   ├── AfterShiftView.tsx                    REUSE
│   └── NotificationSheet.tsx                 REUSE
│
├── komm/                                     DELETE entire dir (with (komm) routes)
│
├── navigation/                               EDIT
│   ├── AIFab.tsx                             EDIT — 2-gesture model
│   ├── TabBar.tsx                            EDIT — verify rendering after rename
│   ├── ActionBar.tsx                         DELETE (no longer rendered anywhere)
│   └── ActionHeader.tsx                      KEEP
│
├── notifications/                            KEEP
│
├── now-sheets/                               NEW
│   ├── HACCPSheet.tsx                        NEW
│   ├── TempDevSheet.tsx                      NEW
│   ├── SafetySheet.tsx                       NEW
│   ├── DeviationSheet.tsx                    NEW
│   └── index.ts                              NEW
│
├── orb/                                      KEEP — ambient orb (Nordic Split)
│
├── payroll/                                  KEEP — SupplementBadges + others
│
├── reconciliation/                           KEEP — clockout wizard internals
│
├── schedule/                                 KEEP — schedule editor primitives (web-shared?)
│
├── shift/                                    KEEP — ShiftCard family
│   ├── ShiftCard.tsx                         REUSE
│   └── ShiftCardRich.tsx                     KEEP
│
├── shift-clock/                              KEEP — orphan promoted to canonical
│   ├── ShiftClockView.tsx                    EDIT — verify sheet-mount compatibility
│   ├── BreakToggle.tsx                       REUSE
│   ├── PunchAnimation.tsx                    REUSE
│   ├── ShiftClockActions.tsx                 REUSE
│   ├── ShiftClockHeader.tsx                  REUSE
│   ├── ShiftClockSummary.tsx                 REUSE
│   ├── SupplementSheet.tsx                   REUSE
│   ├── HandoffForm.tsx                       REUSE
│   └── HoursConfirmation.tsx                 REUSE
│
├── shift-timeline/                           D7 — PhaseStrip currently hidden. Decide: ship or delete.
│
├── spokesperson/                             KEEP — used by (me)/spokesperson-approval
│
├── task/                                     KEEP
│
└── ui/                                       KEEP — Card, Button, primitives
```

---

## 7. Hook Directory Tree

```
src/hooks/                                    No structural changes
│
├── queries/                                  KEEP all
│   ├── use-my-profile.ts                     REUSE — used everywhere
│   ├── use-my-tasks.ts                       REUSE
│   ├── use-my-shifts.ts                      REUSE
│   ├── use-team-shifts.ts                    EDIT — verify selectedProfileId hydration race fix (UX-S07)
│   ├── use-shift-colleagues.ts               REUSE
│   ├── use-shift-lifecycle.ts                REUSE — drives PhaseStrip (if shipped)
│   ├── use-day-info.ts                       REUSE
│   ├── use-duty-leader.ts                    REUSE
│   ├── use-supplement-rules.ts               REUSE
│   ├── use-payroll-summary.ts                REUSE
│   ├── use-payslips.ts                       REUSE
│   ├── use-training-data.ts                  EDIT — wire to protocol_assignment table (M-06)
│   └── use-shift-time-entries.ts             KEEP — used by punch-clock
│
├── mutations/                                KEEP all
│   ├── use-confirm-shift.ts                  REUSE
│   ├── use-swap-shift.ts                     REUSE
│   ├── use-punch.ts                          REUSE — single API surface for clock in/out
│   ├── use-claim-shift.ts                    REUSE
│   └── use-emit-event.ts                     REUSE (ADR-0134 gate)
│
├── stores/                                   KEEP all (Zustand + MMKV)
│   ├── use-workspace-store.ts                EDIT — verify MMKV hydration race (UX-S07)
│   ├── use-shift-phase.ts                    REUSE
│   └── use-shift-clock.ts                    REUSE — state machine
│
├── realtime/                                 KEEP — Supabase channel subscriptions
│
├── shift-clock/                              KEEP — punch-related hooks
│   └── use-leader-phone.ts                   REUSE
│
└── __tests__/                                KEEP
```

---

## 8. Data Flow Diagram — Punch Sequence

The most-traveled path. Verify it survives the refactor.

```
User taps FAB during shift
       │
       ▼
AIFab.tsx — handleTap()
       │
       │ reads useShiftPhase()
       │ phase === "during_shift"
       ▼
punchSheetRef.current?.present()
       │
       ▼
PunchSheet (NEW wrapper, mounts <ShiftClockView />)
       │
       ▼
ShiftClockView.tsx (orphan, now canonical)
       │
       ├── reads useShiftClock() (state machine)
       ├── renders ShiftClockHeader + ShiftClockActions
       ├── user taps "Pause" → BreakToggle
       │       │
       │       ▼
       │   usePunch.toggleBreak()
       │       │
       │       ▼
       │   POST /api/emma/chat (BFF) — capability: shift.toggle_break
       │       │
       │       ▼
       │   mutation success → emit(SHIFT_BREAK_TOGGLED)
       │       │
       │       ▼
       │   destinations: PostHog + Logger + activity_trail + engine_event
       │
       └── user taps "Stemple ut" → usePunch.punchOut()
               │
               ▼
           POST /api/emma/chat — capability: shift.punch_out
               │
               ▼
           gateAction (ADR-0287) — server-side authority check
               │
               ▼
           writes time_entry.punch_out, updates schedule_shift.status
               │
               ▼
           emit(SHIFT_PUNCHED_OUT) → 4 destinations
               │
               ▼
           useShiftPhase invalidates → re-fetch
               │
               ▼
           phase transitions: during_shift → after_shift
               │
               ▼
           Nå/index.tsx re-renders → AfterShiftView
               │
               ▼
           PunchSheet auto-dismisses (controlled by phase change)
```

Every box in this chain ALREADY EXISTS. Refactor only changes:
- Entry point (FAB sheet instead of route push)
- Render target (ShiftClockView instead of punch-clock.tsx inline)

---

## 9. Data Flow Diagram — Schedule View

```
User opens Plan tab
       │
       ▼
(plan)/index.tsx — view-mode state = "list" (default)
       │
       ├── ScopeChips (filter: me | dept | all | person)
       │       │
       │       ▼
       │   useTeamShifts({ weekStart, scope, myProfileId })
       │       │
       │       ▼
       │   fetches schedule_shift WHERE is_published=true
       │       │
       │       ▼
       │   client-side scope filter (ADR-0266)
       │       │
       │       ▼
       │   returns ShiftWithProfile[]
       │
       ├── ViewToggle [List | Grid]                NEW UI element in same file
       │
       └── conditional render:
           ├── view-mode === "list"
           │   └── DayCrewCluster × 7              REUSE existing
           │       └── CompactShiftRow             REUSE
           │
           └── view-mode === "grid"
               └── WeekStrip                       REUSE (imported from src/components/calendar/)
                   └── ItemCard × N                REUSE
```

Both views consume the same `useTeamShifts` hook. Zero data layer change.

---

## 10. Decision Matrix — Files Touched per Decision

Each decision unblocks specific files. Pontus answers, build agent executes.

| Decision | File(s) affected | Effect of YES | Effect of NO |
|----------|-----------------|---------------|--------------|
| D1 — Delete `(plan)/create.tsx` | `app/(app)/(plan)/create.tsx`, `(plan)/_layout.tsx` | File deleted. Manager creates shift on web only. ADR-0133 enforced. | File stays. Need amendment ADR for ADR-0133 exception. |
| D2 — Promote `DuringShiftView.v2` | `src/components/home/DuringShiftView*.tsx`, all imports | V1 deleted, V2 renamed. Feature flag `EXPO_PUBLIC_DURING_SHIFT_V2` removed. | Two implementations stay. Flag remains. |
| D3 — Keep `punch-clock.tsx` route | `app/(app)/(now)/punch-clock.tsx` | File stays, renders `<ShiftClockView />`. Push deep-links work. | File deleted. FAB sheet is only entry. Push deep-links break. |
| D4 — Rename Skranke → Hjelp | `src/i18n/no.json`, `(chat)/index.tsx` segment | Single i18n string change. Segment label updates. | Skranke stays. |
| D5 — Gate `design-preview` `__DEV__` | `app/(app)/(me)/design-preview.tsx` | Add `if (!__DEV__) return null;` at top. | File stays always-accessible. |
| D6 — Delete `AddSheet` | `src/components/calendar/AddSheet.tsx`, `(app)/_layout.tsx` mount | Component + mount deleted. FAB swipe gesture goes away. | Component stays, swipe-L1 still opens it. |
| D7 — Ship or delete `PhaseStrip` | `src/components/shift-timeline/`, `ShiftCard.tsx` PhaseStrip mount | Either resurrects PhaseStrip in ShiftCard header (lifecycle UI) or deletes the whole sub-component dir. | Status quo — code dead-but-present. |

---

## 11. Migration Sequence — Dependencies

Sorties have order constraints. Some can parallelize.

```
[independent]──┐
UX-02 (punch consolidation)
                │
                ▼
[blocks]    UX-01 (tools as sheets — depends on FAB sheet pattern from UX-02)
                │
                ▼
[blocks]    UX-05 (tab rename — needs all internal routes settled)

[independent]
UX-03 (Plan tab) ──┐
                    ├──► UX-05 (tab rename, last)
UX-04 (Meg tab) ───┘
```

Parallelization plan:
- **Batch A (parallel):** UX-02 + UX-03 + UX-04
- **Batch B (waits on A):** UX-01
- **Batch C (waits on all):** UX-05 (final rename + ADR-0268 amendment)

---

## 12. Route Push Targets — Repo-Wide Grep List

After Sortie UX-05 (rename), these strings need bulk update:

```
/(app)/(home)        →  /(app)/(now)
/(app)/(shifts)      →  /(app)/(plan)
"(home)"             →  "(now)"
"(shifts)"           →  "(plan)"
name="(home)"        →  name="(now)"
name="(shifts)"      →  name="(plan)"
```

Files to grep before sortie:
```bash
cd apps/mobile
grep -rln '/(app)/(home)' app src
grep -rln '/(app)/(shifts)' app src
grep -rln '"(home)"' app src
grep -rln '"(shifts)"' app src
```

Run pre-sortie audit. Count occurrences. Apply sed in UX-05 with verification.

---

## 13. ADR Footprint

| ADR | Action | Effect |
|-----|--------|--------|
| ADR-0268 (5-tab canonical) | AMEND | New ADR file: `0268-amendment-tab-order-2026-05-15.md` — tab order becomes Nå · Plan · FAB · Chat · Meg |
| ADR-0133 (mobile executes) | ENFORCE | D1 deletes `create.tsx`. Or AMEND if D1 = NO. |
| ADR-0165 (Komm supersession) | ENFORCE | Komm + Queue directories deleted as planned |
| ADR-0287 (mutateWithGate) | UNCHANGED | All mutations still go through gateAction RPC |
| ADR-0297 (workforce snapshot) | UNCHANGED | Stage-engine prompt slice unaffected |

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Repo-wide push target rename breaks deep links | Med | High | Grep audit + verify smartout:// scheme + manual test push notifications post-deploy |
| ShiftClockView prop mismatch with current punch-clock invocation | Low | Med | Read both files diff before UX-02 |
| Sheet wrapper breaks form state (keyboard, validation) | Low | Med | Test each sheet in isolation; @gorhom/bottom-sheet handles keyboard avoidance |
| MMKV hydration race surfaces as vakter-loading bug after rename | Med | High | UX-S07 (separate sortie) addresses this; do not couple to rename |
| Calendar component import path breaks WeekStrip in (plan)/index | Low | Low | TypeScript catches at typecheck. Run `pnpm --filter @smartout/mobile typecheck` after each sortie. |
| ActionBar deletion leaves cross-tab navigation gap | Low | Low | Discoverability shifts to Meg hub stat cards + Nå phase views — verify each entry point still reachable |

---

## 15. Acceptance Tests Per Sortie

Each sortie ships with a smoke test list. Tester runs in PWA (port 8083) after each merge.

### UX-01 smoke
- [ ] Open Nå during shift → Action grid shows 4 sheet triggers
- [ ] Tap "HACCP" → sheet opens with form
- [ ] Submit HACCP → sheet dismisses, returns to DuringShiftView preserved scroll position
- [ ] Repeat for Temp/Safety/Deviation
- [ ] Back-button on form sheet dismisses sheet (not navigates)

### UX-02 smoke
- [ ] Open `/(app)/(now)/punch-clock` directly → ShiftClockView renders
- [ ] Break toggle works
- [ ] Punch out flows through useShiftClock state machine
- [ ] Old inline punch-clock content gone

### UX-03 smoke
- [ ] Plan tab opens to list view
- [ ] Toggle to grid → WeekStrip + ItemCards render
- [ ] Toggle back to list → DayCrewCluster renders
- [ ] Tap shift in either view → shift detail
- [ ] Swap, marketplace, proposed-plan still reachable
- [ ] `/(app)/(calendar)` is 404

### UX-04 smoke
- [ ] Meg hub shows readiness + payroll + identity sections
- [ ] Tap Training → `/(me)/training/` renders
- [ ] Tap Settings from Meg menu → `/(me)/settings` (not `/(home)/settings`)
- [ ] `/(home)/training` is 404
- [ ] Team browser still works

### UX-05 smoke
- [ ] Tab labels: Nå, Plan, Chat, Meg
- [ ] Initial route is Nå
- [ ] FAB tap during shift → punch sheet
- [ ] FAB tap off shift → Botsson chat
- [ ] FAB long-press → Botsson voice
- [ ] Push notification deep link to `smartout://clockout?sessionId=X` opens clockout
- [ ] Push notification deep link to `proposed-plan` works

---

## 16. Final File Delta Tally

```
ADD:
  src/components/now-sheets/HACCPSheet.tsx
  src/components/now-sheets/TempDevSheet.tsx
  src/components/now-sheets/SafetySheet.tsx
  src/components/now-sheets/DeviationSheet.tsx
  src/components/now-sheets/index.ts
  app/(app)/(me)/training/_layout.tsx
  app/(app)/(me)/team/_layout.tsx
  docs/decisions/0268-amendment-tab-order-2026-05-15.md
  Total: 8 files

DELETE:
  app/(app)/(home)/deviation.tsx
  app/(app)/(home)/haccp.tsx
  app/(app)/(home)/safety-round.tsx
  app/(app)/(home)/temp-deviation.tsx
  app/(app)/(home)/operations.tsx        (pending D-ops resolution)
  app/(app)/(plan)/create.tsx            (pending D1=YES)
  app/(app)/(calendar)/                  (4 files)
  app/(app)/(komm)/                      (3 files)
  app/(app)/(queue)/                     (3 files)
  src/components/komm/                   (entire dir)
  src/components/calendar/AddSheet.tsx   (pending D6=YES)
  src/components/navigation/ActionBar.tsx
  src/components/home/DuringShiftView.tsx OR .v2.tsx  (pending D2)
  Total: ~20 files (varies by decisions)

RENAME (git mv):
  app/(app)/(home)/ → app/(app)/(now)/                   (entire group)
  app/(app)/(shifts)/ → app/(app)/(plan)/                (entire group)
  app/(app)/(home)/training.tsx → app/(app)/(me)/training/index.tsx
  app/(app)/(home)/course-detail.tsx → app/(app)/(me)/training/course-detail.tsx
  app/(app)/(home)/flow-player.tsx → app/(app)/(me)/training/flow-player.tsx
  app/(app)/(home)/hms.tsx → app/(app)/(me)/training/hms.tsx
  app/(app)/(home)/team.tsx → app/(app)/(me)/team/index.tsx
  app/(app)/(home)/team/[id].tsx → app/(app)/(me)/team/[id].tsx
  app/(app)/(home)/settings.tsx → app/(app)/(me)/settings.tsx
  app/(app)/(home)/edit-profile.tsx → app/(app)/(me)/edit-profile.tsx
  app/(app)/(home)/availability.tsx → app/(app)/(me)/availability.tsx
  app/(app)/(home)/spokesperson-approval.tsx → app/(app)/(me)/spokesperson-approval.tsx
  Total: 11 file moves + 2 group renames

EDIT (no rename, body changes):
  app/(app)/_layout.tsx
  app/(app)/(now)/_layout.tsx (renamed from (home))
  app/(app)/(now)/index.tsx
  app/(app)/(now)/punch-clock.tsx
  app/(app)/(plan)/_layout.tsx
  app/(app)/(plan)/index.tsx
  app/(app)/(me)/_layout.tsx
  app/(app)/(me)/index.tsx
  app/(app)/(me)/design-preview.tsx
  app/(app)/(me)/payroll/_layout.tsx     (fix payroll-supplements name)
  app/(app)/(chat)/index.tsx             (Skranke → Hjelp)
  src/components/navigation/AIFab.tsx
  src/components/navigation/TabBar.tsx
  src/components/ai/BotssonSheet.tsx
  src/components/home/DuringShiftView*.tsx
  src/components/shift-clock/ShiftClockView.tsx (verify props)
  src/i18n/no.json
  Total: ~17 files

Net code churn: ~50 files touched across 5 sorties.
Net behavior change: large (UX wins per §9 heuristics scores).
Net new abstractions: 1 (now-sheets wrapper pattern).
```

---

## 17. Open Questions (carried forward from `10-UX-REVIEW.md`)

1. AddSheet purpose — is there a real authoring use case before D6 deletes it?
2. Botsson voice surface — is long-press FAB the right voice trigger, or dedicated orb in FAB itself?
3. Notifications as persistent inbox vs current bottom-sheet pattern?
4. Calendar time-grid value vs list-only on Plan?
5. Min læring readiness score on Meg hub as primary KPI?

Decision before Sortie UX-01 starts: D1–D7. Decision before UX-04: questions 5 above.

---

## 18. Where to Read Next

- `10-UX-REVIEW.md` — narrative rationale, engagement heuristics, micro-interaction wins
- `09-recommendations.md` — original (smaller-scope) recommendations from sitemap survey
- `08-gaps-and-broken.md` — known issues this refactor closes (ShiftClockView orphan, payroll-supplements name, Calendar drift, Komm/Queue cleanup)
- `04-component-hierarchy.md` — component map per current surface (most reused as-is)
- `02-navigation-graph.md` — current navigation edges (compare to §11 of this doc for new edges)
