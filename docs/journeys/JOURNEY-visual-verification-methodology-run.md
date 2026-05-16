---
title: "Journey — Developer runs visual verification methodology against chat-whatsapp Phase 1+2"
feature: domain-chat-ownership
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [journey, web, adr-0338, visual-verify]
---

# Journey: Developer runs ADR-0338 visual verification methodology

**Precondition:** ADR-0338 methodology doc exists at `docs/protocols/VISUAL-VERIFICATION-MOBILE.md`. PWA dev server runs at `localhost:8083`. Developer has Phase 1+2 chat-whatsapp work to audit.

1. Developer opens methodology doc → reads 4-step checklist.
2. **Step 1 — Token resolved-value audit**: Developer runs methodology's grep command (or one-shot script) to log actual hex values of `nativeTheme.colors.warnSoft`, `colors.muted`, `colors.brandOrange`, `colors.scrim`. Compares to design intent. Flags any token collision (same hex for two different roles).
3. **Step 2 — Motion timing audit**: Developer triggers each motion (swipe-reply, long-press scale, ReactionBar fade-in, sticky divider transition). Confirms spring physics applied per `nativeTheme.motion.springSnappy` vs default fallback.
4. **Step 3 — Side-by-side reference**: Developer opens WhatsApp on phone next to PWA. Compares own bubble vs other bubble (warm cream vs muted should differ obviously), receipt icon states, date divider styling.
5. **Step 4 — Gesture conflict check on PWA**: Developer tests swipe-reply gesture. Verifies horizontal pan doesn't compete with FlatList vertical scroll. Tests long-press doesn't trigger swipe accidentally.
6. Developer records findings to `docs/audits/2026-05-16-chat-whatsapp-visual-audit.md`. Each step: PASS / FAIL with evidence.

**Postcondition:** Audit doc exists with verified Phase 1+2 visual contract. Either all-pass with proof, or gap list with specific fix candidates for follow-up sortie.

**Error paths:**
- Phase 1 token-collision trap recurrence → audit flags identical hex; developer escalates to coordinator before further visual work lands.
- Motion fallback detected (CSS approximation defeating spring physics on PWA) → audit flags + recommends Reanimated config check.
- Gesture conflict found on PWA touch events → audit flags + recommends gesture-handler activeOffset tuning.
