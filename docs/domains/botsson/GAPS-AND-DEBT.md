---
title: "Botsson — Gaps and Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, gaps, debt, deviations, overlap]
---

# Botsson — Gaps and Debt

> Bridge between built and planned. Every entry cites code (file:line anchor) or ROADMAP phase. **Code wins** — verified 2026-05-23.

## §Deviations (spec vs code differs — code wins)

### DEV-1: L-0150 system-map staleness (closed by this domain run)

**Symptom:** `docs/architecture/BOTSSON-SYSTEM-MAP.md` was a summary artifact that drifted from code. Per L-0150, council briefings had to verify within 7 days.

**Resolution 2026-05-23:** Source docs absorbed and archived. This domain folder (`docs/domains/botsson/`) is now the live truth. `BOTSSON-SYSTEM-MAP.md` frontmatter updated to `status: archived`, `superseded_by: docs/domains/botsson/`. L-0150 staleness cycle closed.

**System-map nodes re-verified 2026-05-23:**

| Node from system-map | System-map claim | Re-verified status | Notes |
|---|---|---|---|
| `BotssonShell.tsx` | 🟢 | 🟢 CONFIRMED | File exists at `apps/web/src/app/Botsson/_components/BotssonShell.tsx` |
| `BotssonOrb.tsx` | 🟢 | 🟢 CONFIRMED | File exists |
| `BotssonOrbVoiceMount.tsx` (was `BotssonVoiceCall`) | 🟢 | 🟢 CONFIRMED | File is `BotssonOrbVoiceMount.tsx` (name differs from map claim `BotssonVoiceCall.tsx`) → minor naming deviation |
| `BotssonHost.tsx` | 🟢 | 🟢 CONFIRMED | New 2026-05-17; file exists; `BotssonHost` anchor at `:26` |
| `EmmaOverlay.tsx` | 🟢 | 🟢 CONFIRMED | File exists |
| `DomainChatOwnership.tsx` | 🟢 | 🟢 CONFIRMED | `DomainChatOwnership` anchor at `:78` |
| 7 missions in registry | 🟢 | 🟢 CONFIRMED | `id:` grep shows 7 entries: onboarding-interview, landing-demo, lise-interview, mr-botsson, haccp-inspector, shift-assistant, botsson-session |
| `POST /api/botsson/chat` | 🟢 | 🟢 CONFIRMED | Directory `api/botsson/chat/` exists |
| `GET /api/botsson/sessions` | 🟢 | 🟢 CONFIRMED | Directory `api/botsson/sessions/` exists |
| `POST /api/botsson/voice/token` | 🟢 | 🟢 CONFIRMED | `api/botsson/voice/token/route.ts` exists |
| Generator API | 🔴 | 🔴 CONFIRMED | `packages/ai/src/generators/` has 4 functions, no HTTP routes |
| Emma signature illustration | 🔴 | 🔴 CONFIRMED | Only letter "E" displayed; `EmmaProfile.tsx` confirmed |
| Immersive backdrop | 🔴 | 🔴 CONFIRMED | `BotssonShell.tsx` has radius 0, no backdrop |
| `engine_memory` writer + G1 | 🟢 (closed G1) | 🟢 CONFIRMED | Migration `20260528000000` seeded dev workspaces; G1 closed 2026-05-10 |
| `channel_event` + `channel_ai_policy` | 🟡 | 🟡 CONFIRMED | communication owns; partial consumer |

**Naming deviation (minor):** System-map cited component as `BotssonVoiceCall.tsx`. Actual file is `BotssonOrbVoiceMount.tsx`. Documentation updated to match code.

---

### DEV-2: Chat-path persona/rank/blend dropped (G:P0)

**Spec claim:** Identity tuning (ADR-0329 soul compilation) should apply to both chat and voice.

**Code reality:** `apps/web/src/app/api/emma/chat/route.ts` drops `persona_prompt` before proxying to stage-engine. Chat-Botsson always uses mission-default `mr-botsson` system prompt regardless of UI identity settings.

**Impact:** User tunes "Brannslukker" preset in Arena Settings → affects only voice. Chat appears untuned. Perceived dissonance.

**Fix:** Forward `persona_prompt` + `custom_prompt` in BFF proxy payload. Est: 30 min.

---

### DEV-3: `BotssonVoiceCall` name in system-map vs actual `BotssonOrbVoiceMount`

**System-map claim:** `BotssonVoiceCall.tsx`.

**Actual file:** `BotssonOrbVoiceMount.tsx` (confirmed by `ls`).

Minor naming drift; all functional claims accurate.

---

### DEV-4: `engine_state.context.mission_id` — no stage-engine consumer

**System-map claim:** 🟡 "Forward-looking JSONB write; `journey.run_guided` packs mission_id into `engine_state.context` JSONB. No stage-engine consumer yet."

**Code reality (confirmed 2026-05-23):** `services/stage-engine/src/` reads `engine_sessions`, not `engine_state`. The write path exists but there is no consumer. Tracked as ontology decision B1 in campaign.

---

### DEV-5: Voice Tuning `speed=1.35` hardcoded

**Spec (BOTSSON_SOUL_ARCHITECTURE.md):** `speed` is a tunable soul attribute.

**Code reality:** `services/voice-agent/src/agent.ts:405` hardcodes `speed: 1.35`. Not exposed in UI. Not read from session payload.

**Fix:** Add `speed` to `VoiceTuning` type + voice-agent reads from session-payload.

---

### DEV-6: MODULE_BOTSSON §2.3 — Ultravox lifecycle diagram (stale, archived)

`docs/architecture/modules/MODULE_BOTSSON.md` §2.3 described an Ultravox session lifecycle. Ultravox fully removed 2026-05-10 (Phase E, ADR-0282). This section was stale. The MODULE doc is now archived.

---

## §Gaps (spec/plan not yet implemented)

### G:P0 — Chat-path identity not wired

**Plan:** BOTSSON_SOUL_ARCHITECTURE.md §Gaps P0.

**Status:** Not built. Chat always uses mission-default prompt. Voice has full identity.

**Plan file:** `docs/superpowers/plans/2026-04-29-botsson-on-platform-admin.md` (touches soul compilation).

---

### G3 — billing-query 5th L-0176 occurrence (emit drift)

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G3.

**Symptom:** `billing_query` capability (6 tools) has file header claiming ADR-0134 emit compliance; 0 `emit()` calls in tool bodies. 5th L-0176 occurrence in 5 weeks.

**Fix:** Add `emit("billing.tool_invoked", {...})` to each tool OR ship ESLint rule.

---

### G4 — schedule voice tools direct DB writes (3 mutations bypass `gatedMutation`)

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G4.

**Symptom:** Voice tools added 3 mutations bypassing `gatedMutation` orchestrator. ADR-0204 cascade integrity invariant #8 violated.

**Fix:** Council decision → voice tools delegate to Server Actions; migrate through orchestrator (SS-4).

---

### G5 — `/api/emma/session` BFF orphan

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G5.

**Symptom:** Phase E T3 dropped consumer. Route reads `engine_sessions` for onboarding state but nobody calls it. Mr. Botsson cannot recall onboarding context without round-trip.

**Decision needed:** wire consumer OR delete with ADR rationale.

---

### G9 — profile_id leak in BFF

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G9.

**Symptom:** `/api/emma/chat` + `/api/botsson/chat` BFF may accept forgeable `body.profile_id` (ADR-0151 gap).

**Fix:** Apply same pattern as PR #350 — reject body.profile_id if it disagrees with JWT-resolved profile.

---

### G10 — Schedule wrong-day bug

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G10.

**Symptom:** User-reported. `schedule` tool returns wrong day. Root cause unknown — D2 diagnose not run. Likely TZ-aware fixtures missing.

**Fix:** TZ-aware test fixture → trace `schedule/tools.ts` → fix + regression test.

---

### G11 — Mission E2E: 0 of 7 missions covered

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G11.

**Symptom:** Voice missions are product-core differentiator; zero Playwright E2E coverage.

**Fix:** Add `e2e_test` frontmatter to 7 mission journeys; Playwright suites for mr-botsson + lise-interview BFF + UI; wizard-onboarding-via-livekit E2E; 5 missing Phase E voice spec files.

---

### G12 — DB mission registry drift

**Source:** `BOTSSON-STAGE-MISSION-MODEL.md` §3.

**Symptom:** `engine_stages` table has rows for `season-lifecycle` (8 stages) and `discovery-call` (3 stages) with no matching code registry entries. 2 of 3 stage chains are orphans.

**Fix:** Decide intent per DB-only mission → delete stale seeds (with ADR) OR add registry entries.

---

### G14 — Generator API routes missing

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G14.

**Symptom:** 4 generators (`journey-botsson`, `journey-doc`, `journey-e2e`, `journey-linear`) exist as pure functions at `packages/ai/src/generators/`. No HTTP surface.

**Fix:** Ship `/api/.../generate` route handlers as thin wrappers.

---

### G15 — Emma signature + Immersive backdrop not implemented

**Source:** `BOTSSON-KNOWN-LIMITATIONS.md` G15.

**Symptom:** `EmmaProfile.tsx` shows letter "E" on gradient. `BotssonShell.tsx` has radius 0, no backdrop. Mockups at `docs/design/botsson/project/components/emma.jsx` + `immersive.jsx`.

**Fix:** Frontend-designer implements per Claude Design handoff bundle.

---

### G:fase-4 — Proposal pipeline not built

**Plan:** `docs/plans/PLAN-botsson-fase-4-proposal-pipeline.md` + `docs/superpowers/plans/2026-05-06-botsson-fase-4-proposal-pipeline.md`.

**Spec:** `docs/superpowers/specs/2026-03-28-telemetry-orchestration-botsson-reactive-design.md`.

**Code:** 5 journey files exist; 0 implementation code. Confirmed by grep: no `propose_shift` or proposal-pipeline handlers in capabilities.

---

### G:soul-platform-admin — Soul on Platform Admin not built

**ADRs:** ADR-0329 (soul server-compilation) + ADR-0330 (soul snapshot audit) accepted.

**Plan:** `docs/superpowers/plans/2026-04-29-botsson-on-platform-admin.md`.

**Code:** No platform-admin UI for soul snapshot management found.

---

## §Overlap (domain boundary edges)

### OVL-1: `communication` ↔ `botsson` — `channel_ai_policy`, Botsson channel bootstrap

**Shared surface:** `channel_ai_policy` table, `channel_member WHERE is_ai=true`, `channel_type='ai'`, `profile.botsson_channel_id` FK.

**Classification:** keep (both legitimately touch it).

**Seam:** communication owns AI policy schema + channel infrastructure. Botsson owns runtime behavior (which channel to use, how to route to/from Emma). `channel_ai_policy.voice_participation` determines if Botsson joins voice channels.

**Dashboard entry:** noted in `_DASHBOARD.md` overlap table (row: communication ↔ botsson).

---

### OVL-2: `procedure-engine` ↔ `botsson` — mission lifecycle vs procedure lifecycle

**Shared surface:** Mission framework shows procedures via `training` + `governance` capabilities. Procedure-engine owns `protocol`/`procedure`/`routine` tables.

**Classification:** keep (clear author/consumer split).

**Seam:** botsson SHOWS procedures via capability tools; procedure-engine OWNS procedure data. Botsson's `onboarding` capability creates protocols (`add_procedures` tool) but delegates to procedure-engine's DB tables.

---

### OVL-3: `task` ↔ `botsson` — task surfaces

**Shared surface:** `fn_list_my_tasks` RPC, `task` capability tools, `emma_task` table.

**Classification:** keep (task domain self-owns; botsson surfaces via capability).

**Seam:** botsson uses the `task` capability (6 tools). Task domain owns tables and RPC. Botsson domain owns the tool-bridge wiring (e.g. `apps/web/src/app/Botsson/_components/use-emma-tasks.ts`).

---

### OVL-4: `day-session` / `core-structure` ↔ `botsson` — context reads

**Shared surface:** `department_session`, `schedule_shift`, `department`, `workspace` — botsson reads these for workforce snapshot injection (ADR-0297).

**Classification:** keep (botsson reads only; day-session + core-structure own the tables).

---

### OVL-5: `agent-harness` (future) ↔ `botsson` — stage-engine boundary

**Surface:** `services/stage-engine/src/`, `packages/ai/src/router/`, `/classifiers/`, `/gate/`, `/engine/`, `/generators/`.

**Classification:** split (deferred — harness domain not yet defined).

**Seam (documented boundary):**
- Botsson → harness: BFF HTTP call (`POST /api/botsson/chat` → stage-engine `/agent/chat`)
- Harness → botsson: mission configs from `packages/ai/src/missions/registry.ts` + soul from `packages/ai/src/prompts/`
- The `packages/ai/src/agents/` directory is split: `botsson.ts` + `onboarding.ts` are persona-config (IN scope); rest are capability/harness (OUT scope)

**Recommendation:** define `agent-harness` domain as next `pre` run when stage-engine documentation is prioritized.

---

## §Debt

### DEBT-1: L-0027 emit drift — recurring at audit cycle

**Pattern:** L-0027 (mutation tools must emit). G3 (billing-query) is the 5th occurrence in 5 weeks. Same class as L-0176 (docstring drift) / L-0177 (silent fallback).

**Mitigation:** ADR-0116 auto-emit via `toVercelTools()` covers some sites. ESLint rule `no-mutation-without-emit` not yet shipped. Until lint rule exists, every capability audit finds 1 new occurrence.

**Priority:** Ship ESLint rule before next botsson audit cycle.

---

### DEBT-2: Settings localStorage — no device sync

**Pattern:** All soul settings (`emma-identity`, `emma-voice-tuning`, `emma-voice-id`) stored in `localStorage`. Per-browser, no sync.

**Impact:** User tunes Botsson on desktop → mobile sees defaults.

**Fix:** Persist to DB (agent_user_preferences table or engine_authority_config column). G:P1 in ROADMAP.

---

### DEBT-3: `UltravoxVoice` type retained post-Phase-E

**Source:** G6 in `BOTSSON-KNOWN-LIMITATIONS.md`.

**Detail:** `coral` voice lives in `(string & {})` escape hatch. Constants `ULTRAVOX_TO_OPENAI_VOICE` + `resolveOpenAIVoice()` retained as compat bridge (Phase E). IDE autocomplete misleads.

**Fix:** 30 min chore — rename type, add named union, drop compat map if no callers.

---

### DEBT-4: `agent_session_recording` PII temporal regression

**Source:** BOTSSON-SYSTEM-MAP.md L5 known debt.

**Detail:** Migration `20260514000010_secure_submit_own_pii.sql` temporal regression — brief window where PII self-submit may be possible. Linear ticket pending (Council D1).

---

## §Agent Guardrails (surface governance — ADR-0238)

Per ADR-0238 + ADR-0337, surfaces that declare domain-chat ownership must suppress Orb to passive mode. Three active declaration sites (verified 2026-05-23):

| File | Anchor | Reason |
|---|---|---|
| `apps/web/src/app/dashboard/komm/chat-page-client.tsx:36` | `DomainChatOwnership` | "komm-chat" |
| `apps/web/src/app/dashboard/komm/TicketConversationView.tsx:103` | `DomainChatOwnership` | "komm-thread" |
| `apps/web/src/app/dashboard/shift/ShiftClockTabs.tsx:89` | `DomainChatOwnership` | "shift-clock-chat" |

**Rule:** NEVER mount a new AI chat surface without declaring `DomainChatOwnership`. Dual-surface UX = silent misroute (L-0178).

---

## §Spec/Plan Reconciliation

| Plan/Spec | Outcome | Notes |
|---|---|---|
| `PLAN-botsson-overlay-implementation.md` | 🟡 Partial | BotssonShell/Orb/Arena/Sticky built. EmmaProfile settings UI built. **Emma signature + Immersive backdrop 🔴** (mockups exist, implementation missing — G15). Form-view + video-view still placeholders. |
| `PLAN-botsson-publishannouncement-capability.md` | ✅ Confirmed | `publish_announcement` lives in `communication` capability per ADR-0240. Tests at `communication/__tests__/publishAnnouncement.test.ts`. 4 journeys defined. |
| `PLAN-botsson-bulletproof-scaffolding.md` | ✅ Confirmed | Phase A + harness-hardening landed (profile_id derive, gate fixes, CI invariants) |
| `PLAN-botsson-observability-foundation.md` | 🟡 Partial | Phase A6 pino + pg_notify guardian bus ✅. Session recorder D1 ✅. Generator API (C2) 🔴. Nordic Split audit (C3) 🔴. |
| `PLAN-botsson-fase-4-proposal-pipeline.md` | 🔴 Gap | 5 journeys defined; 0 implementation. No proposal-pipeline handlers found in capabilities. |
| `PLAN-botsson-harness-e2e-test.md` | 🟡 Partial | `apps/e2e/tests/botsson-harness-e2e.spec.ts` exists. Full mission E2E (G11) missing. Phase 2c recorder E2E missing. |
| `CAMPAIGN-botsson-arena.md` | 🟡 Active | Phase A+E complete. B1 SS-4/SS-5, B3, C2, C3, D2, D3 open. Campaign still active on `campaign/botsson-arena`. |
| `2026-03-28-telemetry-orchestration-botsson-reactive-design.md` (spec) | 🔴 Gap | Botsson reactive design / proposal pipeline architecture specced; no matching implementation. Related to G:fase-4. |
| `2026-05-11-botsson-publishannouncement-capability.md` (spec) | ✅ Confirmed | Capability landed in communication domain (ADR-0240, ADR-0369/0370/0371 atomicity). |
| `2026-04-16-botsson-observability-foundation.md` (plan) | 🟡 Partial | A6 + D1 landed; C2 + C3 remain. Same as PLAN- entry above. |
| `2026-04-29-botsson-on-platform-admin.md` (plan) | 🔴 Gap | Soul-on-platform-admin: ADRs accepted, no UI built. |
| `2026-05-06-botsson-fase-4-proposal-pipeline.md` (plan) | 🔴 Gap | Forward plan exists; no implementation found. |
| `2026-05-19-sm-8-botsson-orb.md` (plan) | 🟡 Partial | Orb polish — see `apps/e2e/tests/sm-8-botsson-orb.spec.ts`. Visual gaps remain (G15). |
