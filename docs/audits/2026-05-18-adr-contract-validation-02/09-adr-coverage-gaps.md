---
title: "Slice 09 — ADR Coverage Gaps"
status: done
updated: 2026-05-18
created: 2026-05-18
module: audit
tags: [adr, coverage, gap-analysis]
---

# Slice 09: ADR Coverage Gaps

## Scope

Gap-fill audit for `docs/decisions/`. Covers ADRs not already addressed by slices 01–08 and 10–14.

---

## Total ADR Landscape

| Metric | Count |
|--------|-------|
| Unique ADR numbers referenced in decision log | 371 |
| ADR files on disk (`docs/decisions/`) | 374 (includes 0000 index) |
| Covered by slices 01–08 + 10–14 | ~64 unique IDs |
| Uncovered (excluding 0000 meta) | ~308 |

Note: "uncovered" means not explicitly listed in the inter-slice ADR map. Most are well-referenced and healthy; this slice samples for validity.

---

## Known Gaps in File Sequence

Four ADR numbers have no corresponding file:

| Slot | Disposition |
|------|-------------|
| 0092 | Reserved — "Monitor Mode Graduation Criteria (Phase E / WP6)", not yet written |
| 0159 | Reserved — slot skipped during 2026-04-19 kanaler-som-helpdesk mid-session renumber per L-0084 |
| 0232 | Renumbered to ADR-0236 at close-feature (3rd cross-branch collision that session) |
| 0322 | Undocumented gap — no file, no decision-log row, no cross-reference found |
| 0368 | Reserved per CLAUDE.md ("gap at 0368 — reserved") |

**Finding F-09-01 (LOW):** ADR-0322 has no file, no log entry, and no cross-reference. Unlike 0092/0159/0368, it is not documented as reserved. Likely a numbering collision that was renumbered without a note. Should be documented as "reserved/renumbered — do not reuse" in the decision log to close the gap.

---

## Sample Verification: 10 Uncovered ADRs

Ten ADRs sampled across the full range to confirm file existence + live code references.

| ADR | Title | Files Referencing (outside decisions/) | Status |
|-----|-------|---------------------------------------|--------|
| ADR-0001 | Adopt Turborepo & pnpm Workspaces | 53 | healthy |
| ADR-0021 | Subdomain-Based Workspace Routing | 39 | healthy |
| ADR-0075 | Knowledge System Consolidation (DASHBOARD/SESSION) | 32 | healthy |
| ADR-0099 | Unified Authority-Gate (agent-router + engine-dispatch) | 516 | healthy — most-referenced ADR in codebase |
| ADR-0112 | Intent Classifier Coverage Invariant | 47 | healthy |
| ADR-0163 | ADR-0078 amendment — allowedChannels mandatory for PII capabilities | 135 | healthy |
| ADR-0213 | Campaign-PRs use merge-commit, not squash | 33 | healthy |
| ADR-0265 | Enforced Deployment Pipeline | 75 | healthy |
| ADR-0298 | Task Ontology — Five Sources, One Read Surface, One Capability | 133 | healthy |
| ADR-0340 | Shift Lifecycle Pipeline V2 | 39 | healthy |

All 10 sampled ADRs have files on disk and multiple live code references. Zero orphaned or zero-reference cases found in the sample.

---

## Superseded ADRs Audit

Eight ADRs carry `status: superseded` in frontmatter:

| ADR | Superseded By | Live Refs (outside decisions/) | Risk |
|-----|---------------|-------------------------------|------|
| 0035 | Docker infra consolidation (ADR-0039) | unknown | LOW |
| 0041 | Journey content refactor (ADR-0304 cleanup sortie) | 29 | MEDIUM — refs exist in HANDOFF + plan files only; no live code imports found in audit |
| 0046 | Block-based landing superseded | unknown | LOW |
| 0055 | Two-Vault isolation (note: superseded ADR itself; current vault rules live in secrets-protocol) | unknown | LOW |
| 0145 | OAuth token storage superseded | unknown | LOW |
| 0146 | Peppol/Tickstar (billing integration shelved) | unknown | LOW |
| 0147 | `integration_poll_payments` as separate engine_process | 5 | LOW — refs in docs only |
| 0321 | Swap↔Marketplace Convergence V2 (self-superseded mid-design) | 14 | MEDIUM — see below |

**Finding F-09-02 (MEDIUM):** ADR-0321 (Swap↔Marketplace Convergence V2) is marked `status: superseded` but has 14 references in non-decisions code paths. `scripts/check-adr-superseded-live-refs.sh` does not exist. ADR-0304 mandates that superseded ADR code be deleted by close of sortie. A sweep should confirm those 14 references point to HANDOFFs/plans only (not live implementation code).

---

## High-Reference Uncovered ADRs Not in Any Slice

The following high-impact ADRs are not covered by any named slice and represent the most-referenced architectural contracts in the codebase. They warrant inclusion in future slice scoping:

| ADR | Title | Refs | Domain |
|-----|-------|------|--------|
| ADR-0099 | Authority-Gate cardinality | 516 | Agent / capability |
| ADR-0163 | allowedChannels PII gate | 135 | Channel/voice |
| ADR-0298 | Task ontology | 133 | Task system |
| ADR-0265 | Deployment pipeline | 75 | CI/CD |
| ADR-0112 | Intent classifier coverage | 47 | AI routing |
| ADR-0340 | Shift lifecycle V2 | 39 | Schedule |
| ADR-0341 | Calc-engine test oracle | 36 | Payroll |

---

## Summary

| Finding | Severity | Action |
|---------|----------|--------|
| F-09-01: ADR-0322 undocumented gap | LOW | Add "reserved/renumbered — do not reuse" row to decision log |
| F-09-02: ADR-0321 superseded with 14 live refs | MEDIUM | Run sister-sweep to confirm refs are docs-only; close with ADR-0304 pattern if any code found |

No HIGH or CRITICAL findings in this slice. The ADR registry is well-maintained: all sampled ADRs have files, the decision log index matches the file tree within documented exceptions, and reference counts confirm active use of architectural contracts.
