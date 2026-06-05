---
topic: plugin-dir-resolution
status: active
updated: 2026-05-31T08:54:59Z
created: 2026-05-31T08:54:59Z
supersedes:
---

# Decision lesson — plugin-dir-resolution

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Every bin/ script (harnesses + helpers) MUST resolve its plugin root with a
script-relative fallback, never a hardcoded $HOME path:
`PLUGIN_DIR="${PLUGIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"`.
The `${PLUGIN_DIR:-...}` env override is kept so test-all / nesting can inject a root.

## Why

The old fallback `PLUGIN_DIR="${PLUGIN_DIR:-$HOME/plugins/sxtn}"` only worked on
Pontus's box, where the checkout happens to live at $HOME/plugins/sxtn. In CI
$HOME=/home/runner and the checkout is /home/runner/work/sxtn-plugin/sxtn-plugin,
so the path did not exist → every plugin-file read failed → 318-failure cascade
across F1–F9 (each harness re-runs lower ones as regression, so one root failure
fans out). Local stayed green, masking it entirely. HEAD commit 9307057 had
already fixed this in sxtn-prompt-validate.sh (comment: "Hardcoded $HOME default
broke CI") but missed the 12 test-*.sh harnesses + 9 helper scripts incl.
sxtn-lifecycle-proof.sh. Scratch/output dirs (TEST_DIR, TARGET) may stay under
$HOME — only source-read roots must self-resolve.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T08:54:59Z — initial: `PLUGIN_DIR=${PLUGIN_DIR:-$HOME/plugins/sxtn}` → `PLUGIN_DIR=${PLUGIN_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}` across 21 bin/ scripts
