# Smartout Landing (`apps/landing`)

Next.js 16 marketing + docs site. Port `3055`. Depends on `@smartout/ai`,
`@smartout/supabase`, `@smartout/i18n` (workspace packages).

## Build

ALWAYS go through Turbo so workspace dependencies build first:

```bash
pnpm turbo run build --filter=landing
```

DO NOT run `pnpm --filter landing build` directly — it skips
`@smartout/ai`'s build step and fails with:

```
Module not found: Can't resolve '@smartout/ai/agents/docs'
Module not found: Can't resolve '@smartout/ai/missions'
```

`@smartout/ai` exports point to `dist/`, which only exists after Turbo runs
the `^build` chain.

## Dev

```bash
pnpm dev                      # all apps via Turbo
pnpm turbo run dev --filter=landing   # landing only
```

Visit [http://localhost:3055](http://localhost:3055).

## Deploy

Vercel auto-deploys `main`. Preview deploys are manual:
`vercel --target preview --yes` from `apps/landing/`.
