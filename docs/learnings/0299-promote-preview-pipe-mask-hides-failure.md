---
title: "promote-preview pipe-mask hides script failure — exit code becomes tee's 0"
id: L-0299
status: captured
layer: learning
created: 2026-05-17
updated: 2026-05-17
adr_refs: [ADR-0265]
sibling_of: [L-ci-pipe-mask, L-0261, L-0298]
---

# L-0299: promote-preview pipe-mask hides script failure

## What happened

Operator (Claude) invoked HOP A via:

```bash
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh 2>&1 | tee /tmp/promote-preview-$(date -u +%Y%m%dT%H%M%SZ).log
```

Background task returned exit 0. Reported "promote complete" to user. Reality:

- Stage 1 Gates 1-4 all green (sync, CI, Vercel READY, FF-possible).
- Local `preview` branch fast-forwarded to `c4b647b88` successfully.
- `git push origin preview` died: `Connection to github.com closed by remote host.`
- `set -e` in global script bailed with non-zero.
- Stage 2 (smoke-probe) and Stage 3 (lkg-tag) never ran — log truncates at push-failure point.
- Wrapper script's exit code was non-zero.
- **`tee` in operator pipeline returned exit 0** (last in pipeline). Without `set -o pipefail`, shell exit = `tee` exit = 0.
- Background task framework + operator both saw exit 0 = "success".

User-visible state mismatch: claimed promote complete, but `git rev-parse origin/preview` still pointed to `edfb47a7f` (564 commits behind dev).

## Why it happened

Pipe-to-tee semantics. In bash without `pipefail`, the exit code of `A | B` is `B`'s exit code, regardless of `A`'s outcome. `tee` only fails on write errors (disk full, permissions) — never propagates the input command's status.

The wrapper script itself has `set -euo pipefail`. The global executor has `set -e`. Both correctly exit non-zero on failure. The pipe-mask was introduced by the **operator-level invocation**, which the deploying skill's documented usage (`op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh`) does not include.

When operator added `| tee log.log` for capture (so the user could see progress in a long-running background command), the pipefail-less bash shell silently swallowed the script's real exit code.

## Pattern

Sibling of L-ci-pipe-mask (authority-seed-parity in CI), L-0261 (`|| true` on `git push` swallows pre-push), L-0298 (mapping-fidelity caught only by code-trace not concept-review). All four are instances of:

**Mechanical execution status (exit code) decouples from semantic execution status (what actually happened) when wrappers consume the signal.**

The fix class:
- Pipe-mask family: `set -o pipefail` before any pipe to capture-tools, OR check post-run state directly.
- `|| true` family: replace with explicit `if ! cmd; then handle; fi`.
- Code-trace family: assign a reviewer the explicit "open the file and read what it does" task.

For deploys specifically: **exit code is never sufficient evidence of success.** Always verify by reading the system's actual state:

```bash
git fetch origin preview --tags --quiet
[ "$(git rev-parse origin/preview)" = "$(git rev-parse origin/development)" ] || echo "preview NOT advanced"
git tag --list 'lkg-preview-*' | tail -1
```

## Fix in place

1. `deploying` skill HOP A section (line 36+) updated with:
   - "If you pipe to a log file, set `-o pipefail` first" block + verbatim pipefail-correct invocation.
   - "Verify after every run" block with 3-command state-check recipe.
2. `deploying` skill new `## HOP A Operational Traps` section (line 714+) — first row encodes pipe-mask trap with symptom + root cause + fix.
3. `local-ci-before-pr` skill `## Related: Pipe-Mask Anti-Pattern (cross-skill)` section near "Bottom Line" — cross-references the deploying skill encoding so the rule applies to any deploy/CI script wrapped in `| tee`.

## Rule going forward

**Any deploy or CI script invocation that uses a pipe (`| tee`, `| grep`, etc.) MUST be preceded by `set -o pipefail` in the same shell, OR followed by an explicit post-run state-check that verifies what the script claimed to do.**

Exit code is a hint, not a verdict. State is the verdict.

## Promotion check

This is the 3rd occurrence in the pipe/exit-code-mask family within 2 weeks (L-ci-pipe-mask 2026-05-09, L-0261 2026-05-14, L-0299 2026-05-17). Threshold met — rule should be promoted to `deploying` SKILL.md hard-rule format with rationalization table. Already partially done in the new HOP A Operational Traps section; full promotion (Common Mistakes table per writing-skills format) pending if 4th occurrence hits.

---

> Register in `docs/learnings/0000-learning-log.md`.
