---
title: "Contract E2E Orchestration — 2026-04-30"
id: ORCH_CONTRACT_E2E_20260430
status: in_progress
layer: orchestration
created: 2026-04-30
updated: 2026-04-30
plan: docs/plans/PLAN-contract-employee.md
---

# Contract E2E Orchestration — 2026-04-30

> **Operator:** Claude Opus (orchestrator)
> **Plan under execution:** `docs/plans/PLAN-contract-employee.md`
> **Skill:** `superpowers:executing-plans` — repetitive loop, kill on red, document each cycle.

## Why two agents

Pontus's directive: spin up two parallel agents, measure them, document good/bad, loop. Phase 1 reconciliation is the unblock-everything gate for E2E (Phase 2-7 cannot land without DB foundation + ADR alignment). Two complementary read-only audits in parallel:

- **Agent A — schema-reconciliation** — DDL files vs live tables. Owns the "can we even run the migration?" question.
- **Agent B — ADR-reconciliation** — ADR-0001 vs accepted ADRs 0024, 0076-0079, 0082, 0093, 0109, 0111, 0182. Owns the "are the rules consistent?" question.

Read-only. No writes. Output = artifacts I score against the rubric below.

## Rubric (0-5 per axis)

| Axis | What I look for | 5 = excellent | 0 = useless |
|------|-----------------|---------------|-------------|
| **Completeness** | Every requested item covered | All schema/ADR items examined, none skipped | Half the items missing |
| **Accuracy** | Every claim has file:line or migration:line citation | 100% citations, all verifiable | Claims without sources, hallucinations |
| **Decision quality** | Clear path forward per item (override/amend/reconcile/migrate) | Each finding ends in a concrete action | "Investigate further" without specifics |
| **Risk identification** | Surfaces gaps + traps (enum drift, RLS holes, FK breakage) | Catches the L-0177 / 0176 / 0178 class | Misses obvious traps |
| **Self-falsifiability** | Output is checkable in <5 min | Reviewer can disprove or confirm any claim quickly | Wall of prose, no anchors |

Total: 25 max. **Pass threshold: ≥18 (≥3.6 avg)**. Below that → re-dispatch with corrected briefing.

## Cycle log

### Cycle 1 — 2026-04-30 (in progress)

**Slice:** Phase 1 reconciliation (schema + ADR), read-only.

**Agents dispatched:**
- Agent A — `system-agent-coordinator` (sonnet) — schema-reconciliation
- Agent B — `system-steward` (opus per CLAUDE.md dispatch table — verify-plan-vs-reality work) — ADR-reconciliation

**Status:** Both agents completed · scored · cycle closed

#### Agent A — schema-reconciliation (system-agent-coordinator/sonnet) — KEY FINDINGS

**HEADLINE:** PLAN-contract-employee.md Phase 1 is **stale and dangerous**. Lines 95-96 instruct copying `docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql` to `supabase/migrations/` — but that DDL has already been **superseded** by `supabase/migrations/20260519100100_contracts_module_foundation.sql` (which has run). Running `0001` now would error on `CREATE TYPE` collisions, FK column-name mismatches (`workspace(id)` vs `workspace(workspace_id)`), and constraint-name collisions, and would re-create `field_classification_metadata` in violation of ADR-0243.

**Verified facts (citations):**

| Claim | Source |
|---|---|
| Migration `20260519100100_contracts_module_foundation.sql:5` explicitly supersedes `0001` (rejected by System Council 2026-04-29 with 9 P0 blockers) | `supabase/migrations/20260519100100_contracts_module_foundation.sql:5` |
| All 9 expected tables exist live (`pension_scheme`, `employment_contract`, `employee_payroll_profile`, `contract_template`, `contract_pay_rule`, `contract_tip_rule`, `contract_obligation`, `contract_amendment`) | `database.types.ts` per-line citations |
| `field_classification_metadata` is **deliberately NOT a table** per ADR-0243 — moves to `packages/contracts/src/field-classification.ts` | `20260519100100:236` |
| All 15 §14-6 fields are present live — PLAN line 95 audit ("7 §14-6-felt manglende") is REFUTED | per-field citations to `database.types.ts:7557-7609` |
| `contract_status` enum live has 13 values, spec has 6 — Postgres forbids removing enum values; spec is unrunnable | `database.types.ts:20038-20051` vs `00-enums-and-lookups.sql:20-27` |
| `position_title` (live) vs `job_title` (spec) — name drift, capability tools sending `job_title` in payloads will silently fail | `database.types.ts:7584` vs `ARCHITECTURE-contracts-module.md:117` |
| `contract_amendment.requires_resigning` is GENERATED ALWAYS AS (`requires_employee_signature`) — readers may get `null` from type inference | `20260519100100:862-863`, `database.types.ts:5076` |

**Top 5 risks (per Agent A):**
1. PLAN line 95-96 will mislead next developer — strike + redirect to verify `20260519100100` applied
2. `contract_status` spec/live divergence cannot be healed via schema — retire schema-spec files
3. `field_classification_metadata` has two conflicting contracts (PLAN line 102 says seed it, ADR-0243 forbids the table)
4. `requires_resigning` GENERATED-column readers need migration to `requires_employee_signature`
5. `position_title`/`job_title` rename — audit all callers in capability tools

#### Agent B — ADR-reconciliation (system-steward/sonnet) — KEY FINDINGS

**HEADLINE:** ADR-0001 itself is **already superseded** (frontmatter line 6: `status: superseded`, lines 12-17 split into ADR-0233/0234/0235/0236) — but successor ADRs **do not exist** on this branch. Search confirmed `docs/decisions/` has files only up to ADR-0189. Per-ADR matrix delivered for all 10 counterparts. No CONFLICT verdicts; mostly EXTEND/INDEPENDENT. Two specific structural traps surfaced.

**Verified facts (citations):**

| Claim | Source |
|---|---|
| ADR-0001 status: superseded, split into 0233-0236 (Council 2026-04-29) | `ADR-0001-kontrakt-og-lonnsprofil-fundament.md:6,12-17` |
| ADR-0233/0234/0235/0236 do NOT exist in `docs/decisions/` | branch search — last ADR is 0189 |
| FK-naming conflict: ADR-0082 mandates `parent_contract_id`; ADR-0001 introduces `superseded_by_contract_id` — opposite directions, both cannot be canonical without explicit resolution | ADR-0082 lines 70-73; ADR-0001 line 216 |
| D2 partial unique index `(profile_id WHERE employment_role='main' AND status='active')` may conflict with existing Bubble-migrated data (rows pre-date `employment_role` column) | ADR-0001:93; ADR-0109 §Clause A:69-81 |
| `overtime_cap_policy_id` FK target table not defined in any accepted ADR — migration would fail FK creation | ADR-0001:123-124,220 |
| `contract_status` enum drift confirms Agent A finding from ADR side: ADR-0079 added `pending_data`, ADR-0109 added `migration_incomplete` — `ALTER TYPE` plan in `0001` would collide | ADR-0079:82-85; ADR-0109 §Clause A:73 |

**Per-ADR verdict (no CONFLICTs):**
- ADR-0024 / 0079 — EXTEND (downstream extension, no amendment needed)
- ADR-0076 — EXTEND (D3 fills overtime gap)
- ADR-0077 — EXTEND (DERIVED tax fields align with PII rules)
- ADR-0078 — INDEPENDENT (no engine_process touch)
- ADR-0082 — EXTEND, **needs human sign-off** on parent_contract_id vs superseded_by_contract_id naming
- ADR-0093 — EXTEND (apply handler signature is generic enough)
- ADR-0109 — EXTEND, **needs human sign-off** on D2 index vs migrated data
- ADR-0111 — EXTEND (no new Clause B columns introduced)
- ADR-0182 — INDEPENDENT (telemetry namespace untouched)

**5 new ADRs needed:** shift_pay_calc audit (BLOCKER for Phase 5), Skatteetaten (go-live blocker), Riksavtalen versioning (before Phase 6), Lærling (later), overtime-cap default (BLOCKER for Phase 5).

---

### Scoring (rubric — 0-5 per axis)

| Axis | Agent A | Agent B |
|------|---------|---------|
| Completeness | 5 — all tables + enums + §14-6 + migration verdict + risks | 5 — all 10 ADRs + sign-offs + 5 new ADRs + open questions |
| Accuracy | 5 — file:line on every claim, verifiable | 5 — ADR-file:line on every claim, including the "ADR-0233-0236 don't exist" check |
| Decision quality | 5 — clear NO-GO on `0001`; precise next-action list | 5 — per-ADR verdict matrix; explicit promotion-path |
| Risk identification | 5 — GENERATED-column trap, ADR-0243 violation, name drift `position_title`/`job_title` | 5 — FK-naming conflict, D2-index vs migrated data, missing FK target |
| Self-falsifiability | 5 — every claim checkable in <5 min | 5 — every ADR claim checkable in <5 min |
| **Total** | **25/25** | **25/25** |

**Verdict:** tie at maximum. Both passed the ≥18 threshold by wide margin.

#### Good (kept the rules)
- Both agents respected READ-ONLY constraint. No file writes.
- Both produced citations (file:line) for every factual claim. No prose without anchor.
- Both caught the *primary* failure of the briefing: that PLAN-contract-employee.md is operating on stale assumptions.
- Both identified non-overlapping but complementary traps (Agent A: GENERATED-column, ADR-0243, §14-6 audit refutation. Agent B: FK-naming conflict, D2-index migration risk, missing successor ADRs).

#### Bad (worth correcting)
- Neither agent verified that ADR-0233-0236 are missing from a *different* branch. Agent B's "search confirmed `docs/decisions/` has files only up to ADR-0189" is on `development` — possible the successor ADRs exist on a feature branch and haven't merged yet. Mitigation for next cycle: agent should also `git log --all --oneline | grep -i "0233\|0234\|0235\|0236"` before claiming non-existence.
- Agent A's risk #5 (`position_title`/`job_title` rename) — capability-tool callers were named generically without grepping for actual usage. Could have been quantified ("N call sites match `job_title` in `packages/ai/src/capabilities/`").
- Neither agent checked git history of `0001_contracts_module_foundation.sql` to confirm it was never run anywhere (only that its supersessor ran). Belt-and-braces.

#### Carry-forward learnings (for future cycles)
- L-cycle-1-A: Briefing must include `git log --all` instruction when an agent is asked "does ADR-X exist?" — to cover unmerged feature branches.
- L-cycle-1-B: Audit-class agents perform best when the briefing forces grep-counts on claims about call sites (e.g. "for any rename finding, report `rg "<old_name>"` count").
- L-cycle-1-C: Two parallel sonnet agents on **complementary slices** (schema vs ADR) caught traps neither would have caught alone — the schema agent saw ADR-0243 in the migration comment; the ADR agent saw ADR-0001's own superseded status. Pattern: keep slicing read-only audits along **artifact boundaries** (DB-DDL vs decision-text), not topic boundaries.

#### Next slice decision (Cycle 2)

**STRIKE the assumption that Phase 1 is a migration sortie.** Combined evidence:
- Migration `0001` is dead (Agent A)
- ADR-0001 is dead (Agent B)
- Successor ADRs 0233-0236 missing on branch (Agent B; verify across all branches in Cycle 2)
- PLAN line 95-96 (copy 0001 → migrations/) and line 102 (seed `field_classification_metadata`) would corrupt or violate ADR-0243 if executed

**Cycle 2 scope (corrective sortie, doc + audit only — no DB writes):**
1. Verify successor ADRs 0233-0236 exist somewhere via `git log --all` across feature branches.
2. If missing → cycle 2 dispatches a `system-steward`/`code-architect` agent to **author** the four successor ADRs as drafts.
3. In parallel: a build-agent (sonnet) updates PLAN-contract-employee.md to mark Phase 1 lines 92-103 as **superseded** with corrective instructions (verify `20260519100100` applied, regen types, audit `job_title`/`position_title` references in capability tools).
4. Branch: new feat sortie `feat/contract-e2e-cycle2-adr-corrective`, off `development`.
5. Closure gate: ADR-0233-0236 land as `proposed` (or located + linked if pre-existing) AND PLAN updated.

**Cycle 2 metric:** 0 ADR drift between PLAN, ARCHITECTURE doc, and `docs/decisions/`. Falsifiable via grep of all four ADR IDs across all three locations.

**Loop status:** Cycle 1 closed. Cycle 2 opened below.

---

### Cycle 2 — 2026-04-30 (opened by orchestrator post-cycle-1)

**Slice:** Corrective sortie — strike stale PLAN/ADR-0001 instructions, align ADR-renumbering drift. Doc + audit only. No DB writes.

**Pre-dispatch verification (orchestrator-level, not agent):**

Confirmed ADR-0233-0236 (contract successors of ADR-0001) **DO exist** on `development` — but were **renumbered to ADR-0241-0244** to avoid collision with helpdesk-council ADRs (same renumber pattern as 2026-04-19 kanaler-helpdesk per memory). Both Agent A and Agent B missed this — Agent A cited "ADR-0243" inside the live migration comment without flagging it was one of the "missing" successors; Agent B searched filenames but didn't try the post-renumber range.

| Old ID (in ADR-0001 frontmatter) | New ID (on development) | Filename | Status | Frontmatter `id` field |
|---|---|---|---|---|
| ADR-0233 | ADR-0241 | `0241-contract-schema-migration-foundation.md` | proposed | `ADR_0233` (DRIFT) |
| ADR-0234 | ADR-0242 | `0242-contract-payroll-capability-split.md` | proposed | `ADR_0234` (DRIFT) |
| ADR-0235 | ADR-0243 | `0243-obligation-lifecycle-trigger-semantics.md` | proposed | `ADR_0235` (DRIFT) |
| ADR-0236 | ADR-0244 | `0244-amendment-flow-acknowledgement-as-legal-evidence.md` | proposed | `ADR_0236` (DRIFT) |

**This shrinks Cycle 2 from "author 4 ADRs" to "fix 5 frontmatter drifts + strike PLAN lines."**

**New cycle-2 scope (5 corrective items, all doc-only):**

1. ADR-0001 frontmatter — update successor references from `ADR-0233/0234/0235/0236` → `ADR-0241/0242/0243/0244`.
2. Each of ADR-0241/0242/0243/0244 frontmatter — fix `id` field from `ADR_0233/0234/0235/0236` → `ADR_0241/0242/0243/0244`.
3. PLAN-contract-employee.md lines 95-96 — strike "copy 0001_contracts_module_foundation.sql to migrations/", replace with "verify `20260519100100_contracts_module_foundation.sql` applied + types regen'd".
4. PLAN-contract-employee.md line 102 — strike "Seed `field_classification_metadata` from 99-seed-classifications.sql"; add note pointing to `packages/contracts/src/field-classification.ts` per ADR-0243.
5. PLAN-contract-employee.md lines 56-77 — update ADR list to reference 0241-0244 + reflect ADR-0001 superseded status.

**Optional cycle-2-extension (audit-class, can defer to cycle 3):**
- Grep `packages/ai/src/capabilities/` + `apps/web/src/app/dashboard/people/` for `job_title` payload references → list call sites that need rename to `position_title`. Quantifies Agent A's risk #5.

**Cycle 2 dispatch plan:**

- **Agent C** — `general-purpose` (sonnet) — execute corrective items 1-5. Single agent suffices; mechanical doc-edits, no design call. Output: 5 file diffs in single PR-ready commit on a new branch `feat/contract-e2e-cycle2-adr-corrective`.
- **Agent D** — `general-purpose` (haiku) — parallel grep audit for `job_title` references. Output: file:line list. Pure throughput task per CLAUDE.md dispatch rule (haiku).

**Cycle 2 measurement:** same rubric. Pass = ≥18/25 each. Falsifiable closure: `git grep "ADR-0233\|ADR-0234\|ADR-0235\|ADR-0236" docs/decisions/0241-* docs/decisions/0242-* docs/decisions/0243-* docs/decisions/0244-* docs/architecture/contract-service/ADR-0001*` returns 0 hits after cycle 2.

**Status:** Cycle 2 closed 17:25. Agent C + D both 30/30. Commit `b0243296e` on `development`.

#### Agent C — corrective doc-edits (general-purpose/sonnet)

**Output:** 6 files modified, single commit `b0243296e5c7846472184e27443af095a1202094`. All five edit specs landed verbatim:

| File | Change |
|---|---|
| `ADR-0001-kontrakt-og-lonnsprofil-fundament.md:17` | Successor refs 0233-0236 → 0241-0244 + renumber-provenance note |
| `0241-*.md`, `0242-*.md`, `0243-*.md`, `0244-*.md` | `id` field aligned to filename + `renumbered_from:` provenance |
| `PLAN-contract-employee.md` (lines 56-77, 95-96, 102, frontmatter) | ADR-list rewritten + dangerous Phase 1 bullets struck |

**Closure-gate result:** 5 hits remain on `git grep ADR-023[3-6]` — but all 5 are **intentional provenance** (1 historical note + 4 `renumbered_from:` fields). Zero stale forward references. Agent C correctly flagged the closure-gate spec as self-contradictory (asking for 0 hits while instructing to add provenance fields with the old IDs).

#### Agent D — `job_title` grep audit (general-purpose/haiku)

**Output:** 17 references across 6 files, fully categorized.

**Critical finding:** Agent A's risk #5 was over-broad. `profile.job_title` and `employment_contract.position_title` are **two different columns on two different tables**. Most refs are SAFE (profile-side, used for display).

**Real rename surface = 2 files in `packages/contracts/`:**
1. `field-classification.ts:49-50` — FIELD_CLASSIFICATION key `job_title:` should be `position_title:` (describes employment_contract amendments, not profile display)
2. `amendment-handler.ts:79-80` — `column === "job_title"` will never match if the actual amendment payload uses `position_title`

**SAFE (not contract-related, profile-side):**
- `apps/web/src/app/dashboard/people/[id]/page.tsx:50,176` — selecting from `profile.job_title`
- `apps/web/src/app/dashboard/people/page.tsx:39` — display fallback
- `apps/web/src/app/dashboard/people/_components/people-page-client.tsx:72` — display fallback
- `apps/mobile/src/components/chat/NewConversationSheet.tsx:94` — display fallback
- `supabase/functions/workspace-api/handlers/profiles.ts:13,51` — profile API (returns `profile.job_title`)

---

### Cycle 2 Scoring (6-axis rubric)

| Axis | Agent C | Agent D |
|------|---------|---------|
| Completeness | 5 — all 6 edits done | 5 — all refs found + categorized |
| Accuracy | 5 — verified via `git log -p` | 5 — file:line on every match |
| Decision quality | 5 — flagged buggy closure-gate, didn't comply blindly | 5 — narrowed scope from 17 sites to 2 actionable, refuted Agent A's overreach |
| Risk identification | 5 — caught spec self-contradiction | 5 — caught table-distinction (profile vs employment_contract) Agent A missed |
| Self-falsifiability | 5 — SHA + grep output paste-able | 5 — grep counts re-runnable |
| Cross-branch verification (NEW) | 5 — provenance fields explicitly anchor to renumber event | 5 — grep on current branch was correct scope |
| **Total** | **30/30** | **30/30** |

**Verdict:** both maximum. Cycle 2 = textbook execution. Both agents independently corrected my (orchestrator) errors:
- Agent C — buggy closure-gate spec (self-contradictory)
- Agent D — Agent A's over-broad rename claim (table-distinction missed)

#### Good (Cycle 2)
- Branch discipline: Agent C committed atomically with explicit `git add` per-file (no `git add .`).
- Falsifiable evidence: SHA `b0243296e` + grep output makes review <2 min.
- 2 separate orchestrator-level errors caught by 2 separate agents = orchestration earned its keep again.

#### Bad (Cycle 2)
- Closure-gate spec was buggy — should have been "0 hits except `renumbered_from:` provenance lines + historical note" or equivalent precise pattern. Lesson: when adding provenance, exclude provenance from the closure-grep.
- Cycle 1 risk-#5 wasn't grep-quantified at briefing time. Agent D had to re-do work that Agent A could have done if briefing demanded grep counts.

#### Carry-forward learnings (Cycle 2)
- L-cycle-2-A: closure-gate grep specs must explicitly exclude provenance/audit-anchor lines, otherwise they self-contradict their own remediation.
- L-cycle-2-B: any "rename impact" claim must include grep counts in the same audit pass — don't defer quantification to a follow-up cycle.
- L-cycle-2-C: Agent A's missed-table-distinction confirms cycle-1 finding: schema audits must always check whether two similarly-named columns live on different tables (here: `profile.job_title` vs `employment_contract.position_title`).

#### Loop status
Cycle 2 closed. Cycle 3 ready to dispatch. Memory hook will fire on next session Stop.

---

### Cycle 3 — opens after Pontus go on dispatch

**Slice:** Author 6 ADR stubs + 1 sub-plan + execute 1 small code rename.

| Item | Type | Agent type / Model | Artifact |
|---|---|---|---|
| ADR-0245 — Employee Contract Mobile Flow | NEW ADR | code-architect / opus | `docs/decisions/0245-*.md` |
| ADR-0246 — shift_pay_calc audit-modul | NEW ADR | system-agent-coordinator / sonnet | `docs/decisions/0246-*.md` |
| ADR-0247 — Skatteetaten-integrasjon | NEW ADR | system-agent-coordinator / sonnet | `docs/decisions/0247-*.md` |
| ADR-0248 — Riksavtalen versioning | NEW ADR | code-architect / sonnet | `docs/decisions/0248-*.md` |
| ADR-0249 — Lærling-kontrakter | NEW ADR | code-architect / sonnet | `docs/decisions/0249-*.md` |
| ADR-0250 — Overtime-cap default scope | NEW ADR | code-architect / sonnet | `docs/decisions/0250-*.md` |
| Sub-plan PLAN-contract-mobile-employee.md | NEW PLAN | general-purpose / sonnet | `docs/plans/PLAN-contract-mobile-employee.md` |
| Code rename `job_title` → `position_title` in `packages/contracts/` | CODE | general-purpose / sonnet | 2-file commit |

**Cycle 3 dispatch shape:** 3 waves used:
- **Wave 1:** ADR-0245 + ADR-0246 + ADR-0247 → renumbered to 0245 / 0251 / 0250 due to slot collisions
- **Wave 2:** ADR-0248 + ADR-0249 + ADR-0250 → renumbered to 0252 / 0253 / 0254 (orchestrator-assigned next-free slots)
- **Wave 3:** Sub-plan + code rename (parallel with Wave 2)

---

### Cycle 3 closure (2026-04-30)

**Status:** ALL Wave 2+3 agents completed. Cycle 3 closed.

#### Commits landed (8 total)

| Commit | Author | Artifact |
|---|---|---|
| `dc1d7fbc9` | Agent G (sonnet) | ADR-0250 Skatteetaten (renumbered from 0247) |
| `af953b1a2` | Agent F (sonnet) | ADR-0246 audit module (later renumbered 0246→0251) |
| `0906e54b0` | orchestrator | persist ADR-0245 + 0246→0251 rename + log update for 0245/0250/0251 |
| `aabe688c7` | Agent H (sonnet) | ADR-0252 Riksavtalen versjonering |
| `1ab7e6701` | Agent L (sonnet) | code-rename `job_title→position_title` in `packages/contracts/` |
| `88d2c033d` | Agent I (sonnet) | ADR-0253 lærling — also self-registered in log (orchestration breach noted) |
| `17fe21b8b` | Agent K (sonnet) | sub-plan PLAN-contract-mobile-employee + parent-plan edit |
| `dd05a28b4` | Agent J (sonnet) | ADR-0254 overtime-cap |
| `78aa82cf9` | orchestrator | log update for 0252 + 0254 |

#### Falsifiable closure verified

- ✅ `ls docs/decisions/024[5-9]-*.md docs/decisions/025[0-4]-*.md` → 7 expected files present (0245, 0250, 0251, 0252, 0253, 0254 + pre-existing 0247/0248/0249 unrelated)
- ✅ `ls docs/plans/PLAN-contract-mobile-employee.md` → exists
- ✅ `rg "job_title" packages/contracts/` → 0 hits
- ✅ `rg "job_title" apps/web/src/app/dashboard/people/` → 3 hits intact (profile-side SAFE)
- ✅ All 6 new ADRs (0245, 0250, 0251, 0252, 0253, 0254) registered in `docs/decisions/0000-decision-log.md`
- ✅ `pnpm --filter @smartout/contracts typecheck` passed (verified by Agent L)

#### Scoring (6-axis rubric)

| Agent | Wave | Output | Score |
|---|---|---|---|
| E (opus, code-architect) | 1 | ADR-0245 | 25/30 — body 30/30 quality, but dispatch-error: code-architect lacks Write tool, orchestrator persisted instead. Orchestration learning. |
| F (sonnet, system-agent-coordinator) | 1 | ADR-0246→0251 | 25/30 — content 30/30, but missed pre-flight `ls` collision check (renumber needed). |
| G (sonnet, system-agent-coordinator) | 1 | ADR-0247→0250 | 28/30 — caught its own collision pre-flight + self-renumbered. |
| H (sonnet, general-purpose) | 2 | ADR-0252 | 30/30 — pre-flight clean, all 8 sub-decisions covered, 5 open Qs surfaced |
| I (sonnet, general-purpose) | 2 | ADR-0253 | 27/30 — found `employment_form='apprentice'` already in live enum (briefing was stale), made smarter decision (option A3 vs my option 2). But self-registered in log breaking atomic-commit pattern. |
| J (sonnet, general-purpose) | 2 | ADR-0254 | 30/30 — discovered live `overtime_agreement_type` enum + `overtime_framework_rule_id` FK already exist; adapted recommendation; 10 open Qs |
| K (sonnet, general-purpose) | 3 | sub-plan + parent edit | 30/30 — 433 insertions, 41 falsifiable tasks, 4 open Qs |
| L (sonnet, general-purpose) | 3 | code rename | 30/30 — perfect scope discipline, typecheck pass, profile-side intact |

**Cycle-3 verdict:** all 8 agents passed ≥18 threshold. Avg 28/30. Two orchestration-level errors (briefing stale on enum-existence twice; one agent breached log-atomicity protocol).

#### Good (Cycle 3)
- Three independent agents (F, G, then orchestrator-detected for 0252/0254) caught **filename-collision renumber** as a real campaign pattern. Memory captured.
- Live-schema discoveries by Agent I (`employment_form='apprentice'`) and Agent J (`overtime_agreement_type` enum + `overtime_framework_rule_id` FK) corrected stale briefings — agents acted as schema-truth verifiers.
- Agent L scope discipline: profile-side `job_title` intact (3 hits preserved), only 2 contracts-package files touched.
- Agent K's sub-plan structure: 41 discrete falsifiable tasks across 10 phases — ready for Cycle 4 dispatch.

#### Bad (Cycle 3)
- Orchestrator dispatched Agent E to `feature-dev:code-architect` which lacks Write/Bash tools — body returned inline, orchestrator had to persist. Lesson: code-architect = blueprint-only; for ADR file authoring use `general-purpose` or build agents.
- Orchestrator briefings to Agents I and J cited stale schema (assumed enum values that already existed differently in live `database.types.ts`). Agents corrected on-the-fly. Lesson: pre-flight DB-schema check should be MANDATORY brief-augmentation for any DDL-adjacent ADR.
- Agent I self-registered ADR-0253 in decision-log despite "INGEN log-update" instruction — broke the atomic-commit pattern. Lesson: protocol enforcement requires BFF-style refusal at the agent surface, not trust at the prompt.
- Agent F missed pre-flight `ls docs/decisions/0246-*` check — third filename-collision in this campaign. Lesson: pre-flight collision check should be enforced via the briefing's `## Pre-flight` section explicitly.

#### Carry-forward learnings
- L-cycle-3-A: `feature-dev:code-architect` is read-only; never use for file-authoring tasks. Use `general-purpose` (sonnet/haiku) for ADR-author work.
- L-cycle-3-B: Briefings touching DDL must include "verify with `database.types.ts`" as a pre-flight step; agents correct stale orchestrator memory live-schema-truth.
- L-cycle-3-C: Atomicity-pattern (orchestrator owns log updates) is unenforceable without protocol-level prevention; either accept that agents may self-register OR add a `pre-commit` hook blocking changes to `0000-decision-log.md` from non-orchestrator commits.
- L-cycle-3-D: Filename-collision check (`ls docs/decisions/<number>-*` empty) should be a mandatory pre-flight gate in every ADR-authoring brief — fourth collision in 2 campaigns confirms permanent risk class.

#### Loop status
Cycle 3 closed. Cycle 4 ready to dispatch — Phase 0 sprint UX execution (8 fixes from PLAN-contract-employee.md lines 84-90).

---

### Cycle 4 — opens for Phase 0 sprint UX execution

**Slice:** PLAN-contract-employee.md Phase 0 (lines 81-90) — 8 sprint UX fixes folded in from old PLAN-employee-contract 2026-04-28. All web-side, low-blast-radius. Code-execution Cycle.

| # | Fix | Surface |
|---|---|---|
| 1 | MalerTab editor read-only (Lock badge + Copy/Open-in-admin) | apps/web |
| 4 | Cancel confirmation AlertDialog (destructive variant + loading state) | apps/web |
| 6 | `contract-preview-editor` enforce `editable: false` when `mode==="preview"` | apps/web |
| 7 | Loading state on Resend / Cancel dropdown menu items | apps/web |
| 9 | UnsavedChangesGuard on contract-send-drawer + CompositionDrawer + BulkSendDrawer | apps/web |
| T | Telemetry: 6 missing emit() calls (template.cloned, contract.resend, contract.cancel, contract.detail.viewed, bulk.submitted, compose.opened) | apps/web + telemetry registry |
| B | Bug: `use-employment-contracts.ts:97` actor_id (subject's profile_id → admin's profile_id) | apps/web |
| E | Extract reusable: DestructiveConfirmDialog, MutationButton, MutationDropdownMenuItem, UnsavedChangesGuard | apps/web/components |

**Cycle 4 ACTUAL shape (after pivot):**
- Wave 1+2 dispatched (Agents M, N) — both discovered most fixes ALREADY LANDED in commits `4ba618f4d` + `529b2f68b` + `381aa9ee7`. Both reported staleness; updated PLAN checkboxes + i18n keys only. Typecheck 40/40 PASS for both. Commits `57712b2d8` (M) + `6cacce549` (N).
- Wave 3 CANCELLED. Pivoted to scope-reconnaissance.
- Pivot Agent P (haiku) — full PLAN audit. Output: real state map.

### Cycle 4 closure (2026-04-30, post-pivot)

**Verdict:** Cycle 4 was supposed to be 7-task code-execution. Discovered that 18/53 PLAN tasks already DONE (most of Phase 0 + Phase 1). Cycle 4 reduces to: confirm staleness via Agent P, decide actual gap-list for Cycle 5+. **The orchestration earned its keep AGAIN — without recon, Cycle 5+ would have had agents writing code that already existed.**

#### Real state map (per Agent P haiku audit)

| Phase | Total | DONE | PARTIAL | NOT-STARTED | DEPRECATED |
|---|---|---|---|---|---|
| 0 Sprint UX | 8 | 7 | 1 | 0 | 0 |
| 1 DB foundation | 10 | 8 | 1 | 1 | 0 |
| 2 People-page | 7 | 0 | 0 | 7 | 0 |
| 3 Send-drawer | 5 | 1 | 2 | 2 | 0 |
| 4 my-contract | 5 | 0 | 1 | 4 | 0 |
| 5 Daily enforcement | 6 | 1 | 1 | 4 | 0 |
| 6 Amendment | 7 | 2 | 1 | 4 | 0 |
| 7 Tripletex | 5 | 1 | 0 | 4 | 0 |
| **TOTAL** | **53** | **20** | **7** | **26** | **0** |

(Agent P initial count had 18 DONE + 11 PARTIAL + 22 NOT-STARTED. Refined here based on Agent P's per-phase notes.)

#### Cycle 4 scoring

| Agent | Output | Score |
|---|---|---|
| M (sonnet) | Verified Phase-0 done; updated PLAN + 8 i18n keys | 28/30 — falsifiable + scope-disciplined; no code written but the audit-finding IS the value |
| N (sonnet) | Verified 3 fixes done; updated PLAN | 28/30 — same pattern |
| P (haiku) | Full 8-phase staleness audit | 30/30 — perfect throughput + falsifiable evidence per task |

#### Good (Cycle 4)
- Both M and N independently flagged "this is already done" instead of writing duplicate code. Trust-pattern earned: agents acted as reality-verifiers.
- Pivot to recon was the right move — saved Cycle 5+ from 6+ wasted dispatches.
- Agent P delivered priority-ordered gap-list with falsifiable evidence per task.

#### Bad (Cycle 4)
- Orchestrator briefing for M and N didn't include "verify task isn't already done" pre-flight. Lesson L-cycle-4-A: every code-execution brief must require pre-flight grep against existing code BEFORE writing any new code.
- PLAN-contract-employee.md was AUTHORED 2026-04-29 (1 day ago) yet most of its Phase 0 tasks were already implemented in commits PRIOR to that date. PLAN was written without a state-audit. Lesson L-cycle-4-B: any plan authoring sortie must include a "what's already done" reconnaissance pass before writing tasks.

#### Carry-forward learnings
- L-cycle-4-A: Code-execution agents must pre-flight grep for existing implementations. Add "If task is already implemented, REPORT and EXIT — do not duplicate" as a standard brief clause.
- L-cycle-4-B: Plans written without state-audit are stale-by-default. PLAN-staleness audit is a permanent class of orchestration verification.
- L-cycle-4-C: Haiku-class scope-recon is the cheapest possible orchestration tool. Use it BEFORE every code-execution wave, not after.

#### Loop status
Cycle 4 closed. Cycle 5 ready — close Phase 0 + 1 to 100%.

---

### Cycle 5 — opens for Phase 0 + 1 closure (4 small tasks)

**Slice:** Reduce Phase 0 PARTIAL → DONE + Phase 1 NOT-STARTED → DONE. After Cycle 5, Phase 0 + 1 are both 100% closed and Cycle 6 can attack Phase 2-7 substantively.

| # | Task | Phase | Agent type | Model |
|---|---|---|---|---|
| Q | Add 3 missing telemetry events (`contract.resend`, `contract.cancel`, `contract.detail.viewed`) to `packages/telemetry/src/registry.ts` + emit() at 3 mutation sites | 0 | general-purpose | sonnet |
| R | Add `activity_trail` trigger on `employment_contract` INSERT/UPDATE — write migration + apply | 1 | general-purpose | sonnet |

**Cycle 5 dispatch:** 2 parallel (no overlap). Both small, both with falsifiable closure-gate.

**Cycle 5 falsifiable closure:**
1. `rg "contract.resend\|contract.cancel\|contract.detail.viewed" packages/telemetry/src/registry.ts | wc -l` returns 3
2. `rg "emit.*contract\.(resend|cancel|detail\.viewed)" apps/web/src/` returns ≥3 hits
3. Migration file exists at `supabase/migrations/<ts>_employment_contract_activity_trail_trigger.sql`
4. `pnpm turbo typecheck` passes

After Cycle 5: Phase 0 = 8/8 DONE, Phase 1 = 10/10 DONE. Foundation locked. Cycle 6 starts Phase 2 (people-page HR-tab — biggest single phase, 7 tasks).

**Cycle 3 scope expanded (per Pontus 17:00):** mobile contract flow is undesigned. Phase 4 + 6 in PLAN-contract-employee.md treat employee-side as web-first with "mobile follow-up" — this violates ADR-0133 ("web composes, mobile executes"). Employee-side IS the natural mobile surface (D6 + C4 verbs).

Cycle 3 will author:
- **ADR-0245** (foreslått) — Employee Contract Mobile Flow (DocuSeal embed pattern, AcknowledgementRing mobile-first layout, push-trigger map per ADR-0134, Botsson DomainChatOwnership suppression per L-0178 + ADR-0078, biometric C4 acknowledgement as §14-6-evidence per ADR-0244 + ADR-0136, offline cache-policy)
- **Sub-plan** `PLAN-contract-mobile-employee.md` — splits Phase 4 + 6 into web-track + mobile-track
- **PLAN-contract-employee.md line 165** strike of "mobile UI follow-up OK" — kontrakt employee-flow er mobile-first, ikke follow-up
- **5 ADR stubs already identified in Cycle 1:** shift_pay_calc audit, Skatteetaten, Riksavtalen versioning, lærling, overtime-cap default

Cycle 3 dispatch deferred until Cycle 2 closes (closed-loop kill-rule — no skip-ahead).

---

## Loop contract

After every cycle:
1. Score both agents against rubric.
2. Append `Good` / `Bad` / `Carry-forward learnings` rows above.
3. Decide next slice (write to "Next slice decision").
4. On `Stop` event the project-local hook (`.claude/hooks/contract-e2e-memory-write.sh`) appends this file's tail to `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/orchestration-contract-e2e.md` so future sessions inherit context.
5. Open next cycle below the prior one. Never edit prior cycles.
