---
title: "Ghost dependencies (declared but never imported) are latent traps"
id: LEARNING-0093
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [dependency-management, pnpm, monorepo, architecture]
---

# Learning-0093: Ghost dependencies (declared but never imported) are latent traps

## Context

During the 2026-04-21 dependency audit, `packages/walkieTalkie` was found to declare `@tanstack/react-query: "^5"` in `dependencies` — but code-tracing all 7 source files in the package revealed zero imports of `@tanstack/react-query`. The declaration was a ghost: it existed in `package.json`, was installed by pnpm, and resolved to `5.90.21` in the package's own `node_modules`. No current code used it.

## Discovery

A ghost dependency is not neutral. It occupies a slot in `node_modules` with a specific resolved version. When the package's version differs from the app's version of the same package (especially one that uses React context), two context instances exist in the bundle. The ghost dep becomes an active crash vector the moment **any** code is added to that package that imports the dependency — and the crash will appear in a confusing context (a hook in a pure-logic package that "shouldn't" have any provider dependencies).

In this case: `packages/walkieTalkie` is widely imported in `apps/mobile` (PTT, call flow, chat, signaling). If a developer added a `useQuery` for call history, the app would crash with "No QueryClient set" — and the stack trace would point to a voice/LiveKit package, not to a data-fetching layer, making diagnosis hard.

## Impact

- Ghost dependencies should be converted to `peerDependencies` (not silently removed) when the package operates in a React context — this documents the runtime requirement and ensures version alignment is maintained.
- If the dependency is truly unused AND not expected to be used (wrong domain), remove it entirely.
- **During dependency audits:** always code-trace before assuming a declared dependency is actively used. `grep -r "from.*<package>" packages/<name>/src/` is the check.
- The correct remediation for a ghost dep in a shared lib that uses React context packages: move to `peerDependencies`. This way, even if someone adds an import later, the version is resolved from the app (the peerDep consumer) rather than from a stale direct dep in the package's own `node_modules`.

## References

- ADR-0170: React context packages as peerDependencies in workspace libraries
- Learning-0092: Version bumps in package.json are no-ops until pnpm install regenerates the lockfile
- 2026-04-21 `No QueryClient set` incident on `apps/mobile`

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
