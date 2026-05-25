---
title: "Sim Schema-Bound Bugs — Migration Plan + ADR Recommendations"
status: complete
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [sim, restaurant-week, hotel, festival, schema, migration, triage, wave-6]
---

# Schema-Bound Sim Bugs — Triage (Wave 6)

> **Scope:** 8 remaining migration-bound sim bugs from `BUGS.md` not closed by Waves 1-4 (code-only fixes).
> **Mode:** READ-ONLY analysis. No code, no migrations, no ADRs written here.
> **Goal:** Per-bug migration approach + risk class + ADR recommendation + sortie estimate + cross-cutting bundling analysis.
> **Architectural prior:** ADR-0426 (event D5 grouping) PROPOSED 2026-05-25 already covers the event-entity axis for BUG-SIM-02 / 23 / 26 — three of the eight bugs collapse onto a single sortie.

---

## BUG-SIM-01 — `employment_form` NOT NULL conflict with volunteer NULL pattern 🔴 CRITICAL

### Root cause confirmed

- **Constraint introduced:** `supabase/migrations/20260519150000_contract_text_to_enum_cast.sql:159-160` — `ALTER TABLE public.employment_contract ALTER COLUMN employment_form SET NOT NULL;` after Step C backfill (`:140-157`) defaults any pre-existing NULL row to `'permanent'` via `RAISE NOTICE 'employment_form: % rows had NULL; defaulting to ''permanent'' (ADR-0001 D1 fallback)'`.
- **Conflicting comment contract:** `supabase/migrations/20260515100100_employment_contract_tripletex_columns.sql:37-38` — `COMMENT ON COLUMN public.employment_contract.employment_form IS 'Tripletex employment form: permanent | temporary | NULL (volunteer — excluded from Tripletex sync).';`
- **Enum source of truth:** `supabase/migrations/20260519100100_contracts_module_foundation.sql:45-51` — `employment_form_enum AS ENUM ('permanent', 'temporary', 'apprentice', 'practice', 'freelance')` — no `volunteer` member exists.
- **K1a derivation contract:** `supabase/migrations/20260515100000_employee_type_k1a.sql:11` — `employment_form_derived text CHECK (employment_form_derived IN ('permanent','temporary') OR employment_form_derived IS NULL)` — K1a explicitly allows NULL on the *derived* column but the parent `employment_contract.employment_form` no longer does.
- **Backfill side-effect:** All pre-Wave-3 volunteer contracts (NULL) were silently re-typed to `'permanent'` by line 153 — data corruption already occurred on every workspace that applied 20260519150000. Festival / NGO / event workspaces lost their volunteer distinction.

### Migration approach

Forward-only multi-step migration:

1. `ALTER TYPE public.employment_form_enum ADD VALUE 'volunteer'` (cannot be in same transaction as USAGE in step 4 — must be separate migration or `COMMIT` between, per Postgres enum mutation rules).
2. Backfill recovery: identify contracts where `employee_payroll_profile.is_volunteer = true` OR `remuneration_type IS NULL` AND `employment_form = 'permanent'` → revert to new `'volunteer'` value. Provenance lost on workspaces that applied 20260519150000 before any volunteer flag existed — they must self-correct.
3. `ALTER TABLE employment_contract DROP CONSTRAINT employment_contract_temporary_requires_end_date` then re-add with `volunteer` excluded from end-date requirement.
4. Update K1a `employment_form_derived` CHECK to add `'volunteer'`.
5. Update Tripletex sync EF (`supabase/functions/contract-*` or equivalent) to skip `employment_form = 'volunteer'` rows.

Alternative (lower-risk): keep enum as is, add `is_volunteer BOOLEAN NOT NULL DEFAULT false` column + CHECK constraint `(is_volunteer = false OR employment_form = 'temporary')` to model volunteers as a special temporary class. Tradeoff: comment contract on `employment_form` becomes misleading.

### Risk class

**CRITICAL** — data-loss already occurred via NULL → 'permanent' backfill in 20260519150000 Step C. New migration cannot undo lost provenance. Two paths forward:

- Forward-only: accept that pre-Wave-3 volunteers are now `'permanent'`; require manual workspace-level audit + correction. Document in HANDOFF.
- Halt-and-amend: not viable — 20260519150000 already shipped to development tip, may be on preview/main. Cannot recall.

### ADR recommendation

**AMEND ADR-0001 (D1 contract semantics)** — make NULL = volunteer explicit OR introduce `'volunteer'` enum member. ADR-0001 referenced at line 138 + 150 of 20260519150000; current ADR-0001 wording forces the NOT NULL path. New amendment must:

1. Document the data-loss event (mark as known incident).
2. Carve out volunteer pattern (either NULL or new enum value).
3. Reference [[ADR-0427]] forward-only repair pattern for any constraint relaxation.

**No new ADR slot needed** — ADR-0001 amendment + L-NEW capturing data-loss event suffice.

### Sortie estimate

- Migration design (multi-step enum mutation + backfill + constraint): 3 h
- Tripletex sync EF update + Zod schema updates: 2 h
- Per-workspace volunteer recovery audit script (read-only diagnostic): 2 h
- Test + ADR amendment + HANDOFF: 3 h
- **Total: ~10 h**

### Dependencies

- **None blocking** at schema layer — volunteer is orthogonal to event entity work.
- Touches Tripletex contract sync — coordinate with payroll-engine-developer scope (ADR-0234 / ADR-0413 capability registry).
- ADR-0001 amendment must precede migration (decision drives schema).

### Recommended sequence

**Priority 1 (highest)** — already-occurred data loss + blocks festival/NGO vertical entirely. No other bug has had data actually corrupted by the constraint.

---

## BUG-SIM-02 — `daily_reconciliation.UNIQUE (workspace_id, department_id, date)` blocks multi-zone aggregation 🟠 HIGH

### Root cause confirmed

- **Constraint introduced:** `supabase/migrations/20260304200100_daily_reconciliation.sql:80` — `CONSTRAINT uq_recon_date UNIQUE (workspace_id, department_id, reconciliation_date)` (BUGS.md cited `:53` — actual line is 80; reconciliation_date column declared at `:42`).
- **Consumer code (mobile recon wizard):** `apps/mobile/src/hooks/mutations/use-recon-wizard.ts:74,203,229,240,272,284` — all writes assume one row per (dept, date). Inserts at `:229` will fail with UNIQUE violation if cascade-engine event grouping introduces a second daily_reconciliation row for the same (workspace, department, date).
- **Consumer code (BFF wizard override):** `apps/web/src/app/api/reconciliation/wizard-override/route.ts:153,196` — same pattern.
- **Consumer code (web recon hook):** `apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts:27` — selects assume single row per day.
- **No aggregate view exists:** Exhaustive grep of `supabase/migrations/` confirms no `v_daily_reconciliation_*` view or matview for event/workspace rollup.

### Migration approach

Two-path solution, sequenced:

1. **Near-term (independent of event entity):** Add view `v_daily_reconciliation_workspace_total` aggregating `SUM(revenue_total, total_labor_cost, total_actual_hours)` by `(workspace_id, reconciliation_date)`. Pure read-side, no constraint mutation. Closes "no rollup" complaint without semantic change.
2. **Long-term (when ADR-0426 event lands):** Add nullable `event_id UUID REFERENCES event(event_id)` column to `daily_reconciliation`. Replace UNIQUE `(workspace_id, department_id, reconciliation_date)` with `UNIQUE (workspace_id, department_id, reconciliation_date, COALESCE(event_id::text, ''))` partial OR drop UNIQUE entirely if event_id is set. Add `v_event_reconciliation_total` view aggregating by event_id.

Recommendation: ship (1) immediately. Defer (2) to the sortie that materializes ADR-0426.

### Risk class

- Path 1 (view): **LOW** — additive, no data migration, no consumer code changes required.
- Path 2 (event_id column + UNIQUE change): **HIGH** — consumers (`use-recon-wizard.ts`, `useReconciliation.ts`, `wizard-override/route.ts`) must opt-in before relaxing UNIQUE, else cascade duplicates appear. Must ship after ADR-0426 sortie.

### ADR recommendation

- Path 1 (view): **No ADR needed** — mechanical additive view.
- Path 2 (column + UNIQUE relaxation): **Covered by [[ADR-0426]]** (event D5 grouping) — line 92-93 explicitly states "`event_settlement` aggregates `daily_reconciliation` rows via event_id — closes GAP-A8-multi-day-settlement". No new ADR; update ADR-0426 sortie scope to include this.

### Sortie estimate

- Path 1 (view): 1 h migration + 1 h consumer-view test + 0.5 h docs = **~2.5 h**
- Path 2 (event_id + relaxation): bundled into ADR-0426 implementation sortie (+ 4 h on top of base ADR-0426 work)

### Dependencies

- Path 1: **none**.
- Path 2: **depends on ADR-0426 implementation** (event table + event_session_membership join must exist first).

### Recommended sequence

**Priority 3** — ship Path 1 standalone (commercial-layer immediate win); Path 2 bundled with ADR-0426 sortie when that lands.

---

## BUG-SIM-03 — `tip_distribution` partial index leaves orphans unqueryable 🟡 MEDIUM

### Root cause confirmed

- **Partial index:** `supabase/migrations/20260428220004_tips_distribution_table.sql:34` — `CREATE INDEX IF NOT EXISTS idx_tip_distribution_payroll ON tip_distribution (payroll_period_id) WHERE payroll_period_id IS NOT NULL;` — explicitly excludes orphans.
- **ON DELETE SET NULL:** `supabase/migrations/20260527100900_payroll_phase1_tip_payroll_fk.sql:17-22` (BUGS.md cite) — when payroll_period is deleted, distributions get `payroll_period_id = NULL`. These orphans are now invisible to any index-supported query.
- **Audit query consequence:** "find paid distributions with no period" requires full table scan over potentially large `tip_distribution` history.
- **Consumer impact:** `apps/web/src/app/api/tips/adjust-share/route.ts:112,146` queries `tip_distribution` but always filters by `pool_id` (indexed at `:32`), so adjust path unaffected. Only audit/reporting queries hit the gap.

### Migration approach

Pick one:

1. **Add complementary partial index** — `CREATE INDEX idx_tip_distribution_orphan ON tip_distribution (status, created_at) WHERE payroll_period_id IS NULL AND status = 'paid';` Closes audit query in <1 ms.
2. **Change FK to `ON DELETE RESTRICT`** — prevents orphan creation entirely. Requires consumer code (payroll period delete path) to either reassign distributions first or block deletion. Higher friction, higher safety.
3. **Both** — defensive: orphan index AND restrict-on-delete. Maximum safety, minimum surprise.

### Risk class

- Path 1 (orphan index): **LOW** — additive index, no data migration.
- Path 2 (FK change): **MEDIUM** — changes delete semantics; payroll period delete UI/EF must surface "has distributions" error. Backfill nothing; future-looking only.

### ADR recommendation

- Path 1: **No ADR needed** — mechanical.
- Path 2: **Possibly new ADR slot** — "FK semantics for financial reference data" — but only if pattern repeats. For one column, document in HANDOFF + L-NEW.

### Sortie estimate

- Path 1: 0.5 h migration + 0.5 h audit query test = **~1 h**
- Path 2: 1 h migration + 2 h consumer UI/EF block-on-children + 1 h test = **~4 h**

### Dependencies

- None.

### Recommended sequence

**Priority 7** — silent data-quality decay, low frequency. Ship Path 1 as a 1-hour mikrofix bundled into next routine maintenance sortie.

---

## BUG-SIM-23 — `tip_pool.UNIQUE (department_session_id)` semantically scoped wrong for event ops 🟠 HIGH

### Root cause confirmed

- **Constraint introduced:** `supabase/migrations/20260428220003_tips_pool_table.sql:25` — `CONSTRAINT uq_tip_pool_session UNIQUE (department_session_id)`.
- **Consumer (LLM tool):** `packages/ai/src/capabilities/tips/tools.ts:65,88` — `pool_id` resolution assumes 1:1 with session.
- **Consumer (BFF):** `apps/web/src/app/api/tips/adjust-share/route.ts:125`, `apps/web/src/app/api/tips/approve-distribution/route.ts:55` — single pool per session.
- **Consumer (approve RPC):** `supabase/migrations/20260429010000_approve_tip_pool_rpc.sql:25-95` — operates on single pool_id.
- **Five-agent confirmation:** sim Agents A6 (hotel), A7 (festival), A8 (tips deep-dive), A10, A11 all flagged this independently → strong signal for event-entity bundling per [[ADR-0426]].

### Migration approach

**Via ADR-0426 (event entity):**

1. Drop `uq_tip_pool_session UNIQUE (department_session_id)`.
2. Add nullable `event_tip_pool_id UUID REFERENCES event_tip_pool(event_tip_pool_id) ON DELETE SET NULL` column.
3. Add new UNIQUE `(department_session_id, event_tip_pool_id)` with `NULLS NOT DISTINCT` (Postgres 15+) OR partial UNIQUE `(department_session_id) WHERE event_tip_pool_id IS NULL` + `(department_session_id, event_tip_pool_id) WHERE event_tip_pool_id IS NOT NULL`.
4. New parent table `event_tip_pool` with `(event_id, currency, status, distribution_method)`.
5. Update `approve_tip_pool` RPC to accept either single pool_id (legacy path) or event_tip_pool_id (new path) and propagate approval to all child pools transactionally.

### Risk class

**HIGH** — touches active RPC, BFF routes, LLM capability tools. Approve flow is currency-sensitive (Regnskapsloven). Backward compat required for existing tip_pool rows (set `event_tip_pool_id = NULL`).

### ADR recommendation

**Covered by [[ADR-0426]]** (event D5 grouping, line 91-92, line 132 — "X03-D event_tip_pool"). No new ADR. ADR-0426 sortie scope must include tip-pool relaxation.

### Sortie estimate

- Bundled into ADR-0426 implementation sortie: **+ 6 h** (4 h schema + RPC, 1 h LLM/BFF consumers, 1 h test)

### Dependencies

- **Blocks on ADR-0426** event table + event_session_membership existing.
- **Coordinate with ADR-0234** payroll capability — tip approval triggers payroll recalc per ADR-0293 Pattern B sync-recalc.

### Recommended sequence

**Priority 4** — ship as part of ADR-0426 implementation sortie (bundled with BUG-SIM-02 path 2 and BUG-SIM-26).

---

## BUG-SIM-24 — `planning_event.end_date` exists but cascade-engine reads only `event_date` for day_factor 🟡 MEDIUM

### Root cause confirmed

- **Column declared:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:141-142` — `event_date DATE NOT NULL, end_date DATE,` (BUGS.md cited `:145` — actual line 142).
- **Cascade engine reads only `event_date`:**
  - `packages/ai/src/capabilities/mission/tools.ts:136-140` — selects `event_date` only, queries `gte("event_date", now)` + `lte("event_date", in30Days)`. No `end_date` reference.
  - `apps/web/src/app/dashboard/year-wheel/_tools/use-year-wheel-tools.ts:83,226,280,284` — all consumers read `event_date` only.
- **Consumer that DOES read end_date:** `apps/web/src/app/dashboard/komm/_hooks/use-communication-overview.ts:84` — selects `end_date` for display, but never expands range for staffing computation.
- **Type schema:** `apps/web/src/lib/cascade/types.ts:168-169,193` — `end_date: string | null` declared but unused in scheduler.
- **D4 demand multiplier:** `planning_event.demand_multiplier NUMERIC(4,2)` applied only to `event_date` row in cascade greedy solver (`packages/ai/src/scheduler/solver/greedy.ts:56` — derives demand from `day_factor × hour_factor × baseline_headcount` per day, no event-range expansion).

### Migration approach

**Pure code fix — no schema migration needed.** Schema is already correct.

Required cascade-engine update:

1. When loading `planning_event` rows for demand calculation, expand each row to `generate_series(event_date, COALESCE(end_date, event_date), '1 day')`.
2. Update `apps/web/src/lib/cascade/build-entity-context.ts` (or equivalent — verify which entry-point) to fan out multi-day events.
3. Update `packages/ai/src/capabilities/mission/tools.ts:136` query to also select `end_date` and expand client-side.
4. Update `use-year-wheel-tools.ts` to render multi-day events as bands rather than single points.

### Risk class

**LOW** — schema is unchanged; consumers add range-expansion logic. No data backfill. No FK changes. No constraint changes.

Caveat: D4 day_factor / hour_factor rollup must remain idempotent — re-running the cascade for the same date range must produce the same staffing recommendation regardless of how many multi-day events overlap.

### ADR recommendation

**No new ADR needed** — mechanical code fix to match documented schema intent. Document in HANDOFF as L-NEW (cascade-engine date-range expansion contract).

If multi-day expansion semantics turn out to be non-trivial (e.g. should `demand_multiplier` apply linearly across the range or peak-mid?), then a new ADR slot is warranted — but the schema doesn't force the question, so defer until the implementation surfaces ambiguity.

### Sortie estimate

- Cascade engine multi-day expansion: 3 h
- Year-wheel rendering update: 2 h
- LLM tool query update: 1 h
- Test (single-day, two-day, week-long events): 2 h
- **Total: ~8 h**

### Dependencies

- **None blocking.** Schema is ready.
- Coordinate visually with year-wheel campaign (campaign/ui-shell scope — multi-day event band rendering).

### Recommended sequence

**Priority 6** — mechanical, no schema risk, unblocks hotel/festival vertical demand-correctness. Ship independently.

---

## BUG-SIM-25 — `approve_tip_pool` raises `workspace_mismatch` for inactive actors 🟢 LOW

### Root cause confirmed

- **PL/pgSQL function:** `supabase/migrations/20260429010000_approve_tip_pool_rpc.sql:66-75` —
  ```sql
  SELECT workspace_id
    INTO v_actor_workspace_id
    FROM public.profile
   WHERE profile_id = p_actor_profile_id
     AND is_active = true;

  IF NOT FOUND OR v_actor_workspace_id != v_pool_workspace_id THEN
    RAISE EXCEPTION 'workspace_mismatch'
      USING ERRCODE = 'P0001';
  ```
- **Misleading error class:** When actor's profile row exists but `is_active = false`, the `NOT FOUND` branch fires with `workspace_mismatch` error, suggesting cross-tenant violation when reality is local actor inactive.
- **Status (per BUGS.md line 220):** "⏸ DEFERRED migration-only (see ec356140d)" — already flagged for migration-only sortie.

### Migration approach

Forward-only idempotent migration (per [[ADR-0427]] pattern):

1. `CREATE OR REPLACE FUNCTION approve_tip_pool(...)` with the actor lookup split into two queries:
   ```sql
   SELECT workspace_id, is_active
     INTO v_actor_workspace_id, v_actor_active
     FROM public.profile
     WHERE profile_id = p_actor_profile_id;

   IF NOT FOUND THEN
     RAISE EXCEPTION 'actor_not_found' USING ERRCODE = 'P0001';
   END IF;

   IF v_actor_active = false THEN
     RAISE EXCEPTION 'actor_inactive' USING ERRCODE = 'P0001';
   END IF;

   IF v_actor_workspace_id != v_pool_workspace_id THEN
     RAISE EXCEPTION 'workspace_mismatch' USING ERRCODE = 'P0001';
   END IF;
   ```
2. Update BFF + LLM tools to surface the new error codes (`actor_inactive` → Norwegian Bokmål "Du er deaktivert som bruker — kontakt arbeidsgiver" or similar; `actor_not_found` → "Brukerprofil mangler").

### Risk class

**LOW** — function replacement is atomic via `CREATE OR REPLACE`. No data migration. No constraint change. Consumer code only needs to handle 2 new error strings; existing `workspace_mismatch` consumers unaffected.

### ADR recommendation

**No ADR needed** — mechanical PL/pgSQL fix. Document in HANDOFF.

If the pattern repeats across other RPCs (e.g. `approve_*`, `lock_*`), consider a cross-cutting ADR for "RPC actor-state guard ordering" — but defer until 2nd occurrence.

### Sortie estimate

- Migration (CREATE OR REPLACE): 0.5 h
- BFF error-code handling: 1 h
- Norwegian Bokmål strings + i18n keys: 0.5 h
- Test (3 cases: missing, inactive, mismatch): 1 h
- **Total: ~3 h**

### Dependencies

- None.

### Recommended sequence

**Priority 8 (lowest)** — purely diagnostic friction, no functional break. Ship as a 3-hour mikrofix bundled into any tips-related sortie or independently.

---

## BUG-SIM-26 — `department_session.UNIQUE (workspace_id, department_id, session_date)` blocks dual-service days 🟠 HIGH

### Root cause confirmed

- **Constraint introduced:** `supabase/migrations/20260304200000_department_session.sql:51` — `CONSTRAINT uq_dept_session_date UNIQUE (workspace_id, department_id, session_date)`.
- **Idempotency check in openSession:** `apps/web/src/app/dashboard/_actions/open-session-action.ts:72-80` —
  ```ts
  const { data: existing } = await admin
    .from("department_session")
    .select("department_session_id, status")
    .eq("department_id", parsed.data.departmentId)
    .eq("session_date", parsed.data.dateISO)
    .maybeSingle();
  ```
  Returns existing session for any (dept, date) match, preventing creation of a second session for the same day.
- **Consumer (day-line):** `apps/web/src/components/day/_hooks/use-day-lines.ts:52,88,114` — all rendering assumes single session per (dept, date).
- **Consumer (compile briefs):** `packages/ai/src/capabilities/communication/compile-day-brief.ts:39,52`, `compile-preclose.ts:32`, `briefing.ts:100` — all `.eq("session_date", X)` single-row reads.
- **Consumer (payroll calc):** `packages/ai/src/capabilities/payroll/tools.ts:742-748` — selects by session_date range, would multiply if two sessions per day.
- **Two-agent confirmation:** A6 (HOTEL-2) + A7 (GAP-2) flagged for hotel breakfast + wedding dinner same-day pattern.

### Migration approach

**Via ADR-0426 (event entity):**

Option B (RECOMMENDED, per ADR-0426 explicit decision):

1. **Do NOT drop UNIQUE constraint.** Keep `(workspace_id, department_id, session_date)` UNIQUE — preserves ADR-0367 tri-layer D6 invariant.
2. Instead, model "dual-service day" by JOINing TWO `department_session` rows via an `event_session_membership` row (one event_id grouping both sessions). Hotel kitchen Saturday = ONE department_session for the day; the two services (breakfast + wedding dinner) are TWO `day_line` rows (the middle layer of ADR-0367 tri-layer D6) within that single session.
3. **Re-architect day_line to be the service-window unit.** This is consistent with ADR-0367 §"day_line is the area-anchored runtime row" — breakfast + dinner are two day_lines, not two sessions.

Option A (NOT recommended, but documented for completeness):

1. Drop `uq_dept_session_date`.
2. Add nullable `service_window_kind TEXT` or `event_id UUID` column.
3. Replace UNIQUE with `(workspace_id, department_id, session_date, COALESCE(service_window_kind, ''))`.
4. Migrate ALL consumers — high blast radius across ~10 files.

**Recommendation:** Option B. The UNIQUE constraint is correct; the architectural mismatch is treating "service" as session-level when it is day_line-level per ADR-0367.

### Risk class

- Option B: **MEDIUM** — no schema change to department_session, but day_line capabilities + UI must be extended to handle two day_lines per session with distinct service windows. Coordinates with ADR-0367 day_line capability work.
- Option A: **HIGH** — constraint relaxation touches ~10 consumers, all of which assume 1:1 session-per-day.

### ADR recommendation

**Covered by [[ADR-0426]]** (event D5 grouping) + **[[ADR-0367]]** (day_line tri-layer D6). No new ADR. The reframing — "dual-service day = two day_lines, not two sessions" — is an inference from ADR-0367 §day_line that should be documented in the ADR-0426 implementation HANDOFF as an explicit clarification (L-NEW).

### Sortie estimate

- Bundled into ADR-0426 sortie: **+ 4 h** (day_line service-window discriminator design + consumer review)
- Standalone Option A (if abandoning Option B): 12 h (high consumer churn)

### Dependencies

- **Blocks on ADR-0426** event table existing (for event_id grouping).
- **Coordinates with ADR-0367** day_line capability — day_line.service_window must be added or repurposed.

### Recommended sequence

**Priority 5** — ship as part of ADR-0426 implementation sortie (bundled with BUG-SIM-02 path 2 and BUG-SIM-23).

---

## BUG-SIM-27 — Schedule temporal lock function `v_local_now::date` DST trap 🟠 HIGH

### Root cause confirmed

- **PL/pgSQL function:** `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql:28-44` —
  ```sql
  SELECT timezone INTO v_timezone FROM public.workspace WHERE workspace_id = p_workspace_id;
  IF v_timezone IS NULL OR v_timezone = '' THEN
    v_timezone := 'Europe/Oslo';
  END IF;
  v_local_now := timezone(v_timezone, now());
  v_shift_start_local := p_shift_date::timestamp + p_start_time;
  RETURN p_shift_date < v_local_now::date OR v_shift_start_local <= v_local_now;
  ```
- **The bug:** Line 43 casts `v_local_now::date` — drops time information. A shift starting at 22:00 on date N and ending 02:30 on date N+1 cannot be approved at 02:20 (`v_local_now::date = N+1`, so `p_shift_date(N) < N+1 = true` → locked).
- **Trigger consumer:** `supabase/migrations/20260428133000_schedule_shift_lock_rollout_and_audit.sql:196-231` — `enforce_schedule_shift_temporal_lock()` calls this function from trigger, bypassing C4 authority gate entirely.
- **Client mirror:** `apps/web/src/app/dashboard/schedule/_hooks/schedule-shift-lock.ts:2,71` — "Mirrors the two-branch OR in schedule_shift_is_temporally_locked()" — same logic, same bug, client side.
- **Server action mirror:** `apps/web/src/app/dashboard/_actions/add-shift-action.ts:10,215` — matches the PL/pgSQL fallback.
- **Status (per BUGS.md line 236):** "⏸ DEFERRED migration-only (see ec356140d)" — flagged for migration-only sortie.

### Migration approach

`CREATE OR REPLACE FUNCTION schedule_shift_is_temporally_locked(...)` with one of:

1. **Shift-end-anchored grace window** (BUGS.md suggested fix):
   ```sql
   v_shift_end_local := p_shift_date::timestamp + p_start_time + INTERVAL '8 hours';
   IF p_end_time IS NOT NULL THEN
     v_shift_end_local := p_shift_date::timestamp + p_end_time;
     IF p_end_time < p_start_time THEN  -- crosses midnight
       v_shift_end_local := v_shift_end_local + INTERVAL '1 day';
     END IF;
   END IF;
   RETURN v_shift_end_local + INTERVAL '4 hours' <= v_local_now;
   ```
   Tradeoff: requires p_end_time parameter (currently only takes p_shift_date, p_start_time per signature — `packages/supabase/src/database.types.ts:23136`).

2. **Explicit `lock_after` column on `schedule_shift`** — DB trigger reads `lock_after` directly, business hours embedded in shift row. Higher schema discipline, simpler function logic.

3. **Hybrid** — function takes optional `p_end_time`; falls back to `+8h` grace if NULL. Backward-compatible.

DST trap is orthogonal — `timezone(v_timezone, now())` correctly handles DST transitions; the bug is *date-bucket coarseness*, not DST per se. The DST framing in the bug title is misleading; the real issue is "midnight-crossing shifts."

### Risk class

**HIGH** — changes lock semantics for an active trigger. Backward compat: existing approvals must not become locked retroactively. Migration must compute new semantics conservatively (i.e. permissive on the boundary).

Coordinate with all three mirror sites (server action, client hook, RPC). Trigger fires on every shift mutation — typo here = data integrity nightmare.

### ADR recommendation

**AMEND [[ADR-0066]]** (Temporal Shift Lock Architecture). ADR-0066 §Decision establishes DB-canonical lock contract; this amendment refines the temporal window to be shift-end-anchored rather than shift-date-anchored. Add explicit rules for:

1. Midnight-crossing shifts (end_time < start_time).
2. Grace window default (4 h post-end).
3. Workspace-configurable lock-grace via `workspace.shift_lock_grace_hours` column (future-extensible).

**Slot:** ADR-0066 amendment (in-place revision); no new ADR slot.

### Sortie estimate

- Migration (CREATE OR REPLACE + signature change): 2 h
- Server action + client hook mirror updates: 2 h
- Trigger function update + audit migration coherence: 1 h
- ADR-0066 amendment: 1 h
- Test (midnight-crossing, late-night hotel, normal day, edge of grace): 3 h
- **Total: ~9 h**

### Dependencies

- **None blocking** — independent of event entity work.
- May coordinate with planning_cycle / framework_rule (D3) — DOH-rest gates also use temporal predicates.

### Recommended sequence

**Priority 2** — blocks every late-night op (hotels, late bistros, festivals). No data corruption (unlike BUG-SIM-01) but immediate operational dead-end at 02:00-03:00. Ship before any hotel/festival sortie reaches QA.

---

## §Cross-cutting analysis

### Bundling — three migrations cover six bugs

**Bundle A — ADR-0426 (event D5 grouping) implementation sortie:**

- BUG-SIM-02 Path 2 (daily_reconciliation aggregation via event_id)
- BUG-SIM-23 (tip_pool UNIQUE relaxation via event_tip_pool parent)
- BUG-SIM-26 (department_session dual-service-day reframed as two day_lines per ADR-0367)

Total sortie cost: ADR-0426 baseline (TBD by ADR-0426 author) + 14 h bug-specific work.

**Bundle B — independent mikrofixes:**

- BUG-SIM-03 (tip_distribution orphan index) — 1 h
- BUG-SIM-24 (cascade multi-day event expansion) — 8 h
- BUG-SIM-25 (approve_tip_pool actor-state guard) — 3 h

**Bundle C — standalone heavy sorties:**

- BUG-SIM-01 (volunteer / employment_form) — 10 h, data-loss already occurred, blocks volunteer vertical
- BUG-SIM-02 Path 1 (daily_reconciliation aggregate view) — 2.5 h, can ship before Bundle A
- BUG-SIM-27 (temporal lock midnight-crossing) — 9 h, blocks all late-night ops

### ADR-grade decisions required

| Bug | ADR action | Slot |
|---|---|---|
| BUG-SIM-01 | AMEND ADR-0001 (D1 contract semantics) — volunteer carve | ADR-0001 amendment |
| BUG-SIM-02 Path 2 | Covered by [[ADR-0426]] | ADR-0426 sortie |
| BUG-SIM-03 | No ADR (mechanical) | — |
| BUG-SIM-23 | Covered by [[ADR-0426]] | ADR-0426 sortie |
| BUG-SIM-24 | No ADR (mechanical code-only, schema correct) | — |
| BUG-SIM-25 | No ADR (mechanical PL/pgSQL fix) | — |
| BUG-SIM-26 | Clarification noted in ADR-0426 + [[ADR-0367]] cross-ref | ADR-0426 HANDOFF L-NEW |
| BUG-SIM-27 | AMEND ADR-0066 (Temporal Shift Lock Architecture) | ADR-0066 amendment |

### ADR-0421-class anti-pattern risk

[[ADR-0421]] (Declared Contract Fulfillment Rule) defines 7 sub-patterns A-G. Audit:

| Bug | Sub-pattern risk | Notes |
|---|---|---|
| BUG-SIM-01 | **E (deprecation drift)** — Tripletex comment says NULL = volunteer, NOT NULL constraint says otherwise | Comment + constraint already diverged. Data loss occurred. |
| BUG-SIM-02 | **None directly** — but Path 2 risks **C (capability tool + EF diverge)** if event_settlement reads route differently from daily_reconciliation reads | Mitigation: ADR-0426 should mandate single read-path. |
| BUG-SIM-03 | **None** — partial index is correctly scoped to current intent, audit gap is documented limitation. |
| BUG-SIM-23 | **D (enum + DB column without BFF route)** — `tip_pool_status='paid'` exists; no BFF route for the paid-tip-pool aggregate-by-event lookup | Mitigation: ADR-0426 implementation must add the read-path. |
| BUG-SIM-24 | **B (component built but never used)** — `end_date` column shipped 2026-04-21, never read by cascade. **Same shape as BUG-SIM-22 (`platform_metrics_daily`).** | Mitigation: cascade engine update closes both. Add to ADR-0421 enforcement scan list. |
| BUG-SIM-25 | **F (docstring drift)** — comment in RPC says "actor must belong to same workspace" but predicate also drops on inactive — minor doc drift. |
| BUG-SIM-26 | **None directly** — UNIQUE is correct intent; consumer code matches schema. Architectural mismatch (sessions-vs-day_lines) is a different class than ADR-0421. |
| BUG-SIM-27 | **F (docstring drift)** — function COMMENT says "shift is in immutable window using workspace timezone" but midnight-crossing case is silently locked. Should say "shift_date-bucket window". |

Highest ADR-0421 risk: **BUG-SIM-24** matches sub-pattern B (column built but never used) — same shape as `platform_metrics_daily` queried-without-creation (BUG-SIM-22, already FIXED). Add cascade.end_date to the ADR-0421 enforcement scan list when next iteration ships.

### Sortie campaign structure recommendation

**Sequential — three sortier:**

1. **Sortie X1 (Priority 1+2, ~19 h)** — VOLUNTEER + TEMPORAL LOCK
   - BUG-SIM-01 (10 h) — ADR-0001 amendment + multi-step migration
   - BUG-SIM-27 (9 h) — ADR-0066 amendment + function update
   - Both unblock real production scenarios (volunteer onboarding, late-night ops)
   - **Independent** — can parallelize as two sub-sorties under a campaign

2. **Sortie X2 (Priority 3+6+7+8, ~14.5 h)** — INDEPENDENT MECHANICAL
   - BUG-SIM-02 Path 1 (2.5 h) — aggregate view
   - BUG-SIM-24 (8 h) — cascade multi-day expansion
   - BUG-SIM-03 (1 h) — orphan index
   - BUG-SIM-25 (3 h) — actor-state guard
   - All independent, no shared ADRs. Can be 4 parallel sub-sorties on a single day.

3. **Sortie X3 (Priority 4+5, bundled with ADR-0426 baseline)** — EVENT ENTITY
   - BUG-SIM-23 + BUG-SIM-26 + BUG-SIM-02 Path 2 (+ 14 h on top of ADR-0426 base)
   - Single sortie owned by ADR-0426 author (per [[ADR-0426]] X03-A through X03-D plan)
   - **Blocks on ADR-0426 acceptance** (currently PROPOSED)

**Parallel option within X1 + X2:** With sufficient agent capacity, X1 and X2 can run concurrently — they touch disjoint schemas (employment_contract + RPC vs daily_reconciliation + tip_distribution + planning_event cascade engine). Three parallel sub-sorties in X2 could collapse calendar time to ~8 h.

**Priority ordering — top 3:**

1. **BUG-SIM-01** — data already corrupted, blocks volunteer vertical entirely. Highest urgency despite forward-only resolution.
2. **BUG-SIM-27** — blocks late-night ops every single night for any hotel/festival/late-bistro workspace.
3. **BUG-SIM-02 Path 1** — 2.5 h ship to close one HIGH-severity rollup gap immediately, deferring Path 2 to ADR-0426 sortie.

### Recurring patterns to capture

1. **Constraint vs comment drift (BUG-SIM-01)** — `COMMENT ON COLUMN` should be considered part of the contract; future migrations should fail CI if column comment contradicts CHECK / NOT NULL / FK semantics. Currently no enforcement.
2. **Mirrored function logic (BUG-SIM-27)** — PL/pgSQL function + TS client + TS server action all re-implement the same temporal predicate. Code-search should flag "client mirror" comments as a pattern requiring synchronization. Currently three sites diverge silently if one is updated.
3. **Schema columns without consumers (BUG-SIM-24)** — `end_date` shipped 2026-04-21, never read by cascade. Same as L-0354 / ADR-0413 capability registry: declared surfaces require paired implementation. ADR-0421 enforcement scan should include "schema columns added with zero non-test consumers older than 30 days".
4. **5-agent independent convergence (BUG-SIM-23)** — when five agents flag the same gap independently, it is architectural, not implementation. Surface to ADR-grade decision before sortie. ADR-0426 captured this correctly.

---

## Output summary

| Bug | Severity | Priority | Risk class | ADR action | Sortie cost |
|---|---|---|---|---|---|
| BUG-SIM-01 | 🔴 CRITICAL | 1 | CRITICAL (data-loss occurred) | AMEND ADR-0001 | 10 h |
| BUG-SIM-27 | 🟠 HIGH | 2 | HIGH | AMEND ADR-0066 | 9 h |
| BUG-SIM-02 P1 | 🟠 HIGH | 3 | LOW | None | 2.5 h |
| BUG-SIM-23 | 🟠 HIGH | 4 | HIGH | Via [[ADR-0426]] | bundled |
| BUG-SIM-26 | 🟠 HIGH | 5 | MEDIUM | Via [[ADR-0426]] + clarify [[ADR-0367]] | bundled |
| BUG-SIM-24 | 🟡 MEDIUM | 6 | LOW | None | 8 h |
| BUG-SIM-03 | 🟡 MEDIUM | 7 | LOW | None | 1 h |
| BUG-SIM-25 | 🟢 LOW | 8 | LOW | None | 3 h |

**Total standalone work (excluding ADR-0426 bundle):** ~33.5 h
**ADR-0426 bundle additional bug-work:** ~14 h on top of ADR-0426 baseline
**Grand total:** ~47.5 h across 3 sequential or 5+ parallel sortier.
