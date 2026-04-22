---
title: "Dead code claim must be verified by import-graph, not name pattern"
id: LEARNING_0105
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [code-review, import-graph, phase-3, contracts, dead-code, false-positive]
---

# Learning-0105: Dead code claim must be verified by import-graph, not name pattern

## Context

Council Gate 2 verification (contract-hub-redesign, 2026-04-22) re-examined follow-up item #4 from the Phase 3 build agent: "CompositionWizard.tsx and contract-send-drawer.tsx kept for later cleanup — legacy artefacts of the retired `/dashboard/contracts/new` route and the old People-table send flow."

The Phase 3 agent's name-pattern reasoning:

- `CompositionWizard.tsx` — "Wizard" naming pattern matched the retired composition page wizard → assumed orphaned.
- `contract-send-drawer.tsx` — `-drawer.tsx` suffix without a matching hub-surface component → assumed replaced by `CompositionDrawer`.

Gate 2 ran an import-graph verification (`grep -rn "CompositionWizard\|contract-send-drawer" apps/ packages/ services/`). Both files have **live, non-test, non-comment consumers**:

- `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx` — imported by `apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx:14,30` (revise-contract flow uses the wizard as its primary composition surface).
- `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx` — imported by `apps/web/src/app/dashboard/people/_components/people-data-table.tsx:27,931` (People row "send contract" action still launches this drawer as its reverse-flow entry point).

Neither flow was retired in the hub redesign. Deleting either file would break two non-retired flows that ship in the same PR.

## Discovery

Agents use name-pattern heuristics to estimate "is this code alive?" but the authoritative signal is the **import graph**. Name-pattern reasoning has three failure modes in a monorepo:

1. **Shared components across routes.** A "Wizard" or "Drawer" with a legacy-sounding name may be consumed by multiple routes; only the primary consumer is retired.
2. **Reverse-flow entry points.** A component may be entered from a different surface than the one named in its filename. `contract-send-drawer` lives in `contracts/_components/` but is consumed from `people/_components/`.
3. **Recent refactors.** A file may have been moved or renamed to a location that implies legacy while the actual rewiring is partial.

The grep-based import-graph check takes ~30 seconds and falsifies the name-pattern claim when it's wrong. Without it, a build agent's "kept for later cleanup" can become a merge-time `git rm` that breaks production flows.

**Rule for any "dead code" claim:**

| Evidence required | Verdict |
|---|---|
| Grep across `apps/` `packages/` `services/` returns zero non-test, non-comment matches | Candidate for deletion — still confirm with git log (recent move? rename?) |
| Grep returns ≥1 live consumer | **NOT dead** — has live consumers that must be migrated before deletion |
| Grep shows only tests/comments | Stub/scaffold — treat with separate policy (may delete, may keep) |

## Impact

**Build agent briefing template — add a "Dead Code Claim Protocol" section:**

```
## Dead Code Claim Protocol
Before flagging any file or symbol as "dead / kept for cleanup":
1. Run `grep -rn "<filename_without_ext>\|<default_export_name>" apps/ packages/ services/ --include="*.ts" --include="*.tsx"`.
2. Filter out: the file itself, its own test file, and comment-only matches.
3. If ≥1 live match remains → the file is NOT dead. Either migrate the consumers now or do not touch the file.
4. If zero matches → safe to flag as candidate for deletion; include the grep command in the briefing note.
5. Never rely on filename/component-name heuristics. A "Wizard" or "Drawer" name does not imply retirement.
```

**Phase 2.5 fact-check — dead-code classifier:**

For every "kept for cleanup" or "dead code" claim in a PR or verdict, verify:

1. Grep import-graph across `apps/` + `packages/` + `services/`.
2. Count non-test, non-comment matches.
3. Zero matches → flag is valid. ≥1 match → flag is a false positive; escalate as follow-up issue (migrate consumers OR retract the claim).

**PR-review checklist:**

- Any commit message or PR body mentioning "dead code", "cleanup later", "legacy artefact" → reviewer runs the import-graph grep before approving.
- A PR that proposes `git rm` on a file with live consumers is blocked until all consumers migrate.

**Generalizes to other "unused" claims:**

- Unused exports: `ts-unused-exports` or `knip` tells the truth.
- Unused tables/columns: `pg_stat_user_tables` + codebase grep, not schema naming.
- Unused translation keys: i18n scanner against the source tree.
- Unused CSS tokens: PostCSS AST analysis against `.tsx`/`.css` consumers.

## References

- L-0094 — phantom emit contracts recurring (same family: claims about code require code verification, not intuition).
- L-0083 — registered telemetry event without producer is a phantom contract (inverse: claim that something IS wired when it isn't).
- `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx` — live consumer at `apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx:14,30`.
- `apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx` — live consumer at `apps/web/src/app/dashboard/people/_components/people-data-table.tsx:27,931`.
- Council Gate 2 (2026-04-22) — contract-hub-redesign, dead-code verification.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
