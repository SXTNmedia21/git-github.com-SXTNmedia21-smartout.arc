---
title: "Journey — Pipeline-aware UI surfaces (admin override + lock indicator + race feedback + audit)"
feature: swap-marketplace-pipeline-ui
status: draft
updated: 2026-05-16
created: 2026-05-16
module: scheduler
tags: [journey, scheduler, pipeline, ui, admin, web]
---

# Journey — Pipeline-aware UI surfaces

## Summary

Post-ADR-0340 backend ship, 4 UI surfaces close the visibility gap: admin override dashboard, pipeline-lock indicator on shift cells, cross-capability race feedback (409 toast), and pipeline audit trail viewer. Web-only per ADR-0133. Override action dispatches through existing Botsson chat capability tools (`override_swap_pipeline` / `override_marketplace_pipeline`) — NO new direct mutation API.

---

## Journey 1: Admin overrides a stuck pipeline

**Role:** Admin (`role IN admin|owner`)
**Verb:** Compose (web-only per ADR-0133)
**Channel:** Chat-only per ADR-0288 + ADR-0340 §Q5 (override is irreversible C4 act)

**Precondition:**
- Admin authenticated with `role >= admin` in workspace
- At least one pipeline_instance in `rejected` or stuck state
- T0.5 `<cap>.override` seed rows exist in `engine_authority_config` (already shipped commit `a6f2857c4`)

**Happy path:**

1. Admin navigates to `/dashboard/schedule/pipeline`
2. Server-component fetches list via `GET /api/admin/pipeline?status=rejected` (BFF reads engine_state filtered by process_id IN `shift_swap_lifecycle`, `marketplace_lifecycle`)
3. Renders Nordic Split list with status chips (filter: all / pending / rejected / cancelled)
4. Admin clicks row → side drawer opens with pipeline detail (blueprint_id, actor history, current_step, last stage_event)
5. Admin clicks "Override" CTA → reason textarea appears (min 20 chars validation per ADR-0328)
6. Admin types reason ≥20 chars → clicks "Send override" → drawer dispatches event opening Botsson chat with prefilled prompt: `"Override pipeline {id}. Reason: {text}"`
7. Botsson invokes `override_swap_pipeline` or `override_marketplace_pipeline` tool
8. Tool: `mutateWithGate(<cap>.override)` → `terminatePipelineInstance(overridden)` → `releasePipelineLock` → emit `pipeline.stage_overridden`
9. TanStack Query invalidates pipeline list; row disappears from rejected filter

**Postcondition:**
- `engine_state.status = 'overridden'`
- `pipeline_lock_state_id = NULL` on affected schedule_shift(s)
- `pipeline.stage_overridden` event in activity_trail with override_reason, overridden_by, overridden_from_status
- Admin sees pipeline row removed from rejected list

**Error paths:**
- **Override reason <20 chars** → 400 friendly Norwegian error inline ("Begrunnelse må være minst 20 tegn")
- **Caller not admin** → gate_action denied (T0.5 seed: min_role=admin); error toast "Du har ikke tillatelse til denne handlingen"
- **Pipeline already terminal** → 409; toast "Pipelinen er allerede avsluttet"
- **Voice channel attempted** → 403 (ADR-0288 + ADR-0340 §Q5); chat-only enforced

---

## Journey 2: User sees pipeline-lock indicator on shift card

**Role:** Manager / Employee viewing schedule
**Verb:** Read
**Channel:** Web + Mobile

**Precondition:**
- User authenticated with workspace access
- At least one shift in workspace has `pipeline_lock_state_id IS NOT NULL`

**Happy path:**

1. User opens `/dashboard/schedule` (web) or schedule view (mobile)
2. WeekGrid (web) / ShiftCard (mobile) renders shift cells
3. Server-component augments each shift with `pipeline_blueprint_id` field via `GET /api/schedule/shifts/[id]/pipeline` (lightweight join)
4. Shift cell with non-null pipeline_lock_state_id renders badge — small indicator icon + color
5. User hovers (web) / taps (mobile) → tooltip surfaces: "Vakten er i en vakttilbud-flyt — venter på godkjenning"
6. Tooltip text discriminates blueprint:
   - `shift_swap_lifecycle` → "Vaktbytte under behandling"
   - `marketplace_lifecycle` → "Åpent vakttilbud — venter på godkjenning"

**Postcondition:**
- User understands shift is in pipeline-in-flight state
- User does not attempt edit / re-swap / re-claim on locked shift

**Error paths:**
- **API fails** → badge does not render (silent fallback); no error toast
- **Stale lock (pipeline terminal but lock not cleared)** → P0.6 reaper handles; UI shows stale badge until next poll
- **Mobile no network** → cached pipeline_blueprint_id surfaces from last fetch; offline-tolerant

---

## Journey 3: User hits cross-capability race (409 PIPELINE_LOCK_HELD)

**Role:** Manager / Employee
**Verb:** Compose
**Channel:** Web + Mobile

**Precondition:**
- User attempts a capability action on shift X
- Shift X already has `pipeline_lock_state_id` set by a different pipeline

**Happy path (graceful failure):**

1. User initiates conflicting action — e.g. proposes swap on a shift already in marketplace_lifecycle pipeline
2. BFF route forwards to capability tool → `acquirePipelineLock` returns 0 rows (CAS failure)
3. Tool throws `PipelineLockHeldError` → BFF returns 409 with error code `PIPELINE_LOCK_HELD` + locking blueprint name
4. API client catches 409 → sonner toast with friendly Norwegian message:
   - swap-on-marketplace: "Vakten er låst av et åpent vakttilbud — venter på godkjenning"
   - marketplace-on-swap: "Vakten er allerede i en bytteforespørsel"
   - same-capability-double: "Det finnes allerede en åpen flyt på denne vakten"
5. Toast persists 5s + dismiss button

**Postcondition:**
- No mutation applied; existing pipeline untouched
- User informed of conflict in plain Norwegian
- No app crash / no console error

**Error paths:**
- **API client doesn't recognize 409 shape** → generic toast fallback ("Handlingen kunne ikke fullføres")
- **Stale lock (race resolved before user sees toast)** → user can retry; second attempt succeeds

---

## Journey 4: Admin reviews pipeline audit trail

**Role:** Admin
**Verb:** Read
**Channel:** Web only (deep audit surface)

**Precondition:**
- Admin authenticated in workspace
- Pipeline instance exists (any status)

**Happy path:**

1. Admin opens `/dashboard/schedule/pipeline` (Journey 1 list view)
2. Admin clicks "View audit trail" on a row → audit drawer opens
3. BFF endpoint `GET /api/admin/pipeline/[id]` returns:
   - engine_state row (status, current_step, context JSONB)
   - All `gate_evaluation` rows correlated via `correlation_id = engine_state.id`
   - All `activity_trail` rows for events matching pipeline_instance_id
4. Drawer renders chronological list:
   - timestamp, stage (proposed → consented → approved/rejected/overridden), actor profile name, channel
   - For each: gate_evaluation_id chip linking to detail
   - For override events: override_reason text visible + admin badge
5. Override events styled with governance accent (Nordic Split `--governance` token, purple)
6. Each event row expandable to show full payload JSONB

**Postcondition:**
- Admin sees complete audit chain for the pipeline
- Override actions are visually distinct from normal stage transitions
- Correlation chain visible (every write maps to a gate_evaluation_id per ADR-0204)

**Error paths:**
- **Pipeline not found** → 404 with empty-state message
- **Cross-workspace pipeline ID attempted** → 403 (ADR-0151 fail-fast)
- **Activity_trail rows missing** → partial render with warning banner ("Audit trail incomplete — events older than retention window")

---

## Out of scope (V2.1 / separate sortie)

- Push notifications when pipeline stage advances
- Real-time pipeline updates via LiveKit data-channel (currently polling-based)
- Cross-workspace pipeline view (blocked on ADR-0340 Q2 cross-workspace policy)
- Manager-approve UI re-design to surface pipeline_instance_id (existing SwapApprovalSection works backward-compat)
- Mobile audit trail viewer (admin-only, web-first per ADR-0133)
