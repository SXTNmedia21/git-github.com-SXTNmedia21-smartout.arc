---
title: "Package Exports Reference"
id: REF_PACKAGES
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [packages, monorepo, exports, dependencies, pnpm]
tables: []
changelog:
  - date: 2026-02-28
    change: "Initial version -- consolidated from CLAUDE.md + actual package.json files"
---

# Package Exports Reference

All monorepo packages with their export paths, dependencies, and build commands. Verified against actual `package.json` files.

---

## Package Overview

| Package                      | Name                        | Build            | Has Exports          |
| ---------------------------- | --------------------------- | ---------------- | -------------------- |
| `packages/ai`                | @smartout/ai                | `tsc` -> `dist/` | Yes (11 paths)       |
| `packages/supabase`          | @smartout/supabase          | `tsc`            | Yes (5 paths)        |
| `packages/types`             | @smartout/types             | `tsc` -> `dist/` | No (main/types only) |
| `packages/ui`                | @smartout/ui                | --               | No (main/types only) |
| `packages/design-tokens`     | @smartout/design-tokens     | --               | Yes (3 paths)        |
| `packages/eslint-config`     | @smartout/eslint-config     | --               | Yes (3 paths)        |
| `packages/typescript-config` | @smartout/typescript-config | --               | No (JSON files)      |
| `packages/telemetry`         | @smartout/telemetry         | --               | Yes (2 paths)        |
| `packages/notifications`     | @smartout/notifications     | --               | Yes (4 paths)        |
| `packages/utils`             | @smartout/utils             | --               | No (main/types only) |
| `packages/i18n`              | @smartout/i18n              | --               | No (main/types only) |

---

## @smartout/supabase

SSR-safe Supabase client with database types.

**Exports:**

| Path           | File                  | Purpose                                                  |
| -------------- | --------------------- | -------------------------------------------------------- |
| `.`            | `./src/index.ts`      | Barrel: types + all clients                              |
| `./middleware` | `./src/middleware.ts` | `updateSession` for Next.js middleware                   |
| `./client`     | `./src/client.ts`     | `createBrowserClient`                                    |
| `./server`     | `./src/server.ts`     | `createServerClient` with cookies                        |
| `./admin`      | `./src/admin.ts`      | `createAdminClient` -- service role, platform-admin only |

**Dependencies:**

- `@supabase/ssr` ^0.5.0
- `@supabase/supabase-js` ^2.45.0

**Dev dependencies:** `@smartout/eslint-config`, `@smartout/typescript-config`, `next` ^16.1.6, `typescript` ^5.0.0

---

## @smartout/ai

AI SDK agents, tools, and adapters. Pre-built via `tsc` to `dist/`.

**Exports:**

| Path                   | File                             | Purpose                           |
| ---------------------- | -------------------------------- | --------------------------------- |
| `.`                    | `./dist/index.js`                | Types + `defineTool` helper       |
| `./session-context`    | `./dist/session-context.js`      | Session context (Supabase-backed) |
| `./tools/onboarding`   | `./dist/tools/onboarding.js`     | Onboarding tools                  |
| `./schemas/onboarding` | `./dist/schemas/onboarding.js`   | Onboarding Zod schemas            |
| `./agents/onboarding`  | `./dist/agents/onboarding.js`    | Onboarding agent                  |
| `./agents/docs`        | `./dist/agents/docs.js`          | Docs agent                        |
| `./adapters/vercel-ai` | `./dist/adapters/vercel-ai.js`   | Vercel AI SDK adapter             |
| `./adapters/livekit`   | `./dist/adapters/livekit.js`     | LiveKit voice adapter             |
| `./missions`           | `./dist/missions/index.js`       | Mission registry + Ultravox       |
| `./tools/contract`     | `./dist/tools/contract/index.js` | Contract AI tools                 |
| `./agents/contract`    | `./dist/agents/contract.js`      | Contract agent                    |

**Dependencies:**

- `@openrouter/ai-sdk-provider` ^2.2.3
- `@smartout/supabase` workspace:\*
- `@supabase/supabase-js` ^2.45.0
- `ai` ^6.0.103 (Vercel AI SDK v6)
- `zod` ^3.25.76

---

## @smartout/types

Zod schemas for all domain types. Builds to `dist/`.

**Exports:** Main entry only (`dist/index.js`, `dist/index.d.ts`)

**Source structure:** `src/index.ts` exports: enums, identity, structure, governance, time

**Dependencies:**

- `zod` ^3.22.4

---

## @smartout/design-tokens

OKLCH color tokens, CSS + TS exports. Single source of truth for all colors, spacing, radii, shadows.

**Exports:**

| Path           | File               | Purpose                          |
| -------------- | ------------------ | -------------------------------- |
| `.`            | `./src/index.ts`   | OKLCH token constants            |
| `./tokens.css` | `./src/tokens.css` | CSS variables for all tokens     |
| `./native`     | `./src/native.ts`  | Hex conversions for React Native |

**Dependencies:** None

---

## @smartout/eslint-config

Shared ESLint flat config.

**Exports:**

| Path      | File          | Purpose                       |
| --------- | ------------- | ----------------------------- |
| `./base`  | `./base.mjs`  | TypeScript rules              |
| `./react` | `./react.mjs` | Extends base + React rules    |
| `./next`  | `./next.mjs`  | Extends react + Next.js rules |

**Dependencies:**

- `@typescript-eslint/eslint-plugin` ^8.0.0
- `@typescript-eslint/parser` ^8.0.0
- `eslint-plugin-import` ^2.31.0

---

## @smartout/typescript-config

Shared TypeScript configs. JSON files, no exports field.

**Files:**

| File                 | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `base.json`          | Base config (ES2022, strict, bundler)      |
| `nextjs.json`        | Next.js apps (extends base + DOM + JSX)    |
| `react-library.json` | React libraries (extends base + DOM + JSX) |
| `library.json`       | Pure TS libraries (extends base)           |

---

## @smartout/telemetry

PostHog + Supabase telemetry. Root export is server-safe (no React).

**Exports:**

| Path      | File             | Purpose                                         |
| --------- | ---------------- | ----------------------------------------------- |
| `.`       | `./src/index.ts` | Server-safe: event registry, emit(), routing    |
| `./react` | `./src/react.ts` | Client-only: `useTrack()` hook (requires React) |

**Dependencies:**

- `@supabase/supabase-js` ^2.98.0
- `posthog-js` ^1.240.0
- `posthog-node` ^4.5.0

**Peer dependencies:** `react` ^19.0.0

**Import rules:**

- API routes and server code: `import from "@smartout/telemetry"`
- Client components with tracking: `import from "@smartout/telemetry/react"`

---

## @smartout/notifications

Email + SMS sending via SendGrid/Twilio.

**Exports:**

| Path           | File                  | Purpose                                           |
| -------------- | --------------------- | ------------------------------------------------- |
| `.`            | `./src/index.ts`      | `sendEmail`, `createBroadcastJob`, `getJobStatus` |
| `./templates`  | `./src/templates.ts`  | Email template registry                           |
| `./audiences`  | `./src/audiences.ts`  | Audience filter types + resolvers                 |
| `./compliance` | `./src/compliance.ts` | Suppression list, classification                  |

**Dependencies:**

- `@sendgrid/mail` ^8.1.0
- `@supabase/supabase-js` ^2.98.0
- `twilio` ^5.5.0
- `zod` ^3.24.2

---

## @smartout/ui

Shared UI components. Uses design tokens via CSS variables.

**Exports:** Main entry only (`src/index.ts`)

**Components:** button, badge, card, dialog, input, label, separator, skeleton, status-badge, and `cn()` utility.

**Dependencies:**

- `@radix-ui/react-dialog` ^1.1.15
- `@radix-ui/react-label` ^2.1.8
- `@radix-ui/react-slot` ^1.2.4
- `@smartout/design-tokens` workspace:\*
- `class-variance-authority` ^0.7.1
- `clsx` ^2.1.1
- `lucide-react` ^0.575.0
- `tailwind-merge` ^3.5.0

**Peer dependencies:** `react` ^19.0.0, `react-dom` ^19.0.0, `tailwindcss` ^4.0.0

---

## @smartout/utils

Shared utilities.

**Exports:** Main entry only (`src/index.ts`)

**Dependencies:**

- `@smartout/types` workspace:\*
- `date-fns` ^4.1.0
- `zod` ^3.25.0

---

## @smartout/i18n

Internationalization package.

**Exports:** Main entry only (`src/index.ts`)

**Dependencies:** None

---

## Dependency Graph

```
@smartout/ai
  |-- @smartout/supabase
  |-- @supabase/supabase-js
  |-- ai (Vercel AI SDK v6)
  |-- @openrouter/ai-sdk-provider
  |-- zod

@smartout/supabase
  |-- @supabase/ssr
  |-- @supabase/supabase-js

@smartout/ui
  |-- @smartout/design-tokens
  |-- @radix-ui/*
  |-- class-variance-authority
  |-- clsx
  |-- tailwind-merge
  |-- lucide-react

@smartout/utils
  |-- @smartout/types
  |-- date-fns
  |-- zod

@smartout/types
  |-- zod

@smartout/telemetry
  |-- @supabase/supabase-js
  |-- posthog-js
  |-- posthog-node

@smartout/notifications
  |-- @sendgrid/mail
  |-- @supabase/supabase-js
  |-- twilio
  |-- zod

@smartout/design-tokens
  (no runtime deps)

@smartout/eslint-config
  |-- @typescript-eslint/*
  |-- eslint-plugin-import

@smartout/typescript-config
  (config files only)

@smartout/i18n
  (no runtime deps)
```

---

## Build Commands

| Package                 | Build | Dev           | Clean                |
| ----------------------- | ----- | ------------- | -------------------- |
| @smartout/ai            | `tsc` | --            | `rimraf dist .turbo` |
| @smartout/types         | `tsc` | `tsc --watch` | `rimraf dist .turbo` |
| @smartout/supabase      | `tsc` | --            | `rimraf dist .turbo` |
| @smartout/ui            | --    | --            | `rimraf dist .turbo` |
| @smartout/design-tokens | --    | --            | `rimraf dist .turbo` |
| @smartout/telemetry     | --    | --            | `rimraf dist .turbo` |
| @smartout/notifications | --    | --            | `rimraf dist .turbo` |
| @smartout/utils         | --    | --            | `rimraf dist .turbo` |
| @smartout/i18n          | --    | --            | `rimraf dist .turbo` |

All packages share: `lint` (`eslint src/`), `typecheck` (`tsc --noEmit`), `clean` (`rimraf dist .turbo`).
