---
id: "0017"
title: Enterprise Infrastructure — Shared Configs, Design System, Monitoring
status: Accepted
date: 2026-02-27
layer: decision
---

# ADR-0017: Enterprise Infrastructure — Shared Configs, Design System, Monitoring

## Context and Problem Statement

The smartout_v3 monorepo had grown organically with duplicated configs across packages, no unified design tokens, incomplete telemetry, and zero monitoring. Each app had its own TypeScript config, ESLint setup, and color definitions. There was no CI pipeline, no pre-commit enforcement, and no way to detect data integrity issues or service outages.

## Decision Drivers

- Duplicate configs cause drift — one app gets stricter rules, another doesn't
- Hardcoded colors (zinc-800) bypass theming and break dark mode
- No CI means broken imports ship to production
- No monitoring means we learn about outages from users
- Activity trail INSERT policy was too permissive (any authenticated user could write)

## Considered Options

1. **Incremental fixes** — Fix configs one at a time as they cause problems
2. **Enterprise infrastructure overhaul** — Shared configs, design system, telemetry, monitoring in one coordinated effort
3. **Third-party platform** — Use Nx Cloud, Datadog, etc. for monitoring and CI

## Decision Outcome

**Option 2: Enterprise infrastructure overhaul** implemented in 4 phases:

### Phase 1: Tooling Foundation

- **@smartout/typescript-config** — Shared base, nextjs, react-library, library configs
- **@smartout/eslint-config** — Flat config (ESLint 9) with base, react, next presets
- **Prettier** — With tailwindcss plugin, enforced on commit via Husky + lint-staged
- **Turbo pipeline** — lint, typecheck, test, build, clean tasks with proper caching
- **GitHub Actions CI** — lint, typecheck, format, build, and post-build verification

### Phase 2: Design System

- **@smartout/design-tokens** — OKLCH color tokens, spacing, radii, shadows as CSS variables + TypeScript exports
- **globals.css migration** — Both web and landing import from design-tokens/tokens.css
- **@smartout/ui rebuild** — 9 dumb components (button, badge, card, dialog, input, label, separator, skeleton, status-badge) using design tokens
- **Deleted @smartout/tailwind-config** — Replaced entirely by design-tokens

### Phase 3: Telemetry Completion

- **Three-destination architecture** — PostHog (analytics), logger (structured JSON), activity_trail (immutable audit)
- **PostHog provider** — Client-side init with EU proxy, autocapture disabled, localStorage persistence
- **/api/telemetry beacon** — Zod-validated POST endpoint, fire-and-forget emit()
- **useTrack() migration** — Non-breaking: optional workspaceId/profileId with mock fallback
- **activity_trail hardening** — 90-day partial index, INSERT restricted to service_role only

### Phase 4: Watchdog & Monitoring

- **Health checks** — /api/health on web (DB + memory), landing (basic), scrapling (basic), Edge Function (DB + runtime)
- **Rate limiting** — Upstash Redis in production (20/min API, 5/min auth), in-memory fallback for dev
- **Sentry** — Client + server + edge configs, disabled in dev, 10% trace sampling
- **Security middleware** — Blocks path traversal, known attack paths, host header injection, oversized queries
- **Watchdog integrity** — Edge Function checking orphaned profiles, dangling members, stale sessions, expired invites
- **Watchdog uptime** — Edge Function pinging all service health endpoints
- **CI verification** — Post-build step validating package exports resolve correctly

## Rules & Consequences

### New Packages

| Package                     | Purpose                    |
| --------------------------- | -------------------------- |
| @smartout/typescript-config | Shared TS configs          |
| @smartout/eslint-config     | Shared ESLint flat configs |
| @smartout/design-tokens     | OKLCH tokens as CSS + TS   |

### Deleted Packages

| Package                   | Replaced By             |
| ------------------------- | ----------------------- |
| @smartout/tailwind-config | @smartout/design-tokens |

### Integration Points

- **Upstash Redis** — Rate limiting in production (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
- **Sentry** — Error tracking (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN)
- **Husky** — Pre-commit: eslint --fix + prettier --write via lint-staged

### New Endpoints

| Endpoint           | Service       | Purpose                   |
| ------------------ | ------------- | ------------------------- |
| /api/health        | web, landing  | Service health status     |
| /api/telemetry     | web           | Telemetry beacon (POST)   |
| /health            | scrapling     | Service health status     |
| health-check       | Edge Function | Supabase health status    |
| watchdog-integrity | Edge Function | Data integrity checks     |
| watchdog-uptime    | Edge Function | Service uptime monitoring |

### Rules for Future Development

- All new packages MUST extend from @smartout/typescript-config and @smartout/eslint-config
- All colors MUST use design tokens (CSS variables) — never hardcode hex/oklch values
- All API routes SHOULD check rate limits using the Upstash wrapper
- All telemetry events MUST go through the useTrack() hook or emit() function
- Activity trail INSERT is service_role only — never use anon client for audit writes
