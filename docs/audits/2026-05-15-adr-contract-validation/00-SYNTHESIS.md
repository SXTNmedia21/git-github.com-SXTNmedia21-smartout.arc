---
title: "ADR + Contract Audit Synthesis — 2026-05-15"
status: complete
created: 2026-05-15
updated: 2026-05-15
mode: full
run_id: 2026-05-15-adr-contract-validation
slices_run: 14
baseline: 2026-05-13-adr-contract-validation
tags: [audit, synthesis, adr, contract-validation]
---

# ADR + Contract Audit Synthesis — 2026-05-15

## Executive Summary

- **All four 2026-05-13 CRITICALs are CLOSED.** F-DB-09 (D6 sister-table WITH CHECK) closed by Sortie A.2 migration `20260608120000`; F-OB-10-01 (27 legacy onboarding files) closed by `feat/audit-fob10-onboarding-cleanup`; F-CL-11 (legal voice channel on §14-6) closed by `47bffe635`; F-EF-03 (5 unauthenticated intelligence EFs) closed by `verifyInternalAuth()` rollout. No CRITICAL findings this run.
- **Theme shift: D6 governance hardening has expanded scope but reduced severity.** Same `FOR ALL USING(...)` no-WITH-CHECK shape that was CRITICAL on production D6 tables now persists on `engine_sessions`, `engine_inbox`, 14 governance content tables (`00004`), `engine_authority_config`, and three D4 planning tables — all MEDIUM/LOW because admin-only or service_role-only write paths. Sister-sweep mandate (ADR-0303) needs to extend its CI allow-list to cover these.
- **ADR-0287 CI coverage perimeter is the most important new gap.** The shipped `scripts/gate-action-coverage.ts` only walks `packages/ai/src/capabilities/`. Schedule TanStack hooks (`use-employee-roster.ts`, `use-schedule-voice-tools.ts`, `use-hours-overrides.ts`, `use-absences.ts`), the `/api/emma/memory` route, and 40 direct-DB-write sites under `apps/web/src/app/dashboard/schedule/_hooks/` are OUTSIDE enforcement. SS-5 backlog re-counted at 40 mutations (up from 13+) — scope expansion, not regression.
- **One repeated F-EF-02a finding across slices 03 + 10** = `wizard-definition.ts:292` invokes `finalize-workspace` / `activate-workspace` EFs directly from `"use client"` context. Independently flagged by two slices = high-confidence HIGH. Closes by adding `POST /api/onboarding/finalize` route handler.
- **Mobile L-0083 enforcement landed and held.** F-MO-01/02/03/04 all closed by ESLint rule `smartout/no-empty-string-identifier-fallback`. Mobile HIGH count dropped from 6 to 2 (F-MO-05 recon-wizard direct write, F-MO-06 `submit_own_pii` client workspace_id). Best per-slice improvement this cycle.

**Verdict:** No CRITICAL promotion-blockers. Top 10 remediation backlog is HIGH-only, concentrated in three themes: capability tool ordering inside `gatedMutation` (slice 01), schedule/voice hook gate+emit gaps (slice 04), and the unfixed `wizard-definition.ts` browser→EF call (slices 03+10).

---

## Critical findings (Top 10)

| # | ID | Sev | Theme | File:Line | ADR | Source slices | Remediation | ETA |
|---|---|---|---|---|---|---|---|---|
| 1 | F-CT-02 + F-CT-03 + F-CT-08 | HIGH | Capability tool ordering | `packages/ai/src/capabilities/journey/tools.ts:196,239,461-503,684-704,940,991` | 0204 | 01 | Move `engine_missions/engine_stages/engine_state/engine_state_step/journey_guide` writes INSIDE `gatedMutation.execute()` callback. Pathway B (`cascade_gate_write`) currently not evaluated for these tables. | 2-3 days |
| 2 | F-OB-10-06 / F-EF-02a | HIGH | Browser→EF (ADR-0179) | `apps/web/src/app/onboarding/wizard-definition.ts:14,292` | 0123, 0179 | 03, 10 | Create `POST /api/onboarding/finalize` + `POST /api/onboarding/activate` route handlers; switch `invokeEdgeFunction` call to `fetch("/api/onboarding/finalize", ...)`. `buildWorkspaceFinalizationRequest()` already encapsulates payload. | 1-2 days |
| 3 | F-SC-04-17 | HIGH | Voice tool D6 ungated writes | `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts:854-882` | 0091, 0204, 0287 | 04 | Voice tool `addSessionTaskTool` inserts directly to `department_session` + `session_task` (D6 governance-gated) with no gate, no emit. Lift to Server Action mirroring `updateDepartmentSessionDutyLeaderAction` pattern. | 2-3 days |
| 4 | F-SC-04-09 | HIGH | Bulk insert no gate | `apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts:333` | 0204, 0287 | 04 | `useAutoFillShifts` bulk-inserts entire week of `schedule_shift` with zero authority gate. Highest blast radius of SS-5 backlog. Wrap in `gatedMutation` or Server Action. | 3-4 days |
| 5 | SE02-03 | HIGH | BFF route missing gate+emit | `apps/web/src/app/api/emma/memory/route.ts:74` | 0099, 0134 | 02 | Route writes to `engine_memory` with no `callGateAction` and no `emit()`. Law 2 + Law 4 double violation. Route via stage-engine memory capability OR add gate+emit inline. Also fix workspace_id derivation (use profile-resolved value, not body). | 1-2 days |
| 6 | F-EF-05 | HIGH | Unauthenticated EF | `supabase/functions/identify-company/index.ts` | 0029 | 03 | `verify_jwt = false` + zero auth check. Brreg lookup proxied unauthenticated. Add `verifyInternalAuth()` matching the 5-EF intel pattern just shipped. | 0.5 day |
| 7 | F-WH-05 | HIGH | Webhook idempotency | `apps/web/src/app/api/webhooks/docuseal/route.ts:96` | 0079 | 13 | DocuSeal retry can double-write `employment_contract.status=active` + duplicate `engine_event`. Add `UNIQUE` on `contract.docuseal_submission_id`; switch lookup to `.maybeSingle()`. Same class as F-WH-04 just closed. | 0.5 day |
| 8 | F-MO-05 + F-MO-06 | HIGH | Mobile direct PII write | `apps/mobile/src/hooks/mutations/use-recon-wizard.ts:200-248`, `apps/mobile/app/(app)/(me)/contract/complete-data.tsx:92,111` | 0132, 0151 | 05 | Direct `daily_reconciliation` insert + `submit_own_pii` RPC with body-supplied `p_workspace_id`. No BFF route exists. Add `/api/mobile/reconciliation` + `/api/mobile/profile/pii` route handlers; mobile thin-client through them. | 2-3 days |
| 9 | F-JR-NEW-02 | HIGH | Seed migration gap | `supabase/seed.sql:400–end` | 0031 | 08 | 68-journey seed lives only in `seed.sql` — `supabase db push` (production) does not apply it. Production DB has zero journey rows. Move into a real `supabase/migrations/*.sql` file or amend ADR-0031 text. | 1 day |
| 10 | F-ME-01 + F-ME-07 + F-ME-08 | HIGH | Mission persona coverage | `packages/ai/src/missions/registry.ts` (7 missions); `mr-botsson` primary surface | 0038, 0274 | 14 | Zero E2E coverage for all 7 mission personas across two audit cycles. ADR-0274 (`engine_session_step` + `agent_inquiry`) stalled 11 days proposed — Welcome Mission V0 cannot recover from worker crash without these tables. Open Phase F sortie 4. | 5-7 days |

---

## Theme rollup

| Theme | C | H | M | L | Worst-offender file |
|---|---|---|---|---|---|
| Capability tool ordering / gate-emit drift (ADR-0186, 0204, 0240, 0287) | 0 | 3 | 3 | 1 | `journey/tools.ts:196,239,461-503,684-704` (F-CT-02/03/08 = 3 sites domain writes outside gatedMutation.execute) |
| Schedule cascade hooks + voice tool writes (ADR-0091, 0156, 0204, 0287) | 0 | 3 | 2 | 1 | `use-schedule-voice-tools.ts:854-882` (F-SC-04-17 voice D6 ungated) |
| Browser→EF (ADR-0123, 0179) | 0 | 1 | 0 | 0 | `onboarding/wizard-definition.ts:292` (F-OB-10-06 = same as F-EF-02a) |
| Auth perimeter / unauth EF (ADR-0029) | 0 | 1 | 1 | 1 | `identify-company/index.ts` (F-EF-05 no auth check at all) |
| Stage-engine + BFF gate+emit gaps (ADR-0099, 0134, 0151, 0246-0248) | 0 | 1 | 4 | 3 | `api/emma/memory/route.ts:74` (SE02-03 no gate + no emit) |
| Mobile boundary + telemetry contract (ADR-0132/0133/0134/0136/0151) | 0 | 2 | 4 | 0 | `use-recon-wizard.ts:200-248` (F-MO-05 still open) |
| RLS WITH CHECK / governance content (ADR-0299, 0303) | 0 | 0 | 3 | 1 | `engine_authority_config.admin_manage_authority` (F-DB-22 C4 governance table FOR ALL no WITH CHECK) |
| Webhook hygiene + idempotency (ADR-0079, 0142) | 0 | 1 | 2 | 3 | `webhooks/docuseal/route.ts:96` (F-WH-05 no UNIQUE on submission_id) |
| Missions / E2E persona coverage (ADR-0038, 0274) | 0 | 3 | 2 | 3 | `mr-botsson` primary voice surface zero spec (F-ME-07) |
| Contract/payroll/legal capability + service (ADR-0078, 0163, 0249, 0293, 0295) | 0 | 0 | 2 | 2 | `payroll/tools.ts:1559,2534` (F-CL-12 Pattern B recalc skipped on agent path) |
| Journey portal (ADR-0031, 0038, 0282, 0304) | 0 | 1 | 0 | 1 | `seed.sql:400+` (F-JR-NEW-02 seed gap) |
| ADR drift hygiene / coverage gaps | 0 | 0 | 6 | 8 | `0260-cabinet-grotesk` (17 days proposed, zero implementation) |
| Performance & design (ADR-0019, Nordic Split) | 0 | 2 | 1 | 2 | `apps/landing/next.config.ts:32,89` (F-01/F-02 landing unfixed since 2026-05-13) |
| i18n adoption + frontmatter | 0 | 2 | 5 | 2 | 35 hardcoded NO toasts + 450/569 dashboard files miss `@smartout/i18n` import |
| **TOTALS** | **0** | **20** | **35** | **28** | **83 deduped findings** |

Notes on counts:
- F-CT-02/03/08 counted as 3 distinct findings (3 different journey-tool sites of the same root cause) — kept distinct because each tool registration is its own surface.
- F-EF-02a (slice 03) and F-OB-10-06 (slice 10) are the SAME finding at `wizard-definition.ts:292` — counted ONCE under "Browser→EF" theme.
- ADR-0204 SS-5 backlog "40 hooks" treated as one finding (F-SC-04-22 INFO + F-SC-04-23 INFO + 4 enumerated HIGHs) per slice 04 framing.
- 14 governance content tables in `00004` counted as one MEDIUM (F-DB-21), not 14.

---

## ADR conflict table — claimed status vs reality

| ADR | Status (frontmatter) | Reality | Gap | Source slice |
|---|---|---|---|---|
| 0029 | Accepted (capital A — case drift) | Workspace-api compliant; F-EF-05 `identify-company` unauthenticated | Normalize case + add auth | 03, 09 |
| 0031 | accepted | 68 journeys claimed seeded; live only in `seed.sql`, not in migration | Promote seed.sql contents to migration OR amend ADR | 08 |
| 0038 | accepted | All 4 generators + wizard agent + portal pages shipped | PASS — no gap | 08 |
| 0041 | superseded | All 27 legacy files deleted; supersession status now accurate | PASS — closed | 10 |
| 0053 | proposed (53 days) | No `services/simulator/` dir, no simulation migration | Oldest unresolved proposed ADR; decide ship-or-kill | 09 |
| 0056 | done (non-canonical) | Schema shipped; status enum should be `accepted` | Mechanical frontmatter fix | 09 |
| 0107 | accepted | `engine_sessions.channel` CHECK enforces valid SessionChannel | PASS | 07 |
| 0136 | proposed | Camera evidence: no schema, no mobile code | Acceptable — `proposed` status accurate | 05 |
| 0139 | draft | `--color-proposed` token absent from globals.css | Draft is accurate; flag if promoted | 09 |
| 0151 | accepted | Capability tools compliant; SE02-02 emma/memory body workspace_id; F-MO-05/06 mobile body workspace_id; F-CL-15 contract-service no cross-check | Cleanup at 3 surfaces | 02, 05, 06 |
| 0152 | proposed | Provider still uses early-return + console.warn (not throw). NOT superseded by 0193 (per slice 09 reanalysis) | Either ship throw-fast OR retain proposed | 09 |
| 0156 | accepted | OversiktTab + EventDetailPanel confirmed routed through Server Actions | PASS — F-SC-04-13/15 closed | 04 |
| 0163 | accepted | legal/index.ts:64 = ["chat","system"]; F-CL-14 cite_law Layer 3 comment still says "voice" | Fix doc comment OR remove voice from tool | 06 |
| 0179 | accepted | `wizard-definition.ts:292` still browser→EF invoke | F-OB-10-06 / F-EF-02a | 03, 10 |
| 0186 | accepted | guardian/tools.ts `acknowledge_signal` has no emit + no guardian_log write | F-CT-06 MEDIUM | 01 |
| 0204 | accepted | SS-5 backlog: 40 direct mutations across schedule hooks; 5 capability-tool ordering violations | Open by design; backlog | 01, 04 |
| 0220 | accepted | `apps/web/src/components/botsson/` absent on disk | Surface-text drift, low severity | 09 |
| 0238 | proposed | `<DomainChatOwnership>` component absent in codebase; platform-admin journeys wizard is dual-surface today | F-OB-10-07 LOW | 10 |
| 0240 | proposed | publishDraftTool body now gated (L-0176 closed) but tool still registered; ADR text says "unregistered until Phase 1 lands" | F-CT-07 — confirm intent | 01 |
| 0246/0247/0248 | proposed | None implemented; B5 lifecycle events registered in telemetry but never emitted | Phantom registry contract | 02 |
| 0260 | proposed (17 days) | Cabinet Grotesk: zero hits; tokens.ts still Instrument Serif | Ship-or-kill | 09 |
| 0268 | accepted | Mobile shipping 4 visible + 1 FAB = 5-tab canonical verified | PASS — closed | 05 |
| 0273 | proposed | `created: 2026-05-25` is 10 days future | Mechanical date fix | 09 |
| 0274 | proposed (11 days) | `engine_session_step` + `agent_inquiry` tables absent. Welcome Mission V0 cannot durably recover | F-ME-08 NEW HIGH | 14 |
| 0278 | proposed | No governance workflow in `.github/workflows/`; no retention automation | Open | 09 |
| 0279 / 0283 | accepted | Frontmatter `id:` fields stale from renumber (e.g. file 0279 has `id: ADR-0271`; file 0283 has `id: ADR_0266` body title `ADR-0278`) | Renumber drift triple-mismatch | 09 |
| 0282 / 0304 | accepted / proposed | UltravoxVoice type still exported in `packages/ai/src/missions/types.ts:15,19,35,67` and `index.ts:1` | F-JR-02 unchanged | 08 |
| 0287 | accepted | Helper + CI script + workflow shipped; baseline 43 passing / 0 violating | PASS — but coverage perimeter limited to `packages/ai/src/capabilities/` only | 01, 04 |
| 0293 | accepted | BFF Pattern B compliant; capability tools `addManualSupplement` / `deleteManualSupplement` skip recalc | F-CL-12 MEDIUM | 06 |
| 0295 | proposed | Implementation correct + live at 3 sites; ADR status not promoted | F-CL-16 LOW (hygiene) | 06 |
| 0296 | accepted | DROP migration `20260529000000` queued (future-dated); tables still live | Schedule per migration date | 02, 07 |
| 0299 | accepted (Sortie A.2 + A.3 complete) | All 4 D6 sister tables + staff_event closed | PASS — full closure | 04, 07 |

**13 ADR files still carry `Accepted` (capital A — case drift):** 0017, 0020, 0021, 0026, 0027, 0028, 0029, 0206, 0207, 0208, 0209, 0210, 0211. Mechanical normalization needed.

---

## Slice contradictions

| # | Disagreement | Source slices | Resolution |
|---|---|---|---|
| 1 | `wizard-definition.ts:292` — is this F-EF-02a or F-OB-10-06? | Slice 03 (HIGH F-EF-02a) + Slice 10 (HIGH F-OB-10-06) | **SAME finding, two valid slice citations.** Both correctly identify the same browser→EF invoke at line 292. Confidence is HIGH because two independent slices land on identical file:line + ADR. Counted ONCE in deduped totals; treated as canonical HIGH. |
| 2 | ADR-0287 — PASS or non-compliant? | Slice 01 says PASS (CI baseline 43/0/89); Slice 04 says non-compliant (40 schedule hook violations); Slice 07 says PASS (helper + CI shipped) | **BOTH right, different scopes.** ADR-0287 ENFORCEMENT shipped (helper + CI script + workflow) — scope passes for `packages/ai/src/capabilities/`. Schedule TanStack hooks are OUTSIDE the script's walk path. Net: ADR-0287 is technically PASS but its perimeter has a gap. New theme entry. |
| 3 | F-EF-04 (legacy `/onboarding` ADR-0123 violations) — closed or open? | Slice 03 says CLOSED (27 files deleted); Slice 10 confirms cleanup but raises F-OB-10-06 on the SURVIVING `wizard-definition.ts` | **CLOSED for the 27-file scope; new finding on a DIFFERENT file.** F-EF-04 properly retires; F-OB-10-06 is the new identifier for the survivor. No contradiction. |
| 4 | F-MO-02 use-training-data — HIGH or LOW? | Baseline 2026-05-13 had as HIGH; Slice 05 downgrades to LOW (correctly returns null, no empty-string mint) | **DOWNGRADED to LOW.** Slice 05 read the post-ESLint-fix code: `workspace_id ?? null` correctly widened; underlying hooks gate on `!!workspaceId`. Real fix landed. |
| 5 | F-CL-11 (legal voice channel) — closed or open? | Slice 06 confirms CLOSED; Slice 06 NEW finding F-CL-14: `cite_law` tool body declares `allowedChannels: ["chat","voice"]` at L3 while capability L2 narrowed to `["chat","system"]` | **F-CL-11 CLOSED; F-CL-14 is a NEW MEDIUM (L2/L3 drift).** The capability is hardened; the per-tool ADR-0078 documentation comment lags. Voice silently blocked (no error), but doc drift is real. |
| 6 | ADR-0152 — superseded by 0193 or still proposed? | Baseline 2026-05-10/13 said "effectively superseded by 0193"; Slice 09 reanalyzes and says NOT superseded (0193 amends ADR-0134 type branding, not the early-return behavior of activity-trail provider) | **NOT SUPERSEDED.** Slice 09 read both ADRs and the provider code: `activity-trail.ts:58` still does `console.warn` + early-return on null; never throws. ADR-0152's proposed status is accurate. Baseline conflation corrected. |
| 7 | F-OB-04 `/api/emma/session` orphan | Slice 02 says SE02-06 still OPEN (zero production consumers); Slice 10 says F-OB-10-02 carry-forward | **BOTH right — same finding, two IDs.** Route handler exists with passing tests, agent-sdk still exports `createOnboardingTools`, missions registry still references `getOnboardingState`. Carry-forward HIGH. |

---

## Delta vs 2026-05-13

### Closed (significant — major remediation wave between 2026-05-13 and 2026-05-15)

| Finding | Closure mechanism |
|---|---|
| F-DB-09 CRITICAL — D6 sister tables WITH CHECK | Sortie A.2 migration `20260608120000` — 4 tables per-verb split with symmetric USING+WITH CHECK |
| F-DB-10 HIGH — personal_task WITH CHECK | Same Sortie A.2 migration |
| F-DB-11 HIGH — ADR-0287 enforcement | `mutateWithGate()` helper + `scripts/gate-action-coverage.ts` + `.github/workflows/gate-action-coverage.yml` shipped; ADR promoted to `accepted` |
| F-DB-12 HIGH — staff_event + staff_event_attendee | Sortie A.3 migration `20260609120000` |
| F-OB-10-01 CRITICAL — 27 legacy onboarding files | `feat/audit-fob10-onboarding-cleanup` merged `2c3e4b1eb`; ADR-0041 supersession now accurate |
| F-OB-10-04 MEDIUM — latent ADR-0123 violations in scroll-wizard | Resolved automatically by F-OB-10-01 deletion |
| F-CL-11 CRITICAL — legal voice channel on §14-6 | Commit `47bffe635` narrowed `legalCapability.allowedChannels` to `["chat","system"]` |
| F-CL-13 HIGH — feriepenger_basis=0 | `computeFeriepengerBasis` now called at 3 sites; emits `payroll.feriepenger_basis_computed` |
| F-EF-03 CRITICAL — 5 unauthenticated intelligence EFs | `verifyInternalAuth()` added to all 5 (`gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `analyze-workspace`) |
| F-EF-04 HIGH — legacy `/onboarding` ADR-0123 violations | Closed by 27-file deletion (F-OB-10-01) |
| F-WH-04 HIGH — call_log no UNIQUE on session_id | Migration `20260611100000` + livekit handler upsert with `ignoreDuplicates: true` |
| F-MO-01/02/03/04 HIGHs — mobile L-0083 empty-string fallbacks | `feat/audit-fmo-l0083-enforcement` — `smartout/no-empty-string-identifier-fallback` ESLint rule at error severity + CI workflow + unit tests; identity sites all remediated |
| F-SC-04-13 / F-SC-04-15 HIGH — day-control direct writes | Both confirmed CLOSED on 2026-05-15 (Server Action lift completed; OversiktTab + EventDetailPanel verified) |
| F-OB-04 / F-OB-10-03 partial — `getOnboardingState` dead path | Partially closed; agent-sdk export + registry reference cleanup deferred |
| ADR-0041 supersession claim | Now accurate (cleanup complete) |
| ADR-0268 5-tab mobile drift | Closed — mobile layout verified 4-visible + 1 FAB |
| SE-02-01 HIGH — primeContext.profileId injection | Server-verification added in `apps/web/src/app/api/botsson/chat/route.ts:203-234` before LLM inject |

### New CRITICAL: **0**

### New HIGH: 9

- F-CT-02 / F-CT-03 / F-CT-08 — journey/tools.ts domain writes OUTSIDE `gatedMutation.execute()` (Pathway B not evaluated)
- F-CT-04 — `callGateAction` sentinel adapter silently maps `data_rule` deny to `allow:true` (LIVE CODE risk)
- F-SC-04-17 — voice tool `addSessionTaskTool` direct insert to `department_session` + `session_task` (D6 governance-gated, no gate, no emit)
- F-SC-04-18 — `use-hours-overrides.ts` direct upsert/delete on `department_hours_override` (D1 table, outside gatedMutation)
- SE02-03 — `/api/emma/memory` route writes to `engine_memory` with no gate + no emit
- F-EF-05 — `identify-company` EF `verify_jwt=false` with zero auth check (Brreg lookup proxy publicly callable)
- F-WH-05 — DocuSeal webhook `docuseal_submission_id` not UNIQUE; retry can double-write `employment_contract.status=active`
- F-ME-08 — ADR-0274 stalled 11 days proposed; `engine_session_step` + `agent_inquiry` tables absent

### New MEDIUM/LOW: 15 (sample)

- F-CT-05/06/07 (capability tool gate/emit drift)
- F-MO-10 (channel-message props-supplied workspace_id border case)
- F-DB-20/21/22/23 (engine_sessions + 14 governance content + engine_authority_config + 3 D4 tables — same FOR ALL no WITH CHECK shape, MEDIUM/LOW because admin-only/service-role-only paths)
- F-CL-14 (cite_law L2/L3 channel inversion drift)
- F-CL-15 (contract-service no cross-check body.workspace_id vs API-key-derived)
- F-CL-16 (ADR-0295 proposed despite live correct implementation)
- F-WH-06/07/08/09/10 (sendgrid timestamp window, livekit room-name UUID validation, stripe null workspace_id, docuseal x-forwarded-for, sendgrid open/click dedup)
- F-EF-06 (CRON_SECRET in 3 EFs absent from `.env.template`)
- F-OB-10-07 (platform-admin journeys wizard dual-surface)
- F-03/F-04 (landing Turbopack alias gap, hardcoded brand-color volume)

### Regressed: **0**

No baseline-closed finding has re-appeared this audit cycle. The remediation wave was clean.

### Unchanged open from baseline

- F-MO-05 (recon-wizard direct write — no BFF wrap yet)
- F-MO-06 (`submit_own_pii` body workspace_id — no BFF wrap yet)
- F-MO-08 (8 sync-queue handlers direct write)
- F-MO-09 (no `<DomainChatOwnership>` on mobile)
- F-EF-02a / F-OB-10-06 (`wizard-definition.ts:292` browser→EF)
- F-JR-02 (UltravoxVoice type still exported across 5 sites; ADR-0304 cleanup proposed but not accepted)
- F-JR-NEW-02 (68 journey seed gap — `seed.sql` only)
- F-ME-01 / F-ME-07 (zero mission persona E2E)
- F-ME-02 (5 dangling Phase F sortie 4 deferral pointers)
- F-ME-04 / F-ME-05 / F-ME-06 (P-001 unblocked but untracked; protocol registry coverage conflation)
- F-01 / F-02 (landing optimizePackageImports + Sentry source-map gate — unchanged since 2026-05-13)
- F-WH-01 / F-WH-02 / F-WH-03 (baseline webhook hygiene — partially superseded by F-WH-05/06/07 framing)
- ADR drift baseline carry: 0053, 0056, 0139, 0152, 0220, 0260, 0273, 0274, 0278, capital-A frontmatter sweep

### Bottom-line delta

**4 CRITICAL closed → 0 CRITICAL open.** 11 HIGH closed → 9 NEW HIGH. Net direction: **strong remediation cycle on D6 governance + voice plane + mobile L-0083 + onboarding cleanup**. Regression theme is structural: capability-tool ordering inside `gatedMutation` + schedule TanStack hooks outside ADR-0287 CI perimeter + the unfixed `wizard-definition.ts` survivor. No security/data-corruption CRITICAL today.

---

## Forward plan

### 1. Sortie B.1 — capability tool gatedMutation ordering (HIGH)

**Addresses:** F-CT-02/03/08 (journey tools), F-CT-05 (onboarding update_season), F-CT-06 (guardian acknowledge_signal emit). **Pattern:** Move domain writes INSIDE `gatedMutation.execute()` callback so Pathway B (`cascade_gate_write`) evaluates. Use `journey-authoring/tools.ts publishDraftTool` as gold-standard reference. **ETA:** 2-3 days.

### 2. Sortie B.2 — onboarding finalize/activate BFF route handler (HIGH)

**Addresses:** F-OB-10-06 / F-EF-02a. **Pattern:** `POST /api/onboarding/finalize` + `POST /api/onboarding/activate` route handlers wrapping `finalize-workspace` / `activate-workspace` EFs server-to-server with service role. Update `wizard-definition.ts:292` to `fetch("/api/onboarding/finalize", ...)`. `buildWorkspaceFinalizationRequest()` already encapsulates payload. **ETA:** 1-2 days.

### 3. Sortie B.3 — schedule cascade hook gate+emit lift (HIGH)

**Addresses:** F-SC-04-17 (voice tool D6 writes), F-SC-04-09 (useAutoFillShifts bulk insert), F-SC-04-18 (hours-overrides D1 write), F-SC-04-21 (absence approve/reject). **Pattern:** Server Action lift per `updateDepartmentSessionDutyLeaderAction` precedent. Sortie can land 3-5 highest-impact hooks; SS-5 backlog spans subsequent sorties. **CRITICAL prerequisite:** Extend `scripts/gate-action-coverage.ts` walk scope to `apps/web/src/app/dashboard/**/_hooks/**` and `apps/web/src/app/api/**/route.ts` so future regressions are caught. **ETA:** 4-5 days.

### 4. Sortie B.4 — emma/memory + identify-company perimeter (HIGH)

**Addresses:** SE02-03 (BFF route gate+emit), SE02-02 (workspace_id derivation), F-EF-05 (identify-company unauth). **Pattern:** Add gate+emit to `/api/emma/memory` POST (use `memory/tools.ts` capability OR inline `callGateAction` + `emit()`). Add `verifyInternalAuth()` to `identify-company`. **ETA:** 1-2 days.

### 5. Sortie B.5 — DocuSeal webhook idempotency (HIGH)

**Addresses:** F-WH-05. **Pattern:** UNIQUE on `contract.docuseal_submission_id` + `.maybeSingle()` lookup with early-return on duplicate (matches F-WH-04 closure pattern). **ETA:** 0.5 day.

### 6. Sortie B.6 — mobile reconciliation + PII BFF wrap (HIGH)

**Addresses:** F-MO-05, F-MO-06. **Pattern:** `/api/mobile/reconciliation` + `/api/mobile/profile/pii` route handlers; lift `use-recon-wizard.ts` online path + `complete-data.tsx` RPC call to BFF. **ETA:** 2-3 days.

### 7. Sortie B.7 — Phase F sortie 4 (mission E2E + ADR-0274 tables) (HIGH)

**Addresses:** F-ME-01, F-ME-07, F-ME-08, F-ME-02 (dangling deferral pointers), F-JR-02 (UltravoxVoice rename). **Pattern:** Migration for `engine_session_step` + `agent_inquiry` + `engine_sessions.context.authority_snapshot` JSONB constraint. Add `e2e_test` field to all 7 mission-adjacent journey docs. One persona spec per mission (BFF + UI layers; LiveKit transport itself can't be Playwright-tested). Rename `UltravoxVoice` → `VoiceId` across `missions/types.ts` + `index.ts`. **ETA:** 5-7 days. Largest sortie.

### 8. Sortie B.8 — ADR-0287 CI perimeter expansion + ADR-0303 sister-sweep allow-list (MEDIUM)

**Addresses:** ADR-0287 walk-scope gap (schedule hooks + BFF routes outside), F-DB-20/21/22/23 (engine_sessions + 14 governance + engine_authority_config + 3 D4 tables). **Pattern:** Extend `scripts/gate-action-coverage.ts` to walk `apps/web/src/app/**/_hooks/**` + `apps/web/src/app/api/**/route.ts`. Add `00004` + `engine_sessions` + `engine_inbox` + `engine_authority_config` + D4 planning tables to `scripts/check-rls-with-check.ts` allow-list; either apply per-verb split bulk migration OR add `-- @rls-exempt: ADR-NNNN` overrides with admin-only justification. **ETA:** 2-3 days.

### 9. Sortie B.9 — webhook + ADR drift hygiene (MEDIUM-LOW)

**Addresses:** F-WH-06/07/08/09/10, F-EF-06 (CRON_SECRET), F-CL-14 (cite_law L2/L3 drift), F-CL-15 (contract-service cross-check), F-CL-16 (ADR-0295 promote), ADR-0273 date fix, 13-file `Accepted` case sweep, ADR-0279/0283 frontmatter id mismatch, ADR-0260/0053 ship-or-kill decisions. **ETA:** 2-3 days.

### 10. Sortie B.10 — journey seed migration + landing perf parity (MEDIUM)

**Addresses:** F-JR-NEW-02 (move `seed.sql` 68 journeys into proper migration), F-01/F-02 (landing optimizePackageImports + Sentry gate parity with web), F-03 (landing Turbopack alias), F-04 (hardcoded color cleanup — DashboardShell first). **ETA:** 2-3 days.

---

## Slice-by-slice top finding

- **Slice 01 (capability-tools):** F-CT-02 HIGH — `journey/tools.ts:461-503` performs `engine_missions.insert()` + `engine_stages.insert()` OUTSIDE `gatedMutation.execute()` callback after `callGateAction()`. Pathway B (cascade_gate_write) never evaluated for these tables.
- **Slice 02 (stage-engine/BFF):** SE02-03 HIGH — `apps/web/src/app/api/emma/memory/route.ts:74` writes to `engine_memory` with no `gate_action` and no `emit()`. Law 2 + Law 4 double violation on an employee-facing route.
- **Slice 03 (edge-functions):** F-EF-05 HIGH — `supabase/functions/identify-company/index.ts` has `verify_jwt=false` + zero auth (no `verifyInternalAuth`, no JWT, no cron secret). Brreg lookup endpoint publicly callable.
- **Slice 04 (schedule-cascade):** F-SC-04-17 HIGH — `use-schedule-voice-tools.ts:854-882` voice tool `addSessionTaskTool` directly inserts to `department_session` + `session_task` (governance-gated D6 tables) with no gate and no emit.
- **Slice 05 (mobile-surface):** F-MO-05 HIGH — `use-recon-wizard.ts:200-248` still performs direct `daily_reconciliation` insert/update online path with body-supplied `settled_by` + `workspace_id`. No BFF route exists.
- **Slice 06 (contracts-payroll-lovsen):** F-CL-14 MEDIUM — `legal/tools.ts:400` cite_law tool body declares `allowedChannels: ["chat","voice"]` while capability Layer 2 narrowed to `["chat","system"]` after F-CL-11 closure. L3 doc comment lags L2 hardening.
- **Slice 07 (db-rls-telemetry):** F-DB-22 MEDIUM — `engine_authority_config.admin_manage_authority` is `FOR ALL USING(...)` with no WITH CHECK on the C4 governance table that controls `gate_action` outcomes. Multi-workspace admin could flip workspace_id on INSERT to configure another workspace's capability authority.
- **Slice 08 (journeys):** F-JR-NEW-02 HIGH unchanged — 68-journey seed lives only in `seed.sql`; production DB has zero journey rows because `supabase db push` does not apply seeds.
- **Slice 09 (adr-coverage-gaps):** ADR-0053 53 days proposed with no `services/simulator/` dir and no simulation migration — oldest unresolved ADR; 28 proposed ADRs ≥15 days; 13 capital-A `Accepted` case-typo files.
- **Slice 10 (onboarding-wizard):** F-OB-10-06 HIGH — `apps/web/src/app/onboarding/wizard-definition.ts:14,292` browser invokes `finalize-workspace` / `activate-workspace` EFs via `invokeEdgeFunction`. ADR-0179 violation; both EFs require JWT auth (no pre-workspace exception applies).
- **Slice 11 (performance-design):** F-01 + F-02 HIGH carry-forward — `apps/landing/next.config.ts:32` missing 5 `optimizePackageImports` packages vs web; `:89-93` `withSentryConfig` unconditional with no `VERCEL_ENV` gate. Web fixed; landing parity not landed since 2026-05-13.
- **Slice 12 (i18n-frontmatter):** F-03 HIGH — only 119 of 569 dashboard `.tsx` files import `@smartout/i18n` (20.9% per-file adoption). 35 hardcoded Norwegian toasts persist. Per-file adoption has NOT meaningfully changed since 2026-05-13 baseline.
- **Slice 13 (webhook-integration):** F-WH-05 HIGH NEW — DocuSeal webhook `route.ts:96` looks up via `docuseal_submission_id` (non-UNIQUE index). Replay on non-2xx response causes double-write to `employment_contract.status=active` + duplicate `engine_event`. Same idempotency class as F-WH-04 just closed.
- **Slice 14 (missions-e2e):** F-ME-07 HIGH unchanged — `mr-botsson` (primary in-product voice surface) has no journey doc, no `e2e_test` field, no Playwright spec across two audit cycles. F-ME-08 NEW: ADR-0274 stalled 11 days; `engine_session_step` + `agent_inquiry` tables absent — Welcome Mission V0 cannot durably recover.

---

## Cross-cutting recurring patterns

1. **ADR-0287 CI perimeter blindness** — Helper + workflow shipped, but `scripts/gate-action-coverage.ts` only walks `packages/ai/src/capabilities/`. Schedule hooks, BFF routes, and voice tools land HIGHs in the blind spot. Add to script walk scope (Sortie B.8).
2. **`gatedMutation` placement vs presence** — CI checks for identifier presence (`callGateAction`/`gatedMutation` in body) but not ordering (writes INSIDE `.execute()` callback). F-CT-02/03/05/08 show 5 capability tools where the gate is called but writes happen OUTSIDE. AST ordering check is the durable fix.
3. **Sister-table blindness propagating from CRITICAL to MEDIUM** — Sortie A.2 closed CRITICAL D6 holes. Same shape persists on engine_sessions + 14 governance + engine_authority_config + 3 D4 tables — MEDIUM/LOW only because admin-only or service-role-only. Bulk-patch with per-verb split OR rls-exempt comment with ADR justification.
4. **Cleanup never lands when runtime moves** — F-JR-02 (UltravoxVoice type still in `missions/types.ts` after runtime removal); F-OB-04 / F-OB-10-02 (Emma BFF orphan + `createOnboardingTools` agent-sdk export). ADR-0304 (proposed) formalizes the rule; needs acceptance + a sortie to act.
5. **Phase F sortie 4 keeps being deferred** — 5 journey docs since 2026-05-04 point to a sortie that does not exist (no branch, no plan, no Linear ticket). Two consecutive audits flag F-ME-01 + F-ME-07 unchanged. Open the sortie or amend the journey docs.
6. **L-0083 enforcement works when shipped as ESLint, not convention** — Mobile L-0083 violations finally remediated by `smartout/no-empty-string-identifier-fallback` ESLint rule at error severity. Same pattern should apply to L-0177 (workspace_id derivation fail-fast) and L-0176 (docstring vs body drift).

---

*Audit complete. 14 slices. 83 deduped findings after merge. 0 CRITICAL, 20 HIGH, 35 MEDIUM, 28 LOW. Campaign SAFE TO PROMOTE — no CRITICAL blockers. Top 10 backlog: capability ordering (F-CT-02/03/08), browser→EF survivor (F-OB-10-06/F-EF-02a), voice/schedule hook lifts (F-SC-04-17/F-SC-04-09), emma/memory + identify-company (SE02-03/F-EF-05), DocuSeal idempotency (F-WH-05), mobile PII (F-MO-05/06), seed migration (F-JR-NEW-02), mission E2E (F-ME-01/07/08). Primary remediation theme: extend ADR-0287 CI scope and lift schedule hooks into Server Actions following the OversiktTab pattern just shipped.*
