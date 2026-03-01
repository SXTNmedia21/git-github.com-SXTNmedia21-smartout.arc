# SMARTOUT — Journey Deep Specification

> **The Complete Contract**
> Version 1.0 | March 2026
> **Principle:** Every journey is 100% documented. Every button. Every event. Every notification. Every point. Every multiplier. Every database write. Every screen state. This IS Smartout.

---

## 1. Why This Matters

A journey at full depth is not documentation — it is the **executable specification** of Smartout. From one fully specified journey, you can:

- **Build it** — a developer knows every component, every API call, every state
- **Test it** — QA knows every assertion, every edge case, every error state
- **Teach it** — onboarding docs are generated with exact button labels and screenshots
- **Script it** — Mr. Botsson knows exactly what to say at each step
- **Price it** — product knows exactly how complex each journey is
- **Estimate it** — project management knows the scope before writing a line of code

If the journey spec is incomplete, the implementation will be incomplete.

---

## 2. Expanded Journey Step Schema

Every step in a journey contains ALL of the following:

```typescript
interface JourneyStepDeep {
  // ─── Identity ──────────────────────────────────────────────
  id: string; // "step-3"
  order: number; // 3
  title: string; // Short: "Punch In"

  // ─── User Action ───────────────────────────────────────────
  action: {
    description: string; // "Employee taps the Punch In button"
    type: ActionType; // 'tap' | 'swipe' | 'form_submit' | 'navigate' | 'drag' | 'long_press' | 'scan' | 'voice' | 'system_auto'
    target: UIElement; // Exact button/element specification
  };

  // ─── UI Elements ───────────────────────────────────────────
  ui: {
    screen: string; // Route: "/home"
    component: string; // "PunchClockModal"
    elements: UIElement[]; // Every interactive element in this step
    states: ScreenState[]; // All possible screen states
    transitions: UITransition[]; // Animations, loading states
  };

  // ─── Data Operations ───────────────────────────────────────
  data: {
    reads: DataOperation[]; // What data is fetched
    writes: DataOperation[]; // What data is created/updated
    deletes: DataOperation[]; // What data is removed
    realtime: RealtimeEvent[]; // Supabase Realtime broadcasts
  };

  // ─── Events & Triggers ─────────────────────────────────────
  events: {
    emitted: AppEvent[]; // Events this step fires
    listensTo: AppEvent[]; // Events this step reacts to
    sideEffects: SideEffect[]; // Things that happen as consequence
  };

  // ─── Notifications ─────────────────────────────────────────
  notifications: Notification[]; // All notifications triggered

  // ─── Gamification ──────────────────────────────────────────
  gamification: {
    points: PointAward[]; // Points awarded
    achievements: Achievement[]; // Achievements unlocked
    streaks: StreakUpdate[]; // Streak tracking affected
  };

  // ─── Compliance & Audit ────────────────────────────────────
  audit: {
    trailEntries: AuditEntry[]; // Audit log entries created
    complianceChecks: ComplianceCheck[]; // Legal validations
  };

  // ─── Error Handling ────────────────────────────────────────
  errors: ErrorScenario[]; // Every possible error + recovery

  // ─── Expects (Assertion) ───────────────────────────────────
  expects: {
    description: string; // Human-readable expected result
    assertions: TestAssertion[]; // Machine-verifiable assertions
  };

  // ─── Notes ─────────────────────────────────────────────────
  implementationNotes: string; // Dev-specific notes
  designNotes: string; // UX-specific notes
}

// ─── Supporting Types ────────────────────────────────────────────

interface UIElement {
  testId: string; // data-testid="punch-in-btn"
  type: ElementType; // 'button' | 'input' | 'select' | 'toggle' | 'card' | 'modal' | 'list' | 'badge' | 'indicator'
  label: string; // Norwegian: "Stemple inn"
  variant: string; // 'primary' | 'secondary' | 'destructive' | 'ghost'
  icon: string | null; // Lucide icon name or emoji
  disabled: ConditionalRule | null; // When is this disabled?
  visible: ConditionalRule | null; // When is this visible?
  accessibilityLabel: string; // Screen reader text (Norwegian)
}

interface ScreenState {
  name: string; // "loading" | "empty" | "success" | "error" | "permission_denied"
  condition: string; // When this state applies
  display: string; // What the user sees
  illustration: string | null; // Empty state illustration reference
  cta: UIElement | null; // Call-to-action in this state
}

interface UITransition {
  from: string; // Previous state
  to: string; // Next state
  animation: string; // "fade" | "slide-up" | "none" | "skeleton"
  duration: number; // ms
  loading: boolean; // Shows loading indicator?
}

interface DataOperation {
  table: string; // "punch_record"
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  fields: string[]; // ["profile_id", "shift_id", "punch_in", "gps_lat", "gps_lng"]
  condition: string | null; // WHERE clause description
  rls: string; // Which RLS policy applies
  index: string | null; // Which index is used
}

interface RealtimeEvent {
  channel: string; // "session:{session_id}"
  event: string; // "employee_punched_in"
  payload: string; // Description of payload
  subscribers: string; // Who receives: "all session participants"
}

interface AppEvent {
  name: string; // "SHIFT_PUNCHED_IN"
  payload: Record<string, string>; // { profileId, shiftId, punchTime, isOnTime }
  source: string; // "PunchClockModal"
}

interface SideEffect {
  description: string; // "Auto-switch app context to active session"
  trigger: string; // Which event triggers this
  type: "ui" | "data" | "notification" | "integration" | "ai";
  async: boolean; // Happens asynchronously?
}

interface Notification {
  template: string; // "shift.punch_in"
  channels: NotificationChannel[]; // ['in_app', 'push']
  recipient: string; // "shift.manager" | "self" | "team"
  title: string; // Norwegian: "{{name}} har stemplet inn"
  body: string; // "Skift {{shift_time}} — {{department}}"
  deepLink: string; // "/operations/session/{session_id}"
  priority: "low" | "normal" | "high" | "critical";
  quietHoursRespect: boolean; // Obey quiet hours setting?
  condition: string | null; // When to send (null = always)
}

type NotificationChannel = "in_app" | "push" | "sms" | "email" | "voice";

interface PointAward {
  action: string; // "punch_on_time"
  basePoints: number; // 5
  seasonMultiplier: boolean; // true = multiplied by season config
  conditionalBonus: ConditionalBonus[];
  category: string; // "attendance" | "tasks" | "training" | "haccp" | "teamwork"
  description: string; // "Awarded for punching in on time (≤5 min before shift)"

  // How the final points are calculated:
  // finalPoints = basePoints × seasonMultiplier × (1 + sum(conditionalBonuses))
}

interface ConditionalBonus {
  condition: string; // "punch_time <= shift_start - 5min"
  bonusPoints: number; // 3 additional
  label: string; // "Tidlig-bonus"
  description: string; // "Extra points for arriving 5+ minutes early"
}

interface Achievement {
  id: string; // "first_punch"
  name: string; // "Første stempling"
  condition: string; // "First successful punch-in ever"
  icon: string; // "🏁"
  points: number; // Bonus points for unlocking
  oneTime: boolean; // Can only earn once
}

interface StreakUpdate {
  streakType: string; // "on_time_streak"
  action: "increment" | "reset" | "check";
  condition: string; // "Punch in on time → increment. Late → reset."
  milestone: StreakMilestone[];
}

interface StreakMilestone {
  count: number; // 5
  reward: string; // "5-dagers-rekord: +10 bonuspoeng"
  bonusPoints: number; // 10
}

interface AuditEntry {
  type: string; // "punch_in"
  actor: string; // "profile:{profile_id}"
  target: string; // "shift:{shift_id}"
  data: string; // "Timestamp, GPS coordinates, device info"
  retention: string; // "5 years (Norwegian labor law)"
}

interface ComplianceCheck {
  law: string; // "Arbeidsmiljøloven §10-8"
  check: string; // "Minimum 11h rest between shifts"
  action: string; // "Warn if <11h since last punch-out"
  severity: "info" | "warning" | "block";
}

interface ErrorScenario {
  trigger: string; // "GPS position >500m from workspace location"
  errorCode: string; // "PUNCH_GPS_MISMATCH"
  userMessage: string; // "Du ser ut til å være langt fra arbeidsplassen"
  recovery: string; // "Allow override with comment, notify manager"
  severity: "info" | "warning" | "block";
  notifyAdmin: boolean; // true
}

interface TestAssertion {
  type:
    | "visible"
    | "text"
    | "value"
    | "count"
    | "exists"
    | "not_exists"
    | "enabled"
    | "disabled"
    | "url"
    | "db_record";
  selector: string; // "[data-testid='punch-record']"
  expected: string; // "record exists with punch_in = now()"
  timeout: number; // ms to wait
}

interface ConditionalRule {
  condition: string; // "shift.start_time - now() <= 30min"
  description: string; // "Only visible 30 minutes before shift start"
}
```

---

## 3. Gold Standard Example: J-019 Punch Into Shift

This is ONE journey at full depth. This is the template for all 68.

---

### Journey: J-019 — Punch Into Shift (Stemple inn)

#### Classification

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| **ID**       | `j-019`                                                               |
| **Title**    | Punch Into Shift                                                      |
| **Slug**     | `punch-into-shift`                                                    |
| **Module**   | ⚡ Operations (`operations`)                                          |
| **Actor**    | 👤 Employee (`employee`)                                              |
| **Platform** | 📱 Mobile (`mobile`)                                                  |
| **Priority** | P0 — Critical                                                         |
| **Tags**     | `write`, `gps`, `gamification`, `real-time`, `audit-trail`, `sandbox` |

#### Trigger

Employee arrives at work and opens the app. The Punch In button is visible on the Home tab when a shift is scheduled within ±30 minutes of the current time.

#### Preconditions

| #   | Precondition                                           | Validation                                             |
| --- | ------------------------------------------------------ | ------------------------------------------------------ |
| 1   | User is authenticated                                  | `auth.uid()` exists                                    |
| 2   | Profile status = `active` (or `trainee` for sandbox)   | `profile.status IN ('active', 'trainee')`              |
| 3   | Shift exists starting within ±30min of now             | `shift.start_time BETWEEN now()-30min AND now()+30min` |
| 4   | Shift is assigned to this profile                      | `shift.profile_id = current_profile_id`                |
| 5   | No active punch record exists (not already punched in) | `NOT EXISTS punch_record WHERE punch_out IS NULL`      |
| 6   | Workspace has Operations module active                 | `workspace.active_modules @> '{operations}'`           |

#### Related Journeys

| Relation        | Journey                           | Why                                  |
| --------------- | --------------------------------- | ------------------------------------ |
| Requires        | J-011 Check My Schedule           | Employee must know they have a shift |
| Leads to        | J-020 Work Through Feed Tasks     | After punch-in, feed loads           |
| Leads to        | J-021 View Day Brief              | Day Brief appears after punch-in     |
| Opposite        | J-024 Punch Out & See Summary     | The end of this flow                 |
| Sandbox variant | J-005 Module Journey (Operations) | Trainee does sandbox punch           |

---

#### STEP 1: See Punch-In Availability

**Action:**
| Field | Value |
|-------|-------|
| Description | Employee opens app, sees Home tab with punch-in CTA |
| Type | `navigate` |
| Target | Home tab (auto-selected on app open when shift is near) |

**UI Elements:**
| testId | Type | Label (NO) | Variant | Visible When | Disabled When |
|--------|------|-----------|---------|--------------|--------------|
| `home-tab` | tab | "Hjem" | active | Always | Never |
| `punch-cta-card` | card | — | elevated | Shift within ±30min AND not punched in | — |
| `punch-cta-shift-info` | text | "Din vakt starter om {{minutes}} min" | body | Inside CTA card | — |
| `punch-cta-dept` | badge | "{{department_name}}" | department-color | Inside CTA card | — |
| `punch-cta-time` | text | "{{shift_start}} – {{shift_end}}" | caption | Inside CTA card | — |
| `punch-in-btn` | button | "Stemple inn" | primary | Inside CTA card | Already punched in |

**Screen States:**
| State | Condition | Display |
|-------|-----------|---------|
| `shift_upcoming` | Shift in 5-30min | CTA card: "Din vakt starter om X min" + enabled button |
| `shift_now` | Shift started ≤15min ago | CTA card: "Vakten din har startet!" + prominent button + urgency styling |
| `shift_late` | Shift started >15min ago | CTA card: "Du er {{min}} minutter forsinket" + warning styling |
| `no_shift` | No shift within ±30min | No CTA card. Regular home feed or schedule prompt |
| `already_punched` | Active punch record exists | CTA replaced by active shift indicator |
| `trainee` | profile.status = trainee | CTA card with sandbox badge: "🧪 Øvingsmodus" |

**Data Reads:**
| Table | Operation | Fields | Condition | Index |
|-------|-----------|--------|-----------|-------|
| `shift` | SELECT | id, start_time, end_time, department_id, position, location_id | `profile_id = me AND start_time BETWEEN now()-30min AND now()+30min AND status = 'published'` | `idx_shift_profile_start` |
| `department` | SELECT | name, color | `id = shift.department_id` | PK |
| `punch_record` | SELECT | id | `profile_id = me AND punch_out IS NULL` | `idx_punch_active` |
| `department_session` | SELECT | id, status | `department_id = shift.department_id AND date = today()` | `idx_session_dept_date` |

**Events Listened To:**
| Event | Source | Action |
|-------|--------|--------|
| `SHIFT_PUBLISHED` | Scheduling module | Refresh shift data → show/hide CTA |
| `SHIFT_CANCELLED` | Scheduling module | Hide CTA if this was the matched shift |

**Notifications:** None at this step (pre-action).

**Gamification:** None at this step (pre-action).

**Errors:**
| Trigger | Code | User Message | Recovery | Severity |
|---------|------|-------------|----------|----------|
| No shift found | `PUNCH_NO_SHIFT` | "Du har ingen vakt nå" | Show schedule link | info |
| Network error loading shift | `NETWORK_ERROR` | "Kunne ikke laste vaktdata" | Retry button + offline cached shift | warning |

**Test Assertions:**
| Type | Selector | Expected |
|------|----------|----------|
| `visible` | `[data-testid="punch-cta-card"]` | Visible when shift within 30min |
| `text` | `[data-testid="punch-cta-shift-info"]` | Contains shift start time |
| `enabled` | `[data-testid="punch-in-btn"]` | Enabled when not already punched in |
| `not_exists` | `[data-testid="punch-cta-card"]` | Not visible when no shift scheduled |

---

#### STEP 2: Tap Punch In

**Action:**
| Field | Value |
|-------|-------|
| Description | Employee taps the "Stemple inn" button |
| Type | `tap` |
| Target | `punch-in-btn` |

**UI Transition:**
| From | To | Animation | Duration | Loading |
|------|-----|-----------|----------|---------|
| `punch-cta-card` | `punch-confirming` | Button shows spinner | 200ms | Yes |
| `punch-confirming` | `punch-gps-check` (if GPS enabled) | Modal slide-up | 300ms | Yes |
| `punch-confirming` | `punch-success` (if GPS disabled) | Confetti + card transform | 500ms | No |

**Data Operations:**

_GPS Check (if enabled):_
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| `workspace` | SELECT | gps_punch_enabled, gps_punch_radius, gps_lat, gps_lng | Check workspace GPS config |

_Create Punch Record:_
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| `punch_record` | INSERT | `id` (uuid), `workspace_id`, `profile_id`, `shift_id`, `session_id`, `punch_in` (now()), `punch_type` ('shift_start'), `gps_lat`, `gps_lng`, `gps_accuracy`, `gps_verified` (bool), `device_info` (user agent), `is_sandbox` (trainee?), `created_at` | Core punch record |
| `shift` | UPDATE | `actual_start` = now(), `status` = 'in_progress' | Mark shift as started |
| `department_session` | UPDATE | Add profile_id to `active_employees` array | Add to active session |

_Realtime Broadcasts:_
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| `session:{session_id}` | `employee_punched_in` | `{ profileId, profileName, shiftId, punchTime, isOnTime, department }` | All employees in same session + managers |
| `workspace:{workspace_id}:admin` | `punch_event` | `{ profileId, profileName, department, punchTime, isLate }` | Admins viewing dashboard |

**Events Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| `SHIFT_PUNCHED_IN` | `{ profileId, shiftId, sessionId, punchTime, isOnTime, isLate, minutesEarlyOrLate, isSandbox }` | Feed loader, session manager, gamification engine, audit logger, AI context engine |
| `SESSION_EMPLOYEE_JOINED` | `{ sessionId, profileId, activeCount }` | Session board (manager view), headcount tracker |
| `CONTEXT_SWITCH` | `{ newContext: 'session', sessionId, departmentId }` | App shell (switches tab context) |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|-------|
| 1 | App context auto-switches to active session | `CONTEXT_SWITCH` | `ui` | No |
| 2 | Feed loads with session-specific content | `SHIFT_PUNCHED_IN` | `ui` | Yes |
| 3 | Day Brief pinned to top of feed | `SESSION_EMPLOYEE_JOINED` | `ui` | Yes |
| 4 | Session tasks assigned to this profile loaded | `SHIFT_PUNCHED_IN` | `data` | Yes |
| 5 | AI context updated (employee is now on shift) | `SHIFT_PUNCHED_IN` | `ai` | Yes |
| 6 | Gamification points calculated and awarded | `SHIFT_PUNCHED_IN` | `data` | Yes |

**Notifications:**

| Template                | Channel          | Recipient             | Title                                        | Body                                         | Deep Link                          | Priority | Quiet Hours | Condition                           |
| ----------------------- | ---------------- | --------------------- | -------------------------------------------- | -------------------------------------------- | ---------------------------------- | -------- | ----------- | ----------------------------------- |
| `shift.punch_in`        | `in_app`         | Manager of department | "{{name}} har stemplet inn"                  | "{{department}} — {{shift_time}}"            | `/operations/session/{session_id}` | low      | Yes         | Always                              |
| `shift.punch_late`      | `push`, `in_app` | Manager               | "{{name}} stemplet inn {{min}} min for sent" | "{{department}} — forventet {{shift_start}}" | `/operations/session/{session_id}` | normal   | No          | `minutesLate > 5`                   |
| `shift.punch_very_late` | `push`, `sms`    | Admin                 | "{{name}} er {{min}} min forsinket"          | "{{department}} — ingen stempling ennå"      | `/operations/session/{session_id}` | high     | No          | `minutesLate > 30 AND no_punch_yet` |

**Gamification:**

_Points:_
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| `punch_in` | 2 | ✅ | `attendance` | Base points for punching in |

_Conditional Bonuses:_
| Condition | Bonus | Label | Description |
|-----------|:-----:|-------|-------------|
| `punch_time ≤ shift_start` | +3 | "I tide" | On time or early |
| `punch_time ≤ shift_start - 5min` | +2 | "Tidlig-fugl" | 5+ minutes early (stacks with above) |
| `punch_time > shift_start` | -2 | "Forsinket" | Penalty for late arrival |
| `punch_time > shift_start + 15min` | -3 | "Veldig sent" | Additional penalty (stacks with above) |

_Point Calculation:_

```
Base:      2 pts
On time:   +3 pts (if punch ≤ shift start)
Early:     +2 pts (if punch ≤ shift start - 5min)
Late:      -2 pts (if punch > shift start)
Very late: -3 pts (if punch > shift start + 15min)
                ──────
Subtotal:  2-7 pts (on time) or -3 to 0 pts (late)
                × season_multiplier (default 1.0)
                × workspace_booster (if any active)
                ──────
Final:     Written to points_event table
```

_Achievements:_
| ID | Name | Condition | Icon | Points | One-time |
|----|------|-----------|------|:------:|:--------:|
| `first_punch` | "Første dag!" | First ever punch-in | 🏁 | 10 | ✅ |
| `early_bird` | "Tidlig fugl" | Punch in 15+ min early | 🐦 | 5 | ✅ |
| `perfect_week` | "Perfekt uke" | 5 on-time punches in a row (Mon-Fri) | ⭐ | 25 | ❌ (repeatable) |

_Streaks:_
| Streak | Action | Milestones |
|--------|--------|------------|
| `on_time_streak` | On-time punch → increment. Late → reset to 0. | 3 days: +5 pts "Tre på rad!", 5 days: +10 pts "Uke-mester!", 10 days: +25 pts "Punktlighets-guru!", 30 days: +100 pts "Månedens beste!" |

**Compliance & Audit:**

_Audit Trail:_
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| `punch_in` | `profile:{id}` | `shift:{id}` | Timestamp, GPS coords, device, IP, accuracy, is_verified | 5 years (Arbeidsmiljøloven) |
| `session_join` | `profile:{id}` | `session:{id}` | Join time, active employee count | 5 years |

_Compliance Checks:_
| Law | Check | Action | Severity |
|-----|-------|--------|----------|
| Arbeidsmiljøloven §10-8 | Min 11h rest since last punch-out | If <11h: show warning "Du har hvilt under 11 timer. Vennligst bekreft at du ønsker å starte." | `warning` |
| Arbeidsmiljøloven §10-6 | Max weekly hours (40h normal) | If this shift would exceed 40h: flag for manager review | `warning` |
| Internal policy | GPS verification | If GPS mismatch >500m: allow with manager override | `warning` |

**Error Scenarios:**
| # | Trigger | Code | User Message (NO) | Recovery | Severity | Notify Admin |
|---|---------|------|--------------------|----------|----------|:----:|
| 1 | GPS >500m from workspace | `PUNCH_GPS_MISMATCH` | "Du ser ut til å være langt fra arbeidsplassen. Vil du stemple inn likevel?" | Allow with comment field → manager notified | warning | ✅ |
| 2 | GPS unavailable | `PUNCH_GPS_UNAVAIL` | "Kunne ikke finne posisjonen din" | Allow punch without GPS, flag in record | info | ❌ |
| 3 | Already punched in | `PUNCH_ALREADY_ACTIVE` | "Du er allerede stemplet inn" | Show active shift info | info | ❌ |
| 4 | No session exists | `PUNCH_NO_SESSION` | "Ingen aktiv økt funnet for avdelingen" | Auto-create session if within operating hours, else contact manager | warning | ✅ |
| 5 | Network failure | `NETWORK_ERROR` | "Ingen nettverkstilkobling. Prøv igjen." | Queue punch locally, retry when online | warning | ❌ |
| 6 | Trainee attempting real punch | `PUNCH_SANDBOX_ONLY` | n/a (invisible — system auto-routes to sandbox) | Create sandbox punch record (is_sandbox = true) | info | ❌ |
| 7 | Shift not assigned to user | `PUNCH_WRONG_SHIFT` | "Denne vakten er ikke tildelt deg" | Show user's actual shifts | block | ❌ |
| 8 | Workspace GPS required but denied | `PUNCH_GPS_REQUIRED` | "Arbeidsplassen krever GPS-verifisering. Vennligst aktiver stedstjenester." | Link to device settings | block | ❌ |

---

#### STEP 3: GPS Verification (Conditional)

_This step only occurs if `workspace.gps_punch_enabled = true`._

**Action:**
| Field | Value |
|-------|-------|
| Description | System requests GPS position and validates against workspace location |
| Type | `system_auto` |
| Target | Device GPS API |

**UI Elements:**
| testId | Type | Label | Variant | Notes |
|--------|------|-------|---------|-------|
| `gps-check-modal` | modal | "Bekrefter posisjon..." | loading | Shows spinner + map pin animation |
| `gps-check-success` | indicator | "✅ Posisjon bekreftet" | success | Shown for 1s before auto-dismiss |
| `gps-check-warning` | indicator | "⚠️ Du er {{distance}}m unna" | warning | With override option |
| `gps-override-btn` | button | "Stemple inn likevel" | ghost | Only if mismatch but within tolerance |
| `gps-override-comment` | input | "Hvorfor er du et annet sted?" | text | Required if override |

**Data Operations:**
| Action | Details |
|--------|---------|
| Read device GPS | `navigator.geolocation.getCurrentPosition()` with `{enableHighAccuracy: true, timeout: 10000}` |
| Calculate distance | Haversine formula: device coords vs `workspace.gps_lat, workspace.gps_lng` |
| Validate | `distance ≤ workspace.gps_punch_radius` (default 500m) |

**States:**
| State | Condition | Next Step |
|-------|-----------|-----------|
| GPS verified ✅ | Distance ≤ radius | → Step 4 (Success) |
| GPS mismatch ⚠️ | Distance > radius but < 2x radius | → Show override option |
| GPS far ❌ | Distance > 2x radius | → Block punch (workspace policy) |
| GPS unavailable | Device denied or timeout | → Proceed without GPS (flag in record) |

---

#### STEP 4: Punch Success + Context Switch

**Action:**
| Field | Value |
|-------|-------|
| Description | Punch confirmed. App transitions to active shift context. |
| Type | `system_auto` |
| Target | App shell context manager |

**UI Elements:**
| testId | Type | Label | Notes |
|--------|------|-------|-------|
| `punch-success-animation` | animation | Confetti burst + checkmark | 1.5s duration |
| `punch-success-message` | text | "Du er stemplet inn! ✅" | Large, centered, 2s then fades |
| `punch-success-points` | badge | "+{{points}} poeng" | Animated point counter |
| `punch-success-streak` | badge | "🔥 {{count}} dager på rad!" | Only if streak milestone hit |
| `punch-success-achievement` | card | Achievement card | Only if achievement unlocked |

**UI Transition:**
| From | To | Animation | Duration |
|------|-----|-----------|----------|
| Punch CTA | Success animation | Confetti + checkmark | 1500ms |
| Success animation | Feed (session context) | Crossfade | 500ms |
| Home tab (generic) | Home tab (session context) | Content swap | 300ms |
| Bottom tabs | Bottom tabs (session indicator) | Badge appears on Hjem | 200ms |

**Screen States After Transition:**
| Element | New State |
|---------|-----------|
| Home tab | Switches to session feed — tasks, notes, Day Brief |
| Tab bar | "Hjem" tab shows active session dot indicator |
| App header | Shows department name + shift time |
| Feed | Day Brief pinned at top, tasks sorted by urgency below |
| AI FAB | Context updated — Mr. Botsson knows you're on shift |

**Data Writes (Gamification):**
| Table | Operation | Fields |
|-------|-----------|--------|
| `points_event` | INSERT | `id`, `workspace_id`, `profile_id`, `season_id`, `action` ('punch_on_time'), `base_points`, `multiplier`, `final_points`, `category` ('attendance'), `source_type` ('shift'), `source_id` (shift_id), `metadata` (breakdown), `created_at` |
| `profile_streak` | UPSERT | `profile_id`, `streak_type` ('on_time'), `current_count` (+1 or reset), `best_count` (max), `last_event_at` |
| `achievement_unlock` | INSERT (conditional) | `profile_id`, `achievement_id`, `unlocked_at` | Only if new achievement |

---

#### STEP 5: Feed Loads with Session Context

**Action:**
| Field | Value |
|-------|-------|
| Description | Feed populates with session-specific content |
| Type | `system_auto` |
| Target | FeedContainer component |

**UI Elements:**
| testId | Type | Content | Priority |
|--------|------|---------|:--------:|
| `feed-day-brief` | card (pinned) | AI-compiled Day Brief | 0 (always top) |
| `feed-task-{id}` | card | Session task with procedure | Sorted by urgency × time |
| `feed-note-{id}` | card | Session note | By timestamp |
| `feed-message-{id}` | card | Team message | By timestamp |
| `feed-inherited-{id}` | card (amber border) | Task from previous shift | After current tasks |
| `feed-empty` | empty state | "Alt er klart! Ingen oppgaver ennå." | Only if no items |

**Data Reads:**
| Table | What | Filter |
|-------|------|--------|
| `session_task` | Tasks assigned to me in this session | `session_id = current AND (assigned_to = me OR assigned_to IS NULL)` |
| `session_note` | Notes for this session | `session_id = current` |
| `day_brief` | Compiled Day Brief | `session_id = current` |
| `message` | Team/dept messages since last visit | `channel IN my_channels AND created_at > last_seen` |
| `inherited_task` | Uncompleted from previous session | `previous_session_id AND status != completed AND inheritable = true` |

**Realtime Subscriptions (activated on punch-in):**
| Channel | Events | Action |
|---------|--------|--------|
| `session:{id}` | `task_created`, `task_completed`, `note_added`, `employee_joined`, `employee_left` | Update feed in real-time |
| `dept:{dept_id}` | `message_new`, `announcement` | Add to feed |
| `shift:{shift_id}` | `task_assigned`, `urgent_update` | Highlight in feed |

---

#### Complete Test Specification

```typescript
import { test, expect } from "@playwright/test";
// Or: import { device, element, by } from 'detox'; for mobile

test.describe("J-019: Punch Into Shift", () => {
  test.beforeEach(async ({ page }) => {
    // Seed: employee with active profile, published shift starting in 10min
    // Seed: department session for today
    // Seed: workspace with GPS disabled (default)
    // Login as employee
  });

  test("shows punch CTA when shift is within 30 minutes", async ({ page }) => {
    await expect(page.locator('[data-testid="punch-cta-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="punch-cta-shift-info"]')).toContainText("starter om");
    await expect(page.locator('[data-testid="punch-in-btn"]')).toBeEnabled();
  });

  test("does not show punch CTA when no shift scheduled", async ({ page }) => {
    // Seed: no shifts for this employee
    await expect(page.locator('[data-testid="punch-cta-card"]')).not.toBeVisible();
  });

  test("successfully punches in and switches context", async ({ page }) => {
    await page.locator('[data-testid="punch-in-btn"]').click();

    // Success animation
    await expect(page.locator('[data-testid="punch-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="punch-success-points"]')).toBeVisible();

    // Context switch
    await page.waitForTimeout(2000); // Animation duration
    await expect(page.locator('[data-testid="feed-day-brief"]')).toBeVisible();

    // Database verification
    // assert: punch_record exists with punch_in = ~now()
    // assert: shift.status = 'in_progress'
    // assert: points_event created
  });

  test("awards correct points for on-time arrival", async ({ page }) => {
    // Shift starts in 10 minutes → early bonus
    await page.locator('[data-testid="punch-in-btn"]').click();
    await expect(page.locator('[data-testid="punch-success-points"]')).toContainText("+7"); // 2 base + 3 on-time + 2 early
  });

  test("deducts points for late arrival", async ({ page }) => {
    // Seed: shift started 10 minutes ago
    await page.locator('[data-testid="punch-in-btn"]').click();
    await expect(page.locator('[data-testid="punch-success-points"]')).toContainText("0"); // 2 base - 2 late = 0
  });

  test("shows GPS verification when workspace requires it", async ({ page }) => {
    // Seed: workspace.gps_punch_enabled = true
    await page.locator('[data-testid="punch-in-btn"]').click();
    await expect(page.locator('[data-testid="gps-check-modal"]')).toBeVisible();
  });

  test("allows GPS override with comment", async ({ page }) => {
    // Seed: GPS enabled, mock position 600m away
    await page.locator('[data-testid="punch-in-btn"]').click();
    await expect(page.locator('[data-testid="gps-check-warning"]')).toBeVisible();
    await page.locator('[data-testid="gps-override-comment"]').fill("Parkerte lenger unna i dag");
    await page.locator('[data-testid="gps-override-btn"]').click();
    await expect(page.locator('[data-testid="punch-success-message"]')).toBeVisible();
  });

  test("prevents double punch-in", async ({ page }) => {
    await page.locator('[data-testid="punch-in-btn"]').click();
    await page.waitForTimeout(2000);
    // Punch button should no longer be visible
    await expect(page.locator('[data-testid="punch-in-btn"]')).not.toBeVisible();
  });

  test("notifies manager of late arrival", async ({ page }) => {
    // Seed: shift started 10 minutes ago
    await page.locator('[data-testid="punch-in-btn"]').click();
    // assert: notification created for manager with template 'shift.punch_late'
  });

  test("creates sandbox punch for trainee", async ({ page }) => {
    // Seed: profile.status = 'trainee'
    await page.locator('[data-testid="punch-in-btn"]').click();
    // assert: punch_record.is_sandbox = true
    // assert: no real session modification
    await expect(page.locator('[data-testid="sandbox-indicator"]')).toBeVisible();
  });

  test("tracks on-time streak", async ({ page }) => {
    // Seed: profile_streak.on_time.current_count = 4
    await page.locator('[data-testid="punch-in-btn"]').click();
    // assert: streak incremented to 5
    await expect(page.locator('[data-testid="punch-success-streak"]')).toContainText(
      "5 dager på rad",
    );
  });

  test("checks 11h rest period compliance", async ({ page }) => {
    // Seed: last punch_out was 9 hours ago
    await page.locator('[data-testid="punch-in-btn"]').click();
    await expect(page.locator('[data-testid="rest-period-warning"]')).toContainText(
      "hvilt under 11 timer",
    );
  });

  test("loads feed with Day Brief after punch", async ({ page }) => {
    await page.locator('[data-testid="punch-in-btn"]').click();
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-testid="feed-day-brief"]')).toBeVisible();
    await expect(page.locator('[data-testid="feed-task"]').first()).toBeVisible();
  });
});
```

---

## 4. Effort Scale

Every journey at full depth will be this detailed. To set expectations for the effort:

| Journey Complexity                                | Steps | Approx. Spec Size | Example                          |
| ------------------------------------------------- | :---: | :---------------: | -------------------------------- |
| **Simple** (read-only, single screen)             |  2-3  |     ~2 pages      | J-011 Check My Schedule          |
| **Medium** (form + action + notification)         |  4-5  |     ~5 pages      | J-012 Register Availability      |
| **Complex** (multi-step, real-time, gamification) |  5-7  |     ~10 pages     | J-019 Punch Into Shift           |
| **Epic** (wizard, multi-screen, AI-assisted)      | 7-10  |     ~15 pages     | J-001 Sign Up & Create Workspace |

**68 journeys × avg 5 pages = ~340 pages of specification.** This IS the product.

---

## 5. Template for Specifying Remaining Journeys

For each of the remaining 67 journeys, fill in:

```markdown
### Journey: J-XXX — [Title]

#### Classification

Module, Actor, Platform, Priority, Tags

#### Trigger + Preconditions

#### Related Journeys

#### For each step:

1. Action (what user does)
2. UI Elements (every button with testId, label, variant, visibility rules)
3. Screen States (every possible state)
4. Data Operations (every read, write, realtime broadcast)
5. Events (emitted, listened to, side effects)
6. Notifications (every notification with template, channel, recipient, content)
7. Gamification (every point, bonus, achievement, streak)
8. Compliance & Audit (every audit entry, legal check)
9. Error Scenarios (every possible error with recovery)
10. Test Assertions (every machine-verifiable check)

#### Complete E2E Test Code
```

---

_This document defines the gold standard for journey specifications in Smartout. J-019 Punch Into Shift serves as the template. Every journey deserves this level of detail because every journey IS the product._
