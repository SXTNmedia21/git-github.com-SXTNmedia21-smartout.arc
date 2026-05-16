---
title: "Journey — E2E: rapid navigation verifies multi-owner counter integrity"
feature: domain-chat-ownership-e2e
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, e2e, playwright, adr-0337, counter-integrity]
---

# Journey: Playwright spec verifies Map<string,number> counter symmetry

**Precondition:** Web dev server runs at `localhost:3060`. `loginAsAdmin()` fixture seeds admin user. BotssonShell has `data-testid="botsson-orb"`. At least one channel exists for komm/thread.

1. Test runs `loginAsAdmin(page)` → lands on `/dashboard` → `expectOrbActive(page)`.
2. Test navigates `/dashboard/komm/chat` → `expectOrbPassive(page)` (counter = 1, reason=komm-chat).
3. Test navigates `/dashboard/komm/thread/<id>` → `expectOrbPassive(page)` (counter transitions: komm-chat unmount decrements, komm-thread mount increments; brief overlap may show counter=2 then settle at 1).
4. Test navigates `/dashboard/schedule` → `expectOrbActive(page)` (counter = 0, cleanup ran correctly on every navigation).
5. Test repeats sequence once more (komm/chat → schedule) to verify no state leaks between runs.

**Postcondition:** Spec green. Counter API integrity verified — declarations decrement symmetrically on unmount, no leak across rapid navigation.

**Error paths:**
- Orb stays passive on /dashboard/schedule after sequence → counter has leak; `declareDomainChatOwnership` cleanup function not returning correct decrement; ADR-0337 implementation bug.
- Orb flickers between passive/active during navigation → race condition in cleanup vs new mount; may need `waitForLoadState("networkidle")` between assertions; if persistent, council on whether cleanup ordering needs guarantee.
