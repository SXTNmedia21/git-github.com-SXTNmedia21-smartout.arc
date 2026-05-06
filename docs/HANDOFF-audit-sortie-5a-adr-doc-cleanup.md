---
title: HANDOFF — Audit Sortie 5a, ADR + Doc Cleanup
status: review
created: 2026-05-06
updated: 2026-05-06
module: docs
tags: [audit, docs, adr, sortie, handoff]
sortie: feat/audit-sortie-5a-adr-doc-cleanup
worktree: ~/dev/smartout.ai-wt-10
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# HANDOFF: Audit Sortie 5a — ADR + Doc Cleanup

## Summary

Doc-only sortie. Closes audit slice 09 H-01 + H-03 + M-01 and slice 05 H2 evidence correction. 4 commits, no code touched.

## Fixes shipped

| # | Commit | What |
|---|---|---|
| F1 | `eddfaedbb` | Decision-log dedupe — 27 duplicate rows removed (26 ADRs, ADR-0190 had 3 rows). Each ADR now has exactly one row. |
| F2 | `f3e48d118` | ADR-0265 row added to decision-log table at line 65 (was only in header comment). |
| F4 | `a21ee31f9` | Audit synthesis slice 05 H2 + 00-SYNTHESIS.md corrected — `useShiftChat:65,159` are reads not writes; real write at `:238` writes `channel_message` (not `chat_message`). |
| F3 | `34f726064` | ADR-0259 amended to use `legal` capability string (matches migration `20260520130000` shipped reality). Production reality wins. |

Branch: `feat/audit-sortie-5a-adr-doc-cleanup`. Worktree: `~/dev/smartout.ai-wt-10`. Base: plan + journeys at `859d3b6e7`.

## Architectural decision

**F3 ADR-0259 vs migration: production reality wins.** ADR-0249 registered `legal` as the canonical fifth capability on 2026-04-29. Migration `20260520130000` seeded `capability='legal'`. Only `industry_intelligence.lovsen_query` reference was in ADR-0259 text + one stale comment in `packages/telemetry/src/registry.ts:10634`. Decision: amend ADR-0259 (text) to match `legal`. Don't touch migration (would require a follow-up migration with rollback risk). Comment in registry.ts left as P1.S4 cleanup target — not load-bearing, just cosmetic drift.

This closes the L-0066 default-allow CVE class for this pair. Any future consumer resolving capability against ADR-0259 string now lands in the same gate row as the migration shipped.

## Verification

```bash
cd ~/dev/smartout.ai-wt-10
grep -E "^\| \[ADR-[0-9]+" docs/decisions/0000-decision-log.md | grep -oP "\[ADR-\d+\]" | sort | uniq -d
# → empty (no duplicates)
grep -A1 "0265" docs/decisions/0000-decision-log.md | head -3
# → row present
grep "useShiftChat" docs/audits/2026-05-06-adr-contract-validation/05-mobile-surface.md
# → corrected with [Corrected by S5a 2026-05-06] note
grep "capability" supabase/migrations/20260520130000_legal_capability_authority_seed.sql
# → 'legal' (matches ADR-0259 amended text)
```

## Learnings

### L-NEW-1 — Decision-log dedupe count exceeded baseline measurement

Audit slice 09 measured 21 duplicate ADR rows; actual count was 27 (26 ADRs duplicated, ADR-0190 had 3 rows). Audit count was sample-based; actual count required full scan.

**Why:** Slice agent likely grep-counted unique ADR-NNNN appearances vs total appearances; some duplicates may have had subtle whitespace or formatting differences that the slice's pattern missed.

**How to apply:** When closing audit findings labeled with counts, expect actual count to be ≥ audit count. Don't be surprised by drift between measurement methods. Cite both numbers in HANDOFF.

### L-NEW-2 — Production reality is canonical for ADR vs code disagreements

When an `accepted` ADR's example contradicts a shipped migration: amend the ADR text, not the migration. Migration replays would require a rollback strategy + new migration timestamp + integrity testing; ADR amendment is a single doc edit. Do this even when the ADR text is "more correct" architecturally — production wins because it's already running. Document the decision (audit history → architectural intent change → ADR amendment, not the reverse).

**How to apply:** Any future ADR-vs-code drift sortie should default to amending ADR text unless production has demonstrably wrong behavior that the migration must fix.

### L-NEW-3 — Commitlint scope rejects digit+letter mix

`audit-sortie-5a` scope was rejected by commitlint kebab-case rule (digit+letter token `5a`). `audit-sortie-5` (digit-only) and `audit-sortie-1` work. Workaround: `audit-doc-cleanup` (no digits in scope).

**How to apply:** When naming sub-sorties or scopes with letter+digit suffixes, prefer letter-suffixed prefix names that don't put a digit-letter mix at a token boundary. Already in session memory after first occurrence — promote to repeat if seen again.

## Known issues / debt

- **`packages/telemetry/src/registry.ts:10634` comment** still references `industry_intelligence.lovsen_query` as a comment note for P1.S4 cleanup. Not load-bearing — agent flagged for follow-up. Fix in next telemetry sortie or as part of S4 follow-up.
- **F1 dedupe is one-shot** — does not prevent future duplicates. Future status promotions on ADRs must edit existing row in place. Consider adding a CI grep blocker (similar to S2's `no-inline-gate-rpc.sh`) that fails on duplicate ADR rows in the log.

## Next steps

### Pre-merge (Pontus or me)
1. Verify checks above pass.
2. `close-feature.sh 10` to merge to development.

### Post-merge
- Optional: add CI grep blocker for decision-log duplicate rows (~30 min).
- Continue ADR drift cleanup for items NOT in S5a scope: ADR-0151/0168/0169/0192 status sync, ADR-0041/0115/0122/0139/0218/0240/0260 implementation drift, ADR-0053 stale-proposed sweep. Separate sorties.

## Closure deliverable status

- [x] Plan: `docs/plans/PLAN-audit-sortie-5a-adr-doc-cleanup.md`
- [x] Journeys: `docs/journeys/JOURNEY-audit-sortie-5a-adr-doc-cleanup.md`
- [x] All 4 fixes shipped + verified
- [x] Doc-only — no typecheck risk; not run
- [x] HANDOFF (this file)
- [ ] No new ADRs needed; skip
- [ ] `close-feature.sh 10` — runs after pre-merge checks
