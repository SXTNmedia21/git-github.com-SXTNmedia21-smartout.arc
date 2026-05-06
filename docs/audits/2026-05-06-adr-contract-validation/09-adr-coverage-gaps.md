---
title: "Audit Slice 09 — ADR Coverage Gaps"
status: done
created: 2026-05-06
updated: 2026-05-06
module: meta
tags: [audit, adr, decision-log, coverage, gap-analysis]
---

# Slice 09 — ADR Coverage Gaps

**Auditor:** Slice 09 (gap-fill)
**Date:** 2026-05-06
**Scope:** `docs/decisions/` — all 283 ADR files + decision log integrity

---

## Summary Counts

| Metric | Count |
|--------|-------|
| ADR files on disk | 283 |
| Unique ADR numbers in log table rows | 269 |
| ADR files not in log table | 14 (excl. 0000) |
| ADR files with duplicate log entries | 21 |
| Number gaps in sequence | 3 (0092, 0159, 0232) |
| `proposed` ADRs | 61 |
| `proposed` >44 days old (stale) | 2 |
| `status: Accepted` (wrong case) | 13 |
| `status: live / done / derived / canonical` (non-standard) | 4 |

---

## HIGH Findings — Accepted ADR Contradicted by Code or Log

### H-01 — ADR-0259 Capability Name Conflicts with ADR-0249 + Migration

**Severity: HIGH**

ADR-0259 (`0259-lovsen-capability-authority-c4-seed.md`, status: `accepted`) declares the C4 authority seed uses `capability='industry_intelligence.lovsen_query'`. The actual migration `20260520130000_legal_capability_authority_seed.sql` inserts `capability='legal'`. ADR-0249 confirms the capability is registered as `'legal'`, not `'industry_intelligence.lovsen_query'`.

- ADR-0259 body references: `'industry_intelligence.lovsen_query'`
- Migration + ADR-0249 reality: `'legal'`
- Code impact: if any consumer resolves `gate_action` against `'industry_intelligence.lovsen_query'`, it falls through to default-allow (L-0066 CVE class)

**Claimed vs Reality:**
ADR-0259 is `accepted` but its stated capability name does not match the shipped migration or the ADR-0249 capability registration. Either ADR-0259 was written against an earlier naming convention (before `legal` was chosen), or ADR-0249 supersedes it without a formal supersession link.

---

### H-02 — ADR-0122 Governance Telemetry — 6 of 7 Events Unregistered

**Severity: HIGH**

ADR-0122 (`0122-governance-telemetry-quad-destination.md`, status: `proposed`) mandates 7 governance events (`policy created`, `policy updated`, `policy archived`, `protocol created`, `protocol updated`, `procedure created`, `protocol assignment updated`) all registered in `packages/telemetry/src/registry.ts` with quad-destination routing.

Registry check:
- `"policy created"`: 2 occurrences (registered)
- `"policy updated"`: 0
- `"policy archived"`: 0
- `"protocol created"`: 0
- `"protocol updated"`: 0
- `"procedure created"`: 0
- `"protocol assignment updated"`: 0

Only 1 of 7 governance events is registered. ADR-0122 is still `proposed` so this is a confirmed non-implementation, not a drift. But it remains unblocked since 2026-04-17 (19 days) with no progress. Every governance mutation (`use-governance-mutations.ts`) emits `"button clicked"` → PostHog only; zero audit trail, zero event engine triggers for governance state changes.

---

### H-03 — ADR-0265 Accepted but Missing Log Table Row

**Severity: HIGH**

ADR-0265 (`0265-enforced-deployment-pipeline.md`, status: `accepted`) is the canonical deployment pipeline ADR referenced throughout CLAUDE.md, the deploying skill, and multiple other ADRs. It exists only in a comment in the log header (`<!-- ADR-0265 registered 2026-05-03 ... -->`), with zero table row. The log table has no `| [ADR-0265]...` entry.

This is the authoritative deployment ADR — referenced by ADR-0275, ADR-0277 — and its absence from the searchable log table means automated integrity checks and grep-based cross-reference fail to find it.

---

### H-04 — ADR-0240 Journey-Authoring Still Writes journey + journey_version Directly

**Severity: HIGH**

ADR-0240 (`0240-journey-authoring-tool-boundary.md`, status: `proposed`) mandates that `publishDraftTool` delegate journey/journey_version writes to the `journey.publish_mission` capability. Audit of `packages/ai/src/capabilities/journey-authoring/tools.ts`:

- Line 483: `.from("journey")` — direct insert
- Line 509: `.from("journey_version")` — direct insert
- Line 452 comment: "Note (ADR-0240 follow-up): journey + journey_version writes are [still direct] — verified 2026-05-02 audit slice 1"

The code comment confirms the violation was known at last audit (2026-05-02) and is still open. The direct writes are wrapped in `gatedMutation()` (ADR-0204 compliant) but cross-namespace boundary (ADR-0173 frozen-4 + ADR-0240 delegation rule) is violated. ADR-0240 is `proposed` — this is a confirmed pending gap not a regression.

---

## MEDIUM Findings — Log Inconsistencies and Stale Proposals

### M-01 — 21 ADRs Have Duplicate Table Rows in Decision Log

**Severity: MEDIUM**

The following 21 ADRs appear as two separate table rows in `0000-decision-log.md`, typically one row showing `proposed` and one showing `accepted`:

`0041, 0085, 0099, 0101, 0107, 0108, 0134, 0151, 0156, 0157, 0158, 0171, 0172, 0173, 0174, 0175, 0176, 0177, 0271, 0272, 0273`

Example (ADR-0151):
- Row 195: `accepted` with full harness-hardening amendment
- Row 196: `proposed` (original entry never removed)

The pattern is consistent: original `proposed` row was never deleted when the ADR was promoted to `accepted`. Any log consumer that reads row-by-row may surface the stale status. The log is correct on the file level (file frontmatter = `accepted`) but the table is misleading.

---

### M-02 — 10+ Accepted ADRs Not in Log Table (Orphan Files)

**Severity: MEDIUM**

ADRs with `accepted` status in file frontmatter but no `| [ADR-XXXX]...` table row:

| ADR | Title | Status in file |
|-----|-------|---------------|
| ADR-0151 | Stage-engine profile_id server derivation | accepted (but duplicate row exists) |
| ADR-0168 | (not found via grep) | accepted |
| ADR-0169 | (not found via grep) | accepted |
| ADR-0179 | Browser-Originated Mutations Route Through Next.js Route Handlers | accepted |
| ADR-0180 | Engine Event Parity Contract for Telemetry | accepted |
| ADR-0192 | capability_default_registry + bootstrap trigger pattern | accepted |
| ADR-0265 | Enforced Deployment Pipeline | accepted |

ADR-0179 and ADR-0180 appear only in the log's historical changelog section ("Wave H") but have no table row. ADR-0265 is comment-only. ADR-0168, 0169, 0192 have no presence in the log table at all.

---

### M-03 — ADR-0218 Partial Implementation (Dual-Write on Signup Only)

**Severity: MEDIUM**

ADR-0218 (`proposed`) requires wizard dual-write to both `company_opening_hours` AND `workspace_operating_hours`. The `/join` flow implements this at `apps/web/src/app/join/_lib/setupActions.ts:283-292`. However ADR-0218 is still `proposed` — no code exists for the `/onboarding` (legacy) wizard path. No mention of `workspace_operating_hours` in `apps/web/src/app/onboarding/`. One of two write paths is implemented; the ADR is not accepted.

---

### M-04 — ADR-0053 Stale Proposed (44+ Days, No Code)

**Severity: MEDIUM**

ADR-0053 (`0053-simulation-schema-and-simulator-service.md`, created 2026-03-23, status: `proposed`) describes a `simulation` schema + `services/simulator/` Hono microservice. No `services/simulator/` directory exists. No `simulation` schema found in migrations. This ADR has been proposed for 44 days with zero code progress. It predates the cascade E2E work by a month. Should be marked `draft` or `archived` if not being pursued.

---

### M-05 — 13 ADRs Use `status: Accepted` (Wrong Case)

**Severity: MEDIUM (LOW impact)**

13 files use `status: Accepted` (capitalized) instead of the canonical `status: accepted` (lowercase). Tools that grep for `^status: accepted` will miss these. Affected files include `0020, 0017, 0029, 0026, 0027` and 8 others.

---

## LOW Findings

### L-01 — 3 Sequence Gaps Are Documented

**Severity: LOW (already handled)**

- ADR-0092: reserved slot ("Monitor Mode Graduation Criteria") — log notes it
- ADR-0159: reserved + never used (2026-04-19 kanaler renumber) — log has placeholder row
- ADR-0232: renumbered to 0236 — log entry for 0236 notes the renumber

All three are documented. Not an integrity failure; confirm reserved/renumbered slots are intentional.

---

### L-02 — Non-Standard `status` Values

**Severity: LOW**

4 files use non-standard status values: `live` (1), `done` (1), `derived` (1), `canonical` (1). The canonical values from `docs/templates/decision.md` are `draft | proposed | accepted | superseded`. These files should migrate to standard values for consistent tooling.

---

### L-03 — ADR-0115 NordicSkeleton Export Missing

**Severity: LOW (baseline carry-forward)**

ADR-0115 references `NordicSkeleton` as a required component for the RSC migration pattern. No export of `NordicSkeleton` found in `packages/ui/` or `apps/web/src/`. This is a known baseline finding (2026-05-02). The ADR is `accepted` — the referenced artifact does not exist.

---

## ADR Conflict Table

| ADR | Claimed | Reality | Severity |
|-----|---------|---------|----------|
| ADR-0259 | capability=`'industry_intelligence.lovsen_query'` | Migration uses `'legal'` (ADR-0249 naming) | HIGH |
| ADR-0122 | 7 governance events quad-routed | 1 of 7 registered (6 missing) | HIGH |
| ADR-0265 | Accepted, canonical deploy ADR | No log table row | HIGH |
| ADR-0240 | Delegates journey+journey_version writes | Still writes directly (gated but cross-namespace) | HIGH |
| ADR-0218 | Dual-write both wizards | Only `/join` wizard writes `workspace_operating_hours` | MEDIUM |
| ADR-0115 | NordicSkeleton component exists | Export not found in packages/ui or apps/web | LOW |
| ADR-0041 | superseded (file correct) | Duplicate table row shows old proposed entry | MEDIUM |
| ADR-0151 | accepted (file correct) | Duplicate table row shows stale proposed entry | MEDIUM |

---

## Delta from 2026-05-02 Baseline

| Baseline Finding | Status Now |
|-----------------|------------|
| ADR-0151, 0168, 0169, 0192 accepted in code but log says proposed | **CONFIRMED** — 0168, 0169, 0192 still missing from log table; 0151 has duplicate row (accepted + proposed) |
| ADRs 0190, 0195, 0196, 0197, 0204 listed twice in log | **CONFIRMED** — now identified as 21 ADRs with duplicate rows total |
| ADR-0041 accepted but obsolete architecture | **RESOLVED** — file now `status: superseded` with explicit note |
| ADR-0115 NordicSkeleton not exported | **UNRESOLVED** — no export found |
| ADR-0122 only 1 of 7 governance events registered | **UNRESOLVED** — still 1/7 |
| ADR-0139 PendingBadge + color-proposed zero presence | **CONFIRMED** — no code presence found |
| ADR-0218 dual-write only on signup completion | **PARTIALLY RESOLVED** — `/join` path implemented, but ADR still proposed |
| ADR-0240 journey-authoring writes journey/journey_version directly | **UNRESOLVED** — still direct writes, note in code confirms known gap |
| ADR-0259 capability='legal' vs 'industry_intelligence.lovsen_query' | **CONFIRMED NEW** — naming conflict between ADR-0259 and ADR-0249 + migration |
| ADR-0260 Cabinet Grotesk swap not done | **CONFIRMED** — ADR is `proposed`, no code presence |

**Net new findings this slice:** ADR-0265 missing from log table (HIGH); 21 duplicate log rows (vs 8 baseline); ADR-0259 vs ADR-0249 capability name conflict; ADR-0053 stale for 44+ days; 13 wrong-case status values.
