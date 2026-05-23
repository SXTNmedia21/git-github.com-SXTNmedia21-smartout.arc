---
title: "HANDOFF — InlineConfirmCard Phase 1"
feature: inline-confirm-card-phase1
status: ready-for-close
updated: 2026-05-23
created: 2026-05-23
module: MODULE_BOTSSON
tags: [handoff, botsson, hitl, primitive, communication, adr-0398, adr-0399]
---

# HANDOFF — InlineConfirmCard Phase 1

## Summary

This sortie ships the first Human-In-The-Loop (HITL) confirm/edit/cancel primitive for Botsson mutations. The core idea: when Botsson is about to commit something meaningful — publishing an announcement, sending a message, approving a shift — the user must see a preview card and explicitly click Bekreft before anything touches the database. The primitive lives in `@smartout/ai/primitives/inline-confirm-card` and is consumed today by `publish_announcement`; Phase 2 will extend it to `send_message` (ADR-0400) and `approve_shift` (ADR-0401).

The architecture follows "Architecture B" (name-keyed dispatch): the server capability tool returns `{phase:"draft", proposal_id, descriptor}`, the LLM reads a 10-line system-prompt block and immediately calls the `show_proposal_card` client-tool, and the browser renders the card inline as a chat bubble. The card is registered in the "BotssonChat-fixed" tier (L-0331) — not page-scoped — so it works on every Botsson surface without registration work. Resolving the card (confirm/edit/cancel) POSTs `client_tool_results` back to stage-engine, which resumes the LLM with the user's choice as a tool message.

Security is layered via four defenses (ADR-0398 §Resume-Payload Trust Boundary): DEFENSE 1 — workspace_id always from JWT auth context (ADR-0151, never from body); DEFENSE 2 — audience re-resolved server-side with RLS scope (cross-workspace profile_ids return 0 rows); DEFENSE 3 — on resume with proposal_id present, audience_kind is forced to "all" and body-supplied targeting fields are ignored (Phase 1 narrowing; Phase 2 will replace with stateful audience-fingerprint via engine_memory keyed on proposal_id); DEFENSE 4 — `publish_announcement_atomic` RPC has a UNIQUE constraint on `client_message_id` blocking replay attacks.

## What shipped (file inventory)

### New files — created in this sortie

| File | Purpose | Task |
|------|---------|------|
| `packages/ai/src/primitives/inline-confirm-card/types.ts` | Zod schemas + TypeScript types for InlineConfirmCardDescriptor, PreviewPayload, ActionDescriptor, etc. (191 lines) | T1 |
| `packages/ai/src/primitives/inline-confirm-card/index.ts` | Public exports + `buildInlineConfirmCard()` factory + `isInlineConfirmCardDescriptor()` type-guard (43 lines) | T1 |
| `packages/ai/src/primitives/inline-confirm-card/channel-guard.ts` | `surfaceConstraintsAllowChannel()` helper — ADR-0399 Enforcement Layer 1 (populated but inert in Phase 1; see Known Issues) | T1 |
| `packages/ai/src/primitives/inline-confirm-card/__tests__/types.test.ts` | Vitest schema + type-guard tests | T1 |
| `packages/ui/src/components/inline-confirm-card.tsx` | React component — Nordic Split + WCAG, motion via Framer Motion, 3 action buttons, loading/resolved/cancelled/error modes, ring-primary flash on resolve (429 lines) | T2 |
| `apps/web/src/app/Botsson/_components/inline-confirm-card-tool.ts` | `show_proposal_card` client-tool impl — BotssonChat-fixed tier, descriptor validation, renders InlineConfirmCard into chat bubble, emits cancelled/edited events browser-side (253 lines) | T4 |
| `apps/e2e/tests/inline-confirm-card-phase1/happy-publish.spec.ts` | Playwright happy-path spec (362 lines) | T8 |
| `apps/e2e/tests/inline-confirm-card-phase1/cancel-publish.spec.ts` | Playwright cancel-path spec (287 lines) | T8 |
| `apps/e2e/tests/inline-confirm-card-phase1/resume-tamper-defense.spec.ts` | Playwright adversarial spec — Playwright intercepts POST and mutates body to verify defenses hold (469 lines) | T8 |
| `apps/e2e/tests/inline-confirm-card-phase1/helpers.ts` | Shared E2E helpers (selectors, wait helpers, activity_trail query) | T8 |
| `docs/decisions/0398-inline-confirm-card-primitive.md` | ADR-0398 — full primitive contract + architecture decision | Council |
| `docs/decisions/0399-channel-platform-descriptors-tool-contract.md` | ADR-0399 — channel_constraint + platforms orthogonal descriptor fields | Council |
| `docs/journeys/JOURNEY-inline-confirm-card-phase1-happy-publish.md` | Happy-path user journey (admin publishes) | T0 |
| `docs/journeys/JOURNEY-inline-confirm-card-phase1-cancel-publish.md` | Cancel-path user journey (admin clicks Avbryt) | T0 |
| `docs/journeys/JOURNEY-inline-confirm-card-phase1-resume-tamper-defense.md` | Security journey (adversarial resume payload) | T0 |

### Modified files — key changes

| File | Change | Task |
|------|--------|------|
| `packages/ai/src/capabilities/communication/publish-announcement.ts` | Gate precheck + UUID lift + `buildInlineConfirmCard()` call + DEFENSE 1–4 + `nonEmpty()` wraps on emit (422 lines) | T3 + T9-fix |
| `packages/ai/src/harness/types.ts` | Added `channel_constraint?: ("chat"\|"voice")[]` + `platforms?: ("web"\|"mobile")[]` to `SmartoutToolDescriptorBase` (lines 40–72) | T7 |
| `packages/telemetry/src/registry.ts` | Registered 4 inline_confirm_card events at lines 4466–4514 with routing to PostHog + activity_trail + engine_event | T6 |
| `packages/ai/src/prompts/mr-botsson.ts` | Added 10-line HITL block (lines ~170–183) — Norwegian + English instruction to call show_proposal_card immediately after draft response | T5 |
| `apps/web/src/app/Botsson/_components/BotssonChat.tsx` | BotssonChat-fixed registry tier (lines 301–326): show_proposal_card merged as fixed primitive that wins on name collision (L-0331) | T4 + T4-fix |
| `packages/ai/package.json` | Added `./primitives/inline-confirm-card` to exports map (Gate 1 Q6 fix) | Gate1-fix |
| `apps/web/src/app/api/botsson/chat/route.ts` | Relax `ClientToolParameter.description` to `optional()` in BFF Zod schema (T4-fix-2) | T4-fix-2 |

## Decisions made (registered in decision log)

- **ADR-0398** (`docs/decisions/0398-inline-confirm-card-primitive.md`) — InlineConfirmCard primitive: Architecture B name-keyed dispatch, BotssonChat-fixed tier, stateless proposal_id default, Resume-Payload Trust Boundary (4 defenses), symbol `ProposalCard` banned (collision at `ChangeProposalsPanel.tsx:50` + `ProposedPlanClient.tsx:238`). Status: proposed.
- **ADR-0399** (`docs/decisions/0399-channel-platform-descriptors-tool-contract.md`) — `channel_constraint` + `platforms` orthogonal descriptor fields on SmartoutToolDescriptorBase for ADR-0078 + ADR-0133 enforcement. Two-field approach per Option 3. Status: proposed.
- **ADR-0400** (reserved) — `send_message` confirm pattern (Phase 2). Slot reserved, not yet written.
- **ADR-0401** (reserved) — `approve_shift` × four_eyes_pending interaction (Phase 2). Slot reserved, not yet written.

## Learnings captured

- **L-0329 — collision-grep-globally before reserving symbol**: Before reserving any new type/component symbol (e.g. "ProposalCard"), `grep -rn 'ProposalCard'` across the entire codebase. Found 2 live usages (`ChangeProposalsPanel.tsx:50`, `ProposedPlanClient.tsx:238`) that would have caused TypeScript name conflicts. Prevented naming collision at council Phase 1.
- **L-0330 — stateless-default from existing UUID**: For HITL round-trips, `proposal_id` can default to the same UUID already generated for `client_message_id` (which is created before the confirm branch). Makes the draft response self-contained; no extra state needed. Reference: `publish-announcement.ts:262`.
- **L-0331 — BotssonChat-fixed client-tool sub-pattern**: UI primitives that must work on ALL Botsson surfaces (not just one page) should be registered in the "fixed tier" inside `BotssonChat.tsx` itself — not via `useRegisteredTools`. Fixed tier wins on name collision (`BotssonChat.tsx:325–326`). Page-scoped tools still use `useRegisteredTools` for single-surface needs.
- **L-0332 — harness-builder mandatory Phase 3 for Botsson surfaces**: When adding a new client-tool that requires harness type changes (e.g. adding `show_proposal_card` to the client_tools array), the harness-builder agent must be included in Phase 3 of the sortie. Skipping it causes Gate 2 failures requiring a fix-commit (T4-fix pattern). Promote to `harness-builder` brief template amendment.

## Council activity

| Gate | Date | Verdict | Notes |
|------|------|---------|-------|
| Council "Arena Inline-Proposal Cards" | 2026-05-23 | APPROVE WITH CHANGES (5/5 full council) | ADR-0398 + ADR-0399 approved; 2 symbol-collision findings + slot-reservation protocol clarified |
| Gate 1 schema review | 2026-05-23 | PASS after Q6 fix | Q6: package.json exports missing `./primitives/inline-confirm-card` — fixed in commit `c7d16f359` |
| Gate 2 composition review | 2026-05-23 | FAIL initial | 3 blocking findings: `client_tools` array not wired, `description` field in `ClientToolParameter` not optional, `actor_id` missing from emit payloads |
| Gate 2 remediation | 2026-05-23 | — | Fixed in `T4-fix` (`3fa5dd203`) + `T4-fix-2` (`4db305422`) |
| Gate 2.5 fix verification | 2026-05-23 | PASS with one condition | BFF Zod relax confirmed correct; condition satisfied in T4-fix-2 |
| Gate 3 | — | Skipped | T9 reviewer returned HOLD (not REJECT), fixes merged inline to T9-fix |
| T9 final code review | 2026-05-23 | HOLD → RESOLVED | 4 findings (F1: DEFENSE 3 narrowing docs, F2: ring-primary CSS var, F3: nonEmpty() wraps on emit, F4: ANY-type hardening); all remediated in `2fbacd9aa` |

## DEFENSE 3 Phase 1 narrowing (known trade-off)

**What it does:** When `publish_announcement` is called in commit phase (i.e. `params.proposal_id != null`), the tool unconditionally forces `effectiveAudience = { kind: "all" }` and ignores any body-supplied targeting fields (`department_ids`, `roles`, `profile_ids`, `audience_kind`). Code reference: `publish-announcement.ts:329–342`.

**Why:** In Phase 1, we cannot verify that a patched audience fingerprint from the browser actually matches what was shown in the draft card — the descriptor only permits `editable_fields: ["title", "body"]`. Accepting body-supplied audience on commit would allow the user (or an attacker with devtools) to change targeting between draft and commit without the AI having reviewed it.

**Trade-off:** A legitimate user who edited targeting in a future edit-flow (Phase 3) would have their targeting silently reverted to "all" in Phase 1. This is acceptable for Phase 1 since the edit button fires a no-op in Phase 1 (edit-flow is stubbed).

**Phase 2 plan:** Replace with stateful audience-fingerprint stored in `engine_memory` keyed by `proposal_id`. On commit, retrieve the audience that was shown in the descriptor, not the body-supplied params. Deferred to ADR-0400.

## Known issues / debt

1. **Type-import dual-source-of-truth**: `InlineConfirmCardDescriptor` types are inlined into `@smartout/ui/components/inline-confirm-card.tsx` as local types (since `@smartout/ui` doesn't depend on `@smartout/ai`). In Phase 2, evaluate: extract shared types to a `@smartout/types` package OR add `@smartout/ai` as a peer dependency of `@smartout/ui`. Gate 1 verdict accepted this as V1 pattern.

2. **surfaceConstraints inert in Phase 1**: `channel-guard.ts` exports `surfaceConstraintsAllowChannel()` and `channel_constraint` + `platforms` fields are populated on the descriptor (ADR-0399 fields), but the harness pre-filter (Enforcement Layer 1 per ADR-0399) is NOT wired in Phase 1. Voice is structurally blocked by `channel_constraint: ["chat"]` being populated — but enforcement is not yet applied at the BFF routing layer. Wire in Phase 2 BFF.

3. **Edit button is a no-op in Phase 1**: Clicking Endre on the card fires a cancel result (current stub behavior), not a real edit flow. The edit-flow requires a BIR (Botsson Input Request) spawned under the card — deferred to Phase 3. ADR-0398 §Phase 3 documents the intended architecture. The card shows placeholder text "Endring kommer i Phase 3."

4. **Mobile RN port deferred**: `platforms: ["web"]` on the descriptor correctly gates mobile out. Phase 2 (approve_shift adoption, ADR-0401) will add mobile support via the BFF mobile tasks route.

5. **Live verification deferred**: E2E tests exist at `apps/e2e/tests/inline-confirm-card-phase1/` and should pass against a running stack. Live smoke testing (manual admin session with `op run --env-file=.env.template -- pnpm dev`) is deferred to Pontus's close-feature tmux session. Journey files are marked `status: verified-pending-live` until smoke is confirmed.

6. **ADR-0400/0401 are reserved slots only**: No ADR body written. These must be written as separate sorties in Phase 2.

## Next steps

1. **Pontus runs `close-feature.sh 5`** — merges `feat/inline-confirm-card-phase1` to `development`, pushes, removes worktree.
2. **Pontus runs live smoke in tmux** (see "How to verify live" below) — after confirming, mark journey files `status: verified`.
3. **Phase 2a sortie: send_message confirm pattern** — new sortie, write ADR-0400, extend `send_message` capability to return InlineConfirmCard descriptor. Own ADR + own sortie.
4. **Phase 2b sortie: approve_shift × four_eyes interaction** — new sortie, write ADR-0401, mobile BFF route, RN component. Own ADR + own sortie.
5. **Phase 3 (later): real edit-flow** — BIR spawn-under-card, voice_prompt server contract, recipient-preview expansion, `engine_memory` audience-fingerprint (replacing DEFENSE 3 narrowing).

## How to verify live

```bash
# 1. Start stack (from repo root with op run context)
npx supabase start
op run --env-file=.env.template -- pnpm dev   # Next.js on :3060

# 2. Run E2E (from apps/e2e, with running dev stack)
cd apps/e2e
SKIP_WEB_SERVER=1 pnpm exec playwright test tests/inline-confirm-card-phase1/ --project=web --reporter=list

# 3. Manual happy-path smoke
# - Open /dashboard/Botsson (or /dashboard/help) as admin
# - Type: "Lag en kunngjøring om brylluppet som starter fredag og varer til søndag"
# - Observe: InlineConfirmCard renders inline as chat bubble with 3 buttons
# - Click Bekreft
# - Verify: confirmation message appears + card transitions to resolved state (green ring flash)
# - SQL: SELECT event_name, properties FROM activity_trail
#          WHERE event_name LIKE 'inline_confirm_card.%' ORDER BY occurred_at DESC LIMIT 2
# - SQL: SELECT client_message_id FROM channel_message ORDER BY created_at DESC LIMIT 1

# 4. Manual cancel smoke
# - Repeat draft phase
# - Click Avbryt (or press ESC)
# - Verify: terse cancel message + card red-tint transition
# - SQL: SELECT count(*) FROM channel_message WHERE created_at > now() - interval '1 minute'
#          (should be 0 new rows)

# After confirming both: mark journey files status: verified
```

## Defense code references (for security audit)

| Defense | File | Lines |
|---------|------|-------|
| DEFENSE 1 — ctx.workspaceId from auth | `packages/ai/src/capabilities/communication/publish-announcement.ts` | :305–306 (draft), :358 (commit) |
| DEFENSE 2 — audience RLS re-resolution | `packages/ai/src/capabilities/communication/audience-resolver.ts` | entire file |
| DEFENSE 3 — Phase 1 audience narrowing | `packages/ai/src/capabilities/communication/publish-announcement.ts` | :329–352 |
| DEFENSE 4 — RPC UNIQUE constraint | `supabase/functions/` + `publish_announcement_atomic` RPC | migration |
| nonEmpty() fail-fast (ADR-0134) | `packages/ai/src/capabilities/communication/publish-announcement.ts` | :305–306 (shown), :405–406 (confirmed) |
