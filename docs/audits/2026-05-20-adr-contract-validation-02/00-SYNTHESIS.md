---
title: Audit Synthesis — 2026-05-20 (run 02, post-PR-#432)
status: complete
created: 2026-05-20
updated: 2026-05-20
mode: full
slices: 14_of_14
baseline: 2026-05-20-adr-contract-validation
run_id: 2026-05-20-adr-contract-validation-02
tags: [audit, synthesis, adr, contract-validation, post-pr-432]
---

# Audit Synthesis — 2026-05-20 run 02 (post-PR-#432)

## Executive Summary

- **Verdict: YELLOW — SAFE TO PROMOTE.** Zero CRITICAL. **Two HIGH** (one upgraded from baseline MEDIUM; one persisting from baseline). Six of seven baseline HIGHs closed by PR #432 (commit `b1c43f5903`).
- **Biggest single-audit closure ever:** F-01 i18n backlog dropped **376 → 90 (−286)** via campaign/ui-shell-followup H3/H4 sortier landed in PR #431 — separate from PR #432 — but visible in this run. 30 of remaining 90 files have ≥6 rendered Norwegian strings (the stubborn tail).
- **Severity upgrade:** WH-01 promoted MEDIUM → HIGH after combining column mismatch + `as never` TS bypass + silent `.catch()` evidence. Every employee contract signing silently fails to fire `contract.signed`, blocking the cascade D2/C4 trainee→active transition.
- **CT-01 + CT-02 upgraded MEDIUM → HIGH** by slice 01: `shift-lifecycle` + `payroll` capability families operate ADR-0204 Pathway A only. `payroll/tools.ts` carries an in-docstring ADR override never accepted as amendment (L-0176 trap).
- **F-04-03 aggravated:** `useDayTimelineScope` Next.js hook now consumed by 3 additional day-widget files (commit `ea8292772`) — ADR-0156 portability regression.
- **Enforcement-less ADR pattern confirmed third audit running:** ADR-0366 ESLint, ADR-0377 telemetry script, ADR-0328 error-catalog script all mandated, none shipped. Code-first drift: ADR-0135 + ADR-0378 still `proposed` despite full production deployment.

---

## Totals

| Severity | Count | vs Baseline (2026-05-20 pre-PR-#432) |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 4 | −3 (6 closed, 1 NEW genuine + 2 baseline-upgrades from slice 01/13) |
| MEDIUM | 17 | −13 |
| LOW | 20 | −12 |
| INFO | 10 | −7 |
| **Total tracked (deduped)** | **51** | −35 |

Genuine new HIGH: zero. The 4 active HIGHs are: WH-01 (was baseline MEDIUM, upgraded by slice 13 on combined evidence), CT-01 + CT-02 (was baseline MEDIUM, upgraded by slice 01), F-09-01 (baseline HIGH, persists).

---

## Critical findings (top-10 ranked)

| # | ID | Sev | Theme | Location | ADR | Slices | Remediation | ETA |
|---|---|---|---|---|---|---|---|---|
| 1 | **WH-01** | HIGH | Webhook → cascade silent break | `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334` | 0079 | 13 | Replace 4 non-existent columns (`entity_type`, `entity_id`, `event_name`, `created_at`) with `event_type` + `fired_at`; move entity fields into `payload`; add `idempotency_key: \`docuseal:${data.submission_id}:signed\``; remove `as never` cast and surface error via logger | 1d |
| 2 | **CT-01** | HIGH | Capability ADR-0204 Pathway B absent | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:177-180,350-362` | 0204 | 01 | Wrap `publishShift` + `approveShift` mutations in `gatedMutation()` orchestrator; cascade_gate_write must produce `change_proposal` row on blocked path | 1d |
| 3 | **CT-02** | HIGH | Capability informal ADR override | `packages/ai/src/capabilities/payroll/tools.ts:200-206,370-379` | 0204 | 01 | Either (a) wrap in `gatedMutation()` like other capabilities OR (b) draft ADR amendment formally accepting "gate-then-update payroll convention" — current docstring is L-0176 trap (claim without contract) | 1d |
| 4 | **F-09-01** | HIGH | ADR registry gap | `docs/decisions/0000-decision-log.md` (slot 0322) | registry hygiene | 09 | Add row: `\| ADR-0322 \| — \| RESERVED — slot skipped \| n/a \|`; verify via git blame | <15min |
| 5 | **F-09-02** | MEDIUM | Enforcement-less accepted ADR | `packages/eslint-config/plugins/smartout/rules/` (missing `no-oklch-literal.mjs`) | 0366 | 09, 11, 12 | Ship lint rule, register in `plugins/smartout/index.mjs`, enable in `next.mjs`; promote ADR-0366 to `accepted` | 2h |
| 6 | **F-09-03** | MEDIUM | Enforcement-less proposed ADR | `scripts/check-telemetry-emit-coverage.ts` (missing) | 0377 | 07, 09 | Ship script + husky pre-commit + CI gate; closes F-07-05 + F-07-06 orphan-event risk class | 3h |
| 7 | **F-04-03** | LOW (AGGRAVATED) | Cascade portability | `apps/web/src/lib/day-control/hooks/use-day-timeline-scope.ts:20`; `ScopeFilterPill.tsx:60`, `TimelineTopBar.tsx:65`, `TimelineTab.tsx:118` | 0156 | 04 | Refactor `useDayTimelineScope` to accept scope+setter from caller (lift Next-specific hooks to page level) | 0.5d |
| 8 | **F-04-01** | MEDIUM | Telemetry coverage gap + ADR-0156 portability | `apps/web/src/components/day/NoteEditDialog.tsx:89` | 0156, 0134 | 04 | Move Supabase write to capability/server-action; add `emit("session_note added")` in onSuccess | 0.5d |
| 9 | **F-09-05** | MEDIUM | Code-first ADR drift | `docs/decisions/0135-*.md`, `docs/decisions/0378-*.md` | 0135, 0378 | 02, 05, 09 | Promote both to `accepted` — code in production since 2026-05-20; ADR-0378 self-acknowledges "Codifies what P3+P4 shipped" | <10min each |
| 10 | **F-08-01** | MEDIUM | Convention drift at scale | 304 JOURNEY-*.md files | CLAUDE.md frontmatter | 08 | Either register `verified` as JOURNEY extension via ADR or `sed`-rename to `done` | 30min |

---

## Theme rollup

| Theme | C | H | M | L | I | Worst-offender |
|---|---|---|---|---|---|---|
| Capability ADR-0204 mutation pattern | 0 | 2 | 3 | 1 | 2 | `shift-lifecycle/tools.ts` + `payroll/tools.ts` (CT-01/02 HIGH) |
| Webhook → cascade integrity | 0 | 1 | 1 | 2 | 0 | `docuseal/route.ts:320` (WH-01) |
| i18n adoption | 0 | 1 | 4 | 2 | 1 | 90 `.tsx` files remaining (was 376); `ConfirmLocations` + `ConfirmSummary` + `reset-password` MEDIUM |
| Enforcement-less ADRs | 0 | 0 | 3 | 1 | 0 | ADR-0366 (lint), ADR-0377 (telemetry script), ADR-0328 (error-catalog) |
| Cascade portability (ADR-0156) | 0 | 0 | 1 | 1 | 0 | `useDayTimelineScope` spread (F-04-03 AGGRAVATED) |
| Telemetry orphan events / missing emit | 0 | 0 | 1 | 3 | 1 | `shift_session.bound`, `celebration.skipped_*` (F-07-05/06), `pin-day-control-context` (F-04-02), `dispatch.ts` zero-emit (SE-02) |
| ADR registry hygiene | 0 | 1 | 1 | 4 | 3 | ADR-0322 gap (F-09-01); 13 stale `proposed` ADRs; 23 missing `id:` field; status `draft` / `live` / `verified` drift |
| OKLCH literal residue (ADR-0366) | 0 | 0 | 1 | 0 | 0 | `apps/landing/src/app/globals.css` (4 `@layer utilities`) + `free-forever/page.tsx` (2 JSX gradients) |
| Edge Function auth perimeter | 0 | 0 | 1 | 1 | 5 | 3 browser-callable EFs with inline wildcard CORS (EF-02) |
| Mobile surface (ADR-0132/0134/0378) | 0 | 0 | 1 | 1 | 1 | `ContentCreator.tsx` missing `nonEmpty()` re-wrap (MOB-02); placeholder direct `websites` write (MOB-03) |
| Lovsen ADR-0257 confidence model | 0 | 0 | 1 | 2 | 0 | `cite_law` returns bare `"LAV"` (F-06-05) |
| Performance budgets (ADR-0019) | 0 | 0 | 0 | 1 | 0 | `perf-budgets` CI job absent; 4/88 dashboard route coverage |

---

## ADR conflict table (claimed status vs reality)

| ADR | Status in log | Code reality | Slices | Verdict |
|---|---|---|---|---|
| 0135 (LiveKit mobile) | proposed | Fully live since 2026-05-20 (30+ days stale) | 05, 09 | Code-first drift |
| 0246 (engine-sessions ontology) | proposed | 29 `engine_sessions` reads in stage-engine; Phase A0 not started — expected pre-cutover | 02 | In-progress per ADR plan |
| 0247 (engine_state nullability) | proposed | No migration applied; expected pre-Phase A0 | 02 | In-progress per ADR plan |
| 0248 (B5 canonical emit producer) | proposed | Amendment 2026-05-20 names `mission-pool-slot` as second producer — all 5 constraints satisfied; HTTP `dispatch.ts` route zero-emit gap (SE-02) | 02, 09 | Amendment legitimizes baseline SE-01 HIGH → INFO |
| 0257 (Lovsen confidence) | accepted | `cite_law` returns bare `"LAV"` string, not `Confidence` object; `@smartout/lovsen-contract` not imported | 06 | Stub path violation; Phase 0c+ lift required |
| 0322 | (no slot, no entry) | undocumented gap; only 1 of 4 ADR gaps undocumented | 09 | Registry hygiene HIGH |
| 0328 (error catalog) | proposed | `infra/scripts/error-catalog-check.sh` never shipped | 09 | Enforcement-less |
| 0366 (OKLCH ban) | proposed | ESLint rule `nordic-split/no-oklch-literal` mandated by §Enforcement absent; 6 landing-app hits remain | 09, 11, 12 | Enforcement-less |
| 0377 (telemetry emit gate) | proposed | `scripts/check-telemetry-emit-coverage.ts` never shipped; ≥3 orphan events surfaced (slice 07) | 07, 09 | Enforcement-less |
| 0378 (LiveKit protocol) | proposed | All 4 topics live in production; ADR self-acknowledges retroactive nature | 02, 05, 09 | Code-first drift; MOB-01 R7 now CLOSED via PR #432 |

---

## Slice contradictions

**No direct contradictions.** Two reconciliations:

1. **SE-01 (slice 02)** — Baseline flagged HIGH; slice 02 confirms ADR-0248 Amendment 2026-05-20 grants `mission-pool-slot` carve-out, all 5 constraints satisfied. Downgraded to INFO. Slice 09 INFO entry (F-09-09) confirms amendment format consistent with ADR-0078/0091 precedent. Reconciled: **CLOSED via amendment, SE-02 HTTP `dispatch.ts` zero-emit is a separate residual MEDIUM**.

2. **WH-01 severity (slice 13 vs baseline synthesis)** — Baseline listed MEDIUM; slice 13 upgrades to HIGH on combined evidence: column mismatch + `as never` cast + silent `.catch()` + downstream cascade impact (trainee→active transition silently blocked). Steward concurs with upgrade — schema-aware writes failing without observability is HIGH class (L-0177 sibling).

3. **F-04-03 (slice 04)** — Baseline noted single-file `OverviewTab.tsx`; slice 04 finds commit `ea8292772` (2026-05-18) introduced indirect Next.js hook consumption via `useDayTimelineScope` in 3 more day-widgets. Severity stays LOW (no runtime impact today) but **AGGRAVATED** marker added — ADR-0156 portability discipline regressing.

---

## Delta vs baseline 2026-05-20

| Bucket | Count | Notes |
|---|---|---|
| **Closed by PR #432** | 6 HIGHs | MOB-01 (PII leader_phone), EF-01 (config.toml), OW-01/02/03 (onboarding i18n), SE-01 (via ADR-0248 amendment); F-01 dropped 376→90 via separate PR #431 |
| **New CRITICAL** | 0 | All 2026-05-13 CRITs remain closed (F-DB-09, F-OB-10-01, F-CL-11, F-EF-03) |
| **New HIGH (genuine new code)** | 0 | Zero new HIGHs from new code. WH-01 is a baseline MEDIUM upgraded on re-evidence; CT-01/CT-02 are baseline MEDIUMs upgraded by slice-01 deeper inspection |
| **New MEDIUM** | 1 genuine (WH-02 LiveKit silent participant drop) + carry-forwards | Baseline MEDIUMs largely closed; new = WH-02 + slice-09 enforcement-less batch + slice-10 ConfirmLocations/Summary (predate baseline, not previously inspected) |
| **New LOW** | 4 | OW-06/07/08 (transition-all, bg-white/50 onboarding), F-07-05/06 (orphan telemetry events), MOB-02 (`nonEmpty` re-wrap), slice-09 ADR hygiene cluster |
| **Regressed** | 1 | F-04-03 AGGRAVATED — `useDayTimelineScope` spread to 3 more day widgets via commit `ea8292772` (2026-05-18). No baseline closure re-appeared. |
| **Unchanged open** | ~10 | F-06-03/04/05 Lovsen Phase 0c+ stubs; F-07-03/04 announcement_meta/shift_session RLS; F-09-01 ADR-0322 gap; F-09-02/03 enforcement-less; F-04-04 event-name whitespace; F-02a reset-password i18n |

**Bottom-line:** PR #432 closed every targeted HIGH. PR #431 (independent) drove the F-01 i18n metric down 286 files. Zero regressions in code-correctness; one portability regression (F-04-03 aggravation). Two MEDIUM→HIGH upgrades reflect deeper inspection, not new code.

---

## Cross-cutting patterns

**1. Enforcement-less ADRs accumulate violations geometrically — third consecutive audit confirming the pattern.** Three open instances: **ADR-0366** (lint rule mandated by §Enforcement, absent — Slice 09 F-09-02 + Slice 11 FIND-11-01 + Slice 12 F-06 same root cause), **ADR-0377** (telemetry coverage script mandated, absent — Slice 07 F-07-05/06 + Slice 09 F-09-03 same root cause), **ADR-0328** (error catalog script mandated, absent — Slice 09 F-09-04 new). Rule still holds: any ADR that bans a syntactic shape or requires registry coverage MUST ship its enforcement script in the same sortie or the rule reverts to convention. ADR-0365 is the counter-example: tool-name-collision script shipped, rule holds. PR #431's H4 sortie validated the inverse — the L-0083 ESLint rule shipped, the corpus moved 286 files because the rule prevented backsliding.

**2. Code-first ADR drift hardens into ambiguity.** ADR-0135 + ADR-0378 both `proposed`, both fully live in production. ADR-0378 self-acknowledges "Codifies what P3+P4 shipped — no new code required" yet remains `proposed`. This pattern leaves the contract's authority ambiguous: is it canonical source or documentation artifact? **Recommendation:** promote both to `accepted` (status-only update, no code changes). Same applies to ADRs 0053, 0122-0124, 0136, 0152-0155, 0158, 0270, 0279 — 13 zombie-proposed ADRs over 30 days stale (F-09-06).

**3. Docstring-as-contract violations persist (L-0176 class).** CT-02 catches the next instance: `payroll/tools.ts` docstring claims "gate-then-update is the established payroll convention" — an in-line ADR override without an accepted amendment. WH-01 is structurally the same: code comment "engine_event table may not exist yet in all envs" was valid 18 months ago and used to justify `as never` cast + silent `.catch()` despite table existing in production today. **Rule reinforced:** docstrings are claims, bodies must satisfy contracts independently.

**4. PR #432 validates the trust gate.** Six baseline HIGHs closed in one PR with zero regressions in code correctness. All 5 PII test assertions in `botsson-tools-pii.test.ts` pass; `buildCallLeader(phoneResolver)` factory pattern is the canonical fix for ADR-0378 R7. Telemetry parity holds: all 13 new mobile-voice events have matching `emit()` call-sites with `nonEmpty()` guards. **Contrast with:** F-01 i18n corpus had to wait for PR #431's separate H3/H4 sortier to drop 286 files — sweeps still work but only when the ESLint rule is the gate; convention alone hits the same backlog.

**5. Cascade portability regression vector identified.** F-04-03 AGGRAVATED proves the pattern: a single Next-specific hook (`useRouter` + `useSearchParams`) wrapped in a custom hook (`useDayTimelineScope`) and consumed by 4 day-widget files now blocks ADR-0156 extraction to `packages/ui/day-control/`. Indirect import via hook does not change the violation — mobile extraction will fail at TS-resolve. **Mitigation:** lift Next-specific hooks to page level; pass scope+setter as props to widgets. Same class as L-0176 (claim drift); the file's "I'm portable" is contradicted by its hook import chain.

---

## Forward plan (ranked sortier — 5 max)

1. **WH-01 + CT-01 + CT-02 capability/webhook integrity sortie** (M, 2d) — `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334` schema-correct rewrite + `shift-lifecycle/tools.ts` + `payroll/tools.ts` Pathway B wrap. Either accept payroll convention via ADR amendment OR migrate to `gatedMutation()`. Single sortie because all three are L-0176 docstring-contract gaps. ETA: 2d.

2. **Enforcement-less ADR remediation sortie** (S, 1d) — Ship ADR-0366 ESLint rule (`no-oklch-literal.mjs`), ADR-0377 telemetry script (`check-telemetry-emit-coverage.ts`), and ADR-0328 error-catalog script (`error-catalog-check.sh`). Promote ADR-0366 → `accepted`. Wire all three to husky + CI. Closes F-07-05/06 orphan-event detection going forward. ETA: 1d.

3. **i18n ESLint rule + 90-file sweep #2 + auth.json keys** (M, 3d) — Ship `nordic-split/no-hardcoded-norwegian` ESLint rule (mirror L-0083 pattern). Migrate top-30 of remaining 90 files (≥6 strings each). Add `auth.reset_password.*` keys (F-02a). Migrate `ConfirmLocations` + `ConfirmSummary` (OW-04/OW-05). Apply `transition-colors` + `bg-card/50` (OW-06/07/08). ETA: 3d.

4. **ADR registry hygiene sortie** (S, 0.5d) — F-09-01 (ADR-0322 reservation note), F-09-05 (promote ADR-0135 + ADR-0378 → `accepted`), F-09-06 (triage 13 zombie-proposed ADRs), F-09-07 (batch-add `id:` field to 23 files), F-09-08 (ADR-0075 `live` → `accepted`), F-09-11 (`draft` → `proposed` on 0137-0139), F-08-01 (304 JOURNEY `verified` → `done` OR register extension via ADR). Pure status updates, no code changes. ETA: 0.5d.

5. **Cascade portability + telemetry gap closure** (S, 1d) — F-04-01 (`NoteEditDialog` Supabase write + emit), F-04-02 (`pin-day-control-context` emit), F-04-03 (lift `useDayTimelineScope` Next hooks to page level), F-04-04 (event-name dot-namespace rename + registry update), SE-02 (`dispatch.ts` telemetry parity with `mission-pool-slot`). All MEDIUMs in cascade pipeline; single sortie. ETA: 1d.

Out-of-scope but tracked: F-06-05 Lovsen Phase 0c+ confidence-object lift (~10min when MCP integration ships); MOB-02/MOB-03 mobile-spokesperson housekeeping; EF-02 ADR-0171 inline-CORS migration (3 browser EFs); F-09-04 perf-budgets CI job (warn mode); F-14-01/02 protocol registry + hardcoded test key cleanup.

---

## Slice-by-slice top finding

- **01** → **CT-01 + CT-02 HIGH (UPGRADED)** — `shift-lifecycle` + `payroll` capabilities operate ADR-0204 Pathway A only; `payroll` docstring claims established convention without accepted amendment (L-0176 trap)
- **02** → **SE-01 CLOSED via ADR-0248 amendment** — all 5 constraints satisfied; SE-02 zero-emit on HTTP `dispatch.ts` route is residual MEDIUM
- **03** → **EF-01 CLOSED** — `tariff-amendment-sweep` `config.toml` block added at lines 649-656; EF-02 inline wildcard CORS on 3 browser EFs MEDIUM (pre-existing ADR-0171 backlog)
- **04** → **F-04-03 AGGRAVATED** — `useDayTimelineScope` Next-hook now consumed in 3 more day widgets (commit `ea8292772`); ADR-0156 portability discipline regressing
- **05** → **MOB-01 CLOSED** by PR #432 commit `0d14334d4`; `buildCallLeader(phoneResolver)` factory verified by 5/5 PII tests; MOB-02 MEDIUM (`nonEmpty()` re-wrap gap on ContentCreator)
- **06** → **F-06-05 MEDIUM** — `cite_law` returns bare `"LAV"` string vs ADR-0257 `Confidence` object; `@smartout/lovsen-contract` not imported; Phase 0c+ stub
- **07** → **F-07-05 + F-07-06 LOW** — three orphan registry entries (`celebration.skipped_*`, `shift_session.bound`) registered without emit call-sites; ADR-0377 enforcement script would have caught these
- **08** → **F-08-01 MEDIUM** — 304 of 501 JOURNEY-*.md files use `status: verified` (not in canonical set); de-facto convention without ADR registration
- **09** → **F-09-01 HIGH PERSISTS** — ADR-0322 slot remains undocumented (other 3 gaps properly noted); enforcement-less ADRs cluster
- **10** → **OW-01/02/03 CLOSED** by PR #432 commit `72a355733`; OW-04 + OW-05 MEDIUM surface `ConfirmLocations` + `ConfirmSummary` (predate PR #432 scope)
- **11** → **FIND-11-01 + FIND-11-02 MEDIUM** — ADR-0366 lint rule absent; 6 OKLCH literals in `apps/landing` outside token layer
- **12** → **F-01 BIGGEST CLOSURE EVER** — 376 → 90 files via PR #431 H3/H4 sortier (−286); 30 of remaining 90 have ≥6 rendered strings
- **13** → **WH-01 UPGRADED MEDIUM → HIGH** — `docuseal/route.ts:320` 4 non-existent columns + `as never` + silent `.catch()`; every employee contract signing silently breaks `contract.signed` cascade
- **14** → **M-14-01 + M-14-02 MEDIUM** — `p-swap-marketplace-pipeline.ts` unregistered (S12 slot collision); hardcoded local service-role key fallback in `announcement-atomic-rpc.spec.ts`

---

_Audit by: claude-opus-4-7 (synthesizer, read-only) · run_id: 2026-05-20-adr-contract-validation-02 · 14 of 14 slices_
