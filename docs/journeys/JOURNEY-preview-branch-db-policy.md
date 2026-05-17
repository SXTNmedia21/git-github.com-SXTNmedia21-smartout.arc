---
title: "Journeys: preview Branch DB policy"
status: draft
created: 2026-05-17
updated: 2026-05-17
module: deploy
tags: [journey, deploy, smoke-probe, promote-preview]
sortie: feat/preview-branch-db-policy
---

# Journeys: preview Branch DB policy

> 3 journeys. All operator-facing (no end-user journeys — this is infrastructure).

## Journey 1: Operator runs HOP A and smoke completes cleanly

**Role:** Pontus (or any deploy operator)

**Precondition:**
- On `development` branch in main repo
- Recent commits ready for preview
- `.env.template` accessible
- 1Password CLI authenticated

**Steps:**

1. Operator types: `set -o pipefail; op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh 2>&1 | tee /tmp/promote-$(date -u +%Y%m%dT%H%M%SZ).log`
2. System runs Stage 1 (Gates 1-4): sync, CI-green, Vercel READY, FF-possible → all green
3. System fast-forwards `preview` to `development` SHA, pushes to origin
4. System runs Stage 2 (smoke-probe preview):
   - **If Option A executed:** all 4 surfaces green (Vercel web, Vercel landing, Supabase REST, Edge Functions)
   - **If Option B executed:** Vercel web + landing green; Supabase REST + EF explicitly SKIPPED with reason "preview Branch DB intentionally absent per ADR-0071-amendment"
5. System runs Stage 3 (lkg-tag): creates `lkg-preview-<short>` tag, pushes to origin
6. System prints: `✅ ENFORCED PROMOTE COMPLETE — preview@<sha>, smoke: green, rollback target: lkg-preview-<short>`

**Postcondition:**
- `git rev-parse origin/preview` equals `git rev-parse origin/development`
- `git tag --list 'lkg-preview-*' | tail -1` contains short SHA
- Operator sees one summary line; no manual intervention required
- Smoke output never shows RED unless real infra problem exists

**Error paths:**
- SSH transient on push: operator retries with `git push origin preview` (FF intact). Per L-0299, post-run state-check catches this.
- Smoke RED on Vercel: real preview deploy broken — investigate Vercel logs, do NOT lkg-tag.
- pipe-mask trap: `set -o pipefail` requirement documented in skill body. Operator who omits it will see operator-incurred mask, not a script bug.

## Journey 2: Pontus reads HANDOFF and accepts policy choice

**Role:** Pontus (decision-maker)

**Precondition:**
- Sortie complete, HANDOFF written
- ADR-0071 amendment (Option B) or new Branch DB provisioned (Option A) in place

**Steps:**

1. Pontus opens `~/dev/smartout.ai-wt-3/docs/HANDOFF-preview-branch-db-policy.md`
2. Reads "Decision" section — Option A or B with rationale + cost analysis
3. Reads "Rollback path" section — how to reverse if needed (e.g. for Option B: provision Branch DB later + revert smoke-probe changes)
4. Reads "What changed" section — list of files touched (smoke-probe.sh, promote-preview.sh, sync-env-to-vercel.sh, ADR-0071, CLAUDE.md, vault item)
5. Reads "Acceptance evidence" — paste of successful HOP A run output
6. Either approves (close-feature.sh runs, merge to development) OR rejects with redirect

**Postcondition:**
- Pontus has full context for accept/reject in ≤5 min reading
- Decision is reversible — rollback path documented step-by-step
- Operational impact in next session is predictable (smoke behavior, lkg-tag behavior, vault item state)

**Error paths:**
- HANDOFF too long: violates ≤5 min budget → tighten before merge
- Rollback path missing: blocking — Pontus rejects until added
- Acceptance evidence absent: blocking — Pontus rejects until HOP A run output pasted

## Journey 3: Future operator reading `deploying` skill understands current preview state

**Role:** Any future operator (Pontus, AI, contractor) running first HOP A after this sortie

**Precondition:**
- `deploying` SKILL.md updated to reflect Phase 2 outcome
- L-0300 row in "HOP A Operational Traps" table updated (RESOLVED or removed)
- Preview tier table in skill body matches infra reality

**Steps:**

1. Operator reads `~/.claude/skills/deploying/SKILL.md` (auto-loaded by deploy intent)
2. Skill body's `### HOP A — development → preview` section: invocation pattern with `set -o pipefail` clearly documented
3. Skill body's Branch & Pipeline Strategy table preview row reflects current truth:
   - **If Option A:** "Persistent Branch DB `<new-ref>`"
   - **If Option B:** "Vercel-only; Supabase testing via CI workflow_dispatch"
4. HOP A Operational Traps table: L-0299 pipe-mask remains documented; L-0300 either gone or marked RESOLVED with brief note
5. Operator invokes promote-preview per the documented pattern; expectations match outcome (per Journey 1)

**Postcondition:**
- New operator can run HOP A correctly without prior context
- Skill body has no stale traps (L-0300 reality matches encoding)
- Skill body has no missing traps (any new gaps discovered are added)

**Error paths:**
- Skill body still claims persistent Branch DB but Option B was chosen: docs drift — fix immediately, not in a follow-up
- Skill body Operational Traps table has L-0300 but it's been resolved: stale encoding — prune
- Operator follows skill but HOP A fails: indicates skill body lies — root-cause and fix skill, not workaround

## Cross-cutting acceptance

For all 3 journeys to be considered shipped:

- [ ] Successful HOP A run captured as evidence in HANDOFF (full log paste)
- [ ] `deploying` SKILL.md preview tier table matches infra reality
- [ ] `deploying` SKILL.md HOP A Operational Traps table reflects post-fix state
- [ ] ADR-0071 amendment (if Option B) merged before close
- [ ] 1Password vault item updated or archived (if Option B) — verified by re-fetching item URL
- [ ] No HOP A operator action required beyond `set -o pipefail; op run -- ...` invocation

## What this sortie does NOT cover

- Production smoke wrapper hardening (separate sortie if needed)
- Per-PR ephemeral Branch DB integration (Open Q #2)
- CI workflow_dispatch for Edge Function smoke (Option B mitigation — adjacent sortie if Option B chosen)
