---
title: ci-incident-conductor RUNS
status: canonical
updated: 2026-05-05
created: 2026-05-05
module: ci-incident-conductor
tags: [ci, runs, reflection, adr-0275]
---

# ci-incident-conductor — RUNS

Append-only. One entry per triggering run per ADR-0275 Reflection Protocol.

---

## Format

```
## <incident_id> | <ISO date> | <failure_class> | <action>

- Branch: <branch>
- PR: <pr_url_or_NA>
- Run: <run_id>
- Classification: <class> (confidence <0.0–1.0>)
- Action: <auto-fix|suggest|escalate|no-op>
- Duration impact: <N min estimated>
- Recurrence (30d): <N>
- Learnings:
  - [NEW|CONFIRMED|STALE|DUPLICATE] <finding>
```

---

## CI-2026-05-05-002 | 2026-05-05 | compound: format-drift + missing-dep | auto-fix applied

- Branch: development
- PR: NA (direct push — PR #320 campaign/mobile merge)
- Run: 25351839017 (triggered by ci-agent commit post-merge on dev)
- Jobs failed: Format Check, ci-agent.yml (chain-cause)
- Classification:
  - Failure A: `format-drift` (confidence 1.0) — 19 mobile calendar + design-tokens files fail prettier --check. prettier-plugin-tailwindcss className reorder not applied before campaign/mobile merged to development.
  - Failure B: `adr-dup` (confidence 1.0) — ADR-0276 number collision. Two files with same ADR number: 0276-mission-run-contract.md and 0276-mobile-shift-authoring-via-bff.md. Pre-commit hook blocked commit.
  - Failure C: `missing-dep` (confidence 1.0) — `date-fns-tz` in apps/mobile/package.json + lockfile but NOT materialized in node_modules (pnpm install not run after campaign/mobile merge). Blocked pre-push typecheck.
- Action: auto-fix applied
- Root cause:
  - Format: campaign/mobile sub-sortie did not run prettier on the mobile calendar redesign files before the campaign merge to development. Files authored without prettier-plugin-tailwindcss className reorder pass (human sees nothing wrong) but fail --check.
  - ADR-dup: Two ADRs both number-claimed 0276 in the same batch commit `569098d9a` during governance chore. The mobile-shift-authoring ADR was the new unique one; mission-run-contract had a prior ADR (0274) with identical title.
  - Missing dep: `date-fns-tz` added to apps/mobile/package.json in campaign/mobile but local pnpm install was not re-run in main repo after the PR merged.
  - Local/CI mismatch root cause: Pontus tested with `xargs` batching which split the 19-file list into batches that each passed. Direct `--check` on the specific 19 files fails. The `xargs` splitting was the source of the false "all clean" local result.
- Fixes applied:
  1. `pnpm exec prettier --write` on all 19 mobile/design-tokens files.
  2. `0276-mobile-shift-authoring-via-bff.md` → `0277-mobile-shift-authoring-via-bff.md` + `id: ADR_0277` in frontmatter.
  3. `pnpm install --frozen-lockfile` to materialize `date-fns-tz@3.2.0`.
- Commit: 23edbd506 on development
- Push: 30b6a47dc..23edbd506 → remote origin/development
- Duration impact: ~35 min (diagnosis + fix + hook debugging)
- Recurrence (30d): 1 (format-drift pattern, 2nd occurrence overall — 1st was CI-2026-05-05-001-FIX)
- Learnings:
  - [NEW] xargs batching masks prettier failures when checking a specific-file subset. When local `xargs pnpm exec prettier --check` says clean but CI says dirty, test with direct explicit file list. Root cause of the "local passes / CI fails" mismatch in this case.
  - [CONFIRMED] campaign/mobile sub-sorties: mobile files authored without prettier-plugin-tailwindcss pass human review but fail --check. Pattern: campaign sorties need a `pnpm exec prettier --write` gate before merge. Surfaces as format-drift.
  - [NEW] ADR-dup collision class: pre-commit hook on main repo blocks push. Resolve by renaming the later/weaker-referenced file to next gap, updating frontmatter id. Collision visible in git diff immediately after commit.
  - [NEW] Missing dep after campaign merge: `pnpm install` not re-run in main repo after PR merge. Package in package.json + lockfile but absent from node_modules. Pre-push typecheck fails with TS2307. Fix: `pnpm install --frozen-lockfile` in main repo after any campaign merge that adds new deps.
  - [CONFIRMED] ci-agent.yml auto-commit after every triage run causes format check to see a wider commit range than expected. SHA used by CI = ci-agent commit, not the merge commit. Base used = ~10 commits back. This expands the file set under check from 41 to 259 files.

---

## CI-2026-05-05-001 | 2026-05-05 | compound: format-drift + app-bug | escalate

- Branch: feat/schedule-harness-tariff-utc-fix
- PR: https://github.com/SXTNmedia21/smartout.ai/pull/318
- Run: 25351064063
- Jobs failed: Format Check (job 74330533140), Vitest packages (job 74330533177)
- Classification:
  - Failure A: `format-drift` (confidence 1.0) — `apps/web/src/lib/cascade/resolve-tariff-rate.ts` fails prettier --check. Single file, known fix: pnpm exec prettier --write.
  - Failure B: `app-bug` (confidence 0.97) — 2 Vitest tests fail in `resolve-tariff-rate.test.ts`. Tests were written for the OLD UTC-based implementation; the Phase 2 PR ships a rewritten timezone-aware implementation (Riksavtalen ADR fix) but did not update the test suite to match the new semantics.
- Action: escalate (app-bug is NOT in auto-fix allowlist; format-drift IS in allowlist but fixing format without also fixing the tests would leave CI red — fixing format alone is a no-op for the PR merge gate)
- Root cause detail:
  - Format: resolve-tariff-rate.ts was modified in Phase 2 but not run through prettier before push. Exit 123 from prettier --check.
  - Tests: two failures in test file:
    1. `applies helligdagstillegg for public holiday` — test expects hellig?.amount === 100 (the old fixed percent from tariff row). New impl pushes helligdagstillegg as `amount: baseRate` in `kr/t`, and baseRate=null→0 in makeContext(). So amount is 0, not 100. §4-2 change is semantically correct (100% of actual baseRate per Riksavtalen) but the test fixture uses baseRate: null which resolves to 0.
    2. `stacks multiple kr/t supplements: Saturday night = kveld + helg` — test passes "2026-03-21T22:00:00Z". In Europe/Oslo (UTC+1), 22:00 UTC = 23:00 local. New impl: kveldstillegg = Mon–Fri 21:00–23:59. 2026-03-21 is a SATURDAY. Saturday is NOT a weekday (1–5 check). isEveningTime returns false for Saturday. So only helgetillegg fires, not kveldstillegg. Test expects both. New §4-3 semantics: on Saturday evening you get helgetillegg, NOT kveldstillegg (mutually exclusive per new spec).
- Action detail: Escalating to author. Both fixes require author understanding of intent — test fixture needs baseRate set to a non-zero value to test % supplements meaningfully; Saturday evening overlap needs a policy decision or test correction.
- Duration impact: ~20 min (format fix trivial; test fix needs 5–10 min understanding)
- Recurrence (30d): 1 (first triage run, log empty before this)
- Phase: 0 (log-only, no auto-comment per phase restriction)
- Learnings:
  - [NEW] Phase 2 tariff-utc-fix sortie shipped rewritten impl but did not update test suite to match new semantics. Pattern: impl rewrite without test co-evolution. First occurrence — track.
  - [NEW] helligdagstillegg test failure is a fixture gap: makeContext() sets baseRate: null → 0. Tests asserting percentage supplement amounts must set a non-zero baseRate. First occurrence — note for next occurrence.
  - [NEW] Saturday-evening overlap: new §4-3 semantics mean kveldstillegg is weekday-only. Test `stacks multiple kr/t supplements: Saturday night` must be rewritten to use a weekday evening or the test expectation changed to reflect new policy. First occurrence.
  - [NEW] Knowledge bundle bootstrapped first run — ci-incident-conductor dir created, STATE.md + RUNS.md + log.jsonl initialized.
  - [NEW] log-activity.sh does not accept `ci` as source. Valid sources per script: session, heartbeat, migration, research, ingest, memory, git, user, system. Use `system` for ci-incident-conductor activity entries. ADR-0275 says "Source value: ci" — this is a doc-drift bug between the agent spec and the actual script. Flag for STATE.md.

---

## CI-2026-05-05-001-FIX | 2026-05-05 | compound: format-drift + test-coevolution | auto-fix applied

- Branch: feat/schedule-harness-tariff-utc-fix
- PR: https://github.com/SXTNmedia21/smartout.ai/pull/318
- Run: 25351064063 (failed run); new run triggered by push of commit 341accc60
- Jobs addressed: Format Check (job 74330533140), Vitest packages (job 74330533177)
- Classification (refined from CI-2026-05-05-001 escalate):
  - Failure A: `format-drift` (confidence 1.0) — prettier --write on resolve-tariff-rate.ts. Executed.
  - Failure B: `test-coevolution` (confidence 0.97) — NOT an app-bug. The impl is correct per §4-2 and §4-3. The tests were stale against the old UTC implementation. Both fixed in source (not mocked around).
- Fixes applied:
  1. `helligdagstillegg` test — changed makeContext to pass `baseRate: 100`; updated expected unit to `"kr/t"` (not `"percent"`) per Phase 2 impl semantics.
  2. `stacks multiple` test — rewritten to assert Saturday 22:00Z fires helgetillegg ONLY (kveldstillegg is weekday-gated per §4-3); added second assertion for weekday 22:00Z firing kveldstillegg ONLY.
  3. Prettier applied to resolve-tariff-rate.ts (3 lines reformatted).
- Commit: 341accc60 on feat/schedule-harness-tariff-utc-fix
- Push: 14681a0c7..341accc60 → remote
- Recurrence (30d): 1 (this pattern + CI-2026-05-05-001 = 2 entries; Pattern: tariff-test-coevolution)
- Learnings:
  - [CONFIRMED] Tariff-test-coevolution pattern: Phase 2 impl rewrite without test suite update. Second RUNS entry same pattern. Promote to STATE.md known_patterns.
  - [NEW] test-coevolution is distinct from app-bug: impl is correct, tests are stale. Reclassification needed — first escalate was conservative. In future, read the impl before classifying test failures as app-bug.
  - [CONFIRMED] format-drift is auto-fixable standalone. When combined with test failure on same PR, fixing both together is cleaner than two commits.
