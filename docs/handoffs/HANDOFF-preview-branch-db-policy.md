---
title: "Handoff: preview Branch DB policy — Option B shipped"
status: ready_for_pr
created: 2026-05-17
updated: 2026-05-17
module: deploy
tags: [handoff, deploy, supabase, adr-0071, adr-0265, adr-0360]
sortie: feat/preview-branch-db-policy
worktree: ~/dev/smartout.ai-wt-3
commits: [12af1ae7f, 135ee88ae, 44707c7d5]
decision: B
council_verdict: APPROVE-WITH-CONDITIONS (all 4 merge-blockers fixed in 44707c7d5)
adrs_shipped: [ADR-0360]
adrs_amended: [ADR-0071]
learnings_resolved: [L-0300]
---

# Handoff: preview Branch DB policy — Option B shipped

## What was built and why

HOP A had been stuck at Stage 2 (smoke RED on preview Supabase surfaces) since the preview Branch DB went DNS-NXDOMAIN. L-0299 (pipe-mask) + L-0300 (smoke-probe + vault stale) captured the symptoms after the 2026-05-17 morning attempt. This sortie picked Option B (drop preview Branch DB) over Option A (provision new) based on 4-day-revealed-preference: the Branch DB had been absent without operational impact for ≥4 days, indicating preview Supabase parity is not load-bearing in current workflow.

Now: HOP A runs end-to-end green. Preview tier = Vercel-only smoke. Edge Function + RLS pre-main testing routes through CI `workflow_dispatch` (adjacent sortie) or post-merge prod smoke instead of always-on Branch DB.

## Decisions made

| Decision | Rationale | ADR |
|---|---|---|
| Option B over Option A | 4-day revealed preference (Branch DB absent, no ops impact); zero recurring cost; drift-surface reduction; restoration is one env var away | ADR-0360 |
| `smoke-probe.sh` preview default empty + SKIP path | Skip ≠ Fail; wrapper Stage 2 exit-code semantics tolerate it without modification | ADR-0360 §1 |
| Production smoke unchanged (ref load-bearing) | Production has different risk profile; `SUPABASE_PROD_REF` default `yljaglomadbhyqpcigff` preserved at smoke-probe.sh:80 | ADR-0360 §2 |
| sync-env-to-vercel.sh: comment out 8 preview entries instead of delete | Reversibility — restoration is one-uncomment-step; script's nuke-and-replace auto-removes from Vercel on next run | ADR-0360 §4 |
| Defer 1Password vault item archival | Reversible later; doc-only debt; restoration path documents unarchive step | ADR-0360 §5 + §7(a) |
| Council convened steward+supervisor only (skip harness, frontend, coord) | No L1–L5 surfaces, no UI, no AI surfaces touched per run-council inclusion rules | run-council skill |

## Files shipped (3 commits, 7 files + 1 new ADR)

- `infra/scripts/smoke-probe.sh` — preview SUPABASE_REF empty default + SKIP path
- `infra/scripts/sync-env-to-vercel.sh` — 8 preview Supabase entries commented + new comment block (council fix)
- `docs/decisions/0360-preview-tier-without-persistent-branch-db.md` — NEW (council prose fixes in 44707c7d5)
- `docs/decisions/0071-preview-environment-architecture.md` — header amendment + strikethrough on branch table
- `docs/decisions/0000-decision-log.md` — ADR-0360 row above ADR-0359
- `docs/protocols/ENV_PROTOCOL.md` — header amendment (steward CONDITION 1)
- `docs/protocols/DEPLOYMENT.md` — header amendment (steward CONDITION 1)
- `docs/plans/PLAN-preview-branch-db-policy.md` — decision: B recorded in frontmatter
- `docs/journeys/JOURNEY-preview-branch-db-policy.md` — 3 journeys (operator HOP A clean, Pontus reads HANDOFF, future operator reads SKILL)
- Skills updated (outside repo, no commit): `~/.claude/skills/deploying/SKILL.md` lines 59, 106, 139, 146, 286, 289-297, 736

## Evidence: HOP A green end-to-end

After Option B execution, real HOP A run from wt-3 wrapper:

```
✅ Gate 1: local development at 74eb55fa
✅ Gate 2: 2 GH Actions runs green on development@74eb55fa
✅ Gate 3: Vercel web + landing CANCELED (Ignored Build Step intentional skip)
✅ Gate 4: preview 1 commit behind development, FF possible
✅ FF: edfb47a7f..74eb55fac preview -> preview
✅ Stage 2 smoke green — 2 OK (Vercel web + landing http 401) + 2 SKIP (Supabase REST + EF, intentional per ADR-0360)
✅ Stage 3 lkg-preview-74eb55fa tagged + pushed
✅ ENFORCED PROMOTE COMPLETE
WRAPPER_EXIT=0 (pipefail propagated correctly — L-0299 fix verified first time in skill)
```

Log: `/tmp/promote-preview-optb-*.log`

## Council verdict

**2/2 APPROVE-WITH-CONDITIONS (convergent).**

Steward (Chair):
- CONDITION 1 (merge-blocker): Amend `ENV_PROTOCOL.md` + `DEPLOYMENT.md` for ADR-0360 → ✅ FIXED 44707c7d5
- CONDITION 2 (advisory): SKILL.md residuals at 139/146/286 → ✅ FIXED in skill (outside repo)

Supervisor (Code-Tracer):
- Defect 1: ADR-0360 §7(b) line ref `:67` → `:74` → ✅ FIXED 44707c7d5
- Defect 2: ADR-0360 §2 prose `SUPABASE_PREVIEW_REF` → `SUPABASE_PROD_REF` → ✅ FIXED 44707c7d5
- Defect 3: sync-env-to-vercel.sh comment rewritten (script auto-removes via nuke-and-replace) → ✅ FIXED 44707c7d5
- Defect 4: SKILL.md:59 surface count → ✅ FIXED in skill
- Nice-to-have 5: ADR-0360 §7 vault unarchive step → ✅ FIXED 44707c7d5 §7(a)
- Nice-to-have 6: 0000-decision-log.md ADR-0071 row [amended] marker → DEFERRED (log-level marker is optional; ADR file itself carries amendment marker at frontmatter `amended_by:` + header note)

Per supervisor verdict: "Once CONDITION 1 lands, no re-council needed."

## All learnings discovered

| Learning | Status | Where encoded |
|---|---|---|
| L-0299 promote-preview pipe-mask | Resolved structurally (skill body documents `set -o pipefail` requirement + post-run state-check) | `deploying` SKILL HOP A + `local-ci-before-pr` SKILL cross-ref |
| L-0300 smoke-probe preview Branch DB stale | RESOLVED by ADR-0360 — Option B drops the source of the drift | `deploying` SKILL HOP A Operational Traps row marked ✅ RESOLVED |
| NEW: sync-env-to-vercel.sh uses nuke-and-replace (filter `grep -v '^#'`) | Documented via fixed comment block; no LOG entry needed (mechanism-discovery, not failure-mode) | sync-env-to-vercel.sh:188-200 comment + ADR-0360 §4 |
| NEW: smoke-probe production "unexpected" FAIL branch is defensive guard, not reachable under current default | Documented in ADR-0360 §2 prose | ADR-0360 |
| Confirmed: `feedback_no_pr_to_development_unprompted` — feat branch pushed to origin, NOT PR'd | Pontus alone decides campaign-class merges; sortie close-feature.sh paths are user-triggered | sortie-pending-close |

## Known issues / debt

| Item | Severity | Note |
|---|---|---|
| Vercel-side preview Supabase env vars still live (dead URLs) until next `sync-env-to-vercel.sh` run | Low | Auto-cleaned on next sync via nuke-and-replace. Until then: harmless (preview SSO-gated, no code calls the dead URLs). |
| 1Password vault item `Supabase Preview Branch` not archived | Low | Doc-only debt. Restoration path documents unarchive step. Operator can archive at convenience or leave with descriptive note. |
| Edge Function + RLS pre-main smoke now opt-in only (CI workflow_dispatch) | Medium | Trade-off explicit in ADR-0360 §Bad. Mitigation: adjacent sortie to add `workflow_dispatch` to `pgtap.yml` + Edge Function workflows = one-click pre-main smoke. |
| 0000-decision-log.md ADR-0071 row no `[amended]` suffix | Trivial | Optional log-level marker; ADR file itself carries amendment marker. Not load-bearing for grepability. |
| `pnpm ci:local` FAIL=1 — mobile jest worker SIGTERM (4 suites killed, 190 tests pass) | Medium | **Not caused by this sortie.** Sortie's diff is 100% infra/scripts + docs + ADR; zero `apps/mobile/**` files. Pre-existing L-jest-vitest-OOM family. Mobile jest is NOT in the 11 required CI checks (separate workflow). Retried with `NODE_OPTIONS=--max-old-space-size=8192 CI=true` in isolation — same SIGTERM. Structural mobile jest config issue. Defer to separate sortie. ci:local r2: PASS:21 / FAIL:1 (mobile only) / WARN:1 (authority-seed-parity tolerated per skill) / SKIP:14. |

## Acceptance criteria (per PLAN)

- [x] `op run -- ./infra/scripts/smoke-probe.sh preview` exits 0 (green OR intentional SKIPs only) — VERIFIED, 2 OK + 2 SKIP, exit 0
- [x] HOP A full run: `set -o pipefail; op run -- ./infra/scripts/promote-preview.sh 2>&1 | tee log.log` exits 0 — VERIFIED, lkg-preview-74eb55fa tagged
- [x] `git tag --list 'lkg-preview-*' | tail -1` shows tag for the just-promoted SHA — `lkg-preview-74eb55fa` present
- [x] `deploying` SKILL.md HOP A Operational Traps L-0300 row marked RESOLVED — done at SKILL.md:736
- [x] ADR-0071 amendment merged before close-feature — committed on feat branch + part of merge package
- [x] Option B: smoke green with intentional SKIPs (not "Vercel preview deploy can read/write to new Branch DB" — that was Option A criterion, N/A)

## Next steps

### To close this sortie (operator: Pontus or Claude on Pontus's request)

1. From `~/dev/smartout.ai-wt-3`, run `pnpm ci:local` — Iron Law per `local-ci-before-pr` skill. Expected: PASS most gates, WARN on `authority-seed-parity` (pre-existing CI pipe-mask tolerance), coverage-check WARN on `infra/**` (no local gate). FAIL=0 required to proceed.
2. Run `pnpm turbo typecheck` from wt-3 — required by close-feature.sh Gate.
3. Run `~/.claude/scripts/close-feature.sh 3` — sortie closure. Merges `feat/preview-branch-db-policy` → `development`, pushes, removes worktree.
4. After merge: `git push origin development` if not auto-pushed.

### Follow-up sortie (separate, not blocking)

**`feat/ci-workflow-dispatch-edge-function-smoke`** — add `workflow_dispatch` trigger to `.github/workflows/pgtap.yml` + Edge Function-related workflows so on-demand pre-main smoke against throwaway Branch DB is one CLI command. Mitigation for ADR-0360 trade-off documented in §Bad. Estimated effort: 1–2 days. Trigger: `gh workflow run pgtap.yml --ref preview`.

### Optional cleanup (operator timing)

- Archive 1Password vault item `Supabase Preview Branch` (`op item delete "Supabase Preview Branch" --vault smartout_ai --archive`) — adds descriptive note pointing to ADR-0360.
- Run `./infra/scripts/sync-env-to-vercel.sh` (full or `--project smartout-web`) to auto-remove the 8 dead Vercel preview Supabase entries via nuke-and-replace. Will also reaffirm all other env vars — no-op for active ones.

## Restoration path (if Option A regret hits later)

Per ADR-0360 §Rules 7 (verbatim):
1. (a) Unarchive vault item if archived
2. (b) Provision Branch DB in Supabase Cloud
3. (c) `export SUPABASE_PREVIEW_REF=<new-ref>` OR update smoke-probe.sh:74 default
4. (d) Update vault item URL + project ref + anon key + service role key
5. (e) Uncomment 8 manifest entries in sync-env-to-vercel.sh
6. (f) Re-run `./infra/scripts/sync-env-to-vercel.sh` (nuke-and-replace re-adds)
7. (g) Revert ADR-0071 amendment + ENV_PROTOCOL.md + DEPLOYMENT.md amendment headers
8. (h) Mark ADR-0360 SUPERSEDED-BY-X

Reversibility verified during plan phase.

## Commits in this sortie

| SHA | Message |
|---|---|
| `12af1ae7f` | docs(deploy): plan + journeys for preview-branch-db-policy sortie |
| `135ee88ae` | feat(deploy): Option B — drop preview Branch DB per ADR-0360 |
| `44707c7d5` | fix(deploy): apply council 4 merge-blockers — ADR-0360 conditions |
