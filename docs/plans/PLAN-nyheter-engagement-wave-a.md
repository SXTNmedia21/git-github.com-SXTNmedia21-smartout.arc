---
title: "Plan — nyheter-engagement-wave-a"
feature: nyheter-engagement-wave-a
spec: ../superpowers/specs/2026-05-11-nyheter-engagement-wave-a.md
status: draft
updated: 2026-05-11
created: 2026-05-11
module: MODULE_COMMUNICATION
tags: [plan]
---

# Plan — nyheter-engagement-wave-a

> Branch: `feat/nyheter-engagement-wave-a` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Module: MODULE_COMMUNICATION

**Spec:** [Nyheter Engagement Wave A](../superpowers/specs/2026-05-11-nyheter-engagement-wave-a.md)
**Detailed implementation plan:** [2026-05-10-nyheter-engagement-wave-a.md](../superpowers/plans/2026-05-10-nyheter-engagement-wave-a.md) — 7 tasks, ~60 bite-sized TDD steps. Council-approved 2026-05-11.
**Design handoff:** [docs/modules/announcments/nyheter/](../modules/announcments/nyheter/) — HTML prototype + JSX components + handoff README

## Journeys (the contract)

- [JOURNEY-nyheter-engagement-wave-a-manager-publishes-targeted-announcement](../journeys/JOURNEY-nyheter-engagement-wave-a-manager-publishes-targeted-announcement.md) — Manager picks audience (dept/role/individuals), writes announcement, publishes; only targeted profiles see it
- [JOURNEY-nyheter-engagement-wave-a-manager-pins-critical-announcement](../journeys/JOURNEY-nyheter-engagement-wave-a-manager-pins-critical-announcement.md) — Manager opens NewsCardMenu, picks Fest øverst, PinnedStrip animates in, realtime fans out
- [JOURNEY-nyheter-engagement-wave-a-employee-sees-pinned-on-next-session](../journeys/JOURNEY-nyheter-engagement-wave-a-employee-sees-pinned-on-next-session.md) — Employee opens Nyheter, sees PinnedStrip at top, can react but not pin
- [JOURNEY-nyheter-engagement-wave-a-manager-unpins-outdated-announcement](../journeys/JOURNEY-nyheter-engagement-wave-a-manager-unpins-outdated-announcement.md) — Manager picks Løsne; pin clears, strip fades when last pin removed
- [JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority](../journeys/JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority.md) — Announcement insert fires `notification_outbox` row with `priority=1, mode='work'`; push delivered above community-mode quiet-hours

## Goal

Close three Nyheter debt holes — push-fatigue priority bump, dead audience-targeting column, inert pin column — in one sortie so managers can target the right audience at the right priority and freeze critical announcements at top of feed.

## Tasks

See detailed plan at [2026-05-10-nyheter-engagement-wave-a.md](../superpowers/plans/2026-05-10-nyheter-engagement-wave-a.md). Summary:

- [ ] Pre-task A — Telemetry registry extension + `--color-pin` token
- [ ] Pre-task 0 — E2E env smoke (verify SUPABASE_SERVICE_ROLE_KEY available)
- [ ] Task 1 — Notification trigger migration + pgTAP (Item A)
- [ ] Task 2 — RecipientCountPill + useAudienceResolver (Item B foundation)
- [ ] Task 3 — AudiencePicker + ComposeAnnouncement wiring (Item B integration)
- [ ] Task 4 — pinMessageAction Server Action + use-pin-message hook (Item C backend)
- [ ] Task 5 — PinnedStrip + NewsCardMenu + NyheterClient integration (Item C UI)
- [ ] Task 6 — 3 E2E specs (DB-assertion model)
- [ ] Final verification gates F.1–F.8

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] pgTAP: `npx supabase test db --file supabase/tests/announcement_notification_priority_test.sql` passes 4 assertions
- [ ] E2E: `pnpm --filter @smartout/e2e exec playwright test apps/e2e/komm-nyheter` passes 3 specs
- [ ] HANDOFF written at `docs/HANDOFF-nyheter-engagement-wave-a.md` (decisions + learnings + next-steps)
- [ ] Decision log updated for any architectural choices (no new ADR expected per council 2026-05-11)
