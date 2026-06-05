---
topic: design-source-canonical-location
status: active
updated: 2026-06-01T00:55:00Z
created: 2026-05-31T22:50:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — design-source-canonical-location

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The canonical Nordic-Split redesign source for the redesign-wiring campaign is
**`smartout-re-designe/project/apps/web/`** (repo-internal, committed as a frozen
reference) — NOT the earlier `/mnt/c/Users/sxtnl/Downloads/Smartout.ai_re-designe/`
copy. Every domain sortie copies verbatim from the repo-internal path:
`pages/<domain>*.jsx` + `shared/<domain>-data.js` (mock shape) + `shared/styles.css`
(tokens). It is the Claude Design handoff bundle; `README.md` names
`Smartout Web Version 1.html` as the primary entry, and `component-index.yaml`
(188KB) is the component map.

The repo copy is a **newer superset** of the Downloads copy: 93 jsx pages vs 77,
`vaktplan.jsx` differs (repo is newer, 636 lines), `shared/styles.css` is **identical**
(2268 lines) between the two. When the two disagree, the repo copy wins.

**Cruft rule:** the bundle arrives with ~898 `*:Zone.Identifier` Windows ADS files —
strip them before committing (`find … -name '*Zone.Identifier' -delete`); never commit
ADS cruft as part of the frozen reference.

## Why

The harness doc + SPEC originally pointed at the Downloads path. Downloads is volatile
(it nearly vanished; it is outside the repo, so it cannot be a frozen reference per
SPEC §10 which requires a tag/hash of the design at campaign start). Moving the source
in-repo and committing it makes the design a versioned, frozen string-reference that every
sortie copies from deterministically — the copy-not-rewrite pattern
([[faithful-design-port-copy-not-rewrite]]) requires a stable source on disk. Pontus
placed `smartout-re-designe/` in the repo (2026-05-31) and chose repoint + commit-as-frozen.
Pointers updated in `docs/IMPLEMENTATION-HARNESS.md` (1) + `docs/redesign-wiring/SPEC.md` (2);
the council report `reports/COUNCIL-spec-20260531T140928Z.md` keeps the old path as
historical record (not repointed).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T22:50:00Z — initial: canonical design source moved Downloads → repo-internal `smartout-re-designe/project/apps/web/`; repo is newer superset (93 vs 77 pages, styles.css identical); committed as frozen ref per SPEC §10; strip ~898 Zone.Identifier ADS files before commit (deleted); harness-doc + SPEC pointers repointed.
- 2026-06-01T00:55:00Z — VENDORED FROZEN SOURCE MUST BE EXCLUDED FROM LINT/FORMAT GATES. Prototype is React-via-Babel IIFE jsx (`window.SO_PAGES`), NOT ES modules — prettier/eslint can't parse it; a mass `git add -A` commit dies in husky lint-staged on `smartout-re-designe/*.jsx`. Fix: add `smartout-re-designe/` to `.prettierignore` (+ eslint ignores). It is a COPY SOURCE to read, never a build target. This is exactly why the F0.1 registry committed cleanly ALONE (`packages/telemetry/src/registry.ts` is real ES) while the design source blocked the mass commit. Commit recovered work in lint-clean slices; isolate the un-lintable frozen ref behind ignores first.
