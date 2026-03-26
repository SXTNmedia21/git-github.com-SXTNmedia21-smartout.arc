---
title: "Mobile Production Readiness — Complete Journey Design"
status: review
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, walkAi, journeys, production, v1.0]
---

# Mobile Production Readiness — Complete Journey Design

## 1. Vision & Scope

Build the world's most effective workforce management mobile app for shift-based businesses in Norway. The app is **role-adaptive** (employee in v1.0, shift leader and manager in v1.1), **hub-and-spoke** (home screen knows what you should do next), and **WalkAi-powered** (voice AI as first-class interaction model).

### Launch Gate (v1.0)

**Journey-complete for employee.** An employee can do _everything_ from day 1 to daily operations:

- Onboard (accept invite, join workspace)
- View schedule, punch in/out, manage breaks
- Complete tasks, HACCP checks, deviation reports
- Chat with team, talk to WalkAi (voice + text)
- View payroll, request absence, check timebank
- Receive and act on push notifications

### v1.1 Scope (not in this spec)

- Training/readiness journeys (WalkAi-driven trainee mode)
- Per-role authority model (requires ADR — `engine_authority_config` currently per-workspace, not per-role)
- Shift Leader views: approve hours, session signoff, team status, deviation handling (note: "shift leader" is `team.leader_profile_id`, NOT a `profile_role` enum value)
- Manager views: daily overview, schedule approval, KPI dashboard

### Deployment Strategy

**Expo Web first** (PWA), then App Store/Google Play. React Native runs as a wrapped webapp initially. This means:

- Ultravox WebRTC SDK works in browser context — no native WebRTC concerns in v1.0
- PWA install prompt for "add to home screen" experience
- Native build follows when App Store approval is ready
- **PWA limitation:** Push notifications via `expo-notifications` are native-only. PWA users get in-app notification polling as fallback for J2. Full push requires native build.

---

## 2. Architecture Decisions

### 2.1 Hub-and-Spoke Navigation

Home screen is the **hub** — it always knows what the user should do next based on role, shift phase, pending tasks, and notifications. All journeys are **spokes** launched from the hub. WalkAi is always available as a parallel spoke via FAB.

```
Home Hub (context-aware priority list)
  +-- "Punch in om 32 min" --> Shift spoke
  +-- "2 HACCP-kontroller" --> Task spoke
  +-- "3 uleste meldinger" --> Chat spoke
  +-- WalkAi FAB --> Voice/text spoke (always available)
```

### 2.2 WalkAi Integration

| Decision       | Choice                                            | Rationale                                          |
| -------------- | ------------------------------------------------- | -------------------------------------------------- |
| Session mode   | `agent` (free-form, `mission_id = NULL`)          | v1.0 has no structured training missions           |
| Voice provider | Ultravox via browser WebRTC                       | Expo Web deployment means browser context          |
| Context        | `collectContext()` injection                      | Shift phase, role, tasks, department — no stages   |
| Capabilities   | Shared backend (`packages/ai/src/capabilities/`)  | Same capabilities serve web + mobile               |
| Client tools   | Mobile-specific prefix (`mobile_*`)               | Avoids collision with web tools                    |
| Authority      | Per-workspace defaults (v1.0 = read_only for all) | Per-role authority deferred to v1.1 (requires ADR) |

### 2.3 Role-Adaptive UI

Same app, different perspectives. The app adapts based on `profile.role` (`employee | manager | admin | owner`).

**v1.0 implements employee perspective only.** All users see the employee view. Role-adaptive expansion is v1.1.

**Note on "Shift Leader":** This is NOT a `profile_role` value. Leadership is determined by `team.leader_profile_id` — a team attribute, not a role. v1.1 will add a runtime check `isTeamLeader(profileId)` for leader-specific views. Requires ADR for authority model.

| Element       | Employee (v1.0)                | Manager/Leader (v1.1)                               |
| ------------- | ------------------------------ | --------------------------------------------------- |
| Home Hub      | My shifts, my tasks, my status | + Team status, pending approvals                    |
| WalkAi tools  | read_only                      | + suggest/confirm (requires per-role authority ADR) |
| Tab content   | Personal schedule              | + Team schedule overlay                             |
| Notifications | My shifts, my tasks            | + Team alerts, deviations                           |

### 2.4 Context-Triggered Management (v1.1 architecture)

During active department session (D6), shift leaders see expanded capabilities:

- Approve hours
- Handle deviations
- Session signoff
- Team status (who's clocked in, who's on break)

Outside session: simplified overview. Architecture must support this from v1.0 even though UI ships in v1.1.

### 2.5 Offline Strategy — Strict Split

| Category           | Offline? | Mechanism                       |
| ------------------ | -------- | ------------------------------- |
| Punch in/out       | Yes      | SQLite write queue              |
| Break start/end    | Yes      | SQLite write queue              |
| Hours confirmation | Yes      | SQLite write queue              |
| Deviation report   | Yes      | SQLite write queue              |
| Absence request    | Yes      | SQLite write queue              |
| Schedule viewing   | Yes      | MMKV read cache (stale OK)      |
| Task list          | Yes      | MMKV read cache                 |
| WalkAi (voice)     | No       | WebRTC requires live connection |
| WalkAi (text)      | No       | Stage Engine requires backend   |
| Chat               | No       | Supabase Realtime               |
| Notifications      | No       | Push delivery requires network  |
| Payroll data       | No       | Sensitive, always fresh         |

**UX rule:** Never show an error for offline. Show contextual messages only when the user tries an online-only action.

---

## 3. User Journeys — Priority Order

### v1.0 Journeys (Launch Gate)

| #   | Journey                   | Trigger                | Online? | Status                            |
| --- | ------------------------- | ---------------------- | ------- | --------------------------------- |
| J1  | Punch in/ut               | Shift start/end        | Offline | Done                              |
| J2  | Push notification → react | Notification arrives   | Online  | **Build: deep links**             |
| J3  | Pre-shift info lookup     | 30-60 min before shift | Online  | **Build: expand BeforeShiftView** |
| J4  | Tasks during shift        | Active session         | Mixed   | Done (needs hub integration)      |
| J5  | Deviation reporting       | Problem occurs         | Offline | Done                              |
| J6  | Chat / reply to message   | Notification or need   | Online  | Done                              |
| J7  | WalkAi — ask AI anything  | Uncertainty, need help | Online  | **Build: voice + text**           |
| J8  | Schedule check            | Want to see upcoming   | Offline | Done                              |
| J9  | Confirm hours             | After shift            | Offline | Done                              |
| J10 | Handoff/shift end         | Shift complete         | Offline | Done                              |
| J11 | HACCP logging             | Scheduled control      | Offline | Done                              |
| J12 | Break management          | During shift           | Offline | Done                              |
| J13 | Payroll overview          | Curiosity              | Online  | Done                              |
| J14 | Absence request           | Need time off          | Online  | Done                              |
| J15 | Komm/PTT                  | Need to talk to team   | Online  | Done                              |
| J16 | Ring leader               | Urgent need            | Online  | **Build: wire tel: link**         |

### Journey Detail: J2 — Push Notification → React

**Trigger:** Push notification arrives (shift reminder, chat message, task assigned, deviation reported, hours to confirm, absence approved).

**Flow:**

1. User receives push notification
2. User taps notification
3. App opens directly to relevant screen via deep link
4. User takes action (view, respond, approve)

**Deep Link Map** (defined in `packages/notifications/`):

| Notification Type    | Target Route                  | Data             |
| -------------------- | ----------------------------- | ---------------- |
| `shift_reminder`     | `/(app)/(shifts)/[id]`        | shift_id         |
| `chat_message`       | `/(app)/(chat)/[id]`          | conversation_id  |
| `task_assigned`      | `/(app)/(home)`               | (hub shows task) |
| `deviation_reported` | `/(app)/(home)/deviation`     | deviation_id     |
| `hours_confirmation` | `/(app)/(shifts)/[id]`        | shift_id         |
| `absence_approved`   | `/(app)/(me)/absence-balance` | —                |
| `komm_message`       | `/(app)/(komm)/[id]`          | channel_id       |

**Implementation:** Shared constant `DEEP_LINK_MAP` in `packages/notifications/src/deep-links.ts`. Backend uses it when constructing notification payload. Mobile uses it in `apps/mobile/src/lib/push.ts` notification handler.

### Journey Detail: J3 — Pre-shift Info Lookup

**Trigger:** 30-60 minutes before shift starts. Home hub shows pre-shift card.

**Flow:**

1. User opens app → hub shows "Ditt skift starter om 45 min"
2. Card expands to show:
   - Shift time + department + position
   - Who else is working (colleague avatars from `useShiftColleagues`)
   - Pending tasks for this session
   - Any department announcements
   - Supplement preview ("~kr 31 kveldstillegg")
3. User can tap colleagues to see detail
4. User can tap tasks to start early
5. "Punch inn" button becomes prominent 15 min before

**Data sources:** `useMyShifts()`, `useShiftColleagues(shiftId)`, `useMyTasks()`, `useDayInfo()`.

**Supplement preview:** MUST use `tariff_rate_table` (cascade D3 source of truth). NEVER use `hospitality.ts` rates (known to be incorrect per CLAUDE.md).

**i18n:** All user-facing strings use `@smartout/i18n` keys via `packages/i18n/locales/nb/mobile.json`. No hardcoded Norwegian.

### Journey Detail: J7 — WalkAi (Voice + Text)

**Trigger:** User taps Botsson FAB (center of tab bar).

**Flow — Voice (default):**

1. User taps FAB → WalkAiSheet opens (bottom sheet, 75% height)
2. Ultravox session starts → status: "connecting"
3. Agent greets based on context: "Hei! Du har skift om 30 minutter. Hva kan jeg hjelpe med?"
4. User speaks → agent responds (voice)
5. Transcript scrolls in real-time
6. Agent can use tools: check schedule, shift colleagues, send messages, create deviations
7. User taps mic to mute/unmute
8. User swipes down or taps X to end session

**Flow — Text (fallback / preference):**

1. User long-presses FAB → BotssonSheet opens (existing bottom sheet, 70% height)
2. `useAgentChat` connects to Stage Engine in agent mode
3. Text conversation with same context injection
4. Same tool access as voice

**Voice UI Components (WalkAiSheet):**

```
+------------------------------------------+
|  [X]              WalkAi              [...] |
+------------------------------------------+
|                                          |
|  Transcript area (scrollable)            |
|  - Agent: "Hei! Du har skift om..."      |
|  - You: "Hvem jobber med meg i dag?"     |
|  - Agent: "I dag jobber du med..."       |
|                                          |
+------------------------------------------+
|                                          |
|  Status indicator:                       |
|  [Orb animation: listening/thinking/     |
|   speaking]                              |
|                                          |
|  [ MIC BUTTON - large, thumb zone ]      |
|                                          |
+------------------------------------------+
```

**Context Injection:**

`collectContext()` in `packages/ai/src/context/collector.ts` returns a rich `AgentContext` (profile, posture, relationship, memories, active shift, time context). The mobile provider adds additional fields by passing them as session params alongside the message:

```typescript
// Additional mobile context (passed as session params, NOT by modifying collectContext)
{
  channel: "mobile",        // NEW: tells agent which client tools are available
  device_type: "phone",     // NEW: device form factor
  shift_phase: "before_shift" | "during_shift" | "after_shift" | "no_shift",  // Computed client-side from useShiftPhase()
  pending_tasks_count: 3,   // Computed client-side from useMyTasks()
  language: "nb"            // For i18n-aware agent responses
}
```

**Note:** `collectContext()` already fetches profile, active shift, and memories server-side. Mobile-specific fields (shift_phase, channel, device_type) are caller-provided, not DB lookups. These are passed as additional context in the chat request body, consumed by the prompt builder.

### Journey Detail: J16 — Ring Leader

**Trigger:** User needs urgent help, taps "Ring leder" in profile/settings.

**Flow:**

1. User navigates to `(me)` tab
2. Taps "Ring leder" button
3. App resolves team leader's phone number from `team.leader_profile_id` → `user_identity.phone`
4. `Linking.openURL('tel:+47XXXXXXXX')`
5. Native phone dialer opens

**Fallback:** If no leader phone → show toast "Ingen leder er tilgjengelig. Bruk chat."

---

## 4. Screen Map — What Needs Building

### Already Complete (no changes)

- Auth flow (welcome, verify, workspace-select, invite)
- Punch clock + flagship animation
- Shifts list + detail
- Break toggle + management
- Handoff form + hours confirmation
- HACCP form + deviation form
- Chat list + conversation + messaging
- Komm/PTT channels
- Payroll (all 6 screens)
- Absence request + balance
- Profile/settings
- Notification list
- Task feed + task modal

### New Screens to Build

| Screen                 | File                                             | Purpose                                                                                                           |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **WalkAiSheet**        | `src/components/ai/WalkAiSheet.tsx`              | Voice AI bottom sheet (75% height) with transcript, status orb, mic button. Extends shared `BottomSheet` wrapper. |
| **Pre-shift Briefing** | Expand `src/components/home/BeforeShiftView.tsx` | Colleagues, tasks, supplements, announcements                                                                     |

### Upgrades to Existing

| Screen               | File                                     | Change                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home Hub**         | `src/components/home/` (all phase views) | Add `prioritizeActions()` function, render priority action list above phase content                                                                                                                                                                                 |
| **BotssonSheet**     | `src/components/ai/BotssonSheet.tsx`     | **Replace** `useBotssonChat` with `useAgentChat` from agent-sdk. This is a full replacement of the chat backend (318-line component). Existing `chat_conversation` rows with `type='ai'` are preserved as history but new conversations route through Stage Engine. |
| **FAB behavior**     | `src/components/navigation/AIFab.tsx`    | Tap → WalkAiSheet (voice), long-press → BotssonSheet (text). **Breaking change:** Replaces current tap=home + swipe-up=QuickActions. QuickActions functionality moves to hub priority cards. Use `Gesture.Exclusive(longPressGesture, tapGesture)`.                 |
| **Deep link router** | `src/lib/push.ts`                        | Add notification type → screen route mapping                                                                                                                                                                                                                        |
| **Ring Leader**      | `app/(app)/(me)/index.tsx`               | Wire button to `Linking.openURL('tel:')`                                                                                                                                                                                                                            |

### New Infrastructure

| Component               | File                                       | Purpose                                                                                                                                                |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **WalkAi Provider**     | `src/providers/walkai-provider.tsx`        | Mobile agent context (shift phase, role, device)                                                                                                       |
| **Mobile Client Tools** | `src/lib/walkai-tools.ts`                  | Global mobile tools for WalkAi agent                                                                                                                   |
| **Deep Link Map**       | `packages/notifications/src/deep-links.ts` | **Migrate** existing map from `apps/mobile/src/lib/push.ts` (5 entries) to shared package, expand with new types, import back. Single source of truth. |
| **Action Prioritizer**  | `src/lib/prioritize-actions.ts`            | Pure function: data sources → sorted action list                                                                                                       |
| **Offline Toast**       | Enhancement to existing sync system        | Contextual "online required" messages                                                                                                                  |

---

## 5. WalkAi Capability Architecture

### 5.1 Backend Capabilities (shared web + mobile)

Built in `packages/ai/src/capabilities/`. Both web and mobile consume these via Stage Engine.

#### `schedule` capability (NEW — wrap existing tools)

| Tool                   | Type | Description                                               |
| ---------------------- | ---- | --------------------------------------------------------- |
| `get_my_shifts`        | read | Employee's upcoming shifts (next N days)                  |
| `get_shift_colleagues` | read | Who works the same shift                                  |
| `get_today_schedule`   | read | Department schedule for today                             |
| `get_shift_detail`     | read | Full shift info (time, position, department, supplements) |

Source: **Net-new server-side tools** using `defineTool()` pattern. Existing `packages/ai/src/tools/schedule/definitions.ts` contains Ultravox client-side tools (`ScheduleClientToolDefinition` with `client: {}`), NOT backend `SmartoutTool<AgentToolContext>`. Cannot be wrapped — must be built from scratch with Zod schemas and `execute()` functions querying Supabase via `ctx.workspaceId`.

#### `operations` capability (NEW)

| Tool                    | Type    | Description                                                 |
| ----------------------- | ------- | ----------------------------------------------------------- |
| `get_my_tasks`          | read    | Pending tasks for current session/shift                     |
| `get_session_info`      | read    | Current department session status                           |
| `get_department_status` | read    | Department state (open/closed, active staff, pending tasks) |
| `create_deviation`      | suggest | Report a work deviation                                     |
| `complete_task`         | suggest | Mark a task as done                                         |

#### `communication` capability (NEW)

| Tool                | Type    | Description                           |
| ------------------- | ------- | ------------------------------------- |
| `get_conversations` | read    | List active conversations             |
| `get_unread_count`  | read    | Unread messages across channels       |
| `send_message`      | suggest | Send a text message to a conversation |

### 5.2 Mobile Client Tools (mobile-only)

Defined in `apps/mobile/src/lib/walkai-tools.ts`. Registered via mobile WalkAi provider.

| Tool Name            | Description                                   | Action                    |
| -------------------- | --------------------------------------------- | ------------------------- |
| `mobile_navigate_to` | Navigate to a screen in the app               | `router.push(route)`      |
| `mobile_open_sheet`  | Open a bottom sheet (punch, deviation, HACCP) | Sheet ref control         |
| `mobile_show_toast`  | Show a toast message                          | Sonner/toast API          |
| `mobile_start_punch` | Trigger punch in/out flow                     | Navigate to punch clock   |
| `mobile_call_leader` | Call the team leader                          | `Linking.openURL('tel:')` |

### 5.3 Authority Defaults (v1.0 — Per-Workspace)

Stored in `engine_authority_config` with `UNIQUE(workspace_id, capability)`. One level per workspace per capability — NOT per-role (per-role authority requires v1.1 ADR).

**v1.0:** All capabilities default to `read_only` for all users (employee-only release).

| Capability      | v1.0 Default | v1.1 Plan                                       |
| --------------- | ------------ | ----------------------------------------------- |
| `schedule`      | read_only    | Per-role (employee=read_only, manager=suggest)  |
| `operations`    | read_only    | Per-role                                        |
| `profile`       | read_only    | read_only (unchanged)                           |
| `communication` | read_only    | Per-role (employee=suggest, manager=autonomous) |
| `guardian`      | read_only    | Per-role                                        |

Default when no config row: `read_only` (matches `tool-selector.ts`).

**Note:** `agent-router.ts` defaults to `suggest` while `tool-selector.ts` defaults to `read_only`. This is a pre-existing inconsistency to be fixed (align to `read_only`).

### 5.4 Tool Name Collision Prevention

Web and mobile have separate client-side tool registries:

- Web: `web_navigate_to`, `web_fill_field`, `web_open_panel`
- Mobile: `mobile_navigate_to`, `mobile_open_sheet`, `mobile_show_toast`

Stage Engine knows the channel (`mobile` vs `web`) from session context. Agent prompt includes only relevant client tools based on channel.

---

## 6. Smart Home Hub Design

### Priority Engine

Pure function `prioritizeActions()` in `apps/mobile/src/lib/prioritize-actions.ts`:

```typescript
type HubAction = {
  id: string;
  type: "punch" | "task" | "alert" | "shift_upcoming" | "message" | "info";
  priority: number; // 1 = highest
  title: string;
  subtitle?: string;
  route?: string; // deep link target
  urgency: "immediate" | "soon" | "info";
};

function prioritizeActions(
  shiftPhase: ShiftPhase,
  activeShift: Shift | null,
  nextShift: Shift | null,
  tasks: Task[],
  guardianSignals: Signal[],
  unreadCount: number,
  activeTimeEntry: TimeEntry | null,
): HubAction[];
```

**Priority order:**

| Priority | Condition                        | Action shown                              |
| -------- | -------------------------------- | ----------------------------------------- |
| 1        | During shift + no punch          | "Punch inn naa"                           |
| 2        | During shift + on break > 30 min | "Pausen har vart i 35 min"                |
| 3        | Overdue tasks (HACCP, deviation) | "Temperaturkontroll er forfalt"           |
| 4        | Guardian signals (active)        | "Avvik rapportert i Kjokken"              |
| 5        | Shift starts within 60 min       | "Ditt skift starter om 45 min"            |
| 6        | Unconfirmed hours from yesterday | "Bekreft timer fra i gar"                 |
| 7        | Unread messages > 0              | "3 uleste meldinger"                      |
| 8        | No shift today                   | "Ingen skift i dag. Neste: torsdag 16:00" |

### Hub Layout

```
+------------------------------------------+
|  HomeHeader (greeting + notification bell)|
+------------------------------------------+
|                                          |
|  Priority Action Cards (FlatList)        |
|  [1. Punch inn naa        -->]           |
|  [2. 2 HACCP-kontroller   -->]           |
|  [3. Skift starter om 45m -->]           |
|                                          |
+------------------------------------------+
|                                          |
|  Phase Content (existing views)          |
|  BeforeShiftView / DuringShiftView /     |
|  AfterShiftView / NoShiftView            |
|                                          |
+------------------------------------------+
|  Tab Bar + FAB                           |
+------------------------------------------+
```

Priority cards appear ABOVE the existing phase content. Phase views remain as secondary context.

---

## 7. Telemetry Requirements

### New Events (must be added to `packages/telemetry/src/registry.ts`)

| Event                             | Category   | Destinations                    | Trigger                                                   |
| --------------------------------- | ---------- | ------------------------------- | --------------------------------------------------------- |
| `agent session_started`           | agent      | posthog, logger, activity_trail | WalkAi voice/text session begins                          |
| `agent session_closed`            | agent      | posthog, logger, activity_trail | WalkAi session closes (uses existing `closed` ActionVerb) |
| `agent tool_called`               | agent      | logger, activity_trail          | Agent executes a tool                                     |
| `notification deep_link_followed` | navigation | posthog, logger                 | User taps push → deep link resolves                       |
| `hub action_tapped`               | navigation | posthog, logger                 | User taps priority action card                            |

### New Types Required

```typescript
// Add to EventCategory union:
| "agent"

// Add to EntityType union:
| "agent_session"

// ActionVerb: all needed verbs already exist (started, closed, opened, clicked)
// No new verbs required — using "closed" instead of "ended"
```

---

## 8. Performance Requirements

### Target: 60fps on 3-year-old Android device

| Metric                       | Threshold        | Measurement                                                                           |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| App cold start → hub visible | < 2s             | Expo performance timing                                                               |
| Hub action list render       | < 100ms          | FlatList with getItemLayout                                                           |
| WalkAi sheet open            | < 300ms          | Bottom sheet spring animation (canonical springs: stiffness 35, damping 22, mass 2.2) |
| Phase view transition        | < 200ms          | LayoutAnimation (native driver)                                                       |
| Punch animation              | < 16ms per frame | Reanimated worklet                                                                    |
| Memory usage (idle)          | < 150MB          | Android profiler                                                                      |
| Background battery drain     | < 2%/hour        | Device battery stats                                                                  |

### Performance Rules

- Hub priority list: `ScrollView` + `map()` (max 8 items — FlatList virtualization unnecessary)
- No `MaskedView`, `backdrop-filter`, or complex shadows in hub cards
- WalkAi waveform: 5-bar amplitude visualization (not FFT)
- Phase transitions: `LayoutAnimation.configureNext()` (native driver), not Reanimated layout
- All images via `expo-image` with caching
- Minimize bridge crossings in animation loops

---

## 9. Security & Data Requirements

### RLS Verification Checklist

Before any WalkAi query executes:

- [ ] All mobile query hooks filter by `workspace_id` via RLS
- [ ] Stage Engine sessions set `app.workspace_id` via auth context
- [ ] Agent tools in `packages/ai/src/capabilities/` scope all queries by `ctx.workspaceId`
- [ ] Mobile Supabase client uses anon key (never service role)
- [ ] WalkAi sessions validate `profile_id` ownership before granting tool access

### Data Flow

```
Mobile App (anon key)
  --> Supabase (RLS enforced, workspace-scoped)
  --> Stage Engine (API key auth, workspace from session)
    --> Capabilities (ctx.workspaceId scoping)
      --> Supabase (service role, but always scoped)
```

### Offline Queue Security

- SQLite write queue stores only: action type, params, timestamp
- No sensitive data cached in SQLite (no tokens, no PII beyond profile_id)
- MMKV read cache: shift data, task lists — acceptable for offline viewing
- Cache cleared on logout

---

## 10. Build Sequence

### Phase 0: Foundation (type changes, must complete before Phase 1)

| Task                                                        | Files                                                                                       | Dependency |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| Add `agent` to EventCategory, `agent_session` to EntityType | `packages/telemetry/src/registry.ts`                                                        | None       |
| Add i18n namespace `mobile.json`                            | `packages/i18n/locales/nb/mobile.json`                                                      | None       |
| Fix authority default mismatch                              | `services/stage-engine/src/core/agent-router.ts` line 91: `?? "suggest"` → `?? "read_only"` | None       |

### Phase 1: Infrastructure (no UI changes)

| Task                             | Files                                         | Dependency |
| -------------------------------- | --------------------------------------------- | ---------- |
| Add telemetry events             | `packages/telemetry/src/registry.ts`          | None       |
| Create deep link map             | `packages/notifications/src/deep-links.ts`    | None       |
| Build `schedule` capability      | `packages/ai/src/capabilities/schedule/`      | None       |
| Build `operations` capability    | `packages/ai/src/capabilities/operations/`    | None       |
| Build `communication` capability | `packages/ai/src/capabilities/communication/` | None       |
| Create `prioritizeActions()`     | `apps/mobile/src/lib/prioritize-actions.ts`   | None       |

**All Phase 1 tasks can run in parallel.**

### Phase 2: Mobile WalkAi (depends on Phase 1 capabilities)

| Task                                    | Files                                             | Dependency           |
| --------------------------------------- | ------------------------------------------------- | -------------------- |
| Create WalkAi provider                  | `apps/mobile/src/providers/walkai-provider.tsx`   | Phase 1 capabilities |
| Create mobile client tools              | `apps/mobile/src/lib/walkai-tools.ts`             | WalkAi provider      |
| Build WalkAiSheet (voice UI)            | `apps/mobile/src/components/ai/WalkAiSheet.tsx`   | WalkAi provider      |
| Wire BotssonSheet to useAgentChat       | `apps/mobile/src/components/ai/BotssonSheet.tsx`  | WalkAi provider      |
| Update FAB (tap=voice, long-press=text) | `apps/mobile/src/components/navigation/AIFab.tsx` | Both sheets          |

### Phase 3: Hub & Navigation (depends on Phase 1 prioritizer)

| Task                            | Files                                                  | Dependency          |
| ------------------------------- | ------------------------------------------------------ | ------------------- |
| Smart Home Hub (priority cards) | `apps/mobile/app/(app)/(home)/index.tsx` + phase views | prioritizeActions() |
| Expand Pre-shift Briefing       | `apps/mobile/src/components/home/BeforeShiftView.tsx`  | None                |
| Deep link routing               | `apps/mobile/src/lib/push.ts`                          | Deep link map       |
| Ring Leader wiring              | `apps/mobile/app/(app)/(me)/index.tsx`                 | None                |
| Offline contextual toasts       | `apps/mobile/src/providers/walkai-provider.tsx`        | WalkAi provider     |

### Phase 4: Integration & Polish

| Task                                  | Files                    | Dependency           |
| ------------------------------------- | ------------------------ | -------------------- |
| RLS verification (all mobile queries) | Audit all hooks          | All phases           |
| Performance testing (Android)         | Test suite               | All phases           |
| Telemetry verification                | E2E tests                | Phase 1 events       |
| Authority config seeding              | Migration + I1 bootstrap | Phase 1 capabilities |

### Parallelization Map

```
Phase 1 (all parallel):
  [telemetry] [deep-links] [schedule-cap] [operations-cap] [comm-cap] [prioritizer]
       |            |              |               |             |           |
       v            v              v               v             v           v
Phase 2 (sequential):          Phase 3 (parallel):
  [walkai-provider]             [home-hub] [pre-shift] [deep-links] [ring-leader]
  [mobile-tools]                     |
  [WalkAiSheet]                      |
  [BotssonSheet wire]                |
  [FAB update]                       |
       |                             |
       v                             v
Phase 4 (sequential):
  [RLS audit] → [performance test] → [telemetry verify] → [authority seed]
```

---

## 11. What This Spec Does NOT Cover

- Training/readiness journeys (v1.1)
- Shift Leader specific views (v1.1 — approve hours, session signoff, team status)
- Manager specific views (v1.1 — daily overview, KPI dashboard, schedule approval)
- Native App Store/Google Play build configuration
- Biometric authentication
- Multi-language support (v1.0 uses i18n keys with `nb` locale only — keys exist for future `en`/`sv` expansion)
- Dark mode toggle (follows system preference)
- Voice-Botsson via Ultravox in native context (v1.0 is Expo Web = browser)
- WalkAi training missions (structured stages for onboarding)

---

## 12. Success Criteria

### Functional

- [ ] Employee can complete full shift lifecycle without touching web dashboard
- [ ] WalkAi voice session connects and responds within 3 seconds
- [ ] WalkAi can answer "hvem jobber med meg i dag?" using schedule capability
- [ ] WalkAi can answer "hva er mine oppgaver?" using operations capability
- [ ] Push notification tap navigates directly to correct screen
- [ ] Home hub shows contextually correct priority actions for current shift phase
- [ ] Ring leader button opens native phone dialer
- [ ] Offline punch works and syncs when online

### Performance

- [ ] 60fps on Samsung Galaxy A13 (budget Android, 2022)
- [ ] Hub renders priority list in < 100ms
- [ ] WalkAi sheet opens in < 300ms
- [ ] App cold start < 2s to interactive hub

### Security

- [ ] All mobile queries workspace-scoped via RLS
- [ ] No service role key in mobile bundle
- [ ] WalkAi sessions validated with profile ownership
- [ ] Offline cache cleared on logout

---

## 13. Council Review Summary

### Brainstorm Council (18 questions, pre-spec)

Reviewed by 5 simulated council members. 18 questions raised and resolved.

### System Council (formal review, post-spec)

Reviewed by 4 agents in parallel. **Verdict: APPROVE WITH CHANGES.**

| Agent             | Verdict              | Key Findings                                                                                                                                   |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| System Steward    | PASS WITH CONDITIONS | Authority model per-workspace not per-role, i18n violation, ActionVerb gap, collectContext() richer than spec implied                          |
| Supervisor        | ACCEPT WITH CHANGES  | Deep link map already exists in push.ts, BotssonSheet is full replacement, QuickActions silently killed, PWA+push contradiction                |
| Agent Coordinator | PASS WITH CONDITIONS | Schedule tools are Ultravox client-side (not wrappable), collectContext() missing mobile fields, useAgent has browser-only deps, needs Phase 0 |
| Frontend Designer | (recommendations)    | WalkAiSheet 85%→75%, orb needs pre-rendered PNG, FlatList→ScrollView, spring values wrong, panel tokens missing, fonts not loaded              |

### Changes Applied to Spec

1. Authority model simplified to per-workspace for v1.0, per-role deferred to v1.1 with ADR
2. "Shift Leader" clarified as team attribute, not role
3. Schedule capabilities marked as net-new (not wrappable)
4. collectContext() documented correctly (mobile fields as session params)
5. i18n from day 1 (removed hardcoded Norwegian exemption)
6. ActionVerb: use "closed" instead of "ended"
7. Deep link map: migrate from push.ts, not duplicate
8. BotssonSheet: documented as full replacement
9. FAB: documented QuickActions removal
10. Supplement preview: must use tariff_rate_table
11. WalkAiSheet: 75% height (not 85%)
12. Phase 0 added for foundation changes
13. PWA push limitation documented
