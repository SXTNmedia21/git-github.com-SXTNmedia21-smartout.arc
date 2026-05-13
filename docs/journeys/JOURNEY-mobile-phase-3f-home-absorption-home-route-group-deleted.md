---
title: "Journey — (home) route group deleted; deeplinks + _layout cleaned"
feature: mobile-phase-3f-home-absorption
journey: home-route-group-deleted
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, cleanup, route-deletion, adr-0268, deeplinks]
---

# Journey: `(home)` route group deleted; deeplinks + `_layout.tsx` cleaned

**Role:** developer (this is a developer-facing closure journey)

**Precondition:**
- Council G2 mapping locked: every `(home)/*` file has ABSORB/DELETE/DEFER verdict
- B1 (shift-hub absorption) + B2 (clockout absorption) + B3 (remaining absorption/deletion) complete
- All moved `emit()` sites preserve `getProfileContext()` (ADR-0134)
- Sibling journeys (`shift-hub-views-absorbed` + `clockout-reachable-from-vakter`) at status verified

## Happy Path

1. Developer runs `ls apps/mobile/app/(app)/(home)/` → command exits with "No such file or directory" — entire folder deleted
2. Developer reads `apps/mobile/app/(app)/_layout.tsx` → no `<Tabs.Screen name="(home)" href={null} />` line; hidden screen registration removed
3. Developer greps `packages/notifications/src/deep-links.ts` for `(home)` → zero matches; all deeplinks target canonical 5-tab surfaces (Kalender/Vakter/Chat/Min Tid) or Council-decided sub-routes
4. Developer greps `apps/mobile/src/` for import paths containing `(home)` → zero matches
5. Developer runs `pnpm --filter @smartout/mobile typecheck` → 0 errors
6. Developer runs `pnpm turbo typecheck` → 0 errors
7. Developer boots PWA on `localhost:8083` → 5 tabs render; no console route warnings; no 404 on legacy paths during navigation

**Postcondition:**
- `(home)` folder absent on `feat/mobile-phase-3f-home-absorption` branch tip
- Zero internal references to `(home)/` paths anywhere in `apps/mobile/` or `packages/notifications/`
- ADR-0268 §"Tab removal sequence" item Hjem fully discharged
- ADR-0133 boundary preserved (no compose UIs added by absorption)
- Council G4 pre-merge verdict: GO

## Error Paths

- **Scenario:** Push notification for retired event arrives → `resolveDeepLink` returns canonical fallback target OR redirect shim resolves (per Council G2 fallback strategy)
- **Scenario:** Cached client app has stale push handler targeting `(home)/X` → Expo Router 404 caught at route boundary; toast "This screen has moved" + redirect to default tab
- **Scenario:** Deleted file was actually imported by a forgotten consumer outside `apps/mobile/` (e.g. packages/notifications types) → TypeScript surfaces at G3 typecheck gate; B-track agent must locate + fix before commit
- **Scenario:** Build pipeline caches stale routes → Vercel preview / Expo build artifact regenerated; smoke verifies on fresh artifact

## Verification

- [ ] Implementation matches the steps above
- [ ] `ls apps/mobile/app/(app)/(home)/` returns "No such file or directory"
- [ ] `_layout.tsx` confirmed: no `(home)` screen registration
- [ ] `grep -r "(home)" apps/mobile/ packages/notifications/` returns zero matches (excluding comments referencing the historical name)
- [ ] `pnpm --filter @smartout/mobile typecheck` 0 errors
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] PWA boot smoke green
- [ ] Council G4 verdict GO

**Mark `status: verified` in frontmatter when all eight boxes are checked.**
