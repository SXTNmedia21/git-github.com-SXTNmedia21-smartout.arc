---
id: L-0131
title: "Trust Gate blocks greenfield on broken precedent"
status: accepted
date: 2026-04-23
type: process
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0200, ADR-0201]
related_learnings: [L-0066, L-0097, L-0115, L-0116]
module: council
tags: [trust-gate, council, chair, greenfield, precedent, authority, hospitality]
---

# L-0131 — Trust Gate blocks greenfield on broken precedent

## Context

Hospitality gap analysis council (2026-04-23) reviewed two related pieces of work:

1. **Remediation** of the existing-but-broken `shift_swap` capability — which ships without a `gate_action` call (ADR-0201 surface), with a phantom-typo registry entry (L-0129), and with voice allowed despite revealing other employees (ADR-0202).
2. **Greenfield** — new `availability` capabilities (ADR-0200) to cover the missing employee-availability primitive.

The temptation: ship availability first, because it is cleaner / smaller / more ADR-ready, and remediate shift_swap later. The reviewers pushed back: availability builds *on the same harness* as shift_swap — same capability registration, same emit registry, same gate_action contract, same channel-restriction contract. If availability ships alongside a broken shift_swap, every new capability author looking for an example copies from the broken precedent.

Chair applied a Trust Gate block on the greenfield work.

## Discovery

**Greenfield work built on broken-harness precedent propagates anti-patterns.** When a new capability ships while a sibling capability on the same harness is broken (missing `gate_action`, phantom emit, wrong channel, etc.), the new capability becomes a new "accepted" example that future authors will trace from. The broken sibling's anti-patterns enter the stable set.

The dynamic is not hypothetical. Shift_swap shipped without `gate_action` (ADR-0201 occurrence #2); contract_intake shipped without `gate_action` (ADR-0201 occurrence #1); helpdesk Phase 0 shipped with `allowedChannels` missing (fixed by ADR-0163). Each occurrence happened in a later campaign than the previous, and each campaign's author cited the prior as the template. The broken-precedent path was a real propagation vector.

**Chair MUST block greenfield at Trust Gate if precedent fails.** The Trust Gate question for any capability-adjacent greenfield: "is the closest existing sibling on this harness currently compliant with the invariants this ADR enforces?" If not, greenfield is blocked until sibling is remediated — OR the remediation is bundled into the greenfield PR — OR a clearly documented fenced-off design excludes the sibling's failure mode from the greenfield surface.

Shipping order for 2026-04-23 hospitality council:

1. **Fix-shift-swap-harness** — add `gate_action`, fix registry typo, add `allowedChannels: ["chat"]`.
2. **Availability v1** — `availability.set_own` / `preference_rank` / `query_others` per ADR-0200, with all three harness invariants honored.
3. **Roster-availability-overlay** — consumer surface (D5 scorer / roster UI) that reads availability.

Any reshuffling that puts (2) before (1) fails Trust Gate. (3) is the actual end-user win, but blocking (3) on (1) was the cheap move that prevented the propagation.

## Impact

**`run-council` SKILL.md gains a Trust Gate check.** For any greenfield capability review, Phase 5 asks: "what is the closest existing sibling capability on this harness, and is it compliant with the invariants this ADR enforces?" If the sibling is non-compliant, Phase 5 returns Trust Gate FAIL unless remediation is bundled.

**Chair orientation.** The chair's default bias toward "ship the clean thing first, fix the dirty thing later" is wrong when the clean thing inherits from the dirty harness. The correct bias is "fix the harness, then ship on a clean harness". This runs against sprint pressure; it is nevertheless the pattern that prevents the 4th / 5th / 6th occurrence of the underlying anti-pattern.

**L-0115 / L-0116 are the cousins.** L-0115 ("ontology PASS does not imply runtime PASS") warned that chair must produce one merge-gate verdict. L-0116 ("sibling-tool architectural inconsistency = Trust Gate failure") named inconsistency across siblings as a gate failure. This learning is the third in the family: *propagation* via greenfield trailing broken sibling is itself a Trust Gate failure.

**Not an excuse to reject greenfield indefinitely.** Remediation must be cheap and scoped (same PR or immediate follow-up). Blocking greenfield *without* a remediation plan is its own anti-pattern — it creates backlog pressure that eventually overrides the gate. The gate is "fix precedent first", not "freeze greenfield".

## References

- ADR-0200 — employee availability three-table model (the blocked greenfield).
- ADR-0201 — `gate_action` mandatory on mutation capability tools (the rule the precedent violated).
- L-0066 — default-allow capability authority = CVE-class trap (earliest canonical predecessor).
- L-0097 — C4 authority defaults are not free (2nd occurrence — pre-promotion).
- L-0115 — ontology PASS does not imply runtime PASS (cousin learning on chair gate-verdict discipline).
- L-0116 — sibling-tool architectural inconsistency = Trust Gate failure (cousin learning on sibling-tool divergence).
- Council session 2026-04-23 (hospitality gap analysis) — Phase 5 Trust Gate decision.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
