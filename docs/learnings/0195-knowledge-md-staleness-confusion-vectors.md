---
title: "KNOWLEDGE.md staleness creates confusion vectors during the current run, not months later"
id: L_0195
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0194-agents-drift-on-own-knowledge-bundles.md
  - ./0185-prior-council-staleness-promote-to-preflight.md
---

# L-0195: KNOWLEDGE.md staleness creates confusion vectors during the current run, not months later

## Why

A common mental model treats documentation staleness as a long-term problem: documents drift over weeks and months, and periodic cleanup handles it. The 2026-05-04 P0 doc-rewrite session showed this model is wrong for agent knowledge bundles.

Three stale references were found in a single self-audit of deploy-conductor's KNOWLEDGE.md, all introduced within the previous 24–48 hours:

1. `ADR-0262` cited in KNOWLEDGE.md §11 — superseded by ADR-0265 accepted 2026-05-03 (~18 hours prior). Every PLAYBOOK.md operator instruction that cross-referenced "per ADR-0262" was pointing to a superseded document.
2. F2/F3 labels reversed — introduced during the bootstrap session (2026-05-03), meaning any operator reading "F3 is complete" would interpret the wrong gate as done.
3. §14 (Telegram-tap protocol) missing — ADR-0271 sub-specs added a 12-step sequence that changed what step 12 of HOP B looks like, but KNOWLEDGE.md had no entry for it. A run following the pre-ADR-0271 KNOWLEDGE.md would skip the tap entirely.

The confusion happens NOW. An operator asking "what's left on F2?" during the current session gets the wrong answer. A downstream agent reading KNOWLEDGE.md to plan its next action picks the wrong ADR. The staleness doesn't wait 6 months to cause harm — it fires on the very next read.

This is a stronger claim than L-0185 (prior-council artifacts go stale within 24–72 hours). L-0185 applies to council briefings. L-0195 applies to agent operational knowledge bundles that are read mid-session during active deployment work. The blast radius is higher: a wrong ADR number in a council brief causes a wasted review round; a wrong gate status in KNOWLEDGE.md during a live promote can cause the agent to skip a required check.

## How to apply

The Reflection Protocol for deploy-conductor (and any agent with a KNOWLEDGE.md bundle) MUST include a curation checklist executed within the same session as any of these events:

- New ADR accepted → same-session: update KNOWLEDGE.md §11 (ADR cross-references)
- Status flag changes (F1/F2/F3, Scenario K, gate states) → same-session: update the relevant KNOWLEDGE.md section
- New sub-spec added to a pending ADR → same-session: add §entry for the new behavior

"Defer to next session" is never acceptable for knowledge bundle updates triggered by the current session's events.

Curation rule (added to RUNS.md): after every run, ask "Did any ADR change status this session? Did any gate state change? If yes, update KNOWLEDGE.md before marking this run complete."

For the `deploying` skill: add a trap under "Agent knowledge hygiene" — "KNOWLEDGE.md must be updated same-session, not deferred. Stale facts in KNOWLEDGE.md become confusion vectors on the next tool call."

## Pattern signature

- An ADR changed status within the last 48h
- A knowledge bundle references the pre-change ADR number or pre-change status
- An operator or agent reads the bundle during an active operation (not a passive review)
- The wrong information shapes a live decision (gate check, step sequence, operator advice)

When all four are present: the staleness is active harm, not background debt.

## References

- `.claude/agents/deploy-conductor/RUNS.md` — 2026-05-04 P0 doc-rewrite entry, 3 stale references
- `.claude/agents/deploy-conductor/KNOWLEDGE.md` — fixed in commit `a55eb04e3` (§1, §11, §12, §14)
- `./0194-agents-drift-on-own-knowledge-bundles.md` — L-0194: mechanism of bundle drift
- `./0185-prior-council-staleness-promote-to-preflight.md` — L-0185: sibling pattern (council brief staleness)
