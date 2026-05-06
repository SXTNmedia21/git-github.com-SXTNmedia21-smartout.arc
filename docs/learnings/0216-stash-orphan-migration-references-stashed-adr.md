---
title: "Stash-orphan migration references stashed ADR/capability — bundle or both stashed"
id: LEARNING_0216
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [learning, migration, stash, sortie-hygiene, adr-0189, authority-seed, wip]
---

# Learning-0216: Migration left on disk while ADR + capability are stashed

## Reference (for grep)

- Orphan: `supabase/migrations/20260525110000_outreach_capability_authority_seed.sql`
- Stash: `stash@{0}: pontus-wip-livekit-sip-adr0282-2026-05-05`
- Stash contents: `apps/web/src/env.ts`, `packages/ai/src/capabilities/registry.ts`, `packages/ai/src/capabilities/types.ts`, `packages/telemetry/src/registry.ts`, `docs/decisions/0000-decision-log.md`
- Cited but missing on dev: `docs/decisions/0282-*.md`, `packages/ai/src/capabilities/outreach/`
- Related: L-0176 (docstring claims ADR before body satisfies), ADR-0189 (authority seed parity gate)

## What happened (wrong-state)

Pontus mid-flight on ADR-0282 outreach capability (LiveKit SIP + Twilio
SMS). Created files in this order during sortie:

1. ADR-0282 draft + decision-log entry
2. Capability registry + types + telemetry routes
3. env.ts secrets
4. **Authority seed migration** (`20260525110000_outreach_capability_authority_seed.sql`)
5. Stashed 1–3 (NOT 4 — untracked file not in `git stash` default scope)

Result: migration sits in working tree as untracked file referencing ADR
+ capability that don't exist on `development` branch — they live in
`stash@{0}` only. `git status` shows it as a normal pending change; no
signal that it is decoupled from its dependencies.

If Pontus runs `npx supabase db reset` now: migration applies (capability
TEXT column accepts any string, no FK to capability registry). Result:
seed row exists for capability that has no tools, no spec, no ADR. Inverse
of L-0066 — closed gate for nothing — unprovable, no test surface.

If Pontus pushes file alone: pre-push typecheck passes (SQL not type-
checked), but ADR-0189 parity-gate CI rejects (capability cited in
authority_config has no matching capability dir).

If Pontus pops stash: migration belongs alongside; works as intended.

## Why git stash misses untracked migration files

`git stash push` (default) stashes only **tracked** changes. Untracked
files stay in working tree. Migration files are typically untracked
(brand-new, never committed) — so they survive a stash that captured
their dependencies. No warning, no flag.

Workaround: `git stash push --include-untracked` (`-u`) or
`git stash push --all` (`-a`). But once a stash exists without `-u`,
later untracked-files become orphans by default.

## Symptoms

- `git status` shows untracked migration referencing ADR-0XXX
- `ls docs/decisions/0XXX-*.md` returns no match
- `ls packages/ai/src/capabilities/<cap>/` returns no match
- `git stash list` shows recent WIP stash with same date / topic keyword
- `git stash show -p stash@{N}` reveals capability registry + decision-log
  edits matching the orphan migration's references

## Resolution (choose one — never silent unilateral delete)

**A. Bundle (recommended if sortie still active):**
```bash
git stash pop stash@{N}        # bring back ADR + capability
git add supabase/migrations/<orphan>.sql packages/ai/src/capabilities/<cap>/ docs/decisions/0XXX-*.md
git commit -m "feat(<cap>): ADR-0XXX + capability + authority seed (parity per ADR-0189)"
```

**B. Re-stash with migration (if sortie pauses):**
```bash
git stash push -u -m "wip-<sortie>-with-migration" \
  supabase/migrations/<orphan>.sql
# Then preserve dependent stash@{N} alongside, or merge stashes via cherry-pick.
```

**C. Discard (if sortie abandoned):**
```bash
git stash drop stash@{N}
rm supabase/migrations/<orphan>.sql
```

**Never:** apply migration alone; push migration alone; delete file
without confirming sortie status.

## Detection

Pre-push check candidate: for every untracked `supabase/migrations/*.sql`,
grep for `ADR-\d{4}` references and verify each ADR file exists on
current branch. Same check for `packages/ai/src/capabilities/<name>/`
references. Fail-fast with hint: "migration references ADR-X / cap Y
not on this branch — check `git stash list`."

Pre-existing related signal: ADR-0189 authority-seed-parity CI gate
catches case at PR time (capability in `engine_authority_config` seed
without matching capability spec). This learning catches it earlier
(working-tree level, before commit).

## Anti-pattern

Never write authority seed migration as standalone artifact with the
ADR/capability arriving "in a follow-up PR." Authority seed parity (ADR-
0189) demands they ship together. Stashing one without the other recreates
the same divergence locally.
