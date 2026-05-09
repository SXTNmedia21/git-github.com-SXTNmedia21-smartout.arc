---
title: "Framework Rule Evaluation Config JSON Schema"
id: ADR-0090
status: accepted
layer: decision
created: 2026-04-14
updated: 2026-04-14
module: cascade
tags: [adr, cascade, c4-governance, framework-rule, evaluation, phase-e]
---

# ADR-0090: Framework Rule Evaluation Config JSON Schema

## Context and Problem Statement

Phase E of the cascade foundation delivers the C4 Governance control plane. `framework_rule.evaluation_config` is a `JSONB` column that already exists in production (`20260421200100_cascade_a2_framework_tables.sql`) and is populated by the hospitality framework seed, but the platform has no evaluator — the data is dormant. WP2 (preview pipeline), WP3 (governance gate in TanStack mutations), WP4 (change-proposal generation) and WP6 (authority-aware UI) all block on a deterministic, auditable way to evaluate a rule against proposed data and emit an `evaluation_outcome`.

We must pick a representation for `evaluation_config` that the platform can evaluate, document, and round-trip through review tooling — **before** any consumer wires into it, because once the seeds and UIs assume a shape, the shape is contractual.

## Decision Drivers

- **Deterministic + auditable:** same input always produces the same outcome; outcome is explainable in the audit trail (ADR-0004 telemetry) without replaying code.
- **No new runtime:** WP1 must ship in TypeScript that runs in Next.js server components, Edge Functions, and `@smartout/data` consumers. Adding OPA/Rego now means spinning up a sidecar, distributing a policy bundle, and bifurcating the codepath between "rules we can evaluate" and "rules we can't" — unacceptable for a P0 foundation.
- **Matches the prior art in the repo:** `supabase/functions/engine-dispatch/index.ts` already evaluates a small condition grammar (`match`, `all`, `any`, `match_state`) inline. `packages/ai/src/engine/condition-evaluator.ts` mirrors it. A third grammar would be worse than reusing the shape already in developers' heads.
- **Future-proofable:** if we ever graduate to Rego/OPA (see Module 14 / training curriculum), the typed condition tree is a straightforward compile target. We are not burning a bridge — we are postponing it until we have evidence we need it.
- **Type-safe at module boundary:** the engine is in `@smartout/data` and is consumed by typed call sites; the schema must produce a TypeScript type via `z.infer<>`.

## Considered Options

1. **Typed condition tree (chosen)** — a discriminated union of `Condition` nodes (`all`, `any`, `not`, `equals`, `threshold`, `in`, `exists`) wrapped by an outer envelope (`condition`, `outcome_if_match`, `outcome_if_no_match`, `exception_reason`). Validated at the module boundary with Zod, evaluated by a pure function.
2. **Rego / OPA policy bundles** — write each rule as a Rego policy, ship a policy bundle to a colocated OPA sidecar, evaluate via HTTP or WASM.
3. **JSONLogic** — use the existing jsonlogic.com grammar and reference implementation.
4. **Free-form JSONB + per-rule TypeScript evaluators** — each rule ships a code path; no schema.

## Decision Outcome

Chosen option: **"Typed condition tree"**, because it satisfies every Phase E driver with the least new surface area. The evaluator is a pure function in `@smartout/data/cascade`, the shape is validated by a Zod schema at the module boundary, and the grammar is a direct typed extension of the `match` / `all` / `any` combinators already used by `engine-dispatch`. Rego/OPA is rejected for now because it adds infrastructure (sidecar, bundle distribution, dual codepath) that WP1 does not need and cannot justify; JSONLogic is rejected because it is under-typed for our use case and ships a larger grammar than we need; free-form JSONB is rejected because it makes every rule a code change and kills auditability.

### Schema (canonical)

```ts
type EvaluationOutcome =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

type Condition =
  | { type: "all"; conditions: Condition[] }
  | { type: "any"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
  | { type: "equals"; path: string; value: unknown }
  | { type: "threshold"; path: string; op: "gt" | "gte" | "lt" | "lte"; value: number }
  | { type: "in"; path: string; values: unknown[] }
  | { type: "exists"; path: string };

type EvaluationConfig = {
  condition: Condition;
  outcome_if_match: EvaluationOutcome;
  outcome_if_no_match?: EvaluationOutcome; // default: "allowed"
  exception_reason?: string;                 // human-readable, surfaced in audit trail
};
```

### Path grammar

- Paths are dotted, rooted in `EvaluationContext`, e.g. `proposed_data.hourly_rate`, `current_data.status`, `entity_type`, `action`.
- Missing paths resolve to `undefined` — conditions evaluate to `false`, they never throw. This is a deliberate safety property: a malformed rule cannot crash the engine.

### Aggregation

- `evaluateFrameworkRules()` returns the **most restrictive** outcome across all matched rules:
  `blocked` > `review_required` > `allowed_with_exception` > `allowed`.
- Rules that fail Zod parsing are skipped and logged; the engine continues. A broken rule MUST NOT brick the platform.

## Rules & Consequences

- **Good, because** the engine is a pure function — trivially unit-testable, callable from Next.js server code, Edge Functions, and React Native without adapters.
- **Good, because** the grammar is small enough for a non-developer to read a seeded rule and know what it does, satisfying the code-readability mandate in `CLAUDE.md`.
- **Good, because** every outcome is explainable: the aggregated result carries per-rule `EvaluationResult` entries that feed directly into `activity_trail` and `change_proposal.reason`.
- **Bad, because** we cannot express rules that require set algebra beyond `in`, arithmetic across fields, or external lookups. When we hit that ceiling (expected around WP5 pricing rules), we either extend the grammar or introduce Rego — whichever matches the scope.
- **Bad, because** a typed condition tree is slightly more verbose than JSONLogic for the rule author. Mitigated by the fact that rules are authored by the platform team, not customers, and live in seeds / admin UIs, not hand-edited JSON.
- **Agent Impact:**
  - Seeds that write `framework_rule.evaluation_config` MUST conform to `EvaluationConfigSchema` (exported from `@smartout/data/cascade`). The hospitality seed will be migrated in WP2 alongside the preview pipeline.
  - Any new cascade work that needs to evaluate a `framework_rule` MUST go through `evaluateFrameworkRules()` — no local re-implementations. If the grammar is insufficient, extend the schema + evaluator + tests in one change.
  - C4 Governance callers treat `final_outcome` as permission, never as belief. C1 (calibration, `daily_reconciliation`) still determines whether the system is *confident*; C4 determines whether it is *authorized*. This ADR does not change that boundary — it only gives C4 a runtime.

---

> Registered in `docs/decisions/0000-decision-log.md`.
