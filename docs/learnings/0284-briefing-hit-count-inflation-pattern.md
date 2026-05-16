---
title: "Sortie planning briefings inflate hit counts via doc+code conflation"
id: L_0284
status: promote
layer: learning
created: 2026-05-16
updated: 2026-05-16
---

# L-0284 — Briefing hit-count inflation via doc+code conflation

## Third occurrence — promoted to SKILL.md hard-rule

### This occurrence — Payroll Sortie-Triplet 2026-05-16

Briefing claimed 122 "lønnsslipp" hits in the codebase. Council Phase 2.5 fact-check (general-purpose haiku) returned 12/13 VERIFIED + 1 OUTDATED. The OUTDATED finding was the hit count itself.

Actual breakdown:
- **(a) Live production code** — 8 hits (3 web UI + 5 mobile UI). These are the only hits relevant to the sortie scope.
- **(b) i18n keys** — counted within the 8 above; no separate i18n-only hits for this term.
- **(c) Docs / frozen audit files / ADR-history** — approximately 14 hits in `docs/audits/` frozen reports, prior HANDOFF files, and COUNCIL-LOG historical entries.
- **(d) AI alt-spellings / pedagogy lines** — approximately 100 hits across `packages/ai/src/industry/`, knowledge-test fixtures, and deliberate pedagogical contrast lines.

**Inflation factor: ~96%.** The briefing's 122 count included categories (c) and (d) which are explicitly excluded from the sortie's blast radius.

### Sibling occurrences

1. **Web Perf council (date TBD)** — similar code+docs conflation; briefing claimed inflated component count including Storybook stories, E2E fixtures, and archived snapshots alongside live production components.
2. **Gate Migration council (date TBD)** — briefing claimed inflated migration count by including archived migrations and superseded files alongside active ones.
3. **This occurrence** — Payroll Sortie-Triplet 2026-05-16 (3rd documented occurrence).

### Promoted hard-rule (Phase 1 INTAKE addition to council SKILL.md)

Any sortie briefing claiming N > 20 hits on a search term MUST split the count by file type before Phase 3 dispatch. Required categories:

| Category | Scope | Counts for sortie? |
|---|---|---|
| (a) Live production code | `apps/web/src/`, `apps/mobile/src/`, `packages/ai/src/capabilities/`, `services/` | **YES** |
| (b) i18n keys | `packages/i18n/`, `apps/*/locales/` | **YES** |
| (c) Docs / frozen audits / ADR-history | `docs/`, `*.md` outside apps/packages | **NO** |
| (d) AI alt-spellings / pedagogy | `packages/ai/src/industry/`, fixtures, test cases, deliberate contrast lines | **NO** |

**Briefings without this split are REJECT at Phase 2.5.** The Phase 2.5 fact-checker (haiku) is explicitly responsible for requesting the split when a briefing presents an unsplit N > 20 claim.

### Heuristic

Only categories (a) and (b) count for sortie scope. A briefing claiming "122 hits" when (a) + (b) = 8 is 96% inflated and will cause sortie over-dispatch (wasted agent time, wrong blast-radius analysis, incorrect sequencing decisions).
