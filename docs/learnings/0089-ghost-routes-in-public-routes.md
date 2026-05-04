---
title: "Ghost Routes in PUBLIC_ROUTES Are Worse Than 404s"
id: LEARNING_0089
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [middleware, auth, routing, trust-gate]
---

# Learning-0089: Ghost Routes in PUBLIC_ROUTES Are Worse Than 404s

## Context

During the Auth & Invitation Spec Scope Council (2026-04-20), agent-coordinator's code-trace of `apps/web/src/middleware.ts` found that `/update-password` is listed in the `PUBLIC_ROUTES` Set (line 16) but no corresponding page file exists at `apps/web/src/app/update-password/page.tsx`. The middleware authorizes unauthenticated traffic to reach a route Next.js cannot serve. The `force_password_reset` redirect at line 220 targets `/reset-password` (different route, which does exist), so the ghost entry serves no functional purpose — it is cruft from a prior iteration that was never cleaned up.

## Discovery

Ghost routes — entries in `PUBLIC_ROUTES` without backing page files — are a specific class of bug that is worse than a plain 404 in three ways:

1. **Middleware authorization layer lies.** Ops-level middleware says "this route is public", but Next.js says "this route does not exist". Users hitting the URL (e.g. from old email shares, bookmarks, or external links) get a 404 that looks like a server problem, not a design decision.
2. **Security review confusion.** A future security audit of public auth surface sees `/update-password` in the allowlist and assumes it must be hardened. It isn't — because it doesn't exist.
3. **Redirect target drift.** Middleware redirects to a different route than the PUBLIC_ROUTES entry suggests. Whoever wrote the original intent is gone; the gap is silent.

## Impact

- **Council review rule:** Any middleware change touching `PUBLIC_ROUTES` must diff against `apps/web/src/app/**/page.tsx` to confirm every listed route has a corresponding page segment.
- **Runtime assertion (preferred):** Add a boot-time check in middleware that iterates `PUBLIC_ROUTES` and verifies each has a matching route — fail loud in development, warn in production.
- **Cleanup discipline:** When deleting a route file, the PR must also delete its PUBLIC_ROUTES entry. When adding a route, the entry lands in the same commit as the page file.
- **This specific gap:** P0 action — either delete `/update-password` from `PUBLIC_ROUTES` immediately OR build the page (Q9=a in the auth spec resolves this by splitting /reset-password and /update-password into two routes).

## References

- ADR-0167 (invitation tokens as credentials — auth portal scope)
- Auth & Invitation Spec Scope Council (2026-04-20)
- `apps/web/src/middleware.ts:10-20` (PUBLIC_ROUTES set)
- `apps/web/src/middleware.ts:220` (force_password_reset redirect)

---

> Registered in `docs/learnings/0000-learning-log.md`.
