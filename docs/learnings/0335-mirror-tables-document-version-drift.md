---
id: L-0335
title: Mirror-table document-version drift when two surfaces redeclare the same constant
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: onboarding
tags: [learnings, constants, document-version, audit-trail, mobile, onboarding]
---

# L-0335 — Two surfaces writing the same audit field must import from one constant module — never redeclare

## Context

`welcome-wizard-actions.ts` (web Server Action) imports `HANDBOOK_DOCUMENT_VERSION` from `apps/web/src/app/dashboard/_actions/welcome-wizard-constants.ts` — the single-source module after a bundler-fix commit (b91a83077).

`apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts` (mobile BFF) hardcoded the same version strings inline:

```ts
// In mobile BFF — WRONG
document_version: "handbook-v1"

// In constants module — correct single-source
export const HANDBOOK_DOCUMENT_VERSION = "handbook-v1"
```

The defect is latent: as long as the version string doesn't change, both surfaces agree. The moment web bumps to `"handbook-v2"` (new handbook published), mobile silently continues writing `"handbook-v1"` → audit trail bifurcates by platform. Compliance reviews see different consent versions depending on whether the employee used web or mobile. No error, no warning.

Surfaced by Council R3 (2026-05-23), agent-coord §O3.

## Discovery

Two surfaces that write the same audit-trail field create a silent drift risk whenever they independently declare the value rather than importing from a shared single source. The pattern is the same class as L-0176 (docstring drift from body) — two representations of the same contract, one of which is not mechanically tied to the other.

This applies to any "mirror write" scenario where:
1. Web and mobile BFF both write the same `document_version`, `schema_version`, `protocol_version`, or similar audit-critical string.
2. Only one surface imports from the canonical constant.
3. The other surface hardcodes or re-derives the value.

## Impact

**Rule (codified in ADR-0400 §5):** Web Server Action + mobile BFF MUST import consent `document_version` values from the same module. No redeclaration allowed.

**Fix applied:** mobile `save-step/route.ts` now imports from `welcome-wizard-constants.ts`. Committed in Sortie C (`405051773`, defect #8).

**Forward ESLint rule (planned, next sortie):** `no-literal-document-version` — grep for `"handbook-v\d"`, `"gdpr-v\d"`, `"tariff-v\d"` string literals outside `*-constants.ts` files. Similar pattern to `no-oklch-literal` (ADR-0349/ADR-0366).

**Reviewer grep at PR time:** `"handbook-v` / `"gdpr-v` / `"tariff-v` literal strings outside the constants module = instant flag.

Siblings: L-0176 (docstring drift — two descriptions of the same contract diverge), L-0086 (frozen constants — single-source principle for generated values).

## References

- ADR-0400 §5 (document-version constants single-source)
- Constants module: `apps/web/src/app/dashboard/_actions/welcome-wizard-constants.ts`
- Fixed route: `apps/web/src/app/api/mobile/employee-onboarding/save-step/route.ts`
- Remediation commit Sortie C: `405051773` (defect #8)
- Sibling: L-0176 (docstring drift), L-0086 (frozen-constants)
