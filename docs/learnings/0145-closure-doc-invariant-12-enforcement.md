---
title: "Closure-Doc Invariant 12 Enforcement"
id: LEARNING_0145
status: canonical
layer: learning
created: 2026-04-27
updated: 2026-04-27
tags: [invariant-12, closure, handoff, campaign, falsifiability, adr-0196, journey-engine]
---

# Learning-0145: Closure-Doc Invariant 12 Enforcement

## Context

Campaign `journey-engine` authored ADR-0196 Invariant 12 (falsifiable campaign status claims) and registered it as a merge gate in `scripts/close-feature-journey-guardian.sh`. The same campaign's closure documents — `docs/HANDOFF-publish-mission-body.md` and `docs/plans/CAMPAIGN-journey-engine.md` — shipped with at least 4+ stale or unfalsifiable claims:

- Lines 96, 101: milestone completion rows marked `[x]` without `verify:` blocks.
- Line 309, 341: ADR status references marked `proposed` in the doc while the ADR file frontmatter read `accepted`.
- 5 additional status-drift sites in ADR-0215-adjacent sections.

Council Phase 8 (2026-04-27) caught these claims in the post-closure council review (Concerns 2 and 6 in the Phase 5 synthesis).

## Discovery

Invariant 12 was enforced on CAPABILITY CODE (checked by `close-feature-journey-guardian.sh`) but not on the CLOSURE DOCUMENTS the campaign authored. This is a structural hypocrisy: the rule applied to the artefact produced for users but not to the artefact produced for agents. Future agents read closure documents as source of truth — stale claims in a HANDOFF or CAMPAIGN-doc propagate as architectural fiction into the next campaign's context.

The failure mode is subtle: the invariant's grep gate runs inside the campaign boundary (capability code) but closure docs are written AT closure, after the gate has already passed for the sub-sortie's code deliverables.

## Falsifiable Self-Audit Rule

Every campaign closure MUST run a self-audit grep BEFORE opening the merge PR to `development`:

```bash
# Check 1 — ADR status drift: proposed in doc but accepted in file (or vice versa)
grep -n "ADR-[0-9]\+.*proposed" docs/HANDOFF-*.md docs/plans/CAMPAIGN-*.md

# For each match, cross-reference the ADR file's frontmatter:
# grep "^status:" docs/decisions/<N>-*.md

# Check 2 — Unfalsifiable completion claims
grep -n "✅\|complete\|green\|closed\|\[x\]" docs/HANDOFF-*.md docs/plans/CAMPAIGN-*.md
# Every match must either cite a specific grep / SQL / test that returns pass/fail
# OR be removed / qualified.
```

Both checks must return zero unfalsifiable results before merge.

## Recommendation

Extend `scripts/close-feature-journey-guardian.sh` (or an equivalent campaign-level close script) with a closure-doc Invariant 12 grep gate as a hard block — not a warning. The gate is mechanical and takes < 5 seconds.

Proposed gate logic:
1. For each `[x]` or `✅` in HANDOFF + CAMPAIGN doc, assert the line contains a `verify:` annotation referencing a grep/SQL/test.
2. For each `proposed` ADR reference in HANDOFF + CAMPAIGN doc, assert the ADR file's `status:` frontmatter field matches.

## Impact

- Prevents stale closure docs from becoming architectural fiction in future campaign boots.
- Symmetric to Invariant 12's code-side gate — same falsifiability standard applied to docs as to code claims.
- Adds < 5 seconds to the closure checklist and removes a council-time bottleneck.

## Promotion Candidate

If this pattern recurs in the next campaign closure (any campaign writing an Invariant 12 claim into a doc without a verify block), promote to a new ADR extending ADR-0196 with closure-doc scope.

## References

- ADR-0196 (Journey Engine Invariants 11/12/13) — Invariant 12 as currently defined (code-scoped).
- Council Phase 8 synthesis, 2026-04-27 — Concerns 2 and 6 (stale closure doc claims).
- L-0124 (phantom-body vs phantom-emit, 2026-04-23) — related closure-time honesty gap.
- L-0144 (M5 retraction pattern, 2026-04-27) — the context that surfaced these stale claims.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
