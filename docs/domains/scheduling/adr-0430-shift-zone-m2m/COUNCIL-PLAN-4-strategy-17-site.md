---
title: "Council Phase 5 — PLAN-4 Strategy: 17-site shift.zone UI blocker"
sortie: adr-0430-shift-zone-m2m
council_phase: 5
session_date: 2026-05-29
topic: "Strategy A/B/C/D for shift.zone UI blocker (actual: 42 reads / ~18 queries)"
verdict: "5/5 APPROVE Option A"
chair_verdict: "APPROVE Option A WITH 8 MF amendments"
adrs_cited: [ADR-0430, ADR-0367, ADR-0173, ADR-0356]
status: closed
---

# Council Phase 5 — PLAN-4 shift.zone UI Blocker Strategy

## Context

After PLAN-1–3 land, `schedule_shift.zone` (the scalar TEXT column) will be dropped
by M4. Every display site that renders `shift.zone` will break at typecheck. PLAN-4
was originally scoped as mobile hook + M4 + typegen + final cleanup. During PLAN-4
pre-council analysis, the orchestrator surfaced that the display-site count was larger
than expected and strategically under-specified.

### Options presented to council

**Option A — Funnel-first:** Rewrite `schedule-mappers.ts` (5 sites) as the single
fix point. Mappers emit `zones: Array<{name, location_id}>`. All display sites receive
the array through props. Pre-grep gate (`\.zone\b` = 0) enforced before M4.

**Option B — In-place scatter:** Rewrite each display site individually to resolve
zones from the raw shift object. No mapper change. 17+ individual edits, each with
its own join resolution.

**Option C — Virtual column / DB view:** Create a `schedule_shift_view` with a
`zone_display TEXT` virtual column aggregated from `shift_zone`. Display sites read
from the view. No app-code mapper change needed.

**Option D — Phased with feature flag:** Leave `schedule_shift.zone` column in place
(delay M4), add `shift_zone_display TEXT` shadow column populated by trigger. UI reads
shadow until all sites are migrated.

---

## Phase 3 — Reviewer verdicts

### Steward

Option A is the only structurally sound choice. The mapper layer is precisely the
abstraction boundary between raw DB shape and display-ready domain objects. Rewriting
5 mapper sites to emit `zones[]` is O(1) from the cascade perspective: the invariant
is that downstream display components must never perform their own join resolution.
Option B violates this by scattering the join logic across 17+ files — a maintenance
trap and a future L-0348 class risk. Options C and D both defer the correct fix by
introducing intermediate artifacts that will need cleanup.

Condition from Steward: the "17 sites" count deserves a deeper grep before PLAN-4a
dispatch. A `grep -rn "\.zone\b"` sweep across `apps/` and `packages/` excluding
`zone_id` and `shift_zone` will produce the accurate count. This should be a plan
pre-flight step, not an assumption.

**Verdict: APPROVE Option A with condition — accurate site count before dispatch.**

---

### Supervisor

Option A is correct. I ran a deeper grep to validate the site count (§2 of my
review, below). The "17 sites" figure from PLAN-4's original scope was derived from
a surface-level grep focused on specific files named in ADR-0430 Rule 5. The actual
blast radius is wider.

**§2 — Deeper grep evidence:**

```
grep -rn "\.zone\b" apps/ packages/ services/ \
  | grep -v "zone_id\|zone_ids\|shift_zone\|\.zones\|timezone\|\.zone\." \
  | wc -l
```

Result on the branch tip `ed5955df1`: approximately **42 matches** across
**~18 distinct SELECT query chains** (mappers + voice tools + mobile views +
stage-engine slice + payroll routes). The 17-site figure was incomplete.

Full breakdown:
- `schedule-mappers.ts`: 5 funnel sites (the PRIMARY fix — all downstream inherits)
- Mobile view components (BeforeShift/DuringShift/AfterShift/ShiftCard): ~10 inline reads
- Voice-tool serialization: 1 site
- Stage-engine workforce slice: 1 site  
- Payroll routes: ~6 sites (audit-and-prune needed — not all consume zone)
- Daily-briefing MapPin render: 1 pill-stack site
- Dev sandbox fixture: 2-3 refs

This confirms Option A: fix the mapper funnel once, and the mapper output propagates
`zones[]` through existing prop chains. The 10+ mobile view reads become trivial
`shift.zones?.[0]?.name ?? null` substitutions after the mapper is fixed — no
per-site join resolution needed.

Additional condition from Supervisor: the 6 payroll route sites must be individually
audited before PLAN-4a dispatch. Some payroll routes may not consume zone data at all
and should have the join removed rather than updated (query complexity reduction).

**Verdict: APPROVE Option A. Amend scope: 17→42 reads / ~18 queries.**

---

### Agent-Coordinator

Option A is correct from a system-coherence perspective. The V1 display shape must
be explicitly defined: which sites render first-zone only (scalar inline display) vs.
which render the full array (pill-stack). Without this distinction, implementers will
make inconsistent display decisions.

My proposed clarification, which I submit as a Phase 5 refinement:

- **Single-zone-V1 reality**: The vast majority of Vakter in the V1 product will have
  0 or 1 zone. Multi-zone staffing is an advanced pattern. Therefore, 15 of the ~17
  identified display sites should render `shift.zones?.[0]?.name ?? null` (first-zone
  only). This is explicit product intent, not a limitation.

- **Pill-stack surfaces**: Only 2 sites warrant full array rendering with a "+N"
  counter: the BeforeShiftView deptInset card (employee sees their zones at glance)
  and the daily-briefing MapPin render (manager overview). These are the surfaces
  where multi-zone context is operationally meaningful.

This distinction should be locked in PLAN-4a as explicit ACs (first-zone vs. pill-
stack sites), not left to implementer judgment.

**Verdict: APPROVE Option A. Amend: explicit first-zone vs. pill-stack surface split.**

---

### Harness

Option A. My focus is on the phantom-display class of bug that Option A introduces,
which the council should name explicitly so it isn't mistaken for a regression.

**§3 — Phantom-display class (new learning: L-NEW):**

After PLAN-4a lands, any shift that has NO `shift_zone` rows (because M3 skipped the
backfill due to unresolvable zone) will display as `null` in first-zone sites. This
was previously masked: `schedule_shift.zone` contained whatever free-text the user
entered, even if the zone was never linked to a `zone` table row. After reform, the
source of truth is the `shift_zone` join, and a shift with no join rows genuinely has
no zones.

This is CORRECT behavior, not a bug. But it will surface as "missing zone" for
historical shifts where the old `zone TEXT` had a value but M3 couldn't backfill.
Call sites should use `t("schedule.no_zone")` as the i18n fallback (not empty string)
so the absence is communicated to users, not silently blank.

This is a sibling of L-0176 (docstring-without-wiring) and L-0177 (silent-fallback
class) — call it L-NEW-phantom-display until the learning is numbered.

**Verdict: APPROVE Option A. Register L-NEW phantom-display. Document in PLAN-4b HANDOFF.**

---

### Visual+UX

Option A. From a UX consistency standpoint, the 15-site first-zone / 2-site pill-
stack split proposed by Agent-Coordinator is the correct V1 pattern. A user scanning
their shift on mobile does not need to see "Bar 1, Bar 2, +1 more" — they need to
see "Bar 1" as a quick orientation cue. The pill-stack is reserved for manager-
facing surfaces where zone diversity is an operational concern.

One addition: the i18n fallback should use a non-alarming string. `t("schedule.no_zone")`
is fine if the translation is "–" (em-dash) or "Ingen sone" (Norwegian), NOT
"Unknown zone" or "Zone missing" — those strings imply an error when the absence is
often by design (an ad-hoc shift or a shift at a single-zone location).

**Verdict: APPROVE Option A. i18n fallback should be neutral ("–" or "Ingen sone").**

---

## Phase 5 — Chair synthesis

### Convergence assessment

5/5 reviewers converged on **Option A**. No L-0147 reversal (no reviewer contested
the majority position or introduced a compelling minority concern that required
re-evaluation). The convergence is clean and fast.

The Supervisor's §2 deeper grep is the most load-bearing finding: the count of 42
reads across ~18 distinct SELECT query chains materially changes PLAN-4's scope
estimate. The original PLAN-4 "17 sites" was incomplete because it focused on
explicitly named ADR-0430 Rule 5 files. The actual blast radius is wider.

### Refinements accepted by chair

1. **Scope correction:** 17-site figure replaced with 42 reads / ~18 distinct query
   chains (Supervisor §2). PLAN-4 must split into 4a (readback) + 4b (mobile + M4
   + typegen + spine + HANDOFF) to reflect the correct scope boundary.

2. **Single-zone-V1 reality:** The 15-site first-zone / 2-site pill-stack surface
   split is locked as a product decision (Agent-Coordinator). PLAN-4a encodes this
   in ACs.

3. **Phantom-display class:** Named as L-NEW-phantom-display (Harness §3). Must be
   documented in PLAN-4b HANDOFF deferred section. i18n fallback = neutral string
   (Visual+UX guidance).

4. **Payroll route audit-and-prune:** 6 payroll sites must be individually audited —
   some should have the zone join removed entirely (Supervisor condition). PLAN-4a
   includes explicit audit-and-prune task.

5. **Stage-engine workforce slice:** The pre-existing slice-vs-tool asymmetry
   (agent-router.ts ~212-238 returns scalar `zone` while capability tool returns
   `zones[]` after PLAN-3) must be closed in PLAN-4a. +3-line enrichment.

6. **Voice-tool serialization:** `use-schedule-voice-tools.ts` must switch to
   `zones: s.zones` (array) in PLAN-4a, not deferred to PLAN-4b.

---

## 8 MF amendments (final verdicts)

| MF | Amendment | Source | Applied to |
|----|-----------|--------|------------|
| MF-1 | Scope: 17 reads → 42 reads / ~18 queries; pre-grep gate promoted to mandatory (L-0348 3rd occurrence) | Supervisor §2 + Steward condition | PLAN-4a §Pre-flight gate |
| MF-2 | `schedule-mappers.ts` funnel-first ordering; introduce `resolveZones()` shared helper | All reviewers | PLAN-4a §T1 |
| MF-3 | Display shape locked: 15 sites = first-zone inline, 2 sites = pill-stack max-2 + "+N" | Agent-Coordinator | PLAN-4a §T4 + §T5 |
| MF-4 | Payroll routes (6 sites): audit-and-prune — remove zone embed where unused | Supervisor condition | PLAN-4a §T6 |
| MF-5 | Stage-engine workforce slice enrichment: `zones: shift.zones.map(z=>z.name)` + `zone_display` (close slice-vs-tool asymmetry) | Supervisor §2 observation | PLAN-4a §T3 |
| MF-6 | Voice-tool serialization in scope of PLAN-4a (not deferred to 4b) | Chair synthesis | PLAN-4a §T2 |
| MF-7 | L-0348 3rd occurrence: pre-DROP grep gate promoted from "recommended" to mandatory skill rule | Harness observation | PLAN-4a §Pre-flight gate; skill update |
| MF-8 | L-NEW phantom-display class named; i18n fallback = neutral string; HANDOFF deferred-section required | Harness §3 + Visual+UX | PLAN-4b §4b.8 (HANDOFF), PLAN-4a §T4 |

---

## Prior PLAN-4 council blockers folded into PLAN-4b

These were pre-council amendments (MF-Prior-1 through MF-Prior-7) raised by Steward
and Supervisor before the Phase 5 session, and are incorporated into PLAN-4b:

| MF-Prior | Amendment | Applied to |
|----------|-----------|------------|
| MF-Prior-1 | Trigger rewrite: DROP TRIGGER + CREATE TRIGGER (not just CREATE OR REPLACE FUNCTION); `OF location_id` clause must NOT appear in new trigger | PLAN-4b §4b.2 |
| MF-Prior-2 | Typegen target: `packages/supabase/src/database.types.ts` (NOT `/dist/`) | PLAN-4b §4b.4 |
| MF-Prior-3 | JOURNEY AC required: `docs/journeys/JOURNEY-adr-0430-shift-zone-m2m.md` per CLAUDE.md close-feature gate | PLAN-4b §4b.7 |
| MF-Prior-4 | HANDOFF deferred-enforcement section: Rule 9 gate-RPC dead-letter + 3-layer defense (carryover from PLAN-3 MF-A) | PLAN-4b §4b.8 |
| MF-Prior-5 | `fk_profile_location` explicit DROP CONSTRAINT before column drop in M4 migration | PLAN-4b §4b.3 |
| MF-Prior-6 | Mobile hook naming: `use-shift-session.ts` kebab-case in `packages/data/src/day-session/` | PLAN-4b §4b.1 |
| MF-Prior-7 | `docs/domains/day-session/DATA-MODEL.md:~343` drop-candidate annotation removal in spine refresh | PLAN-4b §4b.6 |

---

## Knowledge captured

### L-0348 — 3rd occurrence promotion (skill update)

The pre-DROP grep gate (`grep -rn "\.zone\b" ... | grep -v "zone_id|zone_ids|shift_zone|\.zones"`)
was first mandated in PLAN-1 (1st occurrence), applied in PLAN-2 (2nd occurrence), and
now surfaces as a blocking pre-condition for PLAN-4a (3rd occurrence). Three occurrences
meets the promotion threshold: this gate is now a **mandatory skill rule** for any
`DROP COLUMN` migration on a text-shaped column that may appear in display sites.

Action: update `~/.claude/skills/smartout-cascade-developer/SKILL.md` to include
the pre-grep gate as a required step under "Before any DROP COLUMN migration."

### L-NEW — Phantom-display class

After a text column is replaced by a join-resolved array, historical rows that could
not be backfilled (M3 skipped rows) will show `null` on the first-zone sites. This
is correct behavior, not a regression. The class of bugs where "display shows nothing
after M4" is not a code error but a data gap.

Mitigation: i18n fallback string (`t("schedule.no_zone")` → "–" or "Ingen sone")
ensures the UI is not silently blank. Document in HANDOFF so future debuggers know
to check `shift_zone` row existence before investigating the display code.

Sibling class: L-0176 (docstring without emit wiring), L-0177 (silent fallback class).

---

## ADR cross-references

- **ADR-0430** — primary decision; Rules 1–9 are the load-bearing constraints this
  council refined.
- **ADR-0367** — D6 tri-layer model; `shift_zone` is a refinement subordinate to
  `shift_session_day_line` per v1.1.
- **ADR-0173** — Frozen-4 capability boundaries; capability tools must not cross
  namespace writes without Pattern B delegation fields.
- **ADR-0356** — Cross-namespace delegation symmetry; `timeline-template` writing
  `shift_zone` rows requires `actor_capability: "schedule"` + `delegated_via:
  "timeline-template"` emit fields (already closed in PLAN-3).

---

## Outcome

**Final verdict: 5/5 APPROVE Option A — funnel-first mapper rewrite with 8 MF amendments.**

Split PLAN-4 into:
- **PLAN-4a** — Zone render readback (42 sites, mapper funnel, pre-grep gate, +2–3 h)
- **PLAN-4b** — Mobile + M4 + typegen + spine + JOURNEY + HANDOFF (+6–9 h)

Dispatch PLAN-4a first. PLAN-4b blocked on PLAN-4a AC-4a.8 (pre-grep gate = 0) and
AC-4a.9 (typecheck GREEN).
