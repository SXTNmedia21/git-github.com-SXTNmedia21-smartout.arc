---
topic: domain-nomination-achievable-friction
status: active
updated: 2026-06-01T03:20:00Z
created: 2026-06-01T03:20:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — domain-nomination-achievable-friction

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The redesign-wiring campaign ports domains in **achievable-friction order: fewest
blockers / lightest element-count FIRST, heaviest LAST.** The orchestrator nominates the
next domain via the telemetry-driven driver (`completion-rate.sh` measure →
`next-domain.sh` nominate), which scores domains by friction (open blockers in
`control.json`) rather than picking blindly. Rationale: win a whole easy domain
end-to-end first to prove the copy→adapter→telemetry→gate loop, BEFORE the ADR-heavy /
high-element domains. Train the process on small, then scale.

**Canonical sequence (element-count, lightest → heaviest):**
`oversikt` (19) / `min-dag` (21) → … → `vaktplan` (153, LAST). vaktplan is deliberately
deferred to the end because it is the heaviest surface; attempting it early would stall
the loop before the process is proven.

The driver is the nominator of record — do NOT hand-pick a domain out of friction order
unless Pontus overrides for a specific reason. "Achievable friction" = the next domain
with the fewest open blockers AND a light element-count, so the builder gets a fast,
clean win that validates the pipeline.

## Why

Pontus's strategy directive for the campaign: "ta det tyngsta til sist … startar där
ljusen startar … börjar med fronten och bygger oss bakåt … train the process on small
first." Front-first, lightest-first, heaviest (vaktplan, 153 elements) last. Recording
the nomination rule keeps domain sequencing deterministic across sessions and prevents a
future agent from grabbing vaktplan early and stalling. Complements
[[redesign-wiring-lanes-and-copy-law]] (who does what) by fixing _what order_ domains
are dispatched in. The achievable-friction driver lives in
`.sxtn-staging/telemetry-map/` (completion-rate.sh + next-domain.sh, committed
`2ee58615e`).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T03:20:00Z — initial: domains ported in achievable-friction order (fewest blockers / lightest element-count first, vaktplan@153 last); orchestrator nominates via telemetry-driven driver (completion-rate.sh → next-domain.sh), not blind pick; canonical sequence oversikt(19)/min-dag(21) → … → vaktplan(153); rooted in Pontus's "tyngsta til sist / train on small first" directive. Complements [[redesign-wiring-lanes-and-copy-law]].
