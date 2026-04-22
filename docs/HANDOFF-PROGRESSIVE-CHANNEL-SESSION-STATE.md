---
title: Progressive Channel — Mid-Session Handoff
status: in_progress
updated: 2026-04-20
created: 2026-04-20
module: Helpdesk
tags: [handoff, progressive-channel, session-resume]
---

# Progressive Channel — Mid-Session Handoff (for context-compact resume)

## Your Role (continues)

You orchestrate. You do NOT write code. You spin up subagents with dedicated context + scope boundaries.
- Low confidence → dispatch `/run-council` skill or verification subagent
- Final gate → E2E tests per user journey must pass
- Iterate bug fixes until green

## Current State (after Wave 2a merged)

**Campaign:** `campaign/helpdesk` @ latest merged. Pushed earlier to origin at `d52a72e5`, not pushed since Wave 2a merges.

**Merged to campaign in this session:**
1. **Wave 1 (3 sub-sorties):**
   - Sub-B: `feat/helpdesk-domain-taxonomy` — 11 hospitality domains (Phase 2 prereq 3)
   - Sub-C: `feat/helpdesk-pii-classifier` — ADR-0166 regex classifier + DB columns on `channel_message` (`classification_metadata`, `redacted_at`, `original_content_hash`)
   - Sub-D: `feat/helpdesk-dispatcher-entity-pk` — L-0085 fix, ENTITY_PK extended with channel/channel_message/engine_state
2. **Wave 2a (2 sub-sorties):**
   - `feat/helpdesk-cutover-backend` — migration `20260515160000` (backfill + VALIDATE + DROP old CHECK), 6 Server Actions in `apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts`, 5 telemetry events, capability tool updates (openTicket privacy_mode branching, resolveTicket completed_at per L-0079). 172 tests pass. Web typecheck clean. Branch deleted after merge.
   - `feat/helpdesk-cutover-mobile` — ConversationBody extracted to `apps/mobile/src/components/komm/ConversationBody.tsx`, `(queue)/` deleted, `(komm)/` created with segment-tabs. Chat tab preserved with LiveKit. Branch deleted after merge.

**Turbo typecheck after Wave 2a merge:** 33/33 green.

**Not pushed:** campaign/helpdesk needs push after Wave 2b + 2c complete.

## Fresh Worktrees Ready for Wave 2b Dispatch

| Worktree | Branch | Purpose |
|---|---|---|
| `/home/sxtnl/dev/smartout.ai-helpdesk-wt-1` | `feat/helpdesk-cutover-web` | Web UI: Skranke tab + Min kø sidebar + delete `desks/` page |
| `/home/sxtnl/dev/smartout.ai-helpdesk-wt-2` | `feat/helpdesk-cutover-e2e` | E2E test specs (7 tests per spec §E2E) |

**No subagents dispatched yet for Wave 2b.** User asked about context compact before I sent the first dispatch.

## Next Steps — Execute in Order

### Step 1: Dispatch Wave 2b (Web + E2E in parallel)

**Web subagent (wt-1) scope:**
- DELETE `apps/web/src/app/dashboard/komm/desks/` entirely. Copy `ResponsibleRepCombobox.tsx` out first if needed.
- CREATE `apps/web/src/app/dashboard/komm/_components/SkrankeTab.tsx` (4 presets + tilpasset, consequence summaries, expand-in-place rep combobox). Calls `upgradeChannelToHelpdesk` / `downgradeChannelFromHelpdesk` from `_actions/helpdesk-channel-actions.ts` (already merged).
- CREATE `apps/web/src/app/dashboard/komm/_components/MinKoSection.tsx` + `_hooks/useMinKo.ts`. Queries engine_state for current user's open tickets, groups by channel, renders above Kanaler in sidebar.
- Channel-list rows: Lucide `Lighthouse` badge when `helpdesk_enabled=true`, `Lock` when `privacy_mode='private_per_requester'`, open-count badge when current user is responsible rep.
- Wire SkrankeTab into existing channel-settings modal (grep `_components/` for ChannelSettingsModal or similar; if absent, create minimal modal + wire to channel-row settings action).
- Nordic Split: Lucide only, Instrument Serif headings, Geist body, Geist Mono time with color-shift at 5min/15min. prefers-reduced-motion respected.
- Commit per milestone. Scope `helpdesk-channel`. Co-Authored-By Claude Opus 4.6 (1M context).
- STOP after commits. Do NOT push. Do NOT close-feature.

**E2E subagent (wt-2) scope:**
- 7 specs in `apps/e2e/tests/`:
  1. `helpdesk-progressive-upgrade.spec.ts`
  2. `helpdesk-downgrade-blocks-with-open-tickets.spec.ts`
  3. `helpdesk-public-ticket-lifecycle.spec.ts` (L-0079 regression)
  4. `helpdesk-private-ticket-lifecycle.spec.ts`
  5. `helpdesk-pii-redaction.spec.ts` (ADR-0166)
  6. `helpdesk-rls-jwt-insert-blocked.spec.ts` (Supervisor F4 regression)
  7. `helpdesk-rep-demotion-on-reassign.spec.ts` (L-0080 regression)
- Follow existing Playwright patterns in `apps/e2e/tests/` — grep for patterns.
- Tests may reference components the Web subagent is building in parallel — specs can reference planned selectors/data-testid per spec. If real Supabase infra unavailable, mark `.skip` with comment pointing to regression guard.
- Commit per test file or batch. Scope `helpdesk-channel`.
- STOP after commits.

Use `Agent` tool with `subagent_type: general-purpose`, dispatched IN PARALLEL via single message with 2 Agent calls.

### Step 2: Merge Wave 2b to campaign

```bash
cd /home/sxtnl/dev/smartout.ai-helpdesk
git merge --no-ff feat/helpdesk-cutover-web -m "feat(merge): ..."
git merge --no-ff feat/helpdesk-cutover-e2e -m "feat(merge): ..."
pnpm turbo typecheck  # expect 33/33 green
git worktree remove --force /home/sxtnl/dev/smartout.ai-helpdesk-wt-1
git worktree remove --force /home/sxtnl/dev/smartout.ai-helpdesk-wt-2
git branch -D feat/helpdesk-cutover-web feat/helpdesk-cutover-e2e
```

### Step 3: Wave 2c — docs + final handoff (optional 3rd sub-sortie OR directly)

- Write `docs/HANDOFF-progressive-channel-cutover.md` — umbrella handoff for 1A.2
- Write `docs/journeys/JOURNEY-progressive-channel-cutover.md` — end-user journeys (admin upgrade, rep Min kø, requester PII-redaction experience, mobile queue migration)
- Update `docs/DASHBOARD.md` — campaign status
- Commit as `docs(helpdesk-channel): Progressive Channel Phase 1A.2 umbrella docs`

### Step 4: Run E2E tests — user journey verification

```bash
cd /home/sxtnl/dev/smartout.ai-helpdesk
# Ensure Supabase local is running
npx supabase status
# Run the helpdesk E2E suite
pnpm --filter e2e test helpdesk
```

**If tests fail:** dispatch a bug-fix subagent with the specific failure output + affected file paths. Iterate until green.

**If infra-dependent tests are `.skip`:** report which and justify (e.g., requires auth fixtures the e2e suite doesn't have yet).

### Step 5: Push + mark feature done

```bash
git push origin campaign/helpdesk
```

Update `council_meta.md` with session outcome. Write end-session narrative to activity log.

## Guardrails (non-negotiable)

- **L-0079:** `engine_state.status='complete'` writes must stamp `completed_at=now()`.
- **L-0080:** Reassignment mutations demote prior rep to `role='member'`, don't delete.
- **L-0087:** Any new column → update `packages/ai/src/capabilities/__tests__/supabase-mock.ts` TABLE_SCHEMAS in same PR.
- **RLS:** Server Actions use service-role client (`@smartout/supabase/server`), NOT JWT.
- **ADR-0133:** Mobile is execute-only. No authoring UIs (no upgrade/downgrade/reassign buttons on mobile).
- **ADR-0166:** PII soft-hold classifier runs before publish. Redacted message shown in public timeline + original routed to private sub-channel.
- **Nordic Split:** Lucide icons only (no emoji). Warm OKLCH via CSS variables. Instrument Serif + Geist + Geist Mono.
- **Commit scope:** `helpdesk-channel` (kebab-case). Body wrap 100 chars (commitlint). Co-Authored-By Claude Opus 4.6 (1M context).
- **Commitlint type:** close-feature.sh writes "sync(...)" which is rejected. Skip the script; do manual `git merge --no-ff` with type `feat(merge)` or `chore`.

## Council Trigger Conditions

Dispatch `/run-council` when:
- E2E test failures suggest cross-system interaction bugs (not just typos)
- Scope change request from user
- Ambiguous UX decision during bug-fix iteration
- Before any new ADR

For single-domain questions or obvious bug fixes, dispatch a focused subagent instead of full council.

## Active ADRs + Learnings for This Feature

- ADR-0161 (ticket=engine_state, amended by 0165)
- ADR-0163 (allowedChannels mandatory, amended by 0166)
- ADR-0165 (Progressive Channel Discriminator — THE authoritative ADR)
- ADR-0166 (PII public-mode redaction — soft-hold classifier)
- L-0079 (completed_at stamping)
- L-0080 (rep demotion on reassign)
- L-0085 (dispatcher ENTITY_PK hand-maintained ceiling)
- L-0086 (channel_ai_policy plumbing ≠ feature)
- L-0087 (mock-surface trap — first ship-block use)
- L-0088 (ontology change ≠ presentation change)

## Last Successful Subagent Reports

**Backend (wt-1 before rotation):**
- 4 commits: `4493426f` (migration) → `f3c74432` (telemetry) → `5fb75869` (Server Actions) → `86ec526b` (capability branching)
- Mock caught `author_profile_id` vs `sender_id` column drift — L-0087 working.
- 172 tests pass.

**Mobile (wt-2 before rotation):**
- 4 commits: `d16e12fa` (ConversationBody extract) → `2b8b0931` ((komm) routes) → `e021a708` (delete (queue)) → `cf5e85a6` (journey)
- Chat tab preserved with LiveKit calls + reactions.
- Mobile typecheck clean after each milestone.

Both branches already merged + deleted. Fresh wt-1/wt-2 ready for Wave 2b.

## Resume After /compact

When user resumes, read this file first. Then dispatch the two Wave 2b agents (Web + E2E) in parallel per Step 1. Subagent prompts in this file are sufficient — no need to re-read the full spec; just reference sections.
