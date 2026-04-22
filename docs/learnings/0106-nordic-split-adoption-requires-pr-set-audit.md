---
title: "Nordic Split token adoption requires PR-set audit, not just current-file"
id: LEARNING_0106
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [design-tokens, nordic-split, phase-2-5, contracts, design-debt, audit-scope]
---

# Learning-0106: Nordic Split token adoption requires PR-set audit, not just current-file

## Context

Council Gate 2 Nordic Split violation audit (contract-hub-redesign, 2026-04-22) found a design-token leak across the PR set.

Timeline:

1. **Phase 3 commit `3a071566`** — Phase 3 build agent introduced warning-state styling in three drawer components using hardcoded Tailwind amber classes: `amber-500/30`, `bg-amber-500/5`, `text-amber-600`.
   - `CompositionDrawer.tsx:968`
   - `BulkSendDrawer.tsx:366,399`
   - `SelectEmployeeStep.tsx:274`
2. **Between Phase 3 and Phase 4** — the `--warning` token landed in `packages/design-tokens/src/tokens.css` (lines 58, 175; hue 75 warm OKLCH).
3. **Phase 4 build agent** — correctly adopted the `--warning` token in `DriftDiffDrawer.tsx` (Phase 4's scope).
4. **Phase 4 did NOT back-clean Phase 3's three files.** Each phase audited Nordic Split compliance ONLY against its own file set. The Phase 3 amber-class debt was invisible to Phase 4 because Phase 4's audit scope was "files I'm touching in Phase 4."

Gate 2 caught the leak by grepping `apps/web/src/app/dashboard/contracts/` for all hardcoded color patterns across commits since the last gate. Three violations surfaced, all introduced in a phase that shipped before the token became available.

## Discovery

When a new design token lands mid-PR — or when Nordic Split compliance is enforced on a PR set — the audit scope must be the **entire PR set**, not just the current phase's files.

Three compounding problems when audit is scoped per-phase-only:

1. **Token availability asymmetry.** Phase 3 could not use a token that didn't exist yet. Phase 3's hardcoded classes were "correct" at commit-time but become debt the moment the token lands.
2. **No retroactive sweep.** Phase 4's "adopt the new token" brief does not explicitly include "back-clean the PR's earlier commits that used hardcoded alternatives." Unless the briefing says so, it doesn't happen.
3. **Debt compounds.** Leaving three files with hardcoded amber means the next PR that touches any of them must now also clean them up (double-work), or the debt becomes permanent (violation of Nordic Split mandatory-rule).

**Rule: design-token audits run against every file modified since the last gate, not just files touched in the current phase.**

**Per-file audit (current default) vs PR-set audit (correct):**

| Audit scope | Catches | Misses |
|---|---|---|
| Current-phase files only | Violations introduced in this phase | Violations introduced in earlier phases that the new token would now cover |
| **Full PR set since last gate** | All violations the token could now replace, regardless of which phase introduced them | — |

## Impact

**Build agent briefing template — add a "PR-Set Design Token Sweep" section:**

```
## PR-Set Design Token Sweep
When this phase adopts a design token (e.g. --warning, --success, --info):
1. Grep for hardcoded fallback patterns across ALL new + modified files in this PR set, not just files you're touching directly.
2. Patterns to grep: amber-*, red-*, green-*, blue-*, emerald-*, yellow-*, orange-*, any Tailwind color scale.
3. If the token could replace any hardcoded class in any earlier-phase file — replace it in this phase's commit.
4. Cite the grep command and match count in the phase handoff.
```

**Phase 2.5 fact-check — Nordic Split sweep across gate window:**

Before approving any gate, run:

```bash
git diff --name-only <last-gate-sha>..HEAD -- 'apps/web/**/*.tsx' 'apps/web/**/*.css' 'apps/mobile/**/*.tsx' \
  | xargs grep -nE '(amber|red|green|blue|emerald|yellow|orange|zinc|gray|slate)-[0-9]+' 2>/dev/null \
  | grep -v '^[^:]*:[^:]*://'
```

Any hits are violations — regardless of which phase-commit introduced them. Ship-gate fails if hits exist and a matching token is available.

**Council chair discipline:**

When verdict schedules a new design token for a later phase, the verdict must include: "When token X lands, the adopting phase MUST back-clean every earlier-phase file in this PR set that used hardcoded alternatives to X." Without this clause, adoption happens but retroactive cleanup doesn't.

**Generalizes to other design-system work:**

- New shared component replaces inline pattern → sweep PR set for the inline pattern, not just current-phase files.
- New utility hook replaces ad-hoc logic → sweep PR set for the ad-hoc pattern.
- New type alias replaces string literal → sweep PR set for the string literal.

## References

- `packages/design-tokens/src/tokens.css:58,175` — `--warning` token (hue 75 warm OKLCH).
- `apps/web/src/app/dashboard/contracts/_components/CompositionDrawer.tsx:968` — Phase 3 amber hardcode (Gate 2 finding).
- `apps/web/src/app/dashboard/contracts/_components/BulkSendDrawer.tsx:366,399` — Phase 3 amber hardcode (Gate 2 finding).
- `apps/web/src/app/dashboard/contracts/_components/SelectEmployeeStep.tsx:274` — Phase 3 amber hardcode (Gate 2 finding).
- `apps/web/src/app/dashboard/contracts/_components/DriftDiffDrawer.tsx` — Phase 4 correct `--warning` adoption.
- L-0094 — phantom emit contracts recurring (same lineage: audit scope must match the scope where debt can accumulate).
- Nordic Split SKILL.md — mandatory-rule on no hardcoded zinc/amber/red classes.
- Council Gate 2 (2026-04-22) — contract-hub-redesign, design-token violation audit.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
