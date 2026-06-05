---
title: Commit Ledger — campaign/master-refactor
status: in_progress
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [commit-ledger, commit-steward, domain-tier, audit]
---

# Commit Ledger — frontend-refactor campaign

> Maintained by the **`commit-steward`** skill. Every commit categorized by **domain + tier**
> (`tier ∈ {ready, gap}`, derived from the domain's `control.json`). The steward is a **control gate**:
> a unit that misses its Definition of Done is **bounced**, not committed (see the skill). This ledger
> is the audit-of-record; tags mark domain milestones. Append-only; newest at bottom of each table.

## Committed

| hash | date | domain | tier | lane | type(scope) | gate | telemetry | atomic | tag | notes |
|------|------|--------|------|------|-------------|------|-----------|--------|-----|-------|
| `e67c9dc4e` | 2026-06-03 | infra | — | campaign | feat(campaign) | n/a | n/a | ✓ | — | seed telemetry-loop machinery + 567KB reuse-map into home |
| `8767e1adc` | 2026-06-03 | min-dag | ready | web/telemetry | feat(telemetry) | layer-1 ✓ | 6 events registered | ✓ | — | 3-site register + dist rebuild; unblocks min-dag-v2 typecheck |
| `e36f25d66` | 2026-06-03 | infra | — | campaign | feat(campaign) | n/a | n/a | ✓ | — | commit-steward skill + rule-8 delegation |
| `2cdb761c2` | 2026-06-03 | infra | — | campaign | docs(campaign) | n/a | n/a | ✓ | — | reference pointer → min-dag-v2; consolidation plan |
| `3e81ee2a5` | 2026-06-03 | oversikt | ready | web/telemetry | fix(telemetry) | n/a | 1 event fix | ✓ | — | receipt_nudge_sent → workspace_id |
| `affa646f2` | 2026-06-03 | infra | — | campaign | chore(agents) | n/a | n/a | ✓ | — | roster defs + agent memory (prior-instance WIP) |
| `e64589cca` | 2026-06-03 | infra | — | campaign | chore(skills) | n/a | n/a | ✓ | — | work-mode-core + orchestrator refinements |
| `8e37b1838` | 2026-06-03 | infra | — | web | chore(web) | n/a | n/a | ✓ | — | botsson site-map update |
| `eb1a907c3` | 2026-06-03 | infra | — | campaign | docs(handoffs) | n/a | n/a | ✓ | — | 179 consolidated handoffs (rule-10 rescue) |
| `1b2a440e6` | 2026-06-03 | infra | — | campaign | feat(agents) | n/a | n/a | ✓ | — | sxtn roster (architect/builder/orchestrator/harness/refactor) |
| `ae1df7aee` | 2026-06-03 | infra | — | campaign | docs(campaign) | n/a | n/a | ✓ | — | log-legibility standard + sandbox map |
| `45701f428` | 2026-06-03 | infra | — | campaign | chore(repo) | n/a | n/a | ✓ | — | .cursorignore |
| `de7128423` | 2026-06-03 | infra | — | campaign | chore(repo) | n/a | n/a | ✓ | — | gitignore design-export (rule 11) + .sxtn pycache |
| `1e5462c30` | 2026-06-03 | infra | — | enforcement | fix(hooks) | n/a | n/a | ✓ | — | hook #10 exempt WCAG reduced-motion (a11y false-pos) |
| `e26bf6425` | 2026-06-03 | oversikt | wip-L2 | web | feat(oversikt) | L2 (emit wired; L3 unproven) | ported port | ✓ | — | oversikt-v2 polished port landed wip-L2 |
| `5ce178867` | 2026-06-03 | infra | — | campaign | docs(campaign) | n/a | n/a | ✓ | — | mission manifest + live dashboard + orchestrator board-regen pin |
| `cb6833354` | 2026-06-03 | infra | — | campaign | feat(harness) | n/a | n/a | ✓ | — | track .sxtn canon hub (runbook superset, 236 files) |
| `be5d9c727` | 2026-06-03 | infra | — | campaign | docs(decisions) | n/a | n/a | ✓ | — | ADR-0441 multi-orchestrator model + L2/L3 contract |
| `649202ae2` | 2026-06-03 | infra | — | campaign | chore(harness) | n/a | n/a | ✓ | — | scaffold dedupe complete (root dups removed, 0-loss) |
| `091c3f338` | 2026-06-03 | infra | — | campaign | docs(campaign) | n/a | n/a | ✓ | — | regenerate telemetry-map aggregate (board refresh) |
| `5c18a2282` | 2026-06-03 | infra | — | campaign | docs(harness) | n/a | n/a | ✓ | — | agent_id-keyed memory + L-0372 lock-collision lesson |
| `00442d28f` | 2026-06-03 | infra | — | campaign | docs | n/a | n/a | ✓ | — | register L-0372 in learning log + council note |
| `723bd27c0` | 2026-06-03 | infra | — | campaign | docs(council) | n/a | n/a | ✓ | — | capture 2026-06-03 fan-out-readiness council |
| `6e12dadae` | 2026-06-06 | lonn | wip-static | web/payroll | feat(lonn) | static ✓ (tsc green, eslint 0 err); runtime DoD-1/2/3/4 + G8 PENDING | ported emits (unverified L3) | ✓ | — | land lønn v2 port + Increment-2 fixes (A ÷100 NOK, B period gross sum, C missing my-lonn-v2 page.tsx, D e2e department_id). SKIP_PAGE_POLISH founder-approved proving-run; no `lonn/ready` tag until polish run + G8 |

> **Phase-1 consolidation note (2026-06-03):** reverted a 76-file `dev/`→`wsl/` path-rewrite drift
> (uncommitted, dead paths — SMA-378) before committing; tree went 88→0 modified. All 4 judgment buckets
> resolved: `.sxtn/` canon tracked (236 files, locks/pycache gitignored) · scaffold deduped to one
> `.sxtn/runbook` superset (root dups deleted 0-loss) · `design-export/` gitignored · `oversikt-v2`
> landed `wip-L2` (`e26bf6425`). Phase-1 COMPLETE — tree clean, 29 commits, worktree lock held.

## Bounced / in-loop (failed DoD — NOT committed, looping until done)

| unit | domain | tier | failed criteria | exact gap | fix path |
|------|--------|------|-----------------|-----------|----------|
| `min-dag-v2` (page) | min-dag | ready | DoD #6, #7 | (#6) control.json not re-verified against MR; (#7) no `dashboard-min-dag-v2.run.yml verified:true` (page-polish gate #9). **Passing:** typecheck ✓, adapter/no-ghost ✓, copy-law ✓, events registered ✓ | run page-polish → emit run.yml; re-verify control.json in MR (or founder-approved `SKIP_PAGE_POLISH` for the proving run); then resubmit to steward |

## Domain tier index (from reuse-map + control.json)

`ready` = buildable now (real backend) · `gap` = backend gap, close DB first (DB-wall gated).

| domain | tier | basis |
|--------|------|-------|
| min-dag | ready | fn_list_my_tasks + schedule_shift exist; control.json GREEN |
| oversikt | ready | real fetches; control.json GREEN |
| hms · lonn · oppgaver | ready* | control.json GREEN (oppgaver has a minor `control_list_attempt` gap → may be `gap`) |
| vaktplan · ansatte · planlegging · kommunikasjon · avstemming | gap | ungated writes / hookless / mock-only / 0-row seed (control.json FAIL) |

## Tags applied

_(none yet — first domain milestone tag lands when min-dag-v2 clears its DoD: `min-dag/ready`)_
