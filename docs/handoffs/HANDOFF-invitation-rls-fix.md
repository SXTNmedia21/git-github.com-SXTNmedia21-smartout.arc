---
title: "Handoff — invitation-rls-fix"
feature: invitation-rls-fix
branch: feat/invitation-rls-fix
closed: 2026-04-06
module: onboarding
---

# Handoff — invitation-rls-fix

## Summary

Fixed 4 critical issues in the invitation flow to make the end-to-end path work: Admin invites → Email arrives → User clicks link → User is in the app. Core security fix replaces an insecure `USING(true)` RLS policy that exposed all invitation PII to anonymous users.

## What Was Done

- [x] Migration: drop insecure anon SELECT policy, create `get_invitation_by_token()` SECURITY DEFINER RPC
- [x] Profile status: set to `active` directly on invite acceptance (trainee deferred to engine_process)
- [x] Batch email dispatch: `handleBatchInvites()` now sends emails via SendGrid, CSV skips dispatch
- [x] Accept page: uses RPC instead of direct query, detects existing users (sign-in vs create-account)
- [x] Event type fix: engine_event uses `invitation.accepted` (dot-separated) to match engine_trigger convention
- [x] Council review: APPROVE WITH CHANGES — all conditions addressed

## Decisions Made

| Decision                                                                      | Reason                                                                             | Impact                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SECURITY DEFINER RPC replaces anon SELECT policy                              | USING(true) exposed all invitation PII to anonymous users                          | Token (UUID, 122-bit) acts as authorization. Non-pending returns status only.               |
| Profile status `active` directly                                              | Trainee mode not yet implemented, two-step was always setting active anyway        | engine_process step 5 is currently a no-op. Will need alignment when trainee mode is built. |
| Dual event naming: activity_trail space-separated, engine_event dot-separated | engine_trigger table uses dot convention, telemetry registry uses space convention | Both are correct in their context. Document in ADR if pattern spreads.                      |

## Learnings

| Learning                                                                        | Context                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| When rewriting flows that emit events, grep all consumers of that event type    | Silent dispatch mismatches produce zero errors but broken business logic. engine_dispatch does strict equality match. |
| SECURITY DEFINER + SET search_path is the correct pattern for token-scoped RPCs | Avoids search_path injection, runs as function owner to bypass RLS intentionally                                      |
| `database.types.ts` regeneration must redirect stderr                           | `npx supabase gen types` outputs npm warnings to stdout, corrupting the types file                                    |

## Known Issues / Debt

- No telemetry on `create-invitation` Edge Function (pre-existing, not introduced here)
- Hardcoded Norwegian text on accept page (~20 strings, spec defers i18n)
- Hardcoded OKLCH colors on accept page (~26 values, spec defers token migration)
- No motion/animation on accept page (spec defers Nordic Split UI redesign)
- No `aria-live="polite"` on error messages (accessibility gap)
- `sendEmailInvite` silently succeeds when SendGrid key is missing
- `createClient()` singleton behavior should be verified in useEffect dependency

## Next Steps

- Add `create-invitation` telemetry (emit "invitation created" to activity_trail + engine_event)
- Accept page UI redesign: CSS tokens, Framer Motion, dark mode, i18n, Nordic Split pattern
- Verify onboarding_journey engine process fires on `invitation.accepted` event
- Align trainee mode decision: engine_process-driven vs profile-status-driven
