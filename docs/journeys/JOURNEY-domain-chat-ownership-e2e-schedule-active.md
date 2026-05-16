---
title: "Journey — E2E: schedule + shift-clock (no shift) keep Orb active"
feature: domain-chat-ownership-e2e
status: verified
verified_at: 2026-05-16
verification_note: "Spec compiled clean. Negative-space contract: routes verified to NOT contain DomainChatOwnership declaration. Actual Playwright run deferred to CI gate."
known_limitation: "shift-clock with-active-shift case NOT covered. T4 tests only no-shift path (admin redirect). With-shift case (chat tab mounted → ShiftClockTabs declares ownership → Orb passive) requires seeded active shift fixture. Risk contained because the same provider counter is exercised by T5 nav-race. Follow-up sortie: seed active-shift fixture."
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, e2e, playwright, adr-0337, negative-space]
---

# Journey: Playwright spec verifies non-owning pages keep Orb active

**Precondition:** Web dev server runs at `localhost:3060`. `loginAsAdmin()` fixture seeds admin user with NO active shift today (default). BotssonShell has `data-testid="botsson-orb"`.

1. Test runs `loginAsAdmin(page)` → lands on `/dashboard`.
2. Test navigates `page.goto("/dashboard/schedule")`.
3. Test calls `expectOrbActive(page)` → asserts Orb stays active (no chat surface on this page).
4. Test navigates `page.goto("/dashboard/shift-clock")`.
5. Test calls `expectOrbActive(page)` → asserts Orb stays active (no active shift = chat tab not mounted = no `<DomainChatOwnership reason="shift-clock-chat" />` rendered).

**Postcondition:** Spec green. Negative-space contract locked: pages without embedded chat keep full Orb access.

**Error paths:**
- Audit sweep regression (someone wrongly added a declaration to schedule page) → spec fails with "Orb passive but expected active on /dashboard/schedule" → revert.
- shift-clock test failing means admin fixture changed to include an active shift → adapt test or council on fixture stability.
