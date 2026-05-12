---
title: "Audit Slice 12 — i18n + Frontmatter Convention Check"
status: complete
created: 2026-05-10
updated: 2026-05-10
module: meta
tags: [audit, i18n, frontmatter, conventions, 2026-05-10]
---

# Audit Slice 12 — i18n + Frontmatter Convention Check

**Method:** Convention-check against CLAUDE.md rules
**Surface sampled:** `apps/web/src/**/*.tsx` (1 072 files total; Norwegian-text grep full sweep), `docs/**/*.md` (targeted: top-level HANDOFF/JOURNEY/PLAN/STATE/DASHBOARD, `decisions/`, `learnings/`, `journeys/` top-level)
**Auditor:** claude-sonnet-4-6 | **Date:** 2026-05-10
**Known-FPs skipped:** none declared for this slice

---

## Findings

### F-IF-01 — CRITICAL | Hardcoded Norwegian text is the dominant pattern, not the exception

**Severity:** HIGH (convention violation — systematic, not isolated)

**Evidence:**

| Metric | Count |
|--------|-------|
| Total non-test TSX files | 1 072 |
| Files containing Norwegian characters (æøå) | 332 (31 %) |
| Files using `@smartout/i18n` import | 164 (15 %) |
| Files with Norwegian text but NO i18n import | 298 (28 %) |

Hardcoded Norwegian text is present in 298 TSX files that have no i18n import at all. This is not scattered noise — it is the established coding pattern across the codebase. The i18n package (`@smartout/i18n` — `useTranslation` hook) exists and works; `UnsavedChangesGuard.tsx` is the canonical correct usage. But it is the minority pattern.

**Representative violation cluster (day-control surface — all Phase E era):**

| File | Line | Hardcoded string |
|------|------|-----------------|
| `apps/web/src/components/day/AddTaskDialog.tsx` | 104 | `"Oppgave lagt til. Loggført i revisjonsloggen."` |
| `apps/web/src/components/day/AddTaskDialog.tsx` | 249 | `` `${remaining} tegn igjen før du kan lagre.` `` |
| `apps/web/src/components/day/EventDetailPanel.tsx` | 281 | `"Marker som ferdig"` / `"Gjenåpne"` |
| `apps/web/src/components/day/EventDetailPanel.tsx` | 294 | `"Skriv en kort oppsummering..."` |
| `apps/web/src/components/day/tabs/SignoffTab.tsx` | 181 | `"etter oppgjør"` (×3) |
| `apps/web/src/components/day/tabs/RosterTab.tsx` | 544 | `"Tidsregistrering lagret. Loggført i revisjonsloggen."` |
| `apps/web/src/components/day/WebDayControl.tsx` | 54 | `NORWEGIAN_DAYS = ["Søndag", "Mandag", ...]` array |
| `apps/web/src/components/day/SessionActionsBar.tsx` | 32 | `"Send til oppgjør"`, `"Gjenåpne"` |
| `apps/web/src/components/dashboard/StrategicView.tsx` | 127 | `"Opplæringsberedskap"`, `"Fraværsrate"`, etc. |
| `apps/web/src/components/dashboard/OnboardingGuide.tsx` | 103 | Full Norwegian paragraph strings |
| `apps/web/src/app/dashboard/reconciliation/_components/DayList.tsx` | 39–42 | Status label map hardcoded in Norwegian |
| `apps/web/src/app/dashboard/settings/_components/ChangeProposalDialog.tsx` | 70 | Conditional Norwegian string |

**Phase E new components (voice-assistant surface):**

| File | Line | Hardcoded string |
|------|------|-----------------|
| `apps/web/src/components/voice-assistant.tsx` | 296 | `"Klar til å starte samtale"` |
| `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | 596 | Norwegian demo/placeholder string |

**Welcome wizard steps (Phase E era, user-facing):**

| File | Line | Hardcoded string |
|------|------|-----------------|
| `apps/web/src/components/welcome-wizard/steps/PersonalNumberStep.tsx` | 37, 55, 62 | Toast errors + body text |
| `apps/web/src/components/welcome-wizard/steps/AddressStep.tsx` | 47, 58, 59, 70 | Toast + heading + label |
| `apps/web/src/components/welcome-wizard/steps/ContactStep.tsx` | 43 | Toast error |

**Pattern:** Components that have i18n imports use the hook correctly. Components added without i18n imports default to hardcoded strings. No linter enforces the rule at file-creation time.

**Note:** This finding is codebase-wide and pre-dates this campaign. The campaign has not meaningfully worsened or improved the ratio. The Day Control surface (Phase E era) follows the pre-existing pattern.

---

### F-IF-02 — MEDIUM | `module` field missing from majority of ADR frontmatter (pre-ADR-0179)

**Severity:** MEDIUM (convention gap — legacy ADRs pre-date the field requirement)

**Evidence:** Scanning `docs/decisions/` reveals:

- ADRs 0001–0016: missing `module` and `tags` — no field in frontmatter at all
- ADRs 0017, 0020, 0026–0028: also missing `updated`, `created`
- ADRs 0021, 0029, 0179, 0180: missing `created`, `module`, `tags`
- Recent ADRs (0280–0282): `module` field is absent but all other required fields present

**Sample — ADR-0282 (Phase E, accepted 2026-05-10):**
```yaml
title: "Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed"
id: ADR-0282
status: accepted
created: 2026-05-04
updated: 2026-05-10
# module: MISSING
# tags: MISSING
```

**Phase E ADRs missing `module`:** ADR-0280, ADR-0281, ADR-0282 — all three lack both `module` and `tags` fields despite being freshly written.

**Pattern:** ADR template (`docs/templates/decision.md`) likely does not include `module` and `tags` as mandatory fields. The field requirement comes from CLAUDE.md but is not enforced at template level.

---

### F-IF-03 — LOW | Several HANDOFF docs missing `status`, `updated`, `created` fields

**Severity:** LOW (lifecycle field gaps in closed handoffs)

**Evidence:** The following top-level HANDOFF docs have incomplete frontmatter:

| File | Missing fields |
|------|---------------|
| `docs/HANDOFF-contract-composition-engine.md` | `status`, `updated`, `created`, `tags` |
| `docs/HANDOFF-employee-page.md` | `status`, `updated`, `created`, `tags` |
| `docs/HANDOFF-arbeidstilsynet-mcp.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-botsson-arena-c3-1-onboarding-reduced-motion.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-lovdata-mcp.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-lovsen-foundation.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-mattilsynet-mcp.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-nho-reiseliv-mcp.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-publish-mission-body.md` | `status`, `updated`, `created` |
| `docs/HANDOFF-welcome-mission-rework.md` | `status`, `updated`, `created` |

**Pattern:** These HANDOFFs use a `closed:` field instead of `status: done` + `updated:`. The `closed:` field is non-standard against the CLAUDE.md schema. The MCP/Lovsen campaign HANDOFFs are the main cluster.

**Phase E docs (for specific audit check):**
- `docs/journeys/HANDOFF-phase-e-cutover.md` — COMPLETE. Has all 6 required fields.
- `docs/journeys/JOURNEY-phase-e-cutover.md` — COMPLETE. Has all required fields (no `module` variant used, `feature:` substitutes contextually).
- `docs/learnings/0231-service-dockerfile-drift-from-package-json-deps.md` — COMPLETE. Has `id`, `title`, `type`, `status`, `created`, `updated`, `tags`.
- `docs/HANDOFF-pre-phase-e-foundation.md` — COMPLETE except missing `module` field (has `campaign:` as a substitute).

---

### F-IF-04 — LOW | `docs/learnings/0000-learning-log.md` has triplicate `updated` keys and duplicate other fields

**Severity:** LOW (YAML structural defect — parse behavior undefined)

**Evidence:** `docs/learnings/0000-learning-log.md` lines 4–15:

```yaml
---
title: Learning Log
status: in_progress
updated: 2026-04-23          # ← first updated
last-reconciled: 2026-04-23
updated: 2026-05-05          # ← second updated (duplicate key)
last-reconciled: 2026-05-05
created: 2026-03-26
module: schedule
tags: [learnings, authority, adr-0099, adr-0189]
updated: 2026-04-20          # ← third updated (duplicate key)
last-reconciled: 2026-04-20
created: 2026-03-26          # ← second created (duplicate key)
module: schedule             # ← second module (duplicate key)
tags: [learnings]            # ← second tags (duplicate key)
---
```

**Cause:** Multiple reconcile passes appended new frontmatter blocks without removing the prior ones. In YAML, duplicate keys are undefined behavior (last-value or parser-dependent). The `updated:` field most parsers see is `2026-04-20`, which is older than the file's actual last edit.

---

### F-IF-05 — INFO | `STATE-SUMMARY.md` and `INDEX.md` missing `status`, `created`, `module` fields

**Severity:** INFO (operational docs, not lifecycle-tracked)

**Evidence:**

- `docs/STATE-SUMMARY.md`: has `title` and `updated` but missing `status`, `created`, `module`, `tags`
- `docs/INDEX.md`: has `title` but missing `status`, `created`, `module`, `tags`

These are operational/meta files updated frequently. The `derived-from:` field in STATE-SUMMARY suggests the author knew it was non-standard but chose brevity over completeness. Low impact — they are not referenced by tooling.

---

### F-IF-06 — INFO | Phase E docs correctly placed in `docs/journeys/` not `docs/` root

**Severity:** INFO (positive finding)

HANDOFF-phase-e-cutover.md and JOURNEY-phase-e-cutover.md were correctly placed in `docs/journeys/` (not dropped at `docs/` root as has sometimes happened). Both have complete frontmatter. This is the correct pattern established by the close-feature script.

---

## Summary Table

| ID | Severity | Finding | Files affected |
|----|----------|---------|---------------|
| F-IF-01 | HIGH | Hardcoded Norwegian text — 298 TSX files have Norwegian without i18n import; systematic, not isolated | 298 |
| F-IF-02 | MEDIUM | `module` + `tags` absent from most ADRs, incl. Phase E ADRs 0280–0282 | ~120+ decision files |
| F-IF-03 | LOW | HANDOFF cluster using non-standard `closed:` instead of `status:` + `updated:` | 10 |
| F-IF-04 | LOW | `0000-learning-log.md` has triplicate `updated:` and duplicate `created:`, `module:`, `tags:` keys | 1 |
| F-IF-05 | INFO | `STATE-SUMMARY.md`, `INDEX.md` missing 3–4 required frontmatter fields | 2 |
| F-IF-06 | INFO | Phase E cutover docs correctly placed and fully formed | — positive |

---

## Remediation Notes

**F-IF-01** — Not remediable in a single sortie. Recommended approach: add an ESLint rule or custom lint step that flags string literals containing `/[æøåÆØÅ]/` inside JSX return statements and attribute values, excluding test files and comment strings. Prioritize Day Control and Welcome Wizard surfaces as they are user-facing and actively developed.

**F-IF-02** — Update `docs/templates/decision.md` to include `module:` and `tags:` fields. Backfill for ADR-0280, ADR-0281, ADR-0282 is a 5-minute fix. Legacy ADRs (0001–0028) can be batched in a dedicated chore commit.

**F-IF-03** — The `closed:` field should be replaced with `status: done` + `updated: <date>` when these HANDOFFs are next touched. Non-blocking.

**F-IF-04** — The `0000-learning-log.md` frontmatter needs a manual clean-up to deduplicate keys (keep most recent values). Non-blocking but causes incorrect `updated` reporting.
