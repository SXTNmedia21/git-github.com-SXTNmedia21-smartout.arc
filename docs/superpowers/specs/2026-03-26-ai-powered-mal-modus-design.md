---
title: "AI-Powered Mal-modus — Ghost Shifts, Confirmation Popup, AI Scheduling"
status: draft
created: 2026-03-26
updated: 2026-03-26
module: schedule
tags: [schedule, ai, mal-modus, ghost-shifts, recommendations, voice-tools]
---

# AI-Powered Mal-modus

## Summary

Extends the mal-modus template schedule view with three capabilities:

1. **Confirmation Popup** — Generic Promise-based dialog for all AI actions requiring user approval
2. **Ghost Shifts** — Visual proposals in the MalGrid that managers approve/reject
3. **AI Recommendation Engine** — Emma analyzes employees and suggests optimal template assignments

**Core principle:** Emma always proposes, never executes directly. Every action goes through: popup confirmation → ghost shifts → manager approval → real shifts.

**Phasing strategy (per council):** Ship ghost shifts + confirmation popup first (Phase A). Add AI scoring as a layer on top (Phase B). Template recommendation comes last (Phase C).

## Phase A: Confirmation Popup + Ghost Shifts

### Confirmation Popup

A generic, Promise-based confirmation dialog that any voice tool can call before performing an action.

**API:**

```typescript
// In bridge context
const confirmed = await requestConfirmation(
  "Fyll uke 14 fra mal", // title
  "35 vakter vil opprettes", // description
);
// confirmed: true | false
```

**Implementation:**

- State: `{ pending: { title, description, resolve } | null }` in bridge
- Component: `AgentConfirmationDialog` — shadcn `AlertDialog` with title, description, Godkjenn/Avslå buttons
- On Godkjenn: `resolve(true)`, clear state
- On Avslå: `resolve(false)`, clear state
- Renders inside `ScheduleVoiceToolsBridge` (already at page level)

**File:** `apps/web/src/app/dashboard/schedule/_components/agent-confirmation-dialog.tsx`

Not schedule-specific by design — can be lifted to `walkAi/` later. For now, lives in the bridge because that's where voice tools execute.

### Ghost Shifts in MalGrid

#### Proposal Type Extension

Extend existing `ShiftProposalCreate` in `schedule-types.ts`:

```typescript
type ShiftProposalCreate = {
  type: "create";
  employeeId: string;
  employeeName: string;
  dateId: string;
  startTime: string;
  endTime: string;
  role?: string;
  templateShiftId?: string; // NEW — links proposal to a MalGrid column
};
```

`templateShiftId` is optional so legacy grid proposals still work without it. When present, `MalShiftCell` uses it + `dateId` to place the ghost tag in the correct cell.

#### Ghost Tag Component

**File:** `apps/web/src/app/dashboard/schedule/_components/mal-ghost-tag.tsx`

Visually distinct from `MalEmployeeTag`:

- `opacity-50` base, pulsating subtle glow (`animate-pulse` on the border)
- Stipled (dashed) border instead of solid
- Same color variant system as employee tags but desaturated
- On hover: show ✓ (godkjenn, green) and ✕ (avslå, red) action buttons
- Click ✓ → calls `onApprove(proposalId)` → creates real `schedule_shift` via `useAssignEmployee`
- Click ✕ → calls `onReject(proposalId)` → removes from proposal context

#### MalShiftCell Integration

`MalShiftCell` reads proposals from `AgentProposalsContext`:

```typescript
const { proposals } = useAgentProposals();
const cellProposals = proposals.filter(
  (p) =>
    p.type === "create" && p.dateId === cell.dateId && p.templateShiftId === cell.templateShiftId,
);
```

Renders ghost tags after employee tags, before empty slot placeholders:

1. Employee tags (real assignments)
2. Ghost tags (proposals)
3. Empty slot tags ("+ Tilordne")

#### Bulk Actions

Add to MalGrid action bar when proposals exist:

```
[Godkjenn alle forslag (12)]  [Forkast alle]
```

- "Godkjenn alle" → iterates proposals, creates `schedule_shift` for each, clears proposals
- "Forkast alle" → clears all proposals

#### Voice Tool Integration

Existing voice tools (`createShift`, `updateShift`) already go through `addProposal` in ghost mode. The only change: when in mal-modus, voice tools include `templateShiftId` in the proposal by resolving which template shift column matches the role/time.

**Resolution logic:** Given a role name from voice ("legg til Erik som kokk på tirsdag"), match against active template's `schedule_template_shift` rows by role fuzzy match. If ambiguous (multiple columns with "Kokk"), include the time to disambiguate.

---

## Phase B: AI Recommendation Engine

### Architecture

Pure functions in `apps/web/src/lib/cascade/` with a data loader and a scoring engine.

```
apps/web/src/lib/cascade/
  recommend-assignments.ts     — Pure scoring function
  load-recommendation-context.ts — DB queries for employee data
```

Lives in cascade because it's a cross-dimension computation (D2 Resource × D3 Rules × D4 Demand).

### Data Loader

`loadRecommendationContext(workspaceId, departmentId, weekStart)` fetches:

| Data              | Source                                                                      | Purpose                  |
| ----------------- | --------------------------------------------------------------------------- | ------------------------ |
| Employees         | `profile` + `employment_contract` + `employee_payroll_profile`              | Who is available         |
| Absences          | `schedule_absence` WHERE status != 'rejected'                               | Who is unavailable       |
| Existing shifts   | `schedule_shift` for target week                                            | Who is already scheduled |
| Historical shifts | `schedule_shift` for past 8 weeks                                           | Fairness distribution    |
| Contracted hours  | `employee_payroll_profile.agreed_weekly_hours`                              | Hard ceiling             |
| Seniority         | `employee_payroll_profile.seniority_start_date` + `sector_experience_years` | Ranking                  |
| Competence        | `employment_contract.position_title`                                        | Role matching            |
| Template shifts   | `schedule_template_shift` for active template                               | What slots to fill       |
| AML rules         | `framework_rule` WHERE category = 'labor_law'                               | Hard gates               |
| Tariff rates      | via `getTariffContext()`                                                    | Cost estimation          |
| Hourly rate       | `employment_contract.hourly_rate`                                           | Base cost                |

### Hard Gates (Eliminators)

These are **blocking** — a candidate who fails any gate is excluded entirely. No scoring override.

| Gate             | Rule                                                                  | Source                     |
| ---------------- | --------------------------------------------------------------------- | -------------------------- |
| Availability     | Not on `schedule_absence` for that date                               | `schedule_absence`         |
| Contracted hours | `scheduled_hours_this_week + shift_hours <= agreed_weekly_hours`      | `employee_payroll_profile` |
| AML: Rest period | Min 11 hours between previous shift end and this shift start          | `schedule_shift`           |
| AML: Daily max   | Shift duration ≤ 9 hours (10 with written agreement)                  | `employment_contract`      |
| AML: Weekly rest | Min 35 hours consecutive rest per 7-day period                        | `schedule_shift`           |
| AML: Minor rules | Under 18: no work after 21:00, max 8h/day, 48h weekly rest            | `profile.date_of_birth`    |
| Competence       | `position_title` must match template shift `role` (fuzzy, normalized) | See competence matching    |
| Already assigned | Not already assigned to this exact slot                               | `schedule_shift`           |

### Competence Matching

Free-text matching of `employment_contract.position_title` against `schedule_template_shift.role`.

**Normalization:** Lowercase, trim, strip diacritics, map common variants:

```
"kokk" = "chef" = "cook" = "kjøkkenmedarbeider"
"servitør" = "kelner" = "server" = "hovmester"
"oppvasker" = "dishwasher"
```

**Manual override (Phase B+):** Add `qualified_profile_ids: string[]` on `schedule_template_shift` — a whitelist of profiles the manager has confirmed are qualified for this slot. When present, replaces fuzzy matching entirely. This addresses the Head Chef concern about prep cook vs. sous chef.

### Soft Scoring (Rankers)

After hard gates filter candidates, remaining are scored:

| Factor            | Weight | Calculation                                                                                                                        |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Hours balance     | 0.40   | `(agreed_hours - scheduled_hours) / agreed_hours` — higher = more hours remaining                                                  |
| Fair distribution | 0.35   | Inverse of historical evening/weekend ratio vs. department average. More past undesirable shifts = lower score (give them a break) |
| Seniority         | 0.15   | Normalized years since `seniority_start_date`. More senior = higher priority for preferred shifts                                  |
| Cost              | 0.10   | Inverse normalized cost (cheaper = slightly preferred). Tiebreaker only — never systematically disadvantages junior staff          |

**Anti-bias safeguard:** Cost factor is capped at 0.10 weight and cannot be the sole differentiator. If two candidates differ only by cost, the cheaper one gets a slight edge. If they differ by fairness, fairness always wins.

**Output:** Ranked list of `{ profileId, score, factors: { hours, fairness, seniority, cost }, gates: { passed: true } }` per template shift slot per day.

### Scoring Function Signature

```typescript
function recommendAssignments(
  context: RecommendationContext,
  template: { shifts: TemplateShift[]; weekStart: string },
): RecommendationResult {
  // Returns: per day × per slot → ranked candidates with scores
}

type RecommendationResult = {
  assignments: Array<{
    dateId: string;
    templateShiftId: string;
    candidates: Array<{
      profileId: string;
      employeeName: string;
      score: number;
      factors: { hours: number; fairness: number; seniority: number; cost: number };
    }>;
    recommended: string; // profileId of top candidate
  }>;
  unfilledSlots: Array<{ dateId: string; templateShiftId: string; reason: string }>;
  warnings: string[]; // "3 slots could not be filled due to insufficient qualified staff"
};
```

### Voice Tools (Phase B)

**`recommendWeekAssignments`** — new voice tool:

```typescript
{
  modelToolName: "recommendWeekAssignments",
  description: "Analyze employees and recommend optimal shift assignments for the current week based on the active template. Considers availability, contracted hours, seniority, competence, fairness, and cost.",
  dynamicParameters: [] // Uses current template + week from MalGrid context
}
```

Implementation flow:

1. Call `loadRecommendationContext()` to gather all data
2. Call `recommendAssignments()` to get ranked results
3. Call `await requestConfirmation(title, description)` with summary
4. If confirmed: create proposals via `addProposal()` for each recommended assignment
5. Ghost shifts appear in MalGrid
6. Manager approves/rejects visually

**`modifyTemplate`** — new voice tool:

```typescript
{
  modelToolName: "modifyTemplate",
  description: "Modify the active template: change shift times, slot counts, or roles. Always requires confirmation.",
  dynamicParameters: [
    { name: "changes", schema: { type: "string", description: "Natural language description of changes" } }
  ]
}
```

Implementation: Emma parses the change request, maps to template_shift mutations, shows popup with diff, applies on confirmation.

### Audit Trail

Every AI recommendation emits telemetry:

```typescript
emit({
  event: "schedule recommendation_generated",
  properties: {
    entity: { entity_type: "template", entity_id: templateId },
    data: {
      week_start: weekStart,
      total_slots: number,
      filled_slots: number,
      unfilled_slots: number,
      scoring_version: "v1",
      factor_weights: { hours: 0.4, fairness: 0.35, seniority: 0.15, cost: 0.1 },
    },
  },
});
```

Per-assignment scores are stored in the proposal metadata (React state) and logged to `activity_trail` when the manager approves. This satisfies AML chapter 8 information requirements for automated decision-making.

---

## Phase C: Template Recommendation (Future)

Emma analyzes department patterns and suggests new templates or modifications to existing ones.

**Triggers:**

- Manager asks: "Emma, lag en mal for helgene"
- Emma proaktiv: detects budget/staffing mismatch over time

**Analysis inputs:**

- Historical `schedule_shift` patterns (roles, times, slot counts)
- `season_budget` targets
- `workspace_budget` per-date targets
- Current template vs. actual usage delta

**Output:** Popup with proposed template definition → on confirm → creates/modifies `schedule_template` + `schedule_template_shift` rows.

**Not designed in detail here** — depends on Phase B data and manager override patterns. Will get its own spec after Phase B ships and we have real usage data.

---

## New Files

### Phase A

| File                                                                            | Responsibility                    |
| ------------------------------------------------------------------------------- | --------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/agent-confirmation-dialog.tsx` | Promise-based confirmation dialog |
| `apps/web/src/app/dashboard/schedule/_components/mal-ghost-tag.tsx`             | Ghost shift tag for MalGrid       |

### Phase B

| File                                                      | Responsibility        |
| --------------------------------------------------------- | --------------------- |
| `apps/web/src/lib/cascade/recommend-assignments.ts`       | Pure scoring function |
| `apps/web/src/lib/cascade/load-recommendation-context.ts` | DB data loader        |

### Files to Modify

| File                                                                              | Change                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`               | Add `templateShiftId` to `ShiftProposalCreate`         |
| `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` | Add confirmation state + dialog rendering              |
| `apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx`              | Render ghost tags from proposals                       |
| `apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx`                    | Bulk approve/reject in action bar                      |
| `apps/web/src/app/dashboard/schedule/_hooks/schedule-tool-definitions.ts`         | Add `recommendWeekAssignments`, `modifyTemplate`       |
| `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`          | Implement new tools                                    |
| `packages/telemetry/src/registry.ts`                                              | Register `recommendation_generated` event              |
| `apps/web/src/lib/cascade/resolve-tariff-rate.ts`                                 | Wire `hourly_rate` as base rate input (fix baseRate=0) |

### Migration (Phase B+)

```sql
ALTER TABLE schedule_template_shift
ADD COLUMN qualified_profile_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN schedule_template_shift.qualified_profile_ids
IS 'Profiles manually confirmed as qualified for this shift type. Empty = use fuzzy position_title matching.';
```

---

## AI Council Validation

Validated against 7 restaurant industry personas. Key outcomes incorporated:

| Concern                   | Resolution                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- |
| AML hard constraints      | Evaluated as eliminators BEFORE proposals, not soft scores                            |
| Contracted hours          | Hard ceiling, not ranking factor                                                      |
| baseRate=0                | Wired to employment_contract.hourly_rate before cost display                          |
| Free-text competence      | Normalization layer + manual qualified_profile_ids override (Phase B+)                |
| Cost bias against juniors | Cost capped at 0.10 weight, cannot be sole differentiator                             |
| Audit/transparency        | Full scoring payload in telemetry + activity_trail                                    |
| Phasing                   | Manual ghost shifts first (A), AI scoring layer (B), template recommendation (C)      |
| Employee visibility       | Ghost shifts only visible to managers until approved. Employees see published shifts. |
| Minor AML rules           | Specific gate for under-18 workers (no 21:00+, max 8h, 48h rest)                      |

## Out of Scope

- Cross-workspace employee sharing
- Employee-facing AI schedule transparency UI (employee sees their own score breakdown)
- Drag-and-drop ghost shift repositioning
- AI auto-scheduling without any human confirmation
- Employee challenge/appeal workflow for AI schedules
- Mobile surface for ghost shifts
