---
id: "0008"
title: Vercel always sets x-forwarded-host — never treat it as suspicious
status: canonical
date: 2026-02-28
tags: [vercel, security, middleware, reverse-proxy]
layer: learning
---

# Learning-0008: Vercel always sets x-forwarded-host — never treat it as suspicious

## Context

After deploying smartout-web to Vercel, every request returned **400 Bad Request**. Build succeeded. Env vars were set. Supabase migrations applied. Yet every page load was blocked.

## Discovery

The middleware in `apps/web/src/middleware.ts` calls `detectSuspiciousRequest()` from `apps/web/src/lib/security.ts`. That function flagged `x-forwarded-host` as a suspicious header (host header injection attack vector).

The problem: **Vercel's edge network always sets `x-forwarded-host` on every request.** This is standard behavior for any reverse proxy (Vercel, Cloudflare, nginx, AWS ALB). In development, the check was skipped (`isDev` guard), so it never surfaced locally.

Result: 100% of production requests were blocked with 400.

## Impact

- `x-forwarded-host` is a legitimate, standard reverse proxy header — never flag it as suspicious
- Security checks must be tested against the production infrastructure (reverse proxy headers, CDN behavior)
- The dev-mode skip (`if (!isDev)`) masked this bug entirely during development
- `x-original-url` is less standard and can remain flagged, but verify it's not set by Vercel either

## Fix

Removed `x-forwarded-host` from `SUSPICIOUS_HEADERS` in `apps/web/src/lib/security.ts`.

## References

- File: `apps/web/src/lib/security.ts`
- File: `apps/web/src/middleware.ts`
- Related: Learning-0001 (Turbopack sets x-forwarded-host in dev)
