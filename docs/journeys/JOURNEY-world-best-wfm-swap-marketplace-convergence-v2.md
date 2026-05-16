---
title: "Journey — Swap↔Marketplace Convergence V2 (Authority Pipeline)"
feature: swap-marketplace-convergence-v2
status: draft
updated: 2026-05-16
created: 2026-05-16
module: scheduler
tags: [journey, scheduler, swap, marketplace, authority-pipeline, wfm]
---

# Journey — Swap↔Marketplace Convergence V2

## Summary

V2 unifies `shift-swap` + `shift_marketplace` capabilities behind shared `engine_authority_pipeline` (multi-stage gate: propose → consent → approve, with optional admin escalation). Both V1 tool surfaces preserved — internal write path delegates to pipeline engine. Shared lock-on-shift prevents concurrent reassignment via the two surfaces. Telemetry collapsed to single `pipeline.stage_*` envelope.

---

## Journey 1: Employee proposes swap → multi-stage pipeline

**Role:** Employee (`profile_id` of source shift)
**Verb:** Compose (web-only per ADR-0133)
**Channel:** Chat only — voice rejected at capability level (ADR-0288)

**Precondition:**
- Caller is `profile_id` on `schedule_shift` row (source shift)
- Target `profile_id` exists in same workspace with active employment
- Source shift has `pipeline_locked_by IS NULL` (not already in flight)
- Both employees pass eligibility (role, certifications, max-hours, framework rules)

**Happy path:**

1. Employee A opens `/dashboard/schedule/my-shifts` → clicks "Propose swap"
2. Selects target shift owned by Employee B → calls `propose_swap` capability tool
3. System: `mutateWithGate` (ADR-0287) → creates `engine_authority_pipeline` row with stage=`proposed`, locks both shifts via `pipeline_locked_by`
4. Emits `pipeline.stage_proposed` event (workspace_id, pipeline_id, source_shift_id, target_shift_id, initiator_profile_id)
5. Employee B receives notification → calls `accept_swap` → pipeline stage advances to `consented`, emits `pipeline.stage_consented`
6. Manager (or higher) sees pending row in `/dashboard/schedule/pipeline` → calls `approve_swap` → terminal write `schedule_shift.profile_id` flip, releases lock, emits `pipeline.stage_approved`

**Postcondition:**
- Both `schedule_shift.profile_id` swapped
- `engine_authority_pipeline.status = 'completed'`
- 3 stage events in `pipeline_stage_event` audit table

**Error paths:**
- **Target shift locked** → 409, error code `PIPELINE_LOCK_HELD`, friendly message references locking pipeline id
- **Eligibility fails at stage transition** → pipeline marked `rejected`, emits `pipeline.stage_rejected` with reason code
- **Voice channel attempted** → 403 per ADR-0288, no telemetry leak
- **Employee B rejects** → `reject_swap` → pipeline `rejected`, locks released

---

## Journey 2: Manager posts open shift → claim → pipeline approve

**Role:** Manager (or admin/owner) posts; Employee claims
**Verb:** Compose (web-only); Mobile claim = Approve verb (ADR-0133)

**Precondition:**
- Manager: `role >= manager` in workspace
- `schedule_shift` row exists, `pipeline_locked_by IS NULL`
- Either no assignee, or manager explicitly opens assigned shift

**Happy path:**

1. Manager `/dashboard/schedule/marketplace` → posts open shift via `post_open` tool
2. System: pipeline row created with stage=`proposed`, lock acquired, emits `pipeline.stage_proposed`
3. Eligible employees see shift in mobile pull-poll (`/api/mobile/marketplace/open-offers`, 30s refetch)
4. Employee calls `claim` → stage advances to `consented`, emits `pipeline.stage_consented`
5. Manager calls `approve_claim` → terminal write `schedule_shift.profile_id`, releases lock, emits `pipeline.stage_approved`

**Postcondition:**
- `schedule_shift.profile_id` = claimer
- Pipeline completed, audit chain intact

**Error paths:**
- **Concurrent claim race** → first claim wins; second receives `PIPELINE_LOCK_HELD`
- **Manager cancels mid-pipeline** → `cancel_offer` → lock released, pipeline `cancelled`, emits `pipeline.stage_cancelled`
- **Claim from ineligible employee** → 403, eligibility-error code returned, no pipeline mutation

---

## Journey 3: Admin escalation override (manager declined → admin forces)

**Role:** Admin (C4 escalation authority)
**Verb:** Approve with override (web-only)

**Precondition:**
- Pipeline row in stage `rejected` due to manager decline
- Caller has `role >= admin`
- Caller's `engine_authority_config` permits stage-override on this entity

**Happy path:**

1. Admin opens `/dashboard/schedule/pipeline?status=rejected` → sees row with manager-declined annotation
2. Calls `override_pipeline` tool with explicit reason text (Norwegian min 20 chars per L-0xxx friendly-error)
3. System: validates C4 authority via `engine_authority_config` lookup, advances pipeline to `approved` with `override_reason` + `overridden_by` audit fields
4. Terminal write `schedule_shift.profile_id`, lock released, emits `pipeline.stage_overridden` (distinct from `pipeline.stage_approved` for audit clarity)

**Postcondition:**
- Pipeline `status=completed`, `was_overridden=true`
- Audit chain shows full stage sequence INCLUDING manager rejection
- Telemetry event distinguishes override from normal approval

**Error paths:**
- **Caller lacks C4 override scope** → 403, error code `OVERRIDE_NOT_AUTHORIZED`
- **Override reason too short** → 400, friendly Norwegian error per ADR-0328
- **Pipeline already completed/cancelled** → 409, terminal-state error
- **Lock missing** (race with concurrent cleanup) → 409, retry recommendation

---

## Out of scope (V3 / separate sortie)

- Push-fanout notifications on stage transitions
- Real-time pipeline status WebSocket (LiveKit data-channel)
- Cross-workspace swap (multi-tenant governance ADR needed)
- AI-suggested swap candidates (uses cascade fairness signal — needs ADR)
