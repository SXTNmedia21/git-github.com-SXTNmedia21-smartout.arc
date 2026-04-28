---
title: "Phase 3 Chair Self-Reversal Pattern"
id: LEARNING_0147
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [council-process, run-council, steward, phase-3, phase-5, synthesis, self-reversal]
---

# Learning-0147: Phase 3 Chair Self-Reversal Pattern

## Context

System Council 2026-04-28 reviewing /dashboard/help design. System-steward (chair) wrote a Phase 3 review concluding REJECT — REDESIGN AS TWO-SURFACE SEPARATION. The redesign positioned helpdesk as belonging exclusively to Komm UI, with /help relegated to governance-content viewer.

In Phase 5 synthesis, the same steward read frontend-designer's panic-first layout and reversed the position. The reversal was specifically on Conflict (c) — "Q9 helpdesk on /help": Phase 3 said REJECT, Phase 5 said APPROVE-as-tier-among-tiers. Justification: frontend-designer's layout proved helpdesk-creation can live as Tier 0 panic bar + Tier 5 footer without conflating /help's identity with helpdesk ownership.

## Discovery

**Phase 3 chair review is provisional. Phase 5 synthesis is final.** This is healthy and should be documented.

Three findings:

1. Chair Phase 3 reviews are written before other agents' Phase 3 reviews are visible. The chair sees the briefing + their own reasoning, not the cross-perspective evidence.
2. Cross-perspective evidence in Phase 3 (other reviewers' findings) can change the chair's mind. Frontend-designer's layout was the new evidence in this case — a concrete UX pattern that solved the steward's "muddles three concerns" objection without abandoning Pontus's intent.
3. The reversal must be EXPLICIT in synthesis. Papering over (silently moving from REJECT to APPROVE without naming the reversal) breaks the chair's auditability. Future councils inspecting the trail must see what changed and why.

## Impact

Update `run-council` SKILL.md Phase 5 guidance:

- Chair MUST classify each Phase 3 position against Phase 5 conclusion as: HELD / REVERSED / REFINED.
- Reversals MUST cite the new evidence (which reviewer, which finding) that caused the reversal.
- Consistency-bias is a failure mode: holding a Phase 3 position out of avoidance-of-reversal produces worse synthesis than acknowledging the reversal openly.
- "Chair self-reversal" should be a rare-but-celebrated pattern, not a hidden one. It signals the synthesis is doing its job.

Also: the steward's Phase 5 self-explanation pattern (quote your own Phase 3, name the conflict, classify the resolution, state what changed your mind) is a reusable structure. Council briefings can reference this learning when synthesis uncovers self-reversal.

## References

- Council 2026-04-28 — System Council on /dashboard/help
- ADR-0219 — /dashboard/help as Multi-Tier Hub (the rescoped successor that triggered the reversal)
- frontend-designer Phase 3 review (panic-first layout)
- system-steward Phase 5 synthesis (explicit reversal acknowledgment)
- run-council SKILL.md Phase 5 (target for guidance update)
