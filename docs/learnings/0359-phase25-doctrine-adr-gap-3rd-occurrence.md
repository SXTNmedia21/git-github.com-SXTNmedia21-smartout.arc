---
title: "Phase 2.5 fact-check must search docs/decisions/ for doctrine ADRs (3rd occurrence)"
id: LEARNING_0359
status: canonical
layer: learning
created: 2026-05-25
updated: 2026-05-25
tags: [council, phase-2.5, methodology, SKILL-promotion-candidate]
---

# Learning-0359: Phase 2.5 missed doctrine ADR — 3rd occurrence, promotion-grade

## Context

Council session 2026-05-25 on ghost-migration prod-state remediation. Phase 1 orchestrator proposal: "Option A — apply 3 ALTERs directly via MCP `execute_sql`". Phase 2.5 fact-check ran on the briefing: VERIFIED all file paths, line numbers, ADR-0265 cross-references, PR #375/#376 precedent identification.

Phase 3 supervisor code-trace surfaced ADR-0361 §Design 2 (codified 2026-05-17, 8 days before this council): "Forward-only repair, not auto-fix" — explicit doctrine that supersedes the PR #375/#376 "manual ledger reconciliation" pattern the briefing cited. The briefing's whole framing of "Option A vs Option B" was operating on pre-2026-05-17 doctrine. Supervisor's verdict: REJECT A + B, ACCEPT Option D (forward-only migration).

Steward Phase 5 synthesis: chair self-reversal per L-0147 (Phase 1 Option A → Phase 5 Option D).

The doctrine ADR existed for 8 days. Briefing-author + Phase 2.5 fact-checker + Phase 3 chair all missed it. Only Phase 3 supervisor's code-trace mandate surfaced it.

## Discovery

**Phase 2.5 fact-check verifies stated claims but does not actively search for unstated doctrine that contradicts the proposal.**

This is the 3rd occurrence of "Phase 2.5 missed a load-bearing artifact":
1. **2026-05-16 chat-WhatsApp council** — wrong-scope-key grep returned 0 (false-empty) because briefing said `grep '"hms'` against site-map.json that keys by `"path"` not `"scope"`. Phase 2.5 didn't catch wrong query shape.
2. **2026-05-17 HMS R1 PM** — same wrong-scope-key pattern, 0 hits claimed for site-map entries that existed under different key.
3. **2026-05-25 this council** — doctrine ADR (ADR-0361 §Design 2) existed 8 days, was not surfaced in briefing, Phase 2.5 verified what WAS in briefing but didn't search for what SHOULD be (any recent ADR touching the topic surface).

**Pattern signature:** Phase 2.5 is a defensive verifier (test claims), not an offensive auditor (find missing claims). Doctrine ADRs that supersede the proposal's premise live in `docs/decisions/` but are invisible if the briefing never names them.

**Promotion-grade rule (per Phase 9 Step 4 — 3 dates across different sessions = promote to SKILL.md):**

Phase 2.5 fact-check MUST include — *in addition to* claim verification:

```
For every topic surface mentioned in briefing (deploy pipeline / migrations / capability tools / etc),
grep docs/decisions/ for ADRs touching that surface, filter to last 14 days,
report any ADR whose §Design / §Decision Outcome contradicts the briefing's proposed option.
```

Concrete command for migration-touching councils:

```bash
grep -rln "migration\|db push\|schema_migrations\|forward-only" docs/decisions/ | \
  xargs ls -la | sort -k6,7 | tail -20
```

Surface results in fact-check output as section **(d) DOCTRINE_CONFLICT — recent ADRs that supersede premise**.

## Impact

- This learning + 2 prior occurrences (chat-WhatsApp 2026-05-16, HMS R1 2026-05-17) satisfy the 3-occurrence promotion gate
- `run-council` SKILL.md Phase 2.5 section requires update — add explicit doctrine-search mandate as 4th bullet under "For every claim in the briefing"
- Council templates should pre-load `docs/decisions/0000-decision-log.md` entries for the last 14 days when topic is post-implementation or migration-class
- Saved cost: one council session per quarter avoided (Phase 3 reviewer surfaces doctrine = wasted Phase 3 budget when Phase 2.5 should have caught it)

## References

- Council session 2026-05-25 — Phase 5 synthesis surfaced ADR-0361 §Design 2 via supervisor code-trace
- ADR-0361 §Design 2 (2026-05-17) — the doctrine missed
- ADR-0427 (this council) — the ADR that ADR-0361 §Design 2 informed the decision on
- ADR-0425 — Phase 2.5 fact-check methodology (precedent ADR — may need amendment to absorb this rule)
- L-NEW (chat-WhatsApp 2026-05-16) — 1st occurrence wrong-scope-key
- L-0294 — 7th L-0147 precedent (sibling chair-reversal pattern)
- council_meta.md Process Improvements section — needs new line dated 2026-05-25
