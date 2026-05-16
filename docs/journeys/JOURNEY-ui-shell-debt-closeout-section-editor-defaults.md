---
title: "Journey — SectionEditor threads real isVisible + websiteIsLive to bridge tools"
status: verified
feature: debt-closeout
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, website, harness, ui-shell, campaign-ui-shell]
---

# Journey — SectionEditor threads real defaults

> Sub-sortie: `ui-shell-debt-closeout`. Closes HANDOFF-website-polish MEDIUM debt #1.

## Journey: Botsson getPageState returns accurate visibility + live status

**Precondition:** website-polish landed 2026-05-16 with SectionEditor bridge input hardcoding `isVisible: true` (page-level visibility not threaded) and `websiteIsLive: false` (conservative default). Tools `getPageState` and `getSaveActionState` return inaccurate fields. HACK comments added in commit `1943551ac`.

1. Admin navigates to `/dashboard/website/pages/[pageId]` for a page where `is_visible=false` and parent website `is_published=true` → SectionEditor mounts, fetches page row including `is_visible`, fetches website row including `is_published`
2. Bridge input receives real values: `isVisible: page.is_visible` (false) + `websiteIsLive: website.is_published` (true) → bridge tools mount with accurate snapshot
3. Admin asks Botsson "er denne siden synlig?" → Botsson invokes `getPageState` → returns `{ is_visible: false, ... }` → composes "Siden er skjult. Toggle synlighet i sidelisten." Correct answer.
4. Admin asks "er nettsiden publisert?" → `getSaveActionState` returns `{ website_is_live: true, ... }` → "Ja, publisert. Endringer her krever ny publisering for å bli live."

**Postcondition:** Botsson reads accurate per-page visibility + per-site live status. HACK comments removed from SectionEditor.tsx.

**Error paths:**
- Parent fetch fails (page not found) → SectionEditor error boundary fires (the one created in commit `498c0a50f` `pages/[pageId]/error.tsx`)
- Race between page fetch + bridge mount → bridge waits for `useEffect` dataRef refresh; tools return last-known until ready
- Page row missing `is_visible` column → fallback to schema default at DB layer, not hardcoded UI default

## Verification

- `grep -n "HACK" apps/web/src/app/dashboard/website/_components/SectionEditor.tsx` → 0 hits
- `grep -n "isVisible: true," apps/web/src/app/dashboard/website/_components/SectionEditor.tsx` → 0 literal-true hits
- Manual: open Botsson on a page with mixed visibility states, ask state question → answer reflects real DB state
- `pnpm --filter web typecheck` → 0 new errors in website tree

## E2E (recommended)

`apps/web/e2e/website-polish/page-editor.spec.ts` from earlier journey — extend to verify bridge tool returns match DB state for visibility + live flags.
