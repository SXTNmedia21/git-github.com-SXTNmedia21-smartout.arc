---
title: "L-0243 — close-feature.sh git add -A is an auditability hole (2nd occurrence)"
id: L-0243
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: dev-process
tags: [close-feature, scope, audit, sortie-5b, sortie-5a]
related: [L-0242, ADR-0213]
---

# L-0243: close-feature.sh `git add -A` is an auditability hole (2nd documented occurrence — promote)

## Trigger

Two same-session occurrences 2026-05-13:

**Occurrence 1 — Sortie 5a close:**
- Close-feature.sh staged `20260608120000_sortie_a2_d6_rls_with_check.sql` (Sortie A.2 D6 RLS hardening migration, NOT in 5a's spec scope).
- Origin of stray file unclear at close-time. Bundled into sub-sortie merge to campaign anyway.

**Occurrence 2 — Sortie 5b mid-flight:**
- Stop-hook caught capability-tool deletion in mid-edit (tools.ts edited but index.ts pending). Agent had ALREADY committed Phase 4 before hook fired — confirming hook is mid-state-snapshot, not pre-commit gate.
- Same hook-noise pattern fired during 5a close — close-feature.sh did NOT use it as gate either.

## Pattern

`close-feature.sh` uses `git add -A` (or equivalent broad-stage) in its merge prep. This sweeps every uncommitted file in working tree — including:
- Stray files from other sorties or worktrees
- Untracked migrations / scaffolds left behind by `new-feature.sh`
- Files modified by hooks (prettier, regen)
- Sortie-out-of-scope artifacts

Result: a sortie's closure commit may include files the sortie's spec/plan never mentioned. Auditability lost — `git log -- <file>` shows file landing in sortie X's merge even though spec X never touched it.

This is the file-system analog of L-0237 (Zod `.catchall(z.unknown())`): silent acceptance of untyped input via broad stage matches silent acceptance of untyped fields via permissive schema.

## Rule

**Promote to follow-up sortie `close-feature-scope-gate`:** 

`close-feature.sh` MUST replace `git add -A` with explicit allowlist derived from plan touched-files:

1. Each plan declares `scope:` glob patterns in frontmatter (e.g. `scope: ["packages/ai/src/capabilities/task/**", "supabase/migrations/20260607*"]`).
2. close-feature.sh greps `git status --porcelain` against allowlist.
3. If any file outside allowlist is modified/untracked: ABORT with "Out-of-scope files in working tree — stash or commit separately before closing."
4. Allowlist may include common docs (`docs/handoffs/**`, `docs/journeys/**`, `docs/decisions/0*.md`) by default.

Until this lands, manually verify `git status --porcelain` before running close-feature.sh.

## Mitigation (interim)

Add CLAUDE.md note under "Feature Closure":

> Before running `close-feature.sh`: `git status --porcelain | grep -v "^[ MARC] docs/"`. If any output, review whether those files belong to this sortie. If not, stash them first.

## Sibling references

- L-0242 (commit-message-template reuse — different vector, same auditability class)
- ADR-0213 (campaign merge-commit pattern — preserves ancestry)
- L-0237 (forgeable identity via permissive schema)
