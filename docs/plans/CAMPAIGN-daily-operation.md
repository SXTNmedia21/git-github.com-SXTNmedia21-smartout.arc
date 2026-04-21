---
title: "Campaign — daily-operation"
status: active
updated: 2026-04-21
created: 2026-04-20
module: Dashboard
tags: [campaign, roadmap, d6, operations, reconciliation, handover]
---

# Campaign — daily-operation

> Branch: `campaign/daily-operation` | Worktree: `/home/sxtnl/dev/smartout.ai-daily-operation` | Module: Dashboard (D6 + C1) | Started: 2026-04-20

## Vision

**Dagen er en `department_session`. WebDayControl er source of truth.** Alt som skjer i løpet av én driftsdag — vakter, oppgaver, avvik, meldinger, handover, oppgjør — er lag på denne ene kanoniske sesjonen. WebDayControl-panelet er hvor ledere og admin ser og styrer dagen; hver knapp, KPI og funksjon må være **drevet av live data**, aldri mock. Mobil speiler samme data men er utøvelsesflaten (punch, oppgaveløsning, avvik, handover, clockout-avstemming).

Kampanjen leverer tre ting:
1. **Fullfører D6-runtime** med recon V2 (web) og clockout-wizard (mobil) — designbundelen `smartout/project/day/` + `Avstemming.html` + `Avstemming Mobile.html`.
2. **Løser en dual-source-of-truth-konflikt** for handover (mobil skriver til `session_note`, alle lesere bruker `department_session.handoff_notes`-kolonnen).
3. **Etablerer "source of truth"-disiplin** som merge-gate: hver sub-sortie må verifisere at alle kontroller i sine flater er live-wired før close.

## Campaign Invariants (acceptance-gate for hver sub-sortie)

### Arkitektur-invarianter

1. **Live-wired disiplin — enforceable via 3 CI-gates** (tidligere fra én prosaic linje, omformulert av Frontend council 2026-04-20 for å gå fra "discipline" til testbare gates):
   - **CI-gate 1:** `rg -n 'text-(zinc|gray|slate|neutral|stone)-|bg-(zinc|gray|slate|neutral|stone)-|border-(zinc|gray|slate|neutral|stone)-|#[0-9a-fA-F]{3,8}'` på endrede filer returnerer null treff.
   - **CI-gate 2:** hver `var(--*)` i endret CSS/TSX finnes i `packages/design-tokens/src/tokens.css` i BEGGE blokker (`:root` + `.dark`).
   - **CI-gate 3:** alle `<motion.*>`-komponenter i endrede filer har eksplisitt `transition`-prop eller arver fra `MotionConfig`.
   - **Grep-gate close-review:** `rg 'TODO|FIXME|mock|placeholder|console\.log\(.*click' <touched-files>` = 0 i rendret UI.
2. **Single source of truth per data-type.** Ingen ny dual-write. `department_session.handoff_notes`/`signoff_notes`-kolonnen er kanonisk for handover og signoff-notat. Sub-sortie-spec må eksplisitt nevne hvilken tabell/kolonne som skrives/leses og hvorfor.
3. **Telemetry-emit via registry.** Ingen direkte `engine_event.insert()`. Alle nye mutasjoner emitter via `packages/telemetry/src/registry.ts` med `entity: EntityRef`.
4. **ADR-0133 scope-grense.** Web komponerer (authoring, KPI, layout, approve); mobil utfører (punch, task-complete, handover, clockout-wizard). Ingen drag-drop-redigering på mobil.
5. **ADR-0134 telemetri-kontrakt.** Alle nye mobile mutasjoner resolverer `workspace_id` + `actor_id` via `getProfileContext()` før `emit()`. `?? ""`-fallback er forbudt.
6. **Close-gate.** Typecheck 0-feil. Journey-fil (admin/leder/ansatt, happy+error). Handoff-fil (decisions + learnings + next steps). E2E required for M2 + M3 (pengeflyt + audit-trail).

### Hospitality-invarianter (lagt til av Hospitality Council 2026-04-20)

7. **Role-gated wizard trigger.** Clockout-wizard-route (M2) MÅ verifisere at actor har `is_shift_leader`-rolle for sesjonen før render. Trigger-level fire er ikke tilstrekkelig; route-level guard i `clockout.tsx` påkrevd. Beskytter entry worker / low-literacy-personaer fra å treffe wizard ved trigger-misconfig.
8. **Resumability.** Enhver flerstegs wizard (recon, handover) MÅ persistere stegtilstand til DB på hver `onNext`, og gjenoppta ved siste fullførte steg + 1 ved re-entry. Ingen "lost progress"-modaler. Hvis >12t siden sist, tving fresh start (data kan være stale).
9. **Admin-override på preflight m/ audit-trail.** Preflight-gate-blokkere KAN overstyres av admin-rolle med tvunget reason-felt + `activity_trail`-rad tagget `override=true`. Hard-blokk uten override er ikke akseptabelt for live drift.
10. **Conditional steps per department-config.** Cash-count, tips, HACCP-steg MÅ sjekke `department`-flagg (`cash_handling_enabled`, `tips_enabled`, `haccp_enabled`) før render. Wizard må ikke tvinge ubrukte steg.
11. **Split-shift semantikk.** Enhver query merket "forrige vakt" / "forrige session" MÅ løses som "siste lukkede `department_session` for `department_id` der `end_at < current.start_at`", IKKE kalender-dato. Kalenderdag-antagelser forbudt i D6-runtime queries.
12. **Riksavtalen tariff-awareness i KPI-step.** Wizard-steg 01 (KPI) lønn-linje MÅ reflektere kveldstillegg (21:00–06:00), helgetillegg (lør 15:00 – søn 24:00), helligdagstillegg (100 %) fra `tariff_rate_table`, ikke raw hours × base. Hvis DB-derivering ikke klar, marker linje "Estimat — eksl. tillegg" eksplisitt.
### Invariant #13 — No blockers, always navigable

**Rule:** Admin-flaten har aldri dead-ends. Hvis `department_session` mangler for en gitt dato, skal UI-en tilby manuell opprettelse. Hvis ingen shift er punchet, skal admin kunne legge inn tidspunktene retroaktivt. Hvis en session står fast i en status, skal admin kunne overstyre transisjonen. Tomme tilstander er CTAs, ikke dead-ends.

**Why:** En admin kan sitte to dager etter et vakt-skift uten internett eller uten at dagens session ble opprettet automatisk. Systemet må fungere uavhengig av automatikk. Ingen blockers mellom admin og sannheten.

**How to apply:**
- `NoSessionCTA` erstatter dead-end "Ingen session"-tilstand med to knapper (Opprett som planlagt / Åpne nå aktiv).
- `SessionActionsBar` viser alltid lovlige status-transisjoner som knapper — ikke skjulte i context-menyer.
- `RosterTab` har inline Pencil-knapp på hver rad som åpner `ManualTimeEntryDialog` for retroaktiv punch_in/punch_out.
- `DateNavigator` lar admin navigere fritt fram/tilbake i datoer — "Tilbake til i dag"-knapp når ikke på dagens dato.
- Alle manuelle handlinger gated via `engine_authority_config` (C4) og logget via `emit()` med `manual=true`.

## Scope

### In scope — flater

| Flate | Path | Eier |
|---|---|---|
| WebDayControl (7 tabs) | `apps/web/src/components/day/*` | Denne campaignen (polish + live-wiring-audit) |
| Reconciliation list + detail | `apps/web/src/app/dashboard/reconciliation/**` | Denne campaignen (recon V2) |
| Clockout-wizard mobile | `apps/mobile/app/(app)/(home)/clockout.tsx` (ny route) + `apps/mobile/src/components/reconciliation/*` (ny) | Denne campaignen (ny 6-stegs wizard) |
| Mobile home Before/During/After | `apps/mobile/src/components/home/*` | Denne campaignen (DuringShiftView redesign + handover-surface) |
| Handover dataflyt | `department_session.handoff_notes` (kanonisk) | Denne campaignen (migrere mobil bort fra `session_note`) |
| Operations dashboard | `apps/web/src/app/dashboard/operations/page.tsx` | Separat surface — *ikke rørt* i denne campaignen |
| `/dashboard/close` flow | `apps/web/src/app/dashboard/close/**` | Separat surface — *ikke rørt*, cross-link only |

### Explicit out-of-scope

- Scheduling authoring (drag-drop, shift composition) — web-only per ADR-0133, ikke denne campaignen.
- Season/year-wheel planning — `campaign/year-wheel`.
- Helpdesk ticketing — `campaign/helpdesk`.
- Botsson/agent-router/voice — `campaign/botsson-arena`.
- Onboarding wizard / contract composition — web-only, ikke denne.
- `/operations` dashboard redesign — separat (pulse-view, ikke admin day-control).

## Prerequisite Commit 0 (før Milestone 1 starter)

Fact-check 2026-04-20 v2 korrigerer tidligere antagelse: **`--dept-service` er ikke manglende fordi `--dept-floor` (OKLCH hue 180, både lys og mørk) allerede dekker sal/service/floor**. `dept-key.ts:16` mapper `sal | floor | service` → `floor`-DeptKey; `ShiftCard.tsx:6,14` leser `var(--dept-floor)`. Designbundelens `sal` er altså allerede støttet. Ingen ny dept-token trengs.

Kun ÉN token mangler faktisk: `--hero-warm-deep` for DuringShift gradient-hero (M4). Legges kun i `packages/design-tokens/src/tokens.css`:

```css
/* Legg til i :root block (etter --dept-storage) */
--hero-warm-deep: oklch(0.28 0.04 48);    /* DuringShift gradient-end, lys modus */

/* Legg til i .dark block (etter --dept-storage dark) */
--hero-warm-deep: oklch(0.22 0.035 48);
```

Refereres av M4 (`DuringShiftView.tsx` gradient-hero). Frontend council justerte chroma fra 0.015 til 0.035 fordi 0.015 leste som "grå med snev av varme"; 0.035 treffer bundelens visuelle intensjon (warm OKLCH hue 48).

`tokens.ts` + `native.ts` holder ikke dept- eller hero-tokens (kun brand/semantic/light/dark/radius/typography), så ingen endring der.

## Milestones

Fire sub-sorties + inline-cleanup. Totalt ~12–16 dev-days (revidert fra 10–12 etter council 2026-04-20 bumped M2 og M3).

### Milestone 1 — `recon-v2` (web)

Recompose `apps/web/src/app/dashboard/reconciliation/page.tsx` + `_components/reconciliation-page-client.tsx` til designbundelens layout:
- **Liste-visning:** tabell med status-pills (PhaseBadge), filter-chips (status/avdeling/dato), counters i header ("Venter oppgjør / Klar til å låse / Avvik denne uka").
- **Detalj-visning:** 1fr + 380px grid med sticky approve-panel. 6 tabs per designbundelens `detail.jsx`: Oversikt / Omsetning / Vakter / Avvik / Oppgaver / Revisjonslogg.
- **Preflight-gate:** "X punkter må løses før godkjenning" med klikkbare rader som hopper til riktig tab. Blokker approve-knapp hvis blockers > 0.
- **Prereqs:**
  - Prerequisite Commit 0 landet (`--hero-warm-deep` token; `--dept-floor` finnes allerede og dekker sal/service).
  - T5 er lukket — ingen convergence-arbeid.
  - **Dedupe `deviation reported` triple-emit-strategi avklart** (3 emit-sites: `use-create-deviation.ts`, `DeviationDialog.tsx`, `use-report-deviation.ts`) før Avvik-tab shippes, ellers QA-dashbord ser triplette aktiverte events.
- **Preflight-gate visuelle invarianter** (Frontend Council):
  - Blocker-liste: `bg-destructive/10` card med `border-l-4 border-destructive` (ikke full border — 40 %-reduksjon).
  - Hver rad `role="button"` + `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`.
  - Approve-knapp state-maskin: `blockers > 0` → `disabled` + `aria-disabled="true"` + tooltip "Løs X blokkere først" (admin-override per Inv #9 tilgjengelig).
  - Counter-badge i header: `font-mono tabular-nums`.
  - Click-to-jump: `scrollIntoView({ behavior: 'smooth', block: 'center' })` (ikke `'start'` — `'start'` skjuler raden under sticky topbar).

**Tid:** 2.5–3d. **PR-strategi:** 2 PR-er (layout + preflight-gate, deretter dedupe-fix + CSV-eksport).
**Feature flag:** `NEXT_PUBLIC_RECON_V2=true` mens utvikling pågår; fjern ved close.

### Milestone 2 — `recon-wizard-mobile` (mobile)

Ny 6-stegs wizard som trigges automatisk når skiftleder stempler ut. Designbundle `mobile/Avstemming Mobile.html`:

| # | Skjerm | Innhold |
|---|---|---|
| 00 | Stemplet ut | Bekreft clockout-tid + start avstemming |
| 01 | Oversikt | Dagens KPI (omsetning, timer, lønn, margin) |
| 02 | Omsetning | Bekreft tall fra POS / manuell inntasting |
| 03 | Kontanttelling | Telle kontanter, valuta-breakdown |
| 04 | Avvik | Gjennomgå åpne avvik, merk som løst/eskaler |
| 05 | Se gjennom | Full-preview før innsending |
| 06 | Sendt | Confirmation + link tilbake til home |

**Datasti:**
- Trigger: `department_session.status='pending_signoff'` transisjon skjer **server-side** via trigger i `supabase/migrations/20260428100400_session_pending_signoff_trigger.sql` når siste leder stempler ut. Mobile wizard detekterer via **Supabase Edge Function → Expo push-notifikasjon** (Hospitality council valgte push over realtime/poll — realtime er flaky på 4G, poll drainer batteri).
- Skriver: `daily_reconciliation` rad opprettes/oppdateres progressivt per steg. Hver edit skriver ny audit-rad (edit-history), ikke overskriv — admin må kunne rekonstruere "confirmed 245k → edited to 238k".
- Emit: ett `reconciliation step_completed` event per steg (ny registry-entry) + `reconciliation submitted` ved steg 06.
- Zod-validering: følger mønsteret i `packages/shift-clock/src/schemas.ts`. Nye wizard-step-schemas legges som `packages/shift-clock/src/reconciliation-schemas.ts` ELLER ny `packages/reconciliation/` — avgjøres i milestone-2 brainstorm.
- Resumability (Inv #8): hver `onNext` persisterer til `daily_reconciliation.wizard_state` (ny JSONB-kolonne, ADR-NEXT-02). Re-entry leser state og hopper til `last_step + 1`.
- Conditional steps (Inv #10): `department.cash_handling_enabled` → render steg 03; `department.tips_enabled` → render steg 03b (tips, Hospitality F-1); `department.haccp_enabled` → HACCP-del i steg 04 (avvik).
- Role-guard (Inv #7): `clockout.tsx` verifiserer `isShiftLeaderForSession(sessionId, profileId)` før render. Non-leder → redirect til home med friendly melding.

**Tid:** 5–7d (council 2026-04-20 bumped fra 3–4d etter hospitality-funn: tips-step, resumability, cash-skip-konditional, push-notif-stack, role-detection). Busy-Friday-flyt 5–8 min (ikke 4–6 som opprinnelig designspec). **Prereq (HARD, før M2 starter):** ADR-NEXT-02 "Mobile clockout-wizard trigger kontrakt" (shift-leader-detection, push-delivery, resumability-kontrakt, override-semantikk).

### Milestone 3 — `handover-migration` (mobile + dataflyt)

Løs dual-source-of-truth-konflikten (C1 alt 1 — kolonnen vinner):

**Prereqs (gjør først):**
- Fix F1: erstatt `workspace_id ?? ""` i `apps/mobile/src/components/shift-clock/ShiftClockView.tsx:68,243` med `getProfileContext()`-gate eller render-gate. ADR-0134-brudd må lukkes.
- Audit alle andre `workspace_id ?? ""` i aktiv mobile-kode og fiks (12+ treff per grep).

**Migrasjon:**
- `apps/mobile/src/components/shift/HandoffForm.tsx` → `useSubmitHandoff` hook skriver `department_session.handoff_notes` (append med timestamp + author) i stedet for `session_note(note_type='handoff')`-rader.
- `apps/mobile/src/hooks/mutations/use-submit-handoff.ts` + tilhørende offline-queue action-map (lokal i mobile) omdirigeres til ny RPC `append_session_handoff(session_id, note, author_profile_id)` for atomisk append. RPC eksisterer ikke ennå — lages i milestone-3.
- Deprekér `session_note(note_type='handoff')`-rader: ADR "Handover stored on department_session.handoff_notes; session_note.note_type='handoff' deprekert." Keep rows for audit, ikke skriv nye.

**Surface:**
- `apps/mobile/src/components/home/BeforeShiftView.tsx` leser **siste lukkede `department_session` for samme `department_id` med `end_at < current.start_at`** (Inv #11 split-shift semantikk — IKKE kalender "forrige dag") og viser "Notat fra forrige skift" card.
- `DayApproval.tsx` + `DailyNoteSheet.tsx` leser allerede kolonnen — ingen endring.
- Close-gate grep: `rg "session_note.*note_type.*handoff"` på HEAD etter M3 = 0 skrivere (kun historiske rader bevart for audit).

**Tid:** 2.5–3d (council 2026-04-20 bumped fra 1.5–2d — 12+ `workspace_id ?? ""`-sites i aktiv mobile-kode koster). **ADR:** 1 ny (ADR-NEXT-01 handover canonical location).

### Milestone 4 — `mobile-parity-poc`

Første konkrete steg i dual-platform-strategien (ADR-0158):

- 3 widgets PoC-migrert med `.native.tsx` varianter (eller Metro-resolver — ADR-0158 avgjør): **PhaseBadge** (visuell primitive), **TaskRow** (interaksjons-primitive), **KpiTile** (data-primitive). Frontend-designer byttet ShiftCard→TaskRow — interaksjon stresser boundary bedre.
- `apps/mobile/src/components/home/DuringShiftView.tsx` redesign mot designbundelens gradient-hero:
  - Nytt token: `--hero-warm-deep: oklch(0.22 0.015 50)` i `packages/design-tokens/` (ikke bruk `bg-foreground` — for mørk).
  - Radial-gradient orb med `useReducedMotion()`-gate.
  - Geist Mono 52pt tabular-nums live-timer (ingen tick-animasjon).
  - Earnings/pause/tillegg grid.
  - Noise-overlay på gradient (Nordic Split § glassmorphism).
  - A11y: `aria-label` på dept-stripe, focus-ring på clock-out-CTA.

**Tid:** 3–4d. **PR-strategi:** 2 PR-er (widget PoC, deretter DuringShift redesign).
**Feature flag:** `EXPO_PUBLIC_DURING_SHIFT_V2=true` til merge-ready.

### Motion-spec (Frontend Council)

**Milestone 1 — recon-v2 web:**

| Overgang | Params |
|---|---|
| Tab-content transition | `AnimatePresence mode="wait"` · spring `stiffness: 38, damping: 22, mass: 2.2` · opacity 0→1, y 8→0 |
| Blocker-badge pulse på endring | spring `stiffness: 42, damping: 18, mass: 2.0` · scale 1→1.12→1 |
| Preflight-card exit når blockers=0 | spring `stiffness: 35, damping: 24, mass: 2.3` · opacity 1→0, height auto→0, y 0→-8, min 400ms |
| Approve-knapp disabled→enabled | 250ms · opacity + scale 0.98→1 spring |
| Sticky approve-panel | **Animerer IKKE på tab-switch** (forhindrer layout-thrash) |

**Milestone 2 — recon-wizard-mobile:**

| Overgang | Params |
|---|---|
| Forward-step | spring `stiffness: 40, damping: 23, mass: 2.2` · x 24→0, opacity 0→1 |
| Backward-step | samme spring · x -24→0, opacity 0→1 |
| Exit (forward) | x -24, opacity 0, 280ms |
| `prefers-reduced-motion` | Crossfade only 200ms |
| Progress-header | Morphing progress-fill (ikke dots — dots feiler WCAG AA ved typisk mobile-tetthet) |
| Success-orb (steg 06) | `useReducedMotion()`-gate + battery-saver fallback (`getBattery()` low-power → frozen radial-gradient) |

**Milestone 4 — DuringShiftView hero:**

| Overgang | Params |
|---|---|
| Hero-orb breathe | scale 1→1.04→1, 8s ease-in-out infinite alternate |
| Reduced-motion fallback | `{ scale: 1 }` static |
| Live-timer tick | **Ingen animasjon** — `font-mono tabular-nums` bærer hjulet |

### A11y acceptance gates (alle sub-sorties)

Hver close-feature-gate sjekker:
1. **Keyboard-only run** — full flyt uten mus. Uberoppbare elementer = fail.
2. **`prefers-reduced-motion`-run** — orbs statisk, crossfade only, zero translate-animasjoner.
3. **Color-contrast (Axe)** — dept-stripe `--dept-floor` må hit WCAG AA (4.5:1) mot `bg-card` i LYS OG MØRK modus.
4. **Screen-reader run** — VoiceOver (mobil) + NVDA (web): blocker-liste annonserer count-endring; approve-knapp annonserer disabled-grunn via `aria-describedby`.
5. **L2-norsk lesbarhet** — primary-action-verb Hunspell-verifisert B1-norsk (no "reconsiliere"; "avstemme" OK; "kontroller" framfor "verifiser").
6. **Touch targets ≥56px** (AAA, ikke AA) — kokken/bar-kontekst = hansker.
7. **Focus-ring synlig ved 200 % zoom** på web detail.

### Inline-cleanup (ikke egen sub-sortie)

- Oppdater `docs/followups/OVERVIEW-V2-DEBT-TICKETS.md` med status pr. 2026-04-20 (stale-debt-mønster).
- Skriv L-ny: "Debt-tickets krever grep-verifisering mot HEAD før bruk i planlegging. 5 av 8 tickets i OVERVIEW-V2-DEBT-TICKETS var ferdige i kode ved plan-start; ingen oppdatering."
- Lukk Linear-tickets for T1/T4a/T4b/T7/T8.

## Roadmap — Fem faser

Foundation-fasen (4 milestones over) er bare starten. Worktree-et lever så lenge daily operations er et Smartout-område. Følgende faser revisiteres når forrige er i produksjon og verifisert.

### Fase A — Foundation (NÅ — ~12–16 dev-days)

M1 recon-v2 (web), M2 clockout-wizard (mobile), M3 handover-migration, M4 mobile-parity-poc. Leveranse: WebDayControl + Avstemming (web+mobil) som live, source-of-truth daily-operations-flate. Alle 12 invariants håndheves på close.

**Success-kriterium for å forlate fase A:** Café Skuta (pilot) kan åpne, kjøre, og lukke en dag ende-til-ende gjennom Smartout uten å gå utenfor systemet. Leder-closing-time < 8 min. Handover-read-rate > 60 % (etter 2 uker bruk).

### Fase B — Intelligens-lag (~3–4 uker etter A)

AI-copilot som observerer session-eventene og foreslår under live service:

- **Avvik-deteksjon:** HACCP-temperatur-logg > 6 °C → auto-foreslår `deviation`-utkast med foreslått severity.
- **Prep-prediksjon:** Fredag kl 10:00 prep-vindu → "Basert på siste 4 fredager og værmelding: vent 28 % flere lunsjgjester enn planlagt. Legg til 2 prep-timer?"
- **Anomali-varsling:** Labor % kryper mot 22 % kl 16:00 → "Vakt-dekningen overstiger plan — vil du frigi ad-hoc-vakten?"
- **Voice-drevet session-oppdatering (ADR-0135 LiveKit):** "Marcus, logg at vi er tom for laks" → mobile wizard tar opp og skriver `session_note`.

**Tekniske prereqs:** ADR-0135 LiveKit på mobil landet (blokkert nå), packages/ai operations-intelligence capability utvidet.

### Fase C — Multi-site & consolidation (~8 uker etter B)

Fra single-site per recon → multi-site-roll-up:

- **Cross-department dependencies:** kjøkken-prep-hook-completion kan blokkere bar-åpning, synliggjort i DayControl timeline.
- **Multi-site day-view:** Manager med 3 sites ser alle 3 i én skjerm med status-pills og drill-down.
- **Chain-benchmarking:** Anonymisert sammenligning mot peer-restauranter (lunsj-labor %, handover-kvalitet, avvik-frekvens).
- **Konsolidert compliance-rapport:** Månedsrapport per chain med Riksavtalen-tariff-overholdelse, HACCP-evidence-dekning, avviks-closure-rate.

### Fase D — Operativ mestring (~8 uker etter C)

Dagen blir ikke bare utført, den blir LÆRT:

- **Playbook-system:** Spar en god dag som mal ("Travel lørdag — Marcus' playbook"). Gjenbruk på tvers av sites.
- **Mentor-modus:** Ny leder får guided inn-steg: "Siste gang Cecilie åpnet, gjorde hun X, Y, Z i denne rekkefølgen."
- **Skills-progresjon:** Hver ansatt har operational-score som bygger over tid (avvik-rapportering, handover-kvalitet, closing-speed).
- **Post-mortem auto-compose:** Etter "bad day" genereres forslag til operational-læringer for review.

### Fase E — Autonom drift (~12 uker etter D, eller aldri)

Semi-autonomi der det gir mening, aldri der det ikke gjør:

- **POS-auto-fill i wizard:** Omsetningstall hentes automatisk, leder bekrefter kun.
- **AI-generert handover-utkast:** Basert på session-events + avvik-åpne + oppgaver-uferdig, foreslått handover-tekst. Leder redigerer + bekrefter.
- **Auto-compose recon-narrative:** "I dag: omsetning +4 % vs mål, lønn -3 % (Cecilie tok ekstra vakt lør), 1 avvik (kjølerom, løst 13:45). Oppsummer eller rediger?"

Fase E er retning-indikasjon, ikke commitment. Autonomi i D6 krever etisk+forretnings-review før hver release.

---

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none — venter på at første sub-sortie starter med `/start-feature recon-v2` fra denne worktree._

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md`. Inherited from development at campaign start; campaign-specific decisions registreres her:

### Bindende ved campaign-start (fra `feat/overview-v2` og tidligere councils)

- **ADR-0127–0131** — Mobile Strategy (web komponerer, mobil utfører).
- **ADR-0133** — Mobile Surface Boundary (D6+C4 på mobil).
- **ADR-0134** — Mobile Telemetry Contract (ikke-null workspace_id/actor_id).
- **ADR-0114** — Server Actions as canonical mutation primitive.
- **ADR-0115** — RSC migration pattern.
- **ADR-0156** — Day-Control Panel canonical admin surface.
- **ADR-0157** — Server Actions scope amendment.
- **ADR-0158** — `packages/ui` dual-platform strategy.

### ADR-utkast denne campaignen (skrives per sub-sortie)

- **ADR-NEXT-01** — Handover canonical location: `department_session.handoff_notes` (column), not `session_note(note_type='handoff')` rows. (Milestone 3)
- **ADR-NEXT-02** — Mobile clockout-wizard trigger contract + state machine. (Milestone 2)

### Rettelser fra council 2026-04-20 (denne campaignen)

- **C1 reverserer designspec `2026-04-19-day-information-components-design.md` §11** — handover er IKKE på `time_entry.handoff_notes`; er på `department_session.handoff_notes`. Spec må oppdateres post-milestone-3 (L-0046 triple-lens-regel).
- **C3 rettelse** — `tasks_total`/`tasks_completed` er DB-kolonner skrevet av `engine-dispatch` Edge Function (linje 1636-1648), IKKE klient-derivert. Ikke legg til klient-writes som racer dispatcher.
- **F3 dokumentert** — `communication.broadcast_sent` fans til 2 destinations (activity_trail + posthog), ikke 4. Intensjonell.

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
| 2026-04-20 | — (campaign created) | — |
| 2026-04-21 | `8a717bd7` fix(telemetry): remove activity_trail from pre-auth emit routing | `dba6226d` chore(daily-operation): sync development (29 commits) |

## Changelog

| Dato | Versjon | Endring | Forfatter |
|------|---------|--------|-----------|
| 2026-04-20 | 1.0.0 | Initial campaign doc — 4 milestones + invariants. Informert av /run-council 2026-04-20 (verdict: APPROVE WITH CHANGES etter fact-korreksjon). | Pontus + Claude |
| 2026-04-20 | 1.1.0 | Post-council-2 additions: Invariants 7–12 (hospitality), Invariant #1 reformulert til 3 CI-gates (Frontend), Prerequisite Commit 0 (`--dept-service` + `--hero-warm-deep` tokens), M2 estimat 3–4d → 5–7d, M3 estimat 1.5–2d → 2.5–3d, push-notif over realtime/poll, split-shift semantikk, motion-spec-tabeller per milepæl, a11y-acceptance-gates (7 punkter), dedupe-krav for `deviation reported` i M1. | Pontus + Claude |
| 2026-04-20 | 1.1.1 | Korrigering: `--dept-service` er ikke manglende. `--dept-floor` (hue 180, lys+mørk) dekker allerede sal/service/floor via `dept-key.ts:16`-mapping. Kun `--hero-warm-deep` faktisk manglende. L-ny: council-fact-checks kan bomme på semantisk ekvivalens (token-alias missed). | Claude |
| 2026-04-20 | 1.2.0 | Added Invariant #13 — no blockers, always navigable. Delivered via session-lifecycle sub-sortie. | Pontus + Claude |
