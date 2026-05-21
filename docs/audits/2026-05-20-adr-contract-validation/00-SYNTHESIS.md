---
title: Audit Synthesis — 2026-05-20 (full)
status: complete
created: 2026-05-20
updated: 2026-05-20
mode: full
slices: 14_of_14
baseline: 2026-05-18-adr-contract-validation-02
run_id: 2026-05-20-adr-contract-validation
tags: [audit, synthesis, adr, contract-validation]
---

# Audit Synthesis — 2026-05-20 (full)

## Verdict — YELLOW (SAFE TO PROMOTE)

Zero CRITICAL. **Seven HIGH** — six are i18n + ADR-0366 axes (unchanged shape vs baseline) and one is genuinely new: **MOB-01** (`mobile_call_leader` `leader_phone` PII on LiveKit data channel, introduced by PR #430 today). Zero regressions; all 2026-05-13 CRITICALs (F-DB-09, F-OB-10-01, F-CL-11, F-EF-03) remain closed. All 14 slices delivered (baseline missed 03 + 14). Slice 04 ADR-0366 day-component cluster fully remediated (9 files → 0 oklch literals). Slice 07 fully GREEN. Slice 11 OKLCH sweep: 283 → 3 hits (helpdesk-orb runtime gradients only). PR #430 13/13 telemetry parity PASS.

MOB-01 is half-day fix (scope narrowing on tool schema or voice-agent–side redaction). Slice 14 restoration surfaces two new MEDIUMs (unregistered protocol + hardcoded test fallback key); slice 03 confirms 5 of 6 baseline cron EFs fixed, only `tariff-amendment-sweep` `config.toml` missing.

---

## Totals

| Severity | Count | vs Baseline |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 7 | +2 |
| MEDIUM | 30 | +23 |
| LOW | 32 | +21 |
| INFO | 17 | +9 |
| **Total tracked** | **86** | +55 |

Headline inflation comes from restoring slices 03 + 14 (full inventory vs baseline absence). Only 1 NEW HIGH is genuinely new code (MOB-01); EF-01 was visible in 2026-05-13 baseline but invisible 2026-05-18.

---

## Critical findings (all-HIGH ranked)

| ID | Severity | Theme | Location | ADR | Source slice | Remediation | ETA |
|---|---|---|---|---|---|---|---|
| MOB-01 | HIGH | Mobile PII via LiveKit | `apps/mobile/src/lib/botsson-tools.ts:121-138` | 0378 R7, 0078 | 05 | Drop `leader_phone` from `mobile_call_leader` schema OR add voice-agent–side PII redaction before publishing on `botsson-tool-call` topic | Half-day |
| EF-01 | HIGH | Cron EF unreachable | `supabase/functions/tariff-amendment-sweep/index.ts:49` (missing `[functions.tariff-amendment-sweep]` in `config.toml`) | 0077 | 03 | Add `[functions.tariff-amendment-sweep] verify_jwt = false` block to `supabase/config.toml`, or annotate function as fully deferred and remove active auth/business logic | <1 hour |
| SE-01 | HIGH | Telemetry single-producer rule | `services/stage-engine/src/workers/mission-pool-slot.ts:400,438,462,515` | 0248 | 02 | Promote ADR-0248 + ADR-0246 from `proposed` → `accepted`, then either (a) move journey.* emit into B5 handlers per ADR-0248 Phase A4b, or (b) add interim grep guard in `close-feature.sh` | 1 day |
| OW-01 | HIGH | Onboarding i18n | `apps/web/src/app/onboarding/steps/ConfirmPositions.tsx:99-218` | CLAUDE.md i18n | 10 | Destructure `t` from `WizardStepProps`; add `onboarding.positions.*` keys to `nb` + `en` | Half-day |
| OW-02 | HIGH | Onboarding i18n | `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx:64,99,117,126,145` | CLAUDE.md i18n | 10 | Replace 5 hardcoded labels/placeholders with `t()` calls; add `onboarding.departments.*` keys | Half-day |
| OW-03 | HIGH | Onboarding i18n | `apps/web/src/app/onboarding/steps/ConfirmProcedures.tsx:87,119,123,133,143,150,154,179,209` | CLAUDE.md i18n | 10 | Largest single-file backlog (9 hits); add `onboarding.procedures.*` keys including deselect-warning prose | Half-day |
| F-01 | HIGH | i18n corpus-wide | 376 `.tsx` files with æøå + zero `t()` | CLAUDE.md i18n | 12 | Ship `nordic-split/no-hardcoded-norwegian` ESLint rule (mirroring the empty-string fallback rule that closed L-0083) before sweep #2; sweep alone re-accumulates | 1 day + 2-day sweep |

---

## Theme rollup

| Theme | C | H | M | L | I | Worst-offender file / pattern |
|---|---|---|---|---|---|---|
| i18n adoption | 0 | 4 | 5 | 3 | 1 | `ConfirmPositions.tsx` (zero `t()`), 376-file corpus |
| ADR-0366 OKLCH tokens | 0 | 0 | 5 | 3 | 1 | `apps/landing/src/app/globals.css` (4 hits in `@layer utilities`) + helpdesk-orb runtime gradients |
| Capability mutation patterns (ADR-0204 + ADR-0173 + ADR-0240) | 0 | 0 | 5 | 1 | 0 | `payroll/tools.ts`, `shift-lifecycle/tools.ts`, `timeline-template/tools.ts`, `personal/tools.ts`, `helpdesk_query/tools.ts` |
| Telemetry single-producer + missing emit | 0 | 1 | 4 | 1 | 1 | `mission-pool-slot.ts` (SE-01), `pin-day-control-context.ts` (F-04-02), `NoteEditDialog.tsx` (F-04-01), `dispatch.ts` zero-emit (SE-02) |
| Edge Functions auth perimeter | 0 | 1 | 0 | 1 | 3 | `tariff-amendment-sweep` (EF-01 persistent) |
| Schema / webhook integrity | 0 | 0 | 1 | 0 | 0 | `docuseal/route.ts:320` engine_event column mismatch (WH-01) |
| Mobile surface (ADR-0132/0378) | 0 | 1 | 2 | 1 | 1 | `mobile_call_leader` PII (MOB-01) |
| Journey + ADR registry hygiene | 0 | 0 | 4 | 5 | 1 | `JOURNEY-mobile-voice-runtime-wire-ux-polish.md` (non-standard status); ADR-0322 gap; ADR-0377 enforcement script missing |
| Cascade portability + style (ADR-0156) | 0 | 0 | 2 | 4 | 2 | `OverviewTab.tsx` (`useRouter` in day widget); event-name whitespace drift |
| Performance budgets / motion tokens | 0 | 0 | 0 | 6 | 0 | `apps/web/perf-budgets.json` (4/24 routes covered) |
| Onboarding wizard motion/colors (Nordic Split heritage) | 0 | 0 | 0 | 3 | 0 | `ConfirmDepartments.tsx` `transition-all` + `bg-white/50` |
| Tests / protocol registry | 0 | 0 | 2 | 0 | 0 | `p-swap-marketplace-pipeline.ts` unregistered; `announcement-atomic-rpc.spec.ts` hardcoded fallback key |

---

## ADR conflict table (claimed vs reality)

| ADR | Status in decision log | Reality in code | Slice |
|---|---|---|---|
| 0246 (engine-sessions ontology) | proposed | stage-engine reads `engine_state` in chat hot path before Phase A4a cutover; soft boundary-bleed | 02 |
| 0248 (B5 canonical emit producer) | proposed | mission-pool-slot emits `journey.*` at 4 sites; B5 handlers emit zero; single-producer rule violated but ungated | 02 |
| 0257 (Lovsen confidence model) | accepted | `cite_law` returns bare `"LAV"` string, not the `Confidence` object from `@smartout/lovsen-contract` (zero imports of canonical type) | 06 |
| 0321 (Swap↔Marketplace V2) | superseded | 4 comment-only references in `20260620110200_shift_lifecycle_pipeline_v2.sql` — comment-level, not logic | 09 |
| 0322 | (no slot, no entry) | undocumented gap; no file, no log row, no reserved note | 09 |
| 0377 (telemetry emit coverage gate) | proposed | enforcement script `scripts/check-telemetry-emit-coverage.ts` never shipped; no husky / CI wiring | 09 |
| 0378 (LiveKit protocol) | proposed | all four topics live in production (`botsson-context`, `botsson-tools-register`, `botsson-tool-call`, `botsson-tool-result`); ADR retroactive; PII rule R7 violated at MOB-01 | 05, 09 |
| 0366 (OKLCH ban) | accepted | ESLint rule `nordic-split/no-oklch-literal` mandated by §Enforcement, absent from `packages/eslint-config/plugins/smartout/rules/`; 3 unrelated rules shipped instead | 11 |

---

## Slice contradictions

No direct contradictions. Two areas of multi-slice corroboration: slices 02/05/09 all touch ADR-0378 (status `proposed`, code live; slice 02 finds producer-side issue, slice 05 finds PII at producer, slice 09 catches missing test obligations). Slices 04 + 11 both verify ADR-0366 — slice 04 confirms day-component cluster closed, slice 11 finds residual 3 hits are runtime-parameterized gradients (different surface).

---

## Delta vs baseline 2026-05-18

| Bucket | Count | Notes |
|---|---|---|
| **New CRITICAL** | 0 | All 2026-05-13 CRITs remain closed |
| **New HIGH** | 1 genuine + 1 restored | MOB-01 genuine (PR #430 today); EF-01 visible from slice-03 restoration (was visible 2026-05-13) |
| **New MEDIUM** | ~23 | Mostly slice-restoration inventory + WH-01 (NEW, previously undetected schema mismatch) + 4 new schedule-cascade findings (F-04-01/02/03/04, predate baseline) + landing-app OKLCH scope expansion + ADR registry hygiene |
| **New LOW** | ~21 | Slice 03+14 restoration, onboarding Nordic-Split heritage, motion magic-numbers, ADR-0378 follow-up test obligations |
| **Regressed** | 0 | No baseline closure re-appeared. ADR-0204 payroll re-classification (HIGH→MEDIUM) holds. L-0083 enforcement active. ADR-0099/0151/0163 perimeter intact. |
| **Closed** | 7 | F-04 OKLCH 9-file cluster; F-04 duty_leader emit; F-07 search_path on 2 SECURITY DEFINER fns; 5 of 6 cron EFs config.toml; F-06-02 cite_law docstring (tools.ts); login page Norwegian → 0; F-10 baseline ConfirmBusiness/TariffSection/ConfirmRoles |
| **Unchanged open** | ~5 | F-09-01 ADR-0322 gap; F-06-03/04 stubs; F-07-03/04 RLS + updated_at |

**Bottom-line:** Zero regressions. One genuine new HIGH (MOB-01, half-day). Shape identical to 2026-05-18 — enforcement-less ADRs accumulate, enforced ADRs hold. See `delta.md` for explicit match table.

---

## Cross-cutting patterns

**1. Enforcement-less ADRs accumulate violations geometrically — third consecutive audit confirming this.** ADR-0366 ESLint rule `nordic-split/no-oklch-literal` mandated by its own §Enforcement still absent after 50+ days. H2 sortie cleaned 280 of 283 hits but PD-01/02 + landing-app PD-04/05 already accumulating. CLAUDE.md i18n: 376 .tsx files unchanged (-2 from 378). ADR-0377 is the third instance — ADR proposed, enforcement script promised, never shipped. PD-03 + F-08 + F-09-03 are the same root-cause finding from three slices. **Rule:** any ADR that bans a syntactic shape must ship its ESLint rule in the same sortie or the rule reverts to convention.

**2. Schema-aware writes need column verification.** WH-01 catches a new failure class: `docuseal/route.ts:320` inserts into `engine_event` using 4 non-existent columns; cast `as never` bypasses TS, `.catch(()=>{})` swallows the runtime error. Result: every employee contract signing silently fails to fire `contract.signed`. Baseline noted "engine_event insert fire-and-forget acceptable" without verifying column-name match. Sibling of L-0177 (silent fallback) — caller assumes success on swallowed error.

**3. New ADRs land code-first.** ADR-0378 registered `proposed` today, but its code shipped in PR #430. Same shape for ADR-0246/0248 (code exists, status proposed, no enforcement). MOB-01 is the textbook case: a Rule 7 violation in the same PR that proposed the rule.

**4. PR #430 telemetry parity is a model.** All 13 new mobile-voice events have matching `emit()` call-sites with `nonEmpty()` + `getProfileContext()` guards. Zero orphan registry entries. Zero `?? ""` fallbacks. First major mobile feature merged post L-0083 ESLint rule — cleared the bar. Contrast with 376-file i18n backlog: enforcement works, sweeps don't.

---

## Recommended sortier (max 5, prioritized)

1. **MOB-01 PII fix on `mobile_call_leader`** (XS, ADR-0378 R7 + ADR-0078) — drop `leader_phone` from tool schema OR add voice-agent–side PII redaction; update ADR-0378 §Bad. ETA: 0.5d.

2. **i18n ESLint rule + onboarding HIGH sweep** (M, CLAUDE.md i18n) — ship `nordic-split/no-hardcoded-norwegian` rule using L-0083 pattern; migrate ConfirmPositions/Departments/Procedures (OW-01/02/03, ~30 hardcoded strings); add reset-password keys to `auth.json`. ETA: 3d.

3. **WH-01 engine_event schema fix + ADR-0377 enforcement script** (S) — replace 4 non-existent columns in `docuseal/route.ts:320` with `event_type` + payload-embedded entity fields; ship `scripts/check-telemetry-emit-coverage.ts` per ADR-0377; wire to husky + GH Actions. ETA: 1d.

4. **ADR-0366 ESLint rule + landing-app OKLCH migration** (S, ADR-0366) — ship `nordic-split/no-oklch-literal`; migrate 6 landing-app hits to `@theme`; add `--orb-chroma-waiting` + `--orb-hue` parameterised tokens so Orb + LighthouseAvatar drop runtime interpolation (PD-01/02). ETA: 1d.

5. **ADR registry hygiene + 0246/0248 promotion** (S) — document ADR-0322 as reserved/renumbered; promote ADR-0246 + ADR-0248 `proposed` → `accepted` so SE-01 becomes enforceable; move mission-pool-slot journey.* emits to B5 handlers OR add interim husky grep guard. ETA: 1d.

Out-of-scope but tracked: ADR-0204 payroll-convention amendment (M-002/003); ADR-0173/0240 delegation retrofit for personal + helpdesk_query (M-005); shift_session JWT RLS + announcement_meta updated_at (F-07-03/04); perf-budgets expansion (PD-06/07); F-14-05 protocol registration + F-14-06 hardcoded test key.

---

## Slice-by-slice top finding

- **01** → M-005 NEW (cross-namespace inserts in `personal` + `helpdesk_query` to engine_* tables)
- **02** → SE-01 HIGH (`mission-pool-slot.ts:400-515` direct journey.* emit violates ADR-0248)
- **03** → EF-01 HIGH PERSISTS (`tariff-amendment-sweep` missing `config.toml`; 5 of 6 fixed)
- **04** → F-04-01 MEDIUM (`NoteEditDialog.tsx:89` direct DB insert no emit) + ADR-0366 9-file cluster RESOLVED
- **05** → MOB-01 HIGH NEW (`mobile_call_leader` leader_phone PII over LiveKit, ADR-0378 R7)
- **06** → F-06-05 MEDIUM (`cite_law` returns bare `"LAV"` string vs ADR-0257 `Confidence` object)
- **07** → ALL GREEN. 2 baseline LOWs closed; PR #430 13/13 telemetry parity PASS
- **08** → F1 MEDIUM (`AIPrefsSection.tsx:11` docstring claim vs call-site in `use-ai-prefs.ts:72`)
- **09** → F-09-03 MEDIUM (ADR-0377 enforcement script `check-telemetry-emit-coverage.ts` never shipped)
- **10** → OW-01/02/03 — three HIGH i18n violations on ConfirmPositions/Departments/Procedures (baseline 2 HIGHs CLOSED, replaced by 3 new on adjacent files)
- **11** → PD-03 MEDIUM (ADR-0366 ESLint rule absent); 280 → 3 component literals
- **12** → F-01 HIGH (376 .tsx files with æøå + zero `t()`; -2 from baseline 378)
- **13** → WH-01 MEDIUM NEW (`docuseal/route.ts:320` 4 non-existent columns + `as never` + swallowed catch breaks contract.signed cascade)
- **14** → F-14-05 MEDIUM (`p-swap-marketplace-pipeline.ts` unregistered, spec file absent)
