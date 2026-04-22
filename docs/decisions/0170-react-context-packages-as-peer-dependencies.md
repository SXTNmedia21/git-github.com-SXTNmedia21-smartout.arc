---
title: "React context packages are peerDependencies in workspace libraries"
id: ADR-0170
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-21
---

# ADR-0170: React context packages are peerDependencies in workspace libraries

## Context and Problem Statement

The Smartout monorepo is a pnpm workspace where shared packages (`packages/*`) are consumed by apps (`apps/web`, `apps/mobile`). Packages like `@tanstack/react-query`, `react`, and `react-dom` use React context under the hood — a single app can only have one active context instance per package. When a shared workspace package declares such a package as a direct `dependency`, pnpm installs a separate copy in that package's own `node_modules`, creating two context instances. The bundler (Metro/webpack) resolves them separately, causing crashes like "No QueryClient set" even when the app wraps its tree in the correct provider.

## Decision Drivers

- `packages/billing` declared `@tanstack/react-query: "^5.95.0"` as a direct dependency. This installed `5.99.0` workspace-wide. `apps/mobile` was on `5.90.21`. Metro bundled two different context instances, crashing `ShiftCard` with "No QueryClient set" (2026-04-21 incident).
- Four of six shared packages already used `peerDependencies` for `@tanstack/react-query` — the correct pattern existed but was not codified.
- Metro's resolver is more literal than webpack/turbopack — it surfaces this class of bug faster on mobile.

## Considered Options

1. **Bump the app to match the package** — treat each split as a one-off fix. Does not prevent recurrence.
2. **peerDependencies in shared libs + apps pin the version** — aligns all consumers to the single version the app declares. Correct pattern.
3. **pnpm.overrides in root package.json** — forces a single resolved version regardless of what any sub-package declares. Complements option 2 as a last-resort enforcement layer.

## Decision Outcome

Chosen option: **2 + 3 combined**, because peerDependencies declare intent correctly and overrides enforce it mechanically.

**Rule:** Any npm package that creates a React context (or ships its own context provider) MUST be declared as a `peerDependency` in workspace packages (`packages/*`), never a direct `dependency`.

Affected packages include (non-exhaustive): `@tanstack/react-query`, `@tanstack/react-query-devtools`, `react`, `react-dom`, `zustand`, `jotai`, `framer-motion`, `sonner`.

Apps (`apps/web`, `apps/mobile`) declare the concrete pinned version in `dependencies`.

Root `package.json` uses `pnpm.overrides` to enforce a single resolved version as a last-resort mechanism (mirrors the existing `react: 19.2.4` override pattern).

## Rules & Consequences

- **Good, because** a single context instance is guaranteed — provider in the app satisfies consumers in any shared package.
- **Good, because** the pattern is self-documenting: `peerDependencies` in a shared lib communicates "I need this at runtime, but my consumer owns the version."
- **Bad, because** peerDependency warnings appear if a consumer does not explicitly install the package. This is intentional — the warning surfaces the missing declaration.
- **Agent Impact:** When adding a React context package to any file under `packages/*`, declare it in `peerDependencies` (and optionally `devDependencies` for local type-checking). Never add it to `dependencies`. The `pnpm.overrides` in root `package.json` is the enforcement backstop — do not remove it.

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
