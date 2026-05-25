---
title: "L-0147 13th precedent: ghost-migration council Phase 1 → Phase 5 reversal"
id: LEARNING_0360
status: canonical
layer: learning
created: 2026-05-25
updated: 2026-05-25
tags: [council, L-0147, chair-self-reversal, methodology]
---

# Learning-0360: L-0147 13th precedent — ghost-migration council Option A → Option D reversal

## Context

Council session 2026-05-25 on prod ghost-migration constraint-state remediation. Orchestrator's Phase 1 proposal was Option A — direct DDL via MCP `execute_sql` against prod (10-second fix, idempotent ALTERs, zero blast radius given 0 prior godmode clicks).

Phase 3 dispatched system-steward + supervisor.

- **Steward** rejected A with file:line evidence: ADR-0265 §Hard rules ban manual prod DDL except emergency rollback; PR #375/#376 precedent was "manual reconciliation declared closed" per ci.yml:340-345 not "established escape valve".
- **Supervisor** rejected A with stronger code-trace: surfaced ADR-0361 §Design 2 (2026-05-17, post-PR-#375) codifying "Forward-only repair, not auto-fix" as canonical post-incident doctrine; reclassified PR #375/#376 as `supabase migration repair` IN CI not manual MCP; identified `b54fcf801` (2026-05-17) forward-only migration `20260620100000_align_prod_drift_2026_05_17.sql` as the truer recent precedent.

Phase 5 chair synthesis: **REVERSED Option A → Option D** per L-0147 canonical format.

> "Phase 1 claim 'Option A direct MCP DDL is viable' was FALSE. Falsifying evidence: ADR-0361:124-127 forward-only mandate + L-0302 ghost-migration doctrine + ci.yml:351-354 `--include-all` non-re-application + `b54fcf801` forward-only precedent. Classification: REVERSED."

## Discovery

**13th L-0147 precedent** (sub-axis vs whole-verdict accounting variance acknowledged per L-0294):

| # | Date | Council | Reversal subject |
|---|------|---------|-----------------|
| 1 | 2026-04-20 | Year Wheel Redesign | Trust Gate Phase 3 PASS → Phase 5 FAIL |
| 2 | 2026-04-28 | /dashboard/help | Phase 3 REJECT → Phase 5 APPROVE-as-tier |
| 3 | 2026-04-28 | ADR-0216 | Phase 3 Option A2 → Phase 5 Option B |
| 4 | 2026-05-09 | S6 R4 | Capability scope |
| 5 | 2026-05-14 | WFM merge | L-0261 8th precedent |
| 6 | 2026-05-14 | (earlier) | L-0264 4th occurrence |
| 7 | 2026-05-16 | Chat-WhatsApp | L-0276/0278 |
| 8 | 2026-05-17 | Phase 7d original | L-0289 6th occurrence |
| 9 | 2026-05-17 | Phase 7d-followup | Gap 4 + Gap 5 |
| 10 | 2026-05-17 | (Tidslinje surface boundary) | 10th |
| 11 | 2026-05-23 | (Tidslinje) | (per COUNCIL-LOG.md sibling-session ref) |
| 12 | 2026-05-25 | Botsson month-setup | 6-tool reframe of 10-gap brief |
| **13** | **2026-05-25** | **Ghost-migration remediation (this)** | **Phase 1 Option A → Phase 5 Option D** |

Pattern signature unchanged from prior precedents: Phase 1 proposal generalizes from convenience or recency bias (here: "MCP execute_sql is fast + idempotent"); Phase 3 code-trace against doctrine falsifies (ADR-0361 §Design 2 doctrine; b54fcf801 truer precedent); Phase 5 must explicitly REVERSE (not refine, not rationalize).

**Specific to this precedent:** the briefing's framing of "Option A vs Option B" was the Phase 1 generalization. Both options manipulated the ledger directly; the doctrine ADR rejected that whole category. Supervisor's code-trace + Steward's ADR-265 reading combined to surface this. Without the code-tracer mandate (now SKILL.md hard rule for migration-class topics), Phase 5 might have papered over with "compromise" Option A′.

## Impact

- L-0147 precedent count now 13 (canonical count varies; this session adopts whole-verdict accounting consistent with L-0264 + L-0294)
- Pattern stability: ~once-per-week occurrence is steady-state. Promotion threshold (3-precedent rule per Phase 9 Step 4) was crossed long ago — protocol is already enforced as hard rule in run-council SKILL.md Phase 5 §1.5.
- Specific reinforcement this precedent adds: **doctrine-ADR check (L-0359) should be Phase 2.5 hard rule**. When briefing-side check catches the doctrine, Phase 3 code-trace is freed for novel-evidence work instead of doctrine-rediscovery.

## References

- Council session 2026-05-25 — Phase 5 chair self-reversal documented in synthesis
- L-0147 — original chair self-reversal protocol
- L-0294 — 7th precedent promotion-to-hard-rule (precedent counting methodology)
- L-0264 — 4th occurrence (sub-axis vs whole-verdict accounting)
- L-0359 (this council) — sibling: Phase 2.5 doctrine-ADR gap 3rd occurrence
- ADR-0427 (this council) — the decision the reversal landed on
- ADR-0361 §Design 2 — the doctrine that did the reversing
- run-council SKILL.md Phase 5 §1.5 — already enforced hard rule that this precedent triggered
