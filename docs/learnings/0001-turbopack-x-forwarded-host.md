---
id: 0001
title: Next.js Turbopack sets x-forwarded-host in development
date: 2026-02-28
tags: [security, middleware, next.js, turbopack, development]
---

# Learning-0001: Next.js Turbopack sets x-forwarded-host in development

## Context

The security middleware in `apps/web/src/lib/security.ts` blocks requests containing `x-forwarded-host` headers as a defense against host header injection attacks. After deploying the enterprise infrastructure (ADR-0017), the web dashboard returned 400 Bad Request on every page load in local development.

## Discovery

Next.js 16 with Turbopack automatically injects the `x-forwarded-host` header on all localhost requests. This is normal proxy behavior — the dev server sits behind a proxy layer that adds forwarding headers. The security middleware was treating these legitimate dev requests as host header injection attacks.

## Impact

- Security header checks that block `x-forwarded-host` must be skipped in development (`NODE_ENV === "development"`)
- The check remains active in production where unexpected `x-forwarded-host` headers are genuinely suspicious
- Any future security middleware additions should be tested in dev before merging
- Fix applied in `apps/web/src/lib/security.ts` — gated behind `isDev` flag

## References

- Commit: `99c2ab7` — fix: skip x-forwarded-host security check in development
- File: `apps/web/src/lib/security.ts`
- Related: ADR-0017 (Enterprise Infrastructure)
