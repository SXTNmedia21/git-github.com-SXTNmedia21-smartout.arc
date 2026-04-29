---
title: "Plan — m2-thread-continuation"
feature: m2-thread-continuation
spec: docs/superpowers/specs/2026-04-28-helpdesk-thread-continuation.md
status: draft
updated: 2026-04-28
created: 2026-04-28
module: Core
campaign: core-module
milestone: M2.1
tags: [plan, help, helpdesk, thread, continuation]
---

# Plan — m2-thread-continuation

> Branch: `feat/core-module-m2-thread-continuation` | Worktree: `/home/sxtnl/dev/smartout.ai-core-module-wt-1` | Base: `campaign/core-module` | Module: Core

**Spec:** [Helpdesk Thread Continuation on /dashboard/help (M2.1)](../superpowers/specs/2026-04-28-helpdesk-thread-continuation.md)

## Journeys (the contract)

- [JOURNEY-m2-thread-continuation-employee-active-ticket](../journeys/JOURNEY-m2-thread-continuation-employee-active-ticket.md) — Employee with active ticket sees badge → click → /komm thread
- [JOURNEY-m2-thread-continuation-employee-no-ticket](../journeys/JOURNEY-m2-thread-continuation-employee-no-ticket.md) — Employee without ticket sees no badge (empty state)
- [JOURNEY-m2-thread-continuation-admin-aggregate](../journeys/JOURNEY-m2-thread-continuation-admin-aggregate.md) — Admin (responsible_profile_id=self) sees aggregate count + preview → click → /komm filtered
- [JOURNEY-m2-thread-continuation-manager-multi-ticket](../journeys/JOURNEY-m2-thread-continuation-manager-multi-ticket.md) — Manager with multiple tickets sees count + latest preview → click → /komm latest

## Goal

Make `/dashboard/help` aware of the user's active helpdesk threads (read-only). Surface most recent unresolved ticket as "Pågående sak" badge above chat hero. Click → `/dashboard/komm/thread/<channelId>`. NO authoring on /help.

## Tasks

- [ ] **T1** — Write `_data/queries.ts` extension `getActiveHelpdeskThreadsForProfile(profileId, workspaceId, role)` returning up to 5 active engine_state rows joined with channel + last channel_message preview. RLS-safe via standard supabase client (not admin).
- [ ] **T2** — Add telemetry event interfaces to `packages/telemetry/src/registry.ts`:
  - `help.active_ticket_badge_viewed` → posthog + activity_trail
  - `help.active_ticket_badge_clicked` → posthog + activity_trail
- [ ] **T3** — Build `_components/ActiveTicketBadge.tsx` Server Component. Renders nothing for empty state. Renders single ticket with subject + last-message preview + relative timestamp for employee. Renders aggregate count + top-1 preview for admin/manager.
- [ ] **T4** — Wire `ActiveTicketBadge` into `apps/web/src/app/dashboard/help/page.tsx` ABOVE BotssonChatHero (Tier 0.5 between Panic Bar and Chat Hero).
- [ ] **T5** — Click handler on badge — Next.js `<Link href="/dashboard/komm/thread/<channelId>">` (admin/manager top-1 preview links to most recent; secondary "Se alle X saker" link to `/dashboard/komm?filter=helpdesk` if applicable).
- [ ] **T6** — Telemetry emit on view (Server-side from page.tsx) and on click (Client island wrapping the Link).
- [ ] **T7** — RLS verification: query helper MUST filter by `auth.uid()` workspace + role. Audit no service-role usage.
- [ ] **T8** — Empty-state E2E: log in as employee with zero active tickets → /help → assert no `[data-testid="active-ticket-badge"]` element.
- [ ] **T9** — Active-state E2E: seed 1 helpdesk ticket via M1 panic-bar flow OR direct DB insert → /help → assert badge visible with subject text → click → URL is `/dashboard/komm/thread/<channelId>`.
- [ ] **T10** — Admin-aggregate E2E: seed 3 tickets where responsible_profile_id=admin → /help as admin → assert count "3 åpne saker" + top-1 preview.
- [ ] **T11** — `pnpm turbo typecheck` PASS.
- [ ] **T12** — Update each journey frontmatter `status: verified` + `e2e_test:` path when checks pass.
- [ ] **T13** — HANDOFF in `docs/handoffs/HANDOFF-m2-thread-continuation.md` with G-RO + G-RLS audit.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices
- [ ] At least one E2E test exists per journey
- [ ] G-RO merge-blocker: 0 mutation paths in `apps/web/src/app/dashboard/help/_components/ActiveTicketBadge*` and `_data/queries.ts` extension (grep for emit/insert/update on engine_state or channel_message returns 0)
- [ ] G-RLS merge-blocker: query helper filters by auth.uid() workspace + role; no admin-client usage
