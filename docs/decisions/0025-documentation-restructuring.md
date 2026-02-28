# ADR-0025: Documentation Restructuring — Layered System with YAML Frontmatter

**Status:** Accepted
**Date:** 2026-02-28

## Context and Problem Statement

121 documentation files (46,817 lines) across docs/ had no standard format, no machine-readable metadata, and significant content duplication. Agents could not efficiently discover which documents were relevant to their current task without reading entire files. Stale files mixed with canonical ones caused confusion.

## Decision Drivers

- Agents waste context window reading irrelevant docs
- No way to filter docs by status (canonical vs draft vs archived)
- Duplicate content across files leads to contradictory information
- No single navigation map for the full documentation set
- Reference data (tables, routes, packages, env vars) scattered across CLAUDE.md and architecture docs

## Considered Options

1. Add YAML frontmatter to all docs + create reference layer + archive stale files
2. Consolidate everything back into fewer large files
3. Keep status quo with better naming conventions

## Decision Outcome

Chosen option: "Option 1 — YAML frontmatter + reference layer + archive", because it enables agent-discoverable documentation while preserving the modular structure that works well for per-task loading.

### What was implemented

**YAML frontmatter standard:** Every .md file in docs/ (except CLAUDE.md and INDEX.md) gets frontmatter with: title, id (stable, never changes), version, status (canonical/draft/superseded/archived), layer, depends_on (by id), tags, tables, changelog.

**Five-layer information model:**

- L0: CLAUDE.md (always loaded)
- L1: docs/reference/ (quick lookup during coding)
- L2: docs/modules/ (business logic per task)
- L3: docs/architecture/ (system design)
- L4: docs/archive/ (historical, never loaded)

**New files created:**

- `docs/INDEX.md` — master navigation map with all document IDs
- `docs/reference/DATABASE.md` — all 47 tables, 30 enums, RLS patterns
- `docs/reference/ROUTES.md` — all routes verified against actual directories
- `docs/reference/PACKAGES.md` — all package exports and dependencies
- `docs/reference/ENV_VARS.md` — all environment variables with validation rules

**Archived (docs/archive/):**

- SMARTOUT_V1_REVISED_ARCHITECTURE.md (superseded by CORE_ARCH_V2)
- SMARTOUT_REBUILD_STRATEGY.md (absorbed into CLAUDE.md)
- smartout-full-index-v2.md (replaced by docs/INDEX.md)

**Nextra scaffold:** `apps/docs/` created for public documentation site (docs.smartout.ai).

**CLAUDE.md trimmed:** Removed Key Enums section (→ DATABASE.md) and Module Documentation table (→ INDEX.md). Added Source of Truth hierarchy and trigger lines.

## Rules & Consequences enforced for Agents

- **Good, because** agents can read YAML frontmatter + Summary to decide relevance without loading full files
- **Good, because** `docs/INDEX.md` provides a single lookup for any document by ID
- **Good, because** reference files consolidate frequently-needed facts into dedicated lookup docs
- **Bad, because** every new doc requires YAML frontmatter (minor overhead)
- **Agent Impact:** Before loading a doc, check its `status` field — never load `archived` or `superseded` docs. Use `depends_on` to load prerequisite docs. Use `docs/INDEX.md` to find docs by topic.
