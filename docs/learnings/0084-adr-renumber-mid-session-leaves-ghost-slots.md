---
title: "ADR renumber-mid-session leaves ghost slots unless explicitly documented"
id: LEARNING_0084
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [adr-governance, numbering, council-hygiene, meta]
---

# Learning-0084: ADR renumber-mid-session leaves ghost slots unless explicitly documented

## Context

2026-04-19 kanaler-som-helpdesk council initially numbered its 4 ADRs 0156-0159. Mid-Phase-8 we discovered `feat/overview-v2` had committed ADR-0156 (Day-Control Panel) on a parallel branch. The collision forced a renumber: 0156-0159 → 0160-0163. Cross-references in other files (STATE-SUMMARY, COUNCIL-LOG, individual ADR frontmatter + cross-links) were updated. The decision-log index skipped from 0158 to 0160 with no explanation.

Today's verification council noticed: ADR-0159 has no file, no index row, no comment. A future agent reading `ls docs/decisions/ | tail` sees 0158, 0160, 0161, 0162, 0163, 0164 — 0159 looks like either a numbering bug, a lost file, or an abandoned ADR. The next ADR author reserving "next number" would guess 0159 and collide with the reserved-but-invisible slot.

## Discovery

Mid-session renumbering is a necessary evil when parallel branches collide. The hygiene failure is not the renumber itself but the **invisibility of the skipped slot afterward**. A ghost slot is indistinguishable from:
- A lost file (git issue).
- An abandoned draft (process issue).
- A typo (counting issue).

Without an explicit "RESERVED — do not reuse" marker in the decision log, the next agent either picks the same number (guaranteed collision when the original renumber context is forgotten) or walks around it silently (creates a mystery for future auditors).

This is the 6th collision/renumber event in 2026-04 (see Phase 8 Step 0 note in run-council SKILL.md: 2026-04-13 entity-drawer, 2026-04-15 Tripletex-vs-mobile-RN, 2026-04-16 decision-log ADR-0107 two entries, 2026-04-18 implicit pre-session, 2026-04-19 kanaler-som-helpdesk). The reservation-check step was already added — the **explicit RESERVED row** is the missing follow-up.

## Impact

Three rules:

1. **When a renumber happens mid-council, Phase 8 MUST add explicit `ADR-XXXX RESERVED — do not reuse` rows in the decision log for every skipped slot.** The row cites the council session + target replacement numbers, so the next reader sees the history inline.
2. **Each renumbered ADR file gets a `renumber-note:` line in frontmatter** citing the prior number. Makes diff archaeology possible.
3. **When the RESERVED marker crosses a minor-version boundary (e.g., past 0200)**, promote the rule into SKILL.md: require a section in COUNCIL-LOG.md's session row explicitly naming the skipped slots.

Promote to run-council Phase 8 Step 0:
> After reserving numbers, if the chosen number is NOT the next sequential one (i.e., a number was skipped because it's reserved), add an explicit RESERVED row for each skipped slot citing the council session and the renumbered targets.

## References

- `docs/decisions/0000-decision-log.md` — ADR-0159 RESERVED row added 2026-04-20.
- Origin councils: 2026-04-19 kanaler-som-helpdesk (the renumber), 2026-04-20 verification (caught the ghost).
- Related: Phase 8 Step 0 reservation check in `/home/sxtnl/.claude/skills/run-council/SKILL.md`.
- Pattern history: 5 prior occurrences enumerated in SKILL.md § Phase 8.
