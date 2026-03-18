---
title: "Worklog — dev-prod-fix"
status: in_progress
updated: 2026-03-18
created: 2026-03-18
module: development
tags: []
---

# Worklog — dev-prod-fix

> Branch: `feat/dev-prod-fix` | Worktree: wt-15 | Started: 2026-03-18

## Status: 🟡 Pending Deploy + Manual Testing

## Done

- [x] Task 1: Verify docker-compose.yml SUPABASE_URL uses env var (already fixed in prior commit `17101d9b`)
- [x] Task 2: Add auth headers to platform-admin scrapling routes (commit `fc1e1f6f` + `7a798ea7`)
- [x] Task 3: Update Droplet — pulled latest, rebuilt all 6 containers, all healthy
- [x] Task 4: Align Supabase Edge Function secrets — 8 secrets set on smartout-live
- [x] Task 5: Set Vercel env vars — 12 missing vars added to smartout-web, 2 to smartout-landing
- [x] Task 6: End-to-end verification — scrapling, stage engine, Caddy all confirmed working

## Remaining

- [ ] Pause unused Supabase project `hcmhwsewrcjmldjezaqk` (manual, dashboard)
- [ ] Set Stripe test key for Vercel preview (1Password field name differs from plan)
- [ ] Deploy `scrape-website` Edge Function (not deployed, only `scrape-raw-data` exists)

## Decisions

| Date       | Decision                                                   | Reason                                                              |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| 2026-03-18 | Task 1 skipped — already fixed in development              | Commit `17101d9b` already uses `${SUPABASE_URL:?...}`               |
| 2026-03-18 | Added auth to services/test/route.ts (not in plan)         | Plan missed this scrapling caller — would 401 on admin service test |
| 2026-03-18 | Dropped contract-service stash — superseded by development | buildAutofillMap in development already has all keys from the stash |

## Log

| Date       | Time  | Event                                                                                                                                                                                    |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-18 | 09:58 | Feature started                                                                                                                                                                          |
| 2026-03-18 | 10:01 | Task 1 verified — already done in codebase                                                                                                                                               |
| 2026-03-18 | 10:02 | Task 2 committed — auth headers added to lookup + analyze-documents + services/test                                                                                                      |
| 2026-03-18 | 10:05 | Merged to development, pushed, full typecheck passed (21/21)                                                                                                                             |
| 2026-03-18 | 10:10 | Droplet: stashed placeholders.ts, pulled 20+ commits, resolved conflict (stash superseded)                                                                                               |
| 2026-03-18 | 10:12 | Droplet: rebuilt all containers — all 6 healthy, stage engine no longer crash-looping                                                                                                    |
| 2026-03-18 | 10:18 | Supabase secrets set: SCRAPLING_AUTH_TOKEN, SCRAPLING_SERVICE_URL, OPENROUTER_API_KEY, STAGE_ENGINE_URL, ULTRAVOX_API_KEY, SENDGRID_API_KEY, WATCHDOG_CRON_SECRET, GOOGLE_VISION_API_KEY |
| 2026-03-18 | 10:30 | Vercel web: 12 missing vars added (Stripe, SendGrid, Twilio, Upstash, DocuSeal, Shift MCP, landing URL, stage engine URL, revalidation)                                                  |
| 2026-03-18 | 10:32 | Vercel landing: NEXT_PUBLIC_WEB_APP_URL + NEXT_PUBLIC_LANDING_VARIANT added                                                                                                              |
| 2026-03-18 | 10:35 | E2E verification passed: scrapling 200 with auth, stage engine healthy, Caddy proxying, no new 401s                                                                                      |
| 2026-03-18 | 10:36 | Docker cleanup reclaimed 19.14GB on Droplet                                                                                                                                              |
| 2026-03-18 | 10:50 | Session ended: All infra done, pending deploy to main + manual testing                                                                                                                   |
