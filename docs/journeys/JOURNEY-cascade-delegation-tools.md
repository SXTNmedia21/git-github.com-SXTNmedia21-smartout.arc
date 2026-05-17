---
title: "Journey — cascade-delegation-tools"
status: verified
verified_at: 2026-05-17
feature: cascade-delegation-tools
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [journey, cascade, delegation, capability, payroll, phase-7d, adr-0356]
---

# Journey — cascade-delegation-tools

> Sortie 3 of 3 in Phase 7d-followup execution. Capability tooling sortie.
> Three journeys cover: (1) Phase 7f `setup_workspace_tariff` delegating to
> `cascade.bind_workspace_union`; (2) Phase 7f `add_supplement_override`
> delegating to `cascade.add_supplement_rule` with tariff-floor enforcement;
> (3) frozen-4 violation detection via `delegated_via` audit field.

---

## Journey 1: Phase 7f setup_workspace_tariff calls cascade.bind_workspace_union

> Delegation chain from payroll capability → cascade delegation tool → DB INSERT.
> Phase 7f `setup_workspace_tariff` tool does NOT yet exist — it is the next sortie.
> This journey documents the contractual interface that Sortie 3 enforces.

**Precondition:** Migration `20260618100000` (Sortie 2) applied. Workspace exists
with BOOTSTRAP-BACKFILL binding (`union_id='non-bound'`, `effective_to IS NULL`)
seeded by Part H of the migration. Admin has completed onboarding wizard and
selected tariff agreement taro-79 (Riksavtalen 2024-2026) in the Phase 7f
settings UI (NOT YET SHIPPED). Auth session resolves `workspaceId + profileId`
non-empty (L-0177 precondition). Phase 7f `setup_workspace_tariff` tool exists
(NOT YET — separate sortie).

1. Admin submits "Tariff" wizard step selecting union=taro-79, version=2024-2026 →
   Phase 7f `setup_workspace_tariff` tool fires its own `gate_action
   'payroll.setup_workspace_tariff'` → caller gate approves.
2. `setup_workspace_tariff` body calls `cascade.bind_workspace_union({
   workspace_id: ctx.workspaceId, union_id: 'taro-79', law_version: '2024-2026',
   effective_from: today, amendment_classifier: 'BOOTSTRAP',
   derivation_snapshot_id: null })`.
3. `bind_workspace_union` execute fires — L-0177 ctx-derive: checks
   `ctx.workspaceId` non-empty AND `ctx.profileId` non-empty → both pass →
   cross-workspace check: `input.workspace_id === ctx.workspaceId` → passes →
   AMENDMENT check: `amendment_classifier='BOOTSTRAP'` → not blocked (MATERIAL
   and ENDRINGSOPPSIGELSE are the two blocked values per ADR-0252 §F).
4. `gate_action 'cascade.bind_workspace_union'` fires (delegation gate per
   ADR-0356 §"Gate convention" — independent of caller gate, fires SECOND) →
   authority config: `defaultAuthority='autonomous'` from seed migration
   `20260618200000` → gate approves.
5. `gatedMutation` exec body runs (all DB ops inside one gate scope):
   - SELECT `workspace_union_binding WHERE workspace_id=ctx.workspaceId AND
     effective_to IS NULL LIMIT 1` → finds BOOTSTRAP-BACKFILL row
     (`workspace_union_binding_id=<backfill_uuid>`).
   - Compute `effective_to = effective_from - 1 day` (JS Date arithmetic).
   - UPDATE `workspace_union_binding SET effective_to=<yesterday>` WHERE
     `workspace_union_binding_id=<backfill_uuid>` AND `workspace_id=ctx.workspaceId`
     — APPEND-ONLY trigger (`trg_workspace_union_binding_immutability`) allows
     UPDATE on `effective_to` column only; all other columns blocked at DB layer.
   - INSERT new `workspace_union_binding` row: `union_id='taro-79'`,
     `law_version='2024-2026'`, `effective_from=today`, `effective_to=NULL`,
     `created_by=ctx.profileId`, `amendment_classifier='BOOTSTRAP'`,
     `derivation_snapshot_id=NULL`.
6. Cache trigger `trg_sync_workspace_settings_union_cache` fires AFTER INSERT →
   SECURITY DEFINER function executes UPDATE `payroll.workspace_settings SET
   active_union_id='taro-79', is_tariff_bound=true, active_binding_id=<new_uuid>
   WHERE workspace_id=<ws>` → cache populated.
7. `bind_workspace_union` emits `cascade.workspace_union_binding_created` with
   `delegated_via: 'cascade'` — load-bearing per ADR-0356 §"Audit trail symmetry":
   auditors query `activity_trail WHERE delegated_via IS NOT NULL AND
   entity_type='workspace'` to trace cross-namespace writes.
8. Returns `{ ok: true, workspace_union_binding_id: <new_uuid>, effective_from }` →
   `setup_workspace_tariff` body receives result → emits its own payroll event →
   returns to Phase 7f UI.

**Postcondition:** Workspace has 2 `workspace_union_binding` rows: (a) old
BOOTSTRAP-BACKFILL row now with `effective_to=<yesterday>` (closed, APPEND-ONLY
immutable from here), (b) new BOOTSTRAP row with `effective_to=NULL` (active).
`payroll.workspace_settings` cache: `is_tariff_bound=true`,
`active_union_id='taro-79'`, `active_binding_id=<new_uuid>`. Cascade D3 binding
(`workspace_framework_binding`) untouched — lovsen and D3 bindings coexist.
Calc engine reads `is_tariff_bound=true` from cache without JOIN (L-0293).
Audit chain: two `activity_trail` rows — one per gate (payroll + cascade),
both with `delegated_via` populated.

**Error paths:**

- (a) Caller gate denied: Phase 7f tool's gate_action rejects before reaching
  delegation → `AUTHORITY_DENIED` returned by payroll tool; cascade tool never
  called.
- (b) Missing profile context (L-0177): `ctx.workspaceId` empty or
  `ctx.profileId` empty → cascade tool returns `{ ok: false,
  code: 'MISSING_PROFILE_CONTEXT' }` immediately before any DB call.
- (c) Cross-workspace attempt: body `workspace_id` ≠ `ctx.workspaceId` → cascade
  tool returns `{ ok: false, code: 'INVALID_WORKSPACE' }` before delegation gate
  fires. Prevents forged cross-workspace writes per ADR-0151.
- (d) AMENDMENT_BLOCKED: caller passes `amendment_classifier='MATERIAL'` or
  `'ENDRINGSOPPSIGELSE'` → cascade tool returns `{ ok: false,
  code: 'AMENDMENT_BLOCKED', aml_ref: '§14-6(m)' }` before gate fires. Caller
  must route to Phase 7f amendment-handler (separate sortie).
- (e) APPEND-ONLY trigger rejects UPDATE on non-`effective_to` column → DB
  raises EXCEPTION → `gatedMutation` exec re-throws →
  `MutateWithGateError('execute_failed')` surfaces → cascade tool returns
  `{ ok: false, code: 'CASCADE_GATE_ERROR' }`. Cannot happen from this tool body
  (only `effective_to` is updated) — defense-in-depth at DB layer.

---

## Journey 2: Phase 7f add_supplement_override calls cascade.add_supplement_rule

> Tariff-floor enforcement chain: payroll delegation → DB INSERT → BEFORE INSERT
> trigger → PG EXCEPTION → ADR-0152 structured envelope → UI error.

**Precondition:** Workspace bound to taro-79 via `workspace_union_binding` with
`amendment_classifier='BOOTSTRAP'` and `effective_to IS NULL`. Cache populated:
`payroll.workspace_settings.is_tariff_bound=true`,
`active_union_id='taro-79'`. Tariff floor for `supplement_type='kveldstillegg'`
is 42.41 kr/t in `public.tariff_rate_table` (or öre equivalent). Phase 7f
`add_supplement_override` tool exists (NOT YET — separate sortie). Admin opens
supplement override UI and enters a rate below floor.

1. Admin enters kveldstillegg override = 25 kr/t in Phase 7f supplement UI →
   Phase 7f client-side validation runs first (warns if obviously low — soft
   guard, not blocking) → admin submits.
2. Phase 7f `add_supplement_override` tool fires its own `gate_action
   'payroll.add_supplement_override'` → caller gate approves.
3. `add_supplement_override` body calls `cascade.add_supplement_rule({
   workspace_id: ctx.workspaceId, name: 'Kveldstillegg override',
   supplement_type: 'normal', rate_value: 25, rate_type: 'fixed_per_hour',
   tariff_rate_table_id: null, paragraf_ref: '§14-15', match_predicate: {} })`.
4. `add_supplement_rule` execute fires — L-0177 ctx-derive passes → cross-workspace
   check passes → `gate_action 'cascade.add_supplement_rule'` fires →
   `defaultAuthority='autonomous'` → gate approves.
5. `gatedMutation` exec body runs: INSERT `public.supplement_rule` with
   `workspace_id = ctx.workspaceId` (server-derived from ctx, NOT body — final
   defense against residual forgery risk per ADR-0151).
6. BEFORE INSERT trigger `enforce_supplement_tariff_floor` (Sortie 2 Part G)
   fires: reads cache `SELECT is_tariff_bound, active_union_id FROM
   payroll.workspace_settings WHERE workspace_id=<ws>` → `is_tariff_bound=true`,
   `active_union_id='taro-79'` → looks up floor: `SELECT MIN(amount) FROM
   public.tariff_rate_table WHERE rate_type='kveldstillegg' AND
   (workspace_id IS NULL OR workspace_id=<ws>) AND effective_from <= CURRENT_DATE
   AND (effective_until IS NULL OR effective_until > CURRENT_DATE)` →
   `v_floor = 42.41` → compares: `25 < 42.41` → RAISES EXCEPTION
   `'supplement_rate_below_tariff_floor: rate=25, floor=42.41,
   union_id=taro-79, aml_ref=§14-15'` → INSERT rolls back atomically.
7. `add_supplement_rule` exec callback catches `insertErr` matching
   `/supplement_rate_below_tariff_floor/i` → regex-parses `floor=42.41` and
   `proposed=25` from PG exception message → sets `execResult = { ok: false,
   code: 'SUPPLEMENT_BELOW_TARIFF_FLOOR', floor: 42.41, proposed: 25 }` →
   throws (signals exec failure to `mutateWithGate` wrapper).
8. Outer catch checks `execResult !== null` FIRST (before `MutateWithGateError`
   instance check) → reads `execResult.code === 'SUPPLEMENT_BELOW_TARIFF_FLOOR'`
   → returns ADR-0152 structured envelope: `{ ok: false,
   code: 'SUPPLEMENT_BELOW_TARIFF_FLOOR', aml_ref: '§14-15', floor: 42.41,
   proposed: 25, message: 'supplement rate below tariff minimum...' }`.
9. `add_supplement_override` catches envelope → Phase 7f UI shows:
   "Satsen er under tariff-minimum (42.41 kr/t). Aml. §14-15 forbyr dette." in
   red error state.

**Postcondition:** No row inserted in `public.supplement_rule` (INSERT rolled
back). `§14-15` compliance enforced structurally at DB layer (trigger) per
ADR-0351 amended (TRIGGER, not CHECK constraint). Defense-in-depth: client
validation (soft) + delegation gate + DB trigger (hard). No telemetry emitted
(emit only fires on success path per tool body structure).

**Error paths:**

- (a) Above-floor override (e.g., 50 kr/t): trigger checks `50 >= 42.41` →
  RETURN NEW → INSERT succeeds → emit `cascade.supplement_rule_added` with
  `delegated_via: 'cascade'` → `{ ok: true, supplement_rule_id: <uuid> }`.
- (b) Workspace not tariff-bound (`is_tariff_bound=false`): trigger reads cache
  → first branch `IF NOT is_tariff_bound THEN RETURN NEW` → trigger skips floor
  lookup entirely → INSERT succeeds. Phase 7f capability tool may emit a Lovsen
  advisory in response envelope (non-blocking soft warning — tariff setup
  incomplete, not a hard error).
- (c) `tariff_rate_table` has no row for this `supplement_type`: trigger
  `SELECT MIN(amount)` returns NULL → `v_floor IS NULL` branch → RETURN NEW
  (no floor defined for unmapped supplement types) → INSERT succeeds.
- (d) `payroll.workspace_settings` row missing (workspace in mid-bootstrap):
  trigger's cache SELECT returns NULL row → trigger interprets as
  `is_tariff_bound=false` → RETURN NEW → INSERT succeeds. Phase 7f tool surfaces
  advisory that tariff setup is incomplete.
- (e) Platform template write attempt (`workspace_id=NULL`): blocked at L-0177
  ctx-derive — `ctx.workspaceId` is always non-null for authenticated sessions;
  cross-workspace check then fires with a non-null workspace_id from the
  authenticated session.

---

## Journey 3: Direct payroll capability write (frozen-4 violation detection)

> ADR-0356 compliance is enforced by convention + audit-trail introspection,
> not by RLS alone. This journey documents how violations are detectable.

**Precondition:** A hypothetical buggy or malicious Phase 7f capability tool
attempts to write directly to `public.workspace_union_binding` from the payroll
capability body, bypassing delegation to `cascade.bind_workspace_union`.

1. Payroll capability tool body executes: `supabaseAdmin.from(
   'workspace_union_binding').insert({ workspace_id: ctx.workspaceId, ... })`.
2. Supabase service-role client bypasses user-facing RLS, but workspace-scoped
   JWT RLS policy `jwt_insert_workspace_union_binding` (from migration
   `20260618100000`) would allow the INSERT if checked — the check is bypassed
   by service role. INSERT lands in DB.
3. Telemetry path: payroll capability emits its own event via `emit()` but does
   NOT call `cascade.bind_workspace_union` → `activity_trail` row written by the
   direct INSERT path has `delegated_via = NULL` (cascade tool never called;
   only cascade tool writes `delegated_via` field per ADR-0356 §"Audit trail
   symmetry").
4. Review tooling queries: `SELECT * FROM activity_trail WHERE delegated_via IS
   NULL AND entity_type = 'workspace' AND event_type LIKE '%union_binding%'` →
   returns the violation row.
5. ADR-0356 violation flagged: tool written by payroll capability MUST delegate
   via `cascade.bind_workspace_union`. Fix: refactor payroll tool body to call
   `cascade.bind_workspace_union` → re-run → audit query returns 0 rows.

**Postcondition:** ADR-0356 violation is detectable via audit-trail introspection
on `delegated_via IS NULL`. Frozen-4 boundary (ADR-0173) is respected by
convention enforced through audit pattern, not by RLS (which would allow the
direct write for service-role callers). Detection is post-hoc; prevention is via
code review verifying payroll capability files do NOT reference
`workspace_union_binding` table directly.

**Error paths:**

- (a) Static analysis enforcement (future): TypeScript lint rule could check
  which capability files reference which table names and fail CI when payroll
  imports or calls `workspace_union_binding` directly. Out of scope this sortie.
- (b) Heartbeat automation (future): daily cron job runs the `delegated_via IS
  NULL` audit query and creates a Linear ticket tagged `adr-0356-violation` on
  hit. Out of scope this sortie — documented as known debt in HANDOFF.
- (c) Correct implementation: payroll tool calls `cascade.bind_workspace_union`
  → cascade tool's `emit()` writes `delegated_via: 'cascade'` → audit query
  returns 0 rows → no violation.
