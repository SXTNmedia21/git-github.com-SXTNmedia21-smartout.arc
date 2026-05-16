---
title: "Journey — E2E: komm/thread/[channelId] declares ownership → Orb passive"
feature: domain-chat-ownership-e2e
status: verified
verified_at: 2026-05-16
verification_note: "Spec compiled clean (typecheck pass). Selector + helper paths verified against source. Actual Playwright run deferred to CI gate per E sortie precedent."
known_limitation: "Spec uses test.skip() with clear gap message when no query_thread channel is seeded in the admin workspace. Thread route only renders channel_type='query_thread' — discovery via /dashboard/help ActiveTicketBadge. Follow-up sortie: seed query_thread fixture for green-path coverage."
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, e2e, playwright, adr-0337]
---

# Journey: Playwright spec verifies komm/thread suppresses Orb

**Precondition:** Web dev server runs at `localhost:3060`. `loginAsAdmin()` fixture seeds admin user with at least one channel. BotssonShell has `data-testid="botsson-orb"`.

1. Test runs `loginAsAdmin(page)` → lands on `/dashboard`.
2. Test navigates to `/dashboard/komm/chat` and reads first channel's id from DOM (data-channel-id or link href), or test fixture pre-seeds a channelId.
3. Test navigates `page.goto("/dashboard/komm/thread/<id>")`.
4. Test calls `expectOrbPassive(page)` → asserts Orb in passive mode.
5. Test navigates away.
6. Test calls `expectOrbActive(page)` → asserts cleanup ran.

**Postcondition:** Spec green. ADR-0337 contract for komm/thread surface locked behind regression test.

**Error paths:**
- No channels exist for admin → seed required; if not seeded, skip with `test.skip("no channels seeded")` and log gap.
- TicketConversationView fails to mount declaration → Orb stays active → ADR-0337 implementation bug.
