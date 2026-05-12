---
title: "Riksavtalen Versjonering Migration Policy — bulk-amendment of active contract_pay_rule on tariff renegotiation"
id: ADR_0252
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: []
relates_to:
  - ADR_0001
  - ADR_0076
  - ADR_0090
  - ADR_0241
  - ADR_0244
  - ADR_0251
---

# ADR-0252: Riksavtalen Versjonering Migration Policy

## Context and Problem Statement

When Riksavtalen (the Norwegian hospitality sector collective agreement administered
by NHO Reiseliv and Fellesforbundet) is renegotiated, every active
`contract_pay_rule` row whose `framework_rule_id` references a now-superseded
`framework_rule` version becomes semantically stale: the rate it encodes no longer
reflects the current agreed minimum. Without a defined policy, Smartout has no
canonical behavior for propagating tariff revisions to the thousands of affected
rows across all active workspace contracts.

This deferral was first recorded in the local contract-service ADR-0001 §"Åpne
spørsmål" (file: `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`,
line 234): *"Tariff-versjonering: når Riksavtalen reforhandles, hvordan migreres
aktive contract_pay_rule-rader?"* It is also an explicit risk-item in
`docs/plans/PLAN-contract-employee.md` (line 182): *"Riksavtalen-versjonering —
migrering av aktive contract_pay_rule-rader når tariff reforhandles. Trenger
egen ADR."* PLAN Phase 6 step 5 (line 151) lists it as a required deliverable:
*"Bulk-flow ved tariff-version_changed (per ARCHITECTURE §5.3 + Journey 4 step 5)."*
ARCHITECTURE §5.3 (line 406) documents the amendment-handler flow that this
bulk-amendment must reuse. ARCHITECTURE §12 (line 612) reiterates the gap:
*"Riksavtalen-versjonering: når tariff reforhandles, hvordan migreres aktive
contract_pay_rule?"*

This ADR ends the deferral and provides the canonical policy for Phase 6 to
build against.

### Riksavtalen renegotiation cadence

Riksavtalen operates on two distinct renegotiation rhythms:

1. **Main revision (tariffrevisjon):** every two years, normally effective
   1 April (though 1 May is common for practical reasons). Changes rate tables,
   categories, and sometimes the rule structure itself. Examples: 2024–2026
   agreement for hospitality (NHO Reiseliv / Fellesforbundet).
2. **Annual index adjustment (indekstillegg):** in the interim year, a smaller
   across-the-board percentage increase is negotiated. Typically 2–3% of all
   tariff-bound rates. Structurally simpler: same categories, same rules, new
   `rate_value` numbers only.

The policy must handle both cadences, potentially with different operator
burden profiles.

### What "contract_pay_rule references framework_rule" means

`contract_pay_rule.framework_rule_id` (nullable, `database.types.ts` line 5381)
points to a specific `framework_rule.rule_id` (PK, `database.types.ts` line 8939).
`framework_rule` rows in the K1a layer belong to a `regulatory_framework`
(via `framework_rule.framework_id`). Versioning in the current schema is
expressed by `tariff_rate_table.effective_from` / `effective_until` (see
`database.types.ts` lines 17572–17573) and by `framework_rule` rows being
platform-controlled (no `workspace_id` column — they are K1a, not K1b).

Per ADR-0001-contract-service §"Felt-klassifisering" `contract_pay_rule`:

> `rate_value` (tariff-knyttet) = **ADMIN** — endres ved tariff-revisjon, propageres
> (file: `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`,
> line 195)

This classification is load-bearing: it tells us that a tariff-linked rate update
is ADMIN-class under the amendment model — no employee re-signing is required,
but the employee must be informed. The classification also means the amendment
handler (`amendment-handler.classify_change`) will set
`requires_employee_signature = false` on generated amendment rows, per ADR-0244
§"Amendment changes" (file: `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`,
line 41).

---

## Decision Drivers

- **ADR-0251 audit-trail integrity** — `shift_pay_calculation_event.rate_value_applied`
  is snapshotted at calculation time and must be immutable. Any propagation strategy
  that retroactively modifies `contract_pay_rule.rate_value` on already-calculated
  shifts would break the per-rule audit-trail defined in ADR-0251 §"Recalculation
  semantics" (file: `docs/decisions/0251-shift-pay-calculation-audit-module.md`,
  lines 346–378). This is the primary veto on Option 2 (retroactive update).

- **ADR-0076 snapshot-and-forward principle** — "override-data must carry provenance
  on the artifact that was overridden" (file:
  `docs/decisions/0076-contract-composition-as-cascade-derivation.md`, lines 64–86).
  New contract_pay_rule versions must carry forward-only provenance; old rows
  remain intact as the accounting truth for prior periods.

- **ADR-0244 amendment flow as legal evidence** — the bulk-amendment must produce
  `contract_amendment` rows with `is_constructive_dismissal_risk` evaluation,
  ADMIN-class amendment semantics, and audit emit per ADR-0244 (file:
  `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`,
  lines 41–62).

- **ADR-0090 framework_rule evaluation config** — `framework_rule.evaluation_config`
  is the typed condition tree that governs rule evaluation. Tariff rate changes
  update the associated `tariff_rate_table` rows; some revisions may also alter
  `framework_rule.evaluation_config` structure (e.g. new categories, new trigger
  conditions). The propagation policy must handle both rate-only changes and
  structural changes (file: `docs/decisions/0090-framework-rule-evaluation-config-schema.md`,
  lines 37–63).

- **ADR-0241 framework_snapshot JSONB precedent** — `employment_contract` already
  has a `framework_snapshot JSONB` column (established by ADR-0241; file:
  `docs/decisions/0241-contract-schema-migration-foundation.md`, line 50). The
  amendment flow must update this snapshot on bulk-apply to reflect the new
  framework state.

- **Aml. §15-7 constructive dismissal risk** — if a tariff revision results in
  a salary reduction (rare but possible, e.g. category reclassification), the
  amendment handler must set `is_constructive_dismissal_risk = true` per ADR-0244
  §"Lovsen Amendments" (file: `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`,
  line 111).

- **Bokføringsloven §13** — rate-value changes take effect from a specific
  `effective_from` date. The 5-year retention window on `shift_pay_calculation_event`
  (ADR-0251 §"Retention enforcement", lines 478–498) anchors on
  `shift_period_end_date`. New `contract_pay_rule` versions' `effective_from` dates
  determine which shifts are calculated under which rate; this boundary must be
  exact and auditable.

---

## Considered Options

### Option 1 — Snapshot-and-forward only (per ADR-0076)

Old `contract_pay_rule` rows keep old `rate_value` forever. New `contract_pay_rule`
rows are written on newly-created contracts and pick up the new rate from the
updated `tariff_rate_table`. No in-place update of existing rows. Existing contracts
continue to pay old rates indefinitely until manually renegotiated.

**Rejected because:**
- Violates Norwegian labor law minimum-wage obligation. If Riksavtalen raises the
  minimum rate, an employer who keeps paying the old (lower) rate is in breach of
  the tariff agreement and potentially Aml. §14-6 (written contract must reflect
  actual terms). Snapshot-and-forward is correct for preserving audit history but
  cannot be the full answer when the new rate is a legal minimum.
- Employees would receive no notification of the rate increase that they are
  entitled to under the collective agreement. The employer's duty to inform
  (informasjonsplikt, tied to tariff membership) is not discharged.
- Leaves the reconciliation entirely to manual admin action with no
  system-driven workflow, meaning revision events will be missed on large
  workspaces.

### Option 2 — Retroactive update (in-place overwrite)

Overwrite `rate_value` on all existing `contract_pay_rule` rows when a new
`framework_rule` version is activated.

**Rejected because:**
- Breaks ADR-0251 audit-trail integrity. `shift_pay_calculation_event.rate_value_applied`
  is snapshotted at INSERT time precisely because "the rate at calculation time is
  the accounting truth" (ADR-0251 §"Recalculation semantics",
  `docs/decisions/0251-shift-pay-calculation-audit-module.md`, line 348). In-place
  overwrite of `contract_pay_rule.rate_value` does not touch the event rows, but
  introduces divergence: the rule row shows the new rate while the event rows show
  the old rate with no chain of custody explaining the discrepancy. Audit queries
  (e.g., Bokføringsloven compliance review) would produce confusing results.
- Also breaks ADR-0076 cascade invariant #8: provenance is lost when the
  originating artifact is mutated in place (file:
  `docs/decisions/0076-contract-composition-as-cascade-derivation.md`, lines 64–86).

### Option 3 — Hybrid: snapshot-and-forward + bulk-amendment flow per ADR-0244 (chosen)

Old `contract_pay_rule` rows are never modified. The propagation is effected by
generating new `contract_amendment` rows (ADMIN-class, `requires_employee_signature = false`)
for every `employment_contract` bound to the affected `regulatory_framework`. Admin
reviews and bulk-confirms via the amendment inbox. On apply, new
`contract_pay_rule` rows are INSERTed with `effective_from = riksavtalen_official_date`
(see Decision Outcome §C). The old rows have their `effective_until` set to
`riksavtalen_official_date - 1 day` as the boundary. Historical
`shift_pay_calculation_event` rows are untouched.

**Chosen because:**
- Preserves ADR-0251 audit-trail invariant: no existing row is modified; the
  audit chain from shift → calculation event → contract_pay_rule (old) is intact.
- Respects ADR-0076 snapshot-and-forward principle: new events are appended;
  provenance is carried on the new `contract_pay_rule` version.
- Reuses the amendment flow established by ADR-0244: existing infrastructure,
  existing UI (`ContractAmendmentDiff` component), existing `is_constructive_dismissal_risk`
  evaluation. No new amendment state machine.
- Gives admin visibility and control: large workspaces can review, filter, and
  bulk-confirm before the rate change takes effect. This is operationally essential
  for workspaces with 50–500 employees.
- Satisfies the employer's duty to inform: each amendment row triggers a
  notification to the employee per ADR-0244 §"Amendment changes" item 4 (line 57):
  "ADMIN amendments: admin signature only, employee gets notification."
- Correctly handles constructive dismissal risk (salary reduction): the
  amendment handler's `is_constructive_dismissal_risk` calculation runs per row
  and flags contracts where the tariff change results in effective reduction.

---

## Decision Outcome

**Chosen: Option 3 — Hybrid snapshot-and-forward + bulk-amendment flow.**

The eight sub-decisions are resolved as follows.

---

### A. Propagation strategy

Old `contract_pay_rule` rows with `framework_rule_id` pointing to a now-superseded
`framework_rule` are **not modified**. Their `effective_until` is set to
`(new_effective_from - 1 day)` as a boundary marker (this is the only permitted
UPDATE on existing rows). New `contract_pay_rule` rows are INSERTed with
`effective_from = riksavtalen_official_date` and the new `rate_value` derived from
the updated `tariff_rate_table`.

The amendment record (`contract_amendment`) is the carrier of this transition.
It is ADMIN-class (`requires_employee_signature = false`), generates a notification
to the employee, and creates the audit trail required by Bokføringsloven §13 and
Aml. §14-6.

**Invariant (non-negotiable):**
`shift_pay_calculation_event.rate_value_applied` is immutable. No bulk-amendment
process, recalculation trigger, or migration may UPDATE or DELETE existing
`shift_pay_calculation_event` rows except via the explicit supersession path
defined in ADR-0251 §"Append-only invariant" (lines 289–334). This invariant
must be documented in the migration sortie spec and checked in build-agent
dispatches.

---

### B. Bulk-amendment generation trigger

**Chosen: `engine_event` consumer — `framework.tariff_version_changed` event
→ stage-engine consumer generates `contract_amendment` rows in batch.**

Flow:

1. Platform operator (Smartout platform admin, not workspace admin) activates a
   new `regulatory_framework` version in the platform admin panel. This write
   emits `framework.tariff_version_changed` via `@smartout/telemetry`.
2. stage-engine listens for this event. Consumer identifies all
   `workspace_framework_binding` rows where `framework_id` matches the updated
   framework. For each binding, it fetches all active `employment_contract` rows
   in that workspace with `contract_status IN ('active', 'pending_signature')`.
3. For each affected contract, it fetches all `contract_pay_rule` rows where
   `framework_rule_id IS NOT NULL` and `effective_until IS NULL` (i.e. currently
   active). For each such rule, it creates a `contract_amendment` row of type
   `tariff_version_bump`.
4. All generated amendments land in the workspace admin's amendment inbox at
   `/dashboard/contracts/inbox?type=tariff_amendment`.
5. Admin reviews and bulk-confirms (see §B-UI below). On confirmation, the
   amendment handler executes the INSERTs and `effective_until` SET.

**Rationale for engine_event over alternatives:**

- **DB trigger on `framework_rule`:** rejected because `framework_rule` is a K1a
  platform-level table (no `workspace_id`). A DB trigger here would need to fan
  out across all workspaces — cross-tenant writes from a trigger is an
  anti-pattern and violates RLS isolation.
- **Admin manual trigger page only:** rejected as sole mechanism because it relies
  entirely on Smartout staff remembering to trigger it per workspace, which will
  miss workspaces at scale. The engine_event approach is reliable; the admin page
  (see §B-UI) is the confirmation surface, not the trigger.
- **Cron watching framework_rule freshness:** rejected because "freshness" is a
  derived concept with ambiguous semantics. An event emitted at the point of
  deliberate platform activation is a better trigger than a polling loop.

**§B-UI — Admin amendment inbox surface:**

Path: `/dashboard/contracts/inbox?type=tariff_amendment`

The page shows amendments grouped by tariff revision event. Admin can:

1. Filter by department, role, contract type.
2. Preview the `ContractAmendmentDiff` (from ADR-0244) for any contract —
   field-level diff of old rate vs new rate, Riksavtalen §X.Y citation from
   `source_text` column (`database.types.ts` line 5387).
3. Bulk-select and confirm. "Confirm all" applies all non-flagged amendments.
   Amendments with `is_constructive_dismissal_risk = true` are quarantined
   and must be confirmed individually (see §F).
4. Set a global `effective_from` override for the batch (see §C).

---

### C. effective_from semantics

**Primary value: Riksavtalen's official effective date.**

When the platform operator activates a new framework version, they supply the
`official_effective_date` (e.g. `2026-05-01` for a 1 May tariffrevisjon). This
date is stored on the activation event and propagated to all generated
`contract_amendment.proposed_effective_from` fields.

**Admin override: per-batch.**

On the `/dashboard/contracts/inbox?type=tariff_amendment` surface, admin may
override `effective_from` for the entire batch or per individual amendment.
Use cases:
- Workspace was late in applying the tariff (retroactive application requires
  justification stored in `amendment.admin_note`).
- Individual employee has a special agreement clause that defers the change.

**Audit trail:** both the original `official_effective_date` and any admin-supplied
override date are stored on the `contract_amendment` row (see §G for new column
proposal). This ensures Bokføringsloven §13 audit trails can trace exactly when
a rate change was applied and whether it deviated from the Riksavtalen date.

**Retroactive application (effective_from < today):**

Retroactive application triggers a recalculation evaluation: the shift-engine
must identify all shifts for the employee between `effective_from` and today and
flag them for recalculation (not automatic — requires admin confirmation per
ADR-0251 §"Recalculation semantics", line 346). This evaluation is produced as a
secondary output of the amendment application: a list of "shifts calculated under
old rate that may need recalculation" is presented to admin.

---

### D. Indekstillegg vs full revision

Two tariff-revision kinds have different operator burden profiles:

| Kind | `tariff_revision_kind` | Typical scope | Default authority |
|---|---|---|---|
| Annual index adjustment | `indekstillegg` | Rate table values only (numeric %). Same categories, same rules | `autonomous` (engine_authority_config) |
| Main revision | `full_revision` | Rate tables + potentially new categories, new rules, new evaluation_config | `manual_with_confirmation` |

**Authority semantics (per ADR-0099 / ADR-0204):**

- `indekstillegg` → engine may auto-apply amendments without admin confirmation
  if `engine_authority_config` for capability `tariff_amendment_apply` has
  `authority_level = 'autonomous'`. The amendment rows are still generated for
  audit, but they transition to `accepted` automatically. Employee notification
  still fires.
- `full_revision` → always `manual_with_confirmation`. Admin must review and
  confirm each amendment batch before apply. This is load-bearing: a full
  revision may introduce new rule categories (`evaluation_config` changes per
  ADR-0090) that require admin judgment about which workspace contracts are
  affected and how.

**The `tariff_revision_kind` column:**

A new column `tariff_revision_kind` of type
`'indekstillegg' | 'full_revision'` (new enum `tariff_revision_kind`) is
required on `regulatory_framework` (or its version anchor). This column does not
exist in the current schema (not in `database.types.ts`). Its migration is
deferred to the migration sortie (see §G).

**Default:** `full_revision` (fail-safe; requires admin confirm). Platform
operators must explicitly mark a revision as `indekstillegg` to allow autonomous
auto-apply.

---

### E. shift_pay_calculation interaction

**Explicit invariant (binding on all implementations):**

> `shift_pay_calculation_event.rate_value_applied` is the accounting truth for
> shifts already calculated. Bulk-amendment does NOT recalculate historical pay.
> New `contract_pay_rule` rows apply to shifts with
> `shift_period_end_date >= effective_from` only.

This mirrors ADR-0251 §"Recalculation semantics" (lines 346–378) which states:
"When `contract_pay_rule` changes for a future period (employee raise, renegotiation,
tariff version bump), shifts already calculated MUST NOT be automatically
recalculated."

**Practical boundary:**

The shift-engine evaluation pipeline (ARCHITECTURE §5.7, lines 465–476;
file: `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`)
filters `contract_pay_rule` rows by
`effective_from <= shift_date AND (effective_until IS NULL OR effective_until > shift_date)`.
The `effective_until` SET on the old row at bulk-amendment application time
creates a hard boundary: shifts before the boundary use the old rule row; shifts
after use the new row. This boundary is exact and requires no additional runtime
logic.

**Recalculation eligibility list:**

When admin applies a bulk-amendment with `effective_from < today` (retroactive),
the amendment handler generates a separate `recalculation_candidate` report:
all `shift_pay_calculation_event` rows for affected contracts where
`shift_period_end_date BETWEEN effective_from AND today`. This report is
informational — admin decides whether to initiate recalculation per ADR-0251's
explicit recalculation flow. No automatic recalculation is triggered.

---

### F. Constructive dismissal risk

Per ADR-0244 §"Lovsen Amendments 2026-04-29" (file:
`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`,
line 101–116), tariff revisions that result in a **salary reduction** are
constructive dismissal events under Aml. §15-7 (endringsoppsigelse).

**When `is_constructive_dismissal_risk = true` is set by the amendment handler:**

The bulk-amendment generation step runs `amendment-handler.classify_change` for
each affected `contract_pay_rule` row. The existing `is_constructive_dismissal_risk`
logic (ADR-0244 line 111) fires when `monthly_salary` or effective hourly rate
decreases by ≥20%. For tariff-version bumps this is expected only in edge cases
(category reclassification downward, or a correction of an overpaid rate).

**Handling flow for flagged amendments:**

1. The generated `contract_amendment` row has `is_constructive_dismissal_risk = true`.
2. The amendment is quarantined in the bulk-confirm UI: it does not appear in the
   "Confirm all" group; admin must open it individually.
3. UI surfaces the Lovsen warning (ADR-0244 line 112–116): "Denne endringen kan
   utgjøre endringsoppsigelse iht. Aml. §15-7. Saklig grunn-vurdering kreves."
4. Admin must check `acknowledged_constructive_dismissal_risk` before the amendment
   can be applied.
5. The Lovsen review trigger fires: `legal.constructive_dismissal_review_required`
   engine_event (see §H telemetry). This event can trigger an engine_process that
   assigns a review task or sends an alert to the workspace legal contact.

**Confidence note:** endringsoppsigelse er skjønnsbasert (ADR-0244 line 116).
The ≥20% threshold is a heuristic, not a statutory bright-line. Arbeidsrettsadvokat
review is required before go-live if any workspace's Riksavtalen revision is
expected to produce downward rate corrections. Smartout platform ops must flag
such revisions before activating the `framework.tariff_version_changed` event.

---

### G. Migration shape (deferred)

This ADR is decision-only. No SQL is written here. The migration sortie
(separate feature branch) must author the following schema changes:

**New columns required:**

1. `regulatory_framework.tariff_revision_kind` — enum `tariff_revision_kind`
   (`indekstillegg | full_revision`), NOT NULL DEFAULT `full_revision`. Allows
   engine_authority_config to differentiate autonomous vs confirmed apply.

2. `contract_amendment.tariff_version_from` — `text NULLABLE`. Stores the
   `regulatory_framework` version identifier (or `tariff_rate_table.effective_from`
   date string) that was active before this amendment.

3. `contract_amendment.tariff_version_to` — `text NULLABLE`. The version activated
   by this amendment. Together with `tariff_version_from`, this pair creates a
   complete version-transition audit trail per amendment row.

4. `contract_amendment.official_effective_date` — `date NULLABLE`. The Riksavtalen
   official date for this revision, distinct from `proposed_effective_from` which
   may be admin-overridden.

5. `contract_amendment.admin_effective_override` — `boolean NOT NULL DEFAULT false`.
   True if admin supplied an `effective_from` other than `official_effective_date`.

**No SQL in this ADR.** Timestamp conventions and FK constraints follow
ADR-0241 §"Required migration changes" items 1–3 (file:
`docs/decisions/0241-contract-schema-migration-foundation.md`, lines 37–57).
After migration: regenerate `database.types.ts` per CLAUDE.md "Never edit
database.types.ts manually."

---

### H. Telemetry

Four new events must be registered in `packages/telemetry/src/registry.ts`.
All four follow the four-destination contract per CLAUDE.md §"Telemetry":
PostHog (analytics), Logger (stdout), activity_trail (audit), engine_event
(workflow automation).

Naming follows the dot-convention established by ADR-0164.

**`framework.tariff_version_changed`**
Emitted when platform operator activates a new `regulatory_framework` version.
Payload: `{ framework_id, version_from, version_to, tariff_revision_kind,
official_effective_date, activated_by_user_id }`.
Consumers: stage-engine (generates bulk amendments), PostHog (platform analytics).

**`contract.bulk_amendment_initiated`**
Emitted by stage-engine consumer after batch generation completes.
Payload: `{ framework_id, workspace_id, affected_contract_count,
amendment_count, tariff_revision_kind, official_effective_date }`.
Consumers: all four destinations. Drives admin inbox badge count.

**`contract.bulk_amendment_applied`**
Emitted once per individual `contract_amendment` application (not once per batch).
Payload: `{ amendment_id, contract_id, workspace_id, profile_id,
tariff_version_from, tariff_version_to, effective_from,
admin_effective_override, rule_count_updated }`.
Consumers: all four destinations. The `activity_trail` entry is the Bokføringsloven
audit evidence that rate was updated at a specific timestamp.

**`contract.bulk_amendment_constructive_dismissal_flagged`**
Emitted when amendment handler sets `is_constructive_dismissal_risk = true`
during bulk generation.
Payload: `{ amendment_id, contract_id, workspace_id, profile_id,
rate_change_pct, old_rate, new_rate, framework_rule_id }`.
Consumers: all four destinations. Triggers Lovsen review path in stage-engine.
Also emits `legal.constructive_dismissal_review_required` downstream.

**Registration note:** these four events have naming overlap with existing
`contract.*` events registered at `packages/telemetry/src/registry.ts` lines
2121–2394 (per ADR-0251 §"Telemetry registration", line 565). The migration
sortie must verify no name collision before INSERT into registry.

---

## Rules & Consequences

- **Good, because** Phase 6 bulk-flow (PLAN line 151) gets a complete, specified
  source: `framework.tariff_version_changed` → stage-engine consumer → amendment
  inbox. No underdefined behavior at implementation time.
- **Good, because** ADR-0251 audit-trail invariant is preserved unconditionally.
  `shift_pay_calculation_event` rows remain immutable accounting records; the
  new `contract_pay_rule` rows with `effective_from = riksavtalen_official_date`
  form a clean forward-only boundary.
- **Good, because** ADR-0244 amendment infrastructure is reused without modification:
  `ContractAmendmentDiff`, `is_constructive_dismissal_risk`, `requires_employee_signature`,
  and the notification path all work unchanged for bulk tariff amendments.
- **Good, because** `indekstillegg` revisions can be autonomous (zero admin
  burden for the common case) while `full_revision` stays manual by default.
  The authority gate is configurable per workspace per ADR-0099 / ADR-0204.
- **Good, because** Riksavtalen's official date is preserved on each amendment
  row independently of admin override, satisfying the audit requirement that
  both the contractual effective date and the actual applied date are on record.
- **Bad, because** new columns are required on `regulatory_framework` and
  `contract_amendment` (§G). Until the migration sortie ships, the bulk-amendment
  flow cannot be implemented. This is a sequencing constraint for Phase 6.
- **Bad, because** the stage-engine consumer for `framework.tariff_version_changed`
  is a new consumer that does not yet exist. It must be authored alongside the
  migration sortie.
- **Bad, because** `tariff_revision_kind` default `full_revision` means
  indekstillegg benefits (autonomous apply) are opt-in by platform operators.
  If operators forget to mark the kind correctly, the admin experiences unnecessary
  manual work. Mitigation: platform admin UI should pre-populate `kind` from
  the official tariff calendar (NHO Reiseliv publishes renegotiation schedule
  annually).
- **Agent Impact:**
  - Stage-engine agents implementing the `framework.tariff_version_changed` consumer
    MUST use `amendment-handler.classify_change` for each `contract_pay_rule` row
    and MUST set `requires_employee_signature = false` (ADMIN-class) per ADR-0244.
  - Agents implementing the bulk-apply path MUST set `effective_until` on the OLD
    `contract_pay_rule` row and INSERT a new row; they MUST NOT UPDATE `rate_value`
    in place on the existing row.
  - Agents writing the migration MUST add `tariff_revision_kind` to
    `regulatory_framework` with DEFAULT `full_revision` before any consumer
    reads it; absent the default, existing framework rows would fail NOT NULL.
  - The `shift_pay_calculation_event` append-only invariant (ADR-0251) must be
    included in the build-agent dispatch spec as an explicit constraint; agents
    must verify they emit `shift_pay.calculated` only for new INSERTs, never
    retroactively.

---

## Open Questions

1. **Riksavtalen-MCP integration (separate ADR).**
   Pulling official rates, effective dates, and category tables from an
   authoritative Riksavtalen source (NHO Reiseliv) rather than relying on manual
   platform operator entry would reduce error risk significantly. This parallels
   the Skatteetaten integration pattern in ADR-0250 (cert-authenticated API,
   `op://`-stored credentials). A separate ADR is needed before any automation of
   rate ingestion. Flagged as post-Phase 6 work.

2. **Multi-tariff workspaces.**
   Some workspaces have employees on Riksavtalen (hospitality) and others on
   Industrioverenskomsten (back-of-house maintenance staff). ARCHITECTURE §12
   (line 612) explicitly defers this. The bulk-amendment flow defined here
   operates per `workspace_framework_binding`: if a workspace has two bindings
   (two frameworks), two separate `framework.tariff_version_changed` events would
   fire, generating two separate amendment batches. This is probably correct but
   has not been fully modelled. Orchestrator should flag for review before
   Phase 6 ships.

3. **Lærling tariff-tabellen.**
   Apprentice (`employment_form = 'apprentice'`) rates are governed by
   Opplæringsloven kap. 4 and are typically derived from the relevant Riksavtalen
   at a fixed percentage of journeyman rate. ADR-0241 §"Lovsen Amendments" item 5
   (file: `docs/decisions/0241-contract-schema-migration-foundation.md`, line 79)
   blocks `apprentice` employment form until Opplæringsloven kap. 4 fields are
   modelled. If and when that ADR ships (ADR-0253 or later), the bulk-amendment
   flow must handle lærling rates. Flagged as interaction point.

4. **Autonomous apply and Aml. §14-6 obligation.**
   Aml. §14-6 requires that changes to written contract terms are documented in
   writing. For `indekstillegg` with `authority_level = 'autonomous'`, the
   amendment rows are auto-accepted. The question is whether auto-accepted
   `contract_amendment` rows with employee notification constitute sufficient
   §14-6 written documentation, or whether a PDF amendment attachment is required.
   **Confidence: MEDIUM.** Arbeidsrettsadvokat review recommended before enabling
   autonomous apply for `indekstillegg`.

5. **Retroactive effective_from and tax implications.**
   Retroactive pay adjustments (when `effective_from < today`) may have
   A-melding correction implications (Skatteetaten). The recalculation-candidate
   list (§E) does not resolve this — it only flags potentially affected shifts.
   The A-melding correction module is out of scope per ARCHITECTURE §1 (line 39)
   but the data produced by this flow (retroactive `shift_pay_calculation_event`
   supersession) will be consumed by that module. Orchestrator to confirm
   interface contract before A-melding module begins.

---

## References

- `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`
  line 195 (`rate_value` tariff-linked = ADMIN classification),
  line 234 (original deferral of tariff versioning)
- `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`
  §5.3 (line 406) — amendment flow
  §5.7 (lines 465–476) — shift pay evaluation and `contract_pay_rule` filter
  §12 (line 612) — open question: Riksavtalen-versjonering
- `docs/plans/PLAN-contract-employee.md`
  line 151 — Phase 6 step 5: bulk-flow ved tariff-version_changed
  line 182 — Riksavtalen-versjonering open question
- ADR-0076 (`docs/decisions/0076-contract-composition-as-cascade-derivation.md`)
  lines 64–86 — snapshot-and-forward principle, cascade invariant #8 (provenance)
- ADR-0090 (`docs/decisions/0090-framework-rule-evaluation-config-schema.md`)
  lines 37–63 — framework_rule evaluation_config typed condition tree
- ADR-0241 (`docs/decisions/0241-contract-schema-migration-foundation.md`)
  lines 37–57 — migration change requirements
  line 50 — framework_snapshot JSONB precedent on employment_contract
  line 79 — apprentice employment form blocked (Opplæringsloven kap. 4)
  line 83 — Bokføringsloven §13 retention anchor = regnskapsår-slutt, not terminated_at
- ADR-0244 (`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`)
  lines 41–62 — amendment changes, requires_employee_signature
  line 57 — ADMIN amendments: employee gets notification, no consent gate
  lines 101–116 — endringsoppsigelse flag, §15-7 handling
  line 111 — is_constructive_dismissal_risk trigger conditions
- ADR-0251 (`docs/decisions/0251-shift-pay-calculation-audit-module.md`)
  lines 289–334 — append-only invariant, supersession path
  lines 346–378 — recalculation semantics, tariff-version-bump invariant
  lines 478–498 — Bokføringsloven §13 retention enforcement, shift_period_end_date anchor
  line 565 — telemetry registry reference for existing contract.* events
- `packages/supabase/src/database.types.ts`
  line 5375 — `contract_pay_rule` table Row type
  line 5381 — `contract_pay_rule.framework_rule_id` NULLABLE
  line 5387 — `contract_pay_rule.source_text` (Riksavtalen §X.Y citation)
  line 8925 — `framework_rule` table Row type
  line 8939 — `framework_rule.rule_id` PK
  line 17568 — `tariff_rate_table` table Row type
  lines 17572–17573 — `tariff_rate_table.effective_from` / `effective_until`
- Riksavtalen (NHO Reiseliv / Fellesforbundet) — hospitality collective agreement
  2024–2026 and successor agreements
- Aml. §10-6 — overtid-tak (overtime caps)
- Aml. §14-6 — skriftlig arbeidsavtale (written contract obligation)
- Aml. §15-7 — saklig grunn for endringsoppsigelse (constructive dismissal,
  requirement for legitimate reason)
- Bokføringsloven §13 — 5-year retention for regnskapsmateriale, anchored at
  regnskapsårets slutt (Lov om bokføring av 19. november 2004 nr. 73)
- Ferieloven §10 nr. 3 — feriepengegrunnlag

---

> Do NOT update `docs/decisions/0000-decision-log.md` — orchestrator centralizes log updates.
