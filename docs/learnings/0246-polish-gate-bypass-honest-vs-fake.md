---
title: "L-0246 — Polish-gate bypass via SKIP_PAGE_POLISH is honest; flipping verified to true without measurement is fake"
id: L-0246
status: accepted
created: 2026-05-14
updated: 2026-05-14
module: dev-workflow
tags: [polish-gate, husky, verification, infra-failure, page-polish, council-verdict]
related: [ADR-0308]
---

# L-0246: Polish-gate bypass via SKIP_PAGE_POLISH is honest; flipping `verified: true` without measurement is fake

## Trigger

Polish-sortie `feat/schedule-page-polish-tier1` in `~/dev/smartout.ai-wt-2`. Sub-agent shipped a 5-file perf-fix diff implementing SKILL.md-prescribed patterns (`loading.tsx` returns null, AnimatePresence crossfade, `next/dynamic` lazy-load, deferred queries via `options.enabled`). Agent's runtime LCP measurement was invalid (measured against MAIN repo dev-server on :3060, not against wt-2 served code). Docker WSL2 integration was off, so re-measuring against wt-2 immediately wasn't possible.

Polish-gate (husky pre-commit hook, `.husky/pre-commit:245-281`) blocks any change to `apps/web/src/app/dashboard/<route>/**` unless `.claude/page-polish/<route-slug>.run.yml` has `verified: true`. Three options surfaced:

1. Pattern-match: flip `verified: true` based on diff inspection alone
2. Wait for Docker WSL2 + re-measure (sortie held open indefinitely)
3. Bypass via `SKIP_PAGE_POLISH=1` env-var (existing hook escape)

Council (system-steward + supervisor + frontend-designer, 3/3 convergent) verdict: option 3.

## Pattern

When the polish-gate fires and infrastructure blocks measurement, the temptation is to flip `verified: true` based on diff inspection — "the code looks like what the skill says, so it must be verified." This is **structural confidence**, not **empirical confidence**. They are different claims. SKILL.md Phase 1 is explicit: "Without baseline, 'feels faster' is theatre."

Flipping `verified: true` without measurement makes `run.yml` lie. The file claims a state that wasn't observed. Future polish-runs see the precedent — "last time we just flipped it, the patterns matched" — and the gate erodes one sortie at a time until it's performative.

`SKIP_PAGE_POLISH=1` bypass leaves a visible trace in `git log`. The commit history records exactly which sorties bypassed and why. `run.yml` stays `verified: false` (honest about what was measured). The sortie stays open until real measurement happens. Both signals are auditable; both stay accurate.

## Rule

When polish-gate fires and infrastructure blocks runtime measurement:

1. **Do not** flip `verified: true` based on diff inspection alone.
2. **Do not** introduce new run.yml fields (`measured_elsewhere`, `code_review_only`) to soften the gate. New fields without validators rot into noise.
3. **Do** commit via `SKIP_PAGE_POLISH=1 git commit` with a commit body that contains:
   - The infrastructure failure mode (e.g., "Docker WSL2 integration off")
   - The SKILL.md section reference for each pattern applied
   - The follow-up plan to re-measure when infra returns
4. **Do** keep the sortie open. `verified: true` is the close-feature gate, not a per-commit gate.

The bypass is the honest path because:

- Git history records the bypass explicitly
- `run.yml` remains accurate (`verified: false` until measured)
- The gate's empirical contract is preserved for future sorties
- A reviewer scanning `grep -r SKIP_PAGE_POLISH=1` can audit every bypass as a class

## Counter-Pattern (don't do)

Flipping `verified: true` while `lcp_ms: null` and `improved: null` makes the run.yml claim measurement that didn't happen. This is the same class of error as a test that returns `pass` without running assertions — the gate becomes ceremonial. Detect by grep: `verified: true` rows with `null` LCP fields are the smell.

Adding a `measured_elsewhere: true` field to run.yml has no validator, no convention, no enforcer. It silently lowers the bar with no governance. If staging/CI Lighthouse becomes a legitimate measurement source, file an ADR that defines `pre_measured_at` + `evidence_url` + signed-by schema first.

## Promotion

Promoted to ADR-0308 ("Polish-Gate Semantics — Measurement, Bypass, Verified-Flip") same-day. ADR codifies the bypass conditions; this learning records the reasoning.

## Recurrence Watch

If polish-gate vs infra-failure conflict surfaces 3+ times across different sorties, consider:

- Migrating Phase 1 baseline from Lighthouse-cli to Playwright CDP script (`apps/e2e/scripts/<route>-perf-baseline.ts` pattern) — runs headless without dev-server in the loop
- CI-run Lighthouse on merged-to-development build, with retroactive `verified: true` flip via signed reference (ADR-0308 open question)
