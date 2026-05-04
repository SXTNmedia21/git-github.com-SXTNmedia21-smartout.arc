---
title: "Journey — 4 foundation ADRs registered + status accepted"
feature: lovsen-foundation
journey: foundation-adrs-locked
status: verified
verified_at: 2026-04-29T04:50+02:00
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, adr, governance, p1-s0]
---

# Journey: 4 foundation ADRs registered + status accepted

**Role:** developer (Phase 1 implementer or future archaeologist)

**Precondition:**
- `docs/decisions/0000-decision-log.md` exists and is the master index
- Latest accepted ADR slot is determined by reading HEAD of the index (currently around 0180; verify before writing)
- No Lovsen-specific ADRs exist

## Happy Path

1. Developer opens `docs/decisions/0000-decision-log.md` → reads top of file → confirms next free slot range (e.g. 0181-0184)
2. Developer reads `docs/templates/decision.md` → uses it as the template for each new ADR
3. Developer writes 4 ADR files with `status: accepted`:
   - `0242-lovsen-citation-contract.md` — verbatim paragraph + hash + fetched_at on every citation
   - `0243-lovsen-confidence-model.md` — score derivation, degraded states, stale-paragraph rule
   - `0244-lovsen-mcp-boundary.md` — 4 stdio MCPs own fetch; capability never scrapes
   - `0245-lovsen-capability-authority.md` — C4 authority seed for `industry_intelligence.lovsen_query`
4. Each ADR has YAML frontmatter (title, status: accepted, created, updated, related ADRs)
5. Developer adds 4 new rows to the index table in `0000-decision-log.md` (in slot order)
6. Developer bumps the "ADRs total" count line in the **Integrity** section
7. Developer reads each ADR end-to-end → context, decision, consequences, links — no TBDs or placeholders

**Postcondition:**
- 4 new files in `docs/decisions/` (one per ADR)
- 4 new rows in `0000-decision-log.md` index
- Count in Integrity section reflects new total
- Downstream sub-sorties (P1.S1a-S4) can reference these ADR numbers as locked-in constraints

## Error Paths

- **Scenario:** ADR slot collision (e.g. 0181 already claimed by another in-flight branch) → grep all worktrees + `git fetch --all` first; renumber to next free if collision found → fix: pick next 4 free integers in sequence
- **Scenario:** `status: proposed` slipped in instead of `accepted` → faseplan locked these as PD-1..17 plan-time decisions → fix: change to `accepted`; set `accepted_at: 2026-04-29`
- **Scenario:** ADR cross-references break (e.g. 0181 mentions 0184 but 0184 was renumbered) → grep for the slot number across all 4 ADRs after numbering → fix: update references

## Verification

- [x] Implementation matches the steps above
- [x] 4 ADR files exist with `status: accepted` frontmatter (0238-0241, slots 0181-0184 were taken)
- [x] 4 index rows in `0000-decision-log.md` at top of table (newest first)
- [x] Count line bumped to 100 in Integrity section
- [x] Each ADR self-contained (context, decision, consequences, no TBDs)
- [x] Cross-references between the 4 ADRs resolve (0238↔0239, 0240→0238, 0241→0238/0239)

**Mark `status: verified` in frontmatter when all six boxes are checked.**
