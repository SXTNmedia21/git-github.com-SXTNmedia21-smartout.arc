---
title: "ASCII-only filenames — use `paragraf` not `§`"
id: L-0255
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: tooling
tags: [filenames, unicode, tooling, conventions, gdpr]
---

# L-0255: ASCII-only filenames — use `paragraf` not `§`

## The Trap

3 files shipped 2026-05-14 with literal U+00A7 (§) in their path:
- `supabase/migrations/20260615100000_gdpr_§13_retention_fix.sql`
- `docs/decisions/0310-§14-6-rule-table-driven-aml-validation.md`
- `docs/decisions/0312-gdpr-§13-retention-clock-regnskapsårets-slutt.md`

Norwegian legal sections (Aml. §13, Aml. §14-6 etc.) tempt the use of `§` as a semantic marker. Supabase CLI and Git accept Unicode in paths. Downstream tooling does not always:
- Naive ASCII glob (`find ... -name "*.sql"` works; `find ... -name "*§*"` fails in some locales)
- `gh` API edge cases on path encoding
- Shell completion in non-UTF-8 terminals
- Naive scripts that pass paths through ASCII-only string handling

## The Rule

Filenames under `supabase/migrations/`, `docs/decisions/`, `docs/learnings/`, `docs/journeys/`, `docs/protocols/` MUST be ASCII-only. Use:
- `paragraf` instead of `§`
- `o` instead of `ø`
- `a` instead of `å`
- `ae` instead of `æ`

Document titles, frontmatter, and body content may use Norwegian Unicode freely (`§`, `ø`, `å`, `æ`). The constraint applies ONLY to filenames.

## Why The Constraint Exists Only For Filenames

File content goes through UTF-8-aware tools (editors, git diff, web rendering). File NAMES go through shell glob, find/grep iteration, CI script substitution, GitHub URL encoding — many of which silently break on Unicode. The asymmetry is the lesson.

## Remediation

Tracked as Linear issue SMA-369 (post-promote ticket D8 from 2026-05-14 council). Three files to rename forward-only:
- Migration: emit new no-op migration that records the rename in comment; original timestamp keeps applied-row alignment with Cloud
- ADRs: `git mv` to ASCII-safe slug; update cross-references in decision-log, COUNCIL-LOG, all linking files

## How to Apply

Add to `smartout-database-guide` skill under "Critical Traps":
> Filenames MUST be ASCII-only. Norwegian legal section `§` becomes `paragraf` in path; full Norwegian chars allowed in file body.

Add to pre-commit hook (deferred to L-0203 implementation): grep new files for non-ASCII characters in path, fail with helpful message.

## Cross-references

- SMA-369 (rename sortie)
- ADR-0323 Pre-Promote-Preview Council Protocol (parent council)
- `smartout-database-guide` skill
