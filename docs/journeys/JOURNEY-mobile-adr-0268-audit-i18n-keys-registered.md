---
title: "Journey — i18n keys registered for Kalender/Vakter/Chat/Min Tid"
feature: mobile-adr-0268-audit
journey: i18n-keys-registered
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, i18n, adr-0268]
---

# Journey: i18n keys registered for Kalender / Vakter / Chat / Min Tid

**Role:** developer (this is a developer-facing journey closing ADR-0268 R5 + accept-checklist item 5)

**Precondition:**
- `apps/mobile/app/(app)/_layout.tsx` reads tab labels from `strings.tabs.*` (confirmed by A1 audit)
- `packages/i18n/` exists and follows existing key convention
- `Min Tid` is the canonical label per ADR-0268 (rename from "Min side")

## Happy Path

1. Developer greps `packages/i18n/` for existing keys → confirms convention (e.g. `nb-NO.json` or TypeScript dictionary)
2. Developer verifies each canonical tab label has a registered key:
   - `tabs.kalender` → "Kalender"
   - `tabs.vakter` → "Vakter"
   - `tabs.chat` → "Chat"
   - `tabs.minTid` → "Min Tid"
3. Developer verifies `apps/mobile/app/(app)/_layout.tsx` references the keys via the strings dictionary (no hardcoded Norwegian)
4. Developer runs `pnpm --filter @smartout/mobile typecheck` → 0 errors
5. Developer runs `pnpm --filter @smartout/mobile dev` and verifies tab labels render correctly on PWA `localhost:8083`

**Postcondition:**
- All 4 tab labels resolved through `packages/i18n/`
- No `tabs.*` key referenced by `_layout.tsx` is missing from the i18n dictionary
- ADR-0268 R5 satisfied

## Error Paths

- **Scenario:** Key missing → Add to i18n dictionary, keep "Min Tid" as canonical bokmål title-case (not lowercase per ADR-0268)
- **Scenario:** Multiple language files exist and only `nb-NO` is updated → Add stubs to all configured locale files; English placeholder acceptable if Norwegian is primary
- **Scenario:** `_layout.tsx` has a hardcoded Norwegian string instead of a key reference → Replace with key reference

## Verification

- [ ] Implementation matches the steps above
- [ ] Grep `apps/mobile/app/(app)/_layout.tsx` for hardcoded `"Kalender"`, `"Vakter"`, `"Chat"`, `"Min Tid"`, `"Min side"` returns 0 matches outside i18n dictionary
- [ ] `pnpm --filter @smartout/mobile typecheck` 0 errors
- [ ] Manually verified tab labels render correctly on PWA `localhost:8083`

**Mark `status: verified` in frontmatter when all four boxes are checked.**
