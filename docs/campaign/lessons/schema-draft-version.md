---
topic: schema-draft-version
status: active
updated: 2026-05-31T00:00:00Z
created: 2026-05-31T00:00:00Z
supersedes: draft-07
---

# Decision lesson — schema-draft-version

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

All JSON schemas in `schemas/` MUST declare `"$schema": "https://json-schema.org/draft/2020-12/schema"`.
Never `http://json-schema.org/draft-07/schema#`. The project validator is **ajv-cli**
(`bin/sxtn-validate.sh`), configured for 2020-12; a `draft-07` + `http://` meta-schema
ref is unresolvable offline and makes validation fail with
`no schema with key or ref "http://json-schema.org/draft-07/schema#"` — silently
breaking any gate that validates (e.g. harness-build-checklist step 6).
`definitions` + `#/definitions/...` `$ref` resolve fine under 2020-12 in ajv, so no
body restructure is needed — flip the `$schema` line only. Allow `_`-prefixed
annotation keys via `"patternProperties": { "^_": {} }` (project uses `_comment`/`_seed_note`).

## Why

The harness-builder bundle (dropped 2026-05-31 in `.sxtn/runbook/`) shipped its schemas
on draft-07 while every native plugin schema (`state`, `config`, …) uses 2020-12. Mixing
drafts breaks ajv, which fails closed → every validating gate silently fails. Caught on
`trigger-registry.schema.json` (fixed), then the identical drift on
`worklist.schema.json` — recurring, so it belongs in one canonical place. Related:
[[harness-agent-loop-ownership]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T00:00:00Z — initial: fixed trigger-registry.schema.json draft-07→2020-12 + added `^_` patternProperties; spotted same drift on worklist.schema.json (fix pending its promotion)
