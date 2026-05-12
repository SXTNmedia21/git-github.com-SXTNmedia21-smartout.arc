## System Steward Memory Index

### Cascade Core

- [cascade-integrity-mandate.md](cascade-integrity-mandate.md) — Core mandate: enforce system ontology and causal integrity, not just compliance. Eight invariants, five meaning layers, six required verification artifacts. Updated 2026-03-22.
- [cascade-enforcement-checklist.md](cascade-enforcement-checklist.md) — Operational checklist for verifying plans against Cascade Core Foundation (I1+6D+4C+K1a/K1b). Terminology table, key references.
- [cascade-review-findings.md](cascade-review-findings.md) — Current implementation status aligned to `docs/STATE.md`: Phase A done, Phase B 4/6, Phase C partial, active conflicts and bootstrap gaps, wrong hospitality rates.
- [cascade-claudemd-rewrite-assessment.md](cascade-claudemd-rewrite-assessment.md) — Block full CLAUDE.md rewrite until Phase C. Concepts that don't map to cascade. Active traps.

### Test Infrastructure

- [test-coverage-map.md](test-coverage-map.md) — Playwright E2E test coverage map: what's tested, what's missing, known fake tests, seed helper gaps.

### Council History

- [gate-migration-council-wave-2.md](gate-migration-council-wave-2.md) — 2026-04-18. APPROVE WITH CHANGES, rescoped to Season-only. Waves 2B/2C blocked on P1-P3 / Q1-Q3. Chair reversed Phase 3 on ordering + Trust Gate + shared-fn scope.
- [learning_audit_inflation_pattern.md](learning_audit_inflation_pattern.md) — Grep-based briefings inflate scope + miss integrity breaches. Verified twice (Web Perf 2026-04-16, Gate Migration 2026-04-18). Always pair with code-trace.
- [auth-invitation-wave-h-council.md](auth-invitation-wave-h-council.md) — 2026-04-22 Phase 5 synthesis. APPROVE WITH CHANGES, rescoped as remediation amendment (not new wave). Briefing's "0 emit sites / L-0083 4th occurrence" FALSIFIED — code truth: 13 emit sites including 4 Edge direct-inserts. Real issues: engine_event parity gap on 5/9 events, fail-open .catch swallows, ADR-0045 silent violation. Trust Gate CONDITIONAL PASS (3 conditions). 3 ADRs (0045+0152 amendments, 0171 new), 4 learnings (L-0094/0095/0096/0097).
- [contract-management-redesign-council.md](contract-management-redesign-council.md) — 2026-04-22 Phase 5. APPROVE WITH CHANGES. Q1=B locked, tabs-in-hub IA (retires /settings/contracts), drawer replaces /new, Botsson button → ambient chip. 5 G-conditions merge-blockers: G1 is_admin_in_workspace signature inversion (pre-flight), G2 5 template events registered, G3 is_system BEFORE UPDATE trigger, G4 new tools with gate_action+default_allow=false, G5 source_template_id+source_template_version+forked_at+published_at+deprecated_at columns. Botsson NOT theatre — 2026-04-09 claim falsified by code-trace (4th prior-council staleness occurrence). 3 ADRs (0178 lineage, 0179 lifecycle split, 0180 industry_intelligence proposed). 3 learnings (L-0098 prior-council staleness pattern, L-0099 tabs-in-hub resolution, L-0100 primeContext enrichment).
- [s6-welcome-mission-r4-council.md](s6-welcome-mission-r4-council.md) — 2026-05-09 Phase 5. **REJECT — REMEDIATE BEFORE MERGE**. Phase 3 verdict REVERSED per L-0147 (5th precedent). 6 commits Tier 1+2 in branch (B1+B2 contract drift fix, D1+D2 broken test mocks, C2 voice-agent room→mission dispatch, C3 EF metadata pass-through, D3 wrapper hardcoded voice, W1+D4 stale comments). Trust Gate CONDITIONAL FAIL: 3/6 contract promises broken; voice-agent serves Mr. Botsson Jarvis to every room (C2 root). Defer C1 (LISE_PERSONA undefined-by-design becomes benign once C2 lands) + W2 (engine_sessions writer = observability-only). 2 new learnings PROMOTE: L-NEW-6 (BFF↔EF body field contract drift, sibling of L-0177), L-NEW-7 (voice-agent runtime decoupled from mission registry, requires new ADR).

## Cross-cutting Recurring Patterns

- **L-0147 self-reversal precedents (now 5):** Year Wheel 2026-04-20, /dashboard/help 2026-04-28, ADR-0216 2026-04-28, Botsson on Platform Admin 2026-04-29, **S6 welcome-mission R4 2026-05-09**. Pattern: chair generalizes scope; 2+ code-tracers falsify with file:line; chair must explicitly classify Phase 3 as REVERSED (not REFINED, not HELD).
- **Trust Gate per-promise rule (L-0175/L-0176):** When a PR makes N≥2 promises, never average them into a single PASS. List each promise, verify pipeline-readiness end-to-end, refuse single-paragraph verdicts. Applied successfully in S6 R4 (memory PASS, voice persona FAIL).
- **Steward Phase 3 must run tests, not infer them:** S6 R4 surfaced that Steward Phase 3 "tests pass" was inferred from file presence. Harness ran the suite and found broken mocks. Add to Steward verification protocol: when plan touches new test files, execute the suite — do not assume.
- **Service-layer cascade integrity (new in S6 R4):** Cascade integrity invariants apply to runtime services, not just capability tools. A voice-agent that hardcodes one mission's instructions for every room is the same ontology violation as a capability tool that hardcodes workspace_id. Extend cascade-integrity-mandate.md to cover service-runtime dispatch.

## Quick Reference: Cascade Red Flags

- **Side logic**: Any plan creating business logic beside cascade → reject unless ADR-justified
- **Ambiguous roles**: Entity that can't declare source/derived/proposal/execution/audit → plan incomplete
- **Hidden derivation**: Derived state depending on UI state or ephemeral services → reject
- **Domain in Event Engine**: Cascade reasoning in event handlers → reject
- **Permission-truth blur**: C4 flags mixed into C1 domain state → reject
- **Orphan concepts**: Helper statuses, temp scores, unclear draft modes → flag for lifecycle justification
- **Bootstrap bypass**: New cascade consumers before I1 bootstrap is wired into workspace creation → flag as incomplete

## Quick Reference: Canonical Control Gate

- **Telemetry truth**: `packages/telemetry/src/registry.ts` + `packages/telemetry/src/emit.ts`
- **AI runtime truth**: `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`
- **Cascade boundary**: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` + `docs/decisions/0056-cascade-core-foundation-schema.md`
- **Phase status / blockers**: `docs/STATE.md`
- **Forward-looking superpowers docs**: useful for intended direction, but not current truth until landed

## Quick Reference: Test Red Flags

- **Fake telemetry test** in `journey-website-factory.spec.ts:368-395` — string truthiness, not real DB check
- **No cascade seed helpers** in `helpers/seed.ts` — blocks cascade journey tests
- **Performance gates are partial** — `performance-gates.spec.ts` covers schedule and season headings, but not deeper cascade interactions like day control open time or season tab switching
- **waitForTimeout abuse** in `cascade-ui.spec.ts` — fragile, replace with element waits
