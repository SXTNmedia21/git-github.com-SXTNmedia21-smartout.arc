---
title: "Bootstrap Domain — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, gaps, debt, overlap, deviations]
---

# Bootstrap — Gaps and Debt

---

## §Built (verified)

What exists today, verified against code:

| Item | Location | Evidence |
|------|----------|----------|
| SQL template seed layer (10-step + Mattilsynet + alcohol-labor) | `supabase/templates/restaurant/` | `_apply.sql` + 12 SQL files, 296 INSERTs verified |
| Bootstrap-cascade Edge Function (11-step, idempotent, resumable) | `supabase/functions/bootstrap-cascade/index.ts` | 969 lines, steps at lines 343–888 |
| `workspace_bootstrap_run` audit table | `supabase/migrations/20260422400000_cascade_b_schema.sql:82` | Schema + RLS verified |
| Industry config loader (L4) | `packages/ai/src/industry/` | `index.ts` + `loader.ts` + `hospitality.ts` + `default.ts` + `department-classifier.ts` |
| Voice onboarding mission | `packages/ai/src/missions/registry.ts:14` | `onboarding-interview` mission, 30-min cap, 11 tools |
| `finalize-workspace` EF calls bootstrap-cascade | `supabase/functions/finalize-workspace/index.ts:79` | URL construction confirmed |
| Admin setup wizard (9 steps, 9 adapters) | `apps/web/src/app/dashboard/setup/` | `wizard-definition.ts` + `_adapters/` dir verified |
| `workspace.onboarding_completed` flag | `supabase/migrations/20260308100000_add_onboarding_completed.sql:7` | Confirmed |
| `workspace.setup_guide_completed` flag | `supabase/migrations/20260327120000_add_setup_guide_completed.sql:5` | Confirmed |
| `get_workspace_readiness` RPC (employee-readiness) | `supabase/migrations/20260322193130_add_workspace_readiness_rpc.sql:4` | Returns profile_id + total + completed — training domain, NOT seed gate |
| `engine_authority_config` seeding at Step 10 | `supabase/functions/bootstrap-cascade/index.ts:775` | ADR-0192 compliant |
| `profession_seed` Step 11 | `supabase/functions/bootstrap-cascade/index.ts:836` | ADR-0387a, hospitality only |

---

## §Gaps (not built)

What is designed but does not yet exist in code:

| Gap | What is missing | Roadmap phase | Evidence of absence |
|-----|-----------------|---------------|---------------------|
| **G1: workspace_readiness table** | No seed-completeness gate table. `workspace_bootstrap_run` is technical audit, not business gate checklist. | Phase 1 | `grep -rn "workspace_readiness" supabase/migrations/` → zero migration hits (only the training RPC and telemetry reference the word) |
| **G2: bootstrap-coordinator** | No orchestrator code in `packages/ai/src/` that reads readiness and selects today's gate. | Phase 2 | `grep -rn "bootstrap_coordinator\|bootstrapCoordinator\|bootstrap-coordinator" packages/` → zero code hits |
| **G3: session-start hook** | Botsson does not read gate state on session start. No hook in stage-engine or harness. | Phase 3 | `grep -rn "bootstrap.*session\|readiness.*hook" packages/ai/src/` → zero hits |
| **G4: week-1 progressive UI** | No `/dashboard/bootstrap` or "day N of 7" surface exists. Admin has no visual gate checklist. | Phase 4 | `find apps/web/src/app/dashboard -name "*bootstrap*"` → zero results |
| **G5: bootstrap-pipeline.ts in apps/web** | Spec/plan reference (`2026-03-20-cascade-architecture-foundation.md:2241`) proposed `apps/web/src/lib/cascade/bootstrap-pipeline.ts`. File does not exist. Bootstrap lives in EF not web lib. | Architecture deviation (see §Deviations) | `find apps/web/src/lib/cascade -name "bootstrap*"` → zero results |
| **G6: is_bootstrap_completed column** | SM-3 plan references `is_bootstrap_completed` column. Does not exist on `workspace` table. Closest proxy: `onboarding_completed`. | Planning gap (SM-3-followup) | `grep -rn "is_bootstrap_completed" supabase/migrations/` → zero hits |

---

## §Deviations (spec vs code)

Where code did it differently than a spec/plan said:

| Deviation | Spec claim | Code reality | Impact |
|-----------|-----------|--------------|--------|
| **D1: bootstrap-pipeline.ts in web** | `apps/web/src/lib/cascade/bootstrap-pipeline.ts` proposed in `2026-03-20-cascade-architecture-foundation.md:2241` | Logic lives in `supabase/functions/bootstrap-cascade/index.ts`. Web lib file never created. | Benign — EF is the correct home for service-role seed operations. Spec was a draft plan, not an ADR. Code is the correct architecture. |
| **D2: Setup wizard as primary surface** | Architectural intent: Botsson-driven setup, wizard as fallback | Wizard is the current primary admin surface; Botsson only drives initial onboarding voice session | Accepted debt until Phase 5. Tracked as deviation. Do not close by removing wizard — close by building coordinator first. |
| **D3: SQL templates not called from coordinator** | I1 bootstrap pattern implies SQL templates feed into a coordinator flow | SQL templates are standalone psql-invocable functions, not called by bootstrap-cascade EF or any coordinator. They are dev/seed utilities. | Low impact — templates are for seeding realistic test data, not production workspace bootstrap. Production uses bootstrap-cascade EF. This is a misread of the template purpose, not a real deviation. |

---

## §Overlap Edges

Bootstrap touches many adjacent domains. Each edge is classified: KEEP / CONSOLIDATE / pending.

| Adjacent domain | Surface shared | Classification | Recommendation |
|----------------|----------------|----------------|----------------|
| **agent-harness** | bootstrap-coordinator will live in `packages/ai/src/`, owned by agent-harness build responsibility | **CONSOLIDATE-toward-bootstrap** | Coordinator is agent-harness CODE but bootstrap CONCEPT. agent-harness README should reference this domain as the design authority for coordinator behavior. Do not duplicate coordinator docs in agent-harness. |
| **core-structure** | Workspace creation (`workspace` table insert, `activate-workspace` EF) precedes bootstrap | **KEEP** | core-structure owns workspace creation lifecycle. Bootstrap takes over AFTER workspace is created and `onboarding` begins. Boundary: `onboarding_completed = true` is the handoff point. |
| **onboarding** (pending domain) | `onboarding` capability + employee-onboarding wizard. Both use "onboarding" terminology. | **KEEP** | Bootstrap = workspace setup (employer domain, D1–D6 seeding). Employee onboarding = employee readiness (training/procedure domain). Completely different subjects despite shared vocabulary. When `onboarding` domain is formalized, this boundary must be explicitly documented in both domains. |
| **procedure-engine** | Bootstrap seeds protocols and procedures (governance.sql, mattilsynet.sql). Procedure-engine runs them at steady state. | **KEEP** | Bootstrap writes; procedure-engine reads and runs. Bootstrap is the seed layer; procedure-engine is the runtime. Clear temporal boundary: bootstrap fires once, procedure-engine runs indefinitely. |
| **scheduling** | Bootstrap seeds first season + shift templates (schedule.sql, budget.sql). Scheduling runs from those records. | **KEEP** | Same write-once / run-forever pattern as procedure-engine. Bootstrap = first-season seed. Scheduling = ongoing session management. |
| **payroll** | Bootstrap seeds Riksavtalen binding decision + tariff floor (Steps 4–5, ADR-0353). Payroll uses these at calc-time. | **KEEP** | Bootstrap writes framework_binding + tariff_rate_table; payroll reads them. ADR-0353 governs the binding model. Bootstrap domain documents the seeding; payroll domain documents the calculation. |
| **contracts** | Bootstrap seeds first employment_contract (contracts.sql, employees.sql). Contracts domain owns the model. | **KEEP** | Bootstrap = initial seed. Contracts = lifecycle management (mutations, renewals, DocuSeal). Clear ownership by contract domain post-seed. |
| **hms** (pending domain) | Bootstrap seeds Mattilsynet routines + alcohol-labor routines (mattilsynet.sql, alcohol-labor.sql). HMS will own these at steady state. | **KEEP** | Bootstrap writes the seed; HMS domain runs the compliance cycle. When HMS domain is formalized, reference this domain as the seed origin. |
| **training** | `get_workspace_readiness` RPC is used by training capability for employee protocol completion. NOT bootstrap seed-completeness. | **KEEP** | Shared vocabulary ("readiness") but different concepts. training.get_workspace_readiness = employee protocol stats. bootstrap.workspace_readiness (aspirational) = seed-completeness gates. Never use the training RPC as a proxy for seed-completeness. |
