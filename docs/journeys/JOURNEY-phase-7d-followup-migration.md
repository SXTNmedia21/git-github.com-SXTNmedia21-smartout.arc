---
title: "Journey — phase-7d-followup-migration"
status: verified
verified_at: 2026-05-17
feature: phase-7d-followup-migration
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [journey, payroll, lovsen, phase-7d, migration, schema]
---

# Journey — phase-7d-followup-migration

> Sortie 2 of 3 in Phase 7d-followup execution. Schema migration sortie.
> Three journeys cover: (1) fresh workspace bootstrap after Phase 7f deployment,
> (2) BOOTSTRAP-BACKFILL for existing workspaces at migration apply time,
> (3) tariff-floor enforcement when admin attempts a below-floor supplement override.

---

## Journey 1: Fresh Workspace Bootstrap (Post-Phase 7f Deployment)

**Precondition:** Admin completes `/onboarding` wizard for a new workspace.
Migration `20260618100000` is applied. Phase 7f `setup_workspace_tariff` capability
tool exists (NOT YET — gated on Sortie 3 delegation tools). `seed_default_framework_binding`
trigger (cascade D3 binding) is already live from prior migration.

1. Admin submits onboarding wizard final step →
   `public.workspace` INSERT fires →
   `seed_default_framework_binding` trigger creates cascade D3 binding
   (e.g., `hospitality.no.default.v1` framework) — existing behaviour →
   `seed_default_workspace_union_binding` trigger (NEW, Part F) fires →
   trigger emits `RAISE NOTICE 'workspace_union_binding: deferring to Phase 7f
   setup_workspace_tariff — no profile exists at workspace INSERT time'` →
   trigger returns NEW without writing any row.
2. Admin completes wizard → bootstrap-cascade Edge Function creates the first owner
   profile row in `public.profile`.
3. Admin navigates to `/dashboard/settings/payroll` → tariff onboarding step appears →
   admin selects union agreement (e.g., taro-79 Riksavtalen 2024-2026).
4. Client calls `setup_workspace_tariff('taro-79', '2024-2026')` (Phase 7f capability
   tool — NOT YET SHIPPED; gated on Sortie 3) →
   tool calls `cascade.bind_workspace_union` delegation tool (Sortie 3, ADR-0356) →
   delegation tool INSERTs `public.workspace_union_binding` row with
   `amendment_classifier='BOOTSTRAP'`, `effective_from=today`, `effective_to=NULL`,
   `union_id='taro-79'`, `version='2024-2026'`.
5. Part E cache trigger fires AFTER INSERT →
   SECURITY DEFINER function executes `UPDATE payroll.workspace_settings
   SET active_union_id='taro-79', is_tariff_bound=true, active_binding_id=<new_uuid>
   WHERE workspace_id=<ws>` →
   Part J CHECK constraint validates: `is_tariff_bound=true` iff
   `active_union_id IS NOT NULL`.
6. Calc engine reads `is_tariff_bound=true` from `payroll.workspace_settings` cache
   on next calculation run — no refactor of hot-path per L-0293.

**Postcondition:** Workspace has exactly 1 cascade D3 binding
(`workspace_framework_binding` row via seed_default_framework_binding) AND 1 lovsen
union binding (`workspace_union_binding` row, `amendment_classifier='BOOTSTRAP'`).
`payroll.workspace_settings` cache populated: `is_tariff_bound=true`,
`active_union_id='taro-79'`, `active_binding_id=<uuid>`.
Calc engine reads `is_tariff_bound=true` from cache without JOIN.

**Error paths:**

- (a) Admin calls `setup_workspace_tariff` before bootstrap-cascade EF creates owner
  profile → `cascade.bind_workspace_union` delegation tool looks up profile to populate
  `created_by_profile_id` FK → profile not found → delegation tool RAISES structured
  error `'workspace_union_binding: no profile found for workspace; complete bootstrap
  first'` → admin directed to finish wizard before tariff selection.
- (b) Part E cache trigger fires but `payroll.workspace_settings` row does not yet exist
  for this workspace → trigger executes UPDATE with 0 rows affected → silently no-ops;
  row created later by bootstrap-cascade EF → admin runs `setup_workspace_tariff` again
  → second INSERT ON CONFLICT skips duplicate-binding guard → cache trigger fires →
  UPDATE now succeeds.
- (c) Duplicate binding attempted (idempotency re-run) → `IF EXISTS` subquery guard in
  Part H (backfill) skips; for Phase 7f tool path: delegation tool checks active binding
  before INSERT → returns existing binding ID rather than inserting duplicate.

---

## Journey 2: BOOTSTRAP-BACKFILL for Existing Workspaces

**Precondition:** Migration `20260618100000` applies on an existing database with
6 workspaces having no `workspace_union_binding` rows. Profile rows exist in at least
some workspaces. `payroll.workspace_settings` rows MAY or MAY NOT exist per workspace
(dev workspaces had none — settings created by bootstrap-cascade EF, not at workspace
INSERT time).

1. DBA or CI pipeline runs `npx supabase db push` (or `supabase db reset`) →
   migration `20260618100000` applies in sequence.
2. Part I pre-migration audit DO-block executes FIRST →
   SELECTs existing `public.supplement_rule` rows to verify zero violations of the
   upcoming tariff-floor trigger (Part G) before it fires →
   if violations exist, RAISE EXCEPTION halts migration cleanly with diagnostic.
3. Parts A–G execute (table creates, column adds, triggers registered).
4. Part H BOOTSTRAP-BACKFILL DO-block begins →
   iterates `SELECT workspace_id FROM public.workspace` →
   for each workspace:
   - Checks `IF EXISTS (SELECT 1 FROM public.workspace_union_binding
     WHERE workspace_id=v_ws AND effective_to IS NULL)` → if true, logs
     `RAISE NOTICE 'workspace % already has active binding, skip'` and continues.
   - Looks up owner/admin profile:
     `SELECT profile_id FROM public.profile
     WHERE workspace_id=v_ws AND role IN ('owner','admin') LIMIT 1` →
     fallback: `SELECT profile_id FROM public.profile WHERE workspace_id=v_ws LIMIT 1`.
   - If no profile found → `RAISE NOTICE 'workspace % has no profiles, skip'` + continues.
   - If profile found → INSERTs `public.workspace_union_binding` row with
     `union_id='non-bound'`, `amendment_classifier='BOOTSTRAP-BACKFILL'`,
     `effective_from=now()`, `effective_to=NULL`,
     `created_by_profile_id=v_profile`.
   - Part E cache trigger fires per INSERT →
     attempts `UPDATE payroll.workspace_settings SET active_union_id='non-bound',
     is_tariff_bound=false, active_binding_id=<uuid> WHERE workspace_id=v_ws` →
     0 rows updated if `payroll.workspace_settings` row absent (dev workspaces) → no-op.
5. Part J self-test DO-block asserts:
   - All active `workspace_union_binding` rows (non-NULL `effective_to`) have a
     matching `payroll.workspace_settings` cache row WHERE settings row exists
     (defensive scope — settings absent is acceptable for dev workspaces).
   - RAISE EXCEPTION if assertion fails; migration aborts with diagnostic.
6. Migration completes — 6 BOOTSTRAP-BACKFILL rows written to
   `public.workspace_union_binding` in local dev. 0 `workspace_settings` cache rows
   updated (settings rows absent for all 6 dev workspaces).

**Postcondition:** Every workspace with ≥1 profile has exactly 1 active
`workspace_union_binding` row with `effective_to IS NULL` and
`amendment_classifier='BOOTSTRAP-BACKFILL'`. Self-test (Part J) passes.
Workspaces without profiles are explicitly logged and skipped (binding seeded later
via Phase 7f `setup_workspace_tariff` admin tool).

**Error paths:**

- (a) Workspace has zero profiles → skipped with `RAISE NOTICE`; binding seeded later
  when admin completes onboarding. No error, no partial state.
- (b) `payroll.workspace_settings` row absent for a workspace → cache trigger UPDATE
  fires with 0 rows affected → silently succeeds; admin completes bootstrap-cascade →
  settings row created → Phase 7f `setup_workspace_tariff` call fully populates cache.
- (c) Idempotency re-run (migration applied twice, e.g., reset + re-apply) →
  `IF EXISTS` guard in Part H skips all workspaces that already have active bindings →
  no duplicate rows; Part J self-test passes again.
- (d) Part I finds existing supplement_rule rows that would violate tariff floor →
  Part I RAISE EXCEPTION halts migration → DBA resolves violation manually → re-runs
  migration. Ensures Part G trigger doesn't fire retroactively on invalid state.

---

## Journey 3: Tariff-Floor Enforcement on Admin Supplement Override

**Precondition:** Workspace is bound to taro-79 Riksavtalen 2024-2026 via
`workspace_union_binding` row with `amendment_classifier='BOOTSTRAP'`.
`payroll.workspace_settings` cache: `is_tariff_bound=true`, `active_union_id='taro-79'`.
Phase 7f `add_supplement_override` capability tool exists (NOT YET — gated on Sortie 3).

1. Admin opens `/dashboard/settings/payroll/supplements` →
   page shows current supplement rules for the workspace.
2. Admin enters a new supplement rate: kveldstillegg = 25 kr/t →
   client-side validation runs first (Phase 7f UI validation step — warns if obviously
   low) → admin submits.
3. Phase 7f `add_supplement_override` capability tool (NOT YET SHIPPED) calls
   `cascade.add_supplement_rule` delegation tool (Sortie 3, ADR-0356) →
   delegation tool attempts `INSERT INTO public.supplement_rule
   (workspace_id, supplement_type='kveldstillegg', rate_value=25, ...)`.
4. Part G BEFORE INSERT trigger fires on `public.supplement_rule` →
   trigger reads cache: `SELECT is_tariff_bound, active_union_id
   FROM payroll.workspace_settings WHERE workspace_id=<ws>` →
   `is_tariff_bound=true`, `active_union_id='taro-79'` →
   trigger looks up floor:
   `SELECT MIN(amount) FROM public.tariff_rate_table
   WHERE rate_type='kveldstillegg'
   AND (workspace_id IS NULL OR workspace_id=<ws>)
   AND effective_from <= CURRENT_DATE
   AND (effective_until IS NULL OR effective_until > CURRENT_DATE)` →
   `v_floor = 42.41`.
5. Trigger compares: `25 < 42.41` → RAISES EXCEPTION
   `'supplement_rate_below_tariff_floor: rate=25, floor=42.41,
   union_id=taro-79, aml_ref=§14-15'` →
   INSERT rolls back atomically.
6. Delegation tool catches EXCEPTION → returns structured error envelope to capability
   tool → capability tool surfaces `SUPPLEMENT_BELOW_TARIFF_FLOOR` error →
   admin UI displays: "Satsen er under tariff-minimum (42.41 kr/t).
   Aml. §14-15 forbyr dette." in red.

**Postcondition:** No row inserted in `public.supplement_rule`. Aml. §14-15 compliance
enforced structurally at DB layer per ADR-0351 amended (TRIGGER, not CHECK constraint).
Defense-in-depth: client validation + DB trigger — both must agree before INSERT lands.

**Error paths:**

- (a) Above-floor override (e.g., 50 kr/t) → trigger checks pass: `50 >= 42.41` →
  trigger returns NEW → INSERT succeeds → supplement_rule row created.
- (b) Platform template rules (`workspace_id IS NULL`) → trigger skips workspace-scoped
  floor lookup → INSERT succeeds; platform rules ARE the floor by definition, no
  enforcement against themselves.
- (c) Non-tariff-bound workspace (`is_tariff_bound=false`) → trigger checks first
  condition: `is_tariff_bound=false` → trigger returns NEW immediately (skips floor
  lookup) → INSERT succeeds; Phase 7f capability tool emits Lovsen advisory
  (non-blocking soft warning in response envelope, not an error).
- (d) `tariff_rate_table` has no row for this `supplement_type` → `v_floor = NULL` →
  trigger `v_floor IS NULL` branch returns NEW (no floor defined for unmapped
  supplement types) → INSERT succeeds.
- (e) `payroll.workspace_settings` row missing for workspace → trigger's cache SELECT
  returns NULL row → trigger interprets as `is_tariff_bound=false` →
  returns NEW (no enforcement without cache) → INSERT succeeds; flag to admin that
  tariff setup is incomplete.
