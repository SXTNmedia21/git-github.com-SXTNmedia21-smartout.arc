---
topic: frozen-design-source-is-repo-internal
status: active
updated: 2026-05-31T21:06:13Z
created: 2026-05-31T21:06:13Z
supersedes:
metadata:
  type: project
---

# Decision lesson — frozen-design-source-is-repo-internal

> Managed by sxtn-lesson-capture (mode: decision). Decision block = canonical truth.

---

## Decision

The **canonical, frozen Nordic Split design source is repo-internal**: `smartout-re-designe/project/apps/web/` (93 pages, committed, `{DOMAIN}*.jsx` + `shared/{DOMAIN}-data.js` + `shared/styles.css`). The old `/mnt/c/Users/sxtnl/Downloads/Smartout.ai_re-designe/` copy still EXISTS on disk but is **STALE** (77 pages, a subset; styles.css identical). **Never copy from Downloads** — workers must port from the repo-internal frozen ref only. SPEC.md, IMPLEMENTATION-HARNESS.md, and WIRING-RECIPE.md all point to the repo-internal path; the ui-builder project learnings record it too.

## Why

The Downloads path existing-but-stale is a trap: a worker that trusts the old path copies a 77-page subset and silently misses pages. WIRING-RECIPE.md originally pointed at the dead Downloads path (the coordinating instance patched it; the lesson makes it durable). Disk-verified 2026-05-31T21:06:13Z: Downloads = 77, repo-internal = 93, styles.css identical. Relates to [[loop-arms-in-project-not-plugin-source]] and [[implementation-harness-doc]].

---

## History

<!-- appended on each UPDATE, oldest first -->

- 2026-05-31T21:06:13Z — initial: frozen design source is repo-internal smartout-re-designe (93p); Downloads copy is stale (77p), never copy from it.
