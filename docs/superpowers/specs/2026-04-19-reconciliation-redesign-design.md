---
title: "Avstemming — Redesign Design Spec (Web + Mobil)"
id: DESIGN_RECON_2026_04_19
version: "1.0"
status: draft
layer: spec
created: 2026-04-19
updated: 2026-04-19
author: pontus + claude
supersedes: []
depends_on:
  - PRD_03
  - ADR-0113
  - ADR-0114
  - ADR-0115
  - ADR-0132
  - ADR-0133
  - ADR-0134
tags:
  - spec
  - reconciliation
  - redesign
  - ux
  - nordic-split
module: operations
---

# Avstemming — Redesign Design Spec

> Komplett designspec for redesignet avstemmingsflate. Dekker alle sider, alle forms, tilstandsmaskiner, mobil-parity og Nordic Split-etterlevelse.
> **Kanonisk kilde** for funksjonell definisjon: `docs/architecture/PRD-03_Avstemmingssystem.md`.

---

## 0. TL;DR

- Tre avstemmingsnivåer: **daglig** (eksisterer), **yrke** (ny), **sesong** (ny).
- To-fase per dag: **ansatt settler (Fase 1)** → **admin godkjenner (Fase 2)** → **lås**.
- Handoff-motor (AI-chat → telefon → admin) er et **førsteklasses designmål**, ikke et påheng.
- Policy-styrt (frister, toleranser, eskalering) — konfigureres per workspace, overstyres per avdeling.
- Nordic Split + CSS-variabler. Null hardkodede farger. Mobile parity fra dag én.

---

## 1. Designprinsipper (binder alle sider og forms)

1. **Avstemming er en session, ikke en approval.** Operativ sign-off (første/siste ansatt) + administrativ sign-off (admin/manager).
2. **Progressive disclosure.** Listevisning = trafikklys. Detaljvisning = alt du trenger. Aldri blande.
3. **Gate-driven actions.** "Godkjenn"-knapp er alltid synlig, men disabled til preconditions er oppfylt, med tydelig "hva mangler".
4. **40%-reduksjon.** Ikke bokser inni bokser. Plass, lys, typografi-hierarki — ikke ramme på ramme.
5. **Én primær CTA per skjerm.** Sekundære actions som ghost/outline. Destruktivt som destructive-variant.
6. **Spring physics overalt.** stiffness 30–45, damping 20–24, mass 2–2.5. Minimum 500ms entrance / 250ms exit.
7. **Web komponerer, mobil eksekverer** (ADR-0133). Admin godkjenner på web. Ansatt settler + close-out på mobil. Mobile autoring = nei.
8. **Mutasjon = emit.** Ingen DB-skriv uten `emit()`. `workspace_id` + `actor_id` alltid satt (ADR-0134).

---

## 2. Surface-kart (alle sider og forms)

### Web (admin/leder)

| ID | Rute | Rolle | Hensikt |
|---|---|---|---|
| W-01 | `/dashboard/reconciliation` | admin, owner, manager | Daglig avstemming — liste + detalj |
| W-02 | `/dashboard/reconciliation?date=YYYY-MM-DD&dept=X` | — | Deeplink til spesifikk dag |
| W-03 | `/dashboard/reconciliation/occupational` | admin, owner | Yrkesavstemming — periode + yrke |
| W-04 | `/dashboard/reconciliation/season` | admin, owner | Sesongavstemming — strategisk lukking |
| W-05 | `/dashboard/reconciliation/handoffs` | admin, owner, manager | Handoff-innboks på tvers av dager |
| W-06 | `/dashboard/settings/reconciliation` | admin, owner | Policy-konfigurasjon |
| W-07 | `/dashboard/schedule` → Day Control → Økonomi-tab | ansatt (on-shift) | Registrer dagsoppgjør (Fase 1) |

### Mobil (ansatt)

| ID | Skjerm | Rolle | Hensikt |
|---|---|---|---|
| M-01 | `Punch-out → Close-out Prompt` | ansatt (siste ut) | Bekreft oppgaver, kommenter avvik, registrer hendelser |
| M-02 | `Dagsoppgjør`-skjerm | ansatt (stenging) | Registrer omsetning + kontanttelling |
| M-03 | `Handoff-chat` | ansatt | Svare AI-spørsmål om avvik |
| M-04 | `Mine avstemminger` (lenke fra profil) | ansatt | Status på dager ansatt har vært på |

### Forms (teller på tvers av sider)

| ID | Form | Primær side | Modal eller inline |
|---|---|---|---|
| F-01 | Settlement submit | W-07 / M-02 | Inline |
| F-02 | Close-out prompt | M-01 | Full-screen modal |
| F-03 | Shift hours edit | W-01 (Vakter-tab) | Modal |
| F-04 | Revenue manual adjust | W-01 (Omsetning-tab) | Modal |
| F-05 | Deviation resolve | W-01 (Avvik-tab) | Modal |
| F-06 | Day approve | W-01 (Action bar) | Inline |
| F-07 | Day reject | W-01 (Action bar) | Inline expandable |
| F-08 | Day lock | W-01 (Action bar, etter approve) | Inline confirm |
| F-09 | Request handoff | W-01 (Shift / Deviation actions) | Modal |
| F-10 | Occupational period close | W-03 | Multi-step wizard |
| F-11 | Season period close | W-04 | Multi-step wizard |
| F-12 | Policy config | W-06 | Settings form |
| F-13 | Bulk approve (hele uken) | W-01 (list toolbar) | Modal |

---

## 3. Global layoutkontrakt

### 3.1 Dashboard shell
Følger ADR-0113 (DashboardContext facade) + ADR-0115 (RSC pattern):
- `page.tsx` = Server Component + `<Suspense>` + én klient-boundary.
- Alt interaktivt lever under `"use client"` én gang, per rute.
- Data fetches via `useQuery` hooks — ingen `React.use()` i klient-tre.

### 3.2 Navigasjon
Sidebar-item: **Avstemming** (Lucide `ClipboardCheck`). Badge-teller = antall dager med `status IN ('submitted','awaiting_approval','unreconciled')`.

### 3.3 Typografi-hierarki (hele området)
| Nivå | Stil |
|---|---|
| Side-tittel | `font-heading text-3xl` (Instrument Serif) |
| Seksjon-tittel | `font-heading text-xl` |
| Kort-tittel | `text-sm font-medium` |
| Tall / KPI | `font-mono text-2xl tabular-nums` |
| Body | Geist Sans default |
| Metadata | `text-xs text-muted-foreground` |

### 3.4 Farge-semantikk (KUN CSS-variabler)
| Semantikk | Variabel | Bruk |
|---|---|---|
| Overflate | `bg-background` / `bg-muted` | Sider, kort |
| Tekst | `text-foreground` / `text-muted-foreground` | Primær / sekundær |
| Ramme | `border-border` | Alle streker |
| Handling (primær) | `bg-primary text-primary-foreground` | Godkjenn |
| Fare | `bg-destructive text-destructive-foreground` | Avvis / slett |
| Advarsel | `border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400` | Venter, pending |
| Suksess | `border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400` | Godkjent |

**Forbudt:** `bg-white`, `text-zinc-*`, `border-zinc-*`, `bg-gray-*`, hex-kode i className.

---

## 4. Side-spec

### W-01 — Daglig avstemming (hovedflaten)

**Layout:** tre-kolonne responsiv

```
┌─────────────┬──────────────────────────────┬──────────────┐
│  DayList    │  DayDetail                   │  ContextRail │
│  (w-80)     │  (flex-1, max-w-3xl)         │  (w-72)      │
│             │                              │  optional    │
│  Dager med  │  Header + Tabs + Actions     │  Handoff-kø  │
│  trafikklys │                              │  + siste     │
│             │                              │  aktivitet   │
└─────────────┴──────────────────────────────┴──────────────┘
```

- Venstre **DayList** er persistent. Høyre ContextRail kollapser på <1440px.
- Filter-toolbar over DayList: `Status` + `Avdeling` + `Datoperiode` + `Søk`.

#### DayList (venstre)
- Gruppert på uke. Ukeheader viser `Uke N · totalomsetning · labor %`.
- Hver rad: status-ikon · dato (kort) · avdeling · omsetning · badge med status-label.
- Status-ikon + label (ikke farge alene — WCAG):

| Status | Ikon | Label | Farge |
|---|---|---|---|
| `open` | `Circle` | Åpen | muted-foreground |
| `submitted` | `Clock` | Innsendt | amber-500 |
| `awaiting_approval` | `AlertCircle` | Venter | amber-500 |
| `approved` | `CheckCircle2` | Godkjent | emerald-500 |
| `locked` | `Lock` | Låst | muted-foreground |
| `unreconciled` | `AlertTriangle` | Ikke avstemt | destructive |

- Bulk-select: sjekkbokser som vises på hover, toolbar over med "Godkjenn valgte" (åpner F-13).

#### DayDetail (midt)
**Header:**
- H1: Ukedag + dato (Instrument Serif, stor).
- Undertittel: Avdeling · `status` badge · åpnet av / lukket av (tid).
- KPI-stripe (3 tall, ingen ramme): Omsetning · Timer · Labor %. Tall monospace.

**Preflight-banner:** én stack øverst som lister HVER blokker som hindrer approve:
- X blokkerende avvik må løses
- Y vakter venter på godkjenning
- Omsetning ikke registrert (hvis policy krever)
- Kontant ikke talt opp (hvis policy krever)
- Close-out prompt ikke gjennomført (hvis policy krever)
Klikk på hver blokker → hopper til riktig tab + scroll til item.

**Tabs:** `Oversikt` · `Omsetning` · `Vakter` · `Avvik` · `Oppgaver` · `Revisjonslogg`
- **Oversikt (ny):** samlet read-only sammendrag + timeline (åpnet, settling, OCR, godkjenninger).
- **Omsetning:** tall-grid + OCR-bilder (thumbnails, klikk for full). Manuell justering via F-04.
- **Vakter:** liste per ansatt med `planned | calculated | approved` timer, avvik-pills, action pr rad (Godkjenn / Editer / Handoff).
- **Avvik:** gruppert på `severity` (CRITICAL → HIGH → MEDIUM → LOW). Collapsible grupper. Per-item actions: Løs / Handoff / Eskaler.
- **Oppgaver:** liste fra close-out prompt + system-aggregert. Fullført/ikke-fullført med kommentar.
- **Revisjonslogg:** append-only fra activity_trail. Hvem gjorde hva når.

**Action-bar (sticky nederst):**
- Primær: `Godkjenn dagen` (disabled til preflight = clean).
- Sekundær: `Be om avklaring` (åpner F-09 med scope=day).
- Destruktiv: `Avvis` (åpner F-07).
- Etter approve: `Lås dag` (primær) erstatter Godkjenn.

#### ContextRail (høyre, kollapsibel)
- Kort 1: Handoffs i kø (lenker til W-05 filtrert på denne dagen).
- Kort 2: Siste 5 aktivitet-events.
- Kort 3: Budsjett-kontekst (dagens budsjett vs faktisk fra `workspace_budget` + `day_factor`).

---

### W-02 — Deeplink

Samme som W-01, men `reconciliation_id` løses fra `date + department_id`. Faller tilbake til listevisning med highlight hvis ikke funnet.

---

### W-03 — Yrkesavstemming (ny)

**Formål:** lukk en periode for én yrkesgruppe (f.eks. "servitør" for mars).

**Layout:** enkeltpanel med stepper øverst.

**Stepper:**
1. `Velg yrke + periode`
2. `Gjennomgå aggregater`
3. `Avvik`
4. `Bekreft & lukk`

**Steg 1:** dropdown for yrke (employment_category / tariff_level), datovelger for periode, avdeling (valgfri).
**Steg 2:** tabell + chart. Rader:
- Aktive ansatte i periode
- Timer jobbet (total)
- Sykefraværstimer
- Omsetning (hvis yrket er avdelings-koblet)
- Labor % (derivert)
- Over-/underforbruk vs forventning (fra `planning_factors`)

**Steg 3:** Uavstemte dager innenfor perioden (lenker til W-01). Godkjennes alle før yrkesavstemming kan lukkes.
**Steg 4:** Sammendrag + notat-felt. Primær: `Lukk perioden`. Konsekvens: trigger `occupational_reconciliation.closed` event. Optional: `Eksporter til lønn`.

---

### W-04 — Sesongavstemming (ny)

**Formål:** strategisk lukking av sesong, oppdatering av forventningsmodeller.

**Layout:** stepper (5 steg).

**Stepper:**
1. `Velg sesong` (fra `planning_cycle`)
2. `Budsjett vs faktisk` — tabell + avvik-chart
3. `Labor %` — utvikling over uker
4. `Avviksmønstre` — gruppert per kategori
5. `Lærdom` — fri notat + hvilke `planning_factors` skal oppdateres

**Spesielt:** Steg 5 har sub-form F-11 som tillater endring av `day_factor` / `hour_factor` / `season_budget` for neste sesong med samme mønster. Krever eksplisitt bekreftelse.

---

### W-05 — Handoff-innboks

**Formål:** samlet kø over alle pågående handoffs, på tvers av dager.

**Layout:** to-panel, samme mønster som W-01.
- Venstre: handoff-liste med filter (aktiv / venter på svar / eskalert / fullført).
- Høyre: handoff-detalj — AI-chat-logg + status + opprinnelig scope (hvilken vakt/avvik/dag).

**Per handoff:**
- Header: ansatt · scope · opprettet · frist · status.
- Transkript: chat-meldinger med avsender-pill (AI / ansatt / admin).
- Action-bar: `Godkjenn handoff` / `Avvis handoff` / `Eskaler til telefon` / `Avbryt`.

---

### W-06 — Policy-konfigurasjon

**Formål:** per-workspace innstillinger for hele avstemmingsdomenet.

**Layout:** settings-form (ADR-0114 Server Action) delt i seksjoner.

**Seksjoner:**
1. **Frister** — maks antall dager uavstemt innen rullerende periode.
2. **Toleranse** — kontantdiff: fast beløp eller %. Brukes til å auto-opprette deviation.
3. **Kontantkasse** — toggle `krever opptelling` + toleranse.
4. **Godkjenning** — toggle `krever admin-godkjenning`, frist i timer, auto-approve-regler.
5. **Close-out prompt** — toggle `obligatorisk`, hvem trigges (siste punch-out vs skiftleder).
6. **Handoff** — frist før eskalering til telefon, maks forsøk, quiet hours.
7. **Lås-policy** — `umiddelbart` / `etter N dager` / `etter lønnseksport`.
8. **Yrkesavstemming** — aktiv/inaktiv, trigger-frekvens (månedlig/manuelt), trigge lønneksport.

Data persisteres i `financial_close_config` (utvides med nye kolonner per seksjon).

---

### W-07 — Ansatt settler (innebygd i Schedule)

**Kontekst:** IKKE egen rute. Lever i `/dashboard/schedule` → klikk på dag → Day Control drawer → `Økonomi`-tab.

**Innhold:**
- Budget vs Actual (read-only fra `workspace_budget`).
- Hvis `status = open`: primær CTA `Registrer dagsoppgjør` (åpner F-01).
- Hvis `status = submitted`: amber banner "Venter på godkjenning" + skrive-lås.
- Hvis `status IN ('approved','locked')`: read-only summarized.

**NB:** Denne flaten finnes allerede (implementert i financial-esp). Redesign handler om å linke den visuelt til W-01 (samme kort-stil, samme statusgrammatikk).

---

## 5. Mobil-spec

### M-01 — Close-out prompt (siste punch-out)

**Trigger:** ansatt punch-out + policy sier `close_out_required` + ansatt er siste ut (eller skiftleder per policy).

**Flyt:** full-screen modal, kan ikke dismisses med back — bare med `Send inn` eller `Hopp over` (hvis policy tillater).

**Steg:**
1. Bekreft oppgaver (liste fra `session_task` for dagen, sjekk av fullført).
2. Kommenter hva som ikke ble gjort (per item, optional tekst).
3. Kommenter hvem som manglet leveranse (fri tekst).
4. Registrer hendelser (velg kategori: HMS / kunde / drift / materiell + fritekst + optional bilde).

**Postcondition:** skriver til `session_task.completed`, `deviation` (nye items med `source='close_out'`), emitter `close_out submitted`.

### M-02 — Dagsoppgjør

**Trigger:** fra schedule-dagen på mobil, samme RLS-gate som W-07.

**Felter:** samme som F-01 men optimalisert for touch — tastatur numerisk, store inputs, kamera-knapp for iSettle/Z-report.

### M-03 — Handoff-chat

**Trigger:** push notification + badge i app-shell.

**Layout:** native chat-UI. AI-melding = venstre, ansatt = høyre. Strukturert metadata vises som pills over hver AI-melding (f.eks. "Om vakt 14:00-22:00").

**Actions:** `Svar`, `Legg ved bilde`, `Be om hjelp` (trigger eskalering).

### M-04 — Mine avstemminger

Read-only liste for ansatt med filter: `Mine vakter berørt`. Klikk = detalj med hva ansatt har bidratt med (submit, svar, bekreftelser).

---

## 6. Form-spec

### F-01 — Settlement submit (`W-07 / M-02`)

**Zod-schema (kilde: `apps/web/src/app/dashboard/schedule/_forms/settlement.ts`):**
```ts
revenue_total: z.number().positive(),
revenue_card: z.number().nonnegative().optional(),
revenue_cash: z.number().nonnegative().optional(),
revenue_vat: z.number().nonnegative().optional(),
revenue_transactions: z.number().int().nonnegative().optional(),
cash_counted: z.number().nonnegative().optional(), // hvis policy krever
note: z.string().max(500).optional(),
```
**Validering:** `revenue_card + revenue_cash <= revenue_total` (hvis begge satt).
**Submit:** upsert `daily_reconciliation` (status `open → submitted`), `revenue_source='manual'`, `settled_by = profileId`, `settled_at = now()`.
**Emit:** `reconciliation submitted`.
**Primær CTA:** `Send inn`. Sekundær: `Lagre utkast` (beholder status=open, persisterer felter).

---

### F-02 — Close-out prompt (`M-01`)

Strukturert som wizard (se §5.M-01). Schema:
```ts
tasks: z.array(z.object({
  session_task_id: z.string().uuid(),
  completed: z.boolean(),
  comment: z.string().max(200).optional(),
})),
missing_delivery: z.string().max(500).optional(),
incidents: z.array(z.object({
  category: z.enum(['hms','customer','ops','material']),
  description: z.string().min(3).max(1000),
  photo_path: z.string().optional(),
})).optional(),
```
**Emit:** `close_out submitted`. Skriver til `session_task` og `deviation`.

---

### F-03 — Shift hours edit (modal, `W-01` Vakter-tab)

**Felter:**
- `approved_hours` (number, 0.25 steg)
- `edit_justification` (required hvis approved_hours ≠ calculated_hours)
- `mark_disputed` (bool, default false)

**Submit:** `useApproveShiftHours` hook (finnes). Status blir `approved` eller `edited` (har justification) eller `disputed`.

---

### F-04 — Revenue manual adjust (modal, `W-01` Omsetning-tab)

**Felter:** samme som F-01 + `adjustment_reason` (required).
**Submit:** UPDATE `daily_reconciliation` + insert `settlement_validation` rad med `diff` og `reason`.
**Gate:** bare hvis `status IN ('submitted','awaiting_approval')`. Låst etter approve med mindre policy tillater.

---

### F-05 — Deviation resolve (modal, `W-01` Avvik-tab)

**Felter:** `resolution_notes` (required, min 10 tegn), `cost_impact` (optional number).
**Submit:** `useResolveDeviation` hook (finnes). Status `open → resolved`.

---

### F-06 — Day approve (inline, action-bar)

**Felter:** `approval_notes` (optional).
**Submit:** `useApproveReconciliation` hook (finnes). Krever at preflight er clean.
**Effekt:** KPI-beregning + engine-event `reconciliation.approved`.

---

### F-07 — Day reject (inline expandable)

**Felter:** `reason` (required, min 10 tegn).
**Submit:** `useRejectReconciliation` hook (finnes). Status `approved → open` (eller `submitted → open`).
**Effekt:** engine-event `reconciliation.admin_action` + push notification til `settled_by`.

---

### F-08 — Day lock (inline confirm)

**Felter:** ingen — bare bekreftelse med fullt advarsels-språk.
**Submit:** sett `locked_at`, `locked_by`, status `approved → locked`.
**Gate:** kun hvis status=`approved`. Policy kan auto-trigge dette.

---

### F-09 — Request handoff (modal)

**Felter:**
- `scope` (enum: `day` | `shift` | `deviation`)
- `scope_id` (conditional på scope)
- `channel_hint` (`chat` | `voice`) — default `chat`, ADR-0078 håndhever regelen
- `question_context` (optional tekst — sendes til AI som seed)
- `deadline` (timer — default fra policy)

**Submit:** oppretter `handoff` rad, fyrer `handoff.requested` engine-event som kjører AI-dialog-prosessen.
**Emit:** `handoff requested`.

---

### F-10 — Occupational period close (wizard, `W-03`)

Stegene er beskrevet i §4.W-03. Submit på steg 4:
- Validerer at alle dager innenfor periode har status `approved` eller `locked`.
- Skriver til ny tabell `occupational_reconciliation` (design mangler, må seedes).
- Trigger lønneksport (optional, via `export_payroll` toggle).

---

### F-11 — Season period close (wizard, `W-04`)

Steg 5 har sub-form for `planning_factors` oppdatering. Hver faktor-endring krever `reason` + `confidence` (low/medium/high). Skrives til `planning_factors` med `source='season_reconciliation'`.

---

### F-12 — Policy config (`W-06`)

Én Server Action per seksjon (ikke én diger action). Valideres med Zod. Upsert mot `financial_close_config`. Visuell indikator "Lagret" per seksjon (spring-animert check).

---

### F-13 — Bulk approve (modal, `W-01` list toolbar)

**Felter:** liste over valgte dager (viser hvilke som er klare / blokkert). Check-knapp per dag.
**Gate:** kun dager med clean preflight er merkbare.
**Submit:** kjører `useApproveReconciliation` i sekvens med rate limit (1/sec). Progress-bar. Ved feil på én dag: stopp eller fortsett (bruker velger).
**Emit:** én `reconciliation admin_action` per dag + én oppsummerings-event `reconciliation bulk_approved`.

---

## 7. Tilstandsmaskin

```
                    ┌─ (employee submits F-01) ────────────┐
                    │                                      ▼
 open ──────────── submitted ──── (OCR done) ─── awaiting_approval
   ▲                │                                 │
   │ reject         │ timeout                         │ reject (F-07)
   │                ▼                                 │
   └──────────── unreconciled                         │
                                                      │
                                 (admin approves F-06)▼
                                              approved
                                                 │
                                    (F-08 or policy-auto)
                                                 ▼
                                              locked
```

**Invariants:**
- Kan IKKE gå tilbake fra `locked`.
- `approved → open` (reject) tillatt i policyvindu, ellers krever ny ADR.
- `unreconciled` er terminal for policy-telling, men kan fortsatt approves (med audit-flag).

---

## 8. Komponent-tillegg i `packages/ui` / `apps/web/src/components`

| Komponent | Plass | Formål |
|---|---|---|
| `StatusPill` | `packages/ui/src/status-pill.tsx` | Ikon + label + farge for alle status. Gjenbruk i DayList, header, activity-log. |
| `PreflightBanner` | `apps/web/src/components/reconciliation/PreflightBanner.tsx` | Liste av blokkere med klikk-til-fiks. |
| `KPIStrip` | `apps/web/src/components/reconciliation/KPIStrip.tsx` | 3-tall rekke, `font-mono tabular-nums`. |
| `DayApprovalLayout` | `apps/web/src/components/reconciliation/DayApprovalLayout.tsx` | Tre-kolonne grid med responsiv kollaps. |
| `TimelineList` | `packages/ui/src/timeline-list.tsx` | Revisjonslogg-visning. |
| `SettlementForm` | `packages/schedule/src/forms/SettlementForm.tsx` | Delt mellom W-07 og M-02 (ADR-0133 parity). |
| `HandoffChat` | `packages/ai/src/components/HandoffChat.tsx` | Gjenbruk mellom W-05 og M-03. |

Bruk `NordicSkeleton` (eksisterer) for alle loading states. Ingen nye spinners.

---

## 9. Datakontrakter som må fullføres

1. **`occupational_reconciliation`** tabell — ny. Felter: `workspace_id`, `tariff_level_id`, `period_start`, `period_end`, `status`, `aggregates JSONB`, godkjennings-felter.
2. **`season_reconciliation`** tabell — ny. Kopler til `planning_cycle`.
3. **`handoff`** tabell — ny. Felter: `reconciliation_id NULLABLE`, `shift_id NULLABLE`, `deviation_id NULLABLE`, `scope`, `assignee_profile_id`, `status`, `transcript JSONB`, `deadline_at`, `escalated_at`.
4. **`financial_close_config`** — utvid med `close_out_required`, `close_out_trigger` (`last_out` | `shift_leader`), `handoff_deadline_hours`, `handoff_max_attempts`, `lock_policy`, `occupational_enabled`.
5. **RLS:** full policy-suite for alle tre nye tabeller (jwt_read, jwt_manage admin-only, service_role).

Alle migrasjoner via `supabase/migrations/YYYYMMDDHHMMSS_*.sql` per CLAUDE.md.

---

## 10. Telemetri-events (registry-endringer)

Legg til i `packages/telemetry/src/registry.ts`:

| Event | Entity | Routes |
|---|---|---|
| `close_out submitted` | `department_session` | activity_trail + engine_event |
| `handoff requested` | `handoff` | activity_trail + engine_event + PostHog |
| `handoff responded` | `handoff` | activity_trail + engine_event |
| `handoff escalated` | `handoff` | activity_trail + engine_event + PostHog |
| `handoff resolved` | `handoff` | activity_trail + engine_event |
| `reconciliation bulk_approved` | `daily_reconciliation` | PostHog + activity_trail |
| `occupational_reconciliation closed` | `occupational_reconciliation` | activity_trail + engine_event + PostHog |
| `season_reconciliation closed` | `season_reconciliation` | activity_trail + engine_event + PostHog |
| `reconciliation policy_updated` | `financial_close_config` | activity_trail |

---

## 11. Varslinger

| Trigger | Kanal | Mottaker |
|---|---|---|
| `reconciliation.submitted` | in-app + email (digest) | admin-gruppe |
| Dag går til `unreconciled` | in-app + email | owner |
| `handoff.requested` | push + in-app | ansatt |
| `handoff.escalated` | voice call | ansatt |
| Policy-frist nærmer seg | email digest | admin-gruppe |
| `reconciliation.approved` | in-app | ansatt som settlet |

Alle varsler skal ha "stop"-link som kobler til `notification_preference`.

---

## 12. Tilgjengelighet

- Ingen informasjon kun via farge (ikon + label overalt).
- Minimum tap-target 44×44 på mobil.
- Tabell-navigasjon: piltaster + Enter for å åpne dag.
- Focus-ring synlig (`focus-visible:ring-2 ring-ring ring-offset-2`).
- `aria-live="polite"` for preflight-banneren når blokkere endrer seg.

---

## 13. Performance

- DayList: `React.cache()` på workspace-list-query. Invalidering ved `reconciliation *` events.
- DayDetail: prefetch på hover i DayList (TanStack `prefetchQuery`).
- OCR-bilder: Supabase Storage signed URLs cached 1t.
- Bulk approve: limit 20 per batch, rate-limit server-side.
- Tabs: `loading.tsx` per tab-content via `next/dynamic` hvis content er tungt (Vakter kan ha mange rader).

---

## 14. Akseptansekriterier (for hele redesignet)

1. Alle farger er CSS-variabler. Grep på `bg-white`, `bg-zinc-`, `text-zinc-`, `border-zinc-` i `reconciliation/` returnerer 0.
2. Hver side har `loading.tsx` + `error.tsx` + tom-tilstand.
3. Hver mutasjon har `emit()` i `onSuccess`.
4. Hver form validerer med Zod før submit.
5. Mobile M-01, M-02, M-03 er byggbare mot samme hooks som web.
6. Preflight-banner viser ALLE blokkere, ikke kun første.
7. Bulk approve kjører atomisk per dag (transaksjonell) — en feil midt i batch ruller ikke tilbake allerede godkjente dager.
8. E2E spec (`apps/e2e/reconciliation/`) dekker: submit, approve, reject, lock, handoff-request, bulk-approve.
9. Nordic Split styleguide-sjekk: `font-heading` kun på H1/H2/H3, `font-mono tabular-nums` på alle KPI-tall.
10. ADR-0134 telemetri-kontrakt: hver mutasjon har non-empty `workspace_id` og `actor_id` før `emit()`.

---

## 15. Implementasjonsfaser

**Fase A — Redesign eksisterende flate (W-01, W-07, F-01, F-03, F-04, F-05, F-06, F-07, F-08)**
Ingen nye tabeller. Renser farger, innfører ny layout, preflight-banner, KPI-stripe. ~2 ukers arbeid.

**Fase B — Handoff-motor (W-05, M-03, F-09)**
Ny tabell `handoff`, engine-process `handoff_dialog`, AI-kapabilitet. ~3 ukers arbeid. Avhenger av Fase A.

**Fase C — Policy-config (W-06, F-12)**
Utvide `financial_close_config`, Server Actions. ~1 uke. Kan kjøre parallelt med Fase B.

**Fase D — Yrkesavstemming (W-03, F-10)**
Ny tabell, wizard. ~2 ukers arbeid.

**Fase E — Sesongavstemming (W-04, F-11)**
Ny tabell, integrasjon med `planning_factors`. ~3 ukers arbeid.

**Fase F — Close-out prompt på mobil (M-01, F-02)**
Mobil-wizard + punch-out trigger. ~2 ukers arbeid.

---

## 16. Åpne spørsmål (må besvares før kodestart)

PRD-03 §10 + nye:

1. "Første/siste" ansatt — punch vs plan vs skiftleder? (påvirker M-01 trigger)
2. Close-out prompt obligatorisk eller skippable? (påvirker F-02)
3. Kan admin overstyre omsetning etter approve? (påvirker F-04 gate)
4. Workspace-nivå avstemming, eller alltid per-avdeling? (påvirker hele W-01)
5. Yrkesavstemming trigge lønnseksport? (påvirker F-10)
6. Konfigurerbare handoff-frister per workspace? (antatt ja, reflektert i F-12)
7. Skal `disputed`-shifts blokkere day-approve? (foreslått: ja, til løst)
8. Bulk-approve — atomisk per dag eller per batch? (foreslått: per dag)
9. Hvem eier policy-endringer (F-12)? Owner-only eller admin? (foreslått: owner for Frister+Lås, admin for Toleranse+Deadline)
10. Skal sesongavstemming auto-oppdatere `planning_factors` eller bare foreslå? (foreslått: foreslå, admin bekrefter)

---

## 17. Kildereferanser

- `docs/architecture/PRD-03_Avstemmingssystem.md` — kanonisk funksjonell PRD
- `docs/journeys/JOURNEY-financial-esp.md` — eksisterende user journeys
- `docs/handoffs/HANDOFF-financial-esp-ux.md` — siste UX-wiring-runde
- `supabase/migrations/20260304200100_daily_reconciliation.sql` — kjernetabeller
- `supabase/migrations/20260328120000_financial_close_extensions.sql` — cash/OCR/on-shift
- `apps/web/src/app/dashboard/reconciliation/` — eksisterende kode
- `docs/design/ren-og-varm-styleguide.html` — Nordic Split-referanse
- ADR-0113, ADR-0114, ADR-0115 — arkitekturpatterns denne speccen bygger på
- ADR-0132, ADR-0133, ADR-0134 — mobil-kontrakt

---

## Changelog

| Dato | Endring | Forfatter |
|---|---|---|
| 2026-04-19 | Initial draft | Pontus + Claude |
