---
title: "Plan — domain-chat-ownership (E sortie)"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: web
tags: [plan, web, adr-0238, chat, visual-verify]
---

# Plan — domain-chat-ownership

> Branch: `feat/domain-chat-ownership` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Base: `development` | Module: web | Started: 2026-05-16

## Goal

Close ADR-0238 silent dual-surface bug: build `<DomainChatOwnership>` React component that suppresses BotssonShell Orb to passive mode when an embedded domain chat surface declares ownership. Audit komm + other chat-hosting pages for required declarations. Plus: ship ADR-0338 visual verification methodology + one-shot audit of chat-whatsapp Phase 1+2 surfaces.

Council 2026-05-16 verdict: E + ADR-0238 build = Tier 1 Phase 3 sortie.

## Hard constraints

- ADR-0238 mandates the component pattern. ADR-0337 (proposed) mandates the build.
- Nordic Split tokens only. No hex.
- No backend changes — pure web client-side React.
- ADR-0132/0133 unchanged.
- Visual verification methodology = ADR-0338 implementation.

## Sub-agent tracks

| Track | Agent | Model | Status |
|---|---|---|---|
| T0 Explore | general-purpose | haiku | dispatching |
| T1 Component build | general-purpose | sonnet | blocked T0 |
| T2 Komm wiring | general-purpose | sonnet | blocked T1 |
| T3 Audit sweep | general-purpose | sonnet | blocked T1 |
| T4 Visual verify methodology | general-purpose | sonnet | parallel |
| T5 Review | code-reviewer | sonnet | blocked G2 |
| T6 Steward | system-steward | opus | blocked G2 |

## T0 — Explore (haiku)

1. Grep `apps/web/src/` for current Orb mount point.
2. Find all routes embedding domain chat (`/dashboard/komm/chat`, `/dashboard/help`, `/dashboard/notifications`, `/dashboard/Botsson/*`).
3. Grep `DomainChatOwnership` repo-wide — confirm zero component definition.
4. Read BotssonProvider / BotssonShell to understand how Orb active/passive state works.
5. Read ADR-0238 + ADR-0337.
6. Report: component shape options (Context vs imperative vs URL-path), best fit per existing patterns.

## G1 — Component API decision

Default recommendation: Context provider (`<DomainChatOwnershipProvider>` at layout + `useDeclareDomainChatOwnership()` hook in page).

## T1 — Component build

Files:
- `apps/web/src/components/Botsson/DomainChatOwnership.tsx` — CREATE
- `apps/web/src/components/Botsson/BotssonShell.tsx` — MODIFY (consume context, suppress Orb when declared)

## T2 — Komm wiring

Files:
- `apps/web/src/app/dashboard/komm/chat/page.tsx` (or ChatPageClient) — declare ownership

## T3 — Audit sweep

`grep -rn "<DomainChat\|<ChatPanel\|<MessageList\|<ChatPageClient" apps/web/src/app/dashboard/` — evaluate each hit, declare where needed.

## T4 — Visual verify methodology (parallel)

Files:
- `docs/protocols/VISUAL-VERIFICATION-MOBILE.md` — CREATE (ADR-0338 methodology)
- `docs/audits/2026-05-16-chat-whatsapp-visual-audit.md` — CREATE (one-shot audit)

4-step: token resolved-value audit, motion timing audit, side-by-side reference, gesture conflict check.

## G2 — Integration gate

- `pnpm turbo typecheck` clean
- Manual verify: Orb suppresses on komm chat, stays active elsewhere
- Audit doc has findings (or all-clear with evidence)

## T5 — Review

Focus: context scoped + cleanup, no hardcoded colors, ADR-0338 methodology executable.

## T6 — Steward

ADR-0238 + ADR-0337 + ADR-0338 compliance. Plan-vs-reality.

## G3 — Close

- HANDOFF
- 3 journeys verified
- ADR-0337 + ADR-0338 status flippable to `accepted`
- `/close-feature` → development

## Council escalation triggers

- T0 surfaces existing BotssonProvider pattern conflicts with Context API → component shape council
- T3 finds 10+ pages needing declarations → rollout strategy council
- T4 audit surfaces serious Phase 1+2 visual regressions → fix-here vs separate sortie council

## Acceptance Criteria

- [ ] T0 explore + G1 decision
- [ ] T1 `<DomainChatOwnership>` component exists
- [ ] T2 komm/chat declares ownership + Orb suppression verified
- [ ] T3 audit list complete
- [ ] T4 ADR-0338 methodology doc + Phase 1+2 audit shipped
- [ ] G2 typecheck green
- [ ] T5 review pass
- [ ] T6 steward green
- [ ] 3 journeys verified
- [ ] HANDOFF written
- [ ] ADR-0337 + ADR-0338 flippable to accepted
