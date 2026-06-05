---
topic: test-suite-regression-nesting
status: active
updated: 2026-05-31T08:55:16Z
created: 2026-05-31T08:55:16Z
supersedes:
---

# Decision lesson — test-suite-regression-nesting

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.

---

## Decision

The Fn harnesses each re-run all lower harnesses as nested "regression"
subprocesses, so the full suite cost is super-linear. Standalone timings under
real execution: F7 ≈ 150s, F8 ≈ 295s, others smaller; full test-all.sh ≈ 10–13 min.
CI workflow .github/workflows/test.yml sets `timeout-minutes: 15` — only ~2 min of
headroom. If the suite grows, bump timeout-minutes (cheap) OR add an env flag
(e.g. SXTN_SKIP_REGRESSION=1) so harnesses skip nested regression when test-all
already runs every harness once.

## Why

Original CI "completed in 20s" was an illusion: the $HOME path bug (see
[[plugin-dir-resolution]]) made every harness fast-fail on missing files, so
nothing actually executed. Once paths resolve correctly the harnesses do real
work AND nest exponentially, exposing the true runtime. This is a latent
timeout risk that only appears after the path fix lands.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T08:55:16Z — initial: documented nesting cost (F8≈295s, suite≈10–13min) vs CI timeout-minutes:15
