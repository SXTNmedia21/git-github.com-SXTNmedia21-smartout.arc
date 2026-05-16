---
title: "Slice 09 — ADR Coverage Gaps"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, adr-coverage-gaps, adr]
---

# Slice 09 — ADR Coverage Gaps

## Summary

- **Total accepted ADRs in decision log:** 204 (excluding reserved/n/a)
- **Covered by slices 01–08, 10–14:** 34 distinct accepted ADRs
- **Uncovered accepted ADRs:** 170
- **Orphan-proposed with code refs (≥3 files):** 33

The coverage gap is wide because most slices were topic-scoped (cascade, contracts, RLS, etc.) and the 170 uncovered ADRs span infrastructure, billing, auth, governance tooling, and platform plumbing. Most of these are "architecture-as-code" ADRs whose drift would be caught incidentally by other slices if they fire. The critical subset — those with enforcement surfaces that can silently diverge — is identified below.

---

## Uncovered ADRs — High-Enforcement Subset

These 17 accepted ADRs have explicit enforcement surfaces (CI checks, code patterns, schema constraints) but no slice currently verifies them.

| ADR | Title | Risk if unchecked |
|-----|-------|------------------|
| ADR-0057 | Payroll Schema Separation | payroll.* tables must stay in `payroll` schema; public-schema leakage silently breaks RLS |
| ADR-0081 | Admin PII Bypass via SECURITY DEFINER RPC | wrong invocation path (non-RPC direct query) = RLS bypass in production |
| ADR-0099 | Unified Authority-Gate Across agent-router + engine-dispatch | dual-gate contract; new tools silently skip one gate |
| ADR-0110 | Payroll Ledger Archive | ledger immutability invariant; mutations via wrong path corrupt audit chain |
| ADR-0111 | Employment Contract Detail | FK + column presence; contract gaps silently omit required fields |
| ADR-0112 | Intent Classifier Coverage Invariant | CI check exists but its scope is not audited — new intents could drop coverage |
| ADR-0114 | Server Actions as Canonical Mutation Primitive | Route Handler mutations = violation; no current slice checks for Route Handler drift |
| ADR-0117 | Authority Model after Phase 4 | `gate_action` as sole authority source; legacy `check_permission` callers = drift |
| ADR-0189 | Authority Seed Parity via CI Check | CI check enforces seed parity — but CI check itself is never validated for completeness |
| ADR-0190 | Authority Parity for `cascade_gate_write` | orthogonal control; new cascade paths may skip parity requirement |
| ADR-0195 | Authority Loader Full Dotted-Key Preservation | loader drops nested keys on malformed config = silent permission expansion |
| ADR-0207 | `callGateAction` Canonical Wrapper | direct `gate_action` calls bypassing wrapper = audit gap; no slice checks call sites |
| ADR-0262 | Admin File Downloads via 302-Redirect to Signed URLs | direct Storage URL in response = long-lived public URL exposure |
| ADR-0263 | Defense-in-Depth Ownership Re-Check on Admin Pages | ownership check omission = cross-workspace read on admin pages |
| ADR-0292 | Payroll Override-Applier Uses Supersession-Chain | wrong derivation_version bump silently corrupts payroll chain |
| ADR-0293 | Payroll Pattern B Sync-Recalc Chain | missing sync-recalc call after supplement write = stale lønnsgrunnlag |
| ADR-0294 | Payroll PDF Library | footer/header content requirements; wrong string = compliance violation |

## Uncovered ADRs — Medium-Enforcement (representative)

An additional ~45 accepted ADRs have partial enforcement surfaces but lower immediate drift risk. Grouped by domain:

| Domain | ADRs | Nature |
|--------|------|--------|
| Telemetry / telemetry routing | 0084, 0116, 0160, 0165, 0187, 0212 | emit patterns, channel discriminators, event-source singletons |
| Season / Year-Wheel | 0164, 0200, 0201, 0202 | activation semantics, capability namespace |
| Botsson / Agent Harness | 0206, 0208, 0209, 0220, 0221 | arena extraction, KB merge gate, MCP transport |
| Journey / engine_missions | 0178, 0194, 0196, 0217, 0222, 0223, 0224 | JourneyIR schema, invariants, speed profiles |
| Auth / Identity | 0168, 0169 | magic-link default, invitation index |
| Billing | 0118, 0119, 0120, 0121, 0125, 0126, 0141, 0142, 0143, 0144, 0148 | invoice immutability, dunning, EHF |
| engine_world | 0281, 0290 | platform writes, bypass semantics |
| Governance content | 0140, 0181, 0182 | provenance JSONB, K1a→K1b inheritance |

## Uncovered ADRs — Low Risk (architecture/convention only)

~108 accepted ADRs are foundational architecture decisions (monorepo tooling, UI framework, Vercel split, port standards, documentation structure, etc.) that are verified continuously by the build system or have no practical drift surface. These include ADR-0001 through ADR-0030 (infra/tooling cluster), ADR-0025/0034/0075 (docs), ADR-0050 (port standards), ADR-0213/0214/0237 (process conventions). Marking ✅ superseded-safe — no new slice required.

---

## Orphan-Proposed ADRs with Code References

Proposed/draft ADRs that already have ≥ 5 file code references but no "accepted" status. These carry real implementation debt.

| ADR | Code-refs | Title | Risk |
|-----|-----------|-------|------|
| ADR-0151 | 194 | Stage-engine must re-derive `profile_id` server-side | CRITICAL — most-referenced proposed ADR in codebase; body-supplied profile_id trust = ADR-0151 violation at 194 call sites |
| ADR-0176 | 54 | Journey capability C4 authority seed | Authority seed for journey capability missing acceptance; 54 files reference it |
| ADR-0173 | 37 | Journey capability model | Core journey model referenced in 37 files; proposed = no canonical enforcement |
| ADR-0175 | 35 | Journey telemetry contract | Telemetry events emitted but contract not accepted = no parity guarantee |
| ADR-0193 | 21 | NonEmptyString brand for telemetry actor_id | Type brand used across telemetry package but ADR still proposed |
| ADR-0270 | 21 | Business Intelligence capability | BI capability code exists, no accepted architecture decision |
| ADR-0295 | 18 | Feriepenger boundary | Holiday-pay calculation boundary; 18 refs, still proposed = semantic drift risk |
| ADR-0242 | 17 | Contract / Payroll Capability Split | Payroll campaign active; split not accepted = capability boundary unclear |
| ADR-0243 | 17 | Obligation Lifecycle | Contract obligations referenced; lifecycle undefined |
| ADR-0191 | 14 | Agent capability tool auth-passing pattern | Auth-passing pattern in 14 tool files; no accepted contract = inconsistent |
| ADR-0240 | 13 | Journey-Authoring Tool Boundary | Journey authoring tools exist; boundary not accepted |
| ADR-0244 | 12 | AcknowledgementRing as §14-6 Legal Evidence | Legal evidence pattern; compliance risk if proposed |
| ADR-0251 | 12 | `shift_pay_calculation` Full Audit Module | Payroll audit module referenced; design not finalized |
| ADR-0267 | 12 | Booking PII Access Control | PII control in 12 files, architecture not accepted |
| ADR-0152 | 11 | activity-trail must fail-fast on missing IDs | fail-fast pattern in use; ADR proposed = pattern not enforced by convention |
| ADR-0287 | 9 | `gate_action` mandatory on all mutation capability tools | Gate requirement referenced; not accepted = new tools may skip |
| ADR-0229 | 7 | Dual-Gate Transitional Architecture | Gate transitional layer in 7 files; no accepted boundary |

---

## Recommendation

### Propose two new slices

**Slice 15 — Payroll + Authority Gate Compliance**
Covers: ADR-0057, ADR-0099, ADR-0110, ADR-0111, ADR-0114, ADR-0117, ADR-0189, ADR-0190, ADR-0195, ADR-0207, ADR-0292, ADR-0293, ADR-0294
Method: grep `callGateAction` call sites for wrapper bypass; verify payroll schema separation in migrations; spot-check `gate_action` direct callers; verify PDF footer/header strings; verify supersession-chain increment.

**Slice 16 — Orphan-Proposed Acceptance Gate**
Covers: ADR-0151 (194 refs), ADR-0173/0175/0176 (journey model), ADR-0242/0243/0244 (contract/payroll split), ADR-0287, ADR-0295 (feriepenger)
Method: for each, verify whether implementation matches proposed spec; flag acceptance-blocking divergences; recommend accept-or-close for stale proposed ADRs.

### Immediate action: ADR-0151

ADR-0151 (stage-engine profile_id re-derive) is the highest-risk orphan: **194 files** reference it, it is still `proposed`, and the underlying security invariant (do not trust body-supplied `profile_id`) is in the "What NOT To Do" section of CLAUDE.md as a hard rule. Slice 01 covers this ADR in its cluster definition but coverage should be verified; if slice 01 already validates it, no new action. If not, it belongs in Slice 15 as the top priority item.
