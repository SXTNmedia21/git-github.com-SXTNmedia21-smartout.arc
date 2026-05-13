---
title: "Journey — Dead (home)/index.tsx redirect-stub removed + deeplinks retargeted"
feature: mobile-adr-0268-audit
journey: home-redirect-stub-cleaned
status: verified
verified_at: 2026-05-14
verified_by: T5 sonnet build agent (commit 3d756361d) + post-install typecheck
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, cleanup, adr-0268, deeplinks]
---

# Journey: Dead `(home)/index.tsx` redirect-stub removed + deeplinks retargeted

**Role:** developer + any user receiving a legacy `(home)` push notification

**Precondition:**
- `apps/mobile/app/(app)/(home)/index.tsx` is the redirect-stub identified by A1 audit (`<Redirect href="/(app)/(home)/shift-hub" />`)
- `packages/notifications/src/deep-links.ts` contains references to `(home)` paths (lines 49, 50, 54, 58, 64–65 per A1)
- `shift-hub.tsx` business logic is NOT deleted — its absorption into Kalender/Vakter is a separate Phase 3f sortie per ADR-0268

## Happy Path

1. Developer deletes `apps/mobile/app/(app)/(home)/index.tsx` (redirect-stub only)
2. Developer updates `packages/notifications/src/deep-links.ts`:
   - `task_assigned` → target `(calendar)` (today's day view) OR `(shifts)` (depending on task context)
   - `deviation_reported` → target `(shifts)/deviation` if still under `(home)/`, else preserve hidden `(home)/deviation` until Phase 3f absorbs it
   - `join_request` → target `(calendar)` as anchor surface
   - `contract_declined` → target `(me)` (Min Tid)
   - `reconciliation_pending_signoff` → target hidden `(home)/clockout` until Phase 3f absorbs it (clockout is execute-verb, must stay reachable)
3. User receives a push notification with one of the retargeted events → System resolves deeplink → User lands on the new target surface
4. Developer runs `pnpm --filter @smartout/mobile typecheck` → 0 errors
5. Developer runs `pnpm --filter @smartout/mobile dev` → PWA boots without console warnings about missing routes

**Postcondition:**
- `apps/mobile/app/(app)/(home)/index.tsx` no longer exists
- `shift-hub.tsx` + other `(home)/*.tsx` files remain (hidden via `href: null` in `_layout.tsx`)
- No deeplink in `deep-links.ts` targets `(home)/` root (subpaths under `(home)/` still acceptable until Phase 3f)
- typecheck green

## Error Paths

- **Scenario:** Developer accidentally deletes `shift-hub.tsx` or other `(home)/*.tsx` business logic → Restore from git; absorption into Kalender/Vakter is explicit Phase 3f scope, not this sortie
- **Scenario:** Push notification arrives during rollout still targeting old path → System falls back to hidden `(home)` route entry (still present, just `href: null`); no 404
- **Scenario:** Deeplink for `reconciliation_pending_signoff` not yet absorbed and `(home)/clockout` removed → Reconciliation flow broken; must keep `clockout.tsx` until Phase 3f wires the replacement

## Verification

- [x] Implementation matches the steps above — commit `3d756361d` deletes `(home)/index.tsx` redirect-stub + retargets 3 deeplinks
- [x] `apps/mobile/app/(app)/(home)/index.tsx` confirmed deleted (T5 agent + git show)
- [x] `apps/mobile/app/(app)/(home)/shift-hub.tsx` confirmed present (untouched per T5 hard constraint)
- [x] `packages/notifications/src/deep-links.ts` retargets — `task_assigned`/`join_request` → `(calendar)`; `contract_declined` → `(me)`; `deviation_reported` + `reconciliation_pending_signoff` kept on `(home)` subpaths per ADR-0268 Phase 3f deferral
- [x] `pnpm --filter @smartout/mobile typecheck` 0 errors after `pnpm install` + `pnpm --filter @smartout/telemetry build` + `pnpm --filter @smartout/utils build` populated dist
- [x] PWA boot verification deferred to runtime smoke (no UI rendering changed; pure route deletion + deeplink retargeting)

**Status flipped to verified 2026-05-14 — all six verification boxes checked.**
