---
title: Legacy strike-mcp migration staging — Wrightegaarden Tier 1
status: archived
updated: 2026-04-18
created: 2026-04-18
module: strike-mcp
tags: [migration, historical, wrightegaarden]
---

# Legacy strike-mcp migration staging (Tier 1)

**This directory is frozen historical record.** Do not emit new SQL here.

## What's in this directory

Staged SQL + manifests from the Wrightegaarden Tier 1 migration (April 2026). These files are the emit-time artifacts that back Learning 0033 (migration attestation ≠ apply-readiness) and strike-mcp ADRs 0004, 0005, 0006.

## Why it's committed

Unlike future staging output (which is gitignored per strike-mcp ADR-0007), these files predate the gitignore policy and are retained as:

1. **Historical evidence** for Learning 0033 — the exact SQL that was attested vs what ultimately applied
2. **Reference implementation** — concrete examples of how strike-mcp emits per-entity SQL
3. **Audit trail** for the first production migration

## New canonical output location

Future strike-mcp runs emit to `<repo>/supabase/bubble-data/<workspace-slug>/` (gitignored, except `MANIFEST.json` and `*.report.md`). See strike-mcp ADR-0007.

## Sibling directory

`migration-staging-tier2/` contains the parallel Tier 2 (governance content) output from 2026-04-17 and follows the same frozen-historical-record status.
