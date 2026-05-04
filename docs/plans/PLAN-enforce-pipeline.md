---
title: "Plan — enforce-pipeline"
status: done
updated: 2026-05-03
created: 2026-05-03
module: cross-cutting
tags: [plan, deployment, enforcement]
---

# Plan — enforce-pipeline

> Branch: `feat/enforce-pipeline` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: cross-cutting | Started: 2026-05-03

## Goal

Enforce the existing 3-branch deployment pipeline (`development → preview → main`)
via single-purpose gates and a continuous review function, so promote attempts
are either green-and-shipped or red-and-blocked-with-a-clear-reason. Per ADR-0265.

## Spec

`docs/decisions/0265-enforced-deployment-pipeline.md`

## Tasks

- [x] Task 1: Write ADR-0265 enforced deployment pipeline
- [x] Task 2: Create `infra/scripts/smoke-probe.sh` (post-deploy health verification)
- [x] Task 3: Create `infra/scripts/drift-check.sh` (4-channel parity, JSON mode for heartbeat)
- [x] Task 4: Create `infra/scripts/promote-preview.sh` (repo wrapper: 4 gates → smoke → lkg tag)
- [x] Task 5: Add CI jobs `Edge Functions` + `Migration State` to `.github/workflows/ci.yml`
- [x] Task 6: Create `migration_state_latest()` RPC migration (service_role only)
- [x] Task 7: Create `.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` (operator checklist)
- [x] Task 8: Update `.claude/commands/promote-preview.md` to point at repo wrapper + Stage 2/3
- [x] Task 9: Add 5 hard rules to `docs/protocols/DEPLOYMENT.md`
- [x] Task 10: Add `drift-check` heartbeat job to `~/dev/second-brain-v2/HEARTBEAT.md`
- [x] Task 11: Write `JOURNEY-enforce-pipeline.md` (HOP A, HOP B, drift response)
- [x] Task 12: Write `HANDOFF-enforce-pipeline.md` with operator-action list
- [x] Task 13: Register ADR-0265 in `0000-decision-log.md`

## Operator follow-up (not in this sortie — Pontus does)

- [ ] **F1**: Create real Vercel API token, mirror to both 1Password vaults
- [ ] **F2**: Add `Enforce branch flow`, `pgTAP Suites`, `authority-seed-parity` to required-checks rulesets (main + preview)
- [ ] **F3**: Add CI secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_URL`, `SUPABASE_PROD_SERVICE_ROLE_KEY`

See `HANDOFF-enforce-pipeline.md` § "Operator actions required" for details.

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` (no new TS files in this sortie)
- [x] Bash syntax check passes for all 3 new scripts
- [x] YAML syntax check passes for `ci.yml`
- [x] `drift-check.sh --skip-droplet` returns green on clean repo
- [x] Decision log updated (ADR-0265)
- [x] User journeys written (3 journeys: HOP A, HOP B, drift response)
- [x] Handoff written with explicit operator follow-up list
- [x] DEPLOYMENT.md hard-rule list updated
