---
title: "Journey — Redirect-coherence guard (signup/invite recon outcome)"
feature: signup-invite-native-routing
status: verified
verified_at: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [journey, auth, mobile, redirect-coherence, recon, adr-0393]
---

# Journey — Mobile auth redirect-coherence holds

> **Scope collapsed by P0 recon (2026-05-22).** The originally-declared mobile
> signup + invite native-routing journeys were DISPROVEN, not invented away:
> mobile has no email-signup flow (invite-only/login-only), and invites use a
> custom `invitation`-table token + plain `/invite/<token>` Universal Link that
> already deep-links to the app — NOT GoTrue's `inviteUserByEmail`. So
> `confirm-sign-up` / `invite-user` GoTrue templates have no mobile consumer and
> got NO conditional. See ADR-0393. Only the guard shipped.

## Journey: Developer changes a mobile auth redirect and the guard blocks drift

**Precondition:** A mobile auth flow routes its email link to a native `/m/` screen
via an exact-match template conditional (today: reset → `/m/update-password`,
ADR-0390). The mobile `redirectTo` string and the template `eq` sentinel must stay
byte-equal or the template silently degrades mobile to web.

1. Developer edits `apps/mobile/.../verify.tsx` `redirectTo` (or the template `eq`
   sentinel) so the two diverge → `git push`.
   → husky pre-push runs `node scripts/check-redirect-coherence.mjs`.
   → guard prints `✗ … drift detected — "<a>" vs "<b>"`, exits 1, push blocked.
2. Developer aligns the two strings → push → guard prints `✓` → push proceeds.
**Postcondition:** Mobile auth links can't silently fall back to web from a
string-drift; the exact-match conditional stays honest.
**Error paths:** guard can't find either string (file moved/renamed) → fails with
the offending file named, forcing the registry to be updated.

**Verification (2026-05-22):** guard run ✓ exit 0 on current tree; injected drift
(trailing `/` on template sentinel) → ✗ exit 1; revert → ✓ exit 0.
