---
title: JOURNEY — Audit Sortie 5a, ADR + Doc Cleanup
status: draft
created: 2026-05-06
updated: 2026-05-06
module: docs
tags: [audit, docs, adr, journey]
sortie: feat/audit-sortie-5a-adr-doc-cleanup
---

# User Journeys: Audit Sortie 5a — ADR + Doc Cleanup

Internal documentation journeys. Closes documentation drift findings from audit slice 09 + slice 05 H2 correction.

---

## Journey: Developer looks up ADR-0265 deployment pipeline

**Precondition:** Developer wants to verify which ADR governs the deploy pipeline. Opens `docs/decisions/0000-decision-log.md`.

1. Developer searches log table for "0265" → finds ADR-0265 row → row says "ADR-0265 — Enforced Deployment Pipeline (accepted, 2026-05-XX)" → Developer clicks the linked file → reads full text → understands canonical deploy flow.

**Postcondition:** Developer found the ADR via the canonical index.

**Pre-fix gap:** ADR-0265 existed only in a comment in the log header — not in the table rows. Grep-based integrity checks + log consumers missed it. Now indexed properly.

---

## Journey: Developer cross-checks ADR status in code vs log

**Precondition:** Developer reading code, sees `gate_action(p_capability => 'legal', ...)`. Wants to verify which ADR governs.

1. Developer searches `docs/decisions/` for "legal" → finds ADR-0259 + ADR-0249 → reads ADR-0259 → its example uses `capability='industry_intelligence.lovsen_query'` (or `'legal'` post-fix) → matches code → Developer confident gate is correctly seeded.

**Postcondition:** ADR text and migration reality agree.

**Pre-fix gap:** ADR-0259 example used `industry_intelligence.lovsen_query` while migration `20260520130000` shipped `'legal'`. If a future consumer trusted ADR-0259 and resolved gate against the ADR string, hit default-allow (L-0066 CVE class). Sortie 5a aligns the strings.

---

## Journey: Audit reader follows synthesis Top-10 #X to file:line

**Precondition:** Reader of `00-SYNTHESIS.md` clicks through to slice 05 H2 to fix `useShiftChat.ts:65,159` direct chat_message insert.

1. Reader opens slice 05 H2 → reads "useShiftChat.ts:65,159 — chat_message direct insert" → opens file → finds line 65 is SELECT, line 159 is Realtime subscribe → confused.

**Pre-fix gap:** audit label error. Real write at `:238` writes `channel_message` (different table). Sortie 5a corrects the reference + notes the H1-class finding for channel_message tracked under M4 sub-sortie.

**Postcondition:** Synthesis text matches code reality. Future readers don't waste time chasing wrong lines.

---

## Journey: Operator runs decision-log integrity check

**Precondition:** Heartbeat / on-demand grep verifies decision-log consistency.

1. Operator runs `awk '/^\| ADR-/' docs/decisions/0000-decision-log.md | sort | uniq -c | sort -rn` → counts rows per ADR → expects each at exactly 1 → finds rows >= 2 indicating duplicates → reports drift.

**Pre-fix gap:** 21 ADR-NNNN rows appearing twice in the log (proposed + accepted lines never collapsed when status promoted). Up from 8 at 2026-05-02 baseline. Sortie 5a deduplicates.

**Postcondition:** Each ADR has exactly one row. Status is current. Future status promotions edit the row in place, don't append.
