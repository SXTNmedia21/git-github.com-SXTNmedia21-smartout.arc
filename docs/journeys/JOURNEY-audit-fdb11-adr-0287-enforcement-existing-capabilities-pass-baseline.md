---
title: "Journey — Existing capabilities pass enforcement baseline"
feature: audit-fdb11-adr-0287-enforcement
journey: existing-capabilities-pass-baseline
status: verified
verified_at: 2026-05-13
e2e_test: docs/audits/2026-05-13-sortie-bw21-verification.md §S5 (baseline scan documented)
created: 2026-05-13
updated: 2026-05-13
module: cross-cutting
tags: [journey, baseline, regression-check]
---

# Journey: Baseline scan documents existing capability state

**Role:** auditor running first enforcement pass

**Precondition:** All artifacts shipped.

## Happy Path

1. Run `npx tsx scripts/gate-action-coverage.ts --baseline` from repo root
2. Output: table of `passing N | violating M | exempt K` per capability namespace
3. Document baseline in audit synthesis F-DB-11 closure note
4. Existing violators (personal/tools.ts ADR-0204 backlog) flagged with warn, NOT blocking (strict mode = future flag)

**Postcondition:** Baseline known. Future regressions block; existing backlog visible.

## Verification

- [ ] Baseline scan runs to completion
- [ ] Output captured in F-DB-11 closure note
- [ ] Strict-mode flag documented (e.g. CI uses `--strict` after grace period)

**Mark verified when all checked.**
