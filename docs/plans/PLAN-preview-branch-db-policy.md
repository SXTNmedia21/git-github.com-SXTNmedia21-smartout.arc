---
title: "Plan: preview Branch DB policy — provision or drop"
status: in_progress
created: 2026-05-17
updated: 2026-05-17
module: deploy
tags: [deploy, supabase, smoke-probe, adr-0071, adr-0265]
sortie: feat/preview-branch-db-policy
worktree: ~/dev/smartout.ai-wt-3
learnings_in_scope: [L-0299, L-0300, L-first-prod-release-2026-05-13]
adrs_in_scope: [ADR-0071, ADR-0265]
decision: B
decision_at: 2026-05-17
decision_by: Pontus
decision_rationale: "Preview Branch DB absent ≥4 days, zero ops impact = revealed preference. Drop preview Supabase parity, smoke = Vercel-only, amend ADR-0071."
---

# Plan: preview Branch DB policy

> Branch: `feat/preview-branch-db-policy` | Worktree: `~/dev/smartout.ai-wt-3` | Base: `development` (74eb55fac) | Module: deploy | Started: 2026-05-17

## Why

HOP A 2026-05-17 surfaced that preview tier's Supabase Branch DB infrastructure is **structurally absent**:

- `infra/scripts/smoke-probe.sh:67` hardcodes fallback `SUPABASE_PREVIEW_REF=rrjfrisxvrrhyzzitlxd`
- `rrjfrisxvrrhyzzitlxd.supabase.co` returns DNS NXDOMAIN
- `cibmhhgsrdmpnmcikalu.supabase.co` (historical alternate per CLAUDE.md) also dead
- 1Password vault item `Supabase Preview Branch` still has dead URL
- No live preview Branch DB exists

ADR-0071 declares preview tier uses a persistent Branch DB. ADR-0265 declares smoke-probe green is a prerequisite for HOP A lkg-tag. Both ADRs assume infra that does not exist.

Result: HOP A cannot complete to lkg-tag. Promote-preview always ends in partial-completion. The pipeline contract is broken at the gate-5/gate-6 boundary.

This sortie picks ONE policy direction and ships it: either re-establish Branch DB or formally drop preview Supabase parity.

## Out of scope

- Production Branch DB (separate, working, untouched)
- HOP B (preview → main) — unaffected by this decision
- Vercel preview Supabase env vars (downstream of decision; touched only after Option A chosen)
- ADR-0265 pipeline structure (only the smoke-stage Supabase surface is touched)

## Two options (Decision required as Phase 1)

### Option A: Provision new preview Branch DB

Costs:
- New Supabase Branch DB (verify cost line item in Phase 1)
- Migration replay against new ref
- Vault update (`Supabase Preview Branch` item URL + project ref + keys)
- Update `SUPABASE_PREVIEW_REF` default in `smoke-probe.sh`
- Update `sync-env-to-vercel.sh` preview Supabase entries (URL + anon + service role keys)
- Vercel preview env push

Pros:
- ADR-0071 honored as written. Preview tier = full parity with prod minus data.
- Supabase Branch tests pre-merge (Edge Functions, RLS) preserved.
- Smoke green across all 4 preview surfaces.

Cons:
- Recurring cost.
- One more piece of infra to maintain (drift, key rotation, migration sync).
- Infra absent for ≥4 days with no operational impact = signal preview Supabase parity may not be load-bearing in current workflow.

### Option B: Drop preview Supabase, smoke = Vercel-only

Changes:
- `infra/scripts/smoke-probe.sh` Supabase REST + Edge Functions checks for `preview` env: WARN+SKIP instead of FAIL when `SUPABASE_PREVIEW_REF` unset OR resolves to NXDOMAIN. Production env unchanged (still hard-fails).
- `infra/scripts/promote-preview.sh` wrapper Stage 2: tolerate intentional Supabase-preview skip; tag lkg if all non-skipped surfaces green.
- Amend ADR-0071: preview tier = Vercel-only; Supabase Cloud testing happens on `main` push + on-demand local branch.
- Amend ADR-0265: Stage 2 smoke green requirement = `0 FAILs in non-SKIPPED surfaces`.
- Delete/archive 1Password `Supabase Preview Branch` vault item (or mark `archived` with note).
- `sync-env-to-vercel.sh` preview Supabase target: remove or point to local-dev placeholder.

Pros:
- Matches reality. No drift between docs/infra/ADR.
- No recurring cost.
- Fewer moving parts in HOP A.
- Empirical: preview Branch DB absent ≥4 days, no one noticed = revealed preference.

Cons:
- Loss of pre-main Edge Function smoke (must catch in CI workflow_dispatch or post-merge).
- Loss of pre-main RLS smoke (same).
- ADR-0071 amendment is a load-bearing change — invalidates "preview = staging with persistent Branch DB" narrative.

## Recommendation

**Option B**, contingent on Phase 1 confirmation. Rationale:
- Infra absent for ≥4 days with zero operational impact — empirical evidence that preview Supabase parity is not load-bearing.
- L-first-prod-release-2026-05-13 noted gap; no one moved to fix for 4 days = revealed preference.
- Recurring cost + maintenance for a tier nobody uses contradicts minimalism.
- Edge Function + RLS pre-main testing routes through CI on-demand workflow_dispatch (cheaper, opt-in) instead of always-on preview Branch DB.

Pontus decides Phase 1. Recommendation is reversible — Option A remains buildable later.

## Phases

### Phase 1: Decision (≤30 min)

- Pontus reviews this plan
- Pontus picks Option A or Option B
- Decision recorded in this plan's frontmatter (`decision: A|B`) + commit

### Phase 2A: Execute Option A (only if Phase 1 chose A)

1. Create new Supabase Branch DB via Cloud dashboard → capture project ref
2. Replay all migrations against new ref (use Cloud branch flow)
3. Update 1Password vault item `Supabase Preview Branch` (URL, project ref, anon key, service role key)
4. Update `infra/scripts/smoke-probe.sh:67` default fallback ref
5. Update `infra/scripts/sync-env-to-vercel.sh` preview Supabase entries
6. Run `./infra/scripts/sync-env-to-vercel.sh --dry-run --project smartout-web` then real run
7. Verify smoke green: `op run -- ./infra/scripts/smoke-probe.sh preview`
8. Run full HOP A: `set -o pipefail; op run -- ./infra/scripts/promote-preview.sh 2>&1 | tee log.log`
9. Verify lkg-tag pushed: `git tag --list 'lkg-preview-*' | tail -1`

### Phase 2B: Execute Option B (only if Phase 1 chose B)

1. Draft ADR-0071 amendment text (preview = Vercel-only, Supabase testing routes elsewhere)
2. Draft adjacent new ADR if scope warrants (e.g. ADR-0360 "preview tier without Branch DB")
3. Update `infra/scripts/smoke-probe.sh`: preview env Supabase REST + EF checks → SKIP with reason when ref unset or NXDOMAIN; production unchanged (still hard-fails)
4. Update `infra/scripts/promote-preview.sh` wrapper Stage 2: tolerate intentional SKIPs; lkg-tag if all non-skipped surfaces green
5. Update `infra/scripts/sync-env-to-vercel.sh`: remove preview Supabase entries (or point to placeholder)
6. Update CLAUDE.md "Mandatory: Deployment Pipeline" preview tier table to reflect Vercel-only
7. Update `deploying` SKILL HOP A Operational Traps: mark L-0300 as RESOLVED (Option B); update preview tier narrative
8. Archive 1Password vault item or mark with note pointing to ADR amendment
9. Run full HOP A: `set -o pipefail; op run -- ./infra/scripts/promote-preview.sh 2>&1 | tee log.log` — must exit 0 with explicit Supabase-preview SKIP

### Phase 3: Close (HANDOFF + journeys + typecheck)

- Write HANDOFF (decisions, learnings, next steps)
- Verify journeys (3) covered by what shipped
- `pnpm turbo typecheck` green
- `pnpm ci:local` (coverage-check will WARN on infra/** changes — acceptable)
- `/close-feature` to merge to development

## Acceptance criteria (falsifiable)

After Phase 2, ALL must be true:
- [ ] `op run -- ./infra/scripts/smoke-probe.sh preview` exits 0 (green OR intentional SKIPs only)
- [ ] HOP A full run: `set -o pipefail; op run -- ./infra/scripts/promote-preview.sh 2>&1 | tee log.log` exits 0
- [ ] `git tag --list 'lkg-preview-*' | tail -1` shows tag for the just-promoted SHA
- [ ] `deploying` SKILL.md HOP A Operational Traps table: L-0300 row updated to RESOLVED (or row removed)
- [ ] If Option B: ADR-0071 amendment merged to development before close-feature
- [ ] If Option A: Vercel preview deploy can read/write to new Branch DB (probe via curl with anon key)

## Risks

- **Option A:** Branch DB provisioning may require Supabase plan upgrade (verify before commit). If plan upgrade blocks, fall back to Option B.
- **Option B:** Edge Function regressions slip to post-merge. Mitigation: workflow_dispatch CI job to smoke EFs against throwaway Branch DB on-demand before HOP B.
- **Either:** smoke-probe.sh + promote-preview.sh edits hit ADR-0265 enforcement perimeter. Changes require council review per `run-council` skill (inclusion rule: topic touches `infra/**` deploy-critical scripts).

## Council trigger check

Per `run-council` skill, this sortie touches infra/** deploy scripts + amends ADRs. Council REQUIRED before merge:
- Chair: system-steward (ADR coherence, ADR-0071 + ADR-0265 amendment review)
- Quality: supervisor (script behavior + edge cases under new flag)
- Code-tracer: supervisor (trace smoke-probe + wrapper behavior with mock-NXDOMAIN ref)

Optional reviewers (skip unless flagged):
- botsson-harness-builder (no L1-L5 surfaces touched)
- frontend-designer (no UI)

## Open questions

1. Does Smartout's Supabase plan include a free preview Branch DB slot, or is provisioning a paid line item? (Phase 1 verify — affects Option A cost calculation.)
2. Is there a third option: ephemeral per-PR Branch DBs via Supabase preview integration instead of one persistent? (Not in scope unless Pontus flags as Phase 1 input.)
3. Should production smoke get parallel hardening to L-0299 pipe-mask (pipefail in production smoke wrapper)? Likely yes — file as adjacent learning, not blocking this sortie.

## Definition of done

- One of {Option A, Option B} executed end-to-end
- HOP A demonstrably completes to lkg-tag without operator intervention (other than `set -o pipefail`)
- ADR-0071 + ADR-0265 reflect post-execution reality
- L-0300 marked RESOLVED in skill body + learning log
- HANDOFF written and journeys verified
- Sortie closed via `/close-feature`
