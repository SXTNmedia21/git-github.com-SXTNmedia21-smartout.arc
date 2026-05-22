---
title: "HANDOFF — OneSignal Push + Notification System"
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: MODULE_COMMUNICATION
feature: onesignal-push
tags: [handoff, notifications, push, onesignal, email, mailpit, deep-link, task-due]
---

# HANDOFF — OneSignal Push + Notification System

> Branch: `feat/onesignal-push` (worktree `~/dev/smartout.ai-wt-5`) — 28 commits.
> Spec: `docs/superpowers/specs/2026-05-21-notification-system-design.md`.
> Module docs: `docs/modules/notifications/` (11 files incl. ROADMAP).

## Summary — what was built

Started as "send push to mobile PWA via OneSignal" (Expo push is dead in a PWA), grew into hardening the unified 4-channel notification system. The funnel is unchanged: every notification flows through `notification_outbox` → `process-notifications` (cron, 30s) → fans out to **in_app / email / sms / push**. Only **push** was broken (Expo tokens need native builds); swapped to OneSignal. Along the way two latent bugs that silently killed the **email** channel were found and fixed, plus task-deadline notifications were added.

### Delivered
1. **OneSignal push channel** (ADR-0389) — `_shared/onesignal.ts` helper (new API `api.onesignal.com` + `Authorization: Key` + `include_aliases.external_id = profile_id`), `push-dispatch` swapped Expo→OneSignal, critical-event SMS fallback preserved (fires on `recipients === 0`), deep-link via OneSignal `url`.
2. **Mobile client** — web-guarded OneSignal Web SDK (`apps/mobile/src/lib/onesignal.ts`): `initOneSignal` / `loginOneSignal(profile_id)` / `logoutOneSignal` / `requestPushPermission` / `isPushEnabled`. SW shim at `apps/mobile/public/OneSignalSDKWorker.js`. Wired into `_layout.tsx` (init), `use-push-token.ts` (login), signout sites (logout). **"Aktiver varsler" gesture button** in NotificationScreen (iOS suppresses non-gesture permission prompts).
3. **Deep-link landing** — shared `apps/mobile/src/lib/deep-link.ts` (`mobileRouteForActionUrl`) maps web `/dashboard/*` paths → mobile Expo Router routes; catch-all `apps/mobile/app/dashboard/[...rest].tsx` redirects OneSignal `url` landings; NotificationScreen refactored to reuse the mapper. **Fixed a pre-existing routing bug** (contract events used `/dashboard/people/contracts` → landed on Team).
4. **Task-deadline notifications** — `task.due_soon` + `task.overdue` events + `task-due-reminder` pg_cron (every 15m) scanning `due_at` on `personal_task` + `emma_task`. (`session_task`/`schedule_day_task` excluded — DATE-only, no per-task time; their real-time push is day-line-push.)
5. **Email channel resurrected** — two latent bugs fixed (see below). Dev SMTP bridge to local Inbucket/Mailpit when `SENDGRID_API_KEY` absent.
6. **Module docs** — `docs/modules/notifications/` (README, MODULE_NOTIFICATIONS, ARCHITECTURE, DATA-MODEL, API, CONTRACTS, USER-FLOWS, E2E-COVERAGE, GAPS-AND-DEBT, BLUEPRINT, ROADMAP).
7. **1Password + env** — `onesignal` item in `smartout_ai` (dev vault), `.env.template` keys, prod Supabase Cloud secrets set + verified.

## Decisions (ADRs / key)
- **ADR-0389** — OneSignal as the push channel (Expo retired from outbox path). External ID = profile_id (no device-token DB column). Single OneSignal app dev+prod for now → isolate at first key rotation.
- **OneSignal REST = new API** (`api.onesignal.com` + `Key`), verified live (HTTP 200). v1 `Basic` is legacy. Empirically confirmed both work with `os_v2_` keys; chose new.
- **Mobile-only push origin** — `apps/web` does NOT init OneSignal → zero web subscribers → deep-link target is always `mobile.smartout.ai`.
- **denomailer rejected** — it refuses Mailpit's plaintext ("Connection is not secure"); reverted to raw-TCP SMTP which works.

## Learnings (this session)
1. **`profile` has no `phone` column** (phone is on `user_identity`). `process-notifications` did `.select("user_id, phone")` → query errored → `profile` null → `profileUserId` null → **email + SMS channels silently dead**. This was the real reason email never delivered. Fixed: `.select("user_id")` + resolve phone from `user_identity`. (Commit `672bc1586`.)
2. **`user_identity` PK is `user_id`, not `id`** — the email lookup `.eq("id", …)` always failed. Fixed (`f2109c025`).
3. **Local debugging rabbit-hole** — email-not-landing was mis-attributed in sequence to: stale serve bundle, WSL2 OOM (exit 144 on `supabase functions serve`), denomailer. None were the cause. Root cause found only by **instrumenting the branch** (`[EMAILDBG] profileUserId: null`). Lesson: instrument the actual branch state before swapping libraries.
4. **`supabase functions serve` spawns ~6 processes + multiple invocations leave zombies** — kong can route to a stale one. `supabase stop`/`start` + killing all `[f]unctions serve` pids clears it. `pkill -f "functions serve"` self-matches the shell → exit 144; use `ps | grep "[f]unctions serve"`.
5. **pg_net critical-trigger** (`dispatch_critical_notification`) fires on critical (priority-2) outbox insert → async POSTs `process-notifications`. Locally it needs `app.supabase_url` GUC (session `SET`, ALTER DATABASE is permission-denied) or the INSERT rolls back (null url → NOT NULL violation). It also async-consumes pending rows before a manual drain.

## Verification (evidence)
- **OneSignal REST** — live `curl` POST → 200, correct zero-recipient response. (isolated)
- **push-dispatch swap** — served locally, drove HTTP: non-critical → `{sent:false,recipients:0}`; critical → `sms_fallback:true` + `[Warning] No phone number…`; bad auth → 401.
- **in_app (bell)** — 6 staff notifications in `notification` table for anna.
- **email → Mailpit** — full staff bundle (6) + test landed; log `[dev] Email sent via local SMTP (inbucket:1025) to anna@smartout.local`.
- **deep-link mapper** — 9 unit tests pass.
- **mobile typecheck** — `pnpm --filter @smartout/mobile typecheck` exit 0 (after building telemetry/types/utils deps).
- **prod pg_cron** — `process-notifications` active, ran seconds-ago, succeeded; pg_cron 1.6.4, 27→28 jobs.

## NOT verified / pending
- **OneSignal push delivery to a real device** — 0 subscribers; needs deploy to `mobile.smartout.ai` + an iPhone (home-screen install, iOS 16.4+). The 3 journeys stay `draft` until then.
- **Deep-link tap at runtime** — proven in unit tests + catch-all route; not on a real device.
- **task-due cron in prod** — registered in migration; local skips (no pg_cron locally). Verify in prod after deploy.
- **Email subject template interpolation** — process-notifications resolves from event-config templates; demo metadata didn't fill `{date}`/`{start_time}` so they showed raw. Real events carry the vars — confirm with a real event.

## Known gaps / debt (also in `docs/modules/notifications/GAPS-AND-DEBT.md`)
- **2 Expo push senders still bypass push-dispatch** → dead in PWA: `engine-dispatch/handlers/day-line-push.ts` (ADR-0367 day-line) + `apps/web/.../platform-admin/communications/push/send/route.ts` (broadcast). Deferred (spec D2).
- **Two parallel deep-link mappers** — native `push.ts` uses `resolveDeepLink` from `@smartout/notifications/deep-links`; OneSignal web uses the new `lib/deep-link.ts`. Unify later.
- **Coarse preferences** — 3 modes + global channel toggles; per-mode×channel matrix is P2.
- **AI cannot send** — no `notify` capability tool; `set_reminder` wires engine state but dead-ends (no outbox handler). P3.
- **No mobile preferences UI** — `useNotificationPreferences` exists, web-only. P4.
- **morning-digest ignores `email_enabled`**; `grouping_window_sec` config ignored (hardcoded 3-min).
- **Single OneSignal app dev+prod** — isolate at first key rotation (~30d).

## Next steps (deploy + close)
1. **Operator (Pontus):** redirect whitelist `mobile.smartout.ai/**` in Supabase Auth; `EXPO_PUBLIC_ONESIGNAL_APP_ID` on the Vercel mobile project; verify `https://mobile.smartout.ai/OneSignalSDKWorker.js` serves JS (not SPA HTML).
2. **Deploy** `feat/onesignal-push` → `mobile.smartout.ai`.
3. **iPhone device test:** Add to Home Screen → open standalone → sign in → tap "Aktiver varsler" → grant. `view_players` ≥1 → send test push via OneSignal MCP → confirm arrival + deep-link tap.
4. Flip the 3 journeys to `status: verified` → `/close-feature`.
5. Follow-up phases P2 (prefs matrix), P3 (AI notify + reminder handler), P4 (mobile prefs UI + digest/grouping fixes + unify mappers + day-line/broadcast OneSignal migration).

## Commit map (28)
- Push channel: `b0ad8a851` (ADR), `3bb1a7419` (helper+tests), `0b436539c` (env), `101262b2b` (push-dispatch swap), `0aaf79512` (new API), `3b3f41965` (deep-link base).
- Mobile client: `57e1e34a5`, `ce6427fa3`, `7f22f2f52`, `bc53a3abf`, `a53638891` (gesture button).
- Deep-link: `051b7bd2b`, `9e3250d55`, `c49abf9f8`, `1496c91a5`.
- Task-due: `e2f0ba467` (events), `ffcd2ec57` (cron).
- Email fixes: `2a403c08e` (dev SMTP), `f2109c025` (user_id), `f3a980e2c`+`3c454f410` (denomailer try/revert), `672bc1586` (profileUserId+phone — the real fix).
- Demo + docs: `62d9fae35` (demo script), `6dd4dd1cc`+`6c98681e5` (module folder + roadmap), `68a8bc4a6`+`f8195c893`+`d3bcccb40` (plan/journeys/lockfile).
