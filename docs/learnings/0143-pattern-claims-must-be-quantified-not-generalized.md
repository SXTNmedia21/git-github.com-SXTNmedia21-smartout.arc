---
title: "Pattern claims should be quantified, not generalized"
id: LEARNING_0143
status: canonical
layer: learning
created: 2026-04-27
updated: 2026-04-27
tags: [council, fact-check, briefing, phase-2-5, audit-inflation]
---

# Learning-0143: Pattern claims should be quantified, not generalized

## Context

Council 2026-04-27 (campaign-PR merge strategy). Phase 3 Steward review claimed: "all recent campaign PRs squash-merged" and listed 8+ examples. Phase 2.5 fact-check sampled three PRs (#234, #261, #259) and found PR #259 (year-wheel M5 cleanup) was actually merge-commit — 2 parents. The "all" was wrong; "dominant but not universal" was right.

The verdict was unaffected (Option A still wins under either framing), but the briefing's severity calibration would have been miscalibrated had the falsification not been caught.

## Discovery

When Phase 3 reviewers make "pattern is everywhere" / "all instances" / "always" / "universally" claims based on 2-3 sampled examples, they often inflate to "all" without enumeration. The Phase 2.5 fact-check protocol verifies cited claims but doesn't actively search for counter-examples.

This is the same class as **L-0050 audit-inflation pattern** — grep-counts inflate scope without code-trace verification — but operating at the briefing layer rather than the audit layer.

Two prior councils' verdicts have flipped on quantification gaps:

- **Council 2026-04-16 web-perf**: "every Server Action lacks gate_action" claim was 80% accurate; the missing 20% changed sprint scope by 2 weeks
- **Council 2026-04-18 gate-migration**: "all 18 sites need gate retrofitting" was actually 11 sites; 7 already had compliant patterns

This council's catch (PR #259 was already merge-commit) means a precedent already existed for the new policy. That changes the ADR's framing from "introducing a new convention" to "codifying an existing partial practice" — a smaller justification burden.

## Impact

### Phase 2.5 fact-check protocol (added)

For every "all / always / everywhere / universally / never" quantifier in a briefing claim:

1. **Enumerate the population.** What's the full set being claimed about? (e.g., "all recent campaign-PRs" → enumerate via `gh pr list --state merged --base development --limit 30 | grep "^.*campaign/"`)
2. **Search for one counter-example.** Pick 1-2 instances NOT cited in the briefing and verify the claimed property holds. (e.g., for merge-method: `gh pr view <num> --json mergeCommit --jq '.mergeCommit.oid' | xargs git cat-file -p | grep -c "^parent "` — squash = 1, merge-commit = 2)
3. **Replace generalizations with quantifications.** Output: "X of Y instances exhibit this property" with concrete numbers, not "all" or "everywhere."

### Briefing template addendum

Phase 2 briefing now includes a "Quantifier Audit" subsection. Any claim using `all / always / everywhere / universally / never` must either:
- Enumerate the full population in-line, OR
- Be re-phrased as `dominant / typical / commonly / occasionally / rarely / sometimes` with a concrete count

If a claim cannot be quantified, it cannot use absolute quantifiers.

### Promotion candidate

Not yet promoted to `run-council` SKILL.md as a hard rule. **First occurrence; promote on 3rd.**

Prior occurrences of related patterns (audit-inflation):
- L-0050 (audit inflation, grep-counts inflate scope without code-trace)
- L-0117 (5x grep-based structural claims promoted to hard rule 2026-04-22)

This learning extends those to briefing-level quantifier claims. If 3rd occurrence happens, promote with reference to L-0050 + L-0117 + this.

## References

- ADR-0213 — Campaign-PRs use merge-commit, not squash (the council that surfaced this)
- L-0050 — Audit inflation pattern (grep-counts at audit layer)
- L-0117 — Grep-based structural claims must be code-traced (5x → promoted)
- L-0142 — Squash-merge erodes ADR falsifiability (paired learning this council)
- Council 2026-04-27

---

> Registered in `docs/learnings/0000-learning-log.md`.
