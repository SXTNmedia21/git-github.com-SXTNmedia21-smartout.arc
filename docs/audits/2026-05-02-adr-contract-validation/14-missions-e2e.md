---
title: Slice 14 — Missions + E2E Protocols Pipeline Audit
status: done
updated: 2026-05-02
created: 2026-05-02
module: missions-e2e
tags: [audit, missions, e2e, protocols, journey-ir]
---

## Summary

One protocol exists (P-001), permanently skipped due to missing `data-testid` attributes in the onboarding UI. The e2e suite has diverged from the protocol pipeline — ~120 spec files run under the standard Playwright suite but only one JourneyIR protocol has ever been authored. The missions registry has 6 missions with clear consumers, plus one ID constant (`season-lifecycle`) that is referenced widely but has no `AgentMission` definition in the `MISSIONS` object. Schema divergence between `ProtocolDefinitionSchema` (Zod, legacy schema.ts) and `JourneyIR` (packages/journey-ir) is managed at the runner level (ADR-0178 M3.5 migration), but schema.ts itself is now dead weight — it is exported from `protocols/index.ts` but no active caller uses `ProtocolDefinitionSchema` or `ProtocolDefinition` type.

---

## Protocol → Journey Map

| Protocol ID | File | Target Journey Doc | Journey Exists? | Test Status |
|---|---|---|---|---|
| P-001 | `protocols/P-001-admin-onboarding.ts` | `docs/journeys/JOURNEY-onboarding-flow.md` | Yes (partial match) | SKIPPED — testids missing |

No other P-NNN protocols exist. The `apps/e2e/tests/protocol.spec.ts` file registers only P-001 and immediately skips it.

The broader test suite (`tests/`) covers many journeys (contract-employee, helpdesk, heartbeat, daily-operation, onboarding, governance, etc.) using standard Playwright patterns — not the protocol runner. These are NOT protocol-runner tests and produce no docs/mission/audit artifacts.

---

## Mission → Consumer Map

| Mission ID | Consumer(s) | Deployment Path | Notes |
|---|---|---|---|
| `onboarding-interview` | `apps/web/src/app/onboarding/hooks/useBotsson.ts`, `apps/web/src/app/api/wizard/start/route.ts` | Ultravox via `/api/wizard/start` | Active — voice-assisted onboarding |
| `landing-demo` | `apps/landing/src/components/voice-assistant.tsx`, `apps/landing/src/app/api/wizard/start/route.ts`, `VoiceDemoWidget.tsx`, `features/communications/page.tsx` | Landing page Ultravox widget | Active — landing page voice demo |
| `mr-botsson` | `apps/web/src/components/voice-assistant.tsx` (default), `/api/wizard/start/route.ts` (fallback), `DashboardShell.tsx` | BFF fallback mission | Active — default dashboard assistant |
| `haccp-inspector` | `DashboardShell.tsx:70` route map (`/dashboard/hms`) | Route-pinned voice context | Declared but thin — route map entry only, no dedicated UI trigger visible |
| `shift-assistant` | `DashboardShell.tsx:69,82` (`/dashboard/schedule`, `/dashboard/my-schedule`) | Route-pinned voice context | Active — clientTools wired (SCHEDULE_TOOL_DEFINITIONS) |
| `botsson-session` | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:692` | BotssonProvider default call | Active — free-form persona-engine session |

### Orphan constant

| Export | File | Consumers | Issue |
|---|---|---|---|
| `SEASON_LIFECYCLE_MISSION_ID = "season-lifecycle"` | `packages/ai/src/missions/registry.ts` | `use-active-season.ts`, `session-manager.ts`, `calendar-guardian.ts`, `stage-manager.ts` | No matching entry in the `MISSIONS` object. ID is used as a DB `mission_id` string key — the mission lives in `engine_missions` table, not the static registry. This is intentional but undocumented: `season-lifecycle` is a DB-managed mission, not an Ultravox voice mission. The naming colocation in `registry.ts` is confusing. |

---

## Dead Protocols / Dead Missions

### Dead protocols

No protocol is actively running. P-001 is permanently skipped (`test.skip(true, ...)`). The skip condition is explicit: "Add data-testid attributes to the onboarding components before re-enabling." This has been the state since authoring; no evidence it has ever run green.

### Potentially dead missions

- `haccp-inspector`: Declared in `DashboardShell.tsx` route map but no dedicated component mounts it independently. If the route-pinned voice assistant mechanism is not wired end-to-end, this mission is effectively unexercised. No E2E test covers it.

### Dead schema

- `apps/e2e/protocols/schema.ts` defines `ProtocolDefinitionSchema` (Zod) and `ProtocolDefinition` type. These are re-exported from `protocols/index.ts` but the runner (`protocol-runner.ts`) was retargeted to `JourneyIR` at M3.5 (ADR-0178). No caller in `apps/e2e/` currently instantiates `ProtocolDefinitionSchema.parse()`. The file is dead infrastructure.

---

## Selector Drift Findings

### P-001 missing data-testids (confirmed absent from `apps/web/src/`)

The following selectors are referenced in P-001 but produce zero grep results in the onboarding source tree:

| Testid | Step | Expected location |
|---|---|---|
| `onboarding-hero` | Step 3 | `apps/web/src/app/onboarding/` — hero/welcome section |
| `onboarding-manual-mode` | Step 3 | Hero section — manual mode button |
| `onboarding-step-business` | Step 3 gate / Step 4 | Business info section container |
| `input-company-name` | Step 4 | Business info form field |
| `input-company-city` | Step 4 | Business info form field |
| `onboarding-search-company` | Step 4 | Brønnøysund lookup trigger |
| `onboarding-next-btn` | Steps 4–8 | Per-section next button |
| `onboarding-step-season` | Steps 4 gate / 5 | Season section container |
| `onboarding-step-departments` | Step 5 gate / 6 | Departments section container |
| `onboarding-step-locations` | Step 6 gate / 7 | Locations section container |
| `onboarding-step-procedures` | Step 7 gate / 8 | Procedures section container |
| `onboarding-step-final` | Step 8 gate / 9 | Finalize section container |
| `onboarding-finalize-btn` | Step 9 | Activate workspace button |

Login testids (`login-email`, `login-password`, `login-submit`) exist in `apps/web/src/app/login/page.tsx` — Steps 1–2 would pass.

### MISSING TESTIDS

```
MISSING TESTIDS:
- [data-testid="onboarding-hero"] needed in apps/web/src/app/onboarding/ (Step 3: Velkomstskjerm)
- [data-testid="onboarding-manual-mode"] needed in apps/web/src/app/onboarding/ (Step 3: Velkomstskjerm)
- [data-testid="onboarding-step-business"] needed in apps/web/src/app/onboarding/ (Step 3 gate, Step 4)
- [data-testid="input-company-name"] needed in apps/web/src/app/onboarding/ (Step 4: Bedriftsinformasjon)
- [data-testid="input-company-city"] needed in apps/web/src/app/onboarding/ (Step 4: Bedriftsinformasjon)
- [data-testid="onboarding-search-company"] needed in apps/web/src/app/onboarding/ (Step 4: Brønnøysund trigger)
- [data-testid="onboarding-next-btn"] needed in apps/web/src/app/onboarding/ (Steps 4–8: per-section advance)
- [data-testid="onboarding-step-season"] needed in apps/web/src/app/onboarding/ (Step 4 gate, Step 5)
- [data-testid="onboarding-step-departments"] needed in apps/web/src/app/onboarding/ (Step 5 gate, Step 6)
- [data-testid="onboarding-step-locations"] needed in apps/web/src/app/onboarding/ (Step 6 gate, Step 7)
- [data-testid="onboarding-step-procedures"] needed in apps/web/src/app/onboarding/ (Step 7 gate, Step 8)
- [data-testid="onboarding-step-final"] needed in apps/web/src/app/onboarding/ (Step 8 gate, Step 9)
- [data-testid="onboarding-finalize-btn"] needed in apps/web/src/app/onboarding/ (Step 9: Ferdigstilling)
```

---

## Risk Summary

| Finding | Severity | Owner |
|---|---|---|
| P-001 permanently skipped — zero protocol coverage runs | High | frontend-designer (testid additions) |
| `season-lifecycle` ID exported from missions registry but no MISSIONS entry — misleading colocation | Medium | system-agent-coordinator |
| `protocols/schema.ts` dead after ADR-0178 M3.5 migration — re-exported but unused | Low | protocol-writer |
| `haccp-inspector` route-pinned but no E2E coverage | Low | protocol-writer (after testids unblocked) |
| Protocol pipeline produces zero generated docs/missions/audits in current state | Medium | protocol-writer |
