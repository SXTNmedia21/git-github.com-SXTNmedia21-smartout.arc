---
title: "ADR Audit Slice 08 — Journeys"
status: done
updated: 2026-05-15
created: 2026-05-15
module: journey
tags: [audit, journeys, missions, adr]
auditor: sonnet-subagent
baseline: 2026-05-13
---

# ADR Audit Slice 08 — Journeys

**Date:** 2026-05-15 | **Branch:** development HEAD | **Baseline:** 2026-05-13

---

## Summary

ADR-0031 (Journey Portal System) and ADR-0038 (Journey Agent & Output Generators) are largely implemented. The portal UI, wizard agent, all 4 output generators, and `wizard_session` table exist. The 68-journey seed is present in `seed.sql` but **not in a migration file** — this is the persisting F-JR-NEW-02 gap. F-JR-02 (`UltravoxVoice` type) is **still present** in `packages/ai/src/missions/types.ts` despite ADR-0282 marking Ultravox removed and ADR-0304 (proposed) mandating cleanup. Both findings carry over from the 2026-05-13 baseline unchanged.

**Severity counts:** 1 HIGH · 1 LOW · 0 CRITICAL

---

## Findings Table

| ID | Severity | ADR | File:Line | Description |
|----|----------|-----|-----------|-------------|
| F-JR-NEW-02 | HIGH | ADR-0031 | `supabase/seed.sql:400–end` | 68 journeys seeded in `seed.sql` only — no migration file. `supabase db push` (production) does not apply seed data; only `supabase db reset` (local dev) does. ADR-0031 explicitly calls this a "seed migration" of 68 rows. |
| F-JR-02 | LOW | ADR-0282, ADR-0304 | `packages/ai/src/missions/types.ts:15,19,35,67` / `packages/ai/src/missions/index.ts:1` | `UltravoxVoice` type exported and used across 3 fields in `AgentMission`, `MissionStageOverride`, `MissionManifestEntry`. Ultravox runtime removed (ADR-0282 accepted 2026-05-10); ADR-0304 (proposed) requires deletion by sortie close. Type still present in `dist/` as well. |

---

## Per-ADR Rollup

### ADR-0031 — Journey Portal System

| Requirement | Status | Evidence |
|-------------|--------|---------|
| 4 tables: `journey`, `journey_step`, `journey_event`, `journey_test_run` | PASS | `20260301140000_journey_system.sql` |
| 13-status lifecycle with validated transitions | PASS | Enum in migration |
| Portal UI at `/platform-admin/journeys` | PASS | `apps/web/src/app/platform-admin/journeys/page.tsx` |
| Detail page at `/platform-admin/journeys/[id]` | PASS | `apps/web/src/app/platform-admin/journeys/[id]/page.tsx` |
| 68 journeys seeded | **GAP** | In `seed.sql` only — not in a migration. Production DB has no seed data. |
| RLS: godmode + workspace read | PASS | Migration includes RLS policies |
| Seeds from `JOURNEY_REGISTRY.md` | PASS | `docs/architecture/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md` has 68 entries matching J-001…J-068 |

**Verdict:** Phase 1 MOSTLY COMPLIANT. Seed gap (F-JR-NEW-02) remains open.

### ADR-0038 — Journey Agent & Output Generators

| Requirement | Status | Evidence |
|-------------|--------|---------|
| `wizard_session` table | PASS | `20260301500000_journey_wizard_session.sql` |
| `/api/journey-agent` route | PASS | `apps/web/src/app/api/journey-agent/route.ts` |
| `runJourneyAgent()` in `packages/ai/src/agents/journey.ts` | PASS | File exists, 6-phase system prompt confirmed |
| 3 tools: `lookup_journeys`, `check_duplicates`, `save_draft` | PASS | `packages/ai/src/tools/journey/` |
| 4 output generators: E2E, Doc, Linear, Botsson | PASS | `packages/ai/src/generators/journey-{e2e,doc,linear,botsson}.ts` all present |
| Output tabs on detail page | PASS | `journey-detail-client.tsx:5` explicitly mentions "output generation tabs (E2E, Doc, Linear, Botsson)" |
| Wizard UI at `/platform-admin/journeys/wizard` | PASS | `apps/web/src/app/platform-admin/journeys/wizard/page.tsx` |
| Session persistence in `wizard_session.messages` | PASS | Schema confirmed |

**Verdict:** Phase 2 FULLY COMPLIANT.

---

## Verified Intentional

- **381 JOURNEY-\*.md files in `docs/journeys/`** — These are feature-scope journey narrative docs written at feature close, not the 68 registry journeys. The two systems serve different purposes: `docs/journeys/` = developer audit trail; `journey` table = journey portal tracking.

- **`journey_version` table** (migration `20260516000000`) — Phase 3 extension adding versioned JourneyIR snapshots. ADRs 0171, 0172, 0175 cover this. Not in scope of ADR-0031/0038 but related. Implementation is complete (4-migration atomicity pattern per L-0075).

- **`journey_guide` table** (migration `20260518230001`) — ADR-0217. Separate storage for user-guide artefacts. Intentional extension of journey system, not a gap.

- **4 journeys linked to `engine_process`** — ADR-0031 Phase 1 + Phase 2 seed gates satisfied. J-001 (onboarding), J-011 (check-my-schedule), J-004 (trainee core), J-ONBOARD-001 all have `engine_process_id` set via migrations.

- **`docs/journeys/JOURNEY-*.md` not in site-map.json** — These are developer-facing docs, not Botsson harness pages. No registration required.

---

## In-Progress

- **ADR-0304** (status: `proposed`) — "Superseded ADRs MUST delete code at sortie close." This formalizes the F-JR-02 cleanup requirement. Not yet accepted; cleanup blocked until ADR-0304 is accepted or a targeted sortie is opened.

- **Journey Portal Phase 3** (ADR-0031 + ADR-0038) — Linear sync, automated test runs, and auto-generation on status change are declared "planned" in both ADRs. No implementation found. Intentional deferral.

- **E2E coverage for journey portal itself** — `apps/e2e/tests/journey-full-wizard-flow.spec.ts` covers the join/onboarding/setup wizard, not the platform-admin journey portal. 38 other `journey-*.spec.ts` files cover specific user journeys. No dedicated spec for the journey portal wizard at `/platform-admin/journeys/wizard`.

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---------|-----------|-----------|--------|
| F-JR-NEW-02 — 68 journeys not in migration | HIGH open | HIGH open | No change. `seed.sql` still the only location. |
| F-JR-02 — `UltravoxVoice` type | open/degraded (5 sites) | open — 5 occurrences in `src/` (3 in types.ts, 1 in index.ts + comment in botsson-provider.tsx:42) | No change. ADR-0304 proposed but not accepted. |
| ADR-0038 generators | unverified | PASS — all 4 present and wired | Positive delta |
| ADR-0038 wizard agent | unverified | PASS — confirmed in agents/journey.ts | Positive delta |
| journey portal UI | unverified | PASS — portal, detail, wizard pages all exist | Positive delta |

**Net delta:** No new findings. 2 baseline findings remain open. Positive confirmation that ADR-0038 Phase 2 is fully delivered.
