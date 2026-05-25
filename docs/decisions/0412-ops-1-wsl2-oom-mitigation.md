---
title: "OPS-1 WSL2 OOM cliff mitigation -- 4-layer strategy"
id: ADR-0412
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0412: OPS-1 WSL2 OOM cliff mitigation -- 4-layer strategy

## Context and Problem Statement

WSL2 development host (Ryzen 7 3700X, 15 Gi RAM, swap=0B) OOM-killed the Next.js
16 web dev server 4 times during the 2026-05-23 journey sweep (47 runs, ~500 tests).
Each kill cascaded `ERR_NETWORK_CHANGED` across 5-15 subsequent Playwright tests,
requiring disambiguation reruns -- estimated ~30% sweep overhead. Chair Phase 5
synthesis (2026-05-24) ranked OPS-1 as #1 priority, the multiplier on every other
triage estimate.

Root cause: Next.js 16 tsc/build peaks ~5 GB; Playwright auto-workers + chromium
tabs add 2-4 GB; Claude Code sessions hold ~2 GB; total regularly exceeds 14 Gi
of 15 Gi available RAM, with no swap to absorb the overflow.

## Decision Drivers

- 4 documented OOM occurrences on the same day -- pattern is reliable, not fluke
- No swap on WSL2 by default -- all overflow goes straight to OOM killer
- `playwright.config.ts` `workers: undefined` (local) = Playwright auto-selects
  workers based on CPU cores, ignoring RAM constraints
- ci:local had no memory pre-flight -- operator gets no warning before OOM
- Each ERR_NETWORK_CHANGED kill corrupts the entire in-flight test batch

## Considered Options

1. **Layer A: Playwright workers cap** -- set `workers: 1` locally by default
2. **Layer B: ci:local memory pre-flight gate** -- abort with actionable message if < 6500 Mi available
3. **Layer C: Production build mode test script** -- `pnpm build + start` instead of `pnpm dev` for tests
4. **Layer D: WSL2 swap docs** -- document how to add 8-16 GB swap on Windows host

## Decision Outcome

Chosen option: **All four layers, shipped together** as defense-in-depth.

Layer A is zero-risk and prevents the primary OOM vector immediately.
Layer B surfaces the problem early with actionable remediation steps.
Layer C provides a stable alternative for sweep runs where memory is constrained.
Layer D is the permanent fix -- swap eliminates the cliff entirely.

## Rules & Consequences

- **Good, because Layer A** removes the primary trigger: `workers: undefined` on 8-core
  WSL2 host = 8 concurrent chromium tabs + 8 next-server watchers = guaranteed OOM.
  `workers: 1` keeps total RAM under ~8 Gi even without swap.

- **Good, because Layer B** gives the operator a clear, actionable warning before
  wasting 15-30 minutes on a sweep that will OOM mid-run. Lists top RAM consumers
  and suggests kill candidates.

- **Good, because Layer C** reduces web server RAM by ~60% during test runs. Next.js
  production server does not run tsc or Turbopack -- it serves pre-compiled bundles.
  Stable for sweep sessions; slower for iteration (must rebuild after code changes).

- **Good, because Layer D** is the only permanent fix. `.wslconfig` swap=16GB
  survives reboots, requires no code changes, and allows safely raising `E2E_WORKERS`
  to 2 for faster sweep runs.

- **Bad, because Layer A** slows local sweeps: 1 worker = sequential test files.
  Mitigation: after adding swap (Layer D), override `E2E_WORKERS=2`.

- **Bad, because Layer C** requires a full rebuild before test runs. Not suitable
  for tight dev-test loops. Reserved for sweep runs and CI-mirror sessions.

- **Agent Impact:** Any agent or operator running Playwright tests locally MUST
  check `free -h` available memory before starting a sweep if swap is still 0B.
  `ci:local` now enforces this automatically. To override (risky):
  `CI_LOCAL_SKIP_MEMORY_CHECK=1 pnpm ci:local`.

## Implementation Details

### Layer A -- `apps/e2e/playwright.config.ts`
```
workers: process.env.CI ? 1 : Number(process.env.E2E_WORKERS ?? 1)
```
Override via `E2E_WORKERS=2` env var when swap is available.

### Layer B -- `scripts/ci-local.sh`
`check_memory()` function inserted immediately after Supabase Local preflight.
Reads `free -h` available column, parses Gi/Mi, aborts if < 6500 Mi.
Lists top 5 RAM consumers + 3 remediation options.
Override: `CI_LOCAL_SKIP_MEMORY_CHECK=1`.

### Layer C -- `apps/e2e/package.json`
New script: `test:e2e:prod-mode` -- runs `SKIP_WEB_SERVER=1` Playwright using
a pre-started production server. Operator must `pnpm --filter web build && pnpm --filter web start -- --port 3060` first.

### Layer D -- `docs/protocols/WSL2-SWAP-CONFIG.md`
Documentation only (cannot apply to Windows host from inside WSL).
Covers `.wslconfig` `swap=16GB` + WSL shutdown + verify + per-session fallback.

## References

- BUGS.md OPS-1 section: `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`
- Chair Phase 5 synthesis: 2026-05-24 journey-sweep triage
- MEMORY.md: `learning_wsl2_oom_3rd_occurrence_2026_05_23.md`
- WSL2 swap docs: `docs/protocols/WSL2-SWAP-CONFIG.md`
- E2E README: `apps/e2e/README.md`
- ADR-0359: Enforced CI Coverage Mandate (ci:local gate framework)
