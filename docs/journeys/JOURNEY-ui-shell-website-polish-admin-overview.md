---
title: "Journey — admin opens /dashboard/website overview"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, website, page-polish, ui-shell, campaign-ui-shell]
---

# Journey — admin opens `/dashboard/website` overview

> Sub-sortie: `ui-shell-website-polish`. Verifies Phase 1+2+4+6 outputs (speed, skeleton, tokens, instructions).

## Journey: Admin opens website overview

**Precondition:** Admin signed-in, workspace seeded, website may or may not have published pages.

1. Admin clicks "Nettside" in sidebar → System routes to `/dashboard/website` → Browser shows Server Component shell + Suspense fallback
2. Suspense resolves → `WebsiteOverview` client island mounts → User sees site status (URL, last published) + pages list, header description ≤140 chars, no skeleton-flash, no layout shift
3. Empty state (no pages) → User sees icon + heading + body + primary action "Lag første side" — never "Ingen data"

**Postcondition:** Admin understands site state in <1 s warm. LCP <1.5s, CLS <0.05.

**Error paths:**
- Auth fails → `redirect("/login")` (server-side, no client mount)
- Supabase fetch fails → error.tsx renders with retry copy + telemetry emit
- Workspace has no website row → empty state with "Lag første side" CTA

## Verification

- Lighthouse mobile + desktop: LCP <1.5s warm both views
- Performance recording: no blank-frame between skeleton ↔ ready
- `grep zinc-|gray-|slate-` in website tree = 0 hits
- Header `<h1 className="font-heading">` + description sentence present
- Empty state has icon + heading + body + button (not bare "Ingen data")

## E2E (recommended)

`apps/web/e2e/website-polish/admin-overview.spec.ts` — admin auth, navigate, assert testids `website-overview`, `website-empty`, `website-ready`.
