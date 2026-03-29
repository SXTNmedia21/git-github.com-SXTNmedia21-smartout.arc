---
title: Research Results — The Reactive Operations Engine
status: done
updated: 2026-03-20
created: 2026-03-20
module: operations
tags: [research, reactive, operations-engine]
---

# Research Results: The Reactive Operations Engine

> **Date:** 2026-03-20
> **Scope:** Five questions about how to wire Smartout's six systems into one self-running machine.
> **Format:** Pattern name → how it works → real example → Smartout mapping → trade-off. No fluff.

---

## Q1: The Propagation Pattern — HOW CHANGES FLOW

### Winner: **Desired State Reconciliation with Plan/Apply Gate**

This is a hybrid of two patterns. Neither alone is sufficient.

**Pattern A: Desired State Reconciliation** (Kubernetes)
You declare what you want ("Kitchen opens 09:00-22:00 on Mondays in Sommersesong"). The system continuously compares desired state against actual state and reconciles the difference. You never say "change shift X from 22:00 to 18:00" — you say "Kitchen now closes at 18:00" and the system figures out everything that needs to change.

**Pattern B: Plan/Apply Gate** (Terraform)
Before any reconciliation happens, the system computes a diff: "Here's what WOULD change if I reconcile." The human reviews the diff. If approved, the system applies it transactionally. Every change is logged with before/after state.

**Real-world example:** Terraform. You edit a config file (desired state). Run `terraform plan` — it shows you what will be created, modified, or destroyed. You review. Run `terraform apply` — it executes. State file records everything.

**How it maps to Smartout:**
The `department_schedule` table IS the desired state declaration. "Kitchen: Mon 09:00-22:00." When you change that, a `cascade-preview` Edge Function computes the diff across all dependent entities (sessions, shifts, hooks, tasks, notifications). The admin reviews the preview. On confirmation, `cascade-apply` executes the reconciliation transactionally. `activity_trail` records every change with before/after. `engine_event` emits for workflow automation.

The system already has the right primitives: `engine_event` (immutable log), `activity_trail` (audit), `dispatch_push_notification` (notification pattern), `emit()` (event routing). What's missing is the diff computation and the transactional apply.

**Trade-off:** More complex than pure push (event sourcing) or pure pull (computed views). But it's the only pattern that gives you preview-before-commit AND full audit trail AND human control. Event sourcing alone would auto-apply without preview. Reactive spreadsheet would lack audit. This hybrid gives you all three.

### Rejected alternatives

| Pattern                  | Why not                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Pure event sourcing**  | No preview. Changes apply immediately. Rollback is complex. Overkill for our scale.                          |
| **Saga pattern**         | Designed for distributed transactions across services. We're in one database. Unnecessary complexity.        |
| **Reactive spreadsheet** | No audit trail. No preview. Changes propagate instantly. Good for dashboards, wrong for operational changes. |
| **CQRS**                 | Useful if read/write patterns diverge massively. Ours don't. Adds indirection without benefit.               |
| **Database triggers**    | Can't preview. Can't show diff to user. Fires immediately. No human gate.                                    |

---

## Q2: Time-Segmented Operations — HOW SEASONS HAVE INTERNAL STRUCTURE

### Winner: **Period as a first-class entity with factor inheritance**

**How it works:**
A season contains periods. Each period is a date range with its own set of factors (day weights, hour weights), its own operating hours, and optionally its own team composition and policy emphasis. Factors are inherited: if a period doesn't define its own hour factors, it uses the season-level defaults. If the season doesn't define them, it uses the workspace defaults.

**The inheritance chain:**

```
Workspace defaults (permanent baseline)
  └── Season defaults (override workspace for this season)
        └── Period overrides (override season for this date range)
              └── Date overrides (override everything for this specific day)
```

**Real-world example:** Hotel revenue management. Hotels segment their year into "seasons" (high/shoulder/low) and within each season, they have "day types" (weekday/weekend/event). Rate strategies, staffing levels, and minimum length-of-stay rules all vary by season AND by day type within the season. The math is: `base_rate × season_factor × day_type_factor × demand_adjustment`.

Manufacturing does the same thing with production schedules: "Q4 is high season, but within Q4, the two weeks before Christmas are ultra-peak, and between Christmas and New Year we're on skeleton crew." Each period has different shift patterns, staffing levels, and production targets.

**How it maps to Smartout:**

```
season_period (NEW TABLE)
  period_id        UUID PK
  season_id        UUID FK → season
  workspace_id     UUID FK → workspace
  name             TEXT ("Oppstart", "Høysesong", "Nedtrapping")
  start_date       DATE NOT NULL
  end_date         DATE NOT NULL
  sort_order       INTEGER

  -- Factor overrides (NULL = inherit from season)
  day_factors      JSONB NULL  -- { "0": 1.0, "1": 1.1, ... "6": 2.5 }
  hour_factors     JSONB NULL  -- { "9": 0.4, "10": 0.7, ... "21": 1.1 }

  -- Operational overrides
  operating_hours_override  BOOLEAN DEFAULT false
  -- If true, department_schedule rows with this period_id take precedence

  -- Budget allocation
  revenue_share_pct  DECIMAL  -- what % of season budget goes to this period

  created_at, updated_at
```

The calculation engine becomes: for any given date, find which period it falls in → use period factors (or inherit from season) → compute targets.

**Trade-off:** Adds one table and one inheritance resolution step. But without it, you can't express "July is different from June within the same summer season" — which every restaurant operator knows intuitively. The alternative (flat factors for the whole season + date overrides for exceptions) works for simple cases but breaks down when you have weeks-long periods with consistently different profiles.

### The factor resolution algorithm

```
For a given date D:
1. Find active season where D is between start_date and end_date
2. Find period within that season where D is between period.start_date and period.end_date (if any)
3. Check for date_override on D
4. Resolve factors:
   - Date override factor > Period factor > Season factor > Workspace default
5. Resolve operating hours:
   - date_override hours > period-level department_schedule > season-level department_schedule > default department_schedule
```

---

## Q3: Self-Healing / Self-Evolving (Phase 3+)

**Pattern name:** Closed-Loop Planning (from manufacturing MES)

Plan → Execute → Measure → Compare → Adjust. The `factor_learning` table (already designed in Module 15) stores planned vs actual values per day/hour. After enough data accumulates (90+ days), the system can suggest: "Your Friday factor was 2.2 but actual averaged 2.8 — suggest 2.6 for next season."

**Bootstrap answer:** Industry intelligence packages produce actual `department_schedule` records (not just suggestions) during onboarding. First season factors come from the hospitality package defaults. The system works from day one because it starts with industry-average data, then learns the specific workspace's patterns over time.

**Trade-off:** Simple math (weighted moving average) is sufficient. No ML needed. The risk is over-fitting to a single bad season. Solution: weight recent data more, but never discard old data entirely.

---

## Q4: The Compliance Overlay (Parallel)

**Pattern name:** Policy Enforcement Point (from API gateway architecture)

Compliance is not embedded in the operational chain. It's a gate that the chain passes through at defined checkpoints. Like an API gateway that checks authorization before forwarding a request — the gateway doesn't need to understand the request, it just checks credentials.

**Smartout mapping:** Define enforcement points:

- **Shift assignment:** check readiness score before allowing assignment to a position that requires specific protocols
- **Punch-in:** check readiness before allowing clock-in (configurable: hard block vs soft warning)
- **Task assignment:** check procedure competency before assigning a HACCP task
- **Session sign-off:** check all compliance tasks completed before allowing sign-off

Each enforcement point calls a single function: `checkReadiness(profile_id, required_protocols[])`. The function returns pass/fail + missing items. The calling code decides what to do (block, warn, log). This keeps compliance decoupled from operations — the operational chain doesn't need to know about policies, it just calls the gate.

**Trade-off:** Enforcement points must be explicitly defined. If you forget to add a gate at a new checkpoint, compliance is silently bypassed. Solution: the compliance layer should be auditable — log every gate check, pass or fail, so gaps become visible.

---

## Q5: The Bootstrap Problem (Parallel)

**Pattern name:** Template-Driven Initialization (from CMS/SaaS onboarding)

The industry intelligence engine should produce **actual database records**, not advisory suggestions. When a restaurant workspace is created:

1. Industry detection → hospitality package selected
2. Package produces: department records, position records, default `department_schedule` rows (Mon-Sat 10:00-22:00 for Kitchen, 10:30-23:00 for Service, etc.), default session_hook configurations (pre_open, open, pre_close, close per department), default policies and protocols from the restaurant policy catalog
3. Admin confirms/adjusts via wizard (current flow)
4. The cascade engine now has data to work with — even before the first shift is created

**Trade-off:** Opinionated defaults can feel wrong for non-standard restaurants. Solution: industry intelligence packages are templates, not mandates. The wizard always shows the defaults and lets the admin modify before saving. But the KEY insight is: defaults must be saved as actual records, not held in temporary state. The cascade engine needs rows to cascade from.

---

## Summary Decision Table

| Question          | Pattern                           | Key insight                                              | Immediate action                                               |
| ----------------- | --------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Q1: Propagation   | Desired state + plan/apply        | Preview diff before applying. Terraform for restaurants. | Build `cascade-preview` + `cascade-apply` Edge Functions       |
| Q2: Time Segments | Period as entity with inheritance | Seasons have ramp-up / peak / wind-down phases           | Add `season_period` table, update factor resolution            |
| Q3: Self-Healing  | Closed-loop planning              | Planned vs actual → factor suggestions                   | `factor_learning` already designed. Build after cascade exists |
| Q4: Compliance    | Policy enforcement point          | Gate pattern, not embedded logic                         | Define enforcement points, implement `checkReadiness()`        |
| Q5: Bootstrap     | Template-driven initialization    | Industry packages must produce real DB records           | Update onboarding wizard to save defaults as records           |
