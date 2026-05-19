---
title: "Journey — admin opens /dashboard/admin/pos-accounts and sees POS connection state"
status: verified
feature: pos-accounts-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, admin, pos, page-polish, ui-shell, campaign-ui-shell]
---

# Journey — admin opens POS accounts overview

> Sub-sortie: `ui-shell-pos-accounts-polish`. Verifies Phase 6/7/8 outputs.

## Journey: Admin views POS integration state

**Precondition:** Admin signed-in, workspace seeded. POS account may or may not be connected.

1. Admin clicks "POS Integrasjoner" link or navigates directly to `/dashboard/admin/pos-accounts` → Server fetches `pos_account` rows scoped by workspace_id → Suspense fallback (loading.tsx) shows list-shape skeleton (header + 3 row pulses)
2. Data resolves → PosAccountsList client island mounts → User sees header "POS Integrasjoner" + subtitle + either populated list (per-account name + external_id + connected_at) OR empty state with "Koble til Lightspeed" CTA
3. Botsson chat available → tool kit `admin-pos-accounts` registered → `getPosAccountsState` returns account count + minimal metadata (NO oauth tokens) → admin asks "hvor mange POS er tilkoblet?" → answer specific

**Postcondition:** Admin understands POS state in <1s warm. Header description ≤140 chars. Empty state has icon + heading + body + CTA.

**Error paths:**
- Fetch fails → error.tsx renders with AlertCircle + retry + back-link "Tilbake til dashboard"
- Connect mutation fails (network/oauth) → modal inline error in PosAccountsList (existing path, preserved)
- Auth lost → server redirect to /login

## Verification

- Lighthouse LCP <1.5s warm (existing baseline lightweight)
- `grep "data-testid" loading.tsx error.tsx` → both files exist
- Site-map entry `/dashboard/admin/pos-accounts` present with tools verbatim
- `getPosAccountsState` returns no `oauth_token` field (PII safety)
- Manual Botsson probe → answers POS state question via page-scope tool, not capability fallback

## E2E (recommended)

`apps/web/e2e/admin-pos-accounts/admin-overview.spec.ts` — admin auth, navigate, assert loading→ready transition, assert tool registered via window inspector.
