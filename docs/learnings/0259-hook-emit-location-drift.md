---
title: "Hook-emit-location docstring drift — hook JSDoc claims emit in onSuccess, emit fires server-side in BFF"
id: L-0259
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [emit, telemetry, docstring, drift, L-0176-sibling, bff, hooks]
---

# L-0259: Hook-emit-location docstring drift

## The Trap

`apps/web/src/hooks/use-payroll-proposals.ts:14` JSDoc reads:
```ts
/**
 * Mutation hook for payroll proposal approval.
 * emit() called in onSuccess per ADR-0134.
 */
```

The actual `emit()` call fires server-side in `apps/web/src/app/api/payroll/approve-proposal/route.ts:262`, not in the hook's `onSuccess`. The contract IS met by delegation — but the JSDoc lies about WHERE the obligation is fulfilled.

## Why This Matters

The docstring claim "emit() called in onSuccess per ADR-0134" creates a false model for:
1. **Code reviewers** — looking for emit in the hook's onSuccess, finding nothing, concluding ADR-0134 is violated (false negative)
2. **Auditors** (adr-contract-audit) — scanning hook bodies for emit calls, missing server-side location, generating false finding
3. **Future authors** — pattern-matching the docstring, adding a duplicate emit in onSuccess, creating double-emit (real bug, L-0176 downstream consequence)

## The Rule

Hook JSDoc MUST accurately declare where emit fires:

```ts
// WRONG — emit is in BFF route, not here
/** emit() called in onSuccess per ADR-0134 */

// CORRECT — state the actual delegation
/**
 * Mutation hook for payroll proposal approval.
 * emit() fires server-side in /api/payroll/approve-proposal/route.ts (ADR-0134 fulfilled by BFF delegation).
 * Do NOT add a second emit here.
 */
```

If emit fires in onSuccess client-side:
```ts
/**
 * emit() called in onSuccess (client-side, PostHog + Logger destinations; activity_trail written server-side via BFF).
 * Per ADR-0134 + ADR-0186 4-destination routing.
 */
```

## Pattern Class: L-0176 Sibling

This is a narrower variant of L-0176 (docstring-vs-body drift for capability tools). L-0176 covers `packages/ai/src/capabilities/**` body vs docstring. L-0259 covers `apps/web/src/hooks/**` emit-location claims — same failure mode, different file namespace.

The distinction matters for auditors: adr-contract-audit scans capabilities; a separate hook-docstring audit covers the `hooks/` namespace.

## How to Verify at Write Time

When writing or reviewing a hook JSDoc with "emit" in the description:
1. `grep -n "emit(" apps/web/src/hooks/<hook-name>.ts` — is it actually here?
2. If zero results: find the actual emit call (`grep -rn "emit(" apps/web/src/app/api/ | grep <relevant-keyword>`)
3. Update docstring to cite the actual file path and line range

## Cross-references

- L-0176 (docstring drift — parent pattern, capability tools namespace)
- ADR-0134 (telemetry mobile contract — emit obligation source)
- ADR-0186 (4-destination routing — what emit must reach)
- Polish-Wave QA Council 2026-05-14 (M2 docstring compliance sweep — L-0176 sweep across _tools/_hooks JSDoc)
- `apps/web/src/hooks/use-payroll-proposals.ts:14` (concrete example)
- `apps/web/src/app/api/payroll/approve-proposal/route.ts:262` (actual emit location)
