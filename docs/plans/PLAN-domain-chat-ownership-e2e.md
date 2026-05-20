---
title: "Plan — domain-chat-ownership-e2e (A sortie)"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [plan, web, e2e, playwright, adr-0337, regression]
---

# Plan — domain-chat-ownership-e2e

> Branch: `feat/domain-chat-ownership-e2e` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Base: `development` | Module: web/e2e | Started: 2026-05-16

## Goal

Lock the ADR-0337 contract (DomainChatOwnership component + Orb passive mode) behind Playwright regression tests so future PRs cannot silently reintroduce the dual-surface bug.

Phase 3 verdict (2026-05-16) sortie A. Direct follow-up to E sortie (`16b000387`).

## Hard constraints

- No source-code changes beyond adding one `data-testid="botsson-orb"` to BotssonShell.
- Nordic Split tokens unchanged.
- Use existing `web` Playwright project (port 3060) — no new project setup.
- Use existing `loginAsAdmin()` fixture — no new auth setup.
- Reusable orb helpers in `apps/e2e/helpers/orb.ts` — single source of selector truth.

## Sub-agent tracks

| Track | Agent | Model | Status |
|---|---|---|---|
| T0 Explore | Explore | haiku | done (pre-sortie) |
| T1 Foundation | general-purpose | sonnet | dispatching |
| T2 komm/chat | general-purpose | sonnet | blocked T1 |
| T3 komm/thread | general-purpose | sonnet | blocked T1 |
| T4 schedule active | general-purpose | sonnet | blocked T1 |
| T5 nav-race counter | general-purpose | sonnet | blocked T1 |
| T6 Review (parallel) | code-reviewer + system-steward | sonnet+opus | blocked G2 |

## T1 — Foundation

Files:
- `apps/web/src/app/Botsson/_components/BotssonShell.tsx` — MODIFY (1 line, add `data-testid="botsson-orb"` at line 607 container)
- `apps/e2e/helpers/orb.ts` — CREATE (expectOrbActive, expectOrbPassive helpers)

## T2 — komm/chat passive

File: `apps/e2e/tests/domain-chat-ownership/komm-chat-passive.spec.ts`

Flow: loginAsAdmin → `/dashboard/komm/chat` → expectOrbPassive → `/dashboard` → expectOrbActive.

## T3 — komm/thread passive

File: `apps/e2e/tests/domain-chat-ownership/komm-thread-passive.spec.ts`

Flow: loginAsAdmin → seed-or-discover channelId → `/dashboard/komm/thread/<id>` → expectOrbPassive.

## T4 — schedule active (negative-space)

File: `apps/e2e/tests/domain-chat-ownership/schedule-active.spec.ts`

Flow: loginAsAdmin → `/dashboard/schedule` → expectOrbActive. Plus `/dashboard/shift-clock` (no shift) → expectOrbActive (chat tab not mounted = no declaration).

## T5 — nav-race counter integrity

File: `apps/e2e/tests/domain-chat-ownership/nav-race-counter.spec.ts`

Flow: loginAsAdmin → `/dashboard/komm/chat` (passive) → `/dashboard/komm/thread/<id>` (still passive) → `/dashboard/schedule` (active). Verifies Map<string,number> counter decrements symmetrically on unmount.

## G2 — Integration gate

`pnpm --filter e2e exec playwright test --grep "domain-chat-ownership" --project=web` — all 4 specs green.

## G3 — Close

- HANDOFF
- 4 journeys flipped to verified
- `/close-feature` → development

## Council escalation triggers

- T1 reveals existing `data-testid` collision at testid="botsson-orb" location → council on selector strategy
- T3 channel seeding heavier than 50 lines fixture → council on seed-vs-discover-first-channel
- Any test depends on real Supabase data (not test-local seed) → council on Supabase Branch fixture

## Acceptance Criteria

- [ ] T1 testid + helpers shipped
- [ ] T2-T5 4 specs written + local green
- [ ] G2 all green
- [ ] T6 review pass
- [ ] HANDOFF written
- [ ] 4 journeys verified
