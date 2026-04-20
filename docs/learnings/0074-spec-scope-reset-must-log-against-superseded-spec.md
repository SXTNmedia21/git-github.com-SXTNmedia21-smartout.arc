---
title: "Spec scope-reset must log against the superseded spec"
id: LEARNING_0074
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [council, spec-discipline, audit-chain, governance]
---

# Learning-0074: Spec scope-reset must log against the superseded spec

## Context

Year Wheel Redesign Council (2026-04-20). The new spec silently dropped P1 features previously committed to in `2026-04-19-year-wheel-holistic-design.md`: activation-gate card, "hva mangler" checklist, Activate/Archive/Duplicate buttons, Seeded-from-Riksavtalen provenance chip, Goals tab, Procedures tab. The Steward Phase 3 review caught the drift: future councils reading the design corpus would still see the 2026-04-19 verdict as active.

## Discovery

When a later spec reduces or re-scopes work from an earlier spec, silent dropping breaks the **audit chain** between councils:

1. A reader starting from the earlier spec has no signal it's superseded.
2. A reader starting from the later spec has no context for why certain features are "P2" with no trace of prior commitment.
3. Future councils may re-litigate scope already decided, or pick up the dropped items as new work without the prior reasoning.

This is not a scope problem (re-scoping is fine and normal). It's a **discoverability problem**: the reason and the pointer from old → new must exist.

## Impact

### Rule

When a spec/ADR/plan reduces or re-scopes work committed to by a prior artifact:

1. **Cite the superseded artifact by filename** in the new spec's "out of scope" or "scope reset" section, with a one-line reason per dropped item.
2. **Append an entry** to `docs/council/COUNCIL-LOG.md` in the new council's row noting "reverses or defers prior council <date>".
3. **Update the superseded artifact** — at minimum, add a header note: "Some P1 features deferred; see `<new-spec-path>` 2026-MM-DD." Ideally mark status `superseded` if the entire artifact is replaced.
4. **Do not** silently let the old artifact remain "active" in the doc index.

### How to apply

- Phase 8 of the council skill should verify this when a new spec/ADR is approved: does it drop work from an earlier one? If yes, does §(scope reset) exist?
- Before approving a spec in Phase 6, check whether earlier specs in the same module reserved features that are absent from the new spec. If yes, ask the user whether this is an intentional scope reset.

### Examples

- 2026-04-20 Year Wheel Redesign §11.5: explicitly lists five features from 2026-04-19 holistic spec that are deferred, with reasoning.
- Council log 2026-04-20 row: notes "defers P1 targets from 2026-04-19 holistic-design".

### Why promoted

Two council instances have now surfaced the pattern (2026-04-19 Kanaler Help Desk also reset 2026-04-13 governance scope without formal logging, caught in retrospect). Promoted explicitly so future work in this project inherits the discipline.

## References

- Spec: `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` §11.5
- Superseded: `docs/superpowers/specs/2026-04-19-year-wheel-holistic-design.md`
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-20 session
- Related: Council skill Phase 8 knowledge capture
