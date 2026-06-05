---
name: sxtn-component-indexer
description: >
  Scan a folder of frontend code (.jsx/.tsx) and emit a YAML Component Index.
  Invoked by Claude Design after generating per-module pages, or by sxtn on
  existing code before design-intake. Feeds the Feature Index (.sxtn/feature-index.yaml)
  and DESIGN-SPEC. Duplicate component_id values are surfaced as consistency-gate
  findings — they are NEVER silently deduplicated.
# --- sxtn metadata ---
plugin: sxtn
plugin_version_min: "1.3"
gate: none
phase: design-intake
self_revision: true

inputs:
  required:
    - name: source_dir
      type: string
      description: >
        Absolute or relative path to the directory containing .jsx/.tsx files to scan.
        Claude Design output typically: apps/web/pages/ (per-module pages + data files).
  optional:
    - name: output_path
      type: string
      default: null
      description: >
        Path to write the YAML Component Index. If null, emits to stdout.
        Typical target: .sxtn/component-index.yaml or a per-module path.

preconditions:
  - source_dir exists and is a directory
  - source_dir contains at least one .jsx or .tsx file

reads:
  - source_dir/**/*.jsx
  - source_dir/**/*.tsx

writes:
  allowed:
    - output_path (if provided — created or overwritten)
  # NEVER writes to source_dir

validates:
  - emitted index is validated against schemas/component-index.schema.json
    before this skill declares success

returns:
  shape: YAML Component Index (stdout or output_path)
  structure:
    generated_at: ISO-8601 timestamp
    source_dir: scanned path
    entries: list of ComponentEntry sorted ascending by index_key
    consistency_gate: list of ConsistencyFinding (empty = clean)

idempotency:
  on_duplicate: re-run produces a fresh index (timestamps differ); callers
    should overwrite their target path rather than append.

retry_policy:
  max_attempts: 1
  never_retry_on: [F_SOURCE_DIR_MISSING, F_NO_JSX_FILES]
---

# sxtn-component-indexer

Component Index skill. Scans frontend code and emits a structured YAML index
of all interactive components. All scan logic lives in
`bin/sxtn-component-indexer.sh` — this skill documents the contract, invocation
pattern, and downstream integrations.

---

## Purpose

The Component Index is the bridge between Claude Design output (raw .jsx/.tsx
pages) and the sxtn Feature Index (`.sxtn/feature-index.yaml`). It answers:

- What interactive components exist across all modules?
- Which feature and tier does each belong to?
- Are there UX inconsistencies (same action implemented as different components)?

---

## What is extracted

The indexer looks for **relevant** components only — not every React element:

| Category | Patterns matched |
|---|---|
| Exported React components | `export function`, `export const`, `export default function` (capitalized name) |
| Buttons | `<button onClick`, `<Button`, `type="submit"` |
| Forms | `<form onSubmit`, `<Form onSubmit` |
| Inputs | `<input`, `<textarea`, `<select` with `onChange`/`onBlur`/`name` |
| Popups / modals | `<Modal`, `<Dialog`, `<Popup`, `<Drawer`, `<Sheet` |

Skipped: layout components, static text, icons without interaction, utility hooks.

---

## Component ID convention

```
component_id = <element>.<feature>.<action>
```

Examples:
- `button.task.create` — a Create button inside the task feature
- `form.task.submit` — the task submit form
- `modal.task.edit` — the Edit Task popup
- `input.task.title` — the task title input field

Rules:
- All segments lowercase, `[a-z0-9-]` only
- Exactly three dot-separated segments
- `feature` derived from the source filename (kebab-case)
- `action` derived from button text, `aria-label`, `name` prop, or `onSubmit` handler name

---

## Index key convention

```
index_key = <featureList>-<monotonic-timestamp>
```

- `featureList` is derived from the feature name of the entry
- Timestamp is a 14-digit UTC timestamp (`YYYYMMDDHHMMSS`) + 4-digit sequence number
- Sequence ensures uniqueness within a single run (multiple entries in the same second)
- Entries are **sorted ascending** by `index_key` in the emitted YAML
- No two entries ever share the same `index_key` — this is guaranteed by the monotonic counter

---

## Consistency-gate rule

**Duplicate `component_id` = consistency violation.**

The same UX action (e.g. "Create Task button") must be implemented as a
single reused component. If two different files contain a component that
maps to the same `component_id`, the indexer:

1. Keeps **both entries** in the index (does NOT deduplicate)
2. Adds a finding to `consistency_gate`:
   ```yaml
   consistency_gate:
     - component_id: "button.task.create"
       occurrences:
         - "task-20260530120000000"
         - "task-20260530120000001"
       message: "Duplicate component_id — same UX must reuse one component (found 2 occurrences)"
   ```
3. Exits `0` (success) — the index is still valid and usable
4. Callers (Claude Design, sxtn design-intake phase) **must inspect**
   `consistency_gate` and resolve duplicates before promotion

A non-empty `consistency_gate` is a **soft block** — the index is emitted,
but the design-intake phase must file a consistency finding in the DESIGN-SPEC
and require resolution before S6 (build phase).

---

## Invocation

### By Claude Design (primary path)

After generating per-module .jsx/.tsx pages:

```bash
bash "$SXTN_PLUGIN/bin/sxtn-component-indexer.sh" \
    apps/web/pages/ \
    .sxtn/component-index.yaml
```

Then validate the output:

```bash
bash "$SXTN_PLUGIN/bin/sxtn-validate.sh" \
    "$SXTN_PLUGIN/schemas/component-index.schema.json" \
    .sxtn/component-index.yaml
```

### By sxtn on existing code (brownfield)

```bash
bash "$SXTN_PLUGIN/bin/sxtn-component-indexer.sh" \
    apps/web/src/ \
    .sxtn/component-index.yaml
```

### Stdout mode (pipe to yq/jq for inspection)

```bash
bash "$SXTN_PLUGIN/bin/sxtn-component-indexer.sh" apps/web/pages/
```

---

## Downstream integrations

| Consumer | How |
|---|---|
| Feature Index (`.sxtn/feature-index.yaml`) | sxtn design-intake phase reads component-index and builds per-domain feature index entries |
| DESIGN-SPEC | consistency_gate findings are lifted into the spec as required pre-build fixes |
| STATE.yaml (per domain) | component count + consistency status recorded after intake |
| sxtn-tier | component complexity is one signal for tier classification (T2+ when cross-domain components detected) |

---

## Error codes

| Code | Trigger | Action |
|---|---|---|
| `F_SOURCE_DIR_MISSING` | `source_dir` does not exist | Abort, exit 3 |
| `F_NO_JSX_FILES` | No .jsx/.tsx files found | Abort, exit 1 |
| `F_CONSISTENCY_VIOLATION` | `consistency_gate` non-empty | Emit index, exit 0; caller must inspect and file findings |
| `F_TOOL_UNAVAILABLE` | `awk`/`grep`/`sed`/`sort` missing | Abort, exit 2 |

---

## Self-revision

Specializes to its project over time (SKILL-STANDARD §4).
1. **Read** `.sxtn/skills/sxtn-component-indexer/learnings.md` if present; apply project guidance before acting.
2. **Log** at end: `bash "$SXTN_PLUGIN/bin/sxtn-timeline-log.sh" --skill sxtn-component-indexer --feature "$FEATURE" --gate none --outcome <pass|fail> --evidence "<ref>"`.
3. **Capture** on fail or new insight → `sxtn-lesson-capture` into `.sxtn/skills/sxtn-component-indexer/learnings.md`.
