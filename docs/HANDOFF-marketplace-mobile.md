---
title: Handoff — marketplace-mobile (C2 follow-on sub-sortie)
status: done
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, marketplace, mobile, claim, e2e, s9, c2]
---

# Handoff — marketplace-mobile

Sub-sortie: `feat/world-best-wfm-marketplace-mobile`
Campaign: `campaign/world-best-wfm`
Parent campaign HANDOFF: `docs/HANDOFF-world-best-wfm.md` (root campaign)
C2 sortie (web + capability): merged as `17be004d1` into campaign.

## What Was Built

### Task 4 — Mobile Claim List

**Files:**

- `apps/mobile/app/(app)/(shifts)/marketplace.tsx` — new screen
- `apps/mobile/app/(app)/(shifts)/_layout.tsx` — added `<Stack.Screen name="marketplace" />`
- `apps/mobile/src/lib/web-api.ts` — added `getMarketplaceOpenOffersUrl()` + `getMarketplaceClaimUrl()`
- `apps/web/src/app/api/mobile/marketplace/claim/route.ts` — new BFF claim route

**Behaviour:**

- `FlatList` of `OpenOffer` cards: role pill (orange), time row (HH:MM–HH:MM + formatted date), department row.
- TanStack Query `refetchInterval: 30_000` while tab focused (`refetchIntervalInBackground: false`).
- Tap "Krev" → `ConfirmSheet` (Modal, slide animation) with shift detail + disclaimer.
- Tap "Bekreft" → `POST /api/mobile/marketplace/claim` (Bearer JWT) → optimistic gray-out → invalidate query.
- On failure: native `Alert` with translated blocker code(s).
- Card entrance animation: Reanimated `withSpring` using `nativeTheme.motion.springAmbient` (stiffness 35, damping 22, mass 2.2). Stagger capped at 4 rows × 24ms.
- Button press feedback: `nativeTheme.motion.springReactive` scale 0.96 → 1.

**ADR compliance:**

| ADR | How |
|-----|-----|
| ADR-0099 | BFF claim route calls `gate_action` before UPDATE |
| ADR-0132 | Mobile sends Bearer JWT to BFF; no direct DB writes |
| ADR-0133 | claim = Approve verb; mobile-allowed |
| ADR-0134 | `emit("shift_offer.claimed")` server-side in BFF with non-empty workspace_id + actor_id |
| ADR-0151 | workspace_id + profile_id never from body — `resolveMobileActor(token)` |
| ADR-0288 | claim is chat-only; BFF pins `p_channel: "chat"` in gate_action |
| L-0177 | `resolveMobileActor` returns null (→ 401) on empty ID; no silent fallback |

**Telemetry event `shift_offer.claimed` shape (per registry.ts):**

```ts
{
  event: "shift_offer.claimed",
  workspace_id: NonEmptyString,
  actor_id: NonEmptyString,
  properties: {
    entity: { entity_type: "schedule_shift_offer", entity_id: offerId },
    data: {
      schedule_shift_offer_id: offerId,
      shift_id: string,
      claimed_by_profile_id: profileId,
      auto_approved: false, // V1: always false; V2 may set true via authority config
    },
  },
}
```

### Task 5 — E2E P-marketplace-full-flow (S9)

**Files:**

- `apps/e2e/protocols/p-marketplace-full-flow.ts` — 11-step protocol
- `apps/e2e/protocols/index.ts` — registered as `S9: P_MARKETPLACE_FULL_FLOW`

**Protocol slug:** `"S9"` (`JP-R000-SHIFT-MARKETPLACE-FULL-FLOW`)
**Actors:** Manager (web) + Employee (mobile PWA)
**DB assertion mechanism:** `db_record` gates (JourneyIR v2.0.0 — `type: "db_record"`, `where`, `expect`, `retry_interval_ms`)

**Status flow asserted:**
`open` → `claimed` (step 7) → `approved` (step 11)

**`schedule_shift.employee_id` update:**
Asserted indirectly in step 10 via `schedule_shift_offer.status='approved'` gate.
Direct assertion on `schedule_shift.employee_id` deferred to Playwright V2 implementation (runner V1 only executes `db_record` on one table at a time).

## Decisions Made

1. **`db_query` action type does not exist** — JourneyIR action union is `navigate|fill|click|wait_visible|settle`. DB assertions go in `db_record` gates, not action arrays. All 3 "assert" steps use `{ type: "settle", ms }` action + `db_record` gate.

2. **`JourneyActor` is a single value** — `"manager+employee"` is invalid. Protocol sets `actor: "manager"` (the primary bootstrap actor). Employee steps documented in JOURNEY file.

3. **`emit("shift_offer.claimed")` data shape is registry-bound** — `auto_approved: boolean` is required; `claimed_at` is NOT in the schema. Fixed by reading `packages/telemetry/src/registry.ts` before wiring emit.

4. **`nativeTheme.motion.springAmbient` not `motionTokens.spring`** — Mobile uses Reanimated `withSpring`, not Framer Motion. Native tokens live in `packages/design-tokens/src/native.ts`. Web uses `motion` from `packages/design-tokens/src/tokens.ts`.

5. **`theme.colors.card` not `theme.colors.card ?? theme.colors.muted`** — `ThemeColors` union makes `??` fallback produce `never` in `createStyles`. Always use a single color key.

6. **Type regen skipped** — Docker unavailable in this environment. No new tables added by this sub-sortie (`schedule_shift_offer` was added by C2). Existing `database.types.ts` is current.

## Known Issues / Debt

| # | Issue | Severity |
|---|-------|----------|
| V1 | Pull-poll only (30s) — no push notification when offer is posted | Medium |
| V1 | Eligibility check is role-match only in BFF; full AML+overlap runs at claim time | Low |
| V1 | No deep-link into marketplace when manager posts from web | Low |
| V1 | `schedule_shift.employee_id` direct assertion missing from E2E (only indirect via offer status) | Low |
| V1 | `claimed_at` field written to DB but NOT emitted (not in telemetry schema) | Cosmetic |

## Next Steps (V2 / separate sorties)

1. Push fanout `shift-offer-notify` Edge Function (ADR-0136 token verify required first).
2. Auto-approve via `engine_authority_config` (workspace admin config decision needed).
3. Deep-link from manager web post → employee mobile notification.
4. Playwright runner wiring for `p-marketplace-full-flow.ts` (S9 runner not yet built).
5. Direct `schedule_shift.employee_id` assertion once runner V2 supports multi-table `db_record`.
