---
title: "Journey: Dev pushes packages/data change → CI Build passes"
status: done
updated: 2026-05-25
created: 2026-05-25
module: build
tags: [ci, packages, turbopack, build-fix]
---

## Journey: Developer — packages/data import fix resolves CI Build failure

**Precondition:** `packages/data/src` contains intra-package imports with `.js` extensions (e.g.
`import { X } from './file.js'`). CI Build job fails on `web#build` because Turbopack's
`moduleResolution=bundler` does not resolve extensioned imports in source-only packages.

1. Developer identifies CI Build red on `development` branch (web#build job, Turbopack compile phase).
2. Developer locates 15 offending imports across 12 source files + 3 test files in `packages/data/src/`.
3. Developer removes `.js` extensions from all intra-package imports, aligning to sibling-package pattern (packages/types, packages/ai, packages/telemetry — all extension-free).
4. Developer commits fix → CI Build runs → Turbopack resolves all imports without error.
5. System shows Build job green; web/oppgaver page renders without 500 error.

**Postcondition:** CI Build job passes; `packages/data` import pattern matches all sibling source-only packages; no runtime regressions in web app.

**Error path:** If CI Build remains red after fix, developer checks which specific import file still uses `.js` extension (search for `from '\./.*\.js'` in `packages/data/src/`), corrects, and re-pushes.
