---
title: "Botsson — Known Limitations"
status: archived
superseded_by: docs/domains/botsson/
updated: 2026-05-23
created: 2026-05-10
verified_against_code: 2026-05-10
verified_against_db: 2026-05-10
module: MODULE_BOTSSON
tags: [botsson, limitations, blockers, recovery]
---

> ⚠️ **ARCHIVED 2026-05-23** — Superseded by `docs/domains/botsson/`. All open limitations (G3–G16) compiled into `docs/domains/botsson/GAPS-AND-DEBT.md` §Gaps. Closed limitations remain here as historical record. Do not update this file — update GAPS-AND-DEBT.md.

# Botsson — Known Limitations

> Single canonical inventory of "what does NOT work today, why, and how to fix." Pair with `BOTSSON-SYSTEM-MAP.md` (status per component) and `BOTSSON-STAGE-MISSION-MODEL.md` (per-mission contracts). Never delete an entry — flip to `closed` with date + commit ref.

---

## Severity legend

- 🔴 **CRITICAL** — promotion-blocker or runtime-broken-now
- 🟠 **HIGH** — runtime correctness, audit-trail integrity, or product-feel kill
- 🟡 **MEDIUM** — drift, doc rot, recoverable degradations
- 🟢 **LOW** — cosmetic, deferred, or pre-existing baseline

---

## Open limitations

### 🟠 G3 — F-CT-01 `billing-query` 5th L-0176 occurrence

**Symptom:** File header claims ADR-0134 emit-on-every-mutation; 6 tools (`list_my_invoices`, `get_my_invoice`, `explain_invoice_basis`, `list_overdue_invoices`, `list_invoice_dispatches`, `get_usage_snapshot`) have 0 emit calls. Audit-trail blind for billing surface.

**Pattern:** L-0176 (docstring vs body drift) crystallized 2026-04-29. 5th occurrence in 5 weeks. Recurring at 1 site/audit.

**Fix:** add `emit("billing.tool_invoked", {...})` to each tool body OR ship `eslint-rule-no-lying-docstring` (file header `ADR-0134|emit()` claim → require `emit(` call in every exported `execute()` body).

**Owner:** botsson-harness-builder + lint rule sortie

---

### 🟠 G4 — F-SC-01 schedule voice tools 3 NEW direct DB writes

**Symptom:** Voice tools added 3 mutations bypassing `gatedMutation` orchestrator on top of existing SS-5 7-hook backlog. Cascade integrity invariant #8 (provenance) violated.

**Root cause:** Voice-tool sortie landed before ADR-0204 SS-4 + delegation pattern decision. Voice-tools wrote directly to `schedule_day_booking` etc.

**Fix (sortie ADR-0204 SS-4):**
1. Council decision: voice tools delegate to Server Actions (per `createDayInfoAction` precedent at `use-day-info.ts:131`)
2. Migrate 4 per-cap `gate.ts` (shift-lifecycle, contract-intake, journey, memory) through `gatedMutation` orchestrator
3. Migrate 3 schedule voice tools as proof-of-pattern
4. Flip ADR-0204 `proposed → accepted`

**Owner:** system-agent-coordinator (council ADR), botsson-harness-builder (migration)

---

### 🟠 G5 — F-OB-04 `/api/emma/session` BFF orphan

**Symptom:** Phase E E2 shipped BFF route reading `engine_sessions` mode='agent' process_id='onboarding_v1' (rewritten to `mission_id='onboarding-interview' AND mode='agent'` per Phase F0 KRIT-1 A2). Phase F0 dropped consumer (T3). Mr. Botsson cannot read onboarding state without round-trip to wizard's local context.

**Decision needed:** wire consumer (mr-botsson reads onboarding state for "where are you in setup?" recall) OR delete with rationale.

**Fix (F-OB-04 follow-up, est 2-3h):**
- Either: extend `mr-botsson` mission prompt to call `/api/emma/session` and inject `<onboarding_state>` block
- Or: delete BFF route + add ADR documenting decision

**Owner:** botsson-harness-builder

---

### 🟠 G6 — F-JR-02 `UltravoxVoice` type retained post-Phase-E

**Symptom:** `coral` (real `lise-interview` voice) lives in `(string & {})` escape hatch, not named union. IDE autocomplete misleads future authors. Constants `ULTRAVOX_TO_OPENAI_VOICE` + `resolveOpenAIVoice(ultravoxVoice)` retained as compat-bridge.

**Fix (chore, est 30min):**
1. Rename `UltravoxVoice` → `VoiceId` across types
2. Add `coral`, `mark`, `sarah`, `shimmer`, `verse`, `alloy` to named union
3. Drop `ULTRAVOX_TO_OPENAI_VOICE` if no inbound callers (verify via grep)

**Owner:** small chore, dev-direct commit

---

### 🟠 G7 — F-PD-04 `--color-brand-orange-light` missing

**Symptom:** `hover:bg-brand-orange-light` + `hover:text-brand-orange-light` resolve to no color in 4 Tailwind class uses. Active visual bug.

**Fix:** add `--color-brand-orange-light: var(--brand-orange-light)` to `globals.css @theme inline`. One-line.

**Owner:** dev-direct commit

---

### 🟠 G8 — F-PD-03 orange-* palette bypass 387 sites (regressed +14)

**Symptom:** Hardcoded brand-orange Tailwind utilities instead of CSS-variable references. 373 → 387 from dev sync `1319bd4eb`. Trend wrong direction.

**Fix:** frontend-designer pass; bulk codemod `bg-orange-*` → `bg-[var(--brand-orange)]`. Cannot ride along with backend sortie.

**Owner:** frontend-designer

---

### 🟠 G9 — F-SE-05 `profile_id` leak in `emma/chat` + `botsson/chat` BFF

**Symptom:** ADR-0151 forgery defence has gap on these two routes. Carried regression from 2026-05-06.

**Fix:** apply same defence pattern as `/api/wizard/start` (Phase B1 PR #350). Reject `body.profile_id` if it disagrees with JWT-resolved profile.

**Owner:** botsson-harness-builder

---

### 🟠 G10 — Schedule capability wrong-day bug (D2 deferred)

**Symptom:** User-reported. `schedule` tool returns wrong day. Mr. Botsson tells user wrong shifts.

**Root cause:** unknown — D2 diagnose not yet run. Likely TZ-aware fixtures missing.

**Fix (sortie D2):**
1. Reproduce with TZ-aware test fixture (Europe/Oslo, DST boundary, week-start variations)
2. Trace `schedule` capability tool body
3. Add fix + regression test

**Owner:** botsson-harness-builder

---

### 🟠 G11 — Mission E2E 0 of 7

**Symptom:** Voice missions = product-core differentiator, zero regression coverage. F-ME-01 + F-ME-02 + F-ME-07.

**Fix (sortie Mission E2E foundation, est 5-7d):**
1. Add `e2e_test` frontmatter to 7 mission journeys
2. Playwright suites for `mr-botsson` + `lise-interview` BFF + UI layers (LiveKit transport itself can't be Playwrighted)
3. `wizard-onboarding-via-livekit` E2E
4. 5 missing Phase E voice spec files

**Owner:** protocol-writer

---

### 🟡 G12 — DB-vs-registry mission drift

**Symptom:** Code registry has 7 missions; `engine_stages` has 3 (`onboarding-interview`=8, `season-lifecycle`=8, `discovery-call`=3). `season-lifecycle` + `discovery-call` exist in DB without registry entries. 4 of 7 code missions are single-prompt (no stage chain).

**Fix:** decide intent for each DB-only mission:
- `season-lifecycle`: live? legacy? rename of registered mission? Council decision needed.
- `discovery-call`: legacy seed? Migrate out OR add registry entry.

**Owner:** botsson-harness-builder + council if scope-bearing

---

### 🟡 G13 — B1 dual-gate composition orchestrator SS-4 not migrated

**Symptom:** ADR-0204 `proposed`. Composition orchestrator (`gatedMutation`) shipped feature-flagged at SS-3 (`23842e52`). 4 per-cap `gate.ts` (shift-lifecycle, contract-intake, journey, memory) not yet migrated through orchestrator. SS-5 33 lint warnings open.

**Fix (sortie B1 SS-4):** migrate 4 per-cap gates + flip ADR-0204 `proposed → accepted`.

**Owner:** botsson-harness-builder

---

### 🟡 G14 — Generators no API surface (C2 deferred)

**Symptom:** 4 generators (`journey-botsson`, `journey-doc`, `journey-e2e`, `journey-linear`) are pure functions in `packages/ai/src/generators/`. No HTTP surface. Cannot be invoked from BFF.

**Fix (Phase C2):** ship `/api/.../generate` route handlers as thin wrappers around generator functions.

**Owner:** botsson-harness-builder

---

### 🟡 G15 — L1 visual gaps (Emma signature illustration + Immersive backdrop)

**Symptom:** `EmmaProfile.tsx` shows only "E" letter on gradient. `BotssonShell.tsx` has radius 0, no backdrop. Mockups in `docs/design/botsson/project/components/emma.jsx` + `immersive.jsx`.

**Fix:** frontend-designer implements per Claude Design handoff bundle.

**Owner:** frontend-designer

---

### 🟡 G16-proposed — No programmatic stage validators

**Symptom:** `engine_stages.success_criteria` is natural-language only. Stage advancement evaluated implicitly via `req.result` payload. No automated validator.

**Decision (per ADR-0282 R6 step 8 lesson):** prefer runtime telemetry probes over synthetic validators (gate-as-spec-cathedral demolishes mid-run when phenomenology bites). Existing 4 voice telemetry events are the runtime gate; programmatic validators only when criteria is structurally testable (e.g. "season_budget row exists" yes/no).

**Fix:** explicit decision needed — defer indefinitely (rely on telemetry) OR ship per-stage Zod-validators for structurally-testable criteria.

**Owner:** council (per ADR amendment)

---

## Closed (historical)

| ID | Limitation | Closed | Commit/PR |
|---|---|---|---|
| ~A1 | `contract_intake` bypasses `gate_action` | 2026-04-23 | PR #243 (`3ea7fcbb`) |
| ~A2 | `profile_id` forgeable from request body | 2026-04-23 | harness-hardening + PR #350 (B1) |
| ~A3-code | `engine_memory` writer never wired | 2026-04-22 | Phase A3 — code shipped; **G1 closed 2026-05-10 (see below)** |
| ~G1 | Memory authority not seeded → save_memory hidden | 2026-05-10 | commits `af7ee8d58` (migration) + `8a12e3659` (test), migration `20260528000000_seed_memory_authority_dev_workspaces.sql` |
| ~G2 | F-DB-01 `engine_world_observe_platform` GRANT vector (cross-tenant pollution) | 2026-05-11 | commits `e552e119b` (migration `20260528010000`) + `fecacbcef` (regression SQL test) + ADR-0290 amendment |
| ~A4 | ADR-0112 intent-coverage CI script missing | 2026-04-23 | PR #244 |
| ~A5 | Intent classifier context input = `""` | 2026-04-23 | PR #245 typed-object refactor |
| ~A6 | Guardian bus in-process, no cross-process | 2026-04-22 | ADR-0186 pg_notify |
| ~B5 | `create_deviation` / `validate_settlement` / `lock_checkout` handlers missing | 2026-04-28 | `engine-dispatch/index.ts:800/910/995` |
| ~C1 | Mobile LiveKit not wired to stage-engine | 2026-04-24, 2026-04-28 | C1.b + C1.d (C1.c Detox deferred) |
| ~D1 | No session recording / replay surface | 2026-04-22 | ADR-0184 + ADR-0185 |
| ~F-AC-02 | Landing wizard → deleted Ultravox endpoint (broken in prod) | 2026-05-10 | Phase F0 T1 strip-only |
| ~F-SE-01 | Voice multi-tenant workspace derivation broken | 2026-05-10 | Phase F0 T2 |
| ~Phase-E | Ultravox dual-plane → single LiveKit plane | 2026-05-10 | PR #354 + #360 (ADR-0282) |
| ~B1-SS-3 | Composition orchestrator scaffold + correlation_id schema | 2026-04 | PR #254 |
| ~Krisp-race | livekit-client 2.17 setProcessor race | 2026-05-10 | commit `cafd6c30c` |

---

## Recovery plan (priority-ordered)

| # | Sortie | Closes | Time | Owner |
|---|---|---|---|---|
| ~~1~~ | ~~F-MEM-UNBLOCK~~ | ~~G1~~ | ~~2-3h~~ | **CLOSED 2026-05-10** (migration `20260528000000` + test `save-memory-tool-visibility.test.ts`) |
| ~~2~~ | ~~F-DB01-FIX~~ | ~~G2~~ | ~~90min~~ | **CLOSED 2026-05-11** (migration `20260528010000` + regression SQL test + ADR-0290 amendment) |
| 3 | F-DOC-REFRESH | doc drift (G6 docs portion + harness-builder.md + module + system-map) | 60min | docs-tutor |
| 4 | F-PD-04 palette one-liner | G7 | 5min | dev-direct commit |
| 5 | F-CT-01 billing-query emit | G3 | 60min | botsson-harness-builder |
| 6 | F-OB-04 wire-or-delete | G5 | 2-3h | botsson-harness-builder |
| 7 | F-JR-02 rename + drop compat | G6 | 30min | dev-direct |
| 8 | ADR-0204 SS-4 + voice-tool delegation | G4, G13 | 4-6h | system-agent-coordinator + botsson-harness-builder |
| 9 | Mission E2E foundation | G11 | 5-7d | protocol-writer |
| 10 | D2 schedule wrong-day diagnose | G10 | 1-2d | botsson-harness-builder |
| 11 | F-PD-03 palette cleanup | G8 | 2-3d | frontend-designer |
| 12 | DB mission registry reconciliation | G12 | 90min | botsson-harness-builder + council if scope-bearing |
| 13 | C2 generator API routes | G14 | 1-2d | botsson-harness-builder |
| 14 | L1 visuals (Emma signature + Immersive) | G15 | 3-5d | frontend-designer |

---

## Validation gate (before any new sortie touches Botsson)

1. [ ] Read this file. Verify it is `verified_against_code: <within 7 days>`. If older, run code-trace before trusting.
2. [ ] Run `grep -c "Capability,$" packages/ai/src/capabilities/registry.ts` — confirm count matches docs.
3. [ ] Run `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT capability, count(*) FROM engine_authority_config GROUP BY capability ORDER BY capability;"` — confirm capability surface exposed.
4. [ ] Run `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT count(*) FROM engine_memory;"` — confirm memory writer is firing (or not).
5. [ ] Confirm intended changes do not re-open a `closed` limitation above.
