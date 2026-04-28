---
title: "SYSTEM-MAP Refresh + Code-Trace Verification Protocol"
id: ADR_0227
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
related: [ADR-0075, L-0083, L-0138, L-0150]
---

# ADR-0227: SYSTEM-MAP Refresh + Code-Trace Verification Protocol

## Context and Problem Statement

`docs/architecture/BOTSSON-SYSTEM-MAP.md` is cited as authoritative pipe diagram for every Botsson council. Despite carrying a `verified_against_code: YYYY-MM-DD` header, it has produced four documented instances of stale-claim-drives-false-briefing across distinct councils: 2026-04-16 Web Perf, 2026-04-18 Gate Migration, 2026-04-22 Auth Invitation, 2026-04-28 Botsson Voice + Tool Perf (this council). Pattern is L-0150 (BOTSSON-SYSTEM-MAP staleness cycle), 4th occurrence promotion threshold met.

Same-day verification timestamps (the 2026-04-28 council saw a `verified_against_code: 2026-04-28` header that nonetheless contained two falsifiable claims — B5 dispatcher handlers as 🔴 when they exist with tests; LiveKit adapter at non-existent path) prove the human "I refreshed the map" check is unreliable.

This ADR establishes a refresh + verification protocol that combines mechanical CI signal with mandatory in-PR sync.

## Decision Drivers

- L-0150 occurrence count = 4 across 13 days. Pattern is recurring, not exceptional.
- L-0083 (audit-inflation) shares mechanism: grep-count claims in audits inflate without code-trace. SYSTEM-MAP is a special case of audit artifact.
- ADR-0075 (Boot sequence + DASHBOARD authority) didn't anticipate that derived summary docs would themselves become canonical — staleness was orthogonal to ADR-0075's scope.
- Council Phase 2.5 fact-checker mandate already exists; needs extension to require code-trace on any SYSTEM-MAP-cited claim.
- `/close-feature.sh` gates already exist for typecheck, journey-guardian, frontmatter; they don't gate map sync.

## Considered Options

1. **Status quo + nag** — keep manual refresh; add reminders. Failed 4× in 13 days. Reject.
2. **Mechanical CI check on header date** — fail CI if `verified_against_code` is >7 days old. Catches forgotten refresh; doesn't catch a refresh that contains stale claims.
3. **Mechanical CI check on row content** — for each 🟢 row in SYSTEM-MAP, verify referenced file/symbol exists via grep. For each 🔴 row, verify it doesn't exist. Catches stale rows mechanically; high false-positive risk on phrasing variations.
4. **In-PR sync requirement** — `/close-feature.sh` gates sync: if PR touches `packages/ai/src/capabilities/` or `services/stage-engine/` or `supabase/functions/engine-dispatch/`, require SYSTEM-MAP entry update in same PR. Catches drift at source; relies on human judgment about what "touches".
5. **Council Phase 2.5 extension** — fact-checker MUST code-trace any SYSTEM-MAP-cited briefing claim regardless of map's `verified_against_code` date. Catches stale claims at council time; doesn't prevent staleness for non-council readers.
6. **Hybrid: Options 2 + 4 + 5** — header-date CI + close-feature in-PR sync + Phase 2.5 mandatory code-trace. Belt + suspenders + late-stage gate.

## Decision Outcome

Chosen option: **Option 6 — hybrid mechanical + in-PR + council-time enforcement.**

### Layer 1 — Mechanical CI (header staleness)

Add CI step `harness-invariants:system-map-freshness`:
- Parse `verified_against_code: YYYY-MM-DD` from `docs/architecture/BOTSSON-SYSTEM-MAP.md` frontmatter.
- Fail if date >7 days from current commit's date.
- Warn if 5-7 days.

### Layer 2 — In-PR sync (close-feature gate)

Update `~/.claude/scripts/close-feature.sh`:
- Detect "harness-touching" branches: any commit modifies `packages/ai/src/capabilities/`, `services/stage-engine/src/`, or `supabase/functions/engine-dispatch/`.
- For such branches, require:
  - `docs/architecture/BOTSSON-SYSTEM-MAP.md` modified in same branch (any line change), AND
  - frontmatter `verified_against_code` updated to the commit date.
- Block close-feature if either missing.
- Bypass via `SKIP_SYSTEM_MAP=1` env var (must be documented in handoff with reason).

### Layer 3 — Council Phase 2.5 mandate

Update `~/.claude/skills/run-council/SKILL.md` Phase 2.5:
- Any briefing claim citing `BOTSSON-SYSTEM-MAP.md` (or any ARCH-MAP doc) MUST be code-traced by the fact-checker, regardless of the map's `verified_against_code` date.
- Map citations are NEVER treated as VERIFIED on date alone. They are HYPOTHESES until grep-confirmed.
- Phase 2.5 report explicitly classifies map-cited claims as MAP-VERIFIED (date OK) vs CODE-VERIFIED (grep OK). Only CODE-VERIFIED counts for Phase 3.

## Rules & Consequences

- **Good, because** 3 layers prevent the 3 failure modes: forgotten refresh (L1), drift inside refresh (L2), council-time inheritance (L3).
- **Good, because** in-PR sync (L2) creates immediate feedback loop — developers see map drift as part of feature close, not weeks later.
- **Good, because** Phase 2.5 mandate (L3) costs ~2 min per council briefing, prevents 30-min synthesis reversals.
- **Bad, because** L2 adds friction to harness-touching PRs. Mitigation: SKIP_SYSTEM_MAP=1 with handoff reason.
- **Bad, because** L3 doubles fact-checker workload for map-heavy briefings. Mitigation: pre-load file list, use grep tool exclusively.
- **Bad, because** L1 false-positive: a week with no harness changes still fails freshness gate. Acceptable cost — forces explicit "no changes, reconfirm" commit which serves as audit log.
- **Agent Impact:**
  - `botsson-harness-builder`: when closing a sub-sortie, MUST update SYSTEM-MAP. Add to checklist.
  - `system-steward`: when chairing council with map citations, MUST tag fact-checker to code-trace each cited row.
  - `supervisor`: code-review of harness-touching PRs MUST verify SYSTEM-MAP delta matches code delta.
  - `close-feature.sh`: gate added.
  - `run-council` SKILL.md Phase 2.5: mandate added.

## References

- Council 2026-04-28 — System Council Botsson voice + tool perf
- L-0150 (4th occurrence promotion) — BOTSSON-SYSTEM-MAP staleness cycle
- L-0138 — system-map-drift-from-code (1st occurrence, 2026-04-25)
- L-0083 — audit-inflation pattern
- ADR-0075 — Boot sequence + DASHBOARD authority (precedent for derived-doc authority)
- `BOTSSON-SYSTEM-MAP.md` — target of the protocol
- `~/.claude/scripts/close-feature.sh` — to be updated
- `~/.claude/skills/run-council/SKILL.md` — Phase 2.5 mandate addition
