---
title: L-0344 BUGS.md ghost-claim pattern — trust-gate the author
id: L-0344
status: canonical
updated: 2026-05-24
created: 2026-05-24
module: meta
tags: [council, trust-gate, citation, journey-sweep]
related: [L-0176, L-0177]
---

# L-0344 — BUGS.md ghost-claim pattern

## What happened

Journey-sweep 2026-05-23/24 produced a 22-bug `BUGS.md` triage doc. Council Phase 3+5 grep-verified the cited paths/IDs. **At least 3 ghost-claims surfaced:**

1. **BUG-12** cited `seedDraftContract` helper in `apps/e2e/helpers/contract-harness.ts`. Function does NOT exist in that file. Only `seedContractTemplateForWorkspace` lives there. BUGS.md hedged with `(likely)` but sortie scoping would have wasted ~30 min before catching it.
2. **BUG-13** cited testids `bindings-tab`, `drift-drawer`, `hub-redesign` as if they had drifted. Grep across `apps/web/src/` returned ZERO matches. The testids **never existed** — specs were written ahead of impl. BUG-13 is product-gap, not testid-drift.
3. **Harness builder Phase 3** cited `apps/e2e/tests/botsson-provider-scope.spec.ts` (wrong path — actual file is in `apps/e2e/tests/domain-chat-ownership/` subdir).
4. **Frontend designer Phase 3** cited `apps/web/src/components/HmsSubNav.tsx` (wrong path — actual file is in `apps/web/src/app/dashboard/hms/_components/`).

## Why it matters

Triage docs written under pressure cite paths/IDs from memory. Sortie scoping that trusts cited paths burns hours before discovering the citation is wrong. Then the cited "fix location" is a ghost — fixing it changes nothing.

## How to apply

**Phase 2.5 fact-check (council) MUST verify file:line of every BUGS.md citation before Phase 3 dispatch.** For each citation:

```bash
# Verify file exists
[ -f "<cited-path>" ] && echo "OK $cited-path" || echo "GHOST $cited-path"

# Verify symbol exists in file
grep -n "<cited-symbol>" "<cited-path>" || echo "GHOST-SYMBOL $cited-symbol in $cited-path"
```

If grep returns zero hits on a function/component/testid the BUGS.md claims is broken, **the bug as stated cannot be fixed** — re-investigate the actual failing behavior first.

## Sibling patterns

- [[L-0176]] — docstring claims compliance, body doesn't implement (author asserts vs reality)
- [[L-0177]] — silent fallback that hides broken state
- [[L-0347]] — symmetric trust-gate on reviewer counter-claims (this council's sibling)

## Precedent count

1st promoted occurrence (this council). Future similar findings get logged here as repeats.
