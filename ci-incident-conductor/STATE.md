---
title: ci-incident-conductor STATE
status: canonical
updated: 2026-05-05
created: 2026-05-05
module: ci-incident-conductor
tags: [ci, state, adr-0275]
---

# ci-incident-conductor — STATE

## Current phase

**Phase 0 — Log-only**

Unlock criteria for Phase 1: 14 days Phase 0 + ≥ 5 incidents logged.

Phase 0 entered: 2026-05-05 (first triage run, knowledge bundle bootstrapped).

last-verified: 2026-05-05T12:00:00Z

---

## Phase metric baselines

No metric data yet — Phase 0, first run.

| Metric              | Baseline | Source       |
| ------------------- | -------- | ------------ |
| failure_rate        | unknown  | —            |
| mttd                | unknown  | —            |
| mttr                | unknown  | —            |
| auto_fix_share      | 0%       | no fixes yet |
| false_auto_fix_rate | 0%       | no fixes yet |
| flaky_recurrence    | unknown  | —            |
| cache_hit_rate      | unknown  | —            |
| ci_duration_p50     | unknown  | —            |
| ci_duration_p95     | unknown  | —            |
| rerun_rate          | unknown  | —            |

---

## Known failure patterns

| Pattern ID | Description                     | Class            | Occurrences (30d) | Notes                                                                                                                                                                                                                 |
| ---------- | ------------------------------- | ---------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-001      | tariff-test-coevolution         | test-coevolution | 2                 | Phase 2 sortie shipped impl rewrite (tariff UTC-fix) without updating test suite. Helligdagstillegg fixture must set non-zero baseRate. Saturday-evening stacking test must reflect weekday-gated §4-3 kveldstillegg. |
| P-002      | campaign-merge-format-drift     | format-drift     | 1                 | campaign/mobile sub-sorties authored without running prettier-plugin-tailwindcss. Files pass human review, fail --check. Pattern: campaign sorties need `pnpm exec prettier --write` gate pre-merge.                  |
| P-003      | xargs-batch-masks-prettier      | diagnostic-trap  | 1                 | `xargs pnpm exec prettier --check` splits file list into batches; each batch can pass while specific files fail. Use direct explicit file list to reproduce CI failure locally.                                       |
| P-004      | adr-dup-collision               | adr-collision    | 1                 | Two ADRs claiming same number in same batch commit. Pre-commit hook blocks push. Resolve: rename later/weaker file to next gap, update frontmatter id.                                                                |
| P-005      | missing-dep-post-campaign-merge | missing-dep      | 1                 | Campaign merge adds new dep to package.json+lockfile but `pnpm install` not re-run in main repo. TS2307 at pre-push typecheck. Fix: `pnpm install --frozen-lockfile` after any campaign merge that adds deps.         |

---

## Active overrides

None.

---

## Known doc-drift bugs (divergence from ADR-0275)

| ID        | Source doc                   | ADR says                             | Reality                                                                                                       | Flagged    |
| --------- | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------- |
| DRIFT-001 | ADR-0275 Reflection Protocol | `log-activity.sh` source value: `ci` | Script rejects `ci`; valid values: session, heartbeat, migration, research, ingest, memory, git, user, system | 2026-05-05 |

---

## Known-bad action versions

Node.js 20 actions (`actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`) are deprecated — deprecated 2026-09, forced Node.js 24 from June 2026. Not causing current failures but flag on next ci-config class incident.

---

## Incident counter (today: 2026-05-05)

CI-2026-05-05-001: format-drift + test-coevolution (PR #318) — RESOLVED 341accc60
CI-2026-05-05-002: format-drift + adr-dup + missing-dep (dev HEAD c90daea6) — RESOLVED 23edbd506

Next ID: CI-2026-05-05-003
