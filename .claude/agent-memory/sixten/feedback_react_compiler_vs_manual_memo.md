---
name: React Compiler vs manual useMemo with empty deps
description: When `react-hooks/preserve-manual-memoization` fires on useMemo([]) where refs handle freshness, prefer dropping the useMemo entirely (let React Compiler memoize) over eslint-disable.
type: feedback
---

When `react-hooks/preserve-manual-memoization` fires on a `useMemo(() => ({...}), [])` whose author commented "refs handle freshness," the right resolution is to delete the useMemo entirely and let React Compiler memoize the object. Refs are stable across renders by design; the compiler-output is semantically equivalent to the hand-written empty-deps useMemo. eslint-disable is the chickening-out path.

**Why:** Sortie wt-5 close-feature push blocked on `apps/web/src/lib/wizard-tools/shared.ts:116` (`useWizardToolKit` returning `{definitions, implementations}` via `useMemo(() => ({...}), [])`). React Compiler can't prove the manual memoization is safe because inferred deps include `stepImplementations` but source deps are `[]`. Pontus resolved upstream in commit `4ec97a265` by dropping the useMemo entirely with a load-bearing comment naming the equivalence (React Compiler memoizes; refs are stable).

**How to apply:** When this lint rule fires on a useMemo that closes over React refs (RefObject<T>) with empty deps, default to deletion + comment naming the React Compiler equivalence. Only reach for eslint-disable if the closure includes non-ref unstable values that the compiler also can't prove stable. NEVER refactor the surrounding API to satisfy the rule (lifting builders out, adding ref-deps) — author's intent was correct; the rule is the one being too strict for the ref-pattern shape.
