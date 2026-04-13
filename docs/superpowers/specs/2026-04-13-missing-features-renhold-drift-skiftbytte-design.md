---
title: "Design Spec — Renholdssjekker, Driftsoversikt, Skiftbytte"
status: draft
updated: 2026-04-13
created: 2026-04-13
module: operations
tags: [renholdssjekker, driftsoversikt, skiftbytte, hms, operations, gap-closure]
council-reviewed: true
council-verdict: APPROVE WITH CHANGES
council-date: 2026-04-13
---

# Design Spec — Renholdssjekker, Driftsoversikt, Skiftbytte

**Version:** 1.0
**Author:** Pontus Lindroth + Claude (council-reviewed)
**Council verdict:** APPROVE WITH CHANGES — all four agents + steward synthesis

## Background

Gap-analyse av salgsdokumenter mot kodebasen avdekket tre funksjoner som dokumentene lover men koden mangler. Alle tre bruker eksisterende infrastruktur — ingen nye tabeller trengs for noen av dem.

### Key Council Findings

1. `shift_swap_request` tabell er FORBUDT — ADR-0067 krever Event Engine
2. `/dashboard/operations/` FINNES ALLEREDE (447 linjer) — dette er en utvidelse
3. `createDeviation` tool har en bug (`domain` mangler i Zod) — fikses som prereq
4. Botsson har kun `contractCapability` wired — trenger utvidelse
5. HACCP inspector voice mission har ingen tools — kun prompt

### Relevant ADRs

| ADR | Relevans |
|-----|----------|
| ADR-0065 | Operations Cockpit V1 — governs driftsoversikt scope |
| ADR-0066 | Temporal Shift Lock — swap mutations must pass lock |
| ADR-0067 | Smart Cover via Event Engine — binding precedent for swap |
| ADR-0069 | Session Execution Ownership — EF executes, Engine handles side-effects |

### Relevant Learnings

| Learning | Status |
|----------|--------|
| L-0021 | Absence approval flow missing — does NOT block Phase 1 swap (read-only check) |

---

## Build Order

1. **Prereq:** Fix `createDeviation` bug (operations/tools.ts, add `domain` to Zod schema)
2. **Feature 1:** Renholdssjekker — lowest risk, produces data others consume
3. **Feature 2:** Driftsoversikt — enhancement of existing page, consumes cleaning data
4. **Feature 3:** Skiftbytte — most complex, requires engine_process blueprint

All three can be built in parallel after prereq, with clear file boundaries:
- Agent A (Cleaning): `/dashboard/hms/`, procedure CRUD, session_hook wiring
- Agent B (Operations): `/dashboard/operations/`, `use-operations-data.ts`
- Agent C (Swap): `engine_process` blueprint, `packages/` validation logic, `/dashboard/schedule/` context menu

---

## Prereq: Fix createDeviation Bug

**File:** `packages/ai/src/capabilities/operations/tools.ts`
**Problem:** `domain` field missing from Zod schema. `deviation.domain` is NOT NULL in database. Every call to `createDeviation` will fail with constraint violation.
**Fix:** Add `domain: z.enum(['safety', 'customer', 'procedure', 'system', 'material'])` to the tool's Zod schema and pass it in the insert payload.

---

## Feature 1: Renholdssjekker

### Principle

No new tables. The governance stack (procedure + procedure_step + routine + session_hook + session_task) provides everything needed. This is configuration + UI work.

### Existing Infrastructure Used

| Table | Role in Cleaning |
|-------|-----------------|
| `procedure` | Checklist definition (type = `'maintenance'`) |
| `procedure_step` | Individual checkpoints (title, description, step_order, is_required) |
| `routine` | Scheduling (trigger_type, trigger_config with time/frequency) |
| `session_hook` | Lifecycle binding (hook_type = `'pre_open'` or `'close'`) |
| `session_task` | Runtime execution record (status, completed_by, completed_at, evidence, is_compliance_required) |
| `deviation` | Auto-flagged on failure (domain = `'procedure'`) |

### Admin Flow (Web)

1. Navigate to HMS > Governance
2. "Ny prosedyre" > select type `maintenance`
3. Add checkpoint rows as `procedure_step` entries:
   - Title (e.g. "Rengjor kjokkenbenk")
   - Description (valgfri instruksjon)
   - `is_required` flag (Mattilsynet-krav)
   - Sort order
4. Configure `routine` with:
   - `trigger_type = 'scheduled'`
   - `trigger_config` JSONB: `{ "time": "07:00", "frequency": "daily" }`
   - `assigned_to_type = 'team'` / `'role'`
5. Link via `session_hook`:
   - `hook_type = 'pre_open'` (or `'close'` for evening cleaning)
   - `linked_procedure_id` = the procedure
   - `department_id` = target department
   - `trigger_offset_min` = 0 (at session lifecycle point)

### Employee Flow (Mobile-First)

1. `department_session` opens > `session_hook` fires > `session_task` rows created with `is_compliance_required = true`
2. Employee opens TaskFeed > sees cleaning checklist grouped as a single expandable card
3. Taps to open > dedicated checklist view (NOT just task cards):
   - Full-screen scrollable list
   - Each checkpoint: large checkbox (48px touch target), title, optional instruction
   - Optional: photo capture per checkpoint > stored in `session_task.evidence` JSONB
4. All checkpoints checked > "Signer og fullfour" button
5. Signing = `completed_by` (from `auth.uid()`) + `completed_at` (timestamp) — auth-identity based, no drawn signature
6. Incomplete checklist at tidsvindu expiry > `session_task.status = 'overdue'`

### Deviation Integration

- Failed checkpoint: employee can flag directly > creates `deviation` with:
  - `domain = 'procedure'`
  - `source_task_id` = the session_task
  - `session_id` = current department_session
  - `severity` = employee chooses (default `'medium'`, `'high'` for compliance items)
- `blocks_day_approval = true` when `is_compliance_required = true` AND severity >= `'high'`
- Deviation appears in DeviationKanban immediately (existing flow, no changes needed)
- Missing checklist (never started) at session close > auto-generate deviation with `domain = 'procedure'`, `severity = 'high'`

### History / Audit Trail

- Admin sees completed checklists in HMS > Drift > `DriftSessionTable`
- Filter by `session_hook.linked_procedure_id` to isolate cleaning tasks
- Each row: date, session, who signed, completion time, evidence count
- Mattilsynet audit: complete trail via `session_task` (who, what, when) + linked deviations

### UI Components

**Web (Admin):**
- Extend existing governance CRUD in `/dashboard/hms/governance/` to handle maintenance procedure creation
- Procedure detail view: existing `ProcedureDetailTabs` (Overview + Steps + Quiz + Confirmation)
- Hook configuration: new section in procedure detail for linking to `session_hook`

**Mobile (Employee):**
- New: `ChecklistView` component in `apps/mobile/src/components/task/`
  - Renders `procedure_step` rows as interactive checklist
  - Distinct from TaskModal (which is for single tasks)
  - Evidence capture via camera
  - Progress bar showing X/Y completed
  - Completion animation: card contracts, green checkmark scales in (Nordic Split spring: stiffness 35, damping 22, mass 2.2)

**Shared (packages/):**
- `useChecklistTasks()` hook — fetches session_tasks linked to maintenance procedures
- `useCompleteCheckpoint()` mutation — marks individual step complete
- `useSignChecklist()` mutation — marks entire checklist signed

### Telemetry

| Event | Trigger | Destinations |
|-------|---------|-------------|
| `checklist.started` | Employee opens checklist | PostHog + activity_trail |
| `checklist.step_completed` | Checkpoint checked | activity_trail |
| `checklist.completed` | All steps done + signed | PostHog + activity_trail + engine_event |
| `checklist.overdue` | Tidsvindu expired, not completed | PostHog + activity_trail + engine_event |
| `checklist.deviation_flagged` | Employee flags failed checkpoint | PostHog + activity_trail + engine_event |

### i18n Keys

Namespace: `cleaning` in `packages/i18n/locales/{nb,en}/`
- `cleaning.newProcedure`, `cleaning.checkpoint`, `cleaning.signAndComplete`
- `cleaning.overdue`, `cleaning.completed`, `cleaning.deviationFlagged`

---

## Feature 2: Driftsoversikt (Operations Enhancement)

### Principle

Enhancement of existing `/dashboard/operations/` page (447 lines), NOT a new page. Adds HACCP and cleaning status. Fixes existing i18n and color violations.

### Existing Page: Aktiv Pipeline

Currently shows 6 KPI cards:
1. Fullfouring (Task Completion %)
2. Stressnivaå (Stress Level)
3. Forfalt (Overdue Tasks)
4. Kommende (Upcoming)
5. Til stede (Staff Present)
6. Aktive (Active Tasks)

Plus: department breakdown toggle, revenue vs labor cost chart.

Data hook `useOperationsData()` already queries: department_session, session_task, schedule_shift, deviation, daily_reconciliation, workspace_budget, shift_cost_snapshot.

### Changes

**Add KPI card 7: Temperatur-status**
- Data: `haccp_log` — latest reading per department/CCP
- Display: "OK" (green) or "Avvik" (red) + time since last reading
- Warning: if last reading > 2 hours old, show amber indicator
- Click: navigates to HMS HACCP view

**Add KPI card 8: Renholdssjekk-status**
- Data: `session_task` WHERE linked to `procedure_type = 'maintenance'` via `session_hook`
- Display: "X/Y fullfort" with progress indicator
- Click: navigates to HMS Drift filtered on cleaning

**Enhance deviation card:**
- Show severity breakdown (critical/high/medium/low counts)
- Click: navigates to HMS > Avvik (DeviationKanban)

**Fix existing violations:**
- Replace 10+ hardcoded Norwegian strings with i18n keys
- Replace hardcoded zinc/emerald/orange colors with CSS variables (--background, --foreground, --warning, --success, --destructive, --muted-foreground)

### Data Hook Changes

`useOperationsData()` (`_hooks/use-operations-data.ts`) gets two new parallel queries:

```typescript
// New query: HACCP status
const haccp = supabase
  .from('haccp_log')
  .select('department_id, temperature, is_within_range, logged_at, ccp_reference')
  .eq('workspace_id', wsId)
  .gte('logged_at', todayStart)
  .order('logged_at', { ascending: false });

// New query: Cleaning checklist status
const cleaning = supabase
  .from('session_task')
  .select('id, status, completed_at, session_hook:session_hook_id(linked_procedure_id)')
  .eq('workspace_id', wsId)
  .in('department_session_id', sessionIds)
  .not('session_hook_id', 'is', null);
// Filter client-side for procedure_type='maintenance'
```

Both added to existing `Promise.all()`.

### Layout

Existing 6 cards + 2 new = 8 cards. Layout:
- Row 1 (4 col): Tasks, Stress, Overdue, Upcoming (existing)
- Row 2 (4 col): Staff, Active, Temperature (new), Cleaning (new)
- Below: Department breakdown + revenue chart (existing)

### Mobile

Existing `apps/mobile/app/(app)/(home)/operations.tsx` gets the same two new data points added to its bento-feed layout. Data hooks shared from `packages/`.

### Telemetry

No new telemetry events — page views already tracked. HACCP and cleaning data emit their own events when created.

---

## Feature 3: Skiftbytte

### Principle

Shift swap is a workflow, not a table. Uses `engine_process` / `engine_state` per ADR-0067. Final mutation lands on `schedule_shift`. Temporal lock (ADR-0066) enforced.

### Cascade Placement

| Dimension | Role |
|-----------|------|
| **D2 Resource** | Input — employee availability and reassignment |
| **D3 Rules** | Validation — qualification, hours, delt dagsverk (Riksavtalen) |
| **C4 Governance** | Gate — manager approval via `engine_authority_config` |
| **D6 Production** | Output — `schedule_shift.employee_id` mutated |
| **C3 Commercial** | Side-effect — `shift_cost_snapshot` recalculated on tariff change |

### Engine Process Blueprint

```
engine_process:
  name: 'shift_swap'
  description: 'Mutual shift exchange between two employees with manager approval'
  steps:
    1. initiate      — requester creates swap request
    2. validate      — D3 rules check (immediate)
    3. await_recipient — wait for target employee response
    4. await_manager  — wait for manager approval
    5. execute        — mutate schedule_shift records
    6. notify         — notify all parties of outcome
```

### Engine State Context Data

```typescript
// Zod-validated, lives in engine_state.context_data JSONB
interface ShiftSwapContext {
  // Parties
  requester_profile_id: string;   // UUID
  target_profile_id: string;      // UUID

  // Shifts
  requester_shift_id: string;     // UUID — the shift being given away
  target_shift_id: string;        // UUID — the shift offered back (mutual exchange)

  // Type
  swap_type: 'mutual_exchange';   // Phase 1 only supports mutual

  // Optional
  reason?: string;

  // Validation result (populated at step 2)
  validation_result: {
    eligible: boolean;
    blockers: string[];            // Hard blocks (overlap, lock, qualification)
    warnings: string[];            // Soft warnings (delt dagsverk, hours near limit)
    tariff_delta?: number;         // Cost change in NOK
  };

  // Status tracking
  status: 'pending_recipient' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled' | 'executed';
  rejected_by?: string;           // UUID
  rejection_reason?: string;
  executed_at?: string;            // ISO timestamp
}
```

### Validation Rules (D3)

Executed at request time AND re-validated at approval time:

| Check | Source | Blocks? |
|-------|--------|---------|
| **Temporal lock** | ADR-0066 `enforce_schedule_shift_temporal_lock()` | Yes — shift started or passed |
| **Overlap** | `schedule_shift` WHERE employee + date + time range | Yes — target has conflicting shift |
| **Qualification** | `position_id` match between shifts | Yes — target lacks required position |
| **Absence** | `schedule_absence` for shift_date range | Yes — either party has active absence |
| **Weekly hours** | Aggregated `schedule_shift` per ISO week | Warning — approaching/exceeding 37.5t |
| **11-hour rest** | Previous/next shift gap for target | Warning — rest period < 11 hours |
| **Delt dagsverk** | Riksavtalen: gap > 2 hours between shifts | Warning — triggers +28 kr/t supplement |

Validation logic lives in `packages/` (shared, not `apps/web/`).

### RLS and Access Control

Employees cannot UPDATE `schedule_shift` (admin-only RLS). Solution: SECURITY DEFINER RPCs.

```sql
-- Employee initiates swap
CREATE FUNCTION public.initiate_shift_swap(
  p_requester_shift_id UUID,
  p_target_profile_id UUID,
  p_target_shift_id UUID
) RETURNS UUID  -- returns engine_state.id
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate auth.uid() owns p_requester_shift_id
  -- Run D3 validation
  -- Create engine_state with context_data
  -- Return engine_state.id
END;
$$;

-- Target responds
CREATE FUNCTION public.respond_to_shift_swap(
  p_swap_id UUID,       -- engine_state.id
  p_accepted BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate auth.uid() = context_data.target_profile_id
  -- Update engine_state.context_data.status
  -- If rejected: set status='rejected', rejected_by, rejection_reason
  -- If accepted: set status='pending_manager', notify manager
END;
$$;

-- Manager approves/rejects
CREATE FUNCTION public.approve_shift_swap(
  p_swap_id UUID,
  p_approved BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate auth.uid() is admin/manager in workspace
  -- Re-validate D3 rules (state may have changed)
  -- If rejected: set status='rejected'
  -- If approved:
  --   Swap employee_id on both schedule_shift records
  --   Recalculate shift_cost_snapshot if tariff differs
  --   Set status='executed', executed_at=now()
  --   Notify all parties
END;
$$;
```

### Approval Flow

```
Ansatt A                     Ansatt B                     Leder
   |                            |                           |
   |-- initiate_shift_swap() -->|                           |
   |   [D3 validation runs]    |                           |
   |   [engine_state created]  |                           |
   |                     [push notification]                |
   |                            |                           |
   |                  respond_to_shift_swap(accepted=true)  |
   |                            |----[push notification]--->|
   |                            |                           |
   |                            |     approve_shift_swap(approved=true)
   |                            |                           |
   |              [schedule_shift.employee_id swapped]      |
   |              [shift_cost_snapshot recalculated]        |
   |              [all three notified]                      |
```

### UI

**Web — Schedule View (`/dashboard/schedule/`):**

- Shift card: add `ArrowLeftRight` icon (Lucide) in trailing edge
  - Only visible on published shifts assigned to an employee
  - Admins see it on any shift; employees only on their own shifts
- Click icon > dialog:
  - Select colleague from eligible list (filtered by D3 validation)
  - Each row: avatar, name, position, compatible shifts
  - Select target shift > show validation result (blockers, warnings, tariff delta)
  - Confirm > calls `initiate_shift_swap()`
- Pending swaps: amber highlight on affected shifts in week grid
- Manager view: "Ventende bytter" filter/section with inline approve/reject buttons
  - Shows: both shifts, both employees, validation result, cost impact
  - Approve/reject with optional reason

**Mobile — Primary Employee Surface:**

- My Shifts view > shift card > long press or swipe action > "Foreslaa bytte"
- Bottom sheet colleague picker (existing sheet pattern)
- Push notification to target > opens accept/reject dialog
- Push notification to manager > opens approval card with full context
- Swap status visible on shift card as StatusBadge

**Status Badges:**

| Status | Color Token | Icon (Lucide) | Label (i18n) |
|--------|-------------|---------------|-------------|
| Pending recipient | `--warning` | `Clock` | `swap.pendingRecipient` |
| Accepted (awaiting manager) | `--info` | `UserCheck` | `swap.accepted` |
| Approved | `--success` | `CheckCircle` | `swap.approved` |
| Rejected | `--destructive` | `XCircle` | `swap.rejected` |
| Cancelled | `--muted-foreground` | `Ban` | `swap.cancelled` |

### Agent Integration

**New capability:** `packages/ai/src/capabilities/shift-swap/`
- `index.ts` — CapabilityDefinition
- `tools.ts` — requestSwap, getSwapRequests, getSwapEligibility, respondToSwap

**Botsson update:** Add to `BOTSSON_CAPABILITIES` array:
- `operationsCapability` (already exists, not wired)
- `scheduleCapability` (already exists, not wired)
- `guardianCapability` (already exists, not wired)
- `shiftSwapCapability` (new)

**Schedule agent update:** System prompt addition acknowledging swaps exist, so agent does not create/modify shifts with pending swap requests.

**Voice mission update:** `shift-assistant` in `missions/registry.ts` gets swap client tools.

**HACCP inspector update:** Add client tools for checklist execution (Phase 2 — after renholdssjekker data layer is stable).

### Telemetry

| Event | Trigger | Destinations |
|-------|---------|-------------|
| `shift.swap_requested` | Employee initiates | PostHog + activity_trail + engine_event |
| `shift.swap_accepted` | Recipient accepts | PostHog + activity_trail + engine_event |
| `shift.swap_rejected` | Recipient or manager rejects | PostHog + activity_trail |
| `shift.swap_approved` | Manager approves | PostHog + activity_trail + engine_event |
| `shift.swap_executed` | Shifts mutated | PostHog + activity_trail + engine_event + logger |
| `shift.swap_cancelled` | Initiator cancels | PostHog + activity_trail |

### i18n Keys

Namespace: `swap` in `packages/i18n/locales/{nb,en}/`
- `swap.requestSwap`, `swap.selectColleague`, `swap.confirmSwap`
- `swap.pendingRecipient`, `swap.accepted`, `swap.approved`, `swap.rejected`, `swap.cancelled`
- `swap.blockerOverlap`, `swap.blockerQualification`, `swap.blockerLocked`
- `swap.warningHours`, `swap.warningRest`, `swap.warningSplitShift`
- `swap.tariffDelta`, `swap.approve`, `swap.reject`

### Phase 1 Limitations

- **Mutual exchange only** — both parties swap shifts. One-way cover (take without giving back) = Phase 2
- **No cascade swap** — A swaps with B who swaps with C = Phase 2
- **Tariff delta displayed but not blocking** — manager sees cost change, can still approve
- **No absence approval dependency** — Phase 1 checks existing `schedule_absence` records (read-only), does not require absence approval workflow

---

## Cross-Cutting Concerns

### Mobile Parity

Per CLAUDE.md: data layer and hooks in `packages/`, not `apps/web/`. All three features:

| Feature | Shared package | Web UI | Mobile UI |
|---------|---------------|--------|-----------|
| Renholdssjekker | `useChecklistTasks()`, `useCompleteCheckpoint()`, `useSignChecklist()` | Admin CRUD in `/hms/governance/` | ChecklistView in TaskFeed |
| Driftsoversikt | Extended `useOperationsData()` with HACCP + cleaning queries | Enhanced `/operations/` page | Enhanced operations.tsx bento-feed |
| Skiftbytte | `useSwapRequests()`, `useSwapEligibility()`, validation logic | Schedule view extension | Bottom sheet + push notification flow |

### Design System (Nordic Split)

- All new components use glassmorphism card: `bg-background/80 backdrop-blur-xl` + 1px gradient border + noise
- All animations: Nordic Split springs (stiffness 30-45, damping 20-24, mass 2-2.5)
- All status badges: semantic color tokens + Lucide icon + text label (accessibility: never color-only)
- All touch targets: minimum 44x44px (48px preferred for checklists)
- `useReducedMotion` respected on all animated elements

### i18n

All labels via `packages/i18n/locales/{nb,en}/`. Three new namespaces:
- `cleaning.*` — checklist UI
- `operations.*` — enhanced pipeline (replaces hardcoded strings)
- `swap.*` — shift swap UI

### Telemetry

Every mutation emits via `@smartout/telemetry`. New events registered in `packages/telemetry/src/registry.ts`:
- 5 checklist events (started, step_completed, completed, overdue, deviation_flagged)
- 6 swap events (requested, accepted, rejected, approved, executed, cancelled)
- 0 new operations events (page views already tracked, data sources emit their own)

### RLS

- Renholdssjekker: existing session_task RLS (workspace members can read/update)
- Driftsoversikt: read-only queries, existing RLS sufficient
- Skiftbytte: SECURITY DEFINER RPCs (employees cannot modify schedule_shift directly)

---

## Open Questions (Deferred to Phase 2)

1. One-way cover (take shift without giving back) — extends swap_type enum
2. Cascade swaps (A↔B↔C) — requires engine_process chaining
3. Offline tolerance for checklists (kitchen loses signal) — sync queue + pending indicator
4. HACCP inspector voice tools for cleaning verification
5. Guardian `operations` domain for automated alert signals
6. Photo-mandatory checkpoints (some Mattilsynet requirements)
7. Enterprise audit export (PDF of cleaning history for inspections)

---

## Files to Create or Modify

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_shift_swap_rpcs.sql` | RPC functions for swap initiation/response/approval |
| `packages/ai/src/capabilities/shift-swap/index.ts` | Capability definition |
| `packages/ai/src/capabilities/shift-swap/tools.ts` | Agent tools |
| `apps/mobile/src/components/task/ChecklistView.tsx` | Mobile checklist UI |
| `packages/i18n/locales/nb/cleaning.json` | Norwegian cleaning labels |
| `packages/i18n/locales/en/cleaning.json` | English cleaning labels |
| `packages/i18n/locales/nb/swap.json` | Norwegian swap labels |
| `packages/i18n/locales/en/swap.json` | English swap labels |

### Modified Files

| File | Change |
|------|--------|
| `packages/ai/src/capabilities/operations/tools.ts` | Fix createDeviation bug (add domain to Zod) |
| `packages/ai/src/agents/botsson.ts` | Wire operations + schedule + guardian + swap capabilities |
| `packages/ai/src/missions/registry.ts` | Add swap client tools to shift-assistant |
| `packages/ai/src/capabilities/types.ts` | Add `shift_swap` to CapabilityName |
| `packages/ai/src/capabilities/registry.ts` | Register shift_swap capability |
| `packages/telemetry/src/registry.ts` | Register 11 new events |
| `apps/web/src/app/dashboard/operations/page.tsx` | Add HACCP + cleaning cards, fix i18n + colors |
| `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts` | Add HACCP + cleaning queries |
| `apps/web/src/app/dashboard/schedule/` | Swap action on shift card, pending swaps section |
| `apps/web/src/app/dashboard/hms/governance/` | Maintenance procedure CRUD enhancement |
| `apps/mobile/src/components/task/TaskFeed.tsx` | Checklist grouping for maintenance tasks |
| `apps/mobile/app/(app)/(home)/operations.tsx` | Add HACCP + cleaning to bento feed |

### Seed Data (for local development / supabase/seed.sql)

- `engine_process` blueprint row for `shift_swap` (name, description, steps JSONB)
- Example maintenance procedure with 5 procedure_steps for kitchen cleaning
- Example session_hook linking cleaning procedure to `pre_open` for department "Kjokken"
- Example routine with `trigger_type = 'scheduled'`, `trigger_config = '{"time":"07:00","frequency":"daily"}'`

---

## ADR Required

**ADR-XXXX: Shift Swap as Event Engine Workflow**
- Reaffirms ADR-0067 for swap use case
- Documents engine_process blueprint shape
- Documents ShiftSwapContext interface
- Documents RPC-based access control pattern for employee-initiated workflows
