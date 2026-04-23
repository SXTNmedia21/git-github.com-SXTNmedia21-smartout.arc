---
title: Wave H — Auth & Invitation Refactor Handoff
status: complete
updated: 2026-04-22
created: 2026-04-22
module: auth
tags: [handoff, wave-h, browser-bff, route-handlers]
---

# Wave H Handoff

## Summary

Eliminated browser → Edge Function cross-origin pattern for invitation creation and 4 sibling endpoints. Deleted `create-invitation` Edge Function (~600 lines), replaced with `/api/admin/invite` route handler (~160 lines + ~300-line shared lib). Migrated 4 other browser-side `supabase.functions.invoke()` sites to same-origin proxy routes (`/api/engine-dispatch` already existed; created `/api/admin/change-proposals/[id]/apply`, `/api/reconciliation/{settlement-image/process,validate}`, `/api/shift-clock/compliance`). Closed prior council's `/update-password` ghost-route precondition (was already real from prior work). Landed 2 new ADRs + 3 amendments + 1 clarification + parity test.

## What shipped

| PR | Commits | Outcome |
|---|---|---|
| H.0 | 5 (3 amendments + 2 NEW ADRs + decision-log) | Trust Gate conditions 1, 2, 3 satisfied |
| H.1 | 4 (5 same-origin proxies, 5 browser callers updated) | CORS bug fixed for 5 of 6 browser invoke sites |
| H.2 | 7 (parity test + shared lib + route handler + dialog migration + Server Action migration + E2E spec + Edge Function deleted + dev-outbox stub) | `create-invitation` Edge Function deleted, Trust Gate conditions 4, 5 satisfied |
| H.3 | 1 (this handoff + council log) | Wave H closed |

Plus 1 chore commit fixing pre-existing CLAUDE.md formatting inherited from `#229`.

**Total: ~18 commits on `feat/wave-h-browser-invoke-cleanup`.**

## Decisions

- **ADR-0179 NEW** — Browser-Originated Mutations Route Through Next.js Route Handlers
- **ADR-0180 NEW** — Engine Event Parity Contract for Telemetry
- **ADR-0029 amendment** — Mutation Surface Selection table
- **ADR-0123 amendment** — `create-invitation` removed from pre-workspace exceptions, tripwire 3 → 2
- **ADR-0045 clarification** — `packages/notifications` is single dispatch surface

## Learnings

- **L-0103** (filed): phantom-emit briefing-staleness — Edge direct-inserts invisible to grep `emit\(`. Phase 2.5 fact-check must scan `supabase/functions/**/index.ts` for `from("activity_trail").insert` patterns. Caught this council Phase 5 — saved scope inflation. (Renumbered from L-0099 — collision with contracts council 2026-04-22.)
- **L-0104** (filed): audit-inflation 4th occurrence (Web Perf, Gate Migration, Year Wheel, Auth-Invitation Wave H). Briefings without code-trace verification inflate scope by 30%+.
- **L-0105** (filed): `supabase.functions.invoke()` from browser is anti-pattern (CORS + ADR-0045 silent violation + telemetry parity gap). Codified as ADR-0179.
- **L-0106** (filed): ADR-0123 tripwire fired in reverse direction. Counter went DOWN via migration (3→2 endpoints), threshold lowered. Tripwires can ratchet either direction.
- **NEW (Wave H discovery)**: Task 9 expected RED→GREEN on parity test, but registry routing for `invitation dispatched/cancelled/expired/resent` already excluded `engine_event` — test was GREEN from day one. Council Phase 5 conflated "Edge bypasses 2 of 4 destinations" with "engine_event missing for 5 events"; only the former was true.
- **NEW (Wave H discovery)**: `apps/web/src/lib/supabase-edge-invoke.ts` is NOT dead code as Task 11 claimed. 5 active call sites remain in onboarding wizard, setup wizard, and document-drop flows. Task 18 (deletion) aborted; deferred to Wave I.

## Closure verification council 2026-04-22 (post-implementation)

Trust Gate 5/5 PASS verified at code level. **APPROVE WITH CHANGES** — 4 follow-ups added to Wave I scope below. Council session: `docs/council/COUNCIL-LOG.md` 2026-04-22 Wave H Closure Verification.

**Duplicate-invite handling:** the `createInvitation()` lib has no application-layer pre-check, but migration `20260515140000_invitation_opened_at_and_partial_unique_pending.sql:32-34` adds partial UNIQUE INDEX `WHERE status='pending'` (ADR-0169). The deleted Edge Function ALSO had no pre-check — DB enforcement is the canonical guard, behavior is identical pre/post Wave H. Postgres 23505 surfaces as raw error today (UX gap, not data gap — Wave I should map to friendly 409). See L-0123.

## Known issues / debt (deferred to Wave I)

**Closure-council follow-ups (added 2026-04-22):**
- **C1 (HIGH, dormant):** Dialog `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx:556-567` reads `data?.dispatched/failed/count` but route returns `{invitations: InvitationResult[]}` (route.ts:136). Dead code today (mode early-returns), live the moment refactor touches it → "0 invitasjoner sendt" on successful batch. Fix: derive counts from `invitations[].outcomes`, OR have route return `{count, dispatched, failed, invitations}` to restore parity with deleted Edge Function shape.
- **C3 (HIGH, truth-claim):** "Single chokepoint" claim above is **partially false**. Mobile `apps/mobile/app/(auth)/verify.tsx:317-327` directly INSERTs `invitation` rows with `direction='inbound'` for join-requests, bypassing the lib (no auth gate, no telemetry, no notifications). Either route mobile inbound through `/api/admin/invite` with explicit `direction` parameter, OR amend this HANDOFF's narrative to "outbound chokepoint only".
- **C7 (MEDIUM):** `createInvitation()` always writes `invite_type='link'` regardless of channel. Pre-Wave-H rows had mixed `email/sms/link` enum; post-Wave-H all new rows are `link`. Schema/runtime drift — needs ADR (write ADR-0181) explaining "invite_type=transport-medium=link, channel selection lives in metadata.channels", OR migrate enum to `link`-only. Audit `get_invitation_by_token` RPC + analytics queries.
- **C2 (MEDIUM):** `invite_employment_type: z.string().optional()` in both `apps/web/src/lib/invitations.ts:53` and `apps/web/src/app/api/admin/invite/route.ts:48` — should be `z.enum(["employee","guest"]).optional()` to match DB CHECK constraint.
- **C6 (MEDIUM):** Lib falls back to `createAdminClient()` silently when no client passed (`apps/web/src/lib/invitations.ts:143`). Service-role bypass risk for any future caller (e.g., agent capability) that forgets to gate. Make `client` parameter required.

**Original Wave I scope:**

- **5 browser-side `supabase.functions.invoke()` sites still active** in:
  - `apps/web/src/components/dashboard/wizard-steps/DocumentDropStep.tsx:321` (analyze-setup-documents)
  - `apps/web/src/app/onboarding/wizard-definition.ts:292` (search-brreg)
  - `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (5 calls: lines 423, 580, 605, 652, 828)
  - `apps/web/src/app/dashboard/setup/wizard-definition.ts:295` (ingest-workspace-knowledge)
- **`apps/web/src/lib/supabase-edge-invoke.ts` wrapper retained** until those 5 migrations complete in Wave I.
- **Hybrid C fail-fast pattern** for remaining Edge Functions (push-dispatch, process-notifications, fire-delayed-triggers, accept-invitation) deferred to Wave I.
- **21 remaining Edge Functions still use `*` wildcard CORS** (security smell, not breaking).
- **`notification_outbox` extension** with `dispatch_mode='inbucket'` (for actual local mail capture) deferred to Wave I — `dev-outbox` page is UI scaffold only.
- **Stale comments to update** in H.3 follow-up:
  - `supabase/functions/accept-invitation/index.ts:16` (references deleted `create-invitation/index.ts`)
  - `packages/telemetry/src/registry.ts:5333,5338` (emit-site provenance comments point to deleted Edge Function — actual emit is now in `apps/web/src/lib/invitations.ts`)
  - `docs/architecture/modules/SMARTOUT_MODULE_1_ONBOARDING.md:136`, `apps/landing/src/app/docs/api/page.tsx:1992`, `2026-03-22-staff-handling-complete-design.md:160`, `2026-03-27-invitation-flow-core-fixes.md:60,77`
- **Older sections in ADR-0123 + ADR-0029** still reference pre-amendment counts. Amendment-takes-precedence pattern means these are correct chronologically but contradict in-place. Cosmetic, deferred.

## Next steps

- **Wave I (separate sortie):** migrate the 5 remaining browser invoke sites (onboarding/setup/document-drop), then delete `supabase-edge-invoke.ts` wrapper.
- **Wave I:** apply Hybrid C fail-fast to remaining Edge Functions. Document exclusions per ADR-0180.
- **Wave I:** wire `dev-outbox` page to extended `notification_outbox` table.
- **Mobile parity check:** `accept-invitation` stays Edge per ADR-0123 (pre-auth, mobile dependency at `apps/mobile/app/(auth)/verify.tsx:289`). No mobile-side changes needed.

## Trust Gate verification (final)

| # | Condition | Status |
|---|---|---|
| 1 | ADR-0179 lands BEFORE refactor commit (H.2) | PASS — commit `f0788cd5` (H.0) before `bc711159` (H.2 route) |
| 2 | ADR-0029 amendment lands with ADR-0179 | PASS — commit `c0f2670d` (H.0) |
| 3 | ADR-0123 amendment lands with ADR-0179 | PASS — commit `f97752bf` (H.0) |
| 4 | Engine_event parity test (`packages/telemetry/src/__tests__/parity.test.ts`) lands GREEN before H.2 merges | PASS — commit `b4a9bfec` (H.2 first commit), test GREEN throughout |
| 5 | Route handler `/api/admin/invite` has `runtime="nodejs"` + `maxDuration=60` | PASS — commit `bc711159` (H.2), verified by grep |

All 5 conditions PASS. Wave H ready for merge to `development`.
