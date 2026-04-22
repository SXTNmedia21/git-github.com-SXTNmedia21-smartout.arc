---
title: "Campaign — journey-engine"
status: active
updated: 2026-04-22
created: 2026-04-21
module: journey-engine
tags: [campaign, roadmap, journey-ir, event-engine]
---

# Campaign — journey-engine

> Branch: `campaign/journey-engine` | Worktree: `~/dev/smartout.ai-journey-engine` | Module: journey-engine | Started: 2026-04-21

## Vision

One Journey Engine that runs three experiences from one intermediate representation. `JourneyIR` is the single source; from it flow five artefacts (Playwright script, Mission, USER-GUIDE, Inference pattern, Fjernkontroll card) across three surfaces (dev test-run, docs & mission publish, runtime agent-guided). No parallel systems. No drift. This campaign is the canonical implementation of the 2026-04-21 Journey Runner Suite council verdict (APPROVE WITH CHANGES → v1.7.0), binding all 7 ADRs (0171–0177) and all 5 learnings (0094–0098).

## Scope

### In scope

- `packages/journey-ir` — canonical IR package (ADR-0171)
- `packages/ai/src/capabilities/journey/*` — four capability skeletons (ADR-0173)
- `packages/telemetry/src/registry.ts` — five journey events (ADR-0175)
- `apps/web/src/app/platform-admin/journeys/*` — authoring + publish surface
- `apps/e2e/generators/*` — Mission / Docs / Audit retarget to JourneyIR via `protocolToJourneyIR()` adapter (ADR-0174)
- `apps/web/src/components/journey/*` + mobile BFF thin-client proxy — Fjernkontroll state machine (ADR-0177)
- `supabase/functions/journey-stuck-detector/*` — stuck detection Edge Function
- `supabase/migrations/*` — enum lifecycle (ADR-0172) + C4 authority seed (ADR-0176)
- `scripts/close-feature.sh` — additions for journey-specific gates

### Explicitly out of scope

- Protocol Verification Engine internals (ADR-0074 legacy) — wrapped via adapter, not refactored here.
- D6 sessions / hooks / tasks — `campaign/daily-operation`.
- Season / planning cycle — `campaign/year-wheel`.
- Helpdesk tickets — `campaign/helpdesk`.
- Stage engine / agent router / voice — `campaign/botsson-arena`.
- Edge Functions other than `journey-stuck-detector`.
- Mobile authoring / publish (only `journey.run_guided` surfaces on mobile, via BFF).

## Trust-Gate Unblocks

All seven must be green before v1.7.0 spec approval (M2 exit gate).

| # | Unblock | ADR | Milestone | Status |
|---|---|---|---|---|
| 1 | Telemetry registry (5 journey events, 4 destinations each) | 0175 | M1 | ✅ green — S1.1 (`05b827b1`) registered 5 events + 4 destinations; `activity_trail` flat-payload widen + `AuthorityLevel` header. |
| 2 | `journey_version_status` enum 0a/0b/0c migration | 0172 | M1 | ✅ green — S1.2 (`eef0b78d`) landed `journey_version` table + 4-migration 0a/0b/0c lifecycle. |
| 3 | C4 authority seed migration (4 rows) | 0176 | M1 | ✅ green — S1.3 (`fdfe1575`) seeded 4 rows/workspace via `20260516000400_journey_authority_seed.sql`. |
| 4 | Capability skeletons (4) with correct authority defaults | 0173 | M1 | ✅ green — S1.4 (`10072db2`) registered 4 capabilities with ADR-0134 guard + ADR-0078 chat-only. |
| 5 | `packages/journey-ir` created; zero `packages/ai/src/journey` refs | 0171 | M2 | ✅ green — S2.1 (`9c1f9714`) scaffolded `@smartout/journey-ir`; S2.2 (`c35a690f`) retired legacy `compile.ts`, retargeted sole consumer, deleted path. Typecheck 35/35 PASS. |
| 6 | `actor_id` resolution doc (dev / publish / runtime / mobile) | 0176 | M2 | ✅ green — S2.3 (`1de9360c`) appended Actor ID Resolution section to ADR-0176: per-surface table + empty-string-fallback ban + server-side BFF derivation (CVE-class) + ADR-0134 link. |
| 7 | ADR-0074 unification delta spec (adapter + cutover + deletion window) | 0174 | M2 | ✅ green (both obligations) — **spec obligation** closed at M2 (`888d5b4a`): ADR-0174 extended with adapter TS signature, 12-step cutover checklist, deletion window, rollback policy. **Cutover obligation** closed at M3.5 (2026-04-22): C.1–C.10 landed at M3 (`8f2defc9`); C.11 deferred to M3.5 per §E row 3; M3.5 bumped `JourneyIR` to v2 (ADR-0178), retargeted protocol-runner to consume IR natively, deleted adapter + `ProtocolSource` + `adapters/` directory. Grep `protocolToJourneyIR` = 0 and `ProtocolSource` = 0. |

**M1 exit (2026-04-22):** 4/7 unblocks closed. ADRs 0172 / 0173 / 0175 / 0176 bumped `proposed → accepted`. 0171 / 0174 / 0177 remain `proposed`.

**M2 exit (2026-04-22):** 7/7 unblocks closed (spec obligation). system-steward delta verdict PASS (all GREEN, code-traced, typecheck 35/35 in 1m33s). ADRs 0171 / 0174 bumped `proposed → accepted`. 0177 remains `proposed` (M4 work). Spec v1.7.0 integrated all council-mandated corrections. **M3 (generator unification) unlocked.**

**M3 exit (2026-04-22, partial):** C.1–C.10 landed (`8f2defc9`). C.11 (adapter deletion) deferred to a follow-up sub-sortie per ADR-0174 §E row 3 ("Extend `JourneyIR` (additive), not `ProtocolSource`"). M4 unlocked by code (generators already on JourneyIR); M6 blocked until C.11 closes.

**M3.5 exit (2026-04-22):** C.11 closed via ADR-0178 resumption path. JourneyIR bumped `"1.0.0"` → `"2.0.0"` additively (optional `actor`, `platform`, `auth_profile`, `preconditions`, `entry_url`, `success_gate`, per-step `actions` / `gate` / `order` / `screenshot` / `description`). Protocol-runner + gate-checker + progress-writer retargeted to consume `JourneyIR` natively. Sample files rewritten to emit IR v2 directly. Adapter, its test, `ProtocolSource`, and `adapters/` directory deleted. ADR-0178 bumped `proposed → accepted`. ADR-0174 appendix added. M6 unblocked. Footnote: Unblock #7 now carries **two** obligations — the _spec obligation_ (documentation of cutover) closed at M2, and the _cutover obligation_ (grep=0 post-deletion) closed at M3.5. Both green as of this commit.

## Campaign Invariants

Every sub-sortie must pass these before `close-feature.sh` merges to campaign:

1. **One IR:** No NEW imports from `packages/ai/src/journey`. The legacy pair (`packages/ai/src/journey/compile.ts` + its single consumer in `apps/web/src/app/platform-admin/journeys/actions/compile.ts`) is grandfathered until the M2 `journey-ir-migrate-compile` sub-sortie retires it; thereafter any reference is a merge blocker. Every journey schema imports from `packages/journey-ir`.
2. **Registered emit:** Every new `emit('journey.*')` has a matching entry in `packages/telemetry/src/registry.ts` in the same commit. CI grep gate.
3. **Seeded authority:** Every new capability has an `engine_authority_config` row seeded via migration (not runtime insert). CI grep gate.
4. **No enum shortcut:** Zero occurrences of `ALTER TYPE journey_status ADD VALUE` in new migrations. CI grep gate.
5. **Dev vs runtime split:** No SQL writes from dev-run paths to `engine_state`; no SQL writes from runtime paths to `journey_event` for status (L-0023).
6. **Adapter or direct:** During M3–M5 adapter window, generators use `protocolToJourneyIR()`; no direct `docs/protocol/` reads. After cutover, adapter deleted in same PR as last generator migration.
7. **Mobile thin-client only:** No direct capability import in `apps/mobile/`. All runs proxy through BFF.
8. **Nordic Split only:** No hardcoded Tailwind colors. `useReducedMotion()` respected. Spring 35/22/2.2.
9. **Phase 2.5 grep:** Every plan/spec reviewed in this campaign passes the journey-* registry grep before Phase 3.
10. **ADR status discipline:** Every ADR moved from `proposed → accepted` has its status row updated in `docs/decisions/0000-decision-log.md` in the same commit.

## Milestones

### M1 — Foundations (week 1) — ✅ COMPLETE 2026-04-22

- [x] Add 5 journey events to `packages/telemetry/src/registry.ts` with payload schemas (ADR-0175). — S1.1 `05b827b1`
- [x] Migration `20260516000000_journey_version_table.sql` — `journey_version` with `status text`. — S1.2 `eef0b78d`
- [x] Migration `20260516000100_journey_version_status_0a_widen.sql` — introduce enum type. — S1.2 `eef0b78d`
- [x] Migration `20260516000200_journey_version_status_0b_enum.sql` — backfill + column-type flip. — S1.2 `eef0b78d`
- [x] Migration `20260516000300_journey_version_status_0c_tighten.sql` — NOT NULL + enum default. — S1.2 `eef0b78d`
- [x] Migration `20260516000400_journey_authority_seed.sql` — 4 `engine_authority_config` rows (ADR-0176). — S1.3 `fdfe1575`
- [x] Capability skeletons in `packages/ai/src/capabilities/journey/{index,tools}.ts` with correct authority defaults (ADR-0173). — S1.4 `10072db2`
- [x] Move ADRs 0172 / 0173 / 0175 / 0176 from `proposed` → `accepted`. 0171 / 0174 / 0177 stay `proposed` (Gate A Steward C-4).
- [x] Sub-sortie sequence: S1.1 → S1.2 → S1.3 → S1.4 (seed-before-capability enforced per Gate A C-1).

### M2 — Spec v1.7.0 + Remaining Unblocks (week 2)

- [ ] Create `packages/journey-ir/` with `package.json`, `tsconfig.json`, `src/index.ts`, workspace ref in root `tsconfig.base.json` (ADR-0171).
- [ ] **Migrate legacy `packages/ai/src/journey/compile.ts` → `packages/journey-ir/src/compile.ts`** (pre-existing from PR #40 "Feat/journey engine core"). Re-point consumer `apps/web/src/app/platform-admin/journeys/actions/compile.ts` from `@smartout/ai/journey/compile` to `@smartout/journey-ir`. Remove the `./journey/compile` export from `packages/ai/package.json`. Delete `packages/ai/src/journey/` entirely. Done as a dedicated sub-sortie `journey-ir-migrate-compile` so the change is atomic.
- [ ] Zero imports from `packages/ai/src/journey` anywhere in the repo. Grep gate added to CI.
- [ ] `actor_id` resolution doc appended to ADR-0176 (dev session / admin session / runtime stage-engine / mobile `getProfileContext()`).
- [ ] ADR-0074 unification delta spec written as appendix (cutover + adapter contract + deletion window — ADR-0174).
- [ ] Spec v1.7.0 published with inline council-mandated corrections.
- [ ] Delta re-review (not full council): quick Trust-Gate check on v1.7.0.
- [ ] Exit gate: all 7 Trust-Gate Unblocks green.

### M3 — JourneyIR + Generator Unification (week 3–4) — ✅ PARTIAL 2026-04-22 (C.11 → M3.5)

- [x] `protocolToJourneyIR()` adapter implemented in `packages/journey-ir/src/adapters/`. — C.1 (`9cf97adf`)
- [x] Mission generator in `apps/e2e/generators/` reads via adapter. — C.3/C.4 (`c74900ee`)
- [x] Docs (USER-GUIDE) generator reads via adapter. — C.5/C.6 (`c74900ee`)
- [x] Audit generator reads via adapter. — C.7/C.8 (`c74900ee`)
- [x] Every existing protocol converted end-to-end; callers sweep complete. — C.9/C.10 (`7d7669f8`)
- [x] Cutover checklist from ADR-0174 ticked. C.11 (adapter deletion) DEFERRED per §E row 3 to M3.5 because IR v1 was structurally under-specified for the Playwright runner. Resumption: ADR-0178 landed M3.5 with IR v2 additive expansion; adapter deleted.

### M3.5 — JourneyIR v2 Expansion + Adapter Deletion (inline 2026-04-22) — ✅ COMPLETE

- [x] ADR-0178 authored (proposed) — JourneyIR v2 schema expansion spec.
- [x] `packages/journey-ir/src/types.ts` extended: optional `actor`, `platform`, `auth_profile`, `preconditions`, `entry_url`, `success_gate`, per-step `actions` / `gate` / `order` / `screenshot` / `description`. `CURRENT_IR_VERSION = "2.0.0"` exported.
- [x] `packages/journey-ir/src/schema.ts` Zod mirrors for all v2 additions; `version` accepts both `"1.0.0"` and `"2.0.0"`.
- [x] `packages/journey-ir/src/compile.ts` version-guard: `assertCurrentIrVersion()` throws `UnsupportedIrVersionError` on v1 writes.
- [x] Unit tests added in `packages/journey-ir/src/types.test.ts` (28 new tests covering v1 compat, v2 additive, action union, guard).
- [x] `protocolToJourneyIR()` enriched to preserve `actions[]` typed list + `actor` / `platform` / `auth_profile` / `preconditions` / `entry_url` / `success_gate` / per-step gate/order/screenshot/description. Version bumped `"1.0.0"` → `"2.0.0"`.
- [x] `apps/e2e/runners/protocol-runner.ts` retargeted to consume `JourneyIR` natively. No `ProtocolDefinition` / `../protocols/schema` import. `RunnerInputError` thrown on runner-required fields absent on input IR.
- [x] `apps/e2e/runners/gate-checker.ts` retargeted to `JourneyGate` typed union.
- [x] `apps/e2e/runners/progress-writer.ts` retargeted to `JourneyIR`.
- [x] `apps/e2e/protocols/P-001-admin-onboarding.ts` rewritten as `JourneyIR` v2 emitter.
- [x] `apps/e2e/tests/protocol-login.spec.ts` inline `P_LOGIN` rewritten as `JourneyIR` v2.
- [x] C.11 executed: `protocolToJourneyIR.ts` + `protocolToJourneyIR.test.ts` + `adapters/` directory + `ProtocolSource` export all deleted. `index.ts` barrel trimmed.
- [x] ADR-0178 bumped `proposed → accepted`. ADR-0174 appendix added. Decision log updated.
- [x] Grep gates: `protocolToJourneyIR` = 0, `ProtocolSource` = 0, `packages/ai/src/journey` = 0, runner/generators free of `apps/e2e/protocols/schema`.

### M4 — Authoring Surface + Store Listing (week 5–6)

- [ ] `apps/web/src/app/platform-admin/journeys/` shell + list view + detail view + publish actions.
- [ ] Publish Mission action wired to `journey.publish_mission` capability.
- [ ] Publish Guide action wired to `journey.publish_guide` capability.
- [ ] `JourneyStoreListingCard` TS interface + card component (ADR-0177).
- [ ] Nordic Split compliance pass (no hardcoded colors, spring 35/22/2.2, `useReducedMotion()`, Instrument Serif headings).
- [ ] ARIA live region + 44pt touch target on card primary action.

### M5 — Runtime Agent-Guided + Mobile (week 7–9) — ✅ COMPLETE 2026-04-22

- [x] Fjernkontroll state machine (6 states: `idle | running | paused | stuck | completed | failed`) in `apps/web/src/components/journey/` (ADR-0177). — M5.1 `6707d443`
- [x] `journey.run_guided` capability implementation + stage-engine integration (runtime path write to `engine_state` + step-index advance + realtime-driven state derivation). — M5.1 `cf07a5cc`
- [x] Admin test-run page embeds Fjernkontroll at `/platform-admin/journeys/versions/[journeyVersionId]/run`. — M5.1 `671dd2bd`
- [x] ADR-0177 bumped `proposed → accepted`. — M5.1 `88daeeee`
- [x] `supabase/functions/journey-stuck-detector/` event-driven mode + dual-write (L-0098 step A). — M5.3 `541ee2e7`
- [x] Contract tests for `journey-stuck-detector` emit shape (4 ADR-0175 destinations). — M5.3 `956622b8`
- [x] Stuck-detector cutover Step 1 (dual-write with legacy) documented in M5.3 handoff. Flip (Step 2) + delete (Step 3) deferred to follow-up sub-sortie once legacy emits verified dark.
- [x] Mobile BFF routes (`apps/web/src/app/api/journey/guided/start/route.ts` + `apps/web/src/app/api/journey/guided/[runId]/status/route.ts`) — server-side workspace/actor derivation per ADR-0132. — M5.2 `68871fae` + `c945c858`
- [x] Mobile thin-client Fjernkontroll screen (`apps/mobile/src/screens/journey/...`) calling BFF only; no direct capability import. — M5.2 `d3b6cb7b`
- [x] `getProfileContext()` empty-string-ban enforcement on mobile emit path (ADR-0134). — M5.2 `2f68a13a`
- [x] BFF request contract test: mobile omits workspace/actor IDs (server derives). — M5.2 `93c74b33`

**Sub-sorties landed:**

| Sub | Scope | Merge SHA |
|---|---|---|
| M5.1 | Fjernkontroll runtime (web) + `journey.run_guided` fleshed | `00f716e0` (merge); `6707d443`, `cf07a5cc`, `671dd2bd`, `88daeeee` (implementation) |
| M5.2 | Mobile thin-client + BFF routes (start + status) | `06d1b80b` (merge); `68871fae`, `c945c858`, `2f68a13a`, `d3b6cb7b`, `93c74b33`, `b8733d3a` (implementation) |
| M5.3 | `journey-stuck-detector` Edge Function (dual-write, L-0098 step A) | `fa65c197` (merge); `541ee2e7`, `956622b8`, `0b0e5763` (implementation) |

**M5 exit (2026-04-22):** 3/3 sub-sorties merged. ADR-0177 bumped `proposed → accepted`. Stuck-detector cutover at step 1 of 3 (dual-write only); flip + delete tracked as M6 follow-up. **M6 unlocked.**

### M6 — Close-Feature Gate + Handoff (week 10) — ✅ COMPLETE 2026-04-22

- [x] Journey Guardian added via `scripts/close-feature.sh` + `scripts/close-feature-journey-guardian.sh` — six gates (G-JE-1..6) implementing CLAUDE.md §Feature closure gates #6–#10 plus L-0023 runtime-write gate.
- [x] Self-test path: `bash scripts/close-feature.sh --self-test` green on campaign tip (00f716e0); non-journey dry-run correctly skips the battery.
- [x] Comprehensive handoff at `docs/HANDOFF-journey-engine.md` — campaign-level capstone covering all five journeys enabled, all eight ADRs (0171..0178), all learnings (L-0023, L-0045, L-0066, L-0075, L-0094..L-0098), known debt, next steps, metrics.
- [ ] Campaign milestone PR `campaign/journey-engine → development` opened (next step; owner: Pontus).

**M6 exit (2026-04-22):** 2/2 engineering deliverables complete. Campaign is code-complete and ready for milestone merge to development. Known debt and follow-ups catalogued in the handoff.

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

Binding ADRs (proposed on 2026-04-21; move to `accepted` in M1):

- ADR-0074 — Protocol Verification Engine unification (completion tracked via ADR-0174).
- ADR-0171 — `packages/journey-ir` canonical package path.
- ADR-0172 — `journey_version_status` enum lifecycle (0a/0b/0c).
- ADR-0173 — Four journey capabilities, C4 defaults.
- ADR-0174 — ADR-0074 unification completion (adapter + cutover).
- ADR-0175 — Journey telemetry contract (5 events, 4 destinations).
- ADR-0176 — Journey C4 authority seed migration.
- ADR-0177 — Journey Runner UI contract (state machine, spring physics, `JourneyStoreListingCard`).

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).
All campaign-specific decisions registered there; bump `updated:` on every touch.

## Learnings

Binding learnings from the council:

- L-0023 — Dev-tracking (`journey_event`) vs runtime-state (`engine_state`) separation.
- L-0045 — Code-trace catches schema fiction.
- L-0066 — C4 authority defaults are not free.
- L-0075 — Migration atomicity via 0a/0b/0c.
- L-0094 — Phantom emit contracts recurring (4th occurrence; promotion candidate for Phase 2.5 registry grep).
- L-0095 — Long-spec internal contradictions (1st occurrence; note only).
- L-0096 — Code-trace catches schema fiction (reinforcement of L-0045).
- L-0097 — C4 authority defaults are not free (2nd occurrence after L-0066).
- L-0098 — Global scripts cutover ownership (3-step plan for `supabase/functions/*` migrations).

## Risks

1. **Spec v1.7.0 delay** — M2 is the gating milestone; if v1.7.0 slips, M3 generator unification cannot start. Mitigation: M1 and M2 parallelised where possible (ADR acceptance + `packages/journey-ir` scaffold are independent).
2. **Migration drift** — enum lifecycle must land before capability skeletons consume the new values. Mitigation: M1 sub-sortie `telemetry-registry-and-enum` bundles 0a/0b/0c + registry in one PR to avoid partial state.
3. **Scope bleed** — temptation to touch stage-engine or protocol legacy directly. Mitigation: `CLAUDE.md §What NOT To Do` rules 8–10 are merge gates; any cross-campaign touch stops and spawns correct sortie.
4. **Phantom-contract regression** — L-0094 is the 4th occurrence. Mitigation: Phase 2.5 grep promoted to automated check before every Phase 3 review in this campaign.
5. **Adapter rot** — `protocolToJourneyIR()` becomes permanent if cutover date slips. Mitigation: ADR-0174 cutover checklist is a M3 exit gate; adapter deleted in same PR as last generator migration.

## Next Step

First sub-sortie: `telemetry-registry-and-enum`. Closes Trust-Gate Unblocks 1 (registry) and 2 (enum 0a/0b/0c). Blocks nothing; unblocks M1 capability skeletons and authority seed.

Command to start (from this worktree):

```
/start-feature telemetry-registry-and-enum
```

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
