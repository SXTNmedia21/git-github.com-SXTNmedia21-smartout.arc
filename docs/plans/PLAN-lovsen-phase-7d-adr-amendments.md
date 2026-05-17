---
title: "Plan — lovsen-phase-7d-adr-amendments"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [plan, lovsen, payroll, phase-7d, adr-amendments, council-verdict]
---

# Plan — lovsen-phase-7d-adr-amendments

> Branch: `feat/payroll-lovsen-phase-7d-adr-amendments` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-4 | Base: `campaign/payroll` | Module: payroll | Started: 2026-05-17

## Goal

Sortie 1 of 3 in the Phase 7d-followup execution series. Ship ADR amendments + 2 new ADRs + 3 learnings + SKILL.md promotion required by 2026-05-17 council verdict (`docs/council/COUNCIL-LOG.md` 2026-05-17 §"Phase 7d-followup Schema Migration Scope"). Pure documentation work — no migration code, no schema changes, no capability code. Blocks Sortie 2 (migration sortie).

## Council verdict reference

- Council session: 2026-05-17 — Phase 7d-followup Schema Migration Scope (post-implementation code-trace of ADRs 0350–0354)
- Verdict: APPROVE WITH CHANGES + 11 blocking conditions
- 5 reviewers (steward chair + supervisor + system-agent-coordinator + payroll-engine code-tracer + database code-tracer)
- Chair self-reversal: 7th L-0147 precedent (Gap 4 + Gap 5 reversed in Phase 5)
- Falsifications confirmed: ADR-0353 §A schema conflict, ADR-0353 §D missing column `tariff_binding_id`, ADR-0351 Option C structurally-invalid PostgreSQL CHECK, ADR-0353 §A FK bug (`workspace(id)` should be `workspace(workspace_id)`), ADR-0173 frozen-4 cross-namespace violation

## Slot reservation (per L-0209 done in main campaign worktree 2026-05-17 pre-sortie)

- ADR-0355: `workspace_union_binding` lifecycle + cache-trigger pattern on workspace_settings
- ADR-0356: cascade-namespace delegation pattern for cross-namespace capability writes
- L-0292: pre-council schema-reality-check pattern
- L-0293: denormalized cache + canonical lifecycle pattern when hot-path-read field is load-bearing for golden-case determinism
- L-0294: 7th L-0147 chair self-reversal precedent + SKILL.md promotion to hard rule

## Tasks

### Doc writes (parallel, 7 docs-tutor sonnet agents)

- [ ] T1. Write `docs/decisions/0355-workspace-union-binding-lifecycle-and-cache-trigger.md` — canonical lovsen union binding table separate from cascade `workspace_framework_binding`; trigger maintains `workspace_settings.is_tariff_bound` + `active_union_id` cache; APPEND-ONLY semantics; backfill strategy for 4 live workspaces
- [ ] T2. Write `docs/decisions/0356-cascade-namespace-delegation-pattern.md` — generalizes ADR-0240 journey-authoring pattern; defines when payroll/contract/other capabilities can write to `public.*` cascade tables via delegation tools (`cascade.bind_workspace_union`, `cascade.add_supplement_rule`); names ADR-0173 frozen-4 boundary defense
- [ ] T3. Amend `docs/decisions/0353-workspace-framework-binding-bootstrap.md` — §A: name explicit L-0147 self-reversal, rename proposed table to `workspace_union_binding`, fix `workspace(id)` → `workspace(workspace_id)` FK bug, reference ADR-0355 for binding contract; §D: name explicit reversal on audit FK chain, acknowledge `shift_pay_calculation_event.tariff_binding_id` does not exist and must be added in Sortie 2 migration
- [ ] T4. Amend `docs/decisions/0351-workspace-supplement-policy-tariff-floor.md` — Option C: name explicit L-0147 self-reversal, replace pseudo-SQL CHECK (structurally invalid PostgreSQL) with BEFORE INSERT/UPDATE TRIGGER spec per L-0172 SECURITY DEFINER + locked search_path pattern; specify `public.supplement_rule` as target table (3 reviewers cited code-trace evidence vs 1 supervisor vote — code-trace wins per Control Gate); reference ADR-0356 delegation pattern
- [ ] T5. Write `docs/learnings/0292-pre-council-schema-reality-check-pattern.md` — read 5 most-cited tables/columns from any schema-migration briefing BEFORE Phase 2 dispatch; this council caught 5 ADR-level falsifications that would have survived Phase 3 otherwise; promote to council-orchestrator skill after 3+ occurrences
- [ ] T6. Write `docs/learnings/0293-denormalized-cache-plus-canonical-lifecycle-pattern.md` — when hot-path-read field is load-bearing for golden-case determinism contract (payroll-engine non-negotiable principle 4), denormalized cache + canonical lifecycle table + trigger-synchronized sync is valid pattern; document Gap 4 reversal as worked example
- [ ] T7. Write `docs/learnings/0294-seventh-l0147-precedent-promote-to-skill-hard-rule.md` — 7 documented chair self-reversal precedents (Year Wheel 2026-04-20, /dashboard/help 2026-04-28, ADR-0216 2026-04-28, Botsson on Platform Admin 2026-04-29, S6 R4 2026-05-09, Chat-WhatsApp 2026-05-16, Phase 7d-followup 2026-05-17). 3+ occurrence threshold long exceeded. Promotion to SKILL.md HARD RULE required.
- [ ] T8. Update `~/.claude/skills/run-council/SKILL.md` — promote L-0147 chair self-reversal protocol from Phase 5 §1.5 "mandatory hard rule" advisory text to enforced SKILL.md hard rule with explicit precedent table (7 dates) + canonical format ("Phase 3 claim X was [TRUE/FALSE]. Falsifying evidence: <citation>. Classification: REVERSED.")

### Registration + capture

- [ ] T9. Append ADR-0355 + ADR-0356 rows to `docs/decisions/0000-decision-log.md` table
- [ ] T10. Append L-0292/0293/0294 to `docs/learnings/0000-learning-log.md`
- [ ] T11. Write `docs/journeys/JOURNEY-payroll-lovsen-phase-7d-adr-amendments.md` — 3 journeys (admin reads amended ADR; sortie-2 migration agent loads ADR-0355 contract; council orchestrator reads SKILL.md promoted L-0147 rule)
- [ ] T12. Write `docs/handoffs/HANDOFF-payroll-lovsen-phase-7d-adr-amendments.md` — required by close-feature.sh (must reference Sortie 2 + Sortie 3 + Phase 7f blockers)

### Close

- [ ] T13. `pnpm turbo typecheck` (must pass — pure docs sortie, should be no-op)
- [ ] T14. `close-feature.sh` from main repo

## Acceptance Criteria

- [ ] 2 new ADRs written + status: proposed (ADR-0355, ADR-0356)
- [ ] 2 existing ADRs amended with explicit L-0147 self-reversal naming (ADR-0353, ADR-0351)
- [ ] 3 new learnings written + registered (L-0292, L-0293, L-0294)
- [ ] L-0147 promoted to SKILL.md hard rule per Phase 9 Step 4 (3+ threshold exceeded)
- [ ] Decision log + learning log updated
- [ ] Journey + handoff written (close-feature gates)
- [ ] Typecheck passes (no-op expected)
- [ ] All commits follow CLAUDE.md commitlint conventions (header ≤100 chars, body lines ≤100 chars, Co-Authored-By footer)

## Out of scope

- Migration SQL (Sortie 2)
- Schema changes (Sortie 2)
- TRIGGER function body (Sortie 2 — ADR-0351 amendment specifies SHAPE only, Sortie 2 writes the SQL)
- Capability tools (Phase 7f — gated on Sortie 3 delegation tools)
- Delegation tool implementation (Sortie 3)

## Dependencies + sequencing

- Blocks: Sortie 2 (migration sortie cannot start until ADR-0355 + ADR-0356 + amendments land on `campaign/payroll`)
- Blocked by: Nothing (pure docs work)
- After close-feature merge: Sortie 2 can be opened with full ADR contract in hand

## Risks

- **Decision-log conflict risk:** Sortie 2 also writes decision-log rows. If Sortie 1 + Sortie 2 open in parallel, decision-log conflicts. Mitigation: Sortie 2 does NOT open until Sortie 1 closed.
- **SKILL.md edit conflict:** `~/.claude/skills/run-council/SKILL.md` is user-global (not in repo). Promotion changes the skill file — not git-tracked here but consumed by all future councils. Verify with a test council after Sortie 1 closes.
- **Cross-reference drift:** ADR-0355 + ADR-0356 reference each other + ADR-0353 + ADR-0351 + ADR-0173 + ADR-0240. Verify all cross-refs after T1-T4 complete.
