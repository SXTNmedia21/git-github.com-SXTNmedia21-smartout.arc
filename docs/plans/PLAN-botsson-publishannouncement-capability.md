---
title: "Plan — botsson-publishannouncement-capability"
feature: botsson-publishannouncement-capability
spec: ../superpowers/specs/2026-05-11-botsson-publishannouncement-capability.md
status: draft
updated: 2026-05-11
created: 2026-05-11
module: MODULE_COMMUNICATION
tags: [plan, botsson, capability, publishannouncement, agent-tool]
---

# Plan — botsson-publishannouncement-capability

> Branch: `feat/botsson-publishannouncement-capability` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-6` | Module: MODULE_COMMUNICATION

**Spec:** [Botsson publishAnnouncement Capability (Council-patched)](../superpowers/specs/2026-05-11-botsson-publishannouncement-capability.md)

## Integration model (Council Trust Gate HOLD resolution)

wt-6 acts as **integration branch** for the full publishAnnouncement feature. Sequence:

1. Merge `feat/nyheter-engagement-wave-a` into wt-6 (W1: telemetry registry extension + Wave A UI + seed migration fix)
2. Merge `feat/sendmessage-adr-0287-retrofit` into wt-6 (W2: gate.ts wrapper + sendMessage retrofit)
3. Write `communication` capability seed migration (Council B2 prereq)
4. Build publishAnnouncement tool + server-side audience resolver
5. Write 4 journey-aligned E2E specs (Playwright + service-role DB assertions)
6. Run full E2E suite (Wave A specs + new publishAnnouncement specs)
7. HANDOFF

When done, Pontus runs `close-feature.sh` on each underlying branch (W1, W2, this integration) in order — close-feature.sh enforces journey-verified + typecheck + handoff gates per branch.

## Journeys (the contract)

- [JOURNEY-...-agent-drafts-then-publishes](../journeys/JOURNEY-botsson-publishannouncement-capability-agent-drafts-then-publishes.md) — two-call pattern: first call returns draft + audience preview; second call publishes after human confirm
- [JOURNEY-...-agent-attempts-over-voice](../journeys/JOURNEY-botsson-publishannouncement-capability-agent-attempts-over-voice.md) — `ctx.channel === "voice"` → in-tool reject as FIRST statement
- [JOURNEY-...-fail-closed-without-seed](../journeys/JOURNEY-botsson-publishannouncement-capability-fail-closed-without-seed.md) — when `communication` capability seed missing OR `level < suggest`, gate denies; no INSERT
- [JOURNEY-...-pii-boundary-no-raw-ids](../journeys/JOURNEY-botsson-publishannouncement-capability-pii-boundary-no-raw-ids.md) — tool return value contains only `target_profile_count` + `audience_label`; NEVER raw `target_profile_ids[]`

## Tasks

### Pre-task (coordinator — no sub-agent)

- [ ] Merge W1 into wt-6 via `git merge --no-ff feat/nyheter-engagement-wave-a`
- [ ] Merge W2 into wt-6 via `git merge --no-ff feat/sendmessage-adr-0287-retrofit`
- [ ] Verify typecheck clean post-merge before sub-agent dispatch

### Track A — Communication seed migration (sub-agent)

- [ ] New migration `supabase/migrations/{TS}_seed_communication_authority.sql`
- [ ] INSERT-SELECT WHERE EXISTS pattern (mirrors `2b728a9c6` fix)
- [ ] Seeds `(workspace_id, capability='communication', level='suggest', min_role='employee', requires_four_eyes=false)` for every existing workspace
- [ ] pgTAP asserting row exists post-migration

### Track B — Tool + audience resolver (sub-agent)

- [ ] Port `useAudienceResolver` logic (5 audience kinds) to server-side at `packages/ai/src/capabilities/communication/audience-resolver.ts` (NEW file). Uses `ctx.supabaseAdmin`. Returns `{ profileIds, count, label }`.
- [ ] New tool `publish_announcement` at `packages/ai/src/capabilities/communication/publish-announcement.ts` (NEW file). Two-call pattern: `confirm: false` returns draft + audience preview; `confirm: true` publishes via INSERT.
- [ ] In-tool voice reject as FIRST statement in execute().
- [ ] callGateAction BEFORE INSERT.
- [ ] Tool return shape: `{ phase: "draft"|"published", message_id?, target_profile_count, audience_label, draft?: { title, body } }` — NEVER raw IDs.
- [ ] Register tool in `packages/ai/src/capabilities/communication/index.ts` `suggestTools`.
- [ ] Unit tests: granted-draft path, granted-publish path, voice-denied path, missing-seed denied path, PII boundary assertion.

### Track C — E2E specs (sub-agent)

- [ ] 4 Playwright specs at `apps/e2e/komm-nyheter/agent-publish/` (new dir)
- [ ] DB-assertion model (matches Wave A pattern from `bcbfa3115`)
- [ ] Specs invoke the capability tool via test-side fixture (NOT through full Botsson stack — that needs LiveKit/Ultravox + intent classifier infra beyond Wave A scope)
- [ ] Assertions: channel_message row shape + activity_trail audit + telemetry properties

### Track D — Full verification (coordinator)

- [ ] `pnpm turbo typecheck` zero errors
- [ ] `pnpm --filter @smartout/ai test` all pass (existing + new publish-announcement tests)
- [ ] `pnpm exec playwright test komm-nyheter` — Wave A + agent-publish specs all pass
- [ ] HANDOFF written

## Untouchable

- Other capabilities' `gate.ts` or `tools.ts`
- `packages/ai/src/gate/gatedMutation.ts` core
- `apps/mobile/**`
- Wave A app code paths (`apps/web/src/app/dashboard/komm/_components/`, `_hooks/`, `_actions/` — they're already shipped via W1 merge)
- `packages/telemetry/src/registry.ts` — already extended via W1 merge

## Acceptance Criteria

- [ ] All 4 journeys flip `status: draft → verified` after E2E passes
- [ ] Typecheck zero, vitest green, playwright green
- [ ] HANDOFF documents: integration sequencing decision, communication seed migration shape, 2-call draft-return pattern, PII boundary contract
- [ ] No Wave A app code touched (verify via git diff after merge)
