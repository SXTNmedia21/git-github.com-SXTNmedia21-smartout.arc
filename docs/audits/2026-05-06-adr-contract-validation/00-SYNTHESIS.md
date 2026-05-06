---
title: ADR + Contract Validation — Synthesis (14 slices)
status: draft
created: 2026-05-06
updated: 2026-05-06
module: audit
tags: [audit, adr, contract-validation, synthesis]
---

## Executive Summary

- **All five 2026-05-02 CRITICALs are CLOSED.** `engine-dispatch` / `validate-settlement` / `process-settlement-image` (slice 03), `docuseal-webhook` HMAC (slice 13), `journey-authoring/publishDraftTool` lying-docstring + ADR-0204 wrap (slice 01), and `legal/classify_amendment` missing gate body (slice 06) all verified fixed in code. `chat.ts:116-125` L-0177 silent fallback (slice 02) verified replaced by explicit 404. The CRITICAL surface area shrank from 5 → 2.
- **Two new CRITICAL unauth surfaces shipped post-baseline.** `journey-stuck-detector` uses a custom `isAuthorized()` that returns `true` when both `WATCHDOG_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are absent (slice 03 C-01). `bootstrap-cascade` accepts `verify_jwt=false` with zero inbound auth and performs 42 service-role mutations on a body-supplied `workspaceId` (slice 03 C-02). Same root pattern (failure to use `verifyInternalAuth()`) the baseline closed elsewhere — it regressed in two new functions.
- **`emit()` coverage and capability-gate compliance are partially fixed but pattern-replicating.** Capability-tool emit gaps closed for helpdesk_query, operations, contract (5 tools now emit), legal — but `outreach` shipped authority seed with **zero** registered telemetry events (slice 07 H-03), `engine_world` shipped a table without registry events or types (slice 07 H-01/H-02/M-04), and `sendEmployeeContract` still has zero emit (slice 06 F-01, persists from baseline). Same class of bug, new tables.
- **ADR-0204 §3 enforcement gap surfaces from a different angle.** `_shared.ts:101` calls `supabase.rpc("gate_action")` directly outside the orchestrator (slice 04 S04-01), affecting every dashboard Server Action. The CI grep `scripts/ci/no-inline-gate-rpc.sh` that ADR-0204 §3 specifies does not exist (slice 04 S04-05). Three Route Handlers carry the same violation. This was not caught at baseline because the audit slice did not look at `_actions/_shared.ts`.
- **Documentation drift is accelerating, not contained.** Decision-log duplicate rows: 8 baseline → 21 now (slice 09 M-01). Docs missing `module:` field: 491 baseline → 551 now (slice 12). ADR-0265 (canonical deploy) has zero log-table row (slice 09 H-03). ADR-0259 names its capability `industry_intelligence.lovsen_query` but the migration ships `legal` (slice 09 H-01). The Journey Portal's traceability index (ADR-0031 Phase 3) and the `packages/ai/src/journey/` registry (ADR-0038 Phase 2) still do not exist (slice 08).

---

## Critical Findings (Top 10, Ranked)

| # | Severity | Theme | Location | ADR(s) | Source slices | Proposed remediation | ETA |
|---|---|---|---|---|---|---|---|
| 1 | CRITICAL | Auth — unauth surface | `supabase/functions/journey-stuck-detector/index.ts:139` — `isAuthorized()` returns `true` when both secrets absent | ADR-0029 | 03 | Replace with `verifyInternalAuth()` from `_shared/internal-auth.ts` | 0.5 day |
| 2 | CRITICAL | Auth — unauth surface | `supabase/functions/bootstrap-cascade/index.ts:175-184` — `verify_jwt=false`, no inbound auth, 42 service-role mutations on body-supplied `workspaceId` | ADR-0029 | 03 | Add `verifyInternalAuth()` before adminClient instantiation | 0.5 day |
| 3 | HIGH | ADR-0204 §3 violation | `apps/web/src/app/dashboard/_actions/_shared.ts:101` — direct `supabase.rpc("gate_action")` outside orchestrator; affects every dashboard Server Action including session transition | ADR-0204 §3 | 04 | Route through `gatedMutation` orchestrator OR `gate-client.ts`; ship `scripts/ci/no-inline-gate-rpc.sh` and wire to ci.yml | 1-2 days |
| 4 | HIGH | Webhook fail-open | `supabase/functions/sendgrid-webhook/index.ts:59-71` — verification skipped entirely if `SENDGRID_WEBHOOK_VERIFICATION_KEY` missing; `platform_email_suppression` + `platform_communication_recipient` writable unauth | — | 13 | Flip to fail-closed: 500 on missing key | 0.5 day |
| 5 | HIGH | Auth — module-level undefined | `supabase/functions/cleanup-sandbox-workspaces/index.ts:11,16` — module-level `Deno.env.get` returns `undefined`, `Bearer ${undefined}` accepted from any caller; deletes sandbox workspaces + users via CASCADE | ADR-0029 | 03 | Move `Deno.env.get` inside `Deno.serve()`, add `!cronSecret` first guard | 0.5 day |
| 6 | HIGH | Capability boundary + tool emit | `packages/ai/src/capabilities/contract/tools.ts:331-406` — `sendEmployeeContract` zero emit (persists from baseline B4) | ADR-0004, ADR-0193 | 06 | Add `emit({ event: "contract sent", ... })` in success branch | 0.5 day |
| 7 | HIGH | Telemetry + types — new table dark | `engine_world` table (migration `20260525000000`) — missing from `database.types.ts`; no JWT/API-key write policies; zero registry events for observation/status writes; capability tool not built yet | ADR-0004 | 07 (H-01, H-02, M-04) | Regenerate types; register `engine_world.observation_written` / `engine_world.status_changed`; ship producer capability before scaling consumers | 1-2 days |
| 8 | HIGH | Telemetry — capability dark | `outreach` capability authority seed shipped (`20260525110000`) with zero registry events for `send_sms` / `call_employee` mutations | ADR-0004 | 07 (H-03) | Add `outreach.sms_sent` + `outreach.call_initiated` to `packages/telemetry/src/registry.ts` BEFORE outreach tools ship | 0.5 day |
| 9 | HIGH | BFF forward-channel leak | `/api/emma/chat/route.ts:192` + `/api/botsson/chat/route.ts:191` — BFF still sends `profile_id: profile.profile_id` in body; stage-engine ignores per ADR-0151 but field remains a forgeable injection vector if schema relaxes | ADR-0151 | 02 | Strip `profile_id` from BFF body; rely on JWT-derivation server-side | 0.5 day |
| 10 | HIGH | Telemetry — null at emit time | `apps/web/src/app/onboarding/page.tsx` (`AnimatedWizardShell`) emits `"wizard started"` on mount before async auth resolves → `workspace_id=null`, `actor_id="anonymous"` lands in `activity_trail` and PostHog | ADR-0134 | 10 | Gate `emitWizardStarted` until `workspaceId` is non-null; add fail-fast guard at `onComplete` for null workspaceId (currently silently falls through to `activate-workspace`) | 1 day |

**Tier-2 (HIGH but narrower blast radius):**
- `helpdesk_query` + `operations` mutations call `callGateAction` but skip `gatedMutation` (Pathway B) — SS-5 migration targets, undocumented at call sites (slice 01 F-01..F-04).
- `apps/web/src/app/api/observer-requests/[id]/route.ts:107` + `route.ts:93` + `apps/web/src/app/api/employment-contracts/bulk/route.ts:133` carry the same inline `gate_action` RPC pattern as Top-10 #3 (slice 04 S04-01).
- 6 mobile mutation hooks (`use-checklist`, `use-create-task`, `use-create-day-info`, `use-log-haccp`, `use-submit-handoff`, `use-report-deviation`) still use `nonEmpty(payload.workspaceId, ...)` instead of `getProfileContext()` — forgeable attribution, same class as ADR-0151 / L-0177 (slice 05 H1).
- Legacy chat path `apps/mobile/src/hooks/queries/use-botsson-chat.ts:393` + `apps/mobile/src/hooks/shift-clock/useShiftChat.ts:65,159` still inserts directly into `chat_message`. ADR-0132 R5 week-6 deadline missed (slice 05 H2).
- `BotssonSheet.tsx` + `BotssonProvider` retain dead Ultravox code paths and misleading comments after LiveKit migration (slice 05 H3).
- `services/stage-engine/src/routes/agent/dispatch.ts` + `routes/agent/queue.ts` PUT — zero emit + no workspace scope on queue.json patches (slice 02 F-03/F-04). `/agent/queue PUT` patches any task ID for any API-key holder.
- `STRIPE_WEBHOOK_SECRET` `.optional()` in env.ts; `LIVEKIT_WEBHOOK_SECRET` declared but unused in EF (uses API_KEY/SECRET) — env.ts maintenance traps (slice 13 H-01, H-03).
- `search-brreg` / `scrape-website` / `google-places-intelligence` / `web-search-intelligence` are fully public Edge Functions with `verify_jwt=false`, no auth — quota-drain surface for `SCRAPLING_AUTH_TOKEN` / `GOOGLE_API_KEY` / `SERPER_API_KEY` (slice 03 H-02). Either gate via `x-smartout-onboarding-token` or add to ADR-0123 pre-workspace exception list.

---

## Theme Rollup

| Theme | CRIT | HIGH | MED | LOW | Worst-offender file |
|---|---|---|---|---|---|
| Auth + authorization (gates / scope guards / dual-auth) | 2 | 5 | 2 | 2 | `bootstrap-cascade/index.ts` (no inbound auth, 42 mutations) |
| Workspace_id + profile_id derivation (L-0177, ADR-0151) | 0 | 3 | 4 | 0 | `_shared.ts:101` (Server Action inline gate_action) |
| Telemetry / emit() coverage (ADR-0004, ADR-0134) | 0 | 5 | 6 | 2 | `outreach` + `engine_world` (capability/table shipped without registry events) |
| Capability boundaries (frozen-4 / cross-namespace / ADR-0173/0240) | 0 | 1 | 1 | 1 | `journey-authoring/tools.ts:483,509` (still direct journey + journey_version writes) |
| Webhook security | 0 | 3 | 3 | 2 | `sendgrid-webhook/index.ts:59-71` (fail-open) |
| Mobile surface boundary (ADR-0127–0136, ADR-0238) | 1 | 3 | 4 | 1 | `ContentCreator.tsx:133` (direct write, no emit, no identity) |
| Cascade + schedule (ADR-0091/0156/0204) | 0 | 2 | 2 | 1 | `_shared.ts:101` (inline gate_action), `gate.ts:93` (sentinel SS-5) |
| Documentation + journeys + ADR drift | 1 | 4 | 4 | 4 | Decision log (21 duplicate ADR rows; 6 ADRs missing log-table) |
| i18n + design tokens | 0 | 1 | 2 | 3 | `apps/web/src/app/` (373 `orange-*` Tailwind classes bypass `--brand-orange`) |
| Performance + Turbopack | 0 | 2 | 2 | 1 | `next.config.ts:185` (`ignoreBuildErrors: true` no expiry) |
| Missions + E2E + Protocol | 0 | 3 | 1 | 1 | `apps/e2e/tests/protocol.spec.ts` (P-001 hard-skipped, no testid owner); ci.yml has zero Playwright job |

---

## ADR Conflict Table (claimed vs reality)

| ADR | Decision-log status | Reality (per slice) | Slice |
|---|---|---|---|
| ADR-0019 | accepted | `perf-budgets` CI job absent; `docs/cross-cutting/performance-governance.md` does not exist; budget files exist but never invoked | 11 |
| ADR-0029 | accepted | 5 EF surfaces still effectively unauth (`journey-stuck-detector`, `bootstrap-cascade`, `cleanup-sandbox-workspaces`, plus 4 fully-public intelligence EFs not in ADR-0123 exception list) | 03 |
| ADR-0031 | accepted | Phase 3 traceability index does not exist; `e2e_test:` field on 25/221 (11%); ADR-0038 `packages/ai/src/journey/` is single-file stub — generators live in `apps/e2e/generators/` | 08 |
| ADR-0038 | accepted | Package boundary violated; `registry.ts` / `manifest.ts` / `types.ts` / `index.ts` absent; output generators drifted into `apps/e2e/` | 08 |
| ADR-0041 | superseded | File now correctly `superseded`; resolved | 09 (RESOLVED), 10 |
| ADR-0091 | accepted (Pathway B WP2) | `cascade_gate_write` RPC compliant from `gatedMutation`; tools.ts no longer direct-writes — RESOLVED in slice 04 | 04 (RESOLVED) |
| ADR-0115 | accepted | `NordicSkeleton` named export still does not exist anywhere | 09 |
| ADR-0122 | proposed | Only 1 of 7 governance events registered (`policy created`); other 6 absent | 09 |
| ADR-0132 R5 | accepted | Mobile chat_message direct insert deadline (week-6) missed; 2 hooks still write directly | 05 |
| ADR-0134 | accepted | `ShiftTimelineContainer.tsx:46` "anonymous" closed; 6 caller-supplied-ID hooks still bypass `getProfileContext()` | 05 |
| ADR-0151 | accepted | `_shared.ts:101` inline gate_action; `contract-service` POST /contracts uses `body.workspace_id`; BFF still forwards `profile_id` in chat body; stage-engine ignores but vector remains | 02, 04, 06 |
| ADR-0156 | accepted | `OverviewTab.tsx:7` imports `next/navigation` — Phase 1 portability rule violated; blocks Phase 2 extraction to `packages/ui/day-control/` | 04 |
| ADR-0173 / ADR-0240 | accepted / proposed | `journey-authoring/publishDraftTool` still writes `journey` + `journey_version` directly (gated, but cross-namespace boundary intact). Code comment acknowledges 2026-05-02 audit | 01, 09 |
| ADR-0204 §3 | accepted | `scripts/ci/no-inline-gate-rpc.sh` does not exist; `_shared.ts:101` + 3 route handlers carry the merge-blocker pattern; `gate.ts:93` SS-5 sentinel persists | 04 |
| ADR-0218 | proposed | Dual-write only on `/join` path (slice 09); `/onboarding` (legacy) does not write `workspace_operating_hours` | 09 |
| ADR-0238 | proposed | `useDomainChatOwnership` / `<DomainChatOwnership>` does not exist anywhere in codebase; `/onboarding` mounts BotssonProvider with no ownership declaration → dual-surface risk | 10 |
| ADR-0246 / ADR-0247 / ADR-0248 | proposed | Zero implementation; `engine_state` migration unstarted; lifecycle events not in registry (`engine_step.reached`, `engine_run.completed`, `engine_run.failed`) | 02 |
| ADR-0249 | accepted | `cite_law.execute()` lacks Layer 3 channel guard; capability `allowedChannels` union too broad; classify_amendment authority seeded at capability-level `manager`, not per-action `admin` | 06 |
| ADR-0255 | proposed | Phase 0 `/agent/dispatch` + Phase 0.5 queue.json exist; zero telemetry; "no workspace authority" intentional but undocumented as exception | 02 |
| ADR-0259 | accepted | Names capability `'industry_intelligence.lovsen_query'`; migration + ADR-0249 ship `'legal'` — name conflict | 06, 09 |
| ADR-0260 | proposed | Cabinet Grotesk swap not done; Instrument Serif still in WelcomeWizard; ADR not advanced | 09 |
| ADR-0265 | accepted | Zero log-table row; comment-only registration; canonical deploy ADR not searchable in log | 09 |
| **21 ADRs** | duplicate rows | `0041, 0085, 0099, 0101, 0107, 0108, 0134, 0151, 0156, 0157, 0158, 0171, 0172, 0173, 0174, 0175, 0176, 0177, 0271, 0272, 0273` carry both `proposed` and `accepted` rows | 09 |
| **13 ADRs** | wrong case | `status: Accepted` instead of `status: accepted` — escapes lowercase grep | 09 |

---

## Slice Contradictions

- **ADR-0091 status:** Slice 04 marks ADR-0091 `shift-lifecycle/tools.ts` direct write as **RESOLVED** (gate.ts now delegates to `gatedMutation`; tools.ts calls `callGateAction`). Baseline marked it as a HIGH violation. Reconciliation: gate.ts is now compliant with ADR-0091 Pathway B but the SS-5 sentinel `execute: () => ({ ok: true })` (slice 04 S04-02) is the residual atomicity gap — separate finding, separate severity. Both correct; ADR-0091 closed, SS-5 still open.
- **`profile_id` server-derivation status:** Slice 02 finds BFF still forwards `profile_id` in body (HIGH). Slice 06 finds `contract-service` POST /contracts uses `body.workspace_id` (HIGH F-02). Slice 01 marks all capability tools as ADR-0151 PASS (no body-supplied profile_id reaches tool). No contradiction — three different layers, two leak vectors (BFF→stage-engine forward channel + service-internal body trust). Capability layer is clean; the boundary leaks are upstream/downstream.
- **`use-roster.ts` status:** Slice 04 marks the prior FP-003 (department NULL filter) RESOLVED via `position!inner` join. Memory file `reference_schedule_shift_fetch_pattern.md` still flags it. Reconciliation: hook no longer handles `schedule_shift` filtering directly per slice 04 verification. Memory is stale; update.
- **i18n adoption baseline:** Slice 12 reports 9.5% baseline → 15.2% current (with surface adjustment from 1754 files → 1077 .tsx-only). Apples-to-apples is +5.7pp. Baseline 12 reports 9.5% on full src; new measurement is .tsx-only. Real growth: marginal but positive. No contradiction once surface is normalized.
- **P-LOGIN status:** Baseline says "only one Protocol (P-001), permanently skipped." Slice 14 finds P-LOGIN as a second active protocol embedded inline in its spec. Reconciliation: baseline missed the inline protocol. P-LOGIN does generate GUIDE + AUDIT (locally only); P-001 still skipped. CI gap (zero Playwright job) is the real story.
- **`workspace_id` resolution at finalization:** Slice 10 reports MEDIUM-1 (race at `wizard started`) and MEDIUM-2 (silent fallback to `activate-workspace` if null at `onComplete`). Slice 10 also notes baseline finding "zero finalization telemetry" is CLOSED via `useWizardTelemetry.onComplete` + `useOnboardingState.ts:861`. Reconciliation: emit coverage closed; null-race + null-fallthrough are new findings on the same surface — partially closed, partially regressed.

---

## Delta vs 2026-05-02

### Closed (CRITICAL → resolved)

| Baseline finding | Slice | Closed evidence |
|---|---|---|
| `engine-dispatch` no inbound auth | 03 | `verifyInternalAuth()` shared helper in use |
| `validate-settlement` no auth | 03 | `verifyInternalAuth()` at top of `Deno.serve()` |
| `process-settlement-image` no auth | 03 | `verifyInternalAuth()` at top of `Deno.serve()` |
| `docuseal-webhook` env optional + raw-secret string equality | 13 | `z.string().min(16)` required + HMAC-SHA256 + `timingSafeEqual` |
| `journey-authoring/publishDraftTool` lying-docstring + 3 direct writes | 01 | All 3 writes inside `gatedMutation()`; docstring corrected; ADR-0240 cross-namespace gap acknowledged at line 454-457 |
| `legal/classify_amendment` zero `callGateAction` | 06 | `callGateAction` at line 263, fail-closed |
| `chat.ts:116-125` L-0177 silent wizard fallback | 02 | Explicit 404 on row missing; `nonEmpty(wizardRow.workspace_id, ...)` on success path |
| 11 weak cron guards (`if (cronSecret && ...)`) | 03 | 19/20 cron-guarded EFs use fail-closed `if (!cronSecret \|\| ...)` (one survivor: `cleanup-sandbox-workspaces`, see CRIT #5) |
| `channel_department_access` + `channel_team_access` zero-policy lockout | 07 | `20260520170000_channel_access_rls_policies.sql` |
| `ShiftTimelineContainer.tsx:46` `actorId = ?? "anonymous"` | 05 | Now uses `getProfileContext()` throughout |
| `use-swap.ts` empty `workspace_id: ""` | 05 | Routes via BFF; `getProfileContext()` before emit |
| `use-punch.ts:141-142` `workspace_id: null` | 05 | `getProfileContext()` at line 100 |
| `use-create-shift.ts:69` `actor_id: ""` | 05 | Mobile shift-create removed; BFF delegation |
| `webpack` dev flag + Sentry rewrite + zinc/gray palette | 11 | All RESOLVED (zinc/gray now 0 instances in `apps/web/src/app/`) |
| Zero finalization telemetry on `wizard-definition.ts:onComplete()` | 10 | `useWizardTelemetry.onComplete` + `useOnboardingState.ts:861` emit |
| Contract tools (5) without `callGateAction` | 06 | All 5 now call `gateMutation()` → `callGateAction` |
| Contract/legal tools zero emit | 06 | createEmployeeContract / forkTemplate / publishWorkspaceTemplate / deprecateWorkspaceTemplate / validateAml146 / citeLaw / classifyAmendment all emit |
| ADR-0041 stale | 09 | File now `status: superseded` |

**Closed count: ~20.**

### Regressed

| Item | Slice | Notes |
|---|---|---|
| Decision-log duplicate ADR rows | 09 | 8 baseline → 21 now |
| Docs missing `module:` field | 12 | 491 → 551 (+60) |

(No code regressions — drift is documentation-only.)

### New (not in baseline)

CRITICAL (2): `journey-stuck-detector` `isAuthorized()` (slice 03 C-01); `bootstrap-cascade` no inbound auth on 42 mutations (slice 03 C-02).

HIGH (~14):
- `_shared.ts:101` inline `gate_action` RPC (slice 04 S04-01)
- `journey-stuck-detector` already counted CRIT
- `cleanup-sandbox-workspaces` `Bearer undefined` bypass (slice 03 H-01)
- `search-brreg` / `scrape-website` / `google-places-intelligence` / `web-search-intelligence` fully public (slice 03 H-02)
- `gather-workspace-intelligence` / `identify-company` optional auth quota drain (slice 03 H-03)
- `engine_world` missing from `database.types.ts` + write path dark + zero registry events (slice 07 H-01/H-02/M-04)
- `outreach` capability zero registry events (slice 07 H-03)
- `BotssonSheet`/`BotssonProvider` dead Ultravox paths and misleading comments (slice 05 H3)
- BFF forward `profile_id` leak (slice 02 F-01/F-02)
- `/agent/dispatch` + `/agent/queue PUT` zero emit + no workspace scope (slice 02 F-03/F-04)
- `OverviewTab.tsx:7` `next/navigation` Phase 1 portability violation (slice 04 S04-04)
- `sendgrid-webhook` fail-open on missing key (slice 13 H-02)
- `STRIPE_WEBHOOK_SECRET` `.optional()` maintenance trap (slice 13 H-01)
- `LIVEKIT_WEBHOOK_SECRET` dead env entry (slice 13 H-03)
- `ignoreBuildErrors: true` no expiry (slice 11 F-11-02)
- 373 `orange-*` palette bypass (slice 11 F-11-03)
- `OnboardingProvider` not mounted but `sections/` + `components/` import `useOnboarding` — latent crash (slice 10 HIGH-1)
- `wizard started` emit before workspace_id resolves (slice 10 MEDIUM-1)
- `onComplete` null `workspaceId` silent fallthrough to `activate-workspace` (slice 10 MEDIUM-2)
- ADR-0259 vs ADR-0249 capability-name conflict (slice 09 H-01)
- ADR-0265 missing log-table row (slice 09 H-03)
- `packages/ai/src/journey/` package stub — only `compile.ts` (slice 08)

MEDIUM (~14): `salary_type` + `end_date_reason` no RLS persists (slice 07 M-01); `gate_evaluated` emit unregistered (slice 07 M-02); `billing.accountant_company_grant` no API-key policy (slice 07 M-03); tariff tier-3 fallback silent (slice 04 S04-03); cite_law no Layer 3 channel guard (slice 06 F-03); payroll missing `set_trade_union_membership` + GDPR Art. 9 docs (slice 06 F-04); contract-service routes zero emit (slice 06 F-05); engine-dispatch ADR-0078 channel check unverified at EF layer (slice 03 M-03); ADR-0077 PII sensitivity tagging unverified at EF layer (slice 03 M-01); ops-* functions outside gateway (slice 03 M-02); LiveKit idempotency not DB-enforced (slice 13 M-01); SendGrid bounce dedup (slice 13 M-02); no rate-limit on webhooks (slice 13 M-03); P-LOGIN missing MISSION-DRAFT (slice 14).

LOW (~12): see slice details for cosmetic/cleanup items.

### Unchanged Open

- `gatedMutation` SS-5 atomicity gap (`gate.ts:93` sentinel) — slices 04 + 07
- `gate_evaluated` emit unregistered — slice 07 M-02
- `salary_type` + `end_date_reason` no RLS — slice 07 M-01
- `journey-authoring` direct `journey` + `journey_version` writes (ADR-0240 delegation pending) — slices 01 + 09
- 6 mobile mutation hooks caller-supplied workspace_id without `getProfileContext()` — slice 05 H1
- ADR-0115 `NordicSkeleton` not exported — slice 09 L-03
- ADR-0122 governance events 6 of 7 unregistered — slice 09 H-02
- ADR-0218 dual-write `/onboarding` path missing — slice 09 M-03
- ADR-0238 `useDomainChatOwnership` not built — slice 10 HIGH-2
- ADR-0246/0247/0248 zero progress — slice 02
- P-001 hardcoded skip — slice 14
- `chat_message` legacy direct insert deadline missed — slice 05 H2
- `sendEmployeeContract` zero emit — slice 06 F-01
- `perf-budgets` CI job absent — slice 11 F-11-01
- i18n adoption barely improved — slice 12

**Delta summary counts:** ~20 closed, 2 regressed (docs only), ~30 new (2 CRIT + ~14 HIGH + ~14 MED), ~15 unchanged-open.

---

## Forward Plan — Ranked Sortie List

**Sortie 1 — Stop the bleeding (CRITICAL auth, 1 day, sequential)**

1. Add `verifyInternalAuth()` to `journey-stuck-detector/index.ts` (replace custom `isAuthorized()`).
2. Add `verifyInternalAuth()` to `bootstrap-cascade/index.ts` before adminClient instantiation.
3. Move `Deno.env.get` inside `Deno.serve()` in `cleanup-sandbox-workspaces/index.ts`, add `!cronSecret` first guard.

These three are the same fix pattern already shipped in 19 other EFs. One PR, one reviewer.

**Sortie 2 — Webhook + env hygiene (HIGH, 1 day, parallel to Sortie 1)**

4. Flip `sendgrid-webhook` to fail-closed: 500 if `SENDGRID_WEBHOOK_VERIFICATION_KEY` missing.
5. Decide on `STRIPE_WEBHOOK_SECRET` and `LIVEKIT_WEBHOOK_SECRET` in env.ts: either remove (if owned by Supabase secrets) or `.min(1)`.
6. Add `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` null-guards in `livekit-webhook` before `WebhookReceiver` construction.
7. Strip `profile_id` from BFF chat body (`/api/emma/chat`, `/api/botsson/chat`); rely on JWT-derivation server-side.

**Sortie 3 — ADR-0204 §3 enforcement (HIGH, 1-2 days)**

8. Ship `scripts/ci/no-inline-gate-rpc.sh` and wire into `ci.yml`. Pattern: `grep -rn "rpc('gate_action'\|rpc(\"gate_action\")" --include="*.ts" --exclude-dir=node_modules` excluding `gatedMutation.ts` + `gate-client.ts`.
9. Migrate `_shared.ts:101` + 3 route handlers (`observer-requests/route.ts:93`, `observer-requests/[id]/route.ts:107`, `employment-contracts/bulk/route.ts:133`) through `gatedMutation` orchestrator.
10. Land SS-5 transactional atomicity (replace `gate.ts:93` sentinel `execute` with real domain write inside the orchestrator transaction).

**Sortie 4 — Telemetry coverage sweep (HIGH, 2-3 days, parallel to Sortie 3)**

11. Register `outreach.sms_sent` + `outreach.call_initiated` in `packages/telemetry/src/registry.ts` BEFORE any outreach tool ships.
12. Register `engine_world.observation_written` + `engine_world.status_changed`. Regenerate `database.types.ts` against migrated DB (covers H-01).
13. Register `gate_evaluated` event; emit from `gatedMutation` SS-5 success path. Closes slice 07 M-02.
14. Register the 6 missing ADR-0122 governance events (`policy updated`, `policy archived`, `protocol created/updated`, `procedure created`, `protocol assignment updated`).
15. Add emit to `sendEmployeeContract.execute()` success path. Closes baseline B4.
16. Add emit to `/agent/dispatch` and `/agent/queue PUT`. ADR-0255 Phase 0 telemetry contract.
17. Add `engine_event` destination to `personal.task_created` if/when due-date enforcement wired.

**Sortie 5 — Mobile remediation (HIGH, 2-3 days, parallel)**

18. Replace `nonEmpty(payload.workspaceId, ...)` with `getProfileContext()` in 6 mobile mutation hooks (use-checklist, use-create-task, use-create-day-info, use-log-haccp, use-submit-handoff, use-report-deviation, plus use-send-channel-message).
19. Fix `ContentCreator.tsx:133` — route via BFF or add `getProfileContext()` + `emit()`.
20. Migrate `use-botsson-chat.ts:393` + `useShiftChat.ts:65,159` to BFF; collapse dual chat_message persistence (ADR-0132 R5 deadline-overdue).
21. Strip dead Ultravox paths from `BotssonSheet.tsx` + `BotssonProvider`; update comments.
22. Delete or guard `OnboardingProvider`-dependent files in `sections/` + `components/` (slice 10 HIGH-1 latent crash).

**Sortie 6 — Onboarding wizard hardening (MEDIUM, 1-2 days)**

23. Gate `emitWizardStarted` until `workspaceId` is non-null.
24. Add fail-fast guard at `wizard-definition.ts:onComplete` — throw if `state.workspaceId` is missing (close MEDIUM-2).
25. Either ship `<DomainChatOwnership>` for `/onboarding` (advance ADR-0238 to accepted) OR formally suppress the Orb on `/onboarding` via layout.

**Sortie 7 — Schema + RLS + reference cleanup (MEDIUM, 1-2 days)**

26. Add read-only RLS for `salary_type` + `end_date_reason` (closes baseline + slice 07 M-01).
27. Add `UNIQUE(idempotency_key)` to `engine_event`. Fixes LiveKit dedup (slice 13 M-01).
28. Add API-key read policy + admin JWT write path for `billing.accountant_company_grant` (slice 07 M-03).
29. Decide ADR-0123 amendment: register the 4 fully-public intelligence EFs as pre-workspace exceptions OR add `x-smartout-onboarding-token` lightweight check.

**Sortie 8 — Documentation drift cleanup (LOW-MEDIUM, ongoing)**

30. Dedupe decision log: 21 ADRs with both proposed + accepted rows. Single CSV-driven cleanup.
31. Add log-table rows for ADR-0265, ADR-0179, ADR-0180, ADR-0192, ADR-0168, ADR-0169 (currently log-table-orphans).
32. Resolve ADR-0259 vs ADR-0249 capability-name conflict (either supersede 0259 or update migration to alias name).
33. Mark ADR-0053 as `archived` if simulator service is not being pursued.
34. Normalize 13 `status: Accepted` → `status: accepted`.
35. Backfill 162 JOURNEY files with `e2e_test: null`.
36. Build `journey-slug → engine_process_id` traceability index (ADR-0031 Phase 3).
37. Move output generators back to `packages/ai/src/journey/` per ADR-0038 (or formally amend ADR-0038 to put them in `apps/e2e/generators/`).

**Sortie 9 — i18n + design tokens (MEDIUM, 1 sortie + ongoing)**

38. Replace 373 `orange-*` Tailwind classes with `bg-brand-orange` / `text-brand-orange` / `border-brand-orange/20`.
39. Replace 43 hardcoded `Lagre` / `Avbryt` / `Slett` / `Lukk` / `Bekreft` / `Rediger` occurrences with i18n keys (all keys exist in `common.json`).
40. Add ESLint rule for hardcoded Norwegian strings; warn-mode initially.

**Sortie 10 — Performance + Build governance (MEDIUM, 1 sortie)**

41. Wire `perf:audit` into `ci.yml` as `perf-budgets` job (warn mode).
42. Create `docs/cross-cutting/performance-governance.md` (ADR-0019 reference).
43. Add Linear ticket + 2-week deadline for `ignoreBuildErrors: true` removal.
44. Verify Turbopack `resolveAlias` semantics for root `@smartout/ai` key (or order subpath aliases first in config).

**Sortie 11 — E2E + Protocol gating (LARGER, multi-sortie)**

45. Add Playwright job to `ci.yml`. Block PRs to `development` on E2E green. Initial scope: `tests/auth/`, `tests/dashboard/`, `tests/landing/`. Ramp up from there.
46. Route P-001 missing data-testids to `frontend-designer` agent. Un-skip protocol.spec.ts once they ship.
47. Seed `Anna Olsen` fixture profile to close 19 cascading "fixture gap" skips.

**Parallelism guide:**
- **Sortie 1** is sequential and must land first (or alongside Sortie 2 in the same PR).
- **Sortie 2 + Sortie 3 + Sortie 4 + Sortie 5** are independent — parallel.
- **Sortie 6** depends on no other sortie but should pair with Sortie 5 mobile work for review continuity.
- **Sortie 7** is independent; small.
- **Sortie 8 + Sortie 9 + Sortie 10** are documentation/governance, never block code.
- **Sortie 11** is the largest; can run continuously.

---

## Slice-by-Slice Top Finding

- **[01 — Capability tools](./01-capability-tools.md):** `helpdesk_query` + `operations` mutations call `callGateAction` (Pathway A) but skip `gatedMutation` orchestrator (Pathway B) — ADR-0204 SS-5 migration targets, undocumented at call sites; baseline CRITICAL on `journey-authoring/publishDraftTool` and `legal/classify_amendment` both CLOSED.
- **[02 — Stage Engine + BFF](./02-stage-engine-bff.md):** L-0177 baseline CLOSED at `chat.ts:116-125`. New: BFF still forwards `profile_id` in body (forgeable injection vector if schema relaxes); `/agent/dispatch` + `/agent/queue PUT` zero emit + no workspace scope.
- **[03 — Edge Functions](./03-edge-functions.md):** Three baseline CRITICALs CLOSED. Two new CRITICALs: `journey-stuck-detector isAuthorized()` opens when both secrets absent; `bootstrap-cascade` zero auth on 42 service-role mutations.
- **[04 — Schedule + Cascade](./04-schedule-cascade.md):** ADR-0091 RESOLVED. New HIGH: `_shared.ts:101` inline `gate_action` RPC outside orchestrator — affects every dashboard Server Action. ADR-0204 §3 CI grep `no-inline-gate-rpc.sh` does not exist.
- **[05 — Mobile Surface](./05-mobile-surface.md):** L-0083 "anonymous" CLOSED everywhere. New CRIT: `ContentCreator.tsx:133` direct write, no emit, no identity. Six caller-supplied-workspace_id hooks still bypass `getProfileContext()` (forgeable attribution).
- **[06 — Contracts + Payroll + Lovsen](./06-contracts-payroll-lovsen.md):** 3 of 4 baseline findings CLOSED. New HIGH: `contract-service` POST /contracts uses `body.workspace_id` not `request.workspaceId`; `sendEmployeeContract` zero emit persists.
- **[07 — DB + RLS + Telemetry](./07-db-rls-telemetry.md):** `channel_*_access` baseline CLOSED. New HIGH: `engine_world` table missing from `database.types.ts` + zero registry events; `outreach` capability authority seed shipped without registry events.
- **[08 — Journeys](./08-journeys.md):** Coverage ratio unchanged (196/221 zero E2E coverage; corpus grew). `packages/ai/src/journey/` is single-file stub — `registry.ts` / `manifest.ts` / `types.ts` absent (ADR-0038 placement violation; generators live in `apps/e2e/generators/`).
- **[09 — ADR Coverage Gaps](./09-adr-coverage-gaps.md):** ADR-0265 (canonical deploy) has zero log-table row. ADR-0259 names capability `industry_intelligence.lovsen_query`; migration ships `legal`. 21 ADRs have duplicate proposed/accepted rows (8 baseline → 21 now).
- **[10 — Onboarding Wizard](./10-onboarding-wizard.md):** ADR-0041 superseded RESOLVED. New HIGH: `sections/` + `components/` import `useOnboarding` from `WizardContext.tsx` but `OnboardingProvider` is never mounted — latent crash. ADR-0238 `<DomainChatOwnership>` does not exist anywhere.
- **[11 — Performance + Design](./11-performance-design.md):** 4 baseline items resolved (webpack flag, Sentry, zinc/gray, Turbopack alias block exists). New HIGH: `ignoreBuildErrors: true` no expiry; 373 `orange-*` Tailwind palette bypass `--brand-orange` token; `perf-budgets` CI job still absent.
- **[12 — i18n + Frontmatter](./12-i18n-frontmatter.md):** i18n adoption +5.7pp (15.2% .tsx-only). Docs frontmatter regression: 491 → 551 missing `module:`. 65% stale `updated:` dates from 2026-04-20 mass commit.
- **[13 — Webhook Integration](./13-webhook-integration.md):** All 3 baseline DocuSeal CRITICALs CLOSED. New HIGH: SendGrid fail-open; `STRIPE_WEBHOOK_SECRET` `.optional()`; `LIVEKIT_WEBHOOK_SECRET` dead env entry.
- **[14 — Missions + E2E Protocols](./14-missions-e2e.md):** Baseline P-001 skip CONFIRMED. P-LOGIN found as second active protocol. Zero Playwright job in `ci.yml` — 151 specs, 183 skips, never gate a merge. 6 missions with zero E2E coverage of mission behavior.

---

## Total Counts

- **Total findings (deduped):** ~95 (across 14 slices, with cross-slice duplicates merged)
- **Critical:** 2 (down from 5 baseline)
- **High:** 27 (up from 18 baseline)
- **Medium:** 38
- **Low / Info:** 28

**Net delta:** 5 baseline CRITICALs all closed. Two new CRITICALs surfaced from the same root pattern as the baseline three (failure to use `verifyInternalAuth()`) — but in different EFs that escaped baseline scope. HIGH grew because slices 04, 05, 09, 10, 11, 13 found patterns the baseline missed (inline gate_action RPC outside orchestrator; new mobile surfaces; ADR-0265 / 0259 conflicts; latent onboarding crash; orange-palette debt; webhook env-classification gaps).

The dominant theme this run: **same bug class, new tables/files**. emit() coverage closed in 5+ capability tools but reopens with `outreach` and `engine_world`. Auth fail-closed pattern shipped in 19 EFs but two new EFs (`journey-stuck-detector`, `bootstrap-cascade`) shipped with the broken pattern. ADR-0204 §3 acceptance landed but `_shared.ts:101` carries the merge-blocker. The remediation pipeline needs to push compliance into review templates and CI grep gates, not just fix-by-fix.
