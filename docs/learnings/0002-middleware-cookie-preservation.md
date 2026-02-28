---
id: 0002
title: Next.js middleware must copy cookies to redirect responses
status: canonical
date: 2026-02-28
tags: [middleware, auth, cookies, next.js, supabase]
layer: learning
---

# Learning-0002: Next.js middleware must copy cookies to redirect responses

## Context

The platform-admin middleware in `apps/web/src/middleware.ts` calls `updateSession()` to refresh Supabase auth cookies, then performs additional auth checks. When a non-super-admin user hit a platform-admin route, the middleware redirected them — but the redirect response was a fresh `NextResponse.redirect()` that did NOT carry the refreshed cookies from `updateSession()`.

## Discovery

When Next.js middleware creates a new redirect response (via `NextResponse.redirect()`), it starts with an empty cookie jar. The `updateSession()` call writes refreshed auth tokens onto the _original_ response object. If a redirect is returned instead, those cookies are silently lost.

The fix is to explicitly copy all cookies from the session-updated response onto any redirect:

```typescript
const loginRedirect = NextResponse.redirect(new URL("/login", request.url));
response.cookies.getAll().forEach((cookie) => {
  loginRedirect.cookies.set(cookie.name, cookie.value);
});
return loginRedirect;
```

This must be done at every redirect point in middleware — not just auth redirects.

## Impact

- Every middleware redirect after `updateSession()` must copy cookies from the original response
- Failure to do this causes silent auth session loss — users may appear logged out after redirect
- This pattern applies to any Next.js middleware that both refreshes tokens AND conditionally redirects

## References

- File: `apps/web/src/middleware.ts`
- PR: #6 (Platform Admin Backoffice)
- Code review finding, fixed before merge
