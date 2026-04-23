---
id: L-0117
title: "Grep-based structural claims must be code-traced (5th occurrence — PROMOTED to hard rule)"
status: accepted
date: 2026-04-22
type: process
created: 2026-04-22
updated: 2026-04-22
related_adrs: [ADR-0191, ADR-0192]
module: MODULE_GOVERNANCE
tags: [learning, council, phase-2.5, audit-inflation, code-trace, hard-rule, contract-hub-redesign]
---

# L-0117 — Grep-based structural claims must be code-traced (5th occurrence — PROMOTED to hard rule)

## Context

2026-04-22 post-merge review of `contract-hub-redesign` (PR #234). Phase 2.5 fact-check claimed "no entity in registry interfaces" — a grep over the registry-related files for the entity term returned zero matches.

Agent Coordinator code-trace proved the claim was false at 5 specific lines. The entity reference existed; grep missed it because:
- The reference used a different casing in one site.
- One match was inside a JSDoc comment block.
- One match was inside a string literal that grep's regex did not match.
- One match was a re-export from a sibling module that grep did not follow.
- One match was generated code in `database.types.ts` that the search scope excluded.

This is the **5th occurrence** of the audit-inflation pattern (see `learning_audit_inflation_pattern.md` agent memory):
1. **2026-04-15** — Governance/Training (7 false claims via grep counts: change_proposal "doesn't exist", generate_steps handler "missing", etc.).
2. **2026-04-16** — Web Performance (4 false claims via grep counts: LiveKit "eager", TipTap files "28 inflated 6x", middleware queries "DIFFERENT code paths", Upstash "would be NET SLOWER").
3. **2026-04-18** — Gate-Client Wave 2 (5 false claims via grep counts: 9 sites mislabeled as raw async, ADR-0091 violation missed, D2 orphan missed, security vulnerability missed, telemetry bug missed).
4. **2026-04-20** — Auth-Invitation Wave H (4-of-5 events Edge-direct-insert phantom contracts that grep `emit\(` missed).
5. **2026-04-22** — Contract Hub Redesign post-merge (this council: "no entity in registry interfaces" — false at 5 lines).

The pattern is now confirmed as a **structural failure of grep as a verification tool for structural claims about file shape** (interface declarations, type definitions, table schemas, registry entries, FK relations).

## Discovery

**Grep counts are sufficient for population-style claims** ("how many files import X?"). Grep counts are **insufficient for structural claims** ("does X exist in file Y's type declaration?").

The reasons grep fails for structural claims:
1. Casing variants (camel vs snake vs Pascal).
2. Comment blocks that match.
3. String literals that match.
4. Generated code that is in scope but excluded from the search.
5. Re-exports across barrel files that hide the original declaration.
6. Type narrowing via conditional types that grep cannot follow.
7. Macros / decorators / generated typings.

**Code-trace via Read tool with file:line citation is the verification standard for structural claims.** Read the file. Cite the line. Quote the relevant snippet. Then make the claim.

## Impact

**PROMOTE to hard rule in `run-council` SKILL.md Phase 2.5:**

> **Phase 2.5 fact-check rule (hard, since L-0117):** Structural claims about file shape (interface declarations, type definitions, table schemas, registry entries, FK relations, capability registrations) MUST be verified by Read-tool citation with `file:line`. Grep counts are insufficient evidence for any "X exists" or "X does not exist" claim about code structure.
>
> Phase 2.5 dispatcher must perform direct Read for any such claim before accepting the briefing.

**Hard-rule trigger threshold met (5 occurrences):**
- 2026-04-15 (Governance/Training).
- 2026-04-16 (Web Perf).
- 2026-04-18 (Gate-Client Wave 2).
- 2026-04-20 (Auth-Invitation Wave H).
- 2026-04-22 (Contract Hub Redesign post-merge — this council).

**Update `learning_audit_inflation_pattern.md` agent memory** to mark "PROMOTED to hard rule 2026-04-22 after 5th occurrence" with this learning ID.

**Council Phase 2.5 reviewer briefing template gains:**
- For every structural claim, list either (a) Read tool citation `file:line` + quoted snippet, or (b) "VERIFICATION PENDING — code-trace required."
- Phase 2.5 reviewer escalates "VERIFICATION PENDING" claims to Phase 3 code-tracer (default Agent Coordinator) before Phase 5 synthesis.

## References

- `learning_audit_inflation_pattern.md` — agent memory (PROMOTED to hard rule 2026-04-22).
- ADR-0191 — Agent capability tool auth-passing pattern (P0 #2 was missed by grep-based pre-merge review).
- ADR-0192 — Authority seed bootstrap-trigger pattern (P0 #1 CVE missed by grep-based pre-merge review).
- L-0096 — Code-trace catches schema fiction concept-review approves (sibling pattern).
- L-0112 — Code-trace catches what grep-briefing misses (sibling pattern).
- L-0099 — Prior-council-verdict staleness pattern (4th occurrence — promoted; sibling promotion).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22.
- Prior occurrences: 2026-04-15, 2026-04-16, 2026-04-18, 2026-04-20, 2026-04-22.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
