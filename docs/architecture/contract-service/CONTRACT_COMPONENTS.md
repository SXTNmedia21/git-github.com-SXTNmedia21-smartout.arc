---
title: Contract Module — Component Inventory
status: draft
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [contract, components, payroll, tripletex, paragraf-14-6, ux]
---

# Contract Module — Component Inventory

Komplett liste over sider, komponenter og UI-elementer som må fungere for at kontraktmodulen skal kunne brukes ende-til-ende. Strukturert per side → seksjon → komponent → state. Dette er **kontraktmodulens definition of done** for Fase 0+1.

Status-koder per komponent:
- 🟢 finnes og fungerer
- 🟡 finnes men trenger fix/redesign
- 🔴 mangler — må bygges
- ⚫ deferred (senere fase)

---

## 1. Sider (routes)

> **Trelags arkitektur (shipped 2026-04-29):** Compose-hub / Settings-author / Platform-admin deep-edit.
> Se §2, §2A, §2B for detaljer per lag.

| Path | Rolle | Formål | Status |
|------|-------|--------|--------|
| `/dashboard/contracts` | admin | Hub: list contracts + 2-stage compose drawer | 🟢 |
| `/dashboard/contracts/[id]` | admin | Enkelt-kontrakt, full visning + revise | 🟡 mangler obligations |
| `/dashboard/contracts/[id]/revise` | admin | Amendment-flow (endring + re-sign) | 🟡 sjekk vs ADR-0024 |
| `/dashboard/contracts/new` | admin | Redirect → drawer-flow | 🟢 |
| `/dashboard/people/[id]` | admin | Per-ansatt: ansettelse + lønnsprofil + obligations | 🟡 mangler 3 seksjoner |
| `/dashboard/my-contract` | ansatt | Min kontrakt, mine forpliktelser, lønnsregler | 🟡 redesign |
| `/dashboard/my-salary` | ansatt | Lønnsslipp + lønnsregler synlig | 🟡 koble til pay_rule |
| `/dashboard/settings#contract-templates` | admin | Workspace template authoring (Maler-tab) | 🟢 |
| `/platform-admin/contracts/templates/[id]/edit` | platform-admin | Deep-edit template content (tiptap) | 🟢 |

> **Fjernet:** `/dashboard/contracts/maler/[id]` og `/dashboard/contracts/maler/ny` ble aldri
> bygget som egne ruter. Maler-authoring er splittet til settings-surface (§2A) og
> platform-admin (§2B). Se §7 for deprecated planholder.

---

## 2. `/dashboard/contracts` — Hub

> **Shipped reality:** Kun KontrakterTab vises her. Maler og Bindinger er IKKE lenger tabs på huben.
> Maler-authoring lever i `/dashboard/settings#contract-templates` (§2A).
> Bindinger er foreløpig ikke bygget som separat side.

### 2.1 Header
- 🟢 Page title (font-heading H1)
- 🟢 Subtitle / description
- 🟢 Primary CTA "Lag kontrakt" → åpner 2-steg drawer
- 🔴 Ambient orb decoration (stubs finnes men ikke mountet)

### 2.2 PageTabNav (Ansatte-modul nav)

Øverst på siden renders en `PageTabNav` med Ansatte-modul-navigasjonen (Oversikt / Ansatte / Kontrakter). Denne er IKKE kontrakt-interne tabs — det er module-level routing mellom people-seksjonene.

- 🟢 `PageTabNav` component mountet
- 🟢 Tabs definert via `PEOPLE_TAB_DEFS` (`@/app/dashboard/_lib/people-tabs`)
- 🟢 Active-state synced til `pathname`
- 🟢 `onChange` → `router.push(href)`

### 2.3 KontrakterTab
- 🟢 Data table med kontrakt-rader
- 🟢 Status-badges (utkast/sendt/signert/avvist/utløpt)
- 🟢 Filter: status / employee / department
- 🟢 Sort: created_at / start_date / status
- 🟡 Row-click → detail-sheet (fungerer men minimal)
- ⚫ Inline obligations-progress per rad (3/5 fullført) — DEFERRED-NEXT-PASS
- ⚫ Bulk-actions: send påminnelse / arkivér — DEFERRED-NEXT-PASS

### 2.4 BotssonAmbientChip
- 🟢 Pinned bottom-right via `<BotssonAmbientChip scope="kontrakter">`
- 🟡 Voice fungerer ikke (ADR-0135 venter)

### 2.5 EmployeePickerDrawer + ContractDispatchDrawer (2-steg compose)

Shipped som to separate komponenter. Steg 1 (EmployeePickerDrawer) viser ansatt-liste; ved valg mountes Steg 2 (ContractDispatchDrawer) med valgt profil. Flyten er hub-inline — ingen navigasjon til /people/[id].

#### 2.5.1 Steg 1: EmployeePickerDrawer
- 🟢 Åpnes av "Lag kontrakt" CTA + `?open=compose` deep-link
- 🟢 Ansatt-liste med søk + valg
- 🟢 `onPick` → setter `pickedProfile` → trigger steg 2
- 🟢 Close → rydder `?open` + `?profileId` fra URL
- 🟢 Guard: drawer mountes ikke uten `workspaceId` + `profileId` (no blank context)

#### 2.5.2 Steg 2: ContractDispatchDrawer
- 🟢 Mountes kun når `pickedProfile !== null`
- 🟡 Innhold: mal-velger + send-flow (detaljer i ContractDispatchDrawer-komponent)
- 🟢 `onSuccess` + `onOpenChange` rydder begge drawers + URL
- 🔴 Manglende-PII-detector (personnr/bank → blokkere)
- 🔴 Acknowledgement-ring (4-block-pattern)

#### 2.5.3 URL + telemetri
- 🟢 `?open=compose` deep-linkable
- 🟢 `contracts.compose.opened` emitted på CTA-klikk
- 🟢 `contract.hub_viewed` emitted på mount (workspace_id + actor_id guard)

---

## 2A. `/dashboard/settings#contract-templates` — Maler-tab (workspace author)

Settings-flaten der workspace-admin oppretter og vedlikeholder egne kontraktsmaler, basert på K1a-systembiblioteket. MalerTab-komponenten er lazy-lastet fra `apps/web/src/app/dashboard/contracts/_components/MalerTab.tsx` og mountet via `ContractTemplatesPanel` i `settings-tabs.tsx`.

### 2A.1 Header (settings-page)
- 🟢 Settings-sidehode (standard settings-layout, ikke kontrakt-spesifikk)
- 🟢 Sidebar-nav med "Organization"-seksjon synlig

### 2A.2 Sidebar-nav — organization > Kontraktsmaler
- 🟢 Seksjonen "organization" finnes i `SECTIONS`-array
- 🟢 Tab `id: "contract-templates"` med `FileSignature`-ikon
- 🟢 Labelkey: `settings_page.tabs.contract_templates`

### 2A.3 Hash deep-link
- 🟢 `window.location.hash` leses på mount — `#contract-templates` → aktiverer fanen
- 🟢 `handleTabChange` setter `window.location.hash` ved navigasjon
- 🟢 Ekstern deep-link (f.eks. fra Kontrakter-hub) fungerer via hash

### 2A.4 Venstre sone — workspace templates liste
- 🟢 Liste over workspace-scoped maler (filtrert: `workspace_id !== null`)
- 🟢 Lineage-subtitle per rad (`Basert på K1a: <source> v<version>` eller `Egendefinert`)
- 🟢 Amber drift-dot per rad (klikk → DriftDiffDrawer)
- 🟢 Tom-tilstand (EmptyStateCatalog) med CTA "Ny fra systemmal"
- 🟢 Footer-knapp "Ny fra systemmal" → åpner SystemTemplatePicker
- 🟡 "Ny fra bunnen"-knapp: finnes men er `disabled` — venter på copy-route uten source (P1 TODO)

### 2A.5 SystemTemplatePicker-dialog (K1a clone)
- 🟢 Dialog-komponent (`<SystemTemplatePicker>`) med K1a-templater
- 🟢 Klikk → kaller `/api/contract-templates/copy` (POST) → patcher lokal state
- 🟢 Telemetri: `contracts.template.cloned` emitted på success
- 🟢 Loading-state per rad (`cloningId`)

### 2A.6 TemplatePreviewPane (sticky header + read-only)
- 🟢 Sticky header: mal-navn, framework-badge, read-only-badge (Lock-ikon)
- 🟢 Lineage-badge (GitFork) → klikk åpner DriftDiffDrawer
- 🟢 Drift-chip (amber) — vises kun ved drift; klikk → DriftDiffDrawer
- 🟢 Toolbar: "Copy HTML" (clipboard state machine idle → copying → done 2s → idle)
- 🟢 Toolbar: "Open in admin" link → `/platform-admin/templates/${tpl.template_id}` (**NB: stale href — se §2B**)
- 🟢 ContractPreviewEditor (Tiptap, deliberate read-only / `editable=false`)
- 🟢 Footer: forklaringstekst om read-only posture
- 🟢 Telemetri: `contracts.template.viewed` emitted på mount

### 2A.7 Publish toggle + BulkSendDrawer
- 🟡 Publish toggle: `published_at` / `deprecated_at` gates "Send til ansatte"-knapp — men selve toggle-UI (for å sette `published_at`) mangler
- 🟢 BulkSendDrawer: mountet og fungerer når `canBulkSend` (published + not deprecated)
- 🟢 "Send til ansatte…"-knapp i sticky header trigger BulkSendDrawer

### 2A.8 Inline-rename (GAP — under arbeid)
- 🔴 Mal-navn kan ikke redigeres inline fra denne flaten. Stubs for rename mangler.

### 2A.9 Mal-arv-teller (GAP — under arbeid)
- 🔴 Antall kontrakter som bruker malen vises ikke (Mal-arv count). Mangler query + UI.

### 2A.10 DriftDiffDrawer
- 🟢 Eksisterer og fungerer
- 🟢 Lazy-fetcher `content_html` for begge sider (workspace + K1a) parallelt
- 🟢 Read-only side-by-side diff, ingen accept/reject

---

## 2B. `/platform-admin/contracts/templates/[id]/edit` — Deep-edit (platform-admin)

> **Viktig:** MalerTab's "Open in admin"-lenke peker til `/platform-admin/templates/${tpl.template_id}` (stale href) — den **faktiske** ruten er `/platform-admin/contracts/templates/[id]/edit`. Lenken er brutt i produksjon. Bør fikses i MalerTab.tsx linje 919.

Den reelle ruten finnes og er operativ under platform-admin-seksjonen. Platformen eier K1a-mallene; workspace-admins har kun read-only + fork-tilgang (§2A).

- 🟢 `/platform-admin/contracts/templates` — oversiktsside (liste + ny mal-CTA)
- 🟢 `/platform-admin/contracts/templates/[id]/edit` — full Tiptap-editor, save-action, upload-action, delete-attachment-action
- 🟢 Tilgangsgard: `getSuperAdminId()` → redirect `/dashboard` hvis ikke platform-admin
- 🔴 Default obligations editor (mal-level obligations til arv) — ikke bygget
- 🔴 Default pay_rules editor per mal — ikke bygget
- 🔴 Deprecation-flow UI (`deprecated_at`) — ikke bygget
- 🔴 Migration-tilbud til workspace-kontrakter på utgått versjon — ikke bygget

---

## 3. `/dashboard/contracts/[id]` — Detail

### 3.1 Header
- 🟢 Kontrakt-tittel
- 🟢 Status-badge
- 🟢 Profile-link (→ people/[id])
- 🔴 Quick-actions: Forny / Si opp / Last ned PDF / Send påminnelse

### 3.2 Sections
- 🟢 Identitet (workspace + ansatt)
- 🟡 Ansettelse (felt finnes, mangler 5 §14-6)
- 🔴 Lønnsregler (`contract_pay_rule`-liste)
- 🔴 Tipsregel (hvis sat opp)
- 🔴 Forpliktelser (`contract_obligation`-liste, status per)
- 🟢 Compliance-validations (warnings/blockers)
- 🟢 Mandatory clauses (collapsible)
- 🟢 Framework snapshot (Riksavtalen versjon)
- 🟡 Document-preview (tiptap)
- 🟢 Signature-status + signed_at
- 🔴 Amendment-history

### 3.3 Action panel
- 🟢 Resend signing-link
- 🟡 Cancel (DestructiveConfirmDialog)
- 🔴 Initiate amendment

---

## 4. `/dashboard/people/[id]` — Per-ansatt admin

### 4.1 Eksisterende tabs (6)
- 🟢 Overview
- 🟢 Schedule
- 🟢 Competence
- 🟢 Activity
- 🟡 HR & Logs (refaktoreres — splittes i 3)
- 🟢 Settings

### 4.2 NYE seksjoner i HR-tab (eller egen tab)

#### 4.2.1 Personlig info (eksisterer)
- 🟢 Adresse, personnr, bankkonto
- 🟢 Pårørende
- 🟢 Edit-mode in-place

#### 4.2.2 Ansettelse (NY) — §14-6-felt
- 🔴 Stillingstittel [input]
- 🔴 Avdeling [dropdown — finnes på Settings, flyttes hit]
- 🔴 Ansettelsesform (`employment_form`) [enum: permanent/temporary/apprentice/practice/freelance]
- 🔴 Ansettelseskategori (`employment_category`) [fast/deltid/tilkalling]
- 🔴 Stillingsprosent [slider 10-100%]
- 🔴 Ukentlig arbeidstid [input timer]
- 🔴 Arbeidstidsordning (`working_hours_scheme`) [enum]
- 🔴 Yrkeskode (STYRK-08) [autocomplete]
- 🔴 Startdato [date]
- 🔴 Sluttdato [date, kun temporary]
- 🔴 Prøvetid [input mnd]
- 🔴 Oppsigelsesfrist [input mnd]
- 🔴 Pauser (`break_minutes_per_day`) [input min]
- 🔴 Variabel arbeidstid [textarea, valgfri]
- 🔴 Rett til opplæring [textarea, valgfri]
- 🔴 Edit-mode (toggle, save → `employment_contract` upsert)
- 🔴 Empty-state hvis ingen kontrakt

#### 4.2.3 Lønnsprofil (NY) — Tripletex-aligned
- 🔴 Lønnstype (`remuneration_type`) [monthlyWage/hourlyWage/commissionOnly]
- 🔴 Timelønn [input + NOK]
- 🔴 Månedslønn [input + NOK, kun monthlyWage]
- 🔴 Lønningsdag (`payday_regular`) [input 1-31]
- 🔴 Skatt-subseksjon
  - 🔴 Skattetabell (`tax_table_number`) [input]
  - 🔴 Skattekort-type (`tax_card_type`) [enum: percentage/table/freecard]
  - 🔴 Trekk-% (`tax_percentage`) [input, kun percentage]
- 🔴 Feriepenger
  - 🔴 Sats (`holiday_allowance_pct`) [12.00 / 14.30]
  - 🔴 6. ferieuke (`extra_holiday_week`) [checkbox]
- 🔴 Pensjon
  - 🔴 Ordning (`pension_scheme_id`) [dropdown company schemes]
- 🔴 Fagforening
  - 🔴 Medlem (`trade_union_member`) [checkbox]
  - 🔴 Trekk (`trade_union_fee_amount`) [input]
- 🔴 Tariff
  - 🟢 Riksavtalen-versjon [readonly fra workspace_framework_binding]
  - 🔴 Lokale avvik [link til contract_pay_rule editor]
- 🔴 Tripletex-mapping (admin-only)
  - 🔴 Employee number (`employee_number`)
  - 🔴 Tripletex ID (`tripletex_employee_id`)

#### 4.2.4 Lønnsregler (NY) — `contract_pay_rule`
- 🔴 Liste over regler per shift-betingelse
- 🔴 Add-rule-knapp → modal eller inline-form
- 🔴 Hver rad:
  - rule_type (base/overtime/supplement/tip/commission)
  - salary_type_code (Tripletex-enum)
  - trigger_condition (tidsrom, dagtype)
  - rate (% av base eller fast kr/t)
  - source (Riksavtalen §X eller "lokal")
- 🔴 Edit/delete per rad
- 🔴 Effective_from / effective_until-håndtering

#### 4.2.5 Tipsregel (NY) — `contract_tip_rule`
- 🔴 Fordelingsmetode [enum: per_shift_hours/per_position/fixed_percentage/pool]
- 🔴 Deltakelse [enum: full/half/none]
- 🔴 Skattepliktig [checkbox, default true]
- 🔴 Pool-tilknytning [hvis pool: dropdown]
- 🔴 Edit-modal

#### 4.2.6 Forpliktelser (NY) — `contract_obligation`
- 🔴 Gruppert per type (training/cert/activity/attendance)
- 🔴 Per rad: navn, frist, status, blocker-flag
- 🔴 Status-progress (X/Y fullført)
- 🔴 Action-knapp per rad: "Tildel" / "Marker fullført" / "Vis protokoll"
- 🔴 Add-from-template-knapp (arv fra rolle/mal)
- 🔴 Empty-state med suggestion fra role_capability

#### 4.2.7 Kontrakt-status (NY) — én-linje øverst i HR-tab
- 🔴 Status (ingen/utkast/sendt/signert/utløpt)
- 🔴 Signed_at (hvis signert)
- 🔴 [Send kontrakt]-knapp (åpner forenklet drawer)
- 🔴 [Endre]-knapp (åpner amendment-flow)
- 🔴 [Last ned PDF]-knapp (hvis signert)

---

## 5. `/dashboard/my-contract` — Ansatt-vise

### 5.1 Sections
- 🔴 Stillingen min (status, prosent, avdeling)
- 🔴 Lønn (timelønn + tillegg synlig per regel)
- 🔴 Lønningsdag
- 🔴 Forpliktelser (3/5 fullført, klikkbar per rad → start protokoll)
- 🔴 Tariff-link (Riksavtalen-readability)
- 🔴 [Last ned PDF-kontrakt]
- ⚫ Amendment-tilbud (Fase 4)

### 5.2 Kobling
- 🔴 Hver forpliktelse → /dashboard/competence/protocol/[id]
- 🔴 Tariff-link → ekstern Arbeidstilsynet eller intern Riksavtalen-dokument

---

## 6. `/dashboard/my-salary` — Ansatt-lønnsslipp

### 6.1 Sections
- 🟢 Liste over lønnsslipper
- 🟡 Per måned: total + breakdown
- 🔴 Hver shift-rad linket til `shift_cost_snapshot`
- 🔴 Hver rad viser anvendt `contract_pay_rule` (transparency)
- 🔴 Tipsdistribusjon (`contract_tip_rule` resultat)
- 🔴 Skattetrekk-breakdown
- 🔴 Feriepenger-akkumulering

---

## 7. Mal-editor (deprecated location)

> **Avviklet plan.** Den opprinnelig planlagte ruten `/dashboard/contracts/maler/[id]` og `/dashboard/contracts/maler/ny` ble ikke bygget. Maler-authoring er splittet i trelags-arkitektur (shipped 2026-04-29):
>
> - Workspace-admin leser/fork'er maler via **§2A** (`/dashboard/settings#contract-templates`)
> - Platform-admin deep-editor lever i **§2B** (`/platform-admin/contracts/templates/[id]/edit`)
>
> Tidligere planlagte items fra dette avsnittet er relocert:

### 7.1 Items relocert til §2A (settings MalerTab)
- Tiptap DriftDiffDrawer → 🟢 finnes og fungerer (§2A.10)
- Inline rename → 🔴 GAP (§2A.8)
- Mal-arv-teller → 🔴 GAP (§2A.9)
- [Klon]-knapp → dekket av SystemTemplatePicker (§2A.5)

### 7.2 Items relocert til §2B (platform-admin deep-edit)
- Tiptap-editor med placeholder-system → 🟢 finnes i `/platform-admin/contracts/templates/[id]/edit`
- Mal-default obligations editor → 🔴 mangler (§2B)
- Default pay_rules editor → 🔴 mangler (§2B)
- Deprecation-flow (deprecated_at) → 🔴 mangler (§2B)
- Migration-tilbud til kontrakter på utgått versjon → 🔴 mangler (§2B)

---

## 8. `/dashboard/contracts/maler/ny` — Ny mal (avviklet plan)

> **Avviklet.** Denne ruten ble aldri bygget og er ikke planlagt. Ny-mal-flyten er løst via:
>
> - K1a-fork: `SystemTemplatePicker` i §2A.5 (klon fra systembibliotek)
> - Platform-admin: `/platform-admin/contracts/templates/new/edit` (ny blank mal)
>
> Alle items nedenfor er **relocated** eller **deferred**:
>
> - Mal-navn input → dekket av SystemTemplatePicker-dialog (navn auto-satt som `<kilde> (kopi)`)
> - Tiptap-editor → 🔴 "Ny fra bunnen" deferred (§2A.4 — knapp disabled, P1 TODO)
> - Default obligations-velger → 🔴 deferred til §2B

---

## 9. Drawer / Sheet-komponenter

### 9.1 EmployeePickerDrawer + ContractDispatchDrawer (shipped 2-steg)
- Status: 🟢 to separate komponenter mountet på hub
- Se seksjon 2.5 for detaljer
- Den gamle 5-stegs CompositionDrawer er **retired fra hub** — beholdes i kodebasen kun for reverse flow

### 9.2 BulkSendDrawer
- 🟢 Eksisterer (post-fix etter `relative`-bug)
- 🟡 Mangler integrering med ny mal-flyt

### 9.3 ContractSendDrawer (legacy)
- 🟡 Vurdering: erstatte med CompositionDrawer eller beholde
- Anbefaling: erstatte ved Fase 0c

### 9.4 DriftDiffDrawer
- 🟢 Eksisterer

### 9.5 ReasoningDrawer
- 🟢 Eksisterer (forklarer cascade-decisions)
- ⚫ Trenger ikke endring nå (cascade-deriv flyttes til lønnsprofil-form)

### 9.6 EntityDrawer (kontrakt-row click)
- 🟢 Eksisterer som generisk
- 🟡 Trenger contract-specific tab-content

---

## 10. Form-komponenter (gjenbrukbare)

### 10.1 EmploymentFormFields (NY)
- 🔴 Ansettelsesform-radio
- 🔴 Stillingsprosent-slider
- 🔴 Dato-paret (start/end)
- 🔴 Working-hours-scheme-enum

### 10.2 PayrollProfileForm (NY)
- 🔴 Skatt-subform
- 🔴 Feriepenger-subform
- 🔴 Pensjon-dropdown
- 🔴 Fagforening-subform

### 10.3 PayRuleEditor (NY)
- 🔴 Modal/inline form for én pay_rule
- 🔴 Trigger-condition builder (UI for tidsrom/dagtype/dato)
- 🔴 Rate-type-velger
- 🔴 Source-link (Riksavtalen § eller lokal)

### 10.4 TipRuleEditor (NY)
- 🔴 Distribution-method-velger
- 🔴 Participation-radio
- 🔴 Pool-management

### 10.5 ObligationEditor (NY)
- 🔴 Type-velger
- 🔴 Policy/protocol-picker
- 🔴 Frist-input
- 🔴 Blocker-flag

---

## 11. Data-komponenter (read-only)

### 11.1 GhostValueCard
- 🟢 Eksisterer
- ⚫ Brukes ikke i ny drawer-flyt (cascade-deriv flyttes ut)

### 11.2 AcknowledgementRing
- 🟢 Eksisterer
- 🟡 Brukes i Step 2 av forenklet drawer

### 11.3 ComplianceBadge
- 🟢 Eksisterer

### 11.4 BlockerCounter
- 🟢 Eksisterer

### 11.5 PaymentStatusBadge
- 🟢 Eksisterer

### 11.6 ObligationProgress (NY)
- 🔴 Mini progress-ring (3/5 fullført)
- 🔴 Brukes på people-page + my-contract

### 11.7 PayRuleRow (NY)
- 🔴 Read-only visning av én pay_rule

### 11.8 ContractStatusPill (NY eller utvidet)
- 🟡 Vis status + sist endret + neste action

---

## 12. Hooks (data-laget)

### 12.1 Eksisterende
- 🟢 `useEmploymentContracts` — liste
- 🟢 `useEmploymentContract` — single
- 🟢 `useComposeContract` — drawer-mutation
- 🟢 `useSendContract` — sending
- 🟢 `useContractTemplates` — maler

### 12.2 NYE
- 🔴 `useEmploymentContractByProfile(profileId)` — siste aktive kontrakt for ansatt
- 🔴 `useEmployeePayrollProfile(profileId)` — lønnsprofil
- 🔴 `useUpdatePayrollProfile()` — mutation
- 🔴 `useContractPayRules(contractId)` — alle pay_rules
- 🔴 `useUpsertPayRule()` — mutation
- 🔴 `useContractTipRule(contractId)` — single tip_rule
- 🔴 `useUpsertTipRule()` — mutation
- 🔴 `useContractObligations(contractId)` — liste
- 🔴 `useUpsertObligation()` — mutation
- 🔴 `useObligationStatus(profileId)` — aggregert "X/Y fullført"
- 🔴 `usePensionSchemes(workspaceId)` — for dropdown
- 🔴 `useUpsertEmploymentContract()` — for people-page Ansettelse-edit

---

## 13. API endepunkter (Edge Functions)

### 13.1 Eksisterende
- 🟢 `/api/contracts/compose` — derive proposal
- 🟢 `/api/contracts/send` — send for signing
- 🟢 `/api/contracts/templates/[id]` — fetch template
- 🟢 `/api/contracts/resolve-placeholders` — placeholder-replacement
- 🟢 `/api/docuseal/webhook` — sign-callback

### 13.2 NYE
- 🔴 `/api/contracts/[id]/obligations` — GET/POST
- 🔴 `/api/contracts/[id]/pay-rules` — GET/POST
- 🔴 `/api/contracts/[id]/tip-rule` — GET/PUT
- 🔴 `/api/payroll-profile/[profile_id]` — GET/PUT
- 🔴 `/api/contracts/[id]/amendment` — initiate amendment-flow
- 🔴 `/api/employment-contract/upsert` — direkte fra people-page

---

## 14. Database (migrasjoner)

### 14.1 Eksisterende tabeller
- 🟢 `employment_contract`
- 🟢 `employee_payroll_profile`
- 🟢 `regulatory_framework`
- 🟢 `framework_rule`
- 🟢 `tariff_rate_table`
- 🟢 `workspace_framework_binding`
- 🟢 `contract_template` (for maler)

### 14.2 NYE kolonner
**`employment_contract`** (5 nye):
- 🔴 `trial_period_months`
- 🔴 `notice_period_months`
- 🔴 `break_minutes_per_day`
- 🔴 `training_rights`
- 🔴 `variable_hours_arrangement`

**`employee_payroll_profile`** (11 nye, Tripletex-aligned):
- 🔴 `payday_regular`
- 🔴 `holiday_allowance_pct`
- 🔴 `extra_holiday_week`
- 🔴 `tax_table_number`
- 🔴 `tax_card_type`
- 🔴 `tax_percentage`
- 🔴 `pension_scheme_id` (FK)
- 🔴 `trade_union_member`
- 🔴 `trade_union_fee_amount`
- 🔴 `end_date_reason`
- 🔴 `tripletex_employee_id`
- 🔴 `employee_number`

### 14.3 NYE tabeller
- 🔴 `pension_scheme` (workspace-level pensjonsordninger)
- 🔴 `contract_pay_rule` (lønnsregler per kontrakt)
- 🔴 `contract_tip_rule` (tipsregler per kontrakt)
- 🔴 `contract_obligation` (operasjonelle forpliktelser)
- 🔴 `contract_amendment` (Fase 4)

### 14.4 NYE enums
- 🔴 `contract_obligation_type` (training_required / certification_required / activity_required / attendance_required)
- 🔴 `contract_obligation_status` (pending / in_progress / done / overdue / waived)
- 🔴 `pay_rule_type` (base / overtime / supplement / tip / commission / other)
- 🔴 `tip_distribution_method` (per_shift_hours / per_position / fixed_percentage / pool)
- 🔴 `tax_card_type` (percentage / table / freecard)

---

## 15. Telemetri-events

### 15.1 Eksisterende
- 🟢 `contract.hub_viewed`
- 🟢 `contract.tab_switched`
- 🟢 `contracts.compose.opened`
- 🟢 `contracts.template.cloned`
- 🟢 `contracts.template.viewed`
- 🟢 `contract.send_initiated`
- 🟢 `contract.signed`
- 🟢 `contract_template.drift_viewed`

### 15.2 NYE
- 🔴 `contract.amendment_initiated`
- 🔴 `contract.amendment_signed`
- 🔴 `contract.payrule_added`
- 🔴 `contract.payrule_removed`
- 🔴 `contract.tip_rule_changed`
- 🔴 `contract.obligation_assigned`
- 🔴 `contract.obligation_completed`
- 🔴 `contract.obligation_overdue` (engine-event)
- 🔴 `payroll_profile.updated`
- 🔴 `employment_contract.upserted_inline` (fra people-page direkte)

---

## 16. Cascade-coupling (eksterne kontrakt-konsumenter)

Disse må fungere for at kontrakt blir "levende":

- 🔴 Shift-cost-snapshot leser `contract_pay_rule` → C3
- 🔴 Tip-distribution job leser `contract_tip_rule` → D6
- 🔴 Workforce-budget leser `employment_contract.employment_percentage` → D4
- 🔴 Onboarding-readiness leser `contract_obligation` → C1
- 🔴 Authority-config leser kontrakt-status (trainee/active) → C4
- 🔴 Botsson-context leser kontrakt for "ifølge kontrakt din"-svar → K1b memory

---

## 17. Engine_event-handlers (enforcement)

- 🔴 `obligation_due_soon` (3 dager før frist) → notify
- 🔴 `obligation_overdue` → blokkere shift-tildeling hvis blocker
- 🔴 `contract_expires_soon` (30 dager før end_date) → admin-notify
- 🔴 `tariff_version_changed` → tilbud om amendment til alle berørte kontrakter
- 🔴 `payday_today` → trigger lønn-utbetaling-job

---

## 18. Validation-regler (compliance)

### 18.1 §14-6 (lov)
- 🔴 Alle påkrevde felt fylt før signering
- 🔴 Sluttdato > startdato
- 🔴 Stillingsprosent ∈ [10, 100] for deltid
- 🔴 Prøvetid ≤ 6 måneder (lovkrav)
- 🔴 Oppsigelsesfrist ≥ 1 måned (lovkrav)
- 🔴 Feriepenger ≥ 12% (Riksavtalen)

### 18.2 Tariff (Riksavtalen)
- 🔴 Timelønn ≥ tariff-minimum for stilling + ansiennitet
- 🔴 Kveldstillegg ≥ Riksavtalen §3.2
- 🔴 Helgtillegg ≥ Riksavtalen §3.3
- 🔴 Pause ≥ 30 min ved shift > 5.5 t

### 18.3 Tripletex-validering
- 🔴 Skattekort-data komplett (table eller percentage)
- 🔴 Bankkonto-format (11 siffer + mod-11-sjekksum)
- 🔴 Personnr-format (11 siffer + mod-sjekk)

---

## 19. PDF-generering

- 🟢 DocuSeal integrasjon
- 🟢 Template + placeholder → PDF
- 🔴 Inkludér obligations-seksjon i PDF
- 🔴 Inkludér pay_rules-tabell i PDF
- 🔴 Inkludér tip_rule-beskrivelse i PDF
- 🔴 Norsk språk-template (per default)

---

## 20. Status-oppsummering

| Kategori | Total | 🟢 | 🟡 | 🔴 | ⚫ |
|----------|-------|----|----|----|----|
| Sider | 9 | 1 | 6 | 2 | 0 |
| UI-komponenter eksisterende | 32 | 22 | 8 | 0 | 2 |
| UI-komponenter nye | 31 | 0 | 0 | 31 | 0 |
| Hooks nye | 11 | 0 | 0 | 11 | 0 |
| API-endepunkter nye | 6 | 0 | 0 | 6 | 0 |
| DB-kolonner nye | 16 | 0 | 0 | 16 | 0 |
| DB-tabeller nye | 5 | 0 | 0 | 4 | 1 |
| Engine_event-handlers | 5 | 0 | 0 | 5 | 0 |
| Validations | 13 | 0 | 0 | 13 | 0 |

**Totalt 🔴 å bygge:** 100+ konkrete leveranser.

---

## 21. Faseplan

### Fase 0 — Fundament (uke 1–2)
- DB-migrasjoner (alle 5 tabeller + 16 kolonner + 5 enums)
- Hooks-skeletons
- API-endepunkter (skeleton)
- People-page Ansettelse-seksjon
- People-page Lønnsprofil-seksjon
- Drawer-forenkling (5 → 2 steg)

### Fase 1 — Lønnsregler (uke 3)
- PayRuleEditor + UI
- TipRuleEditor + UI
- shift-cost-snapshot leser pay_rules

### Fase 2 — Forpliktelser (uke 4)
- contract_obligation tabell + UI
- Mal-default obligations
- Engine-handlers (due_soon, overdue)

### Fase 3 — Mal-flyt (uke 5)
- /dashboard/contracts/maler/ny
- Inline-edit av maler
- Default obligations i mal

### Fase 4 — Amendment + Tripletex-sync (senere)
- contract_amendment-tabell
- Re-signering ved material endring
- Tripletex API-integrasjon

---

## 22. Definition of Done — Kontraktmodulen

Modulen er "ferdig" når:

1. Admin kan definere fullt kontraktgrunnlag på people-page før drawer åpnes
2. Drawer er trivielt `EmployeePickerDrawer` → `ContractDispatchDrawer` 2-steg compose flow
3. Lønn beregnes per shift basert på kontrakt-pay-rules
4. Tipsfordeling fungerer per shift
5. Forpliktelser vises på people-page + my-contract
6. Forpliktelser blokkerer shift-tildeling hvis overdue + blocker
7. PDF inkluderer alle § 14-6-felt + tariff + obligations
8. Botsson kan svare på kontraktspørsmål basert på strukturert data
9. Tripletex-mapping eksisterer (sync ikke krevd, men struktur skal støtte)
10. Amendment-flow fungerer ved tariff- eller policy-endring
11. Trelags authoring-split dokumentert og nåbar: compose-hub (`/dashboard/contracts`) / settings-author (`/dashboard/settings#contract-templates`) / platform-admin deep-edit (`/platform-admin/contracts/templates/[id]/edit`)

---

## Endringshistorikk

| Dato | Endring | Forfatter |
|------|---------|-----------|
| 2026-04-29 | Initial — Fase 0 strukturplan | Claude (caveman) |
| 2026-04-29 | Trelags arkitektur-revisjon: splitter Maler-authoring på hub/settings/platform-admin per shipped reality | Claude (caveman) |
