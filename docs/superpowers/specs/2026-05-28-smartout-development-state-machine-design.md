---
title: Smartout Development State Machine — Spec
status: draft
updated: 2026-05-28
created: 2026-05-28
module: development-state-machine
tags: [doctrine, state-machine, autonomy, cloud-design, routes, brainstorm, gates]
---

# Smartout Development State Machine (SDSM)

> Mission: Every UI feature shipped to Smartout passes through deterministic gates triggered by artefacts. Cloud Design = visual fasit. Inventory-first. Functional-done ≠ product-done. `docs/routes/` mirrors the app 1:1 and is the canonical evidence-store.

---

## 1. Doctrine (three laws)

1. **Cloud Design er fasit.** Visual contract, ikke inspirasjon. Avvik krever explicit deviation entry.
2. **Discovery before build.** Inventory eksisterende kode + DB før noen GAP defineres. Reuse > extend > bygg nytt.
3. **Product Done er eneste lovlige close-state.** Functional completion (typecheck + tests grønne) er ikke acceptance. User-observable evidence + screenshot-match + journey-pass kreves.

---

## 2. The 8 components

| # | Component | Input | Output | Status |
|---|-----------|-------|--------|--------|
| 1 | **Start-hook** | `/start-feature --design-link <url> --test-mode continuous\|end` | sortie initialized + design-link captured | fins (utvides) |
| 2 | **Brainstorm-skill** | Cloud Design link + codebase + DB | INVENTORY-REPORT.md + questionnaire.md + module-classification | **mangler** |
| 3 | **Spec-writer** | Pontus-answered questionnaire | SPEC.md (helhetlig feature definition) | **mangler** |
| 4 | **Plan-generator** | SPEC.md | Plan 1..N med tracks/waves/phases + tier-stempel | delvis (formaliseres) |
| 5 | **Tool-hook** | write-tool calls + page-visits | screenshot capture + event-emit logged til route-folder | fins (utvides) |
| 6 | **Phase-verifier** | route-folder + Cloud Design | PASS/FAIL: design match, API events, telemetry events, E2E | **mangler** |
| 7 | **Journey-writer + Playwright** | completed phase | journey.md + spec.ts (run now if `continuous`, queue if `end`) | fins (wires) |
| 8 | **Plan-chainer** | Plan N PASS | kicks Plan N+1 | **mangler** |

---

## 3. State machine

```
S0  IDLE
     │ trigger: /start-feature --design-link <url>
     ▼
S1  STARTED
     │ Gate G1: design-link valid + reachable
     ▼
S2  DISCOVERING
     │ action: brainstorm-skill runs
     │ Gate G2: INVENTORY-REPORT.md non-empty + classified
     ▼
S3  QUESTIONNAIRE-PENDING
     │ action: questionnaire surfaced to Pontus
     │ Gate G3: Pontus answers + approves module-classification
     ▼
S4  SPEC-DRAFT
     │ action: spec-writer composes SPEC.md
     │ Gate G4: Pontus approves SPEC
     ▼
S5  PLANS-GENERATED
     │ action: plan-generator emits Plan 1..N + tier per plan
     │ Gate G5: Pontus approves order + test-mode flag
     ▼
S6  PLAN-RUNNING  ◄──────── loop ────────┐
     │ Phase A: Build (tracks→waves→phases)
     │ Phase B: Verify (screenshots + events + E2E)
     │ Phase C: Journey-writer composes journey
     │ Phase D: Playwright (if mode=continuous)
     │ Gate G6: Phase B PASS all checks
     ▼                                    │
     plan-chainer fires next plan ────────┘
     │ (all N plans done)
     ▼
S7  ALL-PLANS-DONE
     │ action: if mode=end → run full Playwright suite
     │ Gate G7: full suite green
     ▼
S8  PRODUCT-ACCEPT
     │ action: interactive accept prompt + screenshot compare
     │ Gate G8: Pontus y/N
     ▼
S9  CLOSED (merge to development)
```

**Failure paths:**
- G2 FAIL → halt + escalate (link unreachable or inventory empty)
- G3/G4/G5 timeout → state persists, sortie sleeps until Pontus returns
- G6 FAIL → max 3 self-fix cycles per phase → escalate
- G7 FAIL → halt, do NOT proceed to G8
- G8 N → log reason, state returns to S6 with annotated diff to fix

---

## 4. Feature-folder convention — canonical kapsel

Pontus' lov: every UI Design unit gets its own dedicated folder under its domain. All SDSM artefakter for that feature/campaign lever inni én kapsel. Lett å arkivere, lett å migrere, lett å overlevere.

### 4.1 Structure

```
docs/domains/<domain>/<feature>/
├── SPEC.md                          ← feature contract (or symlink to docs/superpowers/specs/)
├── STATE.md                         ← SDSM live state (orchestrator writes)
├── INVENTORY-REPORT.md              ← REUSE / EXTEND / GAP / DEVIATION (brainstorm output)
├── DESIGN-MAPPING.md                ← UI element → existing component map
├── DESIGN-DEVIATIONS.md             ← append-only deviation log
├── QUESTIONNAIRE.md                 ← Pontus answers (G3 artefakt)
├── plans/
│   ├── PLAN-sortie-1.md
│   ├── PLAN-sortie-2.md
│   └── ...
├── design/                          ← Cloud Design handoff (JSX/HTML/screenshots/chat-rationale)
├── screenshots/                     ← phase-verifier outputs (YYYY-MM-DD-phaseN-state.png)
├── reports/                         ← audit reports + COUNCIL-<gate>-<timestamp>.md outputs
├── events/                          ← API + telemetry contract for this feature
└── journeys/                        ← Playwright spec.ts + journey.md
```

### 4.2 Naming

- `<domain>` matches an existing folder under `docs/domains/` per ADR-0392
- `<feature>` is the work unit slug: `wizard`, `ik-mat`, `chapter-mode`, etc. Short, kebab-case, scope-descriptive
- One folder per feature/campaign. Multi-sortie work shares one folder; plans/ holds the N sub-sortie plans

### 4.3 Examples

| Domain | Feature folder | What it covers |
|--------|----------------|----------------|
| hms | `docs/domains/hms/wizard/` | HMS Document Mode Wizard (4 sorties) |
| hms | `docs/domains/hms/ik-mat/` | IK-mat daily ops (later sortie) |
| payroll | `docs/domains/payroll/period-lock/` | period close + lock UI |
| schedule | `docs/domains/schedule/swap-flow/` | shift swap workflow |

### 4.4 Who writes here

| Folder/file | Written by | When |
|-------------|-----------|------|
| `SPEC.md` | spec-writer subagent (or Pontus directly) | S4 |
| `STATE.md` | sdsm-orchestrator | every state transition |
| `INVENTORY-REPORT.md` | brainstorm-skill subagent | S2 |
| `DESIGN-MAPPING.md` | brainstorm-skill OR Pontus pre-load | S2 (or pre-SDSM) |
| `DESIGN-DEVIATIONS.md` | brainstorm-skill OR Pontus pre-load | S2 + appends thru S6 |
| `QUESTIONNAIRE.md` | spec-writer (template) + Pontus (answers) | S3 |
| `plans/PLAN-sortie-N.md` | plan-generator subagent | S5 |
| `design/` | Pontus (Cloud Design handoff) | pre-S1 |
| `screenshots/` | phase-verifier via tool-hook | S6 Phase B |
| `reports/` | phase-verifier (audit) + orchestrator (council outputs) | S6 + on-demand |
| `events/` | brainstorm-skill (expected) + phase-verifier (actual) | S2 + S6 |
| `journeys/` | journey-writer subagent + Playwright runner | S6 Phase C/D |

### 4.5 Migration from current flat format

Existing flat `docs/routes/dashboard-calendar.md` and similar will be moved into their domain feature folder over time. No big-bang migration. When a feature touches a route, its folder absorbs the relevant route docs as part of its INVENTORY phase.

### 4.6 Archival

When feature ships and stabilizes, the folder stays in place as historical record. STATE.md final state = `S9 closed`. Future drift-checks reference SPEC + INVENTORY for "what did we promise vs what does code do now".

---

## 5. Tier model (autonomy)

| Tier | Trigger | Pontus-touch | Parallel | Loop budget |
|------|---------|--------------|----------|-------------|
| **T1 — autonom** | 0 GAP, 0 DEVIATION, pure REUSE wiring, token-sweep, dep-bump | 0 (rapport ved close) | 5–8 | 6–12t natt |
| **T2 — batch** | 1–3 additive GAP, klar spec | 1 batch-prompt 2–3x daglig | 3–5 | 1–4t |
| **T3 — human-in-loop** | DEVIATION rows ELLER 4+ GAP ELLER cross-cutting | Pause S3 + S8 | 2–3 | 30 min mellom touch |
| **T4 — Pontus-only** | RLS, secrets, prod HOP B, ny ADR-grade, schema-breaking, pricing | Hands-on | 1 | n/a |

Klassifisering skjer på G2 (etter INVENTORY). Pontus ser tier-stempel ved G3.

---

## 6. Gates → actions mapping

| Gate | Condition | If PASS | If FAIL |
|------|-----------|---------|---------|
| G1 | design-link reachable | → S2 brainstorm | halt + escalate |
| G2 | INVENTORY non-empty + classified | → S3 questionnaire | halt + log |
| G3 | Pontus answers + approves | → S4 spec-writer | sleep until Pontus |
| G4 | Pontus approves SPEC | → S5 plan-generator | iterate SPEC |
| G5 | Pontus approves plan order + test-mode | → S6 first plan | iterate plans |
| G6 | screenshots match + events fire + E2E green | → next phase | self-fix loop (max 3) |
| G7 | full Playwright green (mode=end) | → S8 accept-prompt | escalate per failed journey |
| G8 | Pontus y on accept-prompt | → S9 merge | log reason + return to S6 |

---

## 7. Test cadence flag

`--test-mode continuous` → Playwright runs after each Plan's Phase D.
`--test-mode end` → All Playwright deferred to S7, runs once.

Pontus velger ved S1. Default = `continuous` for T3/T4, `end` for T1/T2 (throughput-optimized).

---

## 8. Self-verification loop

Per build-agent within Phase A → B:

```
Build → verify.sh + screenshot capture
      ↓
PASS? → next phase
FAIL? → diagnose → fix → re-verify
      ↓ (max 3 cycles)
Still FAIL → escalate to Pontus with diagnose
```

Hard time budget: 30 min wall-clock per T1/T2 plan. Loop-trap = death sentence for autonomy-tillit.

---

## 9. Pre-build reviewer-agent (anti-duplication)

Subagent (sonnet) runs between Phase A and Phase B. Greps diff for new component creations. Compares against REUSE-listen in INVENTORY-REPORT. If new component ligner navn/funksjon på REUSE-row → flag som silent-substitution. Blokk merge.

Heartbeat ukentlig: `duplicate-code-scan` på `apps/web/src/components/**`.

---

## 10. Files we have vs need

| Component | File | Action |
|-----------|------|--------|
| Start-hook | `~/.claude/scripts/new-feature.sh` + `/start-feature` skill | extend: `--design-link`, `--test-mode` |
| Brainstorm-skill | — | **build:** `.claude/skills/brainstorm-skill/` |
| Spec-writer | — | **build:** subagent template + `docs/templates/spec.md` |
| Plan-generator | `docs/templates/plan.md` | extend: tier-stempel + tracks/waves/phases schema |
| Tool-hook | `~/.claude/hooks/` | extend: screenshot + event-emit logger til `docs/routes/<route>/screenshots/` + `events/` |
| Phase-verifier | — | **build:** `.claude/skills/phase-verifier/` + verify-runner |
| Journey-writer | `apps/e2e/` | wire: existing Journey Engine → state machine |
| Plan-chainer | — | **build:** orchestrator subagent that reads plan-list + dispatches sequentially |
| Feature folders | `docs/domains/<domain>/<feature>/` | **convention:** per § 4 — orchestrator + subagents write here; no global mirror folder |
| Council integration | `~/.claude/skills/run-council/` | **use as-is** — orchestrator dispatches at council-trigger gates (see § 15) |
| Tier classifier | — | **build:** inline in brainstorm-skill output |
| Pre-build reviewer | — | **build:** subagent dispatched between Phase A/B |
| Heartbeat duplicate-scan | `~/dev/second-brain-v2/HEARTBEAT.md` | add: ukentlig job |

---

## 11. Open questions

1. Hvordan auto-genereres `_ROUTE.md` ved ny `page.tsx`? Heartbeat-job eller pre-commit hook?
2. Cloud Design link kan endre seg over tid — snapshot lokalt eller stol på live?
3. Brainstorm-skill: subagent (haiku) eller in-loop skill?
4. Playwright continuous: wall-clock budget per phase? Default 5 min?
5. Plan-chainer: fail-fast (halt på første feilet plan) eller continue-on-error (rapporter alle feil ved slutt)?
6. Screenshot diff: pixel-exact, perceptual hash, eller bare side-by-side for Pontus å vurdere?
7. Tier auto-promotion: hvor mange suksessfulle T1-sortier før T2 åpnes automatisk?
8. Mobile-routes: skal `docs/routes/m/` ha screenshots fra både simulator OG fysisk device?
9. API-only routes (`docs/routes/api/`): events + reports, men ingen design — er det riktig avgrensning?
10. Migration sortie for flat → nested: én engang-sortie eller gradvis per dashboard-page?

---

## 12. Glossary

- **SDSM** — Smartout Development State Machine (denne)
- **Cloud Design** — Pontus' UI-design som visual contract; eksternt link-basert
- **Discovery** — Phase 0 av sortie; brainstorm-skill inventories eksisterende code + DB
- **REUSE / EXTEND / GAP / DEVIATION** — fire klasser i INVENTORY-REPORT
- **Tier** — T1–T4 autonomi-klasse, sett på G2
- **Gate** — boolean check som trigger neste action eller halt
- **Route-folder** — `docs/routes/<path>/` med design + screenshots + reports + events + journeys
- **Product Done** — eneste lovlige close-state; krever G8 PASS

---

## 13. Non-goals

- IKKE: replace `close-feature.sh` eller `/start-feature` — disse extends, ikke erstattes
- IKKE: replace Journey Engine — denne wires inn som komponent 7
- IKKE: erstatte ADR-prosess — SDSM ADRs registreres normalt i `0000-decision-log.md`
- IKKE: dekke pure-backend sortier i versjon 1 (RPC-only, migration-only) — egen tier-rute i v2

---

## 14. Anbefalt implementeringsrekkefølge

1. **Approve denne spec** (Pontus reviewer + signerer av)
2. Skriv ADR-0395 "SDSM Doctrine" — én side, peker hit
3. Bygg **brainstorm-skill** først (hjernen)
4. Migrate `docs/routes/` flat → nested (én sortie, mekanisk)
5. Bygg **phase-verifier** (gate-håndhever)
6. Extend start-hook + tool-hook
7. Bygg **plan-chainer** (orchestrator)
8. Test SDSM på én T1-sortie (lavest risiko)
9. Skala til T2 etter 5 grønne T1-sortier
10. Skala til T3+ etter Pontus-aksept

---

## 15. Council integration

The `run-council` skill is SDSM's "phone-a-friend" for design-technical questions and architectural validation before gate-transition. Orchestrator dispatches council at the following triggers:

| Trigger | When | Council role |
|---------|------|--------------|
| **DEVIATION detected pre-build** | brainstorm-skill flags Cloud Design vs etablert mønster mismatch | weigh "follow design vs follow pattern", produce recommendation Pontus can accept/reject in 1 click |
| **Tier-grenseuklarhet** | INVENTORY classifies on T2/T3 boundary | members vote on tier, orchestrator stamps |
| **REUSE-claim uncertainty** | brainstorm claims file:line dekker UI-element but semantics unclear | system-steward + supervisor verify before Pontus sees INVENTORY |
| **G4 SPEC has 2+ open architecture questions** | spec-writer flags multi-domain or cross-cutting decision | council pre-vets, Pontus sees council-vetted spec |
| **G6 self-fix loop hits 3 fails** | phase-verifier still red after 3 build retries | council diagnoses, proposes path forward, alternative escalate to Pontus with options |

Council outputs land at: `docs/domains/<domain>/<feature>/reports/COUNCIL-<gate>-<YYYY-MM-DD-HHMM>.md`.

Council is read-only on STATE.md — recommendations are advisory. Orchestrator decides whether to act on council output (T1/T2) or surface to Pontus (T3/T4).

## 16. Import mode (existing-work reconciliation)

SDSM is introduced mid-flight; features already have design/spec/work in progress. Orchestrator must handle this without forcing rebuild.

**On first invocation for a feature where `STATE.md` does not exist:**

1. Search for existing artefakter in `docs/domains/<domain>/<feature>/` AND `docs/domains/<domain>/` (legacy flat):
   - `SPEC.md` or matching file under `docs/superpowers/specs/`
   - `DESIGN-MAPPING.md`
   - `DESIGN-DEVIATIONS.md`
   - `design/` folder with Cloud Design assets
   - `plans/` folder or scattered `PLAN-*.md` files in `docs/plans/`
2. Classify highest plausible state from what exists:
   - Only `design/` → S1
   - `design/` + `DESIGN-MAPPING.md` (or INVENTORY) → S2 PASS, advance to S3
   - All above + `SPEC.md` → S4 PASS, advance to S5
   - All above + `plans/` populated → S5 PASS, advance to S6 (resume at first non-DONE plan)
3. If artefakter found under legacy flat path (`docs/domains/<domain>/`), propose migration to `docs/domains/<domain>/<feature>/` and request Pontus approve the move
4. Create STATE.md retrospectively with gate-history reconstructed from artefakt timestamps
5. Surface to Pontus: "Imported. Reconciled state = S<X>. Reasoning: <one line>. Next: <next action>. Approve?"
6. After Pontus confirms → proceed per normal state machine

**Import-mode never invents history.** If an artefakt is missing or ambiguous, orchestrator pauses and asks Pontus rather than fabricate.

## Status

DRAFT — pending Pontus review + sign-off.
