---
title: "ADR-Contract Audit — Slice 08: Journeys"
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, journeys, adr]
---

# Slice 08 — Journeys

**ADRs in scope:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)
**Surfaces audited:** `docs/journeys/`, `packages/ai/src/journey/`, `packages/ai/src/missions/`, `apps/e2e/`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 2 |
| MEDIUM   | 2 |
| LOW      | 1 |

---

## Findings

### H-001 — `SEASON_LIFECYCLE_MISSION_ID` ("season-lifecycle") absent from `MissionIdSchema` enum

**File:** `packages/ai/src/missions/registry.ts:5` + `packages/ai/src/missions/types.ts:3`
**ADR:** ADR-0031 (mission registry as single source of truth for agent IDs)
**Evidence:** `MISSIONS` object in `registry.ts` has keys `["onboarding-interview", "landing-demo", "lise-interview", "mr-botsson", "haccp-inspector", "shift-assistant", "botsson-session"]`. `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` is exported from `registry.ts` line 5 and is used as a live `mission_id` value in `services/stage-engine/src/core/stage-manager.ts` and `calendar-guardian.ts`, but it is not present in `MissionIdSchema` (the Zod enum) in `types.ts` nor as a key in `MISSIONS`. Any code path that calls `getMission("season-lifecycle")` returns `undefined`. The `mission_id` column is typed as `string` in DB calls at the call site, so TypeScript does not catch this — it is a silent runtime gap. `MISSION_MANIFEST` is also missing the entry.

---

### H-002 — 170 of 290 JOURNEY files use non-canonical heading format

**File:** `docs/journeys/JOURNEY-*.md` (170 files)
**ADR:** ADR-0031 (journey definitions must follow canonical format — `## Journey: [Role] [Action]` with Precondition / steps / Postcondition / Error paths)
**Evidence:** `grep -rL "^## Journey:"` returns 170 files. Observed alternatives: `## Journey 1:`, `## Happy Path`, `## Error Paths`, `## Journey 1 — ...`, `## Roles touched`, plain `# Journey:`. Payroll journeys shipped today (JOURNEY-payroll-phase-*) use `# Journey:` (h1, not h2) as primary heading. The canonical format (`## Journey:`) is the toolchain contract — `generateE2ETest()` and `generateLinearSpec()` in `packages/ai/src/generators/` parse journey docs to produce output. Non-canonical headings break generator input parsing and prevent automated output generation from these files.

**Note:** JOURNEY-payroll-* files and JOURNEY-e2e-nyheter-stabilize are active-campaign (in-progress); mark those in-progress. The remaining ~155 older non-payroll files are long-standing drift.

---

### M-001 — JOURNEY_REGISTRY.md referenced in ADR-0031 does not exist at the stated path

**File:** `docs/decisions/0031-journey-portal-system.md` (§ Rules & Consequences)
**ADR:** ADR-0031
**Evidence:** ADR-0031 states "the system seeds from JOURNEY_REGISTRY.md, creating a single source of truth." The file does not exist at `docs/JOURNEY_REGISTRY.md` or any project root. Two files exist at non-canonical paths: `docs/engines/system-intelligence/journey-engine/SMARTOUT_JOURNEY_REGISTRY.md` and `docs/architecture/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md`. The seed migration (`supabase/seed.sql`) does include 68 journey INSERTs and is the de-facto source of truth. ADR text is stale and the named file is absent — the seed-from-REGISTRY_MD contract is broken as written.

---

### M-002 — `journey/compile.ts` and `journey-ops/` located outside the module boundaries described in ADR-0038

**File:** `packages/ai/src/journey/compile.ts`, `packages/ai/src/journey-ops/`
**ADR:** ADR-0038 (architecture: agent in `agents/journey.ts`; output generators as pure functions; no third layer described)
**Evidence:** ADR-0038 defines two packages-level modules: `packages/ai/src/agents/journey.ts` (agent, confirmed present) and `packages/ai/src/generators/` (pure functions, confirmed present with all 4 generators). `journey/compile.ts` (engine-runtime compiler: journey → `engine_process` structs) and `journey-ops/` (contains `runbook.ts`) are additional modules not described in the ADR architecture diagram. `compile.ts` is functionally distinct from the ADR-0038 generators (it converts portal definitions to engine runtime, not to doc/test/linear/botsson output), so the concern is documentation drift rather than behavioral violation. However, the ADR architecture block does not account for these paths, meaning future agents cannot trust the ADR as an accurate map of the package.

---

### L-001 — `journey_test_run` table exists in migration but no E2E harness writes to it

**File:** `supabase/migrations/20260301140000_journey_system.sql` (table `journey_test_run`)
**ADR:** ADR-0031 (§ Schema — `journey_test_run`: E2E test execution history, Phase 2+)
**Evidence:** `journey_test_run` was created in the Phase 1 migration. ADR-0031 marks it as "Phase 2+" and ADR-0038 explicitly defers automated test runs to Phase 3. The `apps/e2e/` suite has no spec that INSERTs into `journey_test_run`. The table is intentionally dormant (by ADR phase plan). No immediate action required — tracking as LOW to confirm when Phase 3 activates the table.

---

## Active-Campaign Annotations

- `JOURNEY-payroll-phase-*.md` (25 files) — shipped today on `campaign/payroll`; non-canonical `# Journey:` heading is **in-progress** (H-002 scope includes these but they are expected to be revised in campaign).
- `JOURNEY-e2e-nyheter-stabilize-*.md` / `JOURNEY-nyheter-engagement-wave-a-*.md` — active feat/e2e-nyheter-stabilize + feat/nyheter-engagement-wave-a campaigns; e2e coverage present in `apps/e2e/komm-nyheter/`.
- `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` — `lise-interview` mission restored to `MissionIdSchema` enum today (confirmed in types.ts); e2e deferred to Phase F sortie 4 (noted in frontmatter).

---

## Confirmed Compliant

| Check | Result |
|---|---|
| All 290 JOURNEY-*.md have YAML frontmatter (`---`) | PASS — 0 missing |
| All 290 JOURNEY-*.md have all 6 required frontmatter fields (title, status, updated, created, module, tags) | PASS — 0 missing |
| ADR-0031 journey portal tables exist (`journey`, `journey_step`, `journey_event`, `journey_test_run`) | PASS — `20260301140000_journey_system.sql` |
| ADR-0031 13-status lifecycle enum (`idea` → `wizard` → `defined` → ... → `broken`) | PASS — exact 13 values in `journey_status` enum |
| ADR-0031 platform-admin portal UI (`/platform-admin/journeys/`) | PASS — `page.tsx` + wizard + detail routes confirmed |
| ADR-0038 agent at `packages/ai/src/agents/journey.ts` with `runJourneyAgent` | PASS — confirmed |
| ADR-0038 API route at `/api/journey-agent/route.ts` | PASS — confirmed |
| ADR-0038 wizard session persistence (`wizard_session` table) | PASS — `20260301500000_journey_wizard_session.sql` |
| ADR-0038 all 4 output generators (`generateE2ETest`, `generateOnboardingDoc`, `generateLinearSpec`, `generateBotssonScript`) | PASS — all in `packages/ai/src/generators/` |
| MissionIdSchema enum entries match MISSIONS registry keys (7 entries each) | PASS — exact match |
| `lise-interview` present in MissionIdSchema enum | PASS — confirmed in `types.ts:7` |
| seed.sql seeds 68 journeys per ADR-0031 | PASS — 68 `INSERT INTO journey` statements |
| `apps/e2e/` has journey-named specs | PASS — extensive coverage (`journey-*.spec.ts`) |
| No known-FP re-flagged | PASS — FP-001–004 not applicable to this slice |
