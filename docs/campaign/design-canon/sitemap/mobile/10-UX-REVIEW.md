---
title: Mobile Sitemap — Senior WFM UX Review
status: draft
updated: 2026-05-15
created: 2026-05-15
version: 3
module: mobile
tags: [mobile, ux-review, wfm, engagement, navigation, sitemap]
---

# Mobile Sitemap — Senior WFM UX Review (v3)

Perspective: senior UX designer specializing in Workforce Management + engagement design for shift workers. Source: `00-OVERVIEW.md` through `09-recommendations.md`. Code anchors: `(app)/_layout.tsx`, `(home)/_layout.tsx`, `(home)/index.tsx`, `ActionBar.tsx`, `ShiftClockView.tsx`, `(shifts)/index.tsx`, `(me)/index.tsx`. Reference: ADR-0133 (mobile executes), ADR-0268 (5-tab canonical), Nordic Split design system, 40% Reduction Principle.

**v3 stance:** Restructure is on the table. Tab semantics, navigation model, and information hierarchy can change. The constraint is **reuse the existing architecture** — components, hooks, layouts, sub-components that already work. Every recommendation cites which existing files are reused. Anything that must be **removed**, **changed**, or **added** is flagged explicitly so Pontus can approve before any sortie kicks off.

---

## 1. Core Purpose & Success Criteria

### Who the mobile app serves

**Primary user — the employee on shift.** Restaurant cook, bartender, server, FOH lead. 18–35, phone-native, low patience for friction. Uses the app between covers, during break, on the bus home. Average session: under 60 seconds. Hands are wet, dirty, or holding a tray.

**Secondary user — the shift lead / duty leader.** Same person, elevated authority for the day. Approves, witnesses, locks down operations at end-of-shift.

**Not a target on mobile:** the workspace owner doing planning. ADR-0133 keeps authoring on web.

### Six jobs-to-be-done

Ranked by frequency, weighted by emotional load:

| # | Job | Frequency | Friction tolerance |
|---|-----|-----------|-------------------|
| 1 | "When is my next shift? What happens?" | Daily | Zero — must be one tap from app open |
| 2 | "Clock in / clock out / take break" | Daily during shift | Zero — physical action, glanceable |
| 3 | "What do I need to do right now?" (tasks, HACCP, safety) | During shift | Low — must surface contextually |
| 4 | "Swap, drop, pick up a shift" | Weekly | Medium — can take 3 taps |
| 5 | "How much will I earn? Check timebank, supplements, payslip" | Weekly | Medium — destination workflow |
| 6 | "Ask a question, learn something, complete a course" | Onboarding-heavy, sporadic later | High — destination workflow |

### Engagement criteria

Mobile retains shift workers if and only if:

1. **Glanceability** — opening the app answers "what is my situation right now?" in under 2 seconds without taps.
2. **Trustworthy clock-in** — punch in/out feels physical, instant, never doubted.
3. **Predictable schedule visibility** — next shift, week ahead, swap status always findable.
4. **Earnings feedback loop** — timebank, supplements, hours-confirmed-today create dopamine for showing up.
5. **Low cognitive load** — 4–5 destinations max in the tab bar. No tab is a junk drawer.

Shift worker will NOT use a WFM app that forces them to think where a feature lives. Open, glance, act, close. If first 2 seconds fail, app gets replaced by Slack + screenshots.

---

## 2. Before — Current Sitemap Audit

### Hierarchy & grouping issues

Current 5-tab structure looks sensible on paper — Hjem · Vakter · FAB · Chat · Min Tid. Reality inside `(home)/*` is the failure.

**Hjem is a junk drawer.** 17 child routes under `/(app)/(home)/*`:

```
punch-clock, clockout, deviation, haccp, hms, safety-round, temp-deviation,
operations, training, course-detail, flow-player, team, team/[id],
edit-profile, settings, availability, spokesperson-approval
```

Violates the mental model. Hjem should mean "my current moment." Instead it owns Settings, Profile, Team browsing, HMS, Training, and 7 operational tools. First-time user opens Hjem expecting a status surface but the back-stack and deep links exit them into HACCP and safety rounds.

**ActionBar breaks tab semantics.** Shared `ActionBar` (rendered on Hjem + Min Tid) has 4 buttons: Oppgaver, Opplæring, Sikkerhet, Lønn. Three navigate INTO the Hjem stack (`/operations`, `/training`, `/hms`), one crosses tabs to `/(me)/payroll`. User has no way to predict which button changes tabs. Cross-tab navigation without visual cue breaks "tabs are mutually exclusive contexts."

**Settings owned by Hjem.** Settings, edit-profile, personvern all live under `/(app)/(home)/settings`. Min Tid's "Personvern og sikkerhet" link crosses to Hjem. Backwards — Settings is account/identity, belongs under Min Tid ("about me"), not Hjem ("my current moment").

**Vakter vs Calendar duplication.** Vakter (visible) is shift-list-oriented with 7-day DayCrewClusters. Calendar (hidden, `href: null`) is time-grid-oriented with WeekStrip + ItemCards. Both render shifts. ADR-0268 specified Calendar as primary, then code overrode to Hjem, leaving Vakter to absorb the schedule role. Calendar files exist but unreachable by any user. Half-finished refactor visible in the sitemap.

**Punch-clock as separate route is wrong abstraction.** Punching in/out is a STATE TRANSITION, not a destination. Currently `(home)/punch-clock` is a screen. From shift detail, user pushes to it. From FAB tap on Hjem, user lands on Hjem index (which is phase-aware and already shows DuringShiftView). Two paths render two different surfaces for the same conceptual action. The orphaned `ShiftClockView` component contains the full feature set (BreakToggle, SupplementSheet, GPS guard) that `punch-clock.tsx` is missing — duplicate-with-divergence is the worst possible state.

**FAB is overloaded.** Tap → home, swipe-L1 → AddSheet, swipe-L2 → AddSheet + BotssonSheet stacked. Three undocumented gestures on the most prominent UI element. Hick's Law: single FAB should have one obvious action. Discovery of swipe layers depends on user accidentally swiping. Voice surface (BotssonSheet) hidden behind double-swipe and stacked on top of an unrelated AddSheet.

**Min Tid mixes "me" and "earnings."** Hub stat cards point at payroll sub-screens (Lønn, Timebank, Saldo, Fravær). Then a hardcoded payslip section. Then "Arbeidskontrakt" + "Personvern" quick links. Three layers of identity (earnings + contract + privacy) one click apart but with no visual hierarchy. Payroll sub-screens go 3 levels deep: Min Tid → Payroll → Payslip → Payslip Detail.

### Duplication inventory

| Surface | Implementation A | Implementation B |
|---------|-----------------|-----------------|
| Punch-clock | `(home)/punch-clock.tsx` (live, incomplete) | `ShiftClockView.tsx` (orphan, complete) |
| During-shift | `DuringShiftView.tsx` (V1, live) | `DuringShiftView.v2.tsx` (flagged, gradient hero) |
| Schedule view | `(shifts)/index.tsx` (live, list) | `(calendar)/index.tsx` (hidden, time-grid) |
| Helpdesk inbox | `(chat)/index.tsx` Skranke segment (live) | `(komm)/index.tsx` (hidden, legacy) |

Four parallel implementations. None are bugs in isolation but together they signal an unfinished migration. User testing the app cannot tell which surface is canonical without reading code comments.

### Cognitive load

Hjem forces user to scan ActionBar (4 buttons) + phase content + ShiftCard + NotificationBell + Menu icon + FAB. That's 8 interactive zones above the fold. Nordic Split's 40% Reduction Principle not applied — too many boxes, not enough space.

### Missing flows

- **No dedicated "next shift" lockscreen-equivalent.** Phase-aware Hjem handles this but only after user has chosen to open Hjem. Notification deep-links into a specific shift not mapped.
- **No quick-action surface for during-shift tools.** HACCP, temp deviation, safety round all live in `/(home)/*` as sibling pages. A cook logging temp during prep — should be a sheet, not a navigation push.
- **No streak / readiness gamification.** Training readiness in Cascade model (D2) but no surface in mobile app shows "you are X% ready" or "complete this protocol to unlock next shift's role."
- **No team pulse** — who's on shift with me, who's duty leader, who's sick. Data exists (`useShiftColleagues`, `useDutyLeader`) but fragmented across BeforeShiftView + DuringShiftView only.
- **No earnings real-time tick during shift.** Timebank ticks up by the hour during a worked shift — data exists but not surfaced. Massive missed engagement hook.
- **No deep-link entry for `(shifts)/proposed-plan` or `journey/[id]/guided`.** Push-notification-only routes; without push wired, unreachable.

### ADR drift

- ADR-0268 specifies tab order Kalender · Vakter · FAB · Chat · Min Tid. Reality: Hjem replaces Kalender. ADR-0268 not amended.
- ADR-0133 bans authoring on mobile. `(shifts)/create.tsx` is a shift-creation form (an Author verb). Borderline non-compliance.

---

## 3. Key UX Issues — Ranked

1. **Hjem is too crowded.** Both a status surface AND a tool hub. Two purposes conflict. Phase-aware view is the right surface; 17 child routes are wrong tenants.
2. **Settings belongs in Min Tid, not Hjem.** Identity, account, privacy, contract — all "me" concerns.
3. **Punch-clock should not be a destination.** It's a state transition embedded in DuringShiftView, with FAB as the trigger.
4. **Vakter + Calendar overlap with no clear winner.** One must absorb the other.
5. **FAB gestures undiscoverable.** Tap should be primary. Voice should be a long-press, not a double-swipe.
6. **ActionBar mixes tab destinations.** Either keep inside one tab or remove entirely.
7. **Min Tid payroll too deep.** 3 stack pushes to reach payslip detail.
8. **Tasks/HACCP/Safety should be contextual sheets during shift, not separate pages.**
9. **Training buried in Hjem.** Should be under Min Side as "Min Læring" — personal readiness surface.
10. **Notifications are a sheet, not a feed.** No persistent inbox; transient info loss.

---

## 4. After — Recommended Sitemap (Nå · Plan · FAB · Chat · Meg)

### Tab structure — same count (5), new semantics

| Slot | New | Was | Norwegian rationale |
|------|-----|-----|--------------------|
| 1 | **Nå** | Hjem | "Now" — phase-aware status. Means "right now." Shift worker grammar. |
| 2 | **Plan** | Vakter | "Plan" — week ahead, swap, marketplace. Same word in NO/EN. |
| 3 | FAB | FAB | Context-aware. Tap = primary action this moment. Long-press = Botsson voice. |
| 4 | **Chat** | Chat | Unchanged. Channels + Skranke. |
| 5 | **Meg** | Min Tid | "Me" — identity tab. Contract, training, payroll, settings. |

Five-tab + FAB matches Apple/Google "primary destinations." User predicts where every feature lives.

### Tab 1 — Nå (phase-aware status)

Single phase-aware surface. Zero child routes EXCEPT the contextual sheets. No ActionBar. No Settings.

```
Nå/
  index.tsx              phase switcher (existing — REUSE)
    NoShiftView          existing component — REUSE
    BeforeShiftView      existing component — REUSE
    DuringShiftView      existing component — REUSE (consolidate w/ v2 — see Decision D2)
    AfterShiftView       existing component — REUSE
  punch-clock.tsx        keep route, but render orphan ShiftClockView (Decision D3)
  clockout.tsx           keep route (push-deep-link target)
```

All operational tools (HACCP/temp/safety/deviation) become BOTTOM SHEETS triggered from DuringShiftView, NOT separate stack pushes.

**Reuse mandate:**
- `src/components/home/NoShiftView.tsx` — unchanged
- `src/components/home/BeforeShiftView.tsx` — unchanged
- `src/components/home/DuringShiftView.tsx` — add `<HACCPSheet>` / `<TempDevSheet>` / `<SafetySheet>` / `<DeviationSheet>` trigger buttons
- `src/components/shift-clock/ShiftClockView.tsx` — the orphan. Mount it.

**REMOVE:**
- Stack.Screen registrations from `(home)/_layout.tsx` for: `deviation`, `haccp`, `safety-round`, `temp-deviation` (these screens become sheets)
- Route files: `(home)/deviation.tsx`, `(home)/haccp.tsx`, `(home)/safety-round.tsx`, `(home)/temp-deviation.tsx` AFTER porting their JSX into sheet wrappers
- ActionBar from `(home)/index.tsx` render path

**CHANGE:**
- `(home)/punch-clock.tsx` — replace inline implementation with `<ShiftClockView />` import (one-file change, kills orphan duplication)
- `(home)/_layout.tsx` — rename group `(home)` → `(now)` (cascade through router push targets)

**ADD:**
- `src/components/now-sheets/HACCPSheet.tsx` — wraps existing HACCP form JSX in `<BottomSheetModal>`
- `src/components/now-sheets/TempDevSheet.tsx` — same pattern
- `src/components/now-sheets/SafetySheet.tsx` — same pattern
- `src/components/now-sheets/DeviationSheet.tsx` — same pattern
- These wrappers reuse 100% of existing form JSX — only the chrome changes

### Tab 2 — Plan (Vakter + Calendar merged)

Consolidate the two surfaces. Calendar's time-grid becomes a toggle inside Plan.

```
Plan/
  index.tsx              week list (current Vakter, REUSE)
  calendar-toggle/       NOT a route — a view-mode switch inside index.tsx
                         WeekStrip + ItemCard render conditionally
  [id].tsx               shift detail (REUSE)
  swap.tsx               REUSE
  marketplace.tsx        REUSE
  proposed-plan.tsx      REUSE (push deep-link target)
```

**Reuse mandate:**
- `(shifts)/index.tsx` — keep structure, add view-mode toggle
- `src/components/calendar/WeekStrip.tsx` — import into `(shifts)/index.tsx`
- `src/components/calendar/ItemCard.tsx` — import into `(shifts)/index.tsx`
- `src/components/calendar/FilterChips.tsx` — already in `(shifts)`, no change
- `src/components/calendar/DetailSheet.tsx` — import into `(shifts)/index.tsx`

**REMOVE:**
- Entire `(calendar)/` route group: `(calendar)/index.tsx`, `(calendar)/month.tsx`, `(calendar)/day/[date].tsx`, `(calendar)/_layout.tsx`
- Hidden tab registration: `<Tabs.Screen name="(calendar)" options={{ href: null }} />` in `(app)/_layout.tsx`

**CHANGE:**
- `(shifts)/_layout.tsx` — rename `(shifts)` → `(plan)` group
- `(shifts)/index.tsx` — add view-mode state (`"list" | "grid"`), conditional render block
- Existing nav targets pointing at `/(app)/(shifts)/...` → update to `/(app)/(plan)/...`

**ADD:**
- Nothing new on disk. View-mode toggle is in-place state.

**DECISION REQUIRED — D1:**
`(shifts)/create.tsx` is an Author verb (creating a shift on mobile). ADR-0133 §"Author/Compose/Plan verbs stay web-only" bans this.
- Option A: delete `(shifts)/create.tsx` entirely (manager creates shifts on web)
- Option B: keep, file ADR-0133 amendment ADR explicitly authorizing manager-role shift creation on mobile
- Recommendation: A (delete). Web has full schedule editor.

**DECISION REQUIRED — D2:**
`(shifts)/roster.tsx` — manager-only roster grid. Borderline (read-only view, but manager context).
- Option A: keep as read-only
- Option B: delete (managers use web dashboard for roster grid)
- Recommendation: A (keep) — read-only roster is a useful at-a-glance for shift leads on the floor.

### Tab 3 — FAB

| Gesture | Action |
|---------|--------|
| Tap, off-shift | Open Botsson voice + chat sheet |
| Tap, on-shift | Open `ShiftClockView` (punch sheet) |
| Long-press | Open Botsson voice always |

**Reuse mandate:**
- `src/components/AIFab/*` — keep gesture detection, change handler routing
- `src/components/BotssonSheet.tsx` — REUSE as sheet (already exists)
- `src/components/shift-clock/ShiftClockView.tsx` — REUSE as a sheet target

**REMOVE:**
- `AddSheet` mount in `(app)/_layout.tsx:54` — unless AddSheet has a real authoring purpose (audit before delete)
- Double-swipe gesture handler in AIFab — collapse to single tap + long-press

**CHANGE:**
- `(app)/_layout.tsx` — AIFab tap handler:
  - if `useShiftPhase() === "during_shift"` → open ShiftClockView sheet
  - else → open BotssonSheet
- Long-press always opens BotssonSheet voice mode

**ADD:**
- Nothing new on disk.

**DECISION REQUIRED — D3:**
`punch-clock.tsx` route stays (push-deep-link target from notifications + shift detail) or dies (FAB sheet is the only way in)?
- Option A: keep route, route renders `<ShiftClockView />`. Both FAB sheet AND deep-link arrive at same surface.
- Option B: delete route, all entry through FAB sheet only.
- Recommendation: A (keep). Deep-link compatibility matters.

### Tab 4 — Chat

Unchanged. Channel list + Skranke segment + new conversation sheet.

**Reuse mandate:**
- `(chat)/index.tsx` — no change
- `(chat)/[id].tsx` — no change
- `(chat)/settings.tsx` — no change
- `(chat)/_layout.tsx` — no change

**REMOVE:**
- `(komm)/` route group entirely (superseded per ADR-0165, hidden anyway)
- `(queue)/` route group entirely (legacy, hidden)
- Hidden Tabs.Screen registrations for both in `(app)/_layout.tsx`

**CHANGE:**
- Nothing.

**ADD:**
- Nothing.

**DECISION REQUIRED — D4:**
Rename "Skranke" → "Hjelp" or "Spør"? Skranke is Norwegian for reception desk; many shift workers won't link it to internal helpdesk.
- Recommendation: rename to "Hjelp" (Help). Single string change in i18n + segment selector.

### Tab 5 — Meg (everything about me)

Subsumes current Min Tid + Hjem's identity routes.

```
Meg/
  index.tsx              hub (REUSE current Min Tid index, restructured cards)
  payroll/               REUSE entire sub-stack
    index, payslip, payslip-detail, timebank, absence-balance,
    absence-request, supplements, lonnsgrunnlag-detail
  contract/              REUSE
    index, [id], complete-data
  training/              MOVED from Hjem
    index               REUSE current (home)/training.tsx
    course-detail       REUSE current (home)/course-detail.tsx
    flow-player         REUSE current (home)/flow-player.tsx
  team/                  MOVED from Hjem
    index               REUSE current (home)/team.tsx
    [id]                REUSE current (home)/team/[id].tsx
  notifications.tsx      REUSE
  settings.tsx           MOVED from Hjem (REUSE file)
  edit-profile.tsx       MOVED from Hjem (REUSE file)
  availability.tsx       MOVED from Hjem (REUSE file)
  channel-detail/[id]    REUSE
  design-preview.tsx     gate behind __DEV__ or delete
```

**Reuse mandate:** every file moved between groups is a `git mv` — no rewrite. Imports and route push targets update; component bodies don't.

**REMOVE:**
- Stack.Screen registrations from `(home)/_layout.tsx` for: `training`, `course-detail`, `flow-player`, `team`, `settings`, `edit-profile`, `availability`, `spokesperson-approval` (moved)
- ActionBar from `(me)/index.tsx` if rendered there (verify in code first)

**CHANGE:**
- `git mv` for each moved file: `(home)/training.tsx` → `(me)/training/index.tsx`, etc.
- Add corresponding Stack.Screen registrations in `(me)/_layout.tsx`
- Update every `router.push` and `<Link>` target in the codebase from `/(app)/(home)/{training,team,settings,...}` → `/(app)/(me)/{training,team,settings,...}`
- `(me)/index.tsx` — restructure stat grid + bento layout to surface: readiness (training), money (payroll), contract, settings — in that visual order

**ADD:**
- Nothing new on disk. All reused.

**DECISION REQUIRED — D5:**
`(me)/design-preview.tsx` — keep behind `__DEV__` flag, or delete? Currently always-accessible-via-push.
- Recommendation: gate behind `__DEV__` (Pontus's QA tool stays available in dev).

### Tab semantics — what STAYS

Hidden routes that survive as push-deep-link targets only (no in-app entry, kept for notification handlers):
- `(plan)/proposed-plan.tsx`
- `journey/[id]/guided.tsx`
- `(now)/clockout.tsx` (deep-link `smartout://clockout?sessionId=...`)

These already have `href: null` or no in-app entry. No change needed — verify `app.json` / `app.config.ts` `expo.scheme` is set for `smartout://` deep links.

---

## 5. Rationale for Most Important Changes

### Why 5 tabs but new semantics

Five-tab bar works for content apps and works here. Switching tab MEANING (not tab COUNT) is the cheaper move. User mental model becomes sharper: I'm checking status (Nå), planning (Plan), chatting (Chat), managing myself (Meg). Calendar/Vakter overlap resolves under Plan. ADR-0268 amends to reflect new tab order.

### Why Nå has no operational children

Status surface succeeds when simple. Adding 17 child routes turned Hjem into a tool hub. Moving tools to contextual sheets (HACCP, temp, safety, deviation triggered from DuringShiftView via `BottomSheetModal`) keeps user's context intact. Punch-clock embedded eliminates the duplicate-with-divergence problem — `ShiftClockView` becomes canonical, `punch-clock.tsx` route renders it, FAB sheet renders it. One surface, three entry points.

### Why Settings moves to Meg

Settings is an identity concern, not a moment-concern. Current cross-tab navigation (Min Tid's "Personvern" → Hjem's settings) breaks the mental model. Moving Settings under Meg makes the tab self-contained: every "about me" surface lives in one tab. `git mv` operation — zero file rewrites.

### Why FAB collapses to 2 gestures

Context-aware single-tap follows Material Design FAB guideline: one primary action per screen. Off-shift, primary action = "talk to Botsson." On-shift, primary action = "clock in/out/break." Long-press = always-voice for power users. AddSheet swipe-L1 layer dies unless audit shows real authoring purpose (probably it doesn't, per ADR-0133 mobile-executes mandate).

### Why training moves under Meg

Training is a readiness investment ("how prepared am I?"), not a daily-moment concern ("what's happening now?"). Under Meg as "Min læring" matches user's mental model — personal progression, like payroll. Creates coherent readiness narrative: my contract, my training, my hours, my pay all in one tab.

### Why HACCP/temp/safety become sheets

A cook logging fridge temp during prep should not lose context. Pushing them to `/(home)/temp-deviation` exits during-shift view, breaks workflow, forces back-navigation. A bottom sheet appears, accepts data, dismisses, leaves cook exactly where they were. WFM-specific UX win — "execute without exit."

---

## 6. Migration Path — 5 Sorties, Each ≤4h

Every sortie touches existing files. New files added ONLY for sheet wrappers (Sortie 1) which are thin shells around existing form JSX.

### Sortie UX-01 — Tools as sheets (Nå clean-up)
**Effort:** M (4h)
**Files touched:**
- `apps/mobile/app/(app)/(home)/_layout.tsx` (remove 4 Stack.Screens)
- `apps/mobile/src/components/home/DuringShiftView.tsx` (add 4 sheet triggers)
- 4 new files: `src/components/now-sheets/{HACCP,TempDev,Safety,Deviation}Sheet.tsx` (wrap existing JSX in `<BottomSheetModal>`)
- 4 old files: `(home)/{deviation,haccp,safety-round,temp-deviation}.tsx` — JSX ported into sheets, files DELETED

**Reuse:** 100% of existing form JSX. Only chrome (page header → sheet handle) changes.
**Risk:** Low. Sheets reuse `@gorhom/bottom-sheet` already in deps.
**Outcome:** Cook logs temp without leaving DuringShiftView.

### Sortie UX-02 — Punch-clock consolidation
**Effort:** S (1h)
**Files touched:**
- `apps/mobile/app/(app)/(home)/punch-clock.tsx` (rewrite to `return <ShiftClockView />`)
- `apps/mobile/src/components/shift-clock/ShiftClockView.tsx` (verify props, no changes expected)

**Reuse:** Orphan `ShiftClockView` becomes live. Inline implementation deleted.
**Risk:** Low. ShiftClockView is feature-complete and tested.
**Outcome:** One punch-clock surface. Break toggle + SupplementSheet + GPS guard available.

### Sortie UX-03 — Plan tab (Vakter rename + Calendar absorb)
**Effort:** M (3h)
**Files touched:**
- Rename `apps/mobile/app/(app)/(shifts)/` → `(plan)/` (git mv on directory)
- `apps/mobile/app/(app)/(plan)/index.tsx` (add view-mode toggle, conditional WeekStrip render)
- Delete `apps/mobile/app/(app)/(calendar)/` entire directory
- `apps/mobile/app/(app)/_layout.tsx` (rename Tabs.Screen + remove hidden Calendar registration)
- Update all `router.push("/(app)/(shifts)...")` → `/(app)/(plan)/...` repo-wide (grep + sed)

**Reuse:** `WeekStrip`, `ItemCard`, `FilterChips`, `DetailSheet` imported into Plan/index.
**Risk:** Med — repo-wide grep needs verification. Test deep-links don't break.
**Outcome:** Single planning surface, two views (list + grid). Calendar dead code purged.

### Sortie UX-04 — Meg tab (Min Tid rename + move identity files)
**Effort:** M (4h)
**Files touched:**
- Rename `apps/mobile/app/(app)/(me)/` group identity in `_layout.tsx` (label "Meg" not "Min Tid")
- `git mv` for: `(home)/training.tsx`, `(home)/course-detail.tsx`, `(home)/flow-player.tsx`, `(home)/team.tsx`, `(home)/team/[id].tsx`, `(home)/settings.tsx`, `(home)/edit-profile.tsx`, `(home)/availability.tsx`, `(home)/spokesperson-approval.tsx` → `(me)/...`
- Add corresponding Stack.Screen registrations in `(me)/_layout.tsx`
- Remove same registrations from `(home)/_layout.tsx`
- Update repo-wide `router.push` targets

**Reuse:** Every moved file is a `git mv`. Zero rewrites.
**Risk:** Med — large grep+update surface. Run typecheck after each batch.
**Outcome:** "About me" surfaces all under one tab. ActionBar removed.

### Sortie UX-05 — Tab rename + FAB simplify
**Effort:** S (2h)
**Files touched:**
- Rename `(home)` → `(now)` (final cascade through `_layout.tsx` + push targets)
- `apps/mobile/app/(app)/_layout.tsx` — Tabs.Screen labels: "Nå", "Plan", "Chat", "Meg"
- `apps/mobile/src/components/AIFab/*` — collapse double-swipe, add context-aware tap handler
- Drop `AddSheet` mount unless audit reveals authoring purpose
- ADR-0268 amendment file: `docs/decisions/0268-amendment-tab-order-2026-05-15.md`

**Reuse:** AIFab gesture infra; BotssonSheet; ShiftClockView (already consolidated in UX-02).
**Risk:** Low — visual + label change. FAB handler is one routing branch.
**Outcome:** Final tab semantics live. ADR-0268 amended. ShiftCard mental model intact.

---

## 7. What Stays the Same

- **Auth flow** — welcome → verify → workspace-select → home. Clean. No changes.
- **Chat tab structure** — keep. Possibly rename Skranke → Hjelp (D4).
- **Payroll sub-stack** — works. Possibly flatten depth in a future sortie.
- **Contract sub-stack** — works. Migrate to TanStack Query later (Sortie M-03 from `09-recommendations.md`).
- **Nordic Split design system** — applies as-is. No visual rebrand.
- **Telemetry contracts (ADR-0134)** — every existing `emit()` call survives.
- **BFF routing (ADR-0132)** — every existing `/api/emma/chat` call survives.

---

## 8. Required Decisions Before Sortie Kickoff

Five product/architecture decisions Pontus owns:

| # | Decision | Recommended | Why |
|---|---------|-------------|-----|
| D1 | Delete `(shifts)/create.tsx` (Author-verb violates ADR-0133)? | DELETE | Web has full schedule editor |
| D2 | Promote `DuringShiftView.v2` to default + delete V1? | YES | One implementation, ship gradient hero |
| D3 | Keep `punch-clock.tsx` route as deep-link target after FAB consolidation? | KEEP | Push notifications need a target |
| D4 | Rename "Skranke" → "Hjelp"? | YES | Clearer mental model for shift workers |
| D5 | Gate `(me)/design-preview` behind `__DEV__` or delete? | GATE `__DEV__` | Keeps QA tool available in dev only |

Plus one infrastructure check:
- **`app.json` / `app.config.ts`** — verify `expo.scheme: "smartout"` is set so `smartout://clockout?sessionId=...` deep links work after route renames.

---

## 9. Engagement Heuristics Score

Score each tab on 5 axes (1 = poor, 5 = excellent). Identifies where to invest.

| Surface | Glanceability | Trust | Discoverability | Speed | Reward | Score |
|---------|---------------|-------|-----------------|-------|--------|-------|
| Hjem (current) | 3 | 4 | 2 | 4 | 2 | 15/25 |
| Nå (proposed) | 5 | 5 | 4 | 5 | 4 | 23/25 |
| Vakter (current) | 4 | 4 | 3 | 4 | 2 | 17/25 |
| Plan (proposed) | 5 | 4 | 5 | 4 | 3 | 21/25 |
| Chat (current) | 4 | 4 | 4 | 5 | 3 | 20/25 |
| Min Tid (current) | 3 | 4 | 3 | 3 | 4 | 17/25 |
| Meg (proposed) | 4 | 4 | 5 | 4 | 5 | 22/25 |
| FAB (current) | 2 | 3 | 1 | 3 | 2 | 11/25 |
| FAB (proposed) | 4 | 5 | 4 | 5 | 4 | 22/25 |

Biggest wins: **FAB (+11)**, **Nå (+8)**, **Meg (+5)**.

---

## 10. Micro-Interaction Wins (no restructure required)

Polish-level changes that ship independent of sorties UX-01 through UX-05. Apply Nordic Split motion tokens.

### Loading states
- `(shifts)/index.tsx` "Laster vakter…" text → skeleton DayCrewCluster (greyed bars matching real shape). Reuse motion `springGentle` for shimmer.
- `(me)/payroll/index.tsx` ActivityIndicator → skeleton bento cards.
- All `ActivityIndicator` instances → replace with skeleton matching the would-be content shape.

### Empty states ("vakter laster ikke" root cause)
- `(shifts)/index.tsx` — when `!isLoading && !error && shifts.length === 0`, currently 7 empty DayCrewClusters. **ADD** screen-level empty state: illustrated icon + "Ingen vakter denne uken" + CTA "Se ledige vakter" → marketplace.
- Same pattern for `(me)/payroll/payslip.tsx`, `(me)/payroll/supplements.tsx`.

### Haptic feedback
- Audit `Haptics.selectionAsync()` calls — present in Menu icon (good), missing on most tab presses (silent).
- **ADD** `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` to: tab change, swap shift, claim marketplace shift, confirm shift, punch in/out.
- **ADD** `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` on: payslip viewed, course completed, shift confirmed, absence approved.

### Animation gaps
- ShiftCard tap → use `motionTokens.springSnappy` (already in tokens) for press scale.
- Tab transition — use `motionTokens.spring` (35/22/2.2) — currently default.
- Phase view swap (NoShift → BeforeShift) — add `FadeIn`/`FadeOut` from `react-native-reanimated` with `motionTokens.enterMs` / `exitMs`.

### Typography hierarchy
- Nå index — phase view title currently same size as body. **CHANGE** to Instrument Serif `font-heading`, 32pt, letter-spacing -0.5 (matches "Smartout" brand name pattern).
- Stat cards across Meg — use Geist Mono for numbers (timebank balance, hours), Geist Sans for labels.

### 40% Reduction Principle
- Nå index top bar — currently Menu + brand + NotificationBell = 3 elements. **REMOVE** brand name (Smartout) — user already knows what app this is. Replace with empty space + slight orb glow ambient.
- ShiftCard borders — `border-border` 1px around card. **REMOVE** border, replace with `bg-muted` 1pt elevation only. Lighter visual weight.

---

## 11. Open Questions

1. **AddSheet purpose** — does swipe-L1 AddSheet have a real authoring use case? If yes, ADR-0133 exception needed. If no, delete entirely.
2. **Botsson voice surface** — is long-press FAB the right voice trigger, or should there be a dedicated orb in the FAB itself (always-on voice with tap-to-talk)?
3. **Notifications as inbox** — replace bottom-sheet pattern with persistent inbox under Meg/notifications? Or keep transient sheet?
4. **Calendar time-grid** — valuable enough as a Plan-tab toggle, or can list view replace it entirely? Test with restaurant managers.
5. **Min læring readiness score** — surface as primary KPI on Meg hub (motivating gamification), or stay as a sub-stack (purely functional)?

These are product-level. Address before Sortie UX-04.

---

## 12. TL;DR — Before vs After

| | Before | After (v3) | Reuse strategy |
|---|--------|-----------|---------------|
| Tabs | Hjem · Vakter · FAB · Chat · Min Tid | Nå · Plan · FAB · Chat · Meg | Rename groups, no new routes |
| Hjem children | 17 routes | 2 routes + 4 sheets | `git mv` 9 files to Meg, port 4 to sheets |
| Calendar | Hidden, abandoned | Plan-tab view toggle | Import existing `WeekStrip` + `ItemCard` |
| Punch-clock | 2 implementations | 1 (orphan promoted) | `<ShiftClockView />` is canonical |
| Settings location | Under Hjem (cross-tab) | Under Meg (self-contained) | `git mv` only |
| Training location | Under Hjem | Under Meg as "Min læring" | `git mv` only |
| Tools (HACCP/temp/safety) | Separate routes | Contextual bottom sheets | Sheet wrappers around existing JSX |
| FAB gestures | 3 (tap, swipe-1, swipe-2) | 2 (tap context-aware, long-press) | AIFab handler refactor |
| ActionBar | Cross-tab, breaks tabs semantics | Removed | Delete render call in `(home)/index.tsx` |
| ADR-0268 status | Drifted | Amended ADR matches code | New amendment ADR |
| Skranke naming | "Skranke" | "Hjelp" | i18n string change |

Result: WFM mobile app that respects the shift worker's tempo. Status answers itself in 2 seconds. Tools surface in context. Identity, money, learning are one tab away. Nothing buried, nothing duplicated.

Total file additions: 4 sheet wrappers + 1 amendment ADR.
Total file deletions: ~10 (Calendar group + 4 tool routes + Komm + Queue + `(shifts)/create` pending D1).
Total file moves: ~10 (`git mv` only, zero rewrites).

---

## 13. Decision Form for Pontus

Reply YES/NO/MODIFY per item. Block of decisions unblocks sortie kickoff.

```
D1 — Delete (shifts)/create.tsx?           [ ] YES  [ ] NO  [ ] MODIFY
D2 — Promote DuringShiftView.v2 default?    [ ] YES  [ ] NO  [ ] MODIFY
D3 — Keep punch-clock.tsx route?            [ ] YES  [ ] NO  [ ] MODIFY
D4 — Rename Skranke → Hjelp?                [ ] YES  [ ] NO  [ ] MODIFY
D5 — Gate design-preview behind __DEV__?    [ ] YES  [ ] NO  [ ] MODIFY

Sortie order (default UX-01 → UX-05, parallelizable: UX-01+UX-02, UX-03+UX-04)
[ ] Approve default order
[ ] Modify: ________________________________
```
