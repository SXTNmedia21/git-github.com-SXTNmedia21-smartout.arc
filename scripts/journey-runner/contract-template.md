# Execution Contract: {{JOURNEY_ID}}

You are implementing a user journey for Smartout.

## Journey Spec

{{JOURNEY_SPEC}}

## Working Directory

{{ROOT}}

## Module

{{MODULE}}

## Reusable Components

{{REUSABLE_COMPONENTS}}

## Rules

- TypeScript strict, no `any`, `type` over `interface`
- App Router only, `"use client"` as deep as possible
- CSS variables only (`bg-background`, not `bg-zinc-950`)
- shadcn/ui components, lucide icons
- Every TanStack Query mutation must call `emit()` in `onSuccess`
- RLS on every workspace-scoped table
- `snake_case` for DB, `camelCase` for TS
- Do NOT hardcode Norwegian text — use i18n keys
- Do NOT create new tables without checking STATE.md first

## Verification

After implementation, the following must pass:

```bash
pnpm typecheck
pnpm lint
```

## Acceptance

- All files from the journey spec are created/modified
- Typecheck passes with 0 errors
- No `any` types introduced
- All mutations emit telemetry events
