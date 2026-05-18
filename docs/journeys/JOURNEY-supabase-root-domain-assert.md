---
title: "Journey — supabase-root-domain-assert"
status: done
updated: 2026-05-18
created: 2026-05-18
module: supabase
tags: [journey, supabase, env, auth, cookie-domain, production-safety]
---

# Journey — supabase-root-domain-assert

## Journey: Operator deploys to production without setting NEXT_PUBLIC_ROOT_DOMAIN

**Precondition:** `NEXT_PUBLIC_ROOT_DOMAIN` is absent from Vercel production environment variables. Codebase includes the assert in `packages/supabase/src/client.ts` and `packages/supabase/src/server.ts`.

1. Operator triggers a production deploy (HOP B: `preview → main` PR merged).
2. Vercel starts a new cold-start function instance.
3. First request to any route that imports `@smartout/supabase` (e.g. auth middleware, Server Component, Route Handler) causes Node.js to evaluate `packages/supabase/src/client.ts` or `server.ts`.
4. Module evaluation runs `assertRootDomain()` at the top level before any factory function is called.
5. `process.env.NEXT_PUBLIC_ROOT_DOMAIN` is empty/undefined. `NODE_ENV === "production"` and `VERCEL_ENV === "production"` both true.
6. `assertRootDomain()` throws: `"NEXT_PUBLIC_ROOT_DOMAIN is required in production. Missing value would cause cookie-domain drift between createBrowserClient and createServerClient, recreating the refresh-token rotation race ADR-0357 closed. Set the env var in Vercel (production scope) and redeploy."`
7. Vercel marks the function invocation as a 500 error. The deploy succeeds at the infrastructure level but every request fails at the application layer.
8. Vercel Function logs surface the thrown error with the full message and stack trace.
9. Operator reads the error message in Vercel Dashboard → navigates to Project Settings → Environment Variables → adds `NEXT_PUBLIC_ROOT_DOMAIN=smartout.ai` (production scope).
10. Operator triggers a redeploy (or Vercel auto-redeploys on env change).
11. New cold start evaluates the module. `process.env.NEXT_PUBLIC_ROOT_DOMAIN` is now `"smartout.ai"` (non-empty). `assertRootDomain()` returns immediately after setting `asserted = true`.
12. Application boots normally. Cookie domain is `.smartout.ai` on both browser and server clients.

**Postcondition:** Auth cookies are scoped consistently. Refresh-token rotation race does not resurface.

**Error paths:**
- If operator sets `NEXT_PUBLIC_ROOT_DOMAIN` to an empty string, the assert fires again (`.length > 0` check).
- If `VERCEL_ENV` is `"preview"` (staging deploy), the assert warns to stderr but does not throw — staging continues to function with a host-only fallback.

## Journey: Developer runs locally without NEXT_PUBLIC_ROOT_DOMAIN

**Precondition:** `.env.template` does not have `NEXT_PUBLIC_ROOT_DOMAIN` set (or it is empty). Developer runs `op run --env-file=.env.template -- pnpm dev`.

1. Next.js dev server starts. On first request, module evaluation calls `assertRootDomain()`.
2. `process.env.NODE_ENV` is `"development"`, `VERCEL_ENV` is undefined.
3. `isProduction` is false. `assertRootDomain()` calls `console.warn` once: `"[@smartout/supabase] NEXT_PUBLIC_ROOT_DOMAIN is unset..."`.
4. `asserted` flag set to true — subsequent imports of the module do not re-warn.
5. Application continues to boot. Cookies use host-only domain (correct for localhost).

**Postcondition:** Developer sees one warning in terminal on startup. No crash. Auth works locally.
