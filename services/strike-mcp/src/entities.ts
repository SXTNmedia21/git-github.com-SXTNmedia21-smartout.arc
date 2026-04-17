/**
 * The list of Bubble entity types strike-mcp knows how to work with.
 *
 * - `name` is strike-mcp's internal name (used in tool arguments and file paths).
 * - `bubbleType` is the Bubble Data API type name (used as the URL segment).
 * - `workspaceFieldKey` is the display-name of the workspace-link field on
 *   that type's records. Used as the constraint key when filtering records
 *   to a single workspace. null for the workspace type itself.
 * - `description` is a short human explanation of the type.
 *
 * REWRITTEN 2026-04-15 for Tier 1 Wrightegaarden migration.
 *
 * Ground truth: live Bubble meta at https://smartout.io/version-test/api/1.1/meta.
 * Workspace-field keys were resolved by filtering fields with `type === "custom.workspace"`
 * and reading the `display` property. Bubble constraints use display names, not IDs.
 *
 * Scope: Tier 1 = identity + structure + active operational data (shifts, time
 * records, pending swaps). Tier 2 (handbook, training, controllist, task) and
 * Tier 3 (salary/time rules — rebuild from K1a) are out of scope here.
 *
 * See docs/superpowers/plans/2026-04-15-wrightegaarden-tier1-migration.md.
 */
export interface EntityEntry {
  name: string;
  bubbleType: string;
  workspaceFieldKey: string | null;
  description: string;
}

export const ENTITY_REGISTRY: readonly EntityEntry[] = [
  // ─── Tenant root ──────────────────────────────────────────────────
  {
    name: "workspace",
    bubbleType: "workspace",
    workspaceFieldKey: null,
    description: "The workspace (tenant) record itself.",
  },
  {
    name: "company",
    bubbleType: "🏰company",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Legal/corporate entity backing a workspace. Maps to v3 public.company in the identity layer.",
  },

  // ─── Physical structure (D1 Envelope) ─────────────────────────────
  {
    name: "locations",
    bubbleType: "location",
    workspaceFieldKey: "🏰 Workspace",
    description: "Physical sites / venues belonging to a workspace.",
  },
  {
    name: "departments",
    bubbleType: "🏠department",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Organizational departments inside a workspace. Permanent (D1 Envelope in v3).",
  },

  // ─── People (identity + D2 Resource) ──────────────────────────────
  {
    name: "teams",
    bubbleType: "🎎team",
    workspaceFieldKey: "🏰 Workspace",
    description: "Team groupings within a workspace (D2 Resource).",
  },
  {
    name: "users",
    bubbleType: "user",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Bubble user records. Maps to v3 public.user_identity (auth backbone). " +
      "REQUIRES MANUAL ORCHESTRATION: user_identity.user_id is a hard FK to " +
      "auth.users(id). Strike-mcp can emit user_identity INSERTs using " +
      "deterministic uuidv5 IDs, but a separate Supabase Admin step must " +
      "pre-create auth.users entries with the same UUIDs first. Out of strike-mcp " +
      "scope; future ADR-0005 will document the auth-bridge pattern. See " +
      "docs/superpowers/plans/2026-04-16-tier1-finish-plan.md §4.",
  },
  {
    name: "profiles",
    bubbleType: "profile",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "HR profile per workspace — the operational employee record. Maps to v3 public.profile.",
  },
  {
    name: "employment_profiles",
    bubbleType: "⏱️employment_profile",
    workspaceFieldKey: "🏰 workspace",
    description:
      "Employment data (role, rate, schedule) linked to a profile. Merged with employment_contract during transform to produce v3 employment_contract rows.",
  },
  {
    name: "employment_contracts",
    bubbleType: "⏱️employment_contract",
    workspaceFieldKey: "workspace",
    description:
      "Signed employment contracts. Maps to v3 employment_contract (D2) combined with employment_profile data.",
  },
  {
    name: "employee_types",
    bubbleType: "⏱️employee_type",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Employee type definitions (e.g. full-time, part-time, temp). Needed as reference data for employment_contract.",
  },
  {
    name: "invitations",
    bubbleType: "🎎invitation",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Workspace invitations. Only pending/active invitations are migrated; accepted/expired are dropped during review.",
  },

  // ─── Operational — shifts + time (D6 Production) ──────────────────
  {
    name: "shifts",
    bubbleType: "shift",
    workspaceFieldKey: "workspace",
    description:
      "Scheduled shifts. Maps to v3 schedule_shift (D6 Production). Merged with shift_satellite sidecar during transform.",
  },
  {
    name: "shift_satellites",
    bubbleType: "shift_satellite",
    workspaceFieldKey: "workspace",
    description:
      "Sidecar rich-data rows for shifts. Folded into schedule_shift during transform — not migrated as a standalone v3 table.",
  },
  {
    name: "records",
    bubbleType: "🗓️record",
    workspaceFieldKey: "🏰 lookup",
    description:
      "Polymorphic time record. _recordType ∈ {workTime, break, meal}. 5434 rows in Wrightegaarden. MANUAL_ONLY per ADR-0003 — Bubble row-per-entry model does not map 1:1 to v3 timesheet.time_entry (one row per shift with nested breaks JSONB). Custom transform required: workTime → timesheet.time_entry; break/meal → deferred to Tripletex-driven supplement logic. See 2026-04-15 council verdict.",
  },
  {
    name: "salary_transactions",
    bubbleType: "⏱️salary_transaction(salary_detail)",
    workspaceFieldKey: "🏰 workspace",
    description:
      "Payroll ledger rows. 17 607 rows in Wrightegaarden. ~50/50 split between base-workTime and supplement rows. Target: public.payroll_ledger_archive (new table pending wt-3 M5). Carries a_melding_code + Accounting_Account_Code — directly Tripletex-sync-able at archive time. Source of truth for historical payroll, not 🗓️record.",
  },
  {
    name: "swaprecords",
    bubbleType: "⏱️swaprecord",
    workspaceFieldKey: "🏰 Workspace",
    description:
      "Shift swap records. 18 rows in Wrightegaarden (14 pending, 2 approved, 1 started). DROP ALL at migration per 2026-04-15 council: v3 models swaps as engine_process instances, not table rows. Cutover notice required: 'Re-initiate pending swaps in v3 after migration.'",
  },

  // ─── Tier 2 governance content layer (added 2026-04-17, verified via live meta) ─
  // See docs/source/DISCOVERED-bubble-content-model.md for the 8-entity content stack
  // and Tier 1 + Tier 2 distinction. bubbleType + workspaceFieldKey verified against
  // https://smartout.io/version-test/api/1.1/meta (scripts/check_tier2_meta.ts).
  {
    name: "activities",
    bubbleType: "activity",
    workspaceFieldKey: "workspace",
    description:
      "Tier 2: Content unit inside a handbook. `_quizType` enum discriminates manual (text/procedure) vs quiz (interactive assessment). 55 fields. Target v3: procedure/runbook (manual) or knowledge_test (quiz) — council decision pending.",
  },
  {
    name: "handbook_challenges",
    bubbleType: "handbook.challenge",
    workspaceFieldKey: null,
    description:
      "Tier 2: Challenges nested inside a handbook (sub-record). No workspace link — inherits tenancy via parent handbook FK. 21 fields. Target v3: confirmation or control_list — council decision pending.",
  },
  {
    name: "handbook_stages",
    bubbleType: "handbook.stage",
    workspaceFieldKey: null,
    description:
      "Tier 2: Stages/sections of a handbook (sub-record). No workspace link — inherits tenancy via parent handbook FK. 12 fields. Discovered via live meta 2026-04-17 (missed in Genesis scan). Target v3: TBD — may merge into protocol.sections.",
  },
  {
    name: "questions",
    bubbleType: "question",
    workspaceFieldKey: "workspace",
    description:
      "Tier 2: Quiz question definition. `_questionType` enum. 30 fields. Target v3: knowledge_test_question.",
  },
  {
    name: "question_options",
    bubbleType: "question.option",
    workspaceFieldKey: null,
    description:
      "Tier 2: Answer option for a question (sub-record). No workspace link — inherits via parent question FK. 21 fields. Discovered via live meta 2026-04-17 (missed in Genesis scan). Target v3: knowledge_test_question.options JSONB array.",
  },
  {
    name: "handbook_logs",
    bubbleType: "🎖️handbook.log",
    workspaceFieldKey: "🏰 workspace",
    description:
      "Tier 2: Per-employee handbook completion log (badges earned, quiz results). `_resultStatus` enum. 39 fields. Target v3: profile_competence_completion (audit log) — council decision pending.",
  },
];

export function getEntityByName(name: string): EntityEntry | undefined {
  return ENTITY_REGISTRY.find((e) => e.name === name);
}

export function allEntityNames(): string[] {
  return ENTITY_REGISTRY.map((e) => e.name);
}
