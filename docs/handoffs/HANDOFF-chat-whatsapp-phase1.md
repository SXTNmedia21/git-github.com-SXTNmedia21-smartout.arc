---
title: "Handoff — chat-whatsapp-phase1"
status: done
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [handoff, mobile, chat, ux]
---

# Handoff — chat-whatsapp-phase1

> Branch: `feat/mobile-chat-whatsapp-phase1` (sub-sortie under `campaign/mobile`) | 4 commits, b85011c1e..4e7fa9b34

## Summary

Mobile chat surface now feels like WhatsApp on Nordic Split tokens. Phase 1 ships visual bubbles + inline timestamp+receipt + sticky-able date dividers + read-state. No gestures (Phase 2). No voice notes (Phase 3).

Coordinator-orchestrated build: 7 sub-agent tracks across 3 gates. T2 bailed twice (frontend-designer agent has only Skill tool, can't write files — a CLAUDE.md dispatch table trap), succeeded on third dispatch via general-purpose sonnet.

## Commits

| SHA | Track | Scope |
|---|---|---|
| `658291472` | T3 | DateDivider component + ConversationBody discriminated-union grouping |
| `24224f076` | T4 | use-mark-read mutation + use-channel-read-receipts Realtime hook + telemetry registry entry |
| `6fcabeb63` | T2 | MessageBubble + ChannelMessageBubble visual rework + ReadReceipt component |
| `4e7fa9b34` | T7 | T5 review-finding fixes — scrim token + own-msg guard |
| `11354f317` | T8 | Token remap — own bubble warnSoft (was secondary===muted); read-receipt was already brandOrange (T2 wired correctly, my diagnostic mid-session was wrong) |

## Decisions

- **G1 — REUSE-EXISTING `channel_message_read` table** (2026-05-16). Table already created in `supabase/migrations/20260422300000_channel_communications.sql` with correct shape `(message_id, profile_id, workspace_id, read_at)`, UNIQUE constraint, RLS dual-auth. T4 = mutation + Realtime only, no migration needed.
- **Brand-orange role shift** — orange gradient bubble killed in favor of `bg-secondary`/`bg-muted` tokens. Brand-orange now reserved as signal: send button, unread badges, read-receipt fill state. Design-system continuity, not a new ADR.
- **Phase 1 receipt-state collapse** — `delivered` state defined in ReadReceipt component but currently unreachable; `use-channel-read-receipts.ts` collapses to sent/read only. Presence tracking deferred to Phase 2.
- **No new ADR** — per T6 steward audit. All work complies with ADR-0132/0133/0134; no novel architectural decisions introduced.

## Learnings

- **L-frontend-designer-agent-no-write-tools** — `frontend-designer` subagent has ONLY the `Skill` tool surface. Cannot write files. Two T2 dispatches bailed with hallucinated "skill loop" explanations before root cause surfaced. CLAUDE.md orchestrator dispatch table lists `frontend-designer` for component builds — the table is misleading. Use `general-purpose` sonnet for any work that requires file writes. Worth promoting to global memory if seen again.
- **L-worktree-fresh-needs-install-and-dist-build** — Sub-sortie worktree fresh from `new-feature.sh` has no `node_modules` symlinks AND no built dist for shared packages. Subagent Stop-hooks fail typecheck on every save until install + dist-build complete. Same class as L-stale-telemetry-dist + L-stage-engine-subpath-imports + L-worktree-missing-pnpm-symlinks. Pre-flight should be: `pnpm install` + `pnpm --filter @smartout/{telemetry,design-tokens,utils,ai} build` BEFORE dispatching subagents.
- **L-telemetry-tsbuildinfo-stale** — `pnpm --filter @smartout/telemetry build` with stale `.tsbuildinfo` may report "Done" without recompiling new event entries into `dist/`. Force-clean (`rm -rf dist .turbo *.tsbuildinfo`) when adding events to `registry.ts`.
- **G1 schema reuse beats migration drift** — explore-first (T1) discovered `channel_message_read` table already existed unused. Saved a migration file and avoided phantom-ADR risk.

## Known issues / Phase 2+ candidates

- **No DELETE subscription on `channel_message_read`** — if a message is hard-deleted, sender's in-memory "read" state persists until channel reopen. Matches WhatsApp behavior on deleted messages. Phase 2 candidate (per T6 audit).
- **Sticky date dividers not implemented** — Phase 1 ships inline only. Sticky-on-scroll lands with Phase 2 gesture work (uses same Reanimated infra).
- **`onSwipeReply` prop is dead-wired in MessageBubble + ChannelMessageBubble** — declared, not destructured, not invoked. Phase 2 owns swipe-to-reply gesture (PanGestureHandler).
- **`delivered` state unreachable** — ReadReceipt component supports it but no presence tracking infrastructure to compute. Phase 2 may add or may keep collapsed.
- **`ChannelMessageBubble` is a clone of `MessageBubble`** with a slightly different message shape. Two bubbles are now in sync (T2 + T8 reworked both identically). Worth considering a single bubble component with a discriminated message-shape union in a future cleanup sortie.
- **LiveKit auto-camera on chat mount** — `ConversationScreen.tsx:131-136` auto-tries `setCameraEnabled(true)` whenever `isCameraEnabled` flag is set. Browser/PWA without camera permission emits `NotReadableError` console-error on every chat-open. Pre-existing, surfaced during this sortie's PWA verification. Guard should depend on actual call state, not just flag. NOT chat-whatsapp scope — separate fix candidate.
- **Chat settings, group-invite, admin (rename/kick/role) — entirely missing.** Surfaced during this sortie's PWA verification. NOT in plan, NOT in journeys, NOT in any active sortie. Whole separate feature. Worth a dedicated `chat-admin-phase1` sortie under campaign/mobile after Phase 2.
- **E2E tests not written** for any of the 3 journeys (employee-read, employee-send, manager-long-thread). Accepted as debt; manual verification on PWA confirmed visual delivery. Phase 2 should add Detox/Playwright coverage for the journeys before adding gesture complexity.

## Token-mapping learning (mid-session)

T2 first dispatch picked `theme.colors.secondary` for own-bubble surface, expecting it to be brand-warm. Native palette has `secondary === muted === #f5f3f0`. Result: own + other bubbles indistinguishable, sender/receiver split lost. T5 + T6 audits both passed because they verified token-USAGE not token-SEMANTICS (no resolved-color comparison). Pontus caught it in PWA verification. T8 remapped to `colors.warnSoft` (`#fceedb` light / `#3a2f1c` dark — warm cream, perfect WhatsApp own-bubble feel).

**Future audit pattern**: when reviewing token migrations on visual surfaces, resolve token VALUES side-by-side, not just confirm token NAMES used. Two tokens with different names but identical resolved colors = visual collision = bug invisible to typecheck.

## Next steps

- **Phase 2** — swipe-to-reply gesture, sticky date divider on scroll, long-press scale-spring, presence-tracking for delivered state, DELETE subscription on `channel_message_read`.
- **Phase 3** — voice notes via expo-av (NOT LiveKit per ADR-0135 — LiveKit reserved for live calls), waveform pill, attachment sheet, camera evidence per ADR-0136.
- **Cleanup candidate** — consolidate MessageBubble + ChannelMessageBubble into single component with discriminated message shape.

## Acceptance gates

- ✅ T1 explore + G1 decided
- ✅ T2/T3/T4 shipped
- ✅ G2 typecheck green (`pnpm --filter @smartout/mobile --filter @smartout/telemetry typecheck` clean)
- ✅ T5 code review (APPROVE-WITH-CHANGES → T7 closed both findings)
- ✅ T6 steward audit (GREEN, no new ADR required)
- ✅ T7 fixes shipped + typecheck clean
- ✅ 3 journeys written
- ✅ Branch pushed
- ⬜ `/close-feature` — ready
