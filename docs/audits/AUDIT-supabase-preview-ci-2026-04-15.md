---
title: Supabase Preview CI Audit — Phase 0 unblock verification
status: done
updated: 2026-04-15
created: 2026-04-15
module: infra
tags: [ci, supabase, preview, audit, shift-lifecycle]
---

# Audit — Supabase Preview CI cancellation on PRs #178-#182

Reference: `docs/plans/PLAN-secure-shift-lifecycle.md` WS-B1

## TL;DR

- **Not a CI/workflow bug.** "Supabase Preview" is not a GitHub Actions job — it is the **Supabase GitHub App / managed integration** (branching). There is no YAML for it in `.github/workflows/`.
- **`CANCELLED` on PRs #178-#181 = stack supersession**, not a red-flag failure. All four PRs were open concurrently against `development`; the Supabase integration auto-cancels older preview-branch runs when a newer commit supersedes them. `detailsUrl` pointed to `…/settings/integrations` (no branch), which is the Supabase integration's fingerprint for a cancelled/superseded run.
- **`FAILURE` on PR #182** = the actual migration error (broken `message_template` seed referencing non-existent `template_key` column).
- **`SUCCESS` on PR #183** = the fix landed. Preview branching is healthy again.
- **`db reset` locally is clean.** All 306 migrations apply against a fresh DB with zero failures. Four pgTAP suites all PASS.

No remediation required. No Pontus credentials action needed. The blocker identified in WS-B1 has already resolved itself via PR #183.

## Evidence

### Workflow search

```
rg -l "supabase|Supabase" .github/workflows/   → no matches
ls .github/workflows/                          → ci.yml, claude-code-review.yml,
                                                 claude.yml, pipeline-enforcement.yml
```

Conclusion: "Supabase Preview" is sourced from the Supabase GitHub App installed on the repo, not an Actions workflow.

### PR status rollup

| PR | Title | Supabase Preview | Details URL |
|----|-------|------------------|-------------|
| #178 | Unified authority-gate RPC | CANCELLED | `…/yljaglomadbhyqpcigff/settings/integrations` |
| #179 | Shift derivation layer | CANCELLED | `…/yljaglomadbhyqpcigff/settings/integrations` |
| #180 | Shift-lifecycle engine processes | CANCELLED | `…/yljaglomadbhyqpcigff/settings/integrations` |
| #181 | shift_lifecycle capability + view | CANCELLED | `…/yljaglomadbhyqpcigff/settings/integrations` |
| #182 | Forward Phase 4+5 | **FAILURE** | `…/qcfqrtydlfveiboxocik` (real preview branch) |
| #183 | Fix message_template seed | **SUCCESS** | `…/sjnfdsfcajjnvolciwxq` (real preview branch) |

Key signal: #178-#181 URLs all point to an `/settings/integrations` path with a single shared project ref. That is not a preview branch — it is how the Supabase integration represents "this run was superseded, no branch exists". #182 and #183 URLs contain real, distinct preview-project refs, which is how healthy runs render.

### Root cause category

- **Category:** config (expected integration behavior), not a broken workflow or missing secret.
- **Specific signal:** CANCELLED = older branch superseded by newer commit in the stack; FAILURE = real migration apply error on PR #182.
- **Remediation:** none — already fixed by PR #183.

## Verification (WS-B2)

### `npx supabase db reset` on `origin/development` (tip `4baa7723`)

Result: **all 306 migrations applied, zero failures**. Seed ran to completion. Storage buckets reconciled.

Notable non-errors observed in output:
- `pg_cron not installed — archive_completed_engine_states_daily NOT scheduled` — expected on Supabase Local, migration `20260508100100` guards this correctly.
- Many `NOTICE` entries for `policy … does not exist, skipping` — idempotent DROP IF EXISTS patterns, benign.
- Many `push-dispatch: missing config, skipping` — seed-time notifications without push config, benign.

### pgTAP suites (all against fresh reset DB)

| Suite | Result |
|-------|--------|
| `supabase/tests/gate-action.sql` | **PASS (5/5 assertions)** |
| `supabase/tests/derivation.sql` | **PASS (8/8 assertions)** |
| `supabase/tests/lifecycle-processes.sql` | **PASS (8/8 assertions)** |
| `supabase/tests/lifecycle-capability.sql` | **PASS (7/7 assertions)** |

Total: **28 / 28 pgTAP assertions PASS**. Zero failures.

## Conclusions

1. WS-B1 is **resolved without code change**. The cancellations were correct integration behavior, and PR #183 already fixed the one real migration failure (PR #182).
2. WS-B2 is **verified green**. Database resets cleanly; all four existing pgTAP suites pass.
3. No action for Pontus. No credentials, admin access, or workflow edits required.

## Follow-ups (optional)

- Consider documenting the Supabase GitHub App cancellation semantics in a short ops note so future CANCELLED states aren't misread as broken CI.
- If we want first-party CI coverage independent of Supabase's managed preview, we could add a GitHub Actions job that runs `supabase db reset` + pgTAP suites on every PR. Out of scope for WS-B1/B2.
