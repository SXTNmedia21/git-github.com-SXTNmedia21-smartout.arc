---
title: "Framework Rule Severity as Enum"
id: ADR_0094
status: accepted
layer: decision
created: 2026-04-14
updated: 2026-04-14
module: cascade
tags: [adr, cascade, c4-governance, framework-rule, enum, phase-e]
---

# ADR-0094: Framework Rule Severity as Enum

## Context and Problem Statement

`framework_rule.severity` is currently a `TEXT` column. The hospitality seed populates it with strings such as `hard_block`, and WP1's evaluator (`packages/data/src/cascade/evaluate-rules.ts`) types it as `severity: string`. No contract describes which strings are legal or how they relate to `evaluation_outcome`. Two consumers are already on a collision course:

- WP1 surfaces `severity` verbatim in `EvaluationResult.severity`, where it will end up in audit logs and admin UIs.
- WP3's governance gate needs to derive a `change_proposal.approval_required` from severity; it has no typed map to work from.

Leaving this as `TEXT` is the exact anti-pattern called out in `CLAUDE.md` ("Never create enums without checking `database.types.ts`"). The council explicitly required this be resolved before WP2 starts, because WP2 writes the aggregation logic that consumes severity.

## Decision Drivers

- **Typed at module boundary:** `packages/data` owns the evaluator. A string-typed field forces every downstream consumer to re-parse; an enum forces the parse once at the database.
- **Documented mapping:** the current implicit mapping — `hard_block → blocked`, everything-else → ??? — is not discoverable. Phase E needs one written mapping, registered in the ADR, enforced in code.
- **Migrate WP1's shipped artifact:** WP1 is already merged (three commits, 23 tests green). The retrofit to `severity: RuleSeverity` must land before WP2 touches the aggregator, not after.
- **Minimum surface area:** three levels cover the existing seed behaviour (`info`, `warning`, `hard_block`). More levels mean more dispatch cases and more arguments with product about granularity we don't need yet.

## Considered Options

1. **Enum `rule_severity` with three values `info | warning | hard_block` (chosen)** and a documented mapping to `evaluation_outcome`.
2. **Enum aligned 1:1 with `evaluation_outcome`.** `severity` becomes `allowed | allowed_with_exception | review_required | blocked`.
3. **Keep TEXT, add a check constraint.** Legal values enforced in-DB but not typed in TS.
4. **Drop the column, derive severity from `default_outcome` + the evaluation result.**

## Decision Outcome

Chosen option: **"Enum `rule_severity` with three values"**, because severity is conceptually distinct from outcome — severity describes the rule's *weight*, outcome describes the gate's *response*. Collapsing them (option 2) loses the distinction between "this rule is a soft warning whose outcome is `review_required`" and "this rule is a hard block whose outcome is `review_required`". Option 3 (TEXT + check) leaves WP1 typed as `string`, which is what we are specifically trying to fix. Option 4 removes information the admin UI needs to render rule lists sensibly.

Three levels match the three things the platform actually does with severity: log it (`info`), flag it for admin attention (`warning`), or refuse (`hard_block`). Additional levels can be added later; the enum is ordinal, and additions are backwards compatible if appended.

### Schema

```sql
create type public.rule_severity as enum ('info', 'warning', 'hard_block');

alter table public.framework_rule
  alter column severity type public.rule_severity
    using severity::public.rule_severity;

alter table public.framework_rule
  alter column severity set default 'info';
```

Seed data currently uses `hard_block`; other rows default to `info`. The `UPDATE` is implicit via the `USING` cast. Migration timestamp: the migration that ships with the WP1 retrofit commit, ahead of WP2.

### Mapping to `evaluation_outcome`

When a framework_rule matches, the aggregated `final_outcome` in `evaluate-rules.ts` is determined by `outcome_if_match` (from `evaluation_config`), not by severity alone. Severity is the **fallback** and the **telemetry dimension**:

| `severity`   | If the rule matches but has no `outcome_if_match` | Intended operational meaning                                     |
|--------------|---------------------------------------------------|------------------------------------------------------------------|
| `info`       | `allowed_with_exception`                          | Audit it, don't block. Shows up in drift reports.                |
| `warning`    | `review_required`                                 | Admin approval required. The proposal is created automatically.  |
| `hard_block` | `blocked`                                         | Reject the write. Non-retryable through normal channels.         |

`evaluation_config.outcome_if_match` remains the authoritative outcome when specified. Severity is the default and the index into audit/admin UI classification. This separation is what option 2 would have eliminated.

### WP1 retrofit

`packages/data/src/cascade/evaluate-rules.ts` changes in one commit, shipped before WP2:

```ts
// Before
export type FrameworkRule = {
  rule_id: string;
  code: string;
  severity: string;              // ← here
  default_outcome: EvaluationOutcome;
  evaluation_config: unknown;
};

// After
export type RuleSeverity = 'info' | 'warning' | 'hard_block';

export type FrameworkRule = {
  rule_id: string;
  code: string;
  severity: RuleSeverity;        // ← typed
  default_outcome: EvaluationOutcome;
  evaluation_config: unknown;
};

export type EvaluationResult = {
  rule_id: string;
  outcome: EvaluationOutcome;
  severity: RuleSeverity;        // ← typed
  reason?: string;
};
```

The evaluator's fallback logic (when a config parses but has no `outcome_if_match`) gains the mapping table above. Existing 23 tests remain green; new tests cover the severity-mapping fallback. The retrofit is its own commit (separate from the enum migration commit) and lands on `development` before WP2 branches.

## Rules & Consequences

- **Good, because** severity stops being a free-form string. Seeds that drift ("critical", "fatal") fail at insert, not at the next reader.
- **Good, because** the admin UI (WP4) can render severity badges from a known-three-element set — no "unknown severity" state.
- **Good, because** the fallback mapping is documented in one place (this ADR) and referenced by `evaluate-rules.ts`.
- **Bad, because** the existing `TEXT` column requires a migration with a cast. Low risk — the only non-null values in production today are `hard_block` — but still a one-time coordination event.
- **Bad, because** WP1 must be retrofitted before WP2. That is the council's explicit sequencing requirement, and it costs ~1 commit to honour, so this is mild pain, not a blocker.
- **Agent Impact:**
  - Seeds that write `framework_rule` MUST use one of the three enum values. New severities require an ADR + migration; extending the enum is append-only.
  - WP1's evaluator exports `RuleSeverity`. Downstream consumers import it; no more `severity: string` in module signatures.
  - `change_proposal.approval_required` derivation (WP2) reads from the mapping above, not from bespoke logic per call site.
  - A future promotion to `critical` or `advisory` requires (a) a migration that appends the value, (b) an update to the mapping table above, (c) an ADR amendment registered in the decision log.

---

> Registered in `docs/decisions/0000-decision-log.md`.
