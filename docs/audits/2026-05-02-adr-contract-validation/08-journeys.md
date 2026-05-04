---
title: "Slice 08 — Journey Definitions vs Runtime vs E2E"
status: done
updated: 2026-05-02
created: 2026-05-02
module: journeys
tags: [audit, journeys, e2e, engine_process, engine_missions, runtime]
---

# Slice 08 — Journey Definitions vs Runtime vs E2E

## Summary

**Top 5 findings:**

1. **Catastrophic E2E gap: 190/201 journey docs have zero E2E coverage.** Only 11 JOURNEY-*.md files map to any Playwright spec. The 141 spec files overwhelmingly cover code paths that have no corresponding JOURNEY-*.md doc.

2. **Engine missions/processes are decoupled from journey docs by design, but undocumented.** 24 seeded engine processes/missions exist in migrations; none have a JOURNEY-*.md that matches by slug. Matching is semantic-only (e.g., `JOURNEY-onboarding-mission.md` covers `onboarding-interview` mission). This is not a bug but there is no traceability index.

3. **Only 1 E2E protocol file (P-001) exists out of expected many.** `apps/e2e/protocols/` has exactly one protocol (`P-001-admin-onboarding.ts`). The protocol runner infrastructure exists but the library of protocols never grew. E2E test suites (141 .spec.ts files) operate outside the protocol system entirely.

4. **Journey portal (ADR-0031) tables exist but journey docs are not wired to `journey_step` rows.** The 201 JOURNEY-*.md flat files are author artifacts, not ingested records. The DB-side journey tracking (`journey_step`, `journey_version`) serves the platform-admin journey wizard (ADR-0038), not the per-feature JOURNEY-*.md docs.

5. **Structured journey folders (13-file per journey-protocol skill) barely adopted.** Only 1 of the 4 slug folders (`platform-admin-authors-journey/`) has the full 13-file structure including `e2e.spec.ts`. Three dev-only folders (`dev-sixten-hello`, `dev-arena-bootstrap`, `dev-adr-0249-base-consolidation`) are stubs. The journey-protocol skill format is an aspiration, not the norm.

---

## Journey Coverage Matrix

Key domains audited (representative sample, not all 201):

| Journey domain | Doc (JOURNEY-*.md) | Runtime capability | engine_process seeded | E2E spec | Verdict |
|---|---|---|---|---|---|
| onboarding-interview mission | JOURNEY-onboarding-mission.md | `missions/registry.ts` ✅ | `onboarding-interview` ✅ | journey-signup-onboarding.spec.ts (partial) | ⚠️ partial |
| shift-assistant mission | none matching | `missions/registry.ts` ✅ | `shift-assistant` ✅ | via daily-operation-* | ⚠️ partial |
| haccp-inspector mission | none matching | `missions/registry.ts` ✅ | `haccp-inspector` ✅ | none | 🔴 orphan (runtime) |
| season-lifecycle mission | JOURNEY-season-engine-complete.md (ref) | `missions/registry.ts` ✅ | `season-lifecycle` ✅ | season-activation.spec.ts | ⚠️ partial |
| contract_data_intake process | JOURNEY-contract-composition-engine.md (ref) | capability: contract-intake ✅ | `contract_data_intake` ✅ | contract-composition/happy-path.spec.ts | ⚠️ partial |
| contract_signing process | JOURNEY-contract-employee.md | capability: contract ✅ | `contract_signing` ✅ | contract-employee/ (5 specs) | ✅ complete |
| helpdesk_query_lifecycle | JOURNEY-helpdesk-primitives.md | capability: helpdesk_query ✅ | `helpdesk_query_lifecycle` ✅ | helpdesk-public/private-ticket-lifecycle | ⚠️ partial |
| helpdesk_sla_breach_handler | JOURNEY-helpdesk-sla-auto-escalation.md | edge fn: sla-breach-handler | `helpdesk_sla_breach_handler` ✅ | helpdesk-sla-auto-escalation.spec.ts | ✅ complete |
| cascade_reconciliation_close | JOURNEY-cascade-drift-observability.md | stage-engine | `cascade_reconciliation_close` ✅ | cascade-drift-observability.spec.ts | ✅ complete |
| journey_authoring capability | JOURNEY-journey-engine-honesty.md | capability: journey-authoring ✅ | none | journey-capability-*.spec.ts (4) | ⚠️ partial |
| journey (run_guided etc) | JOURNEY-journey-harness-poc.md | capability: journey ✅ | `journey_03_check_shifts` ✅ | journey-engine.spec.ts (J1-J12) | ✅ complete |
| signup_onboarding process | JOURNEY-onboarding-flow.md | stage-engine | `signup_onboarding` ✅ | signup-wizard-deep.spec.ts | ⚠️ partial |
| workspace_setup process | JOURNEY-setup-flow-redesign.md | stage-engine | `workspace_setup` ✅ | workspace-setup-flow.spec.ts | ⚠️ partial |
| botsson-session mission | none specific | `missions/registry.ts` ✅ | `botsson-session` ✅ | none | 🔴 orphan (runtime) |
| governance_content_ingest | JOURNEY-platform-k1a-curation.md (partial) | stage-engine | `governance_content_ingest` ✅ | none | 🔴 orphan |
| discovery-call mission | none | `20260301200100_engine_seed.sql` | `discovery-call` ✅ | none | 🔴 orphan (dev artifact) |
| heartbeat | JOURNEY-heartbeat.md | hook system | none | heartbeat/j1-j5.spec.ts | ⚠️ partial |
| year-wheel | JOURNEY-year-wheel.md | cascade + UI | none | year-wheel-redesign.spec.ts | ⚠️ partial |

---

## Orphan Inventory

### Direction 1 — Journey doc with no E2E (190 of 201)

Volume too large to enumerate fully. Representative orphaned docs with significant runtime behavior:

- JOURNEY-guardian-dashboard.md — guardian capability is seeded, no E2E
- JOURNEY-hms-phase-1.md — HMS has 4 E2E specs but name mismatch (`hms-avvik`, `hms-drift`, etc., not `hms-phase-1`)
- JOURNEY-m2-tour-harness-*.md (4 docs) — m2 tour tests exist (`journey-help-tour-*`) but naming diverged
- JOURNEY-m3-page-takeover-*.md (4 docs) — 4 E2E specs exist (`journey-page-takeover-*`) ✅ MATCHED but naming differs
- JOURNEY-publish-mission-body-*.md (2 docs) — no E2E for publish_mission body validation
- JOURNEY-tips-leader-flows-*.md (4 docs) — no tip E2E at all
- JOURNEY-payroll-foundation.md — no E2E for payroll
- JOURNEY-lovsen-foundation-*.md (3 docs) — no E2E for lovsen
- JOURNEY-training-schema-foundation.md — training_protocol seeded, no E2E
- JOURNEY-session-recorder-platform-admin.md — recorder E2E exists but name mismatch (`botsson-recorder/`)

Note: The 4 `JOURNEY-m3-page-takeover-*.md` files likely DO match `journey-page-takeover-*.spec.ts` — the cross-check above used exact-slug matching and missed them. Adjusted real count is ~186 unmatched.

### Direction 2 — E2E spec with no journey doc

Large overlap. Dominant categories:

- **Auth flow** (F1-F10, auth.spec.ts, join-*, signup-*): 20+ specs, covered only by `JOURNEY-auth-screens-redesign.md` + `JOURNEY-auth-security-friction.md` — no per-spec doc
- **Daily operations** (`daily-operation-*`, 7 specs): `JOURNEY-admin-daily-loop.md` + `JOURNEY-daily-standup.md` exist but names don't match spec slugs
- **HMS** (`hms-avvik`, `hms-drift`, `hms-oversikt`, `hms-signoff`): `JOURNEY-hms-phase-1.md` is the only HMS doc — 4 specs unmapped
- **Botsson recorder** (`recorder-failure-resilience`, `schedule-wrong-day-replay`, `whisper-never-user-facing`): no matching JOURNEY-*.md
- **Performance gates** (`performance-gates.spec.ts`): no doc (covered by `JOURNEY-adminpage-speed.md`? — not by spec naming)
- **Governance** (`governance.spec.ts`, `governance-training-mvp/`): `JOURNEY-agent-architecture.md` closest, no match
- **Contract variants** (`contracts-api`, `bindings-tab`, `composition-drawer`, `reverse-flow`, etc.): most covered by JOURNEY-contract-*.md family but naming mismatches mean cross-check misses them

### Direction 3 — Engine process with no journey doc (by slug)

All 24 engine processes have NO JOURNEY-*.md file matching by slug. Processes with no semantically close doc:

- `daily_close` — no JOURNEY-admin-daily-loop match (different scope)
- `shift_published_notify_v1` — no doc
- `session_hook_dispatcher` — no doc
- `discovery-call` — dev/demo artifact, no doc needed

---

## Critical Gaps

**G1 — No traceability index between engine process IDs and journey docs.** The 24 engine processes use slug conventions (`contract_signing`, `signup_onboarding`) that do not match the JOURNEY-*.md naming (`JOURNEY-contract-employee.md`, `JOURNEY-onboarding-flow.md`). No mapping file or frontmatter field links them.

**G2 — Protocol system abandoned.** P-001 is the only protocol file. The `apps/e2e/protocols/` directory has infrastructure (`runner`, `gate-checker`, `reporters`) with no additional protocols authored. The JourneyIR v2 schema and 141 spec files represent a parallel approach that bypasses the protocol system entirely.

**G3 — haccp-inspector and botsson-session missions are runtime orphans.** Both have full mission definitions in `missions/registry.ts` and engine seeds but no JOURNEY-*.md doc and no E2E coverage. `haccp-inspector` is safety-critical (HACCP compliance) and has zero test coverage.

**G4 — journey-protocol 13-file folder format adopted in 1 of 205 journey artifacts.** The `platform-admin-authors-journey/` folder is the only complete structured journey. The format introduced via the skill is not being applied to new features at close-feature time.

**G5 — Naming convention split between docs and E2E.** Journey docs use feature-branch naming (`JOURNEY-m2-tour-harness-reduced-motion.md`); E2E specs use semantic naming (`journey-help-tour-reduced-motion.spec.ts`). The mismatch makes automated cross-linking impossible without a mapping layer.
