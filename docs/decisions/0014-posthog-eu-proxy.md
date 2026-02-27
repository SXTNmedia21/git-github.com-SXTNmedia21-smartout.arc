# ADR-0014: PostHog EU Instance with Reverse Proxy

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout operates in Norway and must comply with GDPR. Product analytics require a privacy-compliant setup.

## Decision

We use **PostHog EU instance** (`eu.i.posthog.com`) with Next.js reverse proxy rewrites to avoid ad blocker interference.

### Proxy Configuration

In `apps/web/next.config.ts`:

```typescript
async rewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
  ];
}
```

### Package

PostHog SDK lives in `@smartout/telemetry` with both browser (`posthog-js`) and server (`posthog-node`) clients.

### Environment Variables

```
NEXT_PUBLIC_POSTHOG_KEY    — Project API key
NEXT_PUBLIC_POSTHOG_HOST   — Default: https://eu.i.posthog.com
```

## Rationale

- EU instance keeps data within EU boundaries (GDPR compliance)
- Reverse proxy prevents ad blockers from blocking analytics requests
- First-party domain (`/ingest/*`) is not flagged by blockers
- Shared `@smartout/telemetry` package ensures consistent event tracking across apps

## Consequences

- All analytics requests route through our own domain — no direct PostHog calls from client
- PostHog EU may have slightly higher latency for non-EU users (acceptable for Norway-focused product)
