---
title: PLAN — Audit Sortie 5a, ADR + Doc Cleanup
status: in_progress
created: 2026-05-06
updated: 2026-05-06
module: docs
tags: [audit, docs, adr, sortie]
sortie: feat/audit-sortie-5a-adr-doc-cleanup
worktree: ~/dev/smartout.ai-wt-10
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# Plan: Audit Sortie 5a — ADR + Doc Cleanup

## Context

Audit slice 09 (adr-coverage-gaps) found documentation drift accelerating, not contained. Doc-only sortie — no code risk. Closes 4 findings.

Audit synthesis: `docs/audits/2026-05-06-adr-contract-validation/09-adr-coverage-gaps.md` + slice 05 H2 evidence correction.

## Scope

| # | Surface | Severity | Type |
|---|---|---|---|
| F1 | `docs/decisions/0000-decision-log.md` — dedupe 21 duplicate ADR rows (was 8 baseline → 21 now) | MEDIUM | Doc edit |
| F2 | `docs/decisions/0000-decision-log.md` — add ADR-0265 row (canonical deploy ADR currently only in header comment) | HIGH | Doc edit |
| F3 | ADR-0259 capability name conflict — choose `legal` (matches migration) OR `industry_intelligence.lovsen_query` (matches ADR text). Update ADR-0259 OR migration `20260520130000_legal_capability_authority_seed.sql` to align. Default-allow CVE class per L-0066 makes this load-bearing. | HIGH | Doc + possibly migration |
| F4 | `docs/audits/2026-05-06-adr-contract-validation/05-mobile-surface.md` H2 — correct line numbers for `useShiftChat.ts` (audit said `:65,159` are direct chat_message inserts; verified during S4 they are reads). Real write at `:238` writes `channel_message` not `chat_message`. | LOW | Doc correction |

## Out of scope

- ADR-0151/0168/0169/0192 status sync (log says `proposed`, code is `accepted`) — bundle into Sortie 5a if time permits, else separate.
- ADR-0041/0115/0122/0139/0218/0240/0260 drift items from audit slice 09 — separate sortie 5b or 5c, larger scope (each may need ADR amendment or implementation work).
- ADR-0053 stale-proposed sweep (44+ days). Separate task.

## Order

1. **F1** dedupe — quick scan + remove duplicate rows. Read log, find `^| ADR-NNNN |` patterns appearing twice, keep latest status row.
2. **F2** add ADR-0265 row — find correct table row in log, insert.
3. **F4** audit synthesis correction — small line-number fix.
4. **F3** ADR-0259 vs migration name — REQUIRES architectural decision. Read both ADR-0249 + ADR-0259 + migration `20260520130000` to decide. If unclear: STOP + write blocker doc for Pontus.

## Acceptance criteria

- F1: decision log has each ADR-NNNN row appearing exactly once. Rows reflect current status (accepted preferred over proposed when both rows existed).
- F2: ADR-0265 has a row in the table with correct title + status + date.
- F3: ADR-0259 + migration `20260520130000` reference same capability string. NO ambiguity remains.
- F4: slice 05 H2 lists correct `useShiftChat.ts` line numbers (real writes) and corrects table name (channel_message vs chat_message).

## Dependencies / risk

- F3 may surface that the migration `20260520130000` already shipped to production with `capability='legal'`. Changing ADR-0259 to match (instead of changing migration) is the safer path. Verify which is shipped before deciding.
- All other tasks doc-only — no code regression risk.
- Stop hook typecheck should not fire (no .ts edits). If F3 requires migration edit, sortie expands scope — stop + write blocker.

## Steps

### F1 — Decision log dedupe
1. Read `docs/decisions/0000-decision-log.md`.
2. Build a map: ADR-NNNN → list of rows.
3. For each ADR with >1 row: keep the one with `accepted` status if present; otherwise keep latest by `last-updated` column; remove the others.
4. Verify: count rows, expect ~163 unique ADR rows (per CLAUDE.md last count).

### F2 — Add ADR-0265 row
1. Verify ADR-0265 file exists at `docs/decisions/0265-enforced-deployment-pipeline.md`.
2. Read its frontmatter for title + status + date.
3. Insert a row in `0000-decision-log.md` table at the correct position (sorted by ID).

### F4 — Audit synthesis F9 correction
1. Read `docs/audits/2026-05-06-adr-contract-validation/05-mobile-surface.md` H2.
2. Replace `useShiftChat.ts:65,159` with corrected reference: lines `:65,159` are reads (SELECT + Realtime). Real write is `:238` `enqueue("send_message")` writing `channel_message` (NOT `chat_message`). H1-class forgeable-attribution finding for `channel_message`, tracked under M4 sub-sortie.
3. Add note to 00-SYNTHESIS.md Top-10 #X if `useShiftChat` was referenced there too.

### F3 — ADR-0259 vs migration name
1. Read `docs/decisions/0249-*.md` and `docs/decisions/0259-*.md` (both lovsen-related).
2. Read migration `supabase/migrations/20260520130000_legal_capability_authority_seed.sql`.
3. Check what's seeded in `engine_authority_config.capability` — `'legal'` or `'industry_intelligence.lovsen_query'`?
4. If migration seeded `'legal'` and ADR-0259 spec says different: amend ADR-0259 to match migration (production reality wins). Document the decision.
5. Reverse case: amend migration. But this requires shipping a follow-up migration to UPDATE/INSERT correct row, and rolling back the wrong row. Higher risk.
6. If decision unclear: STOP + write blocker.

## Closure deliverables

- [x] Plan written
- [ ] Journey doc
- [ ] All 4 fixes shipped (or scope-narrowed if F3 blocked)
- [ ] Typecheck passes (no .ts edits expected)
- [ ] HANDOFF written
- [ ] `close-feature.sh 10` run by Pontus or me

## Estimated wall time

~30-60 min for one sonnet agent. F1 + F2 + F4 mechanical (~10-15 min each). F3 may be quick (read 2 files + 1 migration) or blocker.
