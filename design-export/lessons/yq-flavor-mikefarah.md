---
topic: yq-flavor-mikefarah
status: active
updated: 2026-05-31T10:10:40Z
created: 2026-05-31T10:10:40Z
supersedes:
---

# Decision lesson — yq-flavor-mikefarah

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.

---

## Decision

The suite targets **mikefarah yq** (Go, v4 — `yq e`, `yq '.x'`). CI MUST install the
mikefarah binary, never `pip install yq` (that is kislyuk yq 3.x — a jq wrapper with
incompatible syntax). Both workflows pin:
`wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/v4.44.3/yq_linux_amd64`.
74 yq call-sites depend on this flavor.

## Why

CI's `pip3 install yq` pulled kislyuk yq 3.4.3. Its jq-style syntax rejects the
suite's mikefarah expressions, so council.yaml/config validation silently failed —
all 41 CI failures traced here (test-f5 T39.2/T40.1/T42.1 + regression cascade).
Reproduced locally by putting kislyuk yq first on PATH: F5 → 135/7 (exact CI match);
mikefarah yq → 142/0. Same class as [[ci-workflow-checkout]] and [[plugin-dir-resolution]]:
the local toolchain ≠ CI toolchain unless pinned. "yq" is two different programs —
always pin the flavor, not just the name.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T10:10:40Z — initial: CI pip kislyuk yq 3.4.3 → mikefarah v4.44.3 binary; root cause of 41 CI fails
