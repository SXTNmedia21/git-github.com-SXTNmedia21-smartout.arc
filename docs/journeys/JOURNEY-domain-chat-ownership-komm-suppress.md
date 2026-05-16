---
title: "Journey — Komm chat page mounts → Orb auto-suppresses"
feature: domain-chat-ownership
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, web, adr-0238, chat]
---

# Journey: Komm chat page mounts and Orb auto-suppresses to passive

**Precondition:** User signed in, on dashboard layout with BotssonShell active (Orb visible bottom-right). Navigating to `/dashboard/komm/chat`.

1. User clicks Komm tab → router navigates to `/dashboard/komm/chat`.
2. ChatPageClient mounts → `<DeclareDomainChatOwnership />` (or `useDeclareDomainChatOwnership()` hook) fires.
3. Context provider receives declaration → flips `isDomainChatOwned = true`.
4. BotssonShell re-renders → Orb enters passive mode:
   - Visual: smaller scale (0.7x), reduced opacity (0.5), no breathing animation
   - Behavior: hover doesn't trigger chat preview, click doesn't open Orb panel
5. User interacts with domain chat (Komm) normally — no Orb interference.
6. User navigates away from `/dashboard/komm/chat` → ChatPageClient unmounts → declaration cleanup fires → context reverts → Orb returns to active mode.

**Postcondition:** Single chat interaction surface at any time. No silent dual-surface ambiguity (which chat is the user sending to?).

**Error paths:**
- Provider not mounted at layout level → declaration is no-op, hook warns in dev mode.
- Page mounts during Orb chat session in progress → Orb suppresses but session state preserved; resumes on navigate away.
