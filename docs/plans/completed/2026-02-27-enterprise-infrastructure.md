# Enterprise Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform smartout_v3 from a working prototype into an enterprise-grade monorepo with shared configs, unified design system, complete telemetry, and full infrastructure monitoring.

**Architecture:** Four sequential phases — each phase builds on the previous. Phase 1 (tooling) enables everything else. Phase 2 (design system) creates the visual foundation. Phase 3 (telemetry) completes the observability spec. Phase 4 (watchdog) adds monitoring, security, and CI/CD.

**Design principle: Self-healing and self-enforcing.** The system must enforce its own rules automatically. Formatting is fixed on commit (husky). Type safety is enforced in CI. Telemetry contracts are validated by TypeScript discriminated unions. Dependency policies are checked by lint rules. Nothing relies on developer discipline alone — every rule has a machine-enforced gate.

**Tech Stack:** TypeScript 5, Tailwind CSS v4 (OKLCH), shadcn/ui (new-york), PostHog EU, Supabase PostgreSQL 17, Sentry, Upstash Redis, GitHub Actions, Vercel.

**Estimated effort:** ~4 days total across all 4 phases (revised from 2.5 — accounts for Windows compat testing, migration auditing, and integration verification).

### Review-Driven Corrections (v2)

This plan incorporates fixes from two independent reviews:

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | High | Task 3.1 duplicates existing `00005_activity_trail.sql` | Changed to audit + add missing partial index only |
| 2 | High | `useTrack()` API change breaks existing callers | Non-breaking overload: optional params, mock fallback preserved |
| 3 | High | `activity_trail` INSERT policy `WITH CHECK (TRUE)` too permissive | Restricted INSERT to `service_role` only (`TO service_role`) |
| 4 | High | `/api/health` DB check fails on RLS-protected table | Use service role client with dedicated health query |
| 5 | High | `health-check` Edge Function has no auth gate | Added bearer token verification |
| 6 | Medium | `rm -rf` not Windows-safe | Use `rimraf` package (cross-platform) |
| 7 | Medium | Route-level middleware.ts invalid for Next.js App Router | Removed; rate limiting integrated directly in route handlers |
| 8 | Medium | `packages/notifications/tsconfig.json` doesn't exist | Added creation sub-step |
| 9 | Medium | Telemetry beacon endpoint validation too weak | Added Zod schema validation |

---

## Phase 1: Tooling Foundation (~4 hours)

No dependencies. Everything else builds on this.

---

### Task 1.1: Create shared TypeScript config package

**Files:**
- Create: `packages/typescript-config/package.json`
- Create: `packages/typescript-config/base.json`
- Create: `packages/typescript-config/nextjs.json`
- Create: `packages/typescript-config/react-library.json`
- Create: `packages/typescript-config/library.json`

**Step 1: Create package.json**

```json
{
  "name": "@smartout/typescript-config",
  "version": "1.0.0",
  "private": true,
  "license": "UNLICENSED",
  "publishConfig": {
    "access": "restricted"
  }
}
```

**Step 2: Create base.json**

All packages extend this. Locks down target, strict mode, and resolution.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".turbo"]
}
```

**Step 3: Create nextjs.json**

For `apps/web` and `apps/landing`.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "noEmit": true,
    "module": "ESNext",
    "plugins": [{ "name": "next" }],
    "allowJs": true
  }
}
```

**Step 4: Create react-library.json**

For packages that export React components (`ui`, `telemetry`).

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx"
  }
}
```

**Step 5: Create library.json**

For pure TypeScript packages (`types`, `utils`, `supabase`).

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json"
}
```

**Step 6: Migrate all packages to extend shared configs**

Update each `tsconfig.json` to extend the appropriate base:

| Package | Extends | Path alias |
|---------|---------|------------|
| `apps/web/tsconfig.json` | `@smartout/typescript-config/nextjs.json` | `@/*` → `./src/*` |
| `apps/landing/tsconfig.json` | `@smartout/typescript-config/nextjs.json` | `@/*` → `./src/*` |
| `packages/types/tsconfig.json` | `@smartout/typescript-config/library.json` | none |
| `packages/supabase/tsconfig.json` | `@smartout/typescript-config/library.json` | none |
| `packages/utils/tsconfig.json` | `@smartout/typescript-config/library.json` | none |
| `packages/ai/tsconfig.json` | `@smartout/typescript-config/library.json` | none |
| `packages/ui/tsconfig.json` | `@smartout/typescript-config/react-library.json` | none |
| `packages/telemetry/tsconfig.json` | `@smartout/typescript-config/react-library.json` | none |
| `packages/i18n/tsconfig.json` | `@smartout/typescript-config/library.json` | none |
| `packages/notifications/tsconfig.json` | `@smartout/typescript-config/library.json` | none |

**Pre-step:** `packages/notifications/tsconfig.json` does not currently exist. Create it before migrating:
```json
{
  "extends": "@smartout/typescript-config/library.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Critical:** Remove `~/*` path aliases from `packages/ui` and `packages/telemetry`. Standardize on `@/*` for apps only, no aliases in packages (use relative imports).

Example migration for `packages/ui/tsconfig.json`:
```json
{
  "extends": "@smartout/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Example migration for `apps/web/tsconfig.json`:
```json
{
  "extends": "@smartout/typescript-config/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

**Step 7: Verify**

Run: `pnpm --filter web exec tsc --noEmit`
Run: `pnpm --filter @smartout/types exec tsc --noEmit`
Expected: No new errors introduced.

**Step 8: Commit**

```bash
git add packages/typescript-config/ apps/*/tsconfig.json packages/*/tsconfig.json
git commit -m "feat: add shared TypeScript config package

Standardize all packages on @smartout/typescript-config bases.
Eliminates ES2017/ES2020/ES2022 target drift and ~/* path alias inconsistency."
```

---

### Task 1.2: Create shared ESLint config package

**Files:**
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.mjs`
- Create: `packages/eslint-config/react.mjs`
- Create: `packages/eslint-config/next.mjs`
- Modify: `apps/web/eslint.config.mjs`
- Modify: `apps/landing/eslint.config.mjs`
- Modify: `packages/types/eslint.config.mjs`

**Step 1: Create package.json**

```json
{
  "name": "@smartout/eslint-config",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./base": "./base.mjs",
    "./react": "./react.mjs",
    "./next": "./next.mjs"
  },
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint-plugin-import": "^2.31.0"
  },
  "devDependencies": {
    "eslint": "^9"
  }
}
```

**Step 2: Create base.mjs**

Shared rules for all TypeScript packages.

```javascript
// packages/eslint-config/base.mjs
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", ".turbo/**"],
  },
];
```

**Step 3: Create react.mjs**

Extends base with React rules.

```javascript
// packages/eslint-config/react.mjs
import base from "./base.mjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    files: ["**/*.tsx"],
    rules: {
      // React-specific rules go here when needed
    },
  },
];
```

**Step 4: Create next.mjs**

Extends react + Next.js core-web-vitals.

```javascript
// packages/eslint-config/next.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

**Step 5: Update apps/web/eslint.config.mjs**

```javascript
export { default } from "@smartout/eslint-config/next";
```

**Step 6: Update apps/landing/eslint.config.mjs**

```javascript
export { default } from "@smartout/eslint-config/next";
```

**Step 7: Add eslint.config.mjs to all packages that lack one**

For packages like `ui`, `telemetry`, `utils`, `supabase`, `ai`:

```javascript
export { default } from "@smartout/eslint-config/react";
```

For non-React packages (`types`, `i18n`, `notifications`):

```javascript
export { default } from "@smartout/eslint-config/base";
```

**Step 8: Update lint scripts in all packages**

Every `package.json` gets:
```json
"lint": "eslint src/"
```

Replace packages that currently use `"lint": "tsc --noEmit"` — that becomes `typecheck`.

**Step 9: Verify**

Run: `pnpm lint`
Expected: Runs ESLint across all packages via Turbo.

**Step 10: Commit**

```bash
git add packages/eslint-config/ apps/*/eslint.config.mjs packages/*/eslint.config.mjs packages/*/package.json
git commit -m "feat: add shared ESLint config package

Unified rules across all packages. @typescript-eslint/no-explicit-any as error.
Consistent type imports enforced."
```

---

### Task 1.3: Add Prettier config and formatting rules

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Step 2: Install Tailwind Prettier plugin at root**

Run: `pnpm add -Dw prettier-plugin-tailwindcss`

**Step 3: Create .prettierignore**

```
node_modules
.next
dist
.turbo
build
coverage
pnpm-lock.yaml
packages/supabase/src/database.types.ts
```

**Step 4: Run format and inspect changes**

Run: `pnpm format`
Review the diff. If it's large, this is expected — first format pass.

**Step 5: Commit**

```bash
git add .prettierrc .prettierignore package.json pnpm-lock.yaml
git commit -m "feat: add Prettier config with Tailwind plugin

Locks formatting: double quotes, 100 print width, trailing commas, LF endings.
Tailwind class sorting enabled."
```

Then commit formatted files separately:
```bash
git add packages/ apps/ services/ *.json *.yaml *.md
git commit -m "style: format entire codebase with Prettier"
```

---

### Task 1.4: Update Turbo pipeline and root scripts

**Files:**
- Modify: `turbo.json`
- Modify: `package.json` (root)

**Step 1: Update turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 2: Add typecheck scripts to all packages**

Every package.json that doesn't have one gets:
```json
"typecheck": "tsc --noEmit"
```

For apps/web and apps/landing (Next.js handles its own TS):
```json
"typecheck": "tsc --noEmit"
```

**Step 2.5: Install rimraf at root (Windows-safe rm -rf)**

Run: `pnpm add -Dw rimraf`

**Step 3: Add clean scripts to all packages (cross-platform)**

```json
"clean": "rimraf dist .next .turbo node_modules/.cache"
```

> **Note:** `rm -rf` fails on Windows (PowerShell). `rimraf` is the cross-platform equivalent and works on Windows, macOS, and Linux.

**Step 4: Update root package.json scripts**

```json
{
  "scripts": {
    "build": "op run --env-file=.env.template -- turbo run build",
    "vercel-build": "turbo run build --filter=web",
    "dev": "op run --env-file=.env.template -- turbo run dev",
    "dev:local": "turbo run dev",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint -- --fix",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "pnpm --filter e2e test:e2e",
    "format": "prettier --write \"**/*.{ts,tsx,md,json,css}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json,css}\"",
    "check": "turbo run lint typecheck",
    "clean": "turbo run clean && rimraf node_modules/.cache",
    "db:start": "npx supabase start",
    "db:stop": "npx supabase stop",
    "db:reset": "npx supabase db reset",
    "db:gen-types": "npx supabase gen types typescript --local > packages/supabase/src/database.types.ts",
    "db:migrate:new": "npx supabase migration new",
    "prepare": "husky"
  }
}
```

**Step 5: Verify**

Run: `pnpm typecheck`
Run: `pnpm check`
Expected: Both complete without errors.

**Step 6: Commit**

```bash
git add turbo.json package.json apps/*/package.json packages/*/package.json
git commit -m "feat: complete Turbo pipeline with typecheck, test, clean tasks

Add root scripts: check, db:*, clean, typecheck, lint:fix, format:check.
All packages now have typecheck and clean scripts."
```

---

### Task 1.5: Add git hooks with Husky + lint-staged

**Files:**
- Create: `.husky/pre-commit`
- Create: `.lintstagedrc.json`
- Modify: `package.json` (root)

**Step 1: Install dependencies**

Run: `pnpm add -Dw husky lint-staged`

**Step 2: Initialize Husky**

Run: `npx husky init`

**Step 3: Create pre-commit hook**

Write `.husky/pre-commit`:
```bash
npx lint-staged
```

**Step 4: Create lint-staged config**

Write `.lintstagedrc.json`:
```json
{
  "*.{ts,tsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{md,json,css}": ["prettier --write"]
}
```

**Step 5: Verify**

Stage a file with a formatting issue, attempt commit.
Expected: lint-staged auto-fixes and stages the corrected file.

**Step 6: Commit**

```bash
git add .husky/ .lintstagedrc.json package.json pnpm-lock.yaml
git commit -m "feat: add pre-commit hooks with Husky + lint-staged

Auto-format and lint staged files on commit. Prevents broken code from entering repo."
```

---

### Task 1.6: Add GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [SmartOut.ai]
  pull_request:
    branches: [SmartOut.ai]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  SKIP_ENV_VALIDATION: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  format:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
```

**Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions CI pipeline

Runs lint, typecheck, format check in parallel. Build depends on typecheck passing."
```

---

## Phase 2: Design System (~8 hours)

Depends on Phase 1 (shared configs must exist first).

---

### Task 2.1: Create design-tokens package

**Files:**
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tsconfig.json`
- Create: `packages/design-tokens/src/tokens.ts`
- Create: `packages/design-tokens/src/tokens.css`
- Create: `packages/design-tokens/src/native.ts`
- Create: `packages/design-tokens/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@smartout/design-tokens",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./native": "./src/native.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist .turbo"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/library.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create src/tokens.ts**

This is the single source of truth. All colors, radii, spacing, and shadows defined here.

```typescript
// packages/design-tokens/src/tokens.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLE SOURCE OF TRUTH — Change a value here,
// every app (web, landing, mobile) updates automatically.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Brand Colors ──────────────────────────────────────
export const brand = {
  orange: "oklch(0.65 0.22 40)",
  orangeLight: "oklch(0.75 0.18 40)",
  orangeDark: "oklch(0.55 0.22 40)",
} as const;

// ─── Semantic Colors ───────────────────────────────────
export const semantic = {
  success: "oklch(0.65 0.2 145)",
  successForeground: "oklch(0.98 0 0)",
  warning: "oklch(0.75 0.18 85)",
  warningForeground: "oklch(0.15 0 0)",
  error: "oklch(0.577 0.245 27.325)",
  errorForeground: "oklch(0.98 0 0)",
  info: "oklch(0.6 0.15 250)",
  infoForeground: "oklch(0.98 0 0)",
} as const;

// ─── Surface Colors (Light Mode) ──────────────────────
export const light = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  // Sidebar
  sidebar: "oklch(0.985 0 0)",
  sidebarForeground: "oklch(0.145 0 0)",
  sidebarPrimary: "oklch(0.205 0 0)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.97 0 0)",
  sidebarAccentForeground: "oklch(0.205 0 0)",
  sidebarBorder: "oklch(0.922 0 0)",
  sidebarRing: "oklch(0.708 0 0)",
  // Charts
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;

// ─── Surface Colors (Dark Mode) ───────────────────────
export const dark = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.922 0 0)",
  primaryForeground: "oklch(0.205 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  // Sidebar
  sidebar: "oklch(0.205 0 0)",
  sidebarForeground: "oklch(0.985 0 0)",
  sidebarPrimary: "oklch(0.488 0.243 264.376)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.269 0 0)",
  sidebarAccentForeground: "oklch(0.985 0 0)",
  sidebarBorder: "oklch(1 0 0 / 10%)",
  sidebarRing: "oklch(0.556 0 0)",
  // Charts
  chart1: "oklch(0.488 0.243 264.376)",
  chart2: "oklch(0.696 0.17 162.48)",
  chart3: "oklch(0.769 0.188 70.08)",
  chart4: "oklch(0.627 0.265 303.9)",
  chart5: "oklch(0.645 0.246 16.439)",
} as const;

// ─── Domain Colors (Smartout-specific) ─────────────────
export const department = {
  kitchen: "oklch(0.65 0.2 40)",
  floor: "oklch(0.65 0.15 180)",
  bar: "oklch(0.55 0.2 300)",
  event: "oklch(0.65 0.18 85)",
  storage: "oklch(0.55 0.1 200)",
} as const;

export const status = {
  trainee: "oklch(0.6 0.15 250)",
  active: "oklch(0.65 0.2 145)",
  inactive: "oklch(0.55 0 0)",
  offboarding: "oklch(0.65 0.18 85)",
} as const;

export const priority = {
  urgent: "oklch(0.577 0.245 27.325)",
  high: "oklch(0.65 0.22 40)",
  normal: "oklch(0.6 0.15 250)",
  low: "oklch(0.55 0 0)",
} as const;

// ─── Spacing ──────────────────────────────────────────
export const spacing = {
  page: "2rem",
  section: "1.5rem",
  card: "1.25rem",
  element: "0.75rem",
  tight: "0.5rem",
} as const;

// ─── Radius ───────────────────────────────────────────
export const radius = {
  base: "0.625rem",
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
  xl: "calc(0.625rem + 4px)",
  full: "9999px",
} as const;

// ─── Shadows ──────────────────────────────────────────
export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  glow: {
    orange: "0 0 15px -3px rgba(249, 115, 22, 0.3)",
    blue: "0 0 15px -3px rgba(59, 130, 246, 0.3)",
  },
} as const;
```

**Step 4: Create src/tokens.css**

Generated from tokens.ts values. Apps import this instead of defining their own variables.

```css
/* packages/design-tokens/src/tokens.css */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* AUTO-DERIVED from tokens.ts              */
/* Change values in tokens.ts, update here  */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

@layer base {
  :root {
    --radius: 0.625rem;

    /* Surface — Light */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);

    /* Charts — Light */
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
    --chart-3: oklch(0.398 0.07 227.392);
    --chart-4: oklch(0.828 0.189 84.429);
    --chart-5: oklch(0.769 0.188 70.08);

    /* Sidebar — Light */
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);

    /* Brand */
    --brand-orange: oklch(0.65 0.22 40);
    --brand-orange-light: oklch(0.75 0.18 40);
    --brand-orange-dark: oklch(0.55 0.22 40);

    /* Semantic */
    --success: oklch(0.65 0.2 145);
    --warning: oklch(0.75 0.18 85);
    --info: oklch(0.6 0.15 250);

    /* Domain: Departments */
    --dept-kitchen: oklch(0.65 0.2 40);
    --dept-floor: oklch(0.65 0.15 180);
    --dept-bar: oklch(0.55 0.2 300);
    --dept-event: oklch(0.65 0.18 85);
    --dept-storage: oklch(0.55 0.1 200);

    /* Domain: Profile Status */
    --status-trainee: oklch(0.6 0.15 250);
    --status-active: oklch(0.65 0.2 145);
    --status-inactive: oklch(0.55 0 0);
    --status-offboarding: oklch(0.65 0.18 85);

    /* Domain: Priority */
    --priority-urgent: oklch(0.577 0.245 27.325);
    --priority-high: oklch(0.65 0.22 40);
    --priority-normal: oklch(0.6 0.15 250);
    --priority-low: oklch(0.55 0 0);
  }

  .dark {
    /* Surface — Dark */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);

    /* Charts — Dark */
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
    --chart-3: oklch(0.769 0.188 70.08);
    --chart-4: oklch(0.627 0.265 303.9);
    --chart-5: oklch(0.645 0.246 16.439);

    /* Sidebar — Dark */
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }
}
```

**Step 5: Create src/native.ts**

React Native theme export — same tokens, hex values (RN doesn't support OKLCH).

```typescript
// packages/design-tokens/src/native.ts
// React Native theme — hex conversions of OKLCH tokens.
// Update these when tokens.ts changes.

export const nativeTheme = {
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    card: "#ffffff",
    cardForeground: "#1a1a1a",
    primary: "#2d2d2d",
    primaryForeground: "#fafafa",
    secondary: "#f5f5f5",
    secondaryForeground: "#2d2d2d",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    border: "#e5e5e5",
    destructive: "#dc2626",
    success: "#16a34a",
    warning: "#d97706",
    info: "#2563eb",
    brandOrange: "#e85c0d",
  },
  dark: {
    background: "#1a1a1a",
    foreground: "#fafafa",
    card: "#2d2d2d",
    cardForeground: "#fafafa",
    primary: "#e5e5e5",
    primaryForeground: "#2d2d2d",
    secondary: "#3d3d3d",
    secondaryForeground: "#fafafa",
    muted: "#3d3d3d",
    mutedForeground: "#a3a3a3",
    border: "rgba(255,255,255,0.1)",
    destructive: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
    info: "#3b82f6",
    brandOrange: "#e85c0d",
  },
  department: {
    kitchen: "#e85c0d",
    floor: "#14b8a6",
    bar: "#8b5cf6",
    event: "#d97706",
    storage: "#6b7280",
  },
  status: {
    trainee: "#3b82f6",
    active: "#22c55e",
    inactive: "#6b7280",
    offboarding: "#d97706",
  },
  radius: { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 },
  spacing: { page: 32, section: 24, card: 20, element: 12, tight: 8 },
} as const;
```

**Step 6: Create src/index.ts**

```typescript
export * from "./tokens";
```

**Step 7: Commit**

```bash
git add packages/design-tokens/
git commit -m "feat: add design-tokens package — single source of truth for all styling

OKLCH tokens for web (CSS variables), hex conversions for React Native.
Brand, semantic, department, status, priority colors defined."
```

---

### Task 2.2: Replace app globals.css with token imports

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/landing/src/app/globals.css`
- Modify: `apps/web/package.json` (add dependency)
- Modify: `apps/landing/package.json` (add dependency)

**Step 1: Add design-tokens dependency to both apps**

In both `apps/web/package.json` and `apps/landing/package.json`:
```json
"@smartout/design-tokens": "workspace:*"
```

**Step 2: Replace apps/web/src/app/globals.css**

```css
@import "tailwindcss";
@import "@smartout/design-tokens/tokens.css";
@plugin "tailwindcss-animate";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  /* Domain tokens */
  --color-dept-kitchen: var(--dept-kitchen);
  --color-dept-floor: var(--dept-floor);
  --color-dept-bar: var(--dept-bar);
  --color-status-trainee: var(--status-trainee);
  --color-status-active: var(--status-active);
  --color-status-inactive: var(--status-inactive);
  --color-status-offboarding: var(--status-offboarding);
  --color-brand-orange: var(--brand-orange);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 3: Replace apps/landing/src/app/globals.css**

```css
@import "tailwindcss";
@import "@smartout/design-tokens/tokens.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-brand-orange: var(--brand-orange);

  --animate-ping: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer utilities {
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: oklch(0.35 0 0);
    border-radius: 20px;
  }
}
```

**Step 4: Verify both apps start**

Run: `pnpm --filter web dev` — check no CSS errors.
Run: `pnpm --filter landing dev` — check no CSS errors.

**Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/landing/src/app/globals.css apps/*/package.json
git commit -m "feat: replace local CSS variables with design-tokens import

Both web and landing now import @smartout/design-tokens/tokens.css.
Single source of truth for all colors, radii, and domain tokens."
```

---

### Task 2.3: Rebuild packages/ui as dumb components

**Files:**
- Modify: `packages/ui/package.json` (remove telemetry dependency)
- Create: `packages/ui/src/lib/utils.ts`
- Modify: `packages/ui/src/components/button.tsx` (remove telemetry)
- Move: `apps/web/src/components/ui/dialog.tsx` → `packages/ui/src/components/dialog.tsx`
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/label.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/skeleton.tsx`
- Create: `packages/ui/src/components/separator.tsx`
- Create: `packages/ui/src/components/status-badge.tsx`
- Update: `packages/ui/src/index.ts`

**Step 1: Remove telemetry from package.json**

Remove `"@smartout/telemetry": "workspace:*"` from dependencies. Add `@smartout/design-tokens`:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@smartout/design-tokens": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.575.0",
    "tailwind-merge": "^3.5.0"
  }
}
```

**Step 2: Create src/lib/utils.ts**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Rewrite button.tsx — remove telemetry**

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
```

**Step 4: Move dialog.tsx from apps/web to packages/ui**

Copy `apps/web/src/components/ui/dialog.tsx` to `packages/ui/src/components/dialog.tsx`.
Update imports to use `../lib/utils` instead of `@/lib/utils`.
Delete original from `apps/web/src/components/ui/`.
Update web app imports from `@/components/ui/dialog` to `@smartout/ui`.

**Step 5: Create remaining core components**

Use shadcn/ui patterns (all dumb, all CSS-variable based). Each component follows the same pattern:
- CVA for variants
- `cn()` for class merging
- Forwarded refs
- No business logic, no telemetry, no data fetching

Create `input.tsx`, `label.tsx`, `badge.tsx`, `card.tsx`, `skeleton.tsx`, `separator.tsx` following standard shadcn/ui implementations.

**Step 6: Create status-badge.tsx (domain-specific dumb component)**

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        trainee: "bg-status-trainee/15 text-status-trainee",
        active: "bg-status-active/15 text-status-active",
        inactive: "bg-status-inactive/15 text-status-inactive",
        offboarding: "bg-status-offboarding/15 text-status-offboarding",
      },
    },
    defaultVariants: {
      status: "active",
    },
  },
);

type StatusBadgeProps = VariantProps<typeof statusBadgeVariants> & {
  label: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ status }), className)}>{label}</span>;
}
```

**Step 7: Update index.ts barrel export**

```typescript
export { Button, buttonVariants, type ButtonProps } from "./components/button";
export * from "./components/dialog";
export * from "./components/input";
export * from "./components/label";
export * from "./components/badge";
export * from "./components/card";
export * from "./components/skeleton";
export * from "./components/separator";
export { StatusBadge } from "./components/status-badge";
export { cn } from "./lib/utils";
```

**Step 8: Verify**

Run: `pnpm --filter @smartout/ui typecheck`
Expected: No errors.

**Step 9: Commit**

```bash
git add packages/ui/ apps/web/src/components/ui/
git commit -m "feat: rebuild packages/ui as dumb component library

Remove telemetry dependency. Add core shadcn components (input, label, badge,
card, skeleton, separator). Add StatusBadge for domain-specific status display.
All components use CSS variables only — no hardcoded colors, no isDark ternaries."
```

---

### Task 2.4: Delete packages/tailwind-config (dead code)

**Files:**
- Delete: `packages/tailwind-config/` (entire directory)

**Step 1: Verify nothing imports it**

Search for `@smartout/tailwind-config` in all package.json files and imports.
Expected: Zero references.

**Step 2: Delete**

Run: `rimraf packages/tailwind-config`

**Step 3: Commit**

```bash
git add packages/tailwind-config pnpm-lock.yaml
git commit -m "chore: delete packages/tailwind-config — unused dead code

Brand colors were defined here but never imported by any app or package.
Design tokens package replaces this entirely."
```

---

## Phase 3: Telemetry Completion (~6 hours)

Depends on Phase 1 (configs) and Phase 2 (ui/telemetry decoupled).

The `@smartout/telemetry` package already has a partial implementation:
- `registry.ts` (225 lines, 11 events, routing map) — **exists, needs expansion**
- `emit.ts` (53 lines, routes to 3 destinations) — **exists, functional**
- `providers/posthog.ts` (44 lines) — **exists, functional**
- `providers/logger.ts` (32 lines) — **exists, functional**
- `providers/activity-trail.ts` (57 lines) — **exists, migration is `00005_activity_trail.sql`**
- `hooks/use-track.ts` (63 lines) — **exists, uses mock IDs**

---

### Task 3.1: Audit existing activity_trail migration + harden RLS

**Files:**
- Audit: `supabase/migrations/00005_activity_trail.sql` (EXISTING — do NOT recreate)
- Create: `supabase/migrations/[timestamp]_activity_trail_improvements.sql`

> **IMPORTANT:** The `activity_trail` table already exists in migration `00005_activity_trail.sql`.
> This task adds a partial index for query performance and hardens the INSERT policy.

**Step 1: Verify existing migration**

Run: `cat supabase/migrations/00005_activity_trail.sql`

Confirm it has: table, 4 indexes (entity, actor, workspace_time, category), RLS enabled, SELECT + INSERT policies. If anything is missing, add it to the new migration below.

**Step 2: Generate improvement migration**

Run: `npx supabase migration new activity_trail_improvements`

```sql
-- Activity Trail improvements:
-- 1. Partial index for recent data (most queries hit last 90 days)
-- 2. Harden INSERT policy to service_role only (was WITH CHECK(TRUE) for all roles)

-- Partial index: speeds up the most common queries (recent activity)
CREATE INDEX IF NOT EXISTS idx_activity_recent
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC)
  WHERE created_at >= NOW() - INTERVAL '90 days';

-- Drop the permissive INSERT policy and replace with service_role-only
DROP POLICY IF EXISTS "System can insert activity" ON activity_trail;

CREATE POLICY "Service role can insert activity" ON activity_trail
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- Still no UPDATE or DELETE policies. The trail remains immutable.
```

**Step 3: Apply and regenerate types**

Run: `npx supabase db reset`
Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts
git commit -m "fix: add partial index + harden activity_trail INSERT policy

Adds 90-day partial index for query performance (most reads are recent).
Restricts INSERT to service_role only — prevents any authenticated user
from writing directly to the audit trail."
```

---

### Task 3.2: Create /api/telemetry beacon endpoint

**Files:**
- Create: `apps/web/src/app/api/telemetry/route.ts`

**Step 1: Create the endpoint with Zod validation**

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";

// Strict schema — rejects unknown events at the boundary
const BeaconEventSchema = z.object({
  event: z.string().min(1).max(200),
  workspace_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  properties: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BeaconEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Fire-and-forget — don't block the response
    void emit(parsed.data);

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/telemetry/
git commit -m "feat: add /api/telemetry beacon endpoint

Receives client-side events via sendBeacon/fetch. Routes to PostHog,
logger, and activity trail via emit(). Fire-and-forget, returns 202."
```

---

### Task 3.3: Add PostHog provider to root layout

**Files:**
- Create: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Create providers.tsx**

```typescript
"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";
import { env } from "@/env";

export function PHProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage+cookie",
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

**Step 2: Wrap layout with provider**

Add `<PHProvider>` around `{children}` in `apps/web/src/app/layout.tsx`.

**Step 3: Commit**

```bash
git add apps/web/src/app/providers.tsx apps/web/src/app/layout.tsx
git commit -m "feat: add PostHog provider to root layout

Client-side analytics via reverse proxy (/ingest). Autocapture disabled —
all events go through typed registry."
```

---

### Task 3.4: Fix useTrack hook — non-breaking migration from mock IDs

**Files:**
- Modify: `packages/telemetry/src/hooks/use-track.ts`

> **NON-BREAKING:** The current hook is called as `useTrack()` with no args (e.g., in `packages/ui/src/components/button.tsx`).
> Making params required would break existing callers. Instead: make params optional with mock fallback + deprecation warning.

**Step 1: Refactor to accept optional IDs**

```typescript
import { useCallback, useEffect, useRef } from "react";
import type { SmartoutEvent } from "../registry";
import { EVENT_ROUTING } from "../registry";
import { sendToPostHogClient } from "../providers/posthog";

const MOCK_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

type TrackFn = <E extends SmartoutEvent>(
  event: E["event"],
  properties: E["properties"],
) => void;

/**
 * Track telemetry events.
 *
 * @param workspaceId - Real workspace ID from auth context. Falls back to mock if omitted (deprecated).
 * @param profileId - Real profile ID from auth context. Falls back to mock if omitted (deprecated).
 */
export function useTrack(workspaceId?: string, profileId?: string): { track: TrackFn } {
  const warnedRef = useRef(false);

  useEffect(() => {
    if ((!workspaceId || !profileId) && !warnedRef.current && process.env.NODE_ENV === "development") {
      console.warn(
        "[telemetry] useTrack() called without workspaceId/profileId — using mock IDs. " +
        "Pass real IDs from auth context to enable production telemetry."
      );
      warnedRef.current = true;
    }
  }, [workspaceId, profileId]);

  const wsId = workspaceId ?? MOCK_WORKSPACE_ID;
  const actorId = profileId ?? MOCK_PROFILE_ID;

  const track: TrackFn = useCallback(
    (event, properties) => {
      const fullEvent = {
        event,
        properties,
        workspace_id: wsId,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
      } as SmartoutEvent;

      const routing = EVENT_ROUTING[event];

      if (routing.destinations.includes("posthog")) {
        sendToPostHogClient(fullEvent);
      }

      if (
        routing.destinations.includes("activity_trail") ||
        routing.destinations.includes("logger")
      ) {
        const payload = JSON.stringify(fullEvent);
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/telemetry", payload);
        } else {
          void fetch("/api/telemetry", {
            method: "POST",
            body: payload,
            keepalive: true,
          });
        }
      }
    },
    [wsId, actorId],
  );

  return { track };
}
```

**Step 2: Commit**

```bash
git add packages/telemetry/src/hooks/use-track.ts
git commit -m "fix: make useTrack accept optional IDs (non-breaking)

Params are optional — falls back to mock IDs with dev-only console warning.
Existing callers (Button, etc.) continue working without changes.
Production callers should pass real workspaceId + profileId from auth context."
```

---

## Phase 4: Watchdog & Monitoring (~8 hours)

Depends on Phase 1 (CI), Phase 3 (telemetry for alerting context).

---

### Task 4.1: Add health check endpoints to all services

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`
- Create: `apps/landing/src/app/api/health/route.ts`
- Modify: `services/scrapling/main.py`
- Create: `supabase/functions/health-check/index.ts`

**Step 1: Web health endpoint**

> **NOTE:** The DB check uses `createClient` from `@supabase/supabase-js` directly with the
> service role key — NOT the RLS-aware server client from `@smartout/supabase/server`.
> The RLS client requires an authenticated user session and would fail on an unauthenticated
> health check request.

```typescript
// apps/web/src/app/api/health/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CheckResult = { status: "pass" | "fail"; latency_ms?: number; error?: string };

type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: Record<string, CheckResult>;
};

const isProd = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  // Optional bearer guard — if HEALTH_CHECK_SECRET is set, require it
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
  }

  const checks: HealthStatus["checks"] = {};
  let overall: HealthStatus["status"] = "healthy";

  // Check Supabase connection using service role (bypasses RLS)
  const dbStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { error } = await supabase.from("company").select("company_id").limit(1);
    checks.database = {
      status: error ? "fail" : "pass",
      latency_ms: Date.now() - dbStart,
      // Strip error details in production — log instead
      ...(error && (isProd ? {} : { error: error.message })),
    };
    if (error) {
      overall = "degraded";
      if (isProd) console.error("[health] DB check failed:", error.message);
    }
  } catch (e) {
    checks.database = {
      status: "fail",
      latency_ms: Date.now() - dbStart,
      ...(isProd ? {} : { error: String(e) }),
    };
    overall = "unhealthy";
    if (isProd) console.error("[health] DB check exception:", e);
  }

  // Check memory
  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = {
    status: heapPercent > 90 ? "fail" : "pass",
    latency_ms: 0,
  };
  if (heapPercent > 90) overall = "degraded";

  const response: HealthStatus = {
    status: overall,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    checks,
  };

  return NextResponse.json(response, {
    status: overall === "unhealthy" ? 503 : 200,
  });
}
```

**Step 2: Landing health endpoint**

Simpler — no database check needed.

```typescript
// apps/landing/src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}
```

**Step 3: Add health check to Python scrapling service**

Add to `services/scrapling/main.py`:

```python
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "scrapling",
    }
```

**Step 4: Supabase Edge Function health check**

```typescript
// supabase/functions/health-check/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Auth gate — prevent unauthorized access to infrastructure details
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const checks: Record<string, unknown> = {};

  // DB connectivity (service role bypasses RLS)
  const { error } = await supabase.from("company").select("company_id").limit(1);
  checks.database = { status: error ? "fail" : "pass" };

  // Edge Function runtime
  checks.runtime = { status: "pass", deno_version: Deno.version.deno };

  return new Response(
    JSON.stringify({
      status: error ? "degraded" : "healthy",
      timestamp: new Date().toISOString(),
      checks,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

**Step 5: Commit**

```bash
git add apps/web/src/app/api/health/ apps/landing/src/app/api/health/ services/scrapling/main.py supabase/functions/health-check/
git commit -m "feat: add health check endpoints to all services

/api/health on web (DB + memory), landing (basic), scrapling (/health).
Supabase Edge Function health-check for DB + runtime.
Returns 503 when unhealthy for load balancer integration."
```

---

### Task 4.2: Add rate limiting middleware

**Files:**
- Create: `packages/utils/src/rate-limit.ts`
- Create: `apps/web/src/lib/rate-limit.ts`
- Modify: `apps/web/src/env.ts` (add UPSTASH env vars)

> **NOTE:** Next.js App Router does NOT support route-level `middleware.ts` files.
> Rate limiting is applied directly inside route handlers using the utility below.

**Approach:** Use Upstash Redis for serverless-compatible rate limiting (works with Vercel). Falls back to in-memory for local dev.

**Step 1: Install Upstash**

Run: `pnpm --filter web add @upstash/ratelimit @upstash/redis`

**Step 2: Create rate limiter utility**

```typescript
// packages/utils/src/rate-limit.ts

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

// In-memory fallback for local dev (no Redis)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(opts: {
  maxRequests: number;
  windowMs: number;
}) {
  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const entry = memoryStore.get(key);

      if (!entry || now > entry.resetAt) {
        memoryStore.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { success: true, limit: opts.maxRequests, remaining: opts.maxRequests - 1, reset: now + opts.windowMs };
      }

      entry.count++;
      const remaining = Math.max(0, opts.maxRequests - entry.count);
      return {
        success: entry.count <= opts.maxRequests,
        limit: opts.maxRequests,
        remaining,
        reset: entry.resetAt,
      };
    },
  };
}
```

**Step 3: Create Upstash rate limiter for production**

```typescript
// apps/web/src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use Upstash in production, memory in dev
export const apiRateLimit =
  process.env.UPSTASH_REDIS_REST_URL
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(20, "60 s"),
        analytics: true,
        prefix: "smartout:api",
      })
    : null;

export const authRateLimit =
  process.env.UPSTASH_REDIS_REST_URL
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, "60 s"),
        analytics: true,
        prefix: "smartout:auth",
      })
    : null;
```

**Step 4: Add env vars to apps/web/src/env.ts**

Add to server section:
```typescript
UPSTASH_REDIS_REST_URL: z.string().url().optional(),
UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
```

**Step 5: Commit**

```bash
git add packages/utils/src/rate-limit.ts apps/web/src/lib/rate-limit.ts apps/web/src/env.ts apps/web/package.json
git commit -m "feat: add rate limiting with Upstash Redis

Sliding window rate limits for API (20/min) and auth (5/min).
In-memory fallback for local development without Redis."
```

---

### Task 4.3: Add error tracking with Sentry

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/src/env.ts`

**Step 1: Install Sentry**

Run: `pnpm --filter web add @sentry/nextjs`

**Step 2: Create sentry.client.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
```

**Step 3: Create sentry.server.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
```

**Step 4: Create sentry.edge.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
});
```

**Step 5: Wrap next.config.ts with Sentry**

```typescript
import { withSentryConfig } from "@sentry/nextjs";
// ... existing config ...
export default withSentryConfig(nextConfig, {
  silent: true,
  org: "smartout",
  project: "web",
});
```

**Step 6: Add env vars**

Add to `apps/web/src/env.ts`:
```typescript
// Server
SENTRY_DSN: z.string().url().optional(),
// Client
NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
```

**Step 7: Commit**

```bash
git add apps/web/sentry.*.ts apps/web/next.config.ts apps/web/src/env.ts apps/web/package.json
git commit -m "feat: add Sentry error tracking

Client + server + edge configs. Disabled in development.
10% trace sampling, 100% error replay capture."
```

---

### Task 4.4: Create data integrity watchdog Edge Function

**Files:**
- Create: `supabase/functions/watchdog-integrity/index.ts`

This runs on a schedule (via cron or n8n) and checks for data anomalies.

**Step 1: Create the Edge Function**

```typescript
// supabase/functions/watchdog-integrity/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface IntegrityCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  count?: number;
  details?: string;
}

Deno.serve(async (req) => {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const checks: IntegrityCheck[] = [];

  // 1. Orphaned profiles (workspace deleted but profiles remain)
  const { count: orphanedProfiles } = await supabase
    .from("profile")
    .select("*", { count: "exact", head: true })
    .is("workspace_id", null);
  checks.push({
    name: "orphaned_profiles",
    status: (orphanedProfiles ?? 0) > 0 ? "fail" : "pass",
    count: orphanedProfiles ?? 0,
  });

  // 2. Company members without user_identity
  const { data: danglingMembers } = await supabase.rpc("check_dangling_company_members");
  checks.push({
    name: "dangling_company_members",
    status: (danglingMembers?.length ?? 0) > 0 ? "warn" : "pass",
    count: danglingMembers?.length ?? 0,
  });

  // 3. Stale sessions (department_session stuck in 'active' > 24h)
  const { count: staleSessions } = await supabase
    .from("department_session")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  checks.push({
    name: "stale_active_sessions",
    status: (staleSessions ?? 0) > 0 ? "warn" : "pass",
    count: staleSessions ?? 0,
  });

  // 4. Workspaces without any profiles
  const { data: emptyWorkspaces } = await supabase.rpc("check_empty_workspaces");
  checks.push({
    name: "empty_workspaces",
    status: (emptyWorkspaces?.length ?? 0) > 0 ? "warn" : "pass",
    count: emptyWorkspaces?.length ?? 0,
  });

  // 5. Expired invitations not cleaned up (> 30 days old, still pending)
  const { count: expiredInvites } = await supabase
    .from("invitation")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  checks.push({
    name: "expired_pending_invitations",
    status: (expiredInvites ?? 0) > 10 ? "warn" : "pass",
    count: expiredInvites ?? 0,
  });

  const hasFailures = checks.some((c) => c.status === "fail");
  const hasWarnings = checks.some((c) => c.status === "warn");

  const result = {
    status: hasFailures ? "unhealthy" : hasWarnings ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    checks,
  };

  // Log for structured logger pickup
  console.log(JSON.stringify({
    level: hasFailures ? "error" : hasWarnings ? "warn" : "info",
    action: "watchdog_integrity_check",
    category: "system",
    ...result,
  }));

  return new Response(JSON.stringify(result), {
    status: hasFailures ? 503 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Create helper RPC functions (migration)**

Run: `npx supabase migration new watchdog_rpc_functions`

```sql
-- Helper functions for watchdog integrity checks

CREATE OR REPLACE FUNCTION check_dangling_company_members()
RETURNS TABLE(company_member_id UUID, user_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT cm.company_member_id, cm.user_id
  FROM company_member cm
  LEFT JOIN user_identity ui ON cm.user_id = ui.user_id
  WHERE ui.user_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION check_empty_workspaces()
RETURNS TABLE(workspace_id UUID, workspace_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT w.workspace_id, w.name
  FROM workspace w
  LEFT JOIN profile p ON w.workspace_id = p.workspace_id
  WHERE p.profile_id IS NULL
    AND w.created_at < NOW() - INTERVAL '1 day';
$$;
```

**Step 3: Commit**

```bash
git add supabase/functions/watchdog-integrity/ supabase/migrations/
git commit -m "feat: add data integrity watchdog Edge Function

Checks: orphaned profiles, dangling members, stale sessions,
empty workspaces, expired invitations. Returns structured JSON
for monitoring integration."
```

---

### Task 4.5: Add security monitoring middleware

**Files:**
- Create: `apps/web/src/lib/security.ts`
- Modify: `apps/web/src/middleware.ts`

**Step 1: Create security utilities**

```typescript
// apps/web/src/lib/security.ts

// Suspicious patterns to watch for
const SUSPICIOUS_PATHS = [
  "/wp-admin",
  "/wp-login",
  "/.env",
  "/phpmyadmin",
  "/admin/config",
  "/.git",
  "/actuator",
];

const SUSPICIOUS_HEADERS = ["x-forwarded-host", "x-original-url"];

export function detectSuspiciousRequest(req: Request): {
  suspicious: boolean;
  reasons: string[];
} {
  const url = new URL(req.url);
  const reasons: string[] = [];

  // Path traversal
  if (url.pathname.includes("..") || url.pathname.includes("//")) {
    reasons.push("path_traversal");
  }

  // Known attack paths
  if (SUSPICIOUS_PATHS.some((p) => url.pathname.toLowerCase().startsWith(p))) {
    reasons.push("known_attack_path");
  }

  // Suspicious headers (host header injection)
  for (const header of SUSPICIOUS_HEADERS) {
    if (req.headers.get(header)) {
      reasons.push(`suspicious_header:${header}`);
    }
  }

  // Oversized query string (potential injection)
  if (url.search.length > 2048) {
    reasons.push("oversized_query");
  }

  return { suspicious: reasons.length > 0, reasons };
}
```

**Step 2: Integrate into middleware.ts**

Add security check at the top of the middleware function. If suspicious, log and return 400.

```typescript
import { detectSuspiciousRequest } from "@/lib/security";

// At the top of middleware function:
const { suspicious, reasons } = detectSuspiciousRequest(request);
if (suspicious) {
  console.log(JSON.stringify({
    level: "warn",
    action: "suspicious_request_blocked",
    category: "security",
    path: request.nextUrl.pathname,
    reasons,
    ip: request.headers.get("x-forwarded-for") ?? "unknown",
    timestamp: new Date().toISOString(),
  }));
  return new NextResponse("Bad Request", { status: 400 });
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/security.ts apps/web/src/middleware.ts
git commit -m "feat: add security monitoring middleware

Blocks path traversal, known attack paths (wp-admin, .env, .git),
host header injection, oversized query strings. Logs to structured logger."
```

---

### Task 4.6: Add uptime monitoring with cron health checks

**Files:**
- Create: `supabase/functions/watchdog-uptime/index.ts`

This Edge Function pings all service health endpoints and logs results.

**Step 1: Create uptime checker**

```typescript
// supabase/functions/watchdog-uptime/index.ts

interface ServiceCheck {
  service: string;
  url: string;
  status: "up" | "down" | "degraded";
  latency_ms: number;
  statusCode?: number;
  error?: string;
}

const SERVICES = [
  { service: "web", url: Deno.env.get("WEB_URL") ?? "https://app.smartout.ai" },
  { service: "landing", url: Deno.env.get("LANDING_URL") ?? "https://smartout.ai" },
];

async function checkService(service: string, baseUrl: string): Promise<ServiceCheck> {
  const url = `${baseUrl}/api/health`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    const body = await res.json().catch(() => null);

    return {
      service,
      url,
      status: res.ok ? (body?.status === "degraded" ? "degraded" : "up") : "down",
      latency_ms: latency,
      statusCode: res.status,
    };
  } catch (e) {
    return {
      service,
      url,
      status: "down",
      latency_ms: Date.now() - start,
      error: String(e),
    };
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const checks = await Promise.all(
    SERVICES.map((s) => checkService(s.service, s.url)),
  );

  const anyDown = checks.some((c) => c.status === "down");
  const anyDegraded = checks.some((c) => c.status === "degraded");

  const result = {
    status: anyDown ? "outage" : anyDegraded ? "degraded" : "operational",
    timestamp: new Date().toISOString(),
    checks,
  };

  // Structured log
  console.log(JSON.stringify({
    level: anyDown ? "error" : anyDegraded ? "warn" : "info",
    action: "watchdog_uptime_check",
    category: "system",
    ...result,
  }));

  // If anything is down, could trigger alert via webhook here
  // e.g., POST to n8n webhook for Slack/email notification

  return new Response(JSON.stringify(result), {
    status: anyDown ? 503 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Commit**

```bash
git add supabase/functions/watchdog-uptime/
git commit -m "feat: add uptime monitoring Edge Function

Pings /api/health on web and landing. Reports up/down/degraded status.
Structured logs for monitoring pipeline. Can trigger alerts via n8n webhook."
```

---

### Task 4.7: Update GitHub Actions CI with health check validation

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add build verification step**

Add after the build job:

```yaml
  verify:
    name: Post-Build Verification
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      # Verify package exports resolve correctly
      - name: Verify package exports
        run: |
          pnpm --filter @smartout/types exec tsc --noEmit
          pnpm --filter @smartout/supabase exec tsc --noEmit
          pnpm --filter @smartout/ui exec tsc --noEmit
          pnpm --filter @smartout/telemetry exec tsc --noEmit
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add post-build verification to CI

Validates package exports resolve correctly after build.
Catches broken cross-package imports before deploy."
```

---

## Phase Summary & Dependency Graph

```
Phase 1: Tooling Foundation
├── 1.1 Shared TypeScript config
├── 1.2 Shared ESLint config
├── 1.3 Prettier config
├── 1.4 Turbo pipeline + root scripts
├── 1.5 Husky + lint-staged
└── 1.6 GitHub Actions CI

Phase 2: Design System (depends on Phase 1)
├── 2.1 Design tokens package
├── 2.2 Replace app globals.css with token imports
├── 2.3 Rebuild packages/ui as dumb components
└── 2.4 Delete packages/tailwind-config

Phase 3: Telemetry Completion (depends on Phase 1 + 2)
├── 3.1 Audit activity_trail + harden RLS (partial index, service_role INSERT)
├── 3.2 /api/telemetry beacon endpoint (Zod validated)
├── 3.3 PostHog provider in root layout
└── 3.4 Fix useTrack hook (non-breaking, optional params)

Phase 4: Watchdog & Monitoring (depends on Phase 1 + 3)
├── 4.1 Health check endpoints (web, landing, scrapling, edge)
├── 4.2 Rate limiting (Upstash Redis)
├── 4.3 Error tracking (Sentry)
├── 4.4 Data integrity watchdog (Edge Function)
├── 4.5 Security monitoring middleware
├── 4.6 Uptime monitoring (Edge Function)
└── 4.7 CI health check validation
```

---

## ADR Required

After completing this plan, create **ADR-0017: Enterprise Infrastructure — Shared Configs, Design System, Monitoring** documenting:
- Shared TypeScript/ESLint config pattern
- Design tokens as single source of truth
- Telemetry three-destination architecture
- Watchdog monitoring approach
- Sentry + Upstash integration decisions

---

## CLAUDE.md Updates Required

After completing this plan, update CLAUDE.md with:
1. New packages: `@smartout/typescript-config`, `@smartout/eslint-config`, `@smartout/design-tokens`
2. Removed package: `@smartout/tailwind-config`
3. New dev commands: `check`, `typecheck`, `clean`, `db:*`
4. New endpoints: `/api/health`, `/api/telemetry`
5. New Edge Functions: `health-check`, `watchdog-integrity`, `watchdog-uptime`
6. Monitoring stack: Sentry, Upstash Redis, structured logging
7. Updated ADR table with ADR-0017
