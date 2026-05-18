---
title: "ADR-0363 — Hard-fail at module load when NEXT_PUBLIC_ROOT_DOMAIN is unset in production"
status: accepted
updated: 2026-05-18
created: 2026-05-18
module: supabase
tags: [adr, supabase, env, auth, cookie-domain, production-safety]
---

# ADR-0363 — Production assert for NEXT_PUBLIC_ROOT_DOMAIN

## Status
Accepted — 2026-05-18.

## Context
ADR-0357 codified cookies-only auth handoff for Server Actions. The cookie domain is computed in two places: `packages/supabase/src/client.ts` (createBrowserClient) and `packages/supabase/src/server.ts` (createServerClient). Both fall back to host-only when `NEXT_PUBLIC_ROOT_DOMAIN` is unset.

In local dev (localhost), host-only is correct and parallel: both sides write to the same `localhost` cookie jar. In production however, the browser client writes the cookie under `app.smartout.ai` host-only, while the server reads `.smartout.ai` — the two scopes are disjoint, so the cookie set by signUp on app.smartout.ai is invisible to the server. The Server Action sees no session, calls `getUser()` → null → throws Not authenticated. ADR-0357's race resurfaces under a different label.

Track A review of F0 (ADR-0357) flagged this as a deploy-class bug waiting to happen: env-var omission produces a silent auth-race regression with no compile-time signal.

## Decision
Add a module-load-time assert in both client.ts and server.ts via shared helper `packages/supabase/src/_assert-root-domain.ts` that:
- Reads `process.env.NEXT_PUBLIC_ROOT_DOMAIN`.
- If unset AND `NODE_ENV === "production"` AND `VERCEL_ENV === "production"`: **throw** with a message naming the variable, the symptom, and ADR-0357.
- Otherwise: warn once to stderr.

`process.env.VERCEL_ENV` is `"production"` only for actual prod deploys; preview branches surface as `"preview"`, which we tolerate (warn only).

An idempotency flag (`asserted`) ensures the warn/throw fires at most once per module lifetime, preventing log spam on repeated imports.

## Consequences
- Missing env in prod = deploy fails fast on first Supabase client import, not after users start hitting refresh-token-already-used in support tickets.
- Dev/preview: noisy warning on first import; no crash.
- Adds one module-level side effect to the Supabase package. Side effect is idempotent (`asserted` flag) and pure (reads env).
- ADR-0357 stays the source of truth for "cookies are auth handoff"; this ADR is the operational safety net under that.

## Alternatives considered
- **Log-only in prod.** Rejected. Silent regression class — operators don't read logs until users complain.
- **Throw in dev too.** Rejected. Localhost works fine without the var; forcing developers to set it adds friction without safety gain locally.
- **Hard-default to `"smartout.ai"` everywhere.** Rejected. Wrong domain values produce wrong cookies, just with a different failure mode; defaulting masks env misconfiguration.
- **Move check to a startup script (preflight) instead of module-load.** Rejected. Startup scripts execute once before workers boot; module-load runs every cold start, catching env drift mid-life of a deployment if the env-sync ever rotates the value to empty.

## Related
- ADR-0357 (cookies-only auth handoff).
- ADR-0358 (expired-session rescue).
- Builder Track A F0 review (cited as the source of this finding).
