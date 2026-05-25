---
title: "HANDOFF: dev-build-cascade-extension-fix"
status: done
updated: 2026-05-25
created: 2026-05-25
module: build
tags: [ci, packages, turbopack, build-fix, handoff]
---

## Summary

Removed `.js` extensions from 15 intra-package imports in `packages/data/src` (12 source files +
3 test files). Fix was required because Turbopack's `moduleResolution=bundler` does not resolve
extensioned imports in source-only packages; the failure surfaced when `apps/web` first consumed
`@smartout/data` via the p11-oppgaver page (web#build CI red on `development`).

## Decisions

No ADR — this is a mechanical alignment to the sibling-package pattern already established by
`packages/types`, `packages/ai`, and `packages/telemetry` (all extension-free). No new conventions
introduced; no new dependencies added.

## Learnings

1. **NEW — packages/data mis-ported extension pattern:** `packages/data` was bootstrapped with
   `.js` extensions on intra-package imports, apparently ported from a pattern used in compiled
   packages (where extensions are required post-emit). Source-only packages under Turbopack/bundler
   mode must use extension-free imports. The failure was latent until `apps/web` first imported
   `@smartout/data` at the p11-oppgaver page. Mitigation: when bootstrapping a new source-only
   package, grep sibling packages for import style before committing.

2. **CONFIRMED — L-WSL2-OOM 5th occurrence (2026-05-25):** WSL2 RAM ceiling hit again (3.0Gi
   available during sortie). Pre-push typecheck (`pnpm turbo typecheck`) pre-authorized to skip via
   `--no-verify` for this sortie due to verified Verifier C APPROVE + doc-class-fix. CI runs full
   battery on push, covering the skipped gate. Deploying-skill OOM entry validated again; consider
   `free -h` pre-flight gate in `ci:local` (promos-candidate per MEMORY.md).

3. **CONFIRMED — L-worktree-missing-pnpm-symlinks (2nd occurrence):** Fresh worktree required
   `pnpm install` before hooks could resolve `@smartout/*` symlinks. Pattern now confirmed:
   always run `pnpm install` from worktree root immediately after `git worktree add`.

## Known Issues

None. Verifier C APPROVED with no conditions. CI Build job on feat branch expected to pass.

## Next Steps

- Watch for other source-only packages that may have adopted `.js` extension pattern; run
  `grep -r "from '\./.*\.js'" packages/*/src/` periodically as a preventive check.
- Consider an ESLint/lint rule "no `.js` extension in intra-package source imports" if the same
  fix is needed in a third package — that threshold would justify a dedicated sortie for enforcement.
