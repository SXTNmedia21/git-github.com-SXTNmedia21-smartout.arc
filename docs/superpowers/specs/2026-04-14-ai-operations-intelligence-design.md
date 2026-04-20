---
title: "AI Operations Intelligence — Design Spec"
status: review
updated: 2026-04-14
created: 2026-04-14
module: ai
tags: [ai, operations, intelligence, hospitality, capability, mobile]
---

# AI Operations Intelligence — Design Spec

> Council #1 reviewed 2026-04-14 (APPROVE WITH CHANGES). ADR-0088.
> Council #2 spec review 2026-04-14 (APPROVE WITH CHANGES). 13 issues resolved below.
> Each phase gets its own implementation plan. This spec covers all 3 phases architecturally.

## 1. Problem Statement

Smartout's Module 4 §18 and Module 5 §8 describe a six-function AI intelligence layer (TRIAGE, MONITOR, COMPILE, PREDICT, ACT, LEARN) for hospitality operations. The current codebase has foundational infrastructure (department_session, session_task, session_hook, deviation tables + 5 employee-scoped operations tools + shift briefing composer) but lacks the intelligence layer that makes sessions operationally smart.

**Gap:** Sessions exist as data containers. No system watches, reacts, compiles, or learns from operational data in real time.

## 2. Design Principles (from Council)

1. **Cascade consumer, not dimension** — reads D1/D2/D3/D6/K1b, never writes cascade state
2. **No new event tables** — all telemetry via `emit()` → `engine_event` (ADR-0004, ADR-0088)
3. **No new config tables** — operations AI config as `policy_type: 'ai_operations'` in governance model
4. **Capability pattern** — discrete capabilities, not monolithic daemon
5. **Event-driven, not daemon** — Event Engine triggers + scheduled Edge Functions
6. **Advisory PREDICT** — never mutates cascade, read-only signals
7. **K1b persistence** — LEARN writes to `engine_memory` with retention policy
8. **Mobile-first** — 80%+ interactions on phone, one-handed, mid-shift
9. **Persona ≠ daemon** — Mr. Botsson (presentation) is separate from intelligence (computation)
10. **Every tool emits** — all COMPILE, TRIAGE, MONITOR, ACT tools call `emit()` on execution
11. **i18n mandatory** — no hardcoded Norwegian strings; use i18n keys throughout

## 3. Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │     Event Engine (existing)      │
                    │  engine_event ← emit() triggers  │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │   TRIAGE    │  │   MONITOR   │  │    ACT      │
     │ classify +  │  │ gap detect  │  │ auto-create │
     │ route       │  │ anomaly     │  │ tasks,      │
     │ (ops-intel) │  │ overdue     │  │ escalate    │
     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
            │                │                │
            ▼                ▼                ▼
     ┌─────────────────────────────────────────────┐
     │        operations-intelligence              │
     │        (new capability, manager scope)       │
     └──────────────────┬──────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
  ┌────────────┐ ┌────────────┐ ┌────────────┐
  │  COMPILE   │ │  PREDICT   │ │   LEARN    │
  │ briefings  │ │ advisory   │ │ K1b memory │
  │ (in comms  │ │ signals →  │ │ patterns   │
  │ capability)│ │ eng_memory │ │            │
  └────────────┘ └────────────┘ └────────────┘

  Background automation (NOT capability tools):
  ├── DB trigger on engine_event → triage Edge Function
  ├── Periodic Edge Function (15 min) → operations evaluator
  ├── pg_cron → Day Brief Edge Function (per-department sweep)
  ├── pg_cron → PREDICT analysis (weekly)
  └── pg_cron → LEARN pattern extraction + retention cleanup (weekly)
```

### 3.1 Two Invocation Modes

The intelligence layer has two distinct invocation modes (Council #2 fix):

**Background automation** — headless processes triggered by DB events or cron:
- DB trigger on `engine_event` insert → triage Edge Function (classify + route)
- Periodic Edge Function (every 15 min) → operations evaluator (gap/anomaly checks)
- pg_cron → Day Brief compilation, PREDICT analysis, LEARN extraction

**On-demand tools** — LLM-invoked during manager conversations:
- Manager asks "how's the kitchen session going?" → `get_session_intelligence` tool
- Manager asks "what anomalies happened today?" → `query_monitor_alerts` tool
- Manager asks "compile a brief for tomorrow" → `compile_day_brief` tool

These share data and logic but have different entry points and authority gates.

### 3.2 Trigger Loop Guard

To prevent MONITOR → ACT → creates session_task → triggers MONITOR → infinite loop:

- All tasks created by ACT automation carry `origin: 'system'` in their metadata
- MONITOR evaluator skips `engine_event` entries where `payload.origin = 'system'`
- Edge Function triage also skips system-origin events to prevent re-classification

## 4. Phase 1: COMPILE + TRIAGE

### 4.1 COMPILE — Intelligent Briefings

**Lives in:** `communication` capability (per ADR-0088). Extends `packages/ai/src/capabilities/communication/briefing.ts`.

**All COMPILE tools emit** via `emit()` with event_type `ops.compile.*`.

#### Day Brief
- **Background trigger:** pg_cron sweeper Edge Function queries all departments, finds each department's first shift time, fires compilation per-department
- **On-demand trigger:** Manager invokes `compile_day_brief` tool in conversation
- **Inputs:** Previous session handoff_notes, today's schedule, pending tasks, notes, deviations, weather (outdoor locations), reservations (if integrated)
- **Output:** Structured briefing object → rendered as dashboard card (web) + bottom sheet (mobile)
- **Delivery:** Push notification with summary (i18n key: `ops.brief.day_summary`), full brief in-app
- **Emits:** `ops.compile.day_brief` with department_id, recipient_count

#### Shift Brief (existing seed)
- **Trigger:** Punch-in event (or shift start time)
- **Inputs:** Current `compose_shift_briefing` data + what happened earlier in today's session
- **Output:** Personalized briefing for the employee starting their shift
- **Emits:** `ops.compile.shift_brief` with shift_id, profile_id

#### Pre-close Summary
- **Trigger:** 1 hour before `planned_close` (from department_session)
- **Inputs:** Task completion status, open deviations, unsigned items, handoff prep
- **Output:** Checklist for shift lead (i18n key: `ops.brief.preclose_title`)
- **Emits:** `ops.compile.preclose_summary` with session_id

#### Mobile Implementation
- Punch-in bottom sheet: spring entrance animation, Instrument Serif headline, 3 collapsible sections
- Day Brief card on dashboard: glassmorphism panel, warm colors, dismissible after read
- Pre-close: persistent banner, not dismissible until acknowledged or session signed off

### 4.2 TRIAGE — Classify and Route

**Lives in:** `operations_intelligence` capability (manager/system scope).

**All TRIAGE tools emit** via `emit()` with event_type `ops.triage.*`.

#### Background Automation: Triage Edge Function

**Invocation path:** DB trigger on `engine_event` insert → calls `supabase/functions/ops-triage/index.ts` Edge Function → runs classification → routes result.

The Edge Function:
1. Reads the new `engine_event` row
2. Skips if `payload.origin = 'system'` (loop guard)
3. Classifies: information / action_needed / deviation / emergency
4. Determines relevance: who needs to know (person / team / department / workspace)
5. Determines urgency: immediate / next_break / end_of_shift / next_day
6. Routes: selects channel (push / in-app / SMS / voice call)
7. Enriches: attaches context (who's on shift, active procedures, history)
8. Emits: `ops.triage.classified` with classification metadata

#### On-Demand Tool: `triage_event`
- Manager manually triages an event: "classify this deviation and route it"
- Same logic as background, but LLM-invoked with human oversight

#### Three-Tier Alert System (Frontend)

| Tier | Visual | Behavior | Examples |
|------|--------|----------|----------|
| **Ambient** | Subtle orb color shift on relevant card, muted | No interruption, information only | Temperature trend, note added, task completed |
| **Active** | Toast with warm orange border | Auto-dismiss 8s, swipeable | Task overdue, shift swap request, coverage warning |
| **Critical** | Persistent banner + haptic feedback (mobile) | Requires acknowledgment | Temperature violation, no-show confirmed, safety deviation |

**Visual language for predictions vs facts vs alerts:**
- Predictions: dashed left border + muted foreground
- Facts: solid left border + normal foreground
- Alerts: glowing left border + destructive color

#### Mobile Implementation
- Push notifications with tier-appropriate urgency level
- In-app: toast system using sonner with custom Nordic Split styling
- Critical: haptic feedback (`Haptics.notificationAsync` on Expo), non-dismissible banner

## 5. Phase 2: MONITOR + ACT

### 5.1 MONITOR — Anomaly Detection

**New file:** `services/stage-engine/src/core/operations-evaluator.ts` — a new evaluator, NOT an extension of `guardian-evaluator.ts` (which evaluates journey data completeness, a completely different domain).

**All MONITOR outputs emit** via `emit()` with event_type `ops.monitor.*`.

**Two invocation modes:**

**Background automation:**
1. **Event-driven** — DB triggers on `session_task`, `schedule_shift`, `deviation` inserts/updates fire `engine_event` → triage Edge Function may escalate to monitor evaluation
2. **Periodic Edge Function** — every 15 min during active sessions (pg_cron), sweeps all active department_sessions for gaps

**On-demand tools:**
- `query_monitor_alerts` — manager asks "any issues in the kitchen today?"
- `get_session_intelligence` — manager asks "how's the session going?"

#### Monitor Rules

| Condition | Detection | Action | Domain |
|-----------|-----------|--------|--------|
| Late punch-in | Shift starts in 10 min, no punch-in | Notify employee → shift lead → manager (escalation chain) | operations |
| No-show | 30 min past shift start, no punch-in | Trigger task inheritance, notify manager | operations |
| Task overdue | `due_at` passed, status ≠ completed | Escalation: assigned → shift lead → manager | operations |
| Critical task missed | Required + critical + not started | Immediate alert to all on-shift + manager | operations |
| Temperature out of range | HACCP reading exceeds threshold in `completion_data` | Trigger runbook, escalate | haccp |
| Deviation pattern | Same task flagged 3+ times this week | Alert manager with pattern analysis | haccp |
| Understaffing | Fewer people than `min_staff` on template | Alert manager, suggest open-shift | operations |
| Session approaching close | 1 hour before close, tasks incomplete | Summary to shift lead | operations |
| Unsigned session | `pending_signoff` past grace period | Escalation chain | operations |

#### HACCP Monitoring

**Prerequisite:** `haccp_control_point` table does NOT exist yet. Phase 2c requires this table to be created first (separate migration, separate spec). Until then, HACCP temperature validation uses thresholds stored in `session_task.completion_data` or policy `rules_json`.

When `haccp_control_point` table is created:
- Temperature readings auto-validated against `critical_limit_min/max`
- Deviation auto-flagged when reading outside limits
- Domain discriminator: monitor rules check `domain` parameter to scope HACCP vs general operations

### 5.2 ACT — Automated Operations

**Extends:** Event Engine action types (`supabase/functions/engine-dispatch/index.ts`)

**All ACT mutations emit** via `emit()` with event_type `ops.act.*`.

| Trigger | Automated Action | Origin |
|---------|-----------------|--------|
| Session hook fires | Create session_task instances from procedure, assign to role/person | `system` |
| Shift no-show confirmed | Activate task inheritance, redistribute, notify team | `system` |
| Recurring task schedule met | Materialize task instance in session | `system` |
| Critical deviation submitted | Trigger runbook, escalate, log compliance event | `system` |
| Session sign-off completed | Freeze task statuses, calculate aggregates, prepare handoff | `system` |
| Day Brief time reached | Compile and deliver brief | `system` |

All auto-created entities carry `origin: 'system'` in metadata for loop guard.

Authority governed by `engine_authority_config` (per-capability level):
- `autonomous`: act without asking (create tasks from hooks, generate briefs)
- `confirm`: propose action, wait for human (redistribute tasks)
- `suggest`: surface suggestion only (post open shift)
- `read_only`: observe and log
- `disabled`: function off

**Note:** Authority is per-capability, not per-action. If a workspace needs different authority for different ACT actions, this requires a future per-action authority extension. For Phase 2, per-capability is sufficient.

#### Mobile Implementation
- Task creation notifications: deep-link to task in mobile app
- Inheritance notifications (i18n key: `ops.act.task_inheritance_notice`)
- Runbook escalation: progressive notification severity

## 6. Phase 3: PREDICT + LEARN (Deferred)

> Deferred until operational data exists from Phase 1+2. Included here for architectural completeness.

### 6.1 PREDICT — Advisory Signals

**Runs as:** Weekly scheduled Edge Function (pg_cron)
**Persists to:** `engine_memory` with `memory_type: 'prediction'` — read-only dashboard signals, never cascade artifacts. Predictions expire after 7 days (auto-cleaned by retention Edge Function).

| Prediction | Data Source | Output (i18n keys) |
|------------|------------|---------------------|
| Coverage gap | Tomorrow's schedule vs min_staff | `ops.predict.coverage_gap` |
| Task bottleneck | Task density vs staff count | `ops.predict.task_bottleneck` |
| Compliance risk | Missed HACCP checks this week | `ops.predict.compliance_risk` |
| Temperature trend | 72-hour session_task HACCP readings | `ops.predict.temperature_trend` |
| Employee overload | Task count vs average | `ops.predict.employee_overload` |

**Emits:** `ops.predict.generated` with prediction_type, confidence, department_id.

#### Mobile Implementation
- Prediction cards with dashed border, i18n label `ops.predict.label`
- Temperature sparklines on HACCP dashboard (72-hour inline charts)
- Warm empty state when everything is on track (i18n key: `ops.predict.all_clear`)

### 6.2 LEARN — Pattern Recognition

**Persists to:** `engine_memory` (K1b) with `memory_type: 'learned_pattern'`
**Importance scale:** 0.0–1.0 (matching DB CHECK constraint). Retention: entries expire after 90 days unless importance >= 0.8.
**Runs as:** Weekly scheduled Edge Function (pg_cron)

| Pattern | What it Learns | How it's Used |
|---------|---------------|---------------|
| Task duration | Actual vs estimated completion times | Refine procedure estimates |
| Staffing | Task completion rates by staffing level | Inform season planning |
| Deviation correlation | Same procedure fails repeatedly | Suggest procedure review |
| Handoff quality | Voice vs text handoff outcome correlation | Recommend handoff mode |

**Emits:** `ops.learn.pattern_extracted` with pattern_type, data_range, confidence.

## 7. Data Layer Changes

### New Tables: NONE

All data uses existing tables:
- `engine_event` — AI telemetry (event_type prefixed `ops.*`)
- `engine_memory` — LEARN + PREDICT outputs (K1b)
- `engine_authority_config` — per-capability authority levels
- `policy` — AI operations config (`policy_type: 'ai_operations'`)
- `session_task`, `department_session`, `deviation` — operational state (existing)

### Migrations Required

1. **ALTER TYPE `policy_type`** — add `'ai_operations'` to the enum
2. **ALTER CHECK on `engine_memory.memory_type`** — add `'learned_pattern'` and `'prediction'` to allowed values
3. **Seed `engine_authority_config`** — default row for `operations_intelligence` capability (level: `suggest`)
4. **Seed `policy`** — default `ai_operations` policy with threshold defaults in `rules_json`:
   ```json
   {
     "late_punchin_threshold_minutes": 10,
     "noshow_threshold_minutes": 30,
     "task_overdue_grace_minutes": 15,
     "day_brief_offset_minutes": 30,
     "shift_brief_enabled": true,
     "mid_session_digest_enabled": false
   }
   ```
5. **Add `CapabilityName` union member** — `'operations_intelligence'` in `packages/ai/src/capabilities/types.ts`
6. **DB trigger on `engine_event`** — fires `ops-triage` Edge Function on insert (with filter for relevant event_types)

### Known prerequisite gap

`haccp_control_point` table (from Module 5 spec) does NOT exist. Phase 2c HACCP monitoring is blocked until this table is created. This is a separate spec and migration — not part of this implementation.

### Existing bug to fix

`packages/ai/src/capabilities/communication/briefing.ts` line 103 queries `.gte("importance", 5)` but `engine_memory.importance` is constrained to 0.0–1.0. This should be `.gte("importance", 0.5)`. Fix during Phase 1b.

## 8. Capability Registry Changes

```
Current (9):
  profile, ui, guardian, schedule, operations,
  communication, contract, contract_intake, shift_swap

After (10):
  profile, ui, guardian, schedule, operations,
  communication, contract, contract_intake, shift_swap,
  + operations_intelligence  ← NEW (manager/system scope)
```

### operations_intelligence capability tools

**Phase 1:**
- `triage_event` — manually classify and route an operational event

**Phase 2:**
- `query_monitor_alerts` — query anomalies detected in a session
- `get_session_intelligence` — comprehensive session status with AI analysis
- `execute_escalation` — manually trigger escalation chain for an anomaly

**Phase 3:**
- `predict_coverage` — analyze upcoming schedule for coverage gaps
- `predict_compliance` — analyze HACCP completion rates
- `query_patterns` — query learned patterns from K1b

### communication capability extensions (per ADR-0088: COMPILE stays here)

**Phase 1:**
- `compile_day_brief` — compile Day Brief for a department
- `compile_preclose_summary` — compile pre-close summary
- Extend `compose_shift_briefing` to include "what happened before your shift" context

### Background automation (NOT capability tools)

**Phase 1:**
- `supabase/functions/ops-triage/index.ts` — Edge Function triggered by DB trigger on engine_event
- `supabase/functions/ops-day-brief/index.ts` — pg_cron sweeper for Day Brief compilation

**Phase 2:**
- `supabase/functions/ops-monitor/index.ts` — periodic (15 min) operations evaluator
- New action types in `engine-dispatch` for ACT automation

**Phase 3:**
- `supabase/functions/ops-predict/index.ts` — weekly prediction analysis
- `supabase/functions/ops-learn/index.ts` — weekly pattern extraction + retention cleanup

## 9. Mobile Requirements Summary

| Feature | Surface | Constraint |
|---------|---------|------------|
| Day Brief | Push notification + dashboard card + punch-in bottom sheet | Spring entrance, 3 sections, Instrument Serif |
| Shift Brief | Bottom sheet on punch-in | Personalized, collapsible, < 5s render |
| Pre-close Summary | Persistent banner | Non-dismissible until acknowledged |
| HACCP temperature input | Full-screen modal | < 3 seconds total, minimal chrome, offline queue |
| Alerts (ambient) | In-app card color shift | No interruption |
| Alerts (active) | Toast + push | Auto-dismiss 8s, haptic on push |
| Alerts (critical) | Persistent banner + push + haptic | Requires acknowledgment |
| Predictions | Dashboard cards with dashed border | Sparklines for trends |
| Task creation | Push with deep-link | Opens task in app |
| Inspection Mode | Query-param toggle on web | Read-only, PDF export |
| Empty state | Orb animation | Warm, not clinical |

**Offline support:** HACCP temperature readings queued locally (AsyncStorage), synced with local timestamp preserved when connectivity returns.

**Shared logic rule:** All data hooks, API endpoints, and business logic in `packages/` — never `apps/web/` only. Mobile UI can ship as follow-up PR but architecture must support both surfaces from day one.

## 10. Implementation Sequence

> Each phase gets its own implementation plan via writing-plans skill.

| Phase | Scope | Prerequisites |
|-------|-------|---------------|
| **1a** | Migrations: policy_type enum, engine_memory CHECK, authority seed, policy seed | ADR-0088 |
| **1b** | `operations_intelligence` capability scaffold + registry + CapabilityName type | 1a |
| **1c** | COMPILE tools in communication capability (day brief, pre-close, shift brief extension) | 1b |
| **1d** | TRIAGE: `ops-triage` Edge Function + DB trigger + `triage_event` tool | 1b |
| **1e** | Three-tier alert system (web + mobile) | 1d |
| **1f** | `ops-day-brief` pg_cron Edge Function (per-department sweep) | 1c |
| **1g** | Fix briefing.ts importance bug (0.5 not 5) | 1c |
| **2a** | `operations-evaluator.ts` in Stage Engine + `ops-monitor` periodic Edge Function | 1b |
| **2b** | ACT extensions to Event Engine dispatch + loop guard | 2a |
| **2c** | HACCP monitoring (BLOCKED on `haccp_control_point` table — separate spec) | 2a |
| **2d** | On-demand intelligence tools (query_monitor_alerts, get_session_intelligence) | 2a |
| **3a** | `ops-predict` Edge Function (weekly analysis → engine_memory) | Data from phases 1+2 |
| **3b** | `ops-learn` Edge Function (pattern extraction + retention cleanup → K1b) | 3a |
| **3c** | Prediction UI (sparklines, trend cards, empty state) | 3a |

## 11. Out of Scope (filed as separate backlog)

The following were proposed by Council #1 but are independent features, not part of the intelligence layer:

- **Voice Handoff via Ultravox** — shift lead dictates handoff via voice. Depends on Ultravox integration verification (ESM/CJS status unconfirmed).
- **Contextual Procedure Lookup** — employee asks "how do I close the bar?" Tool for existing `operations` capability.
- **Deviation Context Enrichment** — auto-attach shift context when `createDeviation` fires. Extension of existing tool.

These should get their own specs and implementation plans.
