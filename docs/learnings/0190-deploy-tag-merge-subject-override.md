---
title: "[deploy] tag does not propagate through gh pr merge default subject — must use explicit --subject"
id: L_0190
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0190: [deploy] tag does not propagate through gh pr merge default subject — must use explicit --subject

## Why

ADR-0265 gates all three Vercel deployments on the `[deploy]` stop-phrase in the triggering commit message. The `ignoreCommand` in `apps/web/vercel.json` (line 3) and `apps/landing/vercel.json` (line 3) reads:

```
if git log -1 --pretty=%B | grep -q '\[deploy\]'; then exit 1; else exit 0; fi
```

Vercel's `ignoreCommand` exits 1 to CANCEL the build, or exits 0 to proceed. The gate therefore cancels builds on commits WITHOUT `[deploy]` and allows builds on commits WITH `[deploy]`. This is the designed cost-saving mechanism: only intentional release commits trigger a Vercel deploy.

The critical trap: `gh pr merge <N> --merge` produces a merge commit with the subject line taken from the PR title — not from any of the commits in the branch. A PR titled "chore(release): preview → main" will produce a merge commit with that subject. If that subject does not contain `[deploy]`, all three Vercel production deploys silently skip.

This was caught during the 2026-05-04 council code-trace by the deploy-conductor specialist reviewer. The Phase 3 chair had missed it. The pipeline plan claimed "Vercel deploy triggered by merge commit" but the claim was contingent on the subject containing the tag — a condition not spelled out in the plan text.

Without this fix, every HOP B merge (preview → main) would skip Vercel production deploy entirely. The CI edge-functions job (which also checks for `[deploy]` in `github.event.head_commit.message` at `ci.yml:258`) would similarly skip. Three silent non-deploys per release cycle.

## How to apply

When executing HOP B (preview → main merge):

```bash
# CORRECT — always pass explicit subject with [deploy] tag
gh pr merge <N> --merge --subject "chore(release): preview → main [deploy]"

# WRONG — subject comes from PR title, may not contain [deploy]
gh pr merge <N> --merge
```

The `promote-preview.sh` script and the `/deploy` slash-command template must hardcode this subject override. Never rely on the PR title to carry the tag.

Also applies to any direct commit to `preview` that is intended to trigger Vercel (e.g. during Scenario K recovery or hotfix): the commit message must contain `[deploy]` explicitly.

The stop-phrase gate is documented in `docs/protocols/DEPLOYMENT.md` §6 and referenced in `docs/decisions/0265-enforced-deployment-pipeline.md` §Decision.

## Pattern signature

- Pipeline uses stop-phrase/continue-phrase gate on commit message content
- Merge operation uses a CLI tool (`gh`, `git merge`, GitHub API) that generates its own subject
- Plan or runbook says "deploy is triggered by the merge" without specifying the subject format
- Build is silently canceled with no error visible to the operator

## References

- `apps/web/vercel.json` — `ignoreCommand` at line 3 (stop-phrase gate)
- `apps/landing/vercel.json` — same gate
- `.github/workflows/ci.yml` line 258 — edge-functions deploy gated on `[deploy]`
- `../decisions/0265-enforced-deployment-pipeline.md` — ADR governing the pipeline
- `docs/protocols/DEPLOYMENT.md` — §6 stop-phrase gate documentation
