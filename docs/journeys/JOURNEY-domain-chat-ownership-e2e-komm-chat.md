---
title: "Journey — E2E: komm/chat declares ownership → Orb passive"
feature: domain-chat-ownership-e2e
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, e2e, playwright, adr-0337]
---

# Journey: Playwright spec verifies komm/chat suppresses Orb

**Precondition:** Web dev server runs at `localhost:3060`. `loginAsAdmin()` fixture seeds admin user. BotssonShell has `data-testid="botsson-orb"`.

1. Test runs `loginAsAdmin(page)` → lands on `/dashboard`.
2. Test calls `expectOrbActive(page)` → asserts Orb visible, scale=1, opacity=1, pointerEvents not "none", no aria-hidden.
3. Test navigates `page.goto("/dashboard/komm/chat")`.
4. Test calls `expectOrbPassive(page)` → asserts Orb visible, scale=0.7, opacity=0.5, pointerEvents="none", aria-hidden="true".
5. Test navigates back to `/dashboard`.
6. Test calls `expectOrbActive(page)` → asserts cleanup ran, Orb returned to active.

**Postcondition:** Spec green. ADR-0337 contract for komm/chat surface locked behind regression test.

**Error paths:**
- Orb selector returns null → testid missing → T1 didn't ship; test fails fast with clear message.
- Orb stuck passive after navigation away → cleanup leak in counter API → ADR-0337 implementation bug.
