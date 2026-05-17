---
title: "Journey — payroll-lovsen-phase-7d-adr-amendments"
status: verified
verified_at: 2026-05-17
feature: lovsen-phase-7d-adr-amendments
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [journey, lovsen, payroll, phase-7d, adr-amendments]
---

# Journey — payroll-lovsen-phase-7d-adr-amendments

> Sortie 1 of 3 in Phase 7d-followup execution. Pure documentation sortie.
> Three journeys cover: (1) reading amended ADRs, (2) loading the ADR-0355 contract as
> a migration agent, (3) council orchestrator using the promoted SKILL.md L-0147 rule.

---

## Journey 1: Admin Reads Amended ADR After Sortie 1 Closure

**Precondition:** A build agent or developer opens the amended ADR-0353 or ADR-0351 to
understand the current authoritative schema contract before authoring Sortie 2 migration
work. The agent may have a cached or stale understanding of the original ADR content.

1. User opens `docs/decisions/0353-workspace-framework-binding-bootstrap.md` →
   system renders the file with the 2026-05-17 Amendment block at the TOP of §A →
   user reads "2026-05-17 Amendment — L-0147 Self-Reversal" block FIRST, before
   reaching the original §A prose.
2. Amendment block states: "Original §A table name (`workspace_framework_binding`) is
   REVERSED. See ADR-0355 for the new contract. Original content is RETAINED below as
   historical record but is NO LONGER LOAD-BEARING." →
   user understands §A original content is not the current contract.
3. User navigates to `docs/decisions/0355-workspace-union-binding-lifecycle-and-cache-trigger.md` →
   reads new `public.workspace_union_binding` table spec, FK corrected to
   `workspace(workspace_id)`, APPEND-ONLY semantics, cache trigger shape on
   `payroll.workspace_settings` maintaining `is_tariff_bound` + `active_union_id`.
4. User returns to ADR-0353 §D amendment block →
   reads: "`shift_pay_calculation_event.tariff_binding_id` column does not exist in current
   schema; Sortie 2 migration must add it per ADR-0355 contract" →
   user confirms Sortie 2 scope includes this column addition.
5. User holds correct mental model of current schema state vs ADR proposal →
   proceeds to open Sortie 2 plan file.

**Postcondition:** User holds correct mental model of current schema state. Amendment
block prevents the L-0176 anti-pattern (ADR prose drifting from code) by making the
reversal visible at the TOP of the affected section before original content.

**Error paths:**

- User skips amendment block and reads original §A prose directly → operates on stale
  schema contract → ships wrong table name `workspace_framework_binding` (conflicts with
  cascade's existing table). Mitigation: amendment block placed BEFORE original content
  with ALL CAPS warning "Original content is RETAINED below as historical record but is
  NO LONGER LOAD-BEARING."
- User reads ADR-0355 but not the §D amendment → misses `tariff_binding_id` gap →
  Sortie 2 migration omits the column. Mitigation: ADR-0355 cross-references ADR-0353 §D
  and lists `tariff_binding_id` FK as a Sortie 2 migration deliverable.

---

## Journey 2: Sortie 2 Migration Agent Loads ADR-0355 Contract

**Precondition:** Sortie 2 (`feat/payroll-phase-7d-followup-migration`) has opened.
A migration-author agent is dispatched to write the migration SQL per ADR-0355 contract.

1. Agent reads `docs/plans/PLAN-payroll-phase-7d-followup-migration.md` (Sortie 2's plan) →
   plan lists ADR-0355 + ADR-0356 + ADR-0353 amendment + ADR-0351 amendment as
   source-of-truth for migration scope.
2. Agent reads all 4 referenced docs →
   ADR-0355 specifies new `public.workspace_union_binding` table shape:
   columns `id`, `workspace_id` (FK → `workspace(workspace_id)`), `union_id`, `version`,
   `amendment_classifier`, `effective_from`, `effective_to`, `created_at`; APPEND-ONLY
   semantics (no UPDATE/DELETE, only INSERT + `effective_to` stamp on old row at switch).
3. Agent reads ADR-0355 cache trigger spec →
   trigger on `public.workspace_union_binding` INSERT fires SECURITY DEFINER
   per L-0172 locked search_path pattern; updates `payroll.workspace_settings`
   `is_tariff_bound` + `active_union_id` denormalized cache fields.
4. Agent authors migration SQL following ADR-0355 spec exactly →
   migration timestamp ≥ `20260618000000` (per PLAN requirement) →
   DDL includes `CREATE TABLE public.workspace_union_binding`, RLS policies
   (JWT + API key per ADR-0153), `CREATE OR REPLACE FUNCTION` for cache trigger,
   `CREATE TRIGGER` binding the function.
5. Agent verifies pre-migration audit DO-block per L-0172 pattern →
   confirms trigger fires correctly in local Supabase test →
   agent commits migration with self-test output.

**Postcondition:** Sortie 2 migration shipped per ADR-0355 contract. Schema reality
matches ADR spec. Cache trigger verified deterministic on INSERT.

**Error paths:**

- Agent skips ADR-0355 and works from ADR-0353 §A original content → ships conflicting
  table name `workspace_framework_binding` → collides with cascade's existing table →
  Sortie 2 council REJECTS. Mitigation: ADR-0353 §A amendment block explicitly redirects
  to ADR-0355 as the new contract.
- Agent authors trigger without SECURITY DEFINER → cross-schema write from `public` trigger
  into `payroll.workspace_settings` fails with permission error on Supabase Cloud.
  Mitigation: ADR-0355 mandates SECURITY DEFINER + locked search_path; L-0172 is cited
  as authority.
- Agent uses timestamp < current HEAD max migration → migration sequence violation →
  `pnpm supabase db lint` fails. Mitigation: PLAN-payroll-phase-7d-followup-migration.md
  specifies minimum timestamp.

---

## Journey 3: Council Orchestrator Reads Promoted SKILL.md L-0147 Rule

**Precondition:** A new council session is convened (e.g., Sortie 2 council reviewing the
migration scope). The orchestrator loads the `run-council` skill before dispatching agents.

1. Orchestrator loads `~/.claude/skills/run-council/SKILL.md` via `Skill` tool →
   skill loads successfully.
2. Orchestrator reads Phase 5 §1.5 →
   finds PROMOTED hard rule block (no longer advisory text) titled "Chair Self-Reversal
   Protocol — ENFORCED HARD RULE (promoted 2026-05-17 per L-0294, 9+ precedents)".
3. Orchestrator reads the 9-entry precedent table →
   understands the pattern: "chair operates on incomplete scope; reviewer code-trace
   expands scope; chair must reverse, not rationalize."
4. Orchestrator reads the canonical format requirement:
   ```
   Phase 3 claim X was [TRUE/FALSE].
   Falsifying evidence: <file:line citation>.
   Classification: REVERSED.
   ```
5. During Phase 5 synthesis, chair (system-steward) encounters 2+ reviewer code-trace
   evidence falsifying a Phase 3 claim →
   orchestrator's Phase 5 synthesis prompt includes explicit instruction to apply the
   canonical format →
   chair produces: "Phase 3 claim [X] was FALSE. Falsifying evidence: [file:line].
   Classification: REVERSED." →
   council session records the explicit reversal →
   future re-reading of the council log has unambiguous evidence of where the original
   claim was wrong and why.

**Postcondition:** Council Phase 5 protocol enforced by SKILL.md structure, not only by
orchestrator memory. Reversal is named explicitly, not rationalized as REFINED.

**Error paths:**

- Orchestrator using a cached pre-promotion version of the SKILL.md (e.g., from a session
  where the skill was loaded before 2026-05-17 promotion) → Phase 5 §1.5 appears as
  advisory text with 3 precedents → chair may rationalize reversal as REFINED without
  explicit REVERSED classification. Mitigation: SKILL.md change is structural; orchestrators
  reloading the skill after 2026-05-17 get the promoted version. Cached sessions are a
  session-boundary concern — always reload skills at session start.
- Chair encounters only 1 reviewer with code-trace evidence (not 2+) → L-0147 threshold
  not met → REFINED classification is acceptable. Mitigation: threshold is explicit in the
  hard rule block ("2+ reviewers with code-trace evidence").
- Phase 9 session scoring skips "Promoted to SKILL.md" section → council_meta.md section
  omits the 2026-05-17 promotion entry → future audits undercount the promotion history.
  Mitigation: SKILL.md Phase 9 Step 4 instructs "Promoted to SKILL.md" section update as
  mandatory; L-0294 references the `council_meta.md` schema section.
