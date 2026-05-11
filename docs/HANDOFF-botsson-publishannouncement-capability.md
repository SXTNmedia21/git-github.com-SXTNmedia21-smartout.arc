---
title: HANDOFF — Botsson publishAnnouncement Capability
feature: botsson-publishannouncement-capability
status: ready-for-close-pending-docker
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [handoff, publishannouncement, capability, agent-tool, integration]
---

# HANDOFF — Botsson publishAnnouncement Capability

## Summary

Agent-callable capability tool for publishing workspace announcements. Two-call pattern: `confirm: false` returns draft + audience preview; `confirm: true` publishes via `channel_message` INSERT. Voice channel rejected in-tool. callGateAction wraps mutation per ADR-0287. Server-side audience resolution preserves PII boundary — agent never receives raw `target_profile_ids`.

**wt-6 acts as integration branch** for the full publishAnnouncement feature:
- Merged W1 (`feat/nyheter-engagement-wave-a` — 15 commits, including telemetry registry extension + Wave A UI + seed migration fix)
- Merged W2 (`feat/sendmessage-adr-0287-retrofit` — 4 commits, including `gate.ts` wrapper + sendMessage retrofit)
- Added Track A: `communication` capability seed migration (Council B2 prereq)
- Added Track B: publishAnnouncement tool + server-side audience resolver
- Added Track C: 4 Playwright integration specs (live Supabase DB-assertion model)

Council 2026-05-11 verdict: APPROVE-WITH-CONDITIONS. All 8 blockers (B1-B8) folded into spec + implementation.

## What was built

11 commits on `feat/botsson-publishannouncement-capability`:

```
8eaf48852 test(komm-nyheter): publishAnnouncement 4 integration specs (live Supabase)
5c03e94a4 feat(seed): communication capability authority seed for engine_authority_config
335753d15 feat(communication): publish_announcement capability tool + audience resolver
81b975a75 merge: feat/sendmessage-adr-0287-retrofit (W2) into publishAnnouncement integration
338bff323 merge: feat/nyheter-engagement-wave-a (W1) into publishAnnouncement integration
a90072005 docs(publishannouncement): plan + 4 journeys for integration sortie
2598f6b60 docs(specs/publishannouncement): patch per Council 2026-05-11 findings
bf4f7b71a docs(specs): botsson-publishannouncement-capability spec stub
[+ pre-existing development commits]
```

### Files added (publishAnnouncement-specific)

- `packages/ai/src/capabilities/communication/audience-resolver.ts` (133 lines) — server-side port of `useAudienceResolver` (5 audience kinds)
- `packages/ai/src/capabilities/communication/publish-announcement.ts` (168 lines) — capability tool with two-call draft-return pattern
- `packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.test.ts` (385 lines) — 5 unit tests
- `supabase/migrations/20260601000000_seed_communication_authority.sql` — seed migration
- `supabase/tests/seed_communication_authority_test.sql` — pgTAP (3 assertions)
- `apps/e2e/komm-nyheter/agent-publish/journey-1-draft-then-publish.spec.ts` (334 lines)
- `apps/e2e/komm-nyheter/agent-publish/journey-2-voice-reject.spec.ts` (171 lines)
- `apps/e2e/komm-nyheter/agent-publish/journey-3-fail-closed.spec.ts` (246 lines)
- `apps/e2e/komm-nyheter/agent-publish/journey-4-pii-boundary.spec.ts` (231 lines)

### Files modified

- `packages/ai/src/capabilities/communication/index.ts` — `publishAnnouncement` registered in `allTools` + `suggestTools`
- `packages/ai/package.json` — exports map adds `./capabilities/communication/publish-announcement`
- `apps/e2e/package.json` — `@smartout/ai: "workspace:*"` added

## Decisions made

1. **Integration-branch pattern over wait-for-merge.** wt-6 merges W1 + W2 locally rather than waiting for Pontus's close-feature flow on each. Closes Council Trust Gate HOLD on prereqs. When Pontus closes wt-1 + wt-2 + wt-6 sequentially, ancestry is preserved (merge commits).
2. **Capability-level authority seed, NOT action_type-level.** Council resolved Steward vs Agent-coord disagreement: `gate_action` RPC keys on `(workspace_id, capability)` — capability-level granularity covers all action_types under `communication`. Single seed row per workspace.
3. **Two-call pattern: confirm=false → draft, confirm=true → publish.** ADR-0099 §C4 four-eyes not yet wired for `communication` capability. Two-call pattern is the soft-confirm bridge until C4 lands. Agent calls with `confirm: false` to get draft + count, shows user, then re-calls with `confirm: true` after user agrees. Prevents agent auto-publishing workspace-wide content.
4. **Voice reject as FIRST statement in execute(), BEFORE gate.** Per Council B3 + ADR-0078: gate_action's `channel_allowed` only activates with `p_engine_process_id`, which direct agent tool calls don't pass. Voice rejection MUST be in-tool. No gate call, no audience resolution, no DB query — clean fail-close.
5. **Server-side audience resolver port, NOT import.** `useAudienceResolver` from Wave A is `"use client"` — browser-only. Server-side resolver is a port at `audience-resolver.ts` using `ctx.supabaseAdmin`. ~80 LOC duplication acceptable per ADR-0173.
6. **PII boundary on tool return.** Tool result contains `target_profile_count` + `audience_label` + (when published) `message_id`. NEVER raw `target_profile_ids[]`. ADR-0151 + ADR-0163. Unit test + E2E spec both verify.
7. **`audience_kind: "announcement"` policy gate uses `"text"` interaction type.** Track B subagent found `isAiAllowedInChannel` accepts `"text" | "voice"` only. Announcement IS a text-typed message. Mapped to "text" per policy.ts contract + sendMessage precedent.
8. **PostgREST embedded join shape: `department` is array.** `select("department(name)")` returns `{ department: { name: string }[] }`, not nullable single object. Track B adapted with `p.department[0]?.name` access pattern.

## Learnings

- **wt-6 integration-branch pattern is reusable.** Future agent-side capabilities depending on UI-side foundations can adopt the same pattern: merge prerequisite branches into the new sortie, do the work, then close prereq branches in order. Avoids long blocking chains.
- **gate_action `channel_allowed` is engine_process-conditional.** L-WAVE-A-PUB-01: gate_action evaluates channel restrictions ONLY when `p_engine_process_id` is passed. Direct agent tool calls (no engine_process) bypass channel-allow logic. Tool-level channel guard is the only reliable defense for capability surfaces. Capture in BOTSSON-SYSTEM-MAP §Open gaps next update.
- **Communication capability default-allow trap was hidden.** L-WAVE-A-PUB-02: migration `20260518000000` header listed `communication` as NOT seeded, but the sendMessage retrofit (`3dc9a4c26`) shipped without a seed row — Track B publishAnnouncement build would have inherited the same gap silently if Council hadn't caught it. CI gate `gate-action-coverage.ts` (deferred sortie) checks call-site presence but not seed-parity for the consumed capability. Future capabilities adding gate calls must also verify seed exists.

## Known issues / debt

- **Live E2E execution BLOCKED on Docker WSL2 integration.** All 4 publishAnnouncement specs typecheck clean + are committed at `8eaf48852`. Live execution requires `docker` available in WSL — currently "The command 'docker' could not be found in this WSL 2 distro." Pontus action: enable WSL integration in Docker Desktop settings. Once Docker is up + Supabase running at `127.0.0.1:54321`, run: `cd apps/e2e && SKIP_WEB_SERVER=1 pnpm exec playwright test komm-nyheter/agent-publish --reporter=list` — expect 5/5 pass (across 4 specs; Journey 1 has 2 tests).
- **Wave A live E2E still 1/5 pass.** `feat/e2e-nyheter-stabilize` sortie on wt-4 closed 2/5 → cherry-pick + selector fixes shipped, but 3/5 dissolve only when Wave A merges to development (dev server picks up Wave A UI code). Same Docker dependency.
- **Communication seed migration is dev-only.** Production workspaces need the seed too. Migration uses `INSERT-SELECT WHERE EXISTS w.workspace_id`, so it WILL fire on production when run there — but only seeds workspaces that exist at migration time. Future workspaces created post-migration need either a trigger to auto-seed OR inclusion in `capability_default_registry` (deferred sortie).
- **Page-polish gate not run for Wave A.** `dashboard-komm.run.yml` skipped on W1 commits. Carries forward through wt-6 merge. Pontus pre-close-feature manual smoke gate.

## Next steps (deferred sorties)

1. **`feat/gate-action-coverage-ci`** — Build AST walker per ADR-0287 §"Ship order" item 1. Promote ADR-0287 from `proposed` to `accepted`. CI gate prevents future capability tools from skipping callGateAction.
2. **`feat/c4-four-eyes-communication`** — Wire `change_proposal` flow for `communication.publish_announcement` confirm tier. Replaces two-call soft-confirm pattern with proper second-eye approval. Spec needed.
3. **`feat/communication-seed-on-workspace-create`** — Auto-seed `communication` capability for newly created workspaces via trigger or inclusion in `capability_default_registry`. Closes "seed only covers existing workspaces" gap.
4. **`feat/get-news-feed-capability-tool`** — Read-side counterpart so agent can answer "what announcements were posted this week?" without bypassing visibility_scope/target_profile_ids RLS (currently `getChannelContext` doesn't filter on those).
5. **`feat/pin-unpin-agent-capability`** — Agent can pin/unpin announcements via authorized tool. Requires C4 confirm tier (pin = workspace-wide affect).
6. **Docker WSL2 integration verification** — Document the recurring "docker not in WSL" failure mode in second-brain ops + create a heartbeat check that verifies `docker ps` reachable.

## Verification results

| Gate | Outcome |
|---|---|
| `pnpm --filter @smartout/ai typecheck` | ✅ 0 errors |
| `pnpm --filter web typecheck` | ✅ 0 errors |
| `pnpm --filter @smartout/e2e exec tsc --noEmit` (komm-nyheter scope) | ✅ 0 errors |
| `pnpm --filter @smartout/ai exec vitest run src/capabilities/communication/__tests__/` | ✅ 18/18 pass (policy 10 + publishAnnouncement 5 + sendMessage 3) |
| `pnpm --filter web exec vitest run src/app/dashboard/komm src/app/dashboard/_components` | ✅ 48/48 pass |
| pgTAP `seed_communication_authority_test.sql` | ✅ 3/3 (per Track A subagent report) |
| `npx supabase db reset` | ✅ exit 0 (per Track A subagent report) |
| **Live Playwright `apps/e2e/komm-nyheter/agent-publish/`** | ⏸ BLOCKED — Docker WSL2 integration inactive. Specs typecheck clean, committed at `8eaf48852` |
| Page-polish `dashboard-komm.run.yml` | ⏸ Pontus pre-close manual |

## Pontus close-feature sequence

Recommended order:

1. Enable Docker Desktop WSL2 integration → re-run agent-publish specs from wt-6 → flip 4 journeys to verified if green
2. Manual smoke on `/dashboard/komm/nyheter` from wt-1 → flip 5 Wave A journeys to verified
3. Manual smoke on agent tool path (if Botsson stack is invokable in dev env) for wt-2 → flip 3 sendmessage-retrofit journeys
4. `~/.claude/scripts/close-feature.sh 1` — Wave A merges to development
5. `~/.claude/scripts/close-feature.sh 2` — sendmessage-retrofit merges
6. `~/.claude/scripts/close-feature.sh 4` — e2e-stabilize merges (specs should be 5/5 once Wave A is on development)
7. `~/.claude/scripts/close-feature.sh 6` — publishAnnouncement integration merges. NOTE: since wt-6 already merged W1 + W2 internally, the close-feature.sh on wt-6 produces a clean merge into development without conflict (W1 + W2 already on development by this point).

If close-feature.sh detects "already merged" on the W1 + W2 commits (because they came via wt-6's internal merge), accept and continue — ancestry is preserved by the merge commits.
