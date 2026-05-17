---
title: "Handoff — domain-chat-ownership"
feature: domain-chat-ownership
branch: feat/domain-chat-ownership
closed: 2026-05-16
module: web
status: in_progress
updated: 2026-05-16
created: 2026-05-16
tags: [handoff, web, adr-0238, adr-0337, adr-0338, chat, visual-verify]
---

# Handoff — domain-chat-ownership

## Summary

E sortie from Council Phase 3 verdict (2026-05-16). Closes ADR-0238 silent
dual-surface bug by building the `<DomainChatOwnership>` React component
that suppresses the global BotssonShell Orb to passive mode when an embedded
domain chat surface declares ownership. Wires komm chat + komm thread.
Ships ADR-0338 visual verification methodology + one-shot Phase 1+2
chat-whatsapp audit.

State at handoff: code committed locally on `feat/domain-chat-ownership`,
push blocked by WSL2 OOM-kill on husky pre-push tsc. Sortie not yet merged.

## Journeys Delivered

| Journey | Status | E2E test |
|---|---|---|
| domain-chat-ownership-komm-suppress | draft → verify pending | none (manual) |
| domain-chat-ownership-non-owning-page | draft → verify pending | none (manual) |
| visual-verification-methodology-run | draft → verify pending | none (manual, methodology doc) |

All three journeys need manual PWA + dashboard verification before flip to
`status: verified`. See Pending Verification.

## Decisions Made

| Decision | Reason | Impact |
|---|---|---|
| Context provider + hook API (`useDeclareDomainChatOwnership`) | Matches existing BotssonProvider pattern; declarative on mount, auto-cleanup on unmount | All chat-hosting pages declare via hook, no imperative API |
| Map<string,number> counter for multi-owner safe | Multiple components on same page can each declare; cleanup only when last unmounts | Komm thread can stack on komm/chat without race |
| Orb passive = scale(0.7) + opacity 0.5 + pointerEvents none + aria-hidden | Visual presence preserved (user still sees Emma exists), interaction fully suppressed | Single chat surface invariant — no silent dual-route |
| 300ms ease transition | Smooth handoff, not jarring | Matches Nordic Split motion spec |
| ADR-0337 promotes ADR-0238 from declared to enforced | Component never built since ADR-0238 accepted; promotion ensures real behavior matches doc | Future audits can grep for declaration presence |
| ADR-0338 codifies 4-step visual verification methodology | Phase 1 token-collision trap (`secondary === muted === #f5f3f0`) caught only by Pontus PWA inspection; needs systematic gate | Mobile design-system PRs run methodology before merge |
| **API deviation from ADR-0337 spec — `reason` + counter instead of `surfaceId` + imperative `setOrbMode`** | ADR-0337 §75-127 specifies `surfaceId` prop + imperative `setOrbMode("passive")`. Implementation uses `reason` prop + counter-based `declareDomainChatOwnership` returning cleanup. Counter version is functionally superior — handles concurrent owners safely (komm/chat + komm/thread can stack without race, shift-clock chat tab can mount/unmount without leak) and matches existing BotssonProvider declarative pattern. | ADR-0337 acceptance criteria still met (component exists, real behavior matches doc). Spec text deviation tracked here so future readers know counter API is intentional, not drift. Recommend ADR-0337 amendment on flip to `accepted`. |

ADRs registered in council Phase 8 commit on development (`39de11e98`):
0337-adr-0238-enforcement, 0338-visual-verification-methodology.

## Learnings

| Learning | Context |
|---|---|
| ADR declared ≠ component shipped | ADR-0238 (2026-04-29) mandated component pattern; comment-convention only since, 0 component defs across 35+ refs. Promoted to L-0277 on development. |
| Token collision trap recurs without methodology gate | Phase 1 shipped own + other bubble identical color because `secondary === muted` resolved to same hex. Caught visually, not by typecheck. ADR-0338 = systematic countermeasure. |
| BotssonShell ownership pattern composable | Map<string,number> counter survives multiple embedded surfaces without coordination — komm/chat + komm/thread declare independently, cleanup independently. |
| Visual verification needs side-by-side reference | Methodology Step 3 requires real WhatsApp on phone next to PWA. Tokens read-fine in isolation, fail when compared. |

## Known Issues / Debt

- Audit doc at `docs/audits/2026-05-16-chat-whatsapp-visual-audit.md` documents methodology but not a live PWA run — methodology validation deferred to operator session.
- No Playwright E2E for Orb suppression — manual verification only. Phase 3 verdict A sortie (E2E Suite for chat surface) addresses this.

## Review History

- T5 code-reviewer: APPROVE clean. Zero high-confidence issues. Cleanup symmetry, multi-owner counter, Orb passive mode, hardcoded color audit all pass.
- T6 system-steward: APPROVE WITH CHANGES — required 3 fixes:
  1. Wire missed surface `shift-clock-chat` (commit followup)
  2. Update stale comments in `_tools/shift-clock-tools-bridge.tsx:16` + `_tools/use-shift-clock-tools.ts:32` (commit followup)
  3. Document ADR-0337 API deviation in "Decisions Made" table (commit followup)
  All three resolved before final close. Push originally blocked by WSL2 OOM on husky pre-push tsc, resolved at `346b3f91f` (52/52 typecheck green).

## Files Changed

```
apps/web/src/app/Botsson/_components/DomainChatOwnership.tsx       CREATE
apps/web/src/app/Botsson/_components/BotssonProvider.tsx           MODIFY (+53)
apps/web/src/app/Botsson/_components/BotssonShell.tsx              MODIFY (+40)
apps/web/src/app/dashboard/komm/_components/chat-page-client.tsx   MODIFY
apps/web/src/app/dashboard/komm/thread/[channelId]/_components/TicketConversationView.tsx  MODIFY
docs/protocols/VISUAL-VERIFICATION-MOBILE.md                       CREATE (275 lines)
docs/audits/2026-05-16-chat-whatsapp-visual-audit.md               CREATE (331 lines)
docs/plans/PLAN-domain-chat-ownership.md                           CREATE
docs/journeys/JOURNEY-domain-chat-ownership-komm-suppress.md       CREATE
docs/journeys/JOURNEY-domain-chat-ownership-non-owning-page.md     CREATE
docs/journeys/JOURNEY-visual-verification-methodology-run.md       CREATE
```

## Commits

```
a429ddb2e  docs(domain-chat): plan + 3 journeys for ADR-0238 component build
fe81aa20b  docs(domain-chat): T4 — ADR-0338 methodology + chat-whatsapp Phase 1+2 audit
cf378e3a2  feat(domain-chat): T1 — DomainChatOwnership component + Orb passive mode
a15de9cfc  feat(domain-chat): T2+T3 — wire komm/chat + komm/thread + audit sweep
```

## Audit Sweep Result (T3)

Grep `<DomainChat|<ChatPanel|<MessageList|<ChatPageClient` across `apps/web/src/app/dashboard/`:

| Surface | Embeds chat? | Declaration needed? | Status |
|---|---|---|---|
| `/dashboard/komm/chat` | Yes (ChatPageClient) | Yes | Wired |
| `/dashboard/komm/thread/[channelId]` | Yes (TicketConversationView) | Yes | Wired |
| `/dashboard/shift-clock` Chat tab | Yes (local `ChatPanel` in ShiftClockTabs.tsx:88, session + shift chat) | Yes (only when chat tab active) | Wired — declaration inside `<TabsContent value="chat">` so suppression scoped to chat-tab visibility |
| `/dashboard/help` | No (static help page) | No | — |
| `/dashboard/notifications` | No (list only) | No | — |
| `/dashboard/Botsson/*` | Owned by BotssonShell itself | No (would self-suppress) | Intentional skip |
| `/dashboard/people/[id]` LonnsprofilSection | No (no chat input) | No | TODO downgraded to no-op intentional |

T6 verification caught `shift-clock` surface missed by initial T3 audit. Fixed in followup commit. Updated stale "no DomainChatOwnership needed" comments in `_tools/shift-clock-tools-bridge.tsx:12-16` + `_tools/use-shift-clock-tools.ts:31-33`.

No false-positive declarations. No missing declarations on chat-hosting pages.

## Pending Verification

Before `/close-feature`:

1. Push must land (WSL2 OOM blocker).
2. T5 code-reviewer: focus on context scoped + cleanup, no hardcoded colors, ADR-0338 methodology executable.
3. T6 system-steward: ADR-0238 + ADR-0337 + ADR-0338 compliance, plan-vs-reality.
4. Manual verification per journey:
   - Navigate to `/dashboard/komm/chat` → Orb visibly suppresses to passive.
   - Navigate away → Orb returns to active.
   - Navigate to `/dashboard/schedule` → Orb stays active throughout.
   - Methodology doc readable + 4 steps executable.
5. Flip 3 journey `status: draft` → `status: verified`, fill `verified_at: 2026-05-16`.
6. `pnpm turbo typecheck` clean (last attempt SIGTERM'd by WSL2, not code error).

## Next Steps

After merge to development:

- ADR-0337 status: `proposed` → `accepted`
- ADR-0338 status: `proposed` → `accepted`
- Phase 3 A sortie: E2E suite for Orb suppression + chat surface (Playwright `apps/e2e` mobile-pwa project)
- Phase 3 D campaign: `campaign/chat-admin` — gated on ADR-0336 capability split decision (still proposed)

## Related Documents

- Plan: `docs/plans/PLAN-domain-chat-ownership.md`
- ADRs (on development): `docs/decisions/0337-adr-0238-enforcement-build-domain-chat-ownership-component.md`, `docs/decisions/0338-visual-verification-methodology-mobile-design-system.md`
- Council Log: `docs/council/COUNCIL-LOG.md` entry 2026-05-16 Phase 3 priority
- Audit: `docs/audits/2026-05-16-chat-whatsapp-visual-audit.md`
- Methodology: `docs/protocols/VISUAL-VERIFICATION-MOBILE.md`
