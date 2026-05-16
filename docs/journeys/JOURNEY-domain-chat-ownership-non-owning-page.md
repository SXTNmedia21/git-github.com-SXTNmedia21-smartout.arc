---
title: "Journey — Page without declaration → Orb stays active"
feature: domain-chat-ownership
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, web, adr-0238, chat]
---

# Journey: Page without ownership declaration keeps Orb active

**Precondition:** User signed in, on dashboard. Navigating to any page that does NOT embed a domain chat surface (e.g. `/dashboard/schedule`, `/dashboard/governance`).

1. User navigates to `/dashboard/schedule` → SchedulePage mounts.
2. SchedulePage does NOT call `useDeclareDomainChatOwnership()` (correct — it has no embedded chat).
3. Context provider stays at default `isDomainChatOwned = false`.
4. BotssonShell renders Orb in normal active mode:
   - Visual: full scale, full opacity, breathing animation, hover affordance
   - Behavior: hover triggers chat preview, click opens Orb panel
5. User can interact with Emma via Orb on top of SchedulePage content — single chat surface, no ambiguity.

**Postcondition:** Pages without embedded chat keep full Orb access — default behavior preserved.

**Error paths:**
- Audit sweep (T3) accidentally declares ownership on a page WITHOUT embedded chat → Orb wrongly suppresses, user loses access to Emma on that page. Recovery: remove declaration; audit policy = only declare when page has visible chat input surface.
