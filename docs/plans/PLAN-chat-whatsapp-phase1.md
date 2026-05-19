---
title: "Plan — chat-whatsapp-phase1"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [plan, mobile, chat, ux]
---

# Plan — chat-whatsapp-phase1

> Branch: `feat/mobile-chat-whatsapp-phase1` | Worktree: `/home/sxtnl/dev/smartout.ai-mobile-wt-1` | Base: `campaign/mobile` | Module: mobile | Started: 2026-05-16

## Goal

Make Smartout mobile chat surface feel like WhatsApp using Nordic Split tokens — bubble visuals, inline timestamp+receipt, sticky date dividers, read-state. No gestures yet (Phase 2), no voice notes (Phase 3).

## Hard constraints

- Nordic Split tokens only. No WhatsApp green. Brand-orange becomes signal (send, unread, read-receipt fill), not noise.
- ADR-0133 mobile surface boundary: chat = execute verb, OK.
- ADR-0132 AI routing: chat already goes through web BFF `/api/emma/chat`. Don't touch routing.
- ADR-0134 telemetry: every read-mark mutation calls `emit()` with non-null workspace_id + actor_id resolved via `getProfileContext()`.
- ADR-0136 camera evidence: out of scope (Phase 3 attachment work).
- No new dependencies. Reanimated already in tree (used by Phase 2). Phase 1 = pure render + small mutation.

## Sub-agent tracks

| Track | Agent | Model | Status |
|---|---|---|---|
| T1 Explore | general-purpose | haiku | ✅ done 2026-05-16 |
| T2 Visual | frontend-designer | sonnet | dispatching |
| T3 Dividers | general-purpose (build) | sonnet | dispatching |
| T4 Mutation | general-purpose (build) | sonnet | dispatching |
| T5 Review | code-reviewer | sonnet | blocked on G2 |
| T6 Steward | system-steward | opus | blocked on G2 |

## G1 outcome — 2026-05-16

**REUSE-EXISTING.** `channel_message_read` table created in `supabase/migrations/20260422300000_channel_communications.sql` with `(id, message_id, profile_id, workspace_id, read_at)`. UNIQUE(message_id, profile_id). RLS enabled + dual-auth policies in `20260422300100_channel_rls_policies.sql`. **No migration needed for T4** — mutation + Realtime only.

T1 surfaced 2 additional facts:
1. `ChannelMessageBubble.tsx:122` clones the LinearGradient. T2 must rework both bubbles.
2. `onSwipeReply` is dead-prop in BOTH MessageBubble and ChannelMessageBubble (declared but not destructured). Leave alone — Phase 2 gesture work owns it.

## T1 — Explore (haiku, background)

**Prompt scope:**
- Find every consumer of `apps/mobile/src/components/chat/MessageBubble.tsx` (chat + komm).
- Check `database.types.ts` + recent migrations for read-state columns: any `read_at`, `last_read_at`, `channel_message_read*` table? Report exact schema.
- Sweep `apps/mobile/src/components/chat/` for `LinearGradient` usage + hardcoded orange (`#FF`, `oklch`, brand-orange refs). List each occurrence.
- Confirm `getProfileContext()` exists at `apps/mobile/src/lib/profile-context.ts` per ADR-0134.
- Report ConversationBody render flow: inverted FlatList key extraction, item types, sticky-header support.

**Output**: schema decision input for G1.

## G1 — Schema decision gate

After T1 returns:
- If read-state column already exists with usable semantics → reuse, T4 = mutation + Realtime only.
- If absent or semantically wrong → T4 includes migration for `channel_message_read` (workspace-scoped, RLS dual-auth, indexes on `(channel_message_id, profile_id)`).
- If T1 surfaces conflicting prior reads (e.g. column exists but never written) → **AI Council escalation** before T4 dispatch.

## T2 — Visual rework (sonnet, frontend-designer)

**Files:**
- Modify `apps/mobile/src/components/chat/MessageBubble.tsx`:
  - Drop `LinearGradient` orange. Own bubble = `bg-secondary` token. Other = `bg-muted` token.
  - Move time + receipt **inside** bubble bottom-right (mono micro, opacity 0.6).
  - Keep asymmetric corners (16/16/4/16 own; 16/16/16/4 other).
  - Keep existing reply-quote + reactions render.
  - Render `<ReadReceipt state={...} />` next to time for own messages only.
- Create `apps/mobile/src/components/chat/ReadReceipt.tsx`:
  - Props: `state: 'pending' | 'sent' | 'delivered' | 'read'`.
  - pending = ClockIcon, sent = Check, delivered = CheckCheck (muted), read = CheckCheck (brand-orange fill).
  - Lucide icons only.

**Constraints:**
- No new deps.
- Tokens from `@smartout/design-tokens` only — no hardcoded hex.
- Memoize bubble render keyed on `(id, content, reactions.length, read_at)` per L-mobile-perf.

## T3 — Date dividers (sonnet, build)

**Files:**
- Create `apps/mobile/src/components/chat/DateDivider.tsx`:
  - Centered pill, `bg-muted`, `text-muted-foreground`, mono micro.
  - Format: "I DAG" / "I GÅR" / "torsdag 15. mai" (Norwegian default per i18n).
  - Use `date-fns` with `nb` locale (already in tree).
- Modify `apps/mobile/src/components/komm/ConversationBody.tsx`:
  - Group messages by `format(created_at, 'yyyy-MM-dd')` in local TZ.
  - Inject `DateDivider` rows between groups in inverted FlatList.
  - Discriminated union for FlatList item: `{ kind: 'message', ... } | { kind: 'divider', date: string }`.

**Constraint:** sticky-header behavior deferred — Phase 1 ships inline dividers; sticky can land in Phase 2 with gesture work.

## T4 — Schema + read-state mutation (sonnet, build)

**Depends on G1 outcome.**

If migration needed:
- New migration `supabase/migrations/YYYYMMDDHHMMSS_channel_message_read.sql`:
  - Table `public.channel_message_read (channel_message_id uuid FK, profile_id uuid FK, workspace_id uuid FK, read_at timestamptz default now(), primary key (channel_message_id, profile_id))`.
  - Index `(profile_id, read_at desc)`.
  - RLS dual-auth: JWT (auth.uid() = profile_id in same workspace) + service_role.
  - `created_at` not needed (`read_at` serves both).
- Regenerate `database.types.ts` via `pnpm db:types`.

Mutation hook:
- `apps/mobile/src/hooks/mutations/use-mark-read.ts`:
  - TanStack Query mutation.
  - Resolves `(workspace_id, profile_id)` via `getProfileContext()` — fail-fast on null.
  - Optimistic update to query cache.
  - `emit('chat.message_read', { workspace_id, profile_id, channel_message_id })` in `onSuccess`.
- Hook into `ConversationBody`: mark messages visible in viewport as read (use `onViewableItemsChanged` on FlatList).

## G2 — Integration gate

After T2/T3/T4:
- `pnpm turbo typecheck` green across mobile + telemetry + supabase types.
- Mobile bundles (`pnpm --filter @smartout/mobile dev` reaches READY).
- Manual visual check: own bubble = secondary/muted, no orange gradient, time+receipt inline, divider visible between yesterday/today.

## T5 — Code review (sonnet, code-reviewer)

Standard review pass. Special focus:
- No hardcoded colors.
- No emit() with empty workspace_id.
- ReadReceipt enum exhaustive.
- ConversationBody type-discriminated correctly.

## T6 — Steward (opus, system-steward)

ADR compliance + plan-vs-reality:
- ADR-0134 telemetry contract honored on mark-read mutation.
- ADR-0133 mobile boundary (no compose verbs introduced).
- Plan matches what was shipped (this file).
- Decision log updated if any new ADR needed for read-state schema.

## G3 — Close-feature gate

After T5+T6 green:
- HANDOFF-chat-whatsapp-phase1.md written.
- 3 journeys finalized.
- Decision log updated.
- `/close-feature` merges to campaign/mobile.

## AI Council escalation rules

Council triggered when:
- T1 surfaces read-state schema with conflicting prior usage → council on schema decision.
- T2 frontend-designer pushes back on dropping orange gradient (brand-voice concern) → council on visual ADR.
- T6 steward flags ADR-0134 telemetry drift on mark-read payload → council before close.
- Any inter-agent boundary dispute (mobile vs web BFF) → council on ADR-0132/0133.

Council members default: `code-architect`, `system-steward`, `frontend-designer`. Add `system-agent-coordinator` if AI routing surface touched (not expected here).

## Acceptance Criteria

- [ ] T1 explore complete + G1 decided
- [ ] T2 MessageBubble + ReadReceipt shipped, no LinearGradient remaining
- [ ] T3 DateDivider rendering in ConversationBody
- [ ] T4 read-state schema + mutation + emit() wired
- [ ] G2 typecheck green + bundles
- [ ] T5 review pass green
- [ ] T6 steward green on ADR-0133/0134
- [ ] 3 journeys written
- [ ] Decision log updated
- [ ] HANDOFF written
