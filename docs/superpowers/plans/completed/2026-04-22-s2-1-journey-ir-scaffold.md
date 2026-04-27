---
title: "S2.1 Sub-Sortie Brief — packages/journey-ir scaffold"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m2, packages, adr-0171]
---

# S2.1 — `packages/journey-ir` package scaffold

> **Campaign:** journey-engine · **Milestone:** M2 Spec + Remaining Unblocks · **Sub-sortie:** S2.1
> **Predecessors:** M1 closed (`3c3dca8f`) — ADRs 0172/0173/0175/0176 accepted.
> **Blocks:** S2.2 (legacy retirement must resolve `@smartout/journey-ir` as a workspace dep before it can repoint the consumer import).
> **Binding ADR:** 0171 (package path).
> **Gate B council:** Conditional-Go. This brief addresses code-explorer B1 (apps/web package.json dep) + Advisory A3 (library.json base).

---

## Scope — exactly what lands

Scaffold the new shared package. No business logic, no types beyond a placeholder `JourneyIR` interface, no tests beyond a trivial smoke test. The package exists so that S2.2 has a destination for the legacy compile.ts move.

### File structure

```
packages/journey-ir/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

### `packages/journey-ir/package.json`

Follow `packages/telemetry/package.json` pattern but without React and without the conditional `react-native` / `react-server` / client exports. The package is pure TS — no runtime dependencies in M2.

```json
{
  "name": "@smartout/journey-ir",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "npx tsc && node ../../scripts/fix-esm-imports.mjs",
    "lint": "eslint src/",
    "typecheck": "npx tsc --noEmit",
    "clean": "rimraf dist .turbo"
  },
  "devDependencies": {
    "@smartout/eslint-config": "workspace:^",
    "@smartout/typescript-config": "workspace:*",
    "@types/node": "^20",
    "typescript": "^5.9.0"
  }
}
```

No `dependencies` in M2. No `peerDependencies`. No `vitest` in devDependencies (no tests in M2; S2.2 will NOT add tests either — the pure-function move is its own verification via typecheck).

### `packages/journey-ir/tsconfig.json`

**Gate B Advisory A3 — extend `library.json`, NOT `react-library.json`.** journey-ir has no React dependency at the scaffold stage.

```json
{
  "extends": "@smartout/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/journey-ir/src/index.ts`

Minimal placeholder — just enough to typecheck and build. S2.2 will extend with `compile.ts`. M3 will add the JourneyIR type family.

```typescript
/**
 * @smartout/journey-ir — canonical JourneyIR package.
 *
 * Per ADR-0171, `packages/ai/src/journey` is forbidden. All journey
 * intermediate representation types and the compile() function live here.
 *
 * M2 state: scaffold + legacy compile.ts (moved in S2.2).
 * M3 state: JourneyIR type family, protocolToJourneyIR() adapter.
 */

export const JOURNEY_IR_PACKAGE_VERSION = "1.0.0" as const;
```

That's it. No re-exports of types that don't exist yet. No `compile` re-export yet — that lands in S2.2.

### `apps/web/package.json` — add dependency (Gate B Blocker B1)

Before S2.2 can land, `apps/web` must declare `@smartout/journey-ir` as a workspace dependency. Add to `apps/web/package.json` `dependencies` in the same commit as the scaffold:

```json
"@smartout/journey-ir": "workspace:*"
```

Verify by running `pnpm install` after editing — pnpm should link the workspace package without errors. If pnpm-lock.yaml changes, include it in the commit.

## Out of scope

- **DO NOT** copy `compile.ts` into `packages/journey-ir/src/` in S2.1. That's S2.2 (atomicity requirement).
- **DO NOT** delete `packages/ai/src/journey/compile.ts` or remove the `./journey/compile` export from `packages/ai/package.json` in S2.1. S2.2 does both.
- **DO NOT** update the consumer `apps/web/src/app/platform-admin/journeys/actions/compile.ts`. S2.2 does this.
- **DO NOT** add tests. Typecheck + turbo build is sufficient for a scaffold.
- **DO NOT** add vitest / jest / any test framework to `devDependencies`. Scaffold means scaffold.
- **DO NOT** touch `tsconfig.base.json` or any sibling package's tsconfig — `pnpm-workspace.yaml` auto-discovers new packages under `packages/*` and Turbo handles dependency graph.
- **DO NOT** pre-wire ADR-0174 adapter contract — that's M3.

## Acceptance criteria (exit gates)

- [ ] `packages/journey-ir/package.json` exists with exact shape above (no stray fields).
- [ ] `packages/journey-ir/tsconfig.json` extends `library.json` (NOT `react-library.json`).
- [ ] `packages/journey-ir/src/index.ts` exports `JOURNEY_IR_PACKAGE_VERSION`.
- [ ] `apps/web/package.json` `dependencies` includes `"@smartout/journey-ir": "workspace:*"`.
- [ ] `pnpm install` runs cleanly; `pnpm-lock.yaml` updated if needed.
- [ ] `pnpm turbo build --filter=@smartout/journey-ir` succeeds (produces `packages/journey-ir/dist/index.js` + `.d.ts`).
- [ ] `pnpm turbo typecheck` passes with 0 errors across the whole repo.
- [ ] Zero imports from `@smartout/journey-ir` anywhere yet (no consumer until S2.2).
- [ ] `grep -R "@smartout/journey-ir" apps packages services | grep -v node_modules | grep -v dist | grep -v pnpm-lock.yaml` returns exactly:
  - `apps/web/package.json` (the dependency declaration)
- [ ] Handoff at `docs/HANDOFF-journey-s2-1-journey-ir-scaffold.md`: rationale for library.json choice, confirmation of pnpm install clean run, dist output size.
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s2-1-journey-ir-scaffold.md`: developer imports from `@smartout/journey-ir` (after S2.2 lands) and TS resolves it.
- [ ] Decision log entry: "S2.1 landed — `packages/journey-ir` scaffolded per ADR-0171. Scaffold-only; compile.ts migration is S2.2."

## Dispatch

Single build subagent. Return handoff for verification. This sub-sortie is independent of S2.3 and S2.4 — the council recommended parallel dispatch of S2.1 + S2.3 + S2.4 with S2.2 sequential after S2.1.
