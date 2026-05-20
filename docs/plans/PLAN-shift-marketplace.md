---
title: "Plan — shift-marketplace (C2)"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [plan, marketplace, capability, mobile, eligibility, adr-0306]
---

# Plan — shift-marketplace (C2)

> Branch: `feat/world-best-wfm-shift-marketplace` | Worktree: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-2 | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-14

## Goal

Ship open-shift marketplace per ADR-0306. 4 capability tools + mobile claim list + web manager approve + pull-poll notification V1 (push fanout deferred V2). Builds on PHASE 1 foundation: `schedule_shift_offer` table + enum + `eligibilityFor` helper + 5 marketplace telemetry events + `shift_marketplace` authority seed.

## Hard Constraints

- Migration timestamp floor: `> 20260615200100`.
- ADR-0287 single-call mutateWithGate on all 4 mutation tools.
- ADR-0151 server-derived identity. ADR-0099 one gate per write. ADR-0134 one emit per logical event.
- ADR-0288 chat-only on `claim` + `approve_claim`.
- ADR-0133: claim = Approve verb (mobile-allowed); post_open = Compose verb (web manager only).
- `schedule_shift.employee_id` = assignee column (verified A2 Phase 0).
- `approve_claim` mutates `schedule_shift.employee_id` AND `schedule_shift_offer.status='approved'` in SINGLE transaction inside single mutateWithGate.
- Eligibility check: caller pre-loads context, helper is pure TS.
- Empty-string fallbacks FORBIDDEN per ADR-0134 + L-0177.

## Tasks

### Task 0 — Pre-flight

- [ ] `pnpm install` + sibling pkg builds.
- [ ] `pnpm turbo typecheck --filter=@smartout/ai` clean.

### Task 1 — `shift_marketplace` capability with 4 tools

- [ ] `packages/ai/src/capabilities/shift_marketplace/` + register in registry + CapabilityName.
- [ ] Tool `post_open` (manager+, chat-only voice, web Compose): Zod `{shift_id, expires_at?}`. Single mutateWithGate INSERT schedule_shift_offer (poster=auth.profileId, status='open'). Emit `shift_offer.posted`.
- [ ] Tool `claim` (employee+, chat-only voice, mobile Approve): Zod `{offer_id}`. BFF pre-loads eligibility context (profile + shift + framework_rules + absences + existing_shifts) → calls `eligibilityFor` from foundation. If `!eligible` throw blocker codes. Else mutateWithGate UPDATE schedule_shift_offer status='claimed'. Emit `shift_offer.claimed`. NO auto-approve V1.
- [ ] Tool `approve_claim` (manager+, chat-only voice, mobile Approve): transactional single mutateWithGate exec — SELECT offer FOR UPDATE → UPDATE schedule_shift.employee_id = offer.claimed_by → UPDATE schedule_shift_offer status='approved'. Emit `shift_offer.approved` ONCE.
- [ ] Tool `cancel_offer` (poster OR manager, chat-only voice, both channels): UPDATE schedule_shift_offer status='cancelled' + reason. Emit `shift_offer.cancelled`.
- [ ] Vitest 12 tests (3 per tool: happy + auth-fail + state-precondition).

### Task 2 — Pull-poll mobile notification (NO push EF V1)

- [ ] NO `shift-offer-notify` Edge Function — deferred V2 pending ADR-0136 verify.
- [ ] BFF `/api/mobile/marketplace/open-offers` GET — server-derived workspace, filters status='open' AND eligibility-passing per caller, LIMIT 50.
- [ ] Mobile TanStack Query `refetchInterval: 30_000` while marketplace tab focused.
- [ ] HANDOFF note: "Pull-poll V1; push fanout V2 ADR-0136".

### Task 3 — Web manager `/dashboard/schedule/marketplace`

- [ ] Read Nordic Split skill.
- [ ] Server + client component pattern.
- [ ] UI: `font-heading` "Vakt-markedsplass". Tabs (Åpne / Krav i kø / Godkjent). Per-offer card with glassmorphism + status badge + Godkjenn/Avvis buttons (Lucide `Check`/`X`).
- [ ] Empty state glassmorphism "Ingen åpne tilbud".
- [ ] Motion: `motionTokens.spring` card enter, `motionTokens.springSnappy` badge transitions.
- [ ] TanStack mutations call `approve_claim` + `cancel_offer` via stage-engine path.

### Task 4 — Mobile `(shifts)/marketplace.tsx`

- [ ] Read Nordic Split skill.
- [ ] Route file + `<Stack.Screen name="marketplace" />` to `_layout.tsx`.
- [ ] UI: pull-to-refresh + list of OpenOffer cards (role + time + department + "Krev" button).
- [ ] Tap "Krev" → confirmation sheet → optimistic UI gray-out → refetch.
- [ ] On claim failure: native Alert with translated blocker codes (e.g. "Du har skift som overlapper").
- [ ] Motion: `motionTokens.spring` card enter (no per-row stutter).

### Task 5 — E2E P-marketplace-full-flow

- [ ] `apps/e2e/protocols/p-marketplace-full-flow.ts`
- [ ] Steps: manager post via chat → assert offer row → employee mobile sees → taps Krev → assert status='claimed' → manager web Godkjenn → assert schedule_shift.employee_id updated + status='approved'.
- [ ] Closes S9.

### Task 6 — Type regen + verification

- [ ] `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`.
- [ ] `pnpm turbo typecheck` 52/52.
- [ ] `pnpm --filter @smartout/ai test`.
- [ ] HANDOFF + decision log.

## Acceptance Criteria

- [ ] Tasks 0-6 atomic commits
- [ ] Typecheck 52/52
- [ ] Capability tests green (12 vitest)
- [ ] S9 E2E passes
- [ ] HANDOFF + decision log

## Out of Scope (deferred V2)

- Push fanout `shift-offer-notify` EF (waits ADR-0136 token verify)
- Auto-approve via engine_authority_config (V2 — needs Pontus config decision)
- Peer-to-peer swap (separate ADR)
- Cascading offer (auto-post if first rejected)
- Fairness rotation algorithm
- Tip-pool adjustment on approve
