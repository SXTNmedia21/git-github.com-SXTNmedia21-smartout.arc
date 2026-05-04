---
title: "Version bumps in package.json are no-ops until pnpm install regenerates the lockfile"
id: LEARNING-0092
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [pnpm, lockfile, dependency-management, mobile, monorepo]
---

# Learning-0092: Version bumps in package.json are no-ops until pnpm install regenerates the lockfile

## Context

While fixing the `No QueryClient set` crash on mobile (2026-04-21), a version bump was applied to `apps/mobile/package.json` changing `@tanstack/react-query` from `"^5"` to `"^5.99.0"`. The Supervisor agent (code-tracer) caught that `pnpm-lock.yaml` had not been regenerated — the lockfile still pinned `apps/mobile` to `5.90.21`. The app would continue to crash because Metro bundler reads from `node_modules`, which is hydrated from the lockfile, not the manifest.

## Discovery

pnpm resolves versions from `pnpm-lock.yaml`, not from `package.json`. A specifier change in `package.json` does not take effect until `pnpm install` runs and regenerates `pnpm-lock.yaml`. If only `package.json` is committed (without the updated lockfile), CI and other developers will continue building with the old resolution.

This is distinct from npm/yarn behavior where `package.json` specifiers are re-resolved on each install. pnpm's lockfile is the authoritative record of what is installed.

## Impact

- **PRs that change a `package.json` version MUST include the regenerated `pnpm-lock.yaml` in the same commit.** Split commits (package.json in one, lockfile in another) are unsafe — the intermediate state is a broken build.
- **Council reviews of dependency fixes must verify lockfile state, not just manifest state.** Checking `package.json` alone is insufficient. Check the relevant lockfile section with `grep "<package>" pnpm-lock.yaml` to confirm the resolved version matches the intent.
- **In post-implementation reviews:** the code-tracer layer (Supervisor) must explicitly verify whether `pnpm-lock.yaml` reflects the stated fix. This is a Layer 2 check for dependency management changes.

## References

- ADR-0170: React context packages as peerDependencies in workspace libraries
- 2026-04-21 `No QueryClient set` incident on `apps/mobile`

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
