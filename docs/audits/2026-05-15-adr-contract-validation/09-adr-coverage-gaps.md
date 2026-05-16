---
title: "Slice 09 — ADR Coverage Gaps"
status: done
created: 2026-05-15
updated: 2026-05-15
module: adr-governance
tags: [audit, adr-coverage, drift]
---

# Slice 09 — ADR Coverage Gaps

**Auditor:** agent (sonnet)  
**Date:** 2026-05-15  
**Scope:** All ADRs NOT covered by the other 13 slices (256 of 329 total ADRs).  
**Method:** Frontmatter sanity pass + targeted code grep on known-drift candidates from 2026-05-13 baseline.

---

## Summary

| Metric | Count |
|--------|-------|
| Total ADR files | 329 |
| Covered by other slices | 70 |
| This slice scope | 256 |
| Non-standard status values | 16 |
| Capital-A "Accepted" (case drift) | 13 |
| Future-dated `created:` field | 1 |
| `id` / filename mismatches | 2 |
| Proposed ADRs ≥ 30 days | 1 |
| Proposed ADRs ≥ 15 days | 28 |
| Claims-with-no-code confirmed | 4 |

**Top findings:**

1. **ADR-0260 (Cabinet Grotesk)** — `proposed`, font never implemented. `tokens.ts` and `globals.css` still reference Instrument Serif. 17 days stale.
2. **ADR-0053 (Simulator service)** — `proposed` 53 days, oldest unresolved ADR. No `services/simulator/` directory, no simulation schema migration exists.
3. **ADR-0273 (Deviation server-action)** — `created: 2026-05-25`, 10 days in the future. ADR is proposed against a future date; cannot have been accepted on today's development HEAD.

---

## ADR Drift Table

| ADR | Status | Claim | Reality | Gap |
|-----|--------|-------|---------|-----|
| ADR-0053 | proposed | Dedicated `services/simulator/` Hono microservice + simulation schema | No `services/simulator/` dir. No simulation migration. Only design specs in `docs/superpowers/specs/`. | Not started — oldest proposed ADR at 53 days |
| ADR-0056 | `done` | Cascade Core Foundation schema shipped | Schema migrations verified shipped (A1/A2 tiers). | Status enum non-canonical. Should be `accepted` or `superseded`. |
| ADR-0137 | `draft` | Gate action stacking semantics | ADR-0203 and ADR-0287 cover this territory but do not explicitly supersede 0137. ADR-0203 references 0137 as a `related` dependency (still live). | Draft status is accurate; not superseded by any single ADR. No code drift — claim is architecture spec. |
| ADR-0138 | `draft` | Tool result contract with gate outcomes | ADR-0203 extends 0138 as a dependency. 0138 still referenced as live contract basis. | Draft status is accurate. ADR-0203 builds on it, not replaces it. Baseline's "superseded by 0207" is incorrect — 0207 covers call-gate unification, not tool result shape. |
| ADR-0139 | `draft` | `--color-proposed` CSS token + pending-state UX | Zero hits: `--color-proposed` absent from `globals.css` and `packages/design-tokens/src/tokens.ts`. | Token never implemented. Draft ADR, claim unverified. |
| ADR-0152 | `proposed` | `activity-trail` provider fail-fast on missing IDs | `packages/telemetry/src/providers/activity-trail.ts:58` does early-return with `console.warn` on null actor/workspace (not throw). ADR-0193 adds `NonEmptyString` brand but does not change the early-return behavior. | Proposed state accurate — not implemented. Baseline's "superseded by 0193" is incorrect; 0193 amends ADR-0134 (type branding), not this provider behavior. |
| ADR-0220 | `accepted` | Botsson components live at `apps/web/src/components/botsson/` | `apps/web/src/components/botsson/` does not exist on disk. | Surface-text drift. ADR describes architectural position (front door vs orchestrator), not a directory mandate. Directory absence may be fine if Botsson is composed differently. Low severity. |
| ADR-0260 | `proposed` | Cabinet Grotesk replaces Instrument Serif as `font-heading` | `apps/web/src/app/globals.css:111` — `--font-heading: var(--font-instrument-serif)`. `packages/design-tokens/src/tokens.ts:206` — `heading: "'Instrument Serif', Georgia, serif"`. Zero Cabinet Grotesk hits. | Not implemented. Proposed 17 days ago. Design decision pending. |
| ADR-0273 | `proposed` | Deviation + Day-Info server action migration | `created: 2026-05-25` — future-dated by 10 days (today: 2026-05-15). | Frontmatter date error. ADR may be written ahead of implementation scheduled for a future sortie. |
| ADR-0274 | `proposed` | Mission run contract — per-step durability, lease, recovery | No `mission_run` table found in any migration. | Not implemented. Proposed. Welcome Mission V0 depends on this ADR. |
| ADR-0278 | `proposed` | Repo governance protocol — retention rules + automated cleanup | No governance workflow in `.github/workflows/`. No heartbeat job referencing retention thresholds. | Not implemented. Proposed 10 days ago. |
| ADR-0279 | `proposed` | Booking-create full stack | `id: ADR-0271` in frontmatter — frontmatter ID predates file rename. | ID/filename mismatch: file is `0279-booking-create-stack.md`, id field says `ADR-0271`. |
| ADR-0283 | `accepted` | Task create via mobile BFF wrap | `id: ADR_0266` in frontmatter, title in body says `ADR-0278`. File is `0283-task-mobile-bff-wrap.md`. | Triple mismatch: filename (0283) ≠ frontmatter id (0266) ≠ body title (0278). Renumber drift artifact. |

---

## Frontmatter Sanity

### Non-canonical status values

| Value | Count | ADRs | Fix |
|-------|-------|------|-----|
| `Accepted` (capital A) | 13 | 0017, 0020, 0021, 0026, 0027, 0028, 0029, 0206, 0207, 0208, 0209, 0210, 0211 | Normalize to `accepted` |
| `done` | 1 | 0056 | Normalize to `accepted` or `superseded` |
| `canonical` | 1 | 0000 (decision log index) | Acceptable — index file, not an ADR |
| `deferred` | 1 | 0250 | Acceptable |
| `derived` | 1 | (non-critical) | Check if valid |

Canonical lowercase enum: `proposed`, `accepted`, `superseded`, `draft`, `deferred`.

### ID / filename mismatches

| File | Frontmatter ID | Likely cause |
|------|---------------|-------------|
| `0279-booking-create-stack.md` | `ADR-0271` | Renumbered from 0271 → 0279, frontmatter not updated |
| `0283-task-mobile-bff-wrap.md` | `ADR_0266` (body: `ADR-0278`) | Multiple renumbers; frontmatter and body both stale |

### Future-dated `created:` field

| ADR | `created:` | Days ahead |
|-----|-----------|------------|
| ADR-0273 | 2026-05-25 | +10 days |

---

## Proposed-Aging Table (≥ 10 days)

| ADR | Days | Topic |
|-----|------|-------|
| ADR-0053 | 53 | Simulation schema + simulator service |
| ADR-0136 | 28 | (camera evidence — covered by other slice) |
| ADR-0135 | 28 | (voice phase plan — covered by other slice) |
| ADR-0124–0122 | 28 | Agent routing group |
| ADR-0152 | 26 | activity-trail fail-fast |
| ADR-0153–0155 | 26 | Agent authority group |
| ADR-0167 | 25 | Proposed |
| ADR-0183, 0191 | 23 | Proposed |
| ADR-0288, 0286 | 22 | Proposed |
| ADR-0205 | 21 | Proposed |
| ADR-0260 | 17 | Cabinet Grotesk font |
| ADR-0231, 0230, 0229, 0227, 0226–0218 | 17 | April-28 batch proposals |
| ADR-0238–0241, 0244–0248, 0252–0253, 0255 | 15–16 | April-29/30 batch proposals |
| ADR-0264 | 13 | Cross-company audit destination |
| ADR-0274, 0275, 0277–0280, 0284, 0266–0267, 0269–0273 | 11 | May-4 batch |
| ADR-0278, 0289 | 9–10 | Governance + voice policy |
| ADR-0273 | future-dated | Deviation server-action |

**Only ADR-0053 exceeds the 30-day threshold** (53 days). All others are between 1–28 days.

---

## Per-ADR Verdict (Key ADRs)

| ADR | Verdict | Action |
|-----|---------|--------|
| ADR-0053 | STALE/UNSTARTED | Decide: implement simulator or mark superseded. 53 days without movement. |
| ADR-0056 | FRONTMATTER-DRIFT | Normalize `status: done` → `status: accepted`. |
| ADR-0137 | NO-ACTION | Draft status correct. Still live dependency of ADR-0203. |
| ADR-0138 | NO-ACTION | Draft status correct. ADR-0203 builds on it. Not superseded. |
| ADR-0139 | UNIMPLEMENTED | `--color-proposed` token missing. Low urgency (draft). |
| ADR-0152 | PROPOSED-ACCURATE | Not implemented, not superseded. Status correct. |
| ADR-0220 | LOW-DRIFT | Directory claim not load-bearing. ADR is about conceptual position. |
| ADR-0260 | UNIMPLEMENTED | Font change not applied. Design decision still pending. |
| ADR-0273 | FRONTMATTER-ERROR | `created:` date is 10 days in the future. Fix to 2026-05-15. |
| ADR-0274 | PROPOSED-ACCURATE | Mission run contract not implemented. Accurate proposed status. |
| ADR-0278 | PROPOSED-ACCURATE | Governance protocol not automated. Accurate proposed status. |
| ADR-0279 | ID-MISMATCH | Frontmatter `id` stale from pre-rename. Update to `ADR-0279`. |
| ADR-0283 | ID-MISMATCH | Triple mismatch. Set `id: ADR-0283`, update body heading. |

---

## Delta vs 2026-05-13 Baseline

| Baseline Finding | Status |
|-----------------|--------|
| ADR-0041 superseded but legacy files still importable (F-OB-10-01 CLOSED 2026-05-13) | CONFIRMED CLOSED. `0041` status is `superseded`, updated 2026-05-13. |
| ADR-0053 proposed 36 days | NOW 53 DAYS. No change. Still most stale proposed ADR. |
| ADR-0056 status "done" — normalize to `accepted` | STILL OPEN. Status unchanged. |
| ADR-0137/0138 draft, effectively superseded by 0203/0207/0287 | PARTIALLY INCORRECT. ADR-0203 references 0138 as a live dependency, not a replacement. 0137 is a gate-stacking spec that neither 0203 nor 0287 supersede. Status `draft` is correct. |
| ADR-0139 token unverified | CONFIRMED MISSING. `--color-proposed` has zero codebase hits. |
| ADR-0152 proposed but effectively superseded by 0193 | INCORRECT. ADR-0193 amends type branding (ADR-0134), not the early-return behavior this ADR targets. ADR-0152 status `proposed` is accurate. |
| ADR-0220 accepted; no apps/web/src/components/botsson/ | CONFIRMED MISSING. Directory still absent. Low severity. |
| ADR-0260 proposed Cabinet Grotesk: zero hits | CONFIRMED. Still zero hits. 17 days proposed. |
| ADR-0273 future-dated created: 2026-05-25 | CONFIRMED. 10 days in future. |
| ADR-0274/0278 proposed; mission_run absent; governance workflow absent | CONFIRMED. Neither implemented. |
| 12 ADR files frontmatter "Accepted" (capital A) | NOW 13 (ADR-0029 also has capital A — was previously missed). |

**New finding not in baseline:**
- ADR-0279 and ADR-0283 have stale `id:` fields from renumber operations.
