---
title: "Slice 08 — Journeys"
slice: 08
slice_name: journeys
audit_date: 2026-05-13
adrs_in_scope: [0031, 0038, 0291]
surfaces:
  - docs/journeys/
  - packages/ai/src/journey/
  - packages/ai/src/missions/
  - apps/e2e/
status: complete
---

# Slice 08 — Journeys

## Counts

| Metric                                        | Value |
| --------------------------------------------- | ----- |
| Journey docs (`docs/journeys/JOURNEY-*.md`)   | 299   |
| Journey docs (all + non-JOURNEY, top-level)   | 312   |
| Frontmatter `status: verified`                | 148   |
| Frontmatter `status: done`                    | 122   |
| Frontmatter `status: draft`                   | 16    |
| Frontmatter `status: in_progress`             | 7     |
| Frontmatter `status: deferred`                | 2     |
| Frontmatter `status: review/ready_for_merge`  | 3     |
| Frontmatter `status: archived`                | 1     |
| Docs missing `status:` frontmatter            | 0     |
| Docs with `e2e_test:` field present           | 195   |
| Docs with `e2e_test: null` literal            | 48    |
| Total Playwright `.spec.ts` files             | 198   |
| Registered missions (`MISSIONS` record)       | 7     |
| Missions with any Playwright E2E spec         | 0     |
| Voice-plane-consolidation journeys            | 5 (4 verified, 1 deferred) |

## Baseline status

| Finding ID | 2026-05-10 baseline                                  | 2026-05-13 state |
| ---------- | ---------------------------------------------------- | ---------------- |
| F-JR-01    | 5 voice-plane journeys `status: draft`               | **RESOLVED** — 4 `verified` (2026-05-10), 1 `deferred` with reason. |
| F-JR-02    | `UltravoxVoice` type retained                        | **OPEN — degraded** — type still in `packages/ai/src/missions/types.ts:15`, re-exported in `index.ts:1`, used 3× in `AgentMission`/`MissionStageOverride`/`MissionManifestEntry`. Registry header comment still reads "All available Ultravox agent missions" (`registry.ts:8`). |
| F-ME-01    | 0 E2E coverage for 7 registered missions             | **OPEN — unchanged** — no Playwright spec references `mr-botsson`, `onboarding-interview`, `lise-interview`, `haccp-inspector`, `shift-assistant`, `landing-demo`, or `botsson-session`. Mission IDs zero hits across `apps/e2e/`. |
| F-ME-02    | 5 voice journeys reference 5 missing spec files      | **RESOLVED** — voice journeys reference `docs/superpowers/specs/2026-05-04-voice-plane-consolidation.md` (exists) and "Phase F sortie 4" (closure track, not a missing file). |
| F-ME-07    | mr-botsson dashboard orb voice no E2E + no `e2e_test`| **OPEN** — `DashboardShell.tsx:68-76` mounts `mr-botsson` mission on 7 dashboard routes (`/dashboard`, `/operations`, `/komm`, `/people`, `/reports`, `/year-wheel`, `/calendar`); zero E2E spec covers orb voice activation/handshake. No standalone `JOURNEY-mr-botsson-orb-voice.md` exists. |

## Findings (new + persistent)

### F-JR-02 (persistent, ADR-0079/ADR-0214 voice consolidation drift)

Phase E + Phase F0 LiveKit cutover did NOT remove `UltravoxVoice` from the typed mission surface. Five sites:

- `packages/ai/src/missions/types.ts:15` — type definition (5 literal Ultravox voice names: terrence, mark, jessica, sarah, tina).
- `packages/ai/src/missions/types.ts:19,35,67` — three `voice?: UltravoxVoice` fields on `MissionStageOverride`, `AgentMission`, `MissionManifestEntry`.
- `packages/ai/src/missions/index.ts:1` — `export type { UltravoxVoice }` keeps the symbol in public package API.
- `packages/ai/src/missions/registry.ts:8` — doc comment "All available Ultravox agent missions".

**Impact:** type-system claim of Ultravox provider conflicts with LiveKit runtime; any downstream consumer typing against `UltravoxVoice` will pick up obsolete voice IDs. Severity: **CONTRACT DRIFT — DEGRADED** (no runtime bug yet; pure naming hygiene + type-rename sortie).

### F-ME-01 (persistent, ADR-0038 coverage gap)

Zero Playwright specs target any of the seven registered agent missions. Audited via grep across `apps/e2e/**/*.spec.ts` for mission IDs — 0 hits. The closest specs:

- `apps/e2e/tests/availability-harness-e2e.spec.ts` — touches `BotssonOrb` UI element but is an availability-tool harness, not a voice-session E2E.
- `apps/e2e/tests/mission-harness-e2e.spec.ts` — `mission_*` test harness for engine_missions table, not `AgentMission`-registry missions.

**Impact:** every mission persona ships untested end-to-end. ADR-0038 § "Agent Impact" never closed by an E2E. Severity: **CRITICAL** (worsens with each new persona — Phase F0 added `lise-interview` + `botsson-session` since baseline).

### F-ME-07 (persistent, dashboard orb voice contract)

`DashboardShell.tsx:68-86` defines `routeMissionMap` with `mr-botsson` mounted across 7+ dashboard routes. No journey doc named `JOURNEY-mr-botsson-orb-voice.md` exists. No spec references `BotssonOrb` voice activation, mute, transcript binding, or PII guard handshake. Severity: **CRITICAL** (orb is the workspace-default Botsson surface — ADR-0186, ADR-0238 — and runs unguarded by automated regression).

### F-JR-NEW-01 (new, ADR-0291 wiring partial)

ADR-0291 implementation surfaces (`packages/journey-ir/src/speed-profile.ts`, `apps/e2e/runners/speed-profile-env.ts`, `apps/e2e/runners/gate-checker.ts`) all exist with unit-test coverage (`packages/journey-ir/src/__tests__/speed-profile.test.ts`, `apps/e2e/runners/__tests__/speed-profile.test.ts`). However, no journey doc declares `speed_profile:` in frontmatter (grep `0/299`), so the IR-pinning path is exercised by runner tests but NOT by any authored journey. **Recommendation:** add `speed_profile` to journey doc template + pin `ai_companion` on Botsson-narrated demo journeys. Severity: **MINOR — incomplete adoption** (no contract break; ADR § Agent-impact unimplemented in author tooling).

### F-JR-NEW-02 (new, ADR-0031 seed gap)

ADR-0031 § Phased Implementation Phase 1: "Tables, types, status machine, portal UI". Migration `20260301140000_journey_system.sql` (223 lines) creates 4 tables + 7 enums but contains NO seed `INSERT INTO journey` rows. Seed lives in separate file `20260323200000_seed_onboarding_journey.sql` (one journey). **ADR claim "all 68 journeys are queryable, filterable, and trackable" is not met by migration baseline.** Severity: **CONTRACT DRIFT** (ADR overstates delivered state; 67 of the documented 68 journeys not seeded into `journey` table).

### F-JR-NEW-03 (new, journey doc hygiene)

- 16 journey docs still `status: draft`. Spot-check: `JOURNEY-policy-create.md`, `JOURNEY-platform-k1a-curation.md`, `JOURNEY-audit-sortie-{1,2,3}-*.md`, `JOURNEY-contract-module.md`, `JOURNEY-mobile-addsheet-task-bff-wrap.md`, `JOURNEY-innkalling-flow.md`. Some pre-date Q2-2026 work that has clearly shipped.
- 48 journey docs declare `e2e_test: null` literally — pre-Phase-F0 docs that never got an E2E retrofit. Severity: **MINOR — staleness**.

### F-JR-NEW-04 (new, persona engine vs UltravoxVoice)

`MISSIONS["botsson-session"]` (registry.ts:385-398) is documented as "no hardcoded personality — the persona engine on the client controls identity via context.persona_prompt" yet `voice: "d082550b-596a-42f7-9356-840b4a095d3f"` (a UUID, not an Ultravox built-in). Combined with F-JR-02, this confirms the type `UltravoxVoice = "terrence" | ... | (string & {})` is structurally permissive but semantically misleading post-LiveKit. Severity: **MINOR** (folded into F-JR-02 remediation).

## Top 3 critical one-liners

1. **F-ME-01 — Zero Playwright E2E for any of 7 registered missions** (mr-botsson, lise-interview, haccp-inspector, shift-assistant, onboarding-interview, landing-demo, botsson-session); ADR-0038 § Agent Impact unverified, gap unchanged since 2026-05-10 baseline.
2. **F-ME-07 — mr-botsson dashboard orb voice mounted on 7 routes via `DashboardShell.tsx:68-86` with zero E2E and no dedicated `JOURNEY-mr-botsson-orb-voice.md`**; default workspace voice surface runs unguarded.
3. **F-JR-NEW-02 — ADR-0031 claims "68 journeys seeded" but `journey_system.sql` migration ships schema only**; only `onboarding` journey seeded in a follow-up migration → 67 of 68 documented journeys never enter the `journey` table.
