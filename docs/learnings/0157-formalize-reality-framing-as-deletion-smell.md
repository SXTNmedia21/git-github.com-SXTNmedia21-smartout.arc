---
title: "'Formalize reality' framing as deletion-plan smell"
id: LEARNING_0157
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [council, framing-failure, deletion-smell, chair-failure-mode]
---

# Learning-0157: 'Formalize reality' framing as deletion-plan smell

## Context

ADR-0216 council 2026-04-28 — chair voted Option A2 with reasoning: "engine_state has zero stage-engine readers, so it's already phantom — Option A formalizes reality." Phase 5 reversal traced the failure to the framing itself, not the data.

The framing pattern: "X is already gone / unused / phantom. Removing it just makes the docs match." This produces a comfort signal that bypasses normal blast-radius scrutiny because the deletion sounds non-disruptive.

In ADR-0216, three chair Phase 3 reasoning fragments matched this pattern:
- "engine_state has zero stage-engine readers, so it's already phantom"
- "Option A formalizes reality"
- "atomic Journey Guardian grep update is sufficient migration tooling"

All three were false in the broader scope (139 sites, 8 cascade domains, Event Engine universal runtime). The framing made the falsehood feel obvious-true.

## Discovery

When a deletion plan is presented as "formalize reality" / "remove what's already gone" / "make docs match code" / "kill the phantom" — the chair's response should be **deeper scrutiny**, not less. The framing inverts proof-burden: it presents the change as recording an existing truth rather than making a new claim, which lets the change skip the "prove it's safe" step.

Recurring failure mode for chair-class roles:
1. Briefing says X is phantom/unused/already-gone
2. Chair feels reassured (no real change needed)
3. Chair doesn't run full-codebase blast-radius check
4. Vote hits Phase 5 reversal when reviewers find broader consumers

This is the inverse of normal scope-creep concern. Normal failure: chair underweights the breadth of a claimed-additive change. Deletion failure: chair underweights the breadth of a claimed-subtractive change.

## Impact

**Chair pre-vote checklist for deletion plans:**

When briefing language contains any of: `phantom`, `already gone`, `formalize reality`, `make docs match`, `remove what's unused`, `kill the dead`, `clean up the orphan` — chair MUST:

1. Suspend the framing. Re-read the plan as if presented neutrally: "this proposes deleting schema element X."
2. Demand explicit blast-radius scope statement in Phase 3 vote: "I grepped <X> across apps/ + packages/ + services/ + supabase/, found N sites breakdown by domain: ..."
3. If site count > 5 OR domain spread > 2, treat as architectural-class change. NO single chair vote — require Phase 5 architecture review even if Phase 3 looks unanimous.
4. Verify against CLAUDE.md "Cascade Core Model" + "Source of Truth" hierarchy. If schema element appears in CLAUDE.md as canonical infrastructure, deletion needs ADR-class amendment of CLAUDE.md.

**Briefing-author rule:** Avoid `phantom` / `already gone` / `formalize reality` framings. Use neutral framings: "this plan deletes X." "X has these N consumers across M domains." "Migration must address each."

**Council reviewer guidance:** When reviewing a deletion plan, the FIRST question is "what reads this?" not "is this deletion safe?" The latter assumes the answer; the former requires evidence.

## Pattern history

This is the 1st explicit naming. Watch for 2nd. 3rd occurrence promotes to run-council SKILL.md hard rule (per L-0147 promotion protocol).

Related precedent:
- 2026-04-19 helpdesk console: "channel_event is dead infrastructure" framing — proved to have intentional design with first consumer waiting on prerequisites (B3 trap)
- 2026-04-28 doc consolidation: "RESCUE-PROMPT.md replaces stale guardian_signal flow" — proved to be parallel system to live 2026-04-06 path (L-0153 dual-rescue trap)

These three (L-0153, B3 helpdesk, ADR-0216 Option A) form a class: **proposed deletion/replacement against existing live infrastructure that the proposer didn't see**. L-0157 is the explicit pattern naming.

## References

- ADR-0216 (engine_state vs engine_sessions ontology — Option A rejected, Option B accepted)
- L-0155 (schema-deletion plans require full-codebase grep)
- L-0147 (chair self-reversal pattern, 3rd occurrence promoted)
- L-0153 (dual-rescue-system trap)
- B3 helpdesk-channel pattern (kanaler-som-helpdesk council 2026-04-19)
- Council 2026-04-28 ADR-0216 Phase 5 self-reversal

---
