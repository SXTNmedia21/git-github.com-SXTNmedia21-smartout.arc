---
id: ADR_0343
title: "Authority Seed Parity Backlog Closure — Hybrid (Allowlist + 3 Governance Seeds)"
status: accepted
date: 2026-05-16
deciders: [pontus, claude-opus-4-7]
supersedes: []
superseded-by: []
related: [ADR_0189, ADR_0099, ADR_0195, ADR_0201, ADR_0204, ADR_0298]
tags: [authority, seed, gate, governance-content, parser-fix, single-word-allowlist]
---

# ADR-0343 — Authority Seed Parity Backlog Closure (Hybrid)

## Status

Accepted 2026-05-16.

## Context

`scripts/authority-seed-parity.ts` is the ADR-0189 CI gate: every `gateAction({ capability: "x" })`
literal in production code must have a matching `INSERT INTO engine_authority_config` row.
When no row exists `gate_action()` default-allows — a silent authority escape per
`supabase/migrations/20260505110000_unified_authority_gate.sql §4`.

A 2026-05-16 run on the `development` branch tip returned FAIL with 9 capabilities reported
as missing seeds: `contract`, `handbook_chapter`, `helpdesk_query`, `memory`,
`organization.update_department`, `payroll`, `policy`, `protocol`, `task`.

T0 scope verification (`docs/plans/scope-fix-authority-seed-parity.md`) cross-referenced every
flagged call site against existing migration files. Finding: **6 of 9 are already seeded**.
The script was rejecting their seed rows because `extractSeededCapabilities()` uses a
`DOTTED_RE` filter (`/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/`) that requires at least one
dot. Legacy single-word capability names never match this pattern, so six correct seed
migrations were silently ignored by the parser.

**Genuinely unseeded (3 capabilities):** `handbook_chapter`, `policy`, `protocol`.

A second parser gap: 6 pre-existing seed migrations use the INSERT...SELECT pattern instead
of the CROSS JOIN VALUES shape — Shape D in the extractor's taxonomy — and were also
undetected by the original parser.

ADR-0204 §SS-5 classifies un-seeded `gateAction` call sites as a HIGH backlog item (F-CT-01,
2026-05-16 audit). The 5-day open gap and CVE-class nature of default-allow required
closure in this sortie.

ADR-0195, ADR-0201, ADR-0298 grandfathered legacy single-word capability names before the
dotted convention was established. Renaming them to dotted form touches 31+ call sites,
6 seed migrations, and the IntentClassifier — high regression risk on production-shipped
capabilities; deferred to a follow-up sortie after Phase-3 stability.

## Decision

Six concrete changes shipped in commit `a203cc8a4`.

### 1. SINGLE_WORD_ALLOWLIST extension

`scripts/authority-seed-parity.ts` — the `accept()` predicate accepts a candidate if it
matches `DOTTED_RE` **or** appears in `SINGLE_WORD_ALLOWLIST`. The pre-existing list had 2
entries (`billing_query`, `helpdesk_query`). Extended with 7 legacy single-word caps:

```
contract, handbook_chapter, memory, payroll, policy, protocol, task
```

Allowlist grows from 2 to 9 entries. Dotted form remains required for all capabilities
introduced after this ADR.

### 2. CapabilityName union extension

`packages/ai/src/capabilities/types.ts` — added `"handbook_chapter"`, `"policy"`,
`"protocol"` to the `CapabilityName` union. These three were called via `gateAction()`
literals in Server Actions but absent from the union type, creating a latent TypeScript gap.
Docstrings reference ADR-0343.

### 3. Governance content seed migration

`supabase/migrations/20260616120000_seed_governance_content_authority.sql` — seeds 3
capabilities across all workspaces via CROSS JOIN, idempotent via
`ON CONFLICT (workspace_id, capability) DO NOTHING`. Pattern mirrors
`20260516100000_seed_reconciliation_authority.sql` (DO $$ block, godmode-user fallback,
RAISE NOTICE on fresh-DB exit).

| Capability | Level | min_role | Rationale |
|---|---|---|---|
| `handbook_chapter` | `confirm` | `manager` | Governance content; `/dashboard/governance` manager-gated at layout level |
| `policy` | `confirm` | `manager` | Compliance weight (HR/HACCP/safety); single-approver confirm prevents silent overwrite |
| `protocol` | `confirm` | `manager` | Training/compliance instructions consumed daily; manager owns team procedures |

### 4. Shape D parser

`scripts/authority-seed-parity.ts` — added Shape D extraction inside
`extractSeededCapabilities()`. Handles the pattern:

```sql
INSERT INTO [public.]engine_authority_config (...) SELECT w.workspace_id, 'cap', ...
FROM public.workspace w ...;
```

Used by 6 pre-existing seed migrations that do not use a `CROSS JOIN ... VALUES` clause.
Extraction is allowlist-gated (DOTTED_RE or SINGLE_WORD_ALLOWLIST) to avoid false positives
from non-capability string literals in WHERE clauses or COALESCE expressions. Activated when
the INSERT...SELECT has no CROSS JOIN keyword (Shape B already handled by the
CROSS JOIN VALUES path).

### 5. Test/fixture path exclusion

`scripts/authority-seed-parity.ts` — added `/__tests__/` and `/fixtures/` to
`IGNORE_PATH_SEGMENTS`. Test and fixture files may contain sentinel capability literals
(e.g. `"x"`, `"fake.cap"`) that are not production call sites and must not generate
required-seed entries.

### 6. @authority-gate-ungated annotation on thunk wrappers

7 `gateAction()` call sites are forwarder thunks: the capability literal is validated at the
caller, not at the thunk boundary. Annotated with `/* @authority-gate-ungated */` + a
rationale comment. The annotation is the ADR-0189 approved escape hatch for dynamic /
forwarded patterns; the parity script excludes annotated sites from the required-seed set.

Annotated files:
- `apps/web/src/app/dashboard/komm/_actions/gate-komm-action.ts`
- `apps/web/src/app/dashboard/help/_actions/page-takeover-gate-action.ts`
- `apps/web/src/app/api/marketplace/action/route.ts`
- `apps/web/src/app/api/mobile/marketplace/claim/route.ts`
- `packages/ai/src/capabilities/guardian/gate.ts`
- `packages/ai/src/capabilities/operations-intelligence/gate.ts`
- `packages/ai/src/capabilities/personal/gate.ts`

## Rationale

### Hybrid over full dotted-form rename

Renaming legacy single-word caps to dotted form touches 31+ `gateAction()` call sites,
6 seed migrations, and the IntentClassifier routing table. Regression risk on
production-shipped capabilities (contract, payroll) is high. ADR-0195/0201/0298 explicitly
grandfathered these names. Rename is deferred to a dedicated follow-up sortie.

### (confirm, manager) for governance content

`/dashboard/governance` is layout-gated at manager+ (UI-side guard). T0 rated MEDIUM
confidence on all three caps because no pre-gate role check exists in the Server Actions
themselves. `confirm` prevents silent overwrite of authoritative compliance text. `manager`
mirrors the layout guard. Pontus accepted the T0 recommendation directly; council
escalation bypassed given the operational (non-legal, non-financial) nature of governance
content authoring.

### Annotate thunk wrappers vs gate statically

The 7 thunk sites are forwarder functions in per-capability `gate.ts` files. The static
literal is verified at the caller (harness tool definition, komm dispatcher). Inserting
`gateAction()` statically inside the thunk would break gate composition in consumers that
forward through these thunks. The `@authority-gate-ungated` marker is the ADR-0189 approved
auditable escape hatch for this pattern.

### Shape D parser extension over seed-migration rewrite

6 pre-existing seed migrations use INSERT...SELECT. Rewriting them to CROSS JOIN VALUES
shape would touch production migration history without closing any real authority gap.
The correct fix is making the parser understand all real SQL patterns in the codebase.

## Consequences

### Positive

- `pnpm exec tsx scripts/authority-seed-parity.ts` exits 0 on `development` tip
  (verified post-commit `a203cc8a4`)
- F-CT-01 HIGH backlog item closed (5-day open)
- `handbook_chapter`, `policy`, `protocol` now have `engine_authority_config` rows —
  `gate_action()` enforces `confirm`/`manager` on these Server Actions
- No regression to the 6 caps that were parser false-positives
- Shape D parser closes a latent class of missed seeds for future INSERT...SELECT migrations

### Negative / Debt

- `SINGLE_WORD_ALLOWLIST` grew from 2 to 9 entries. Each entry is a permanent exemption from
  the dotted-form requirement until the cap is renamed.
- 7 thunk-wrapper sites carry `@authority-gate-ungated`. Reviews must confirm the
  caller-side literal remains a static string — dynamic capability construction would make
  the marker false.
- Shape D parser lacks exhaustive WITH-CTE edge-case coverage. CTEs wrapping an
  INSERT...SELECT are not detected. Low-risk today (no CTE seed migrations exist).

### Follow-up sorties

- **Dotted-form alignment**: rename legacy single-word caps after Phase-3 stability; trim
  allowlist entries as each cap migrates.
- **Allowlist growth gate**: CI check to block allowlist growth beyond current size without
  a new ADR documenting justification.

## Alternatives Considered

1. **Seed all 9 flagged capabilities with new migrations** — REJECTED. 6 of 9 already
   seeded; duplicate seeds clutter migration history without closing any gap. Root cause is
   a parser bug, not missing seed rows.

2. **Drop DOTTED_RE filter entirely** — REJECTED. Without the filter or a replacement
   allowlist, the extractor would accept string literals from non-seed SQL contexts (WHERE
   clauses, COALESCE, column defaults), producing false positives in the seeded set and
   masking genuine gaps.

3. **Rename all single-word capabilities to dotted form now** — REJECTED for this sortie.
   High regression risk on production-shipped capabilities; ADR-0195/0201/0298 grandfathered
   these names; the rename requires its own council review. Deferred.

4. **Council escalation on governance-content authority floor** — DEFERRED. Pontus
   accepted T0 recommendation directly. Governance content authoring carries no
   legal-binding or financial risk, making full council review disproportionate. If a future
   audit raises the floor, an ADR amendment adjusts the seed row.

## Verification

- [x] `pnpm exec tsx scripts/authority-seed-parity.ts` exits 0 on `feat/fix-authority-seed-parity`
      (verified against commit `a203cc8a4`)
- [x] Migration `20260616120000_seed_governance_content_authority.sql` idempotency confirmed
      (`ON CONFLICT ... DO NOTHING`; godmode-user fallback with `RAISE NOTICE`)
- [x] `CapabilityName` union in `packages/ai/src/capabilities/types.ts` includes
      `handbook_chapter`, `policy`, `protocol`; `pnpm --filter @smartout/ai typecheck` passes
- [x] Full repo typecheck: `pnpm turbo typecheck` exits 0
- [ ] Local Supabase apply: `pnpm exec supabase db push` + re-run parity script (T3 — manual)

## References

- T0 decision matrix: `docs/plans/scope-fix-authority-seed-parity.md`
- Feature plan: `docs/plans/PLAN-fix-authority-seed-parity.md`
- Seed pattern reference: `supabase/migrations/20260516100000_seed_reconciliation_authority.sql`
- Governance seed (this sortie): `supabase/migrations/20260616120000_seed_governance_content_authority.sql`
- Parity script: `scripts/authority-seed-parity.ts`
- CapabilityName union: `packages/ai/src/capabilities/types.ts`
- ADR-0189: seed-at-introduction principle
- ADR-0099: gate_action() as canonical enforcement point
- ADR-0195 / ADR-0201 / ADR-0298: legacy single-word name grandfathering
- ADR-0204: §SS-5 authority backlog classification (F-CT-01 source)
