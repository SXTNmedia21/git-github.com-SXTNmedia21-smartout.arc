---
title: "ADR-0034: Documentation Enforcement Pipeline"
id: ADR-0034
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0034: Documentation Enforcement Pipeline

## Context and Problem Statement

With 150+ documentation files, manual enforcement of structure, frontmatter, and ADR compliance is unsustainable. ADR log entries can drift from actual files on disk. Plan files may lack required YAML frontmatter. Module specs may miss key sections. These inconsistencies erode trust in the documentation system and cause AI agents to hallucinate or miss context.

## Decision Drivers

- ADR decision log must stay in sync with ADR files on disk
- Plan files require YAML frontmatter for indexing and search
- Module specs benefit from consistent structure
- Enforcement should be automatable in CI and local dev
- Rules have different severities — some are blockers, others are warnings

## Considered Options

1. **CLI validation tool in `packages/docs-pipeline`** — TypeScript, runs locally and in CI
2. **ESLint plugin for markdown** — extend existing lint infrastructure
3. **Pre-commit hook only** — lightweight but limited reporting
4. **External tool (Vale, markdownlint)** — generic, not aware of Smartout conventions

## Decision Outcome

Chosen option: **"Option 1 — CLI validation tool in `packages/docs-pipeline`"**, because it allows custom rules specific to Smartout conventions, integrates with the existing monorepo tooling, and can share code with the ingestion pipeline.

### Validation Rules

| Rule                  | Severity | Description                                                             |
| --------------------- | -------- | ----------------------------------------------------------------------- |
| ADR log consistency   | FAIL     | Every ADR file on disk must be in `0000-decision-log.md` and vice versa |
| ADR required fields   | FAIL     | ADRs must have: Status, Date, Context section, Decision section         |
| Plan frontmatter      | FAIL     | Plan files must have YAML frontmatter with title, status, created       |
| Other doc frontmatter | WARN     | Non-plan docs should have YAML frontmatter                              |
| Cross-references      | WARN     | Module N references should resolve to existing files                    |
| Module structure      | WARN     | Module specs should have overview section                               |

### CLI Interface

```bash
pnpm docs:validate          # Run all rules, exit 1 on FAIL
pnpm docs:validate:strict   # Exit 1 on FAIL or WARN
```

Flags:

- `--strict` — treat WARN as FAIL
- `--rule <name>` — run specific rule group only

## Rules & Consequences

- **Good, because** catches ADR drift before it compounds
- **Good, because** enforces frontmatter needed by the RAG pipeline (ADR-0031)
- **Good, because** runs in <2 seconds for the full corpus
- **Bad, because** adds a new package to maintain
- **Agent Impact:** Run `pnpm docs:validate` after creating or modifying docs. Fix FAIL items immediately. WARN items should be addressed but don't block.
