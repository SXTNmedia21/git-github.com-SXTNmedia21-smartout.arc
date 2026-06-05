---
name: sxtn-design-ingest
description: >
  Consume a Claude Design export from the drop folder (.sxtn/design-export/)
  and scaffold it into the project domain structure. Emits feature-index.yaml,
  per-domain design/ folders, and DESIGN-SPEC.md stubs. Clears the drop folder
  after successful ingest.
plugin: sxtn
plugin_version_min: "1.0"
status: active
implementation_phase: F10-P1
---

# /sxtn-design-ingest

On-demand trigger for the design-ingest adapter. Reads the drop folder
`.sxtn/design-export/` and hydrates `docs/domains/` with design artifacts
and a project-level feature index.

## Contract

Per SPEC § F10 Design-Intake.
Idempotency: FULL — running twice with the same input yields identical output
(merge, not clobber). Forbidden writes outside:

- `.sxtn/feature-index.yaml`
- `docs/domains/<domain>/design/`
- `docs/domains/<domain>/DESIGN-SPEC.md`
- `.sxtn/design-export/` (empties after success)

## Drop-folder workflow

```
Claude Design exports a set of files
  ↓
Drop files into: .sxtn/design-export/
  ↓
Run /sxtn-design-ingest (or Claude detects non-empty dir at session start)
  ↓
sxtn-design-ingest.sh processes the export:
  (a) generates Component Index if absent
  (b) writes/merges .sxtn/feature-index.yaml
  (c) scaffolds docs/domains/<domain>/design/ + DESIGN-SPEC.md
  (d) empties .sxtn/design-export/
```

### What goes in the drop folder

Claude Design produces a per-module set of files. Drop the entire export into
`.sxtn/design-export/`. Typical structure:

```
.sxtn/design-export/
  ansatte-directory.jsx     ← React page component for Ansatte module
  ansatte-data.js           ← Data shape / mock data
  ansatte-directory.css     ← Scoped styles
  schedule-view.jsx
  schedule-data.js
  [optional] component-index.yaml   ← Pre-made Component Index (skips auto-generation)
```

File naming convention drives domain derivation:

- First hyphen-segment of filename = domain (`ansatte-directory` → domain `ansatte`)
- Pre-made `component-index.yaml` must have a top-level `entries:` key

## Arguments

| Argument    | Required | Description                           |
| ----------- | -------- | ------------------------------------- |
| _(none)_    | —        | Runs with cwd as project root         |
| `--dry-run` | optional | Print planned writes, make NO changes |

## Usage

```bash
# From the project root:
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-design-ingest.sh <project_root>

# Dry-run:
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-design-ingest.sh <project_root> --dry-run
```

## Output

After a successful ingest:

```
.sxtn/
  feature-index.yaml            ← Project-level Feature Index (merged)
  design-export/                ← Emptied (consumed)

docs/domains/
  ansatte/
    design/
      ansatte-directory.jsx
      ansatte-data.js
      ansatte-directory.css
    DESIGN-SPEC.md              ← Per-domain spec stub
  schedule/
    design/
      schedule-view.jsx
      schedule-data.js
    DESIGN-SPEC.md
```

### feature-index.yaml shape

```yaml
generated_at: "2026-05-30T12:00:00Z"
source: ".sxtn/design-export"
features:
  - feature: "ansatte-directory"
    tier: "default"
    domains:
      - "ansatte"
    modules:
      - "ansatte"
    component_keys:
      - "ansatte-directory-202605301200000000"
```

## Upgrade seam

The adapter is designed to be swapped from file-drop to a push-based mechanism
(e.g. Anthropic design push API) without changing downstream behavior:

| Now (file-drop)                         | Future (push API)                                    |
| --------------------------------------- | ---------------------------------------------------- |
| Drop files in `.sxtn/design-export/`    | API call populates `.sxtn/design-export/`            |
| Run `/sxtn-design-ingest` manually      | Webhook triggers `/sxtn-design-ingest` automatically |
| SessionStart hook detects non-empty dir | N/A (triggered automatically)                        |

The `design.adapter` field in `.sxtn/config.yaml` documents the active adapter
(`file-drop` or `api`). The ingest script is adapter-agnostic — it only cares
about what is in the drop folder.

## Implementation guide for Claude

When Pontus runs `/sxtn-design-ingest`:

### Step 1 — Resolve project root

Walk up from `cwd` until `.sxtn/config.yaml` found. If absent → return
`F_CONFIG_MISSING`.

### Step 2 — Check drop folder

```bash
ls .sxtn/design-export/
```

If empty → print: "Drop folder is empty. Add design files to `.sxtn/design-export/` first."

### Step 3 — Run adapter

```bash
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-design-ingest.sh <project_root>
```

### Step 4 — Report

Print the domain tree written and the path to `feature-index.yaml`.
Warn if any `consistency_gate` findings are non-empty in the Component Index.
