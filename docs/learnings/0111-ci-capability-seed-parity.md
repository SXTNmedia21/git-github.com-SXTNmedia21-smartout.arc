---
title: "CI Must Enforce Capability Literal ↔ Seed-Migration Parity via AST, Not Regex"
id: LEARNING_0111
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [ci, authority, gate-action, ast, ts-morph, static-analysis, daily-operation, council]
---

# Learning-0111: CI Capability Seed Parity

## Context

Following Learning-0107's discovery of the un-seeded `reconciliation.override` capability, Council 2 escalated the question: how many other call sites have the same problem? A grep for the substring `gate_action` across the repo returned 58 source-file hits. Too noisy to verify manually, and regex is the wrong tool — many hits are comments, imports, type annotations, or the string appearing in a SQL migration (not a TypeScript call site).

agent-coord ran a `ts-morph` AST walk instead. For every `*.ts` / `*.tsx` file under `apps/`, `packages/`, and `supabase/functions/`, the walker visited every CallExpression, filtered to identifier-name `gateAction` or `gate_action`, extracted the first argument's `capability:` property, and collected only string-literal values. The result: **exactly 8 call sites in production TypeScript** — seven seeded, one (`reconciliation.override`) missing.

The same task with grep would have either under-counted (missing template-literal or computed-property call sites) or wildly over-counted (catching every substring occurrence). The difference between "58 mentions" and "8 call sites" is why L-0059 and L-0054 keep flagging grep-based inventories as unreliable. AST extraction is the scalable answer for enforcing contracts between string literals and external artifacts.

## Discovery

A static-analysis check for capability-seed parity has a simple shape that generalizes to any "call-site literal must appear in another file" contract:

1. **Side A — call sites:** `ts-morph` Project walks TypeScript files, filters CallExpressions by identifier name, extracts property-assignment values where the value kind is `StringLiteral`. Output: set of `(capability_literal, file, line)`.
2. **Side B — seed migrations:** SQL parser (or regex on `INSERT INTO engine_authority_config` with column-order awareness) walks migration files, extracts capability column values. Output: set of `capability_literal`.
3. **Diff:** Any literal in A not in B fails the check with a "capability call site without seed" error. Any literal in B not in A produces a warning ("seeded capability with no call site — dead seed or upcoming feature").
4. **Dynamic call sites:** Capabilities assembled from template literals or computed at runtime are not seedable mechanically. Those require an explicit call-site annotation (`/* @authority-gate-ungated */`) that is logged for periodic review. No silent exceptions.

Why AST over regex:

- Regex `gate_action\(` misses `gateAction({ capability: \`x.${kind}\` })` (template literal), misses `const fn = gateAction; fn({...})` (aliased call), and catches comments like `// uses gate_action`. All three showed up in the 58-match grep.
- `ts-morph` gives type-aware access to the AST. Property-assignment extraction is ~20 lines of code; the walker is idempotent and fast (<2s across the monorepo).
- CI integration: a GitHub Actions step runs `pnpm tsx scripts/authority-seed-parity.ts` and exits non-zero on missing seeds. Registered as a required check on `main` and `preview` rulesets alongside the existing 11 checks.

The output format is diagnostic, not terse:

```
FAIL: capability "reconciliation.override"
  referenced: apps/web/src/app/dashboard/reconciliation/_actions/override-reconciliation-action.ts:68
  seeded in:  (no migration found)

PASS: 7 capability literals, 7 seeds found
```

This makes the failure self-describing — the reviewer doesn't need to cross-reference two files to know what's missing.

## Impact

- **ADR-0189 (proposed, this council):** `scripts/authority-seed-parity.ts` using `ts-morph`, wired as a required CI check on `main` + `preview`. Blocks any PR that adds a capability literal without a matching seed INSERT.
- **Dynamic-string escape hatch:** `/* @authority-gate-ungated */` annotation on the specific CallExpression. Script collects these into a weekly report filed to the heartbeat channel. No silent bypass.
- **Generalization:** Same AST pattern applies to other literal ↔ artifact contracts in the repo:
  - Telemetry event names referenced in `emit()` vs registered in `packages/telemetry/src/registry.ts` (extends L-0041 / L-0083).
  - Capability literals in agent-router vs registered in `packages/ai/src/capabilities/registry.ts` (extends L-0034).
  - Feature-flag keys in `useFlag()` vs seeded in `feature_flag` table.
- **Regex-inventory rule:** Any council claim of the form "N sites use X" where X is a call-site contract MUST be verified by AST extraction before acceptance. Grep-count is a hypothesis, not evidence. Extends L-0054 and L-0059.
- **Follow-up audit:** Run the script retroactively against the full repo and file a ticket for each dead seed (capability with no call site). Early pass suggests 2-3 orphans — same class of bug as L-0061 (orphan capability code).

## References

- ADR-0189 (proposed — CI capability seed parity check)
- Learning-0107 (authority appearance ≠ presence — the discovery that motivated this check)
- Learning-0110 (DB triggers must gate — `min_role='system'` literals are also in scope)
- Learning-0054 (grep-based site inventories inflate scope — prior occurrence of the same methodology gap)
- Learning-0059 (grep-count briefings undercount without code-trace — symmetric inverse)
- Learning-0061 (orphan capability code — related "seeded but not called" class)
- `scripts/authority-seed-parity.ts` (to be added in ADR-0189 implementation)
- Council 2 verdict, 2026-04-22 daily-operation session

---

> Registered in `docs/learnings/0000-learning-log.md`.
