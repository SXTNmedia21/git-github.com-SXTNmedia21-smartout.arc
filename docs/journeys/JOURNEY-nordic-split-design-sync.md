---
title: Journey — Nordic Split Design Token Sync
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [design-tokens, nordic-split, dark-mode, mobile]
---

# Journey: Nordic Split Design Token Sync

## Journey: Developer Applies Design Token Updates

**Precondition:** Design token files (`tokens.ts`, `tokens.css`, `native.ts`) exist in the repo but contain stale "Ren og Varm" naming and incorrect dark mode values.

1. Developer pulls `development` branch → sees outdated token values
2. Developer opens `packages/design-tokens/src/tokens.ts` → finds warm OKLCH values, section comments, correct light/dark objects
3. Developer opens `packages/design-tokens/src/tokens.css` → finds dark mode block at `:root.dark` matching `tokens.ts` exactly
4. Developer opens `packages/design-tokens/src/native.ts` → finds full hex rewrite with warm values and OKLCH comments
5. Developer checks `CLAUDE.md` → sees design system named "Nordic Split" consistently

**Postcondition:** All token files are consistent. Dark mode surfaces match design spec. Mobile tokens use warm palette.

**Error paths:** N/A — token files are static source. No runtime errors possible.

---

## Journey: Admin Reads Design System Reference

**Precondition:** CLAUDE.md and landing page reference "Ren og Varm" (old name).

1. Admin reads `CLAUDE.md` → sees "Nordic Split" as design system name
2. Admin visits landing page → sees correct system name in title
3. Admin opens `docs/design/ren-og-varm-styleguide.html` → historical file retained but content matches current tokens

**Postcondition:** Design system is consistently named "Nordic Split" across all references.

**Error paths:** N/A — documentation-only change.
