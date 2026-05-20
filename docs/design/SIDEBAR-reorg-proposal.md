---
title: Sidebar Reorganization Proposal — Discussion
status: draft
updated: 2026-05-15
created: 2026-05-15
module: design
tags: [sidebar, navigation, reorg, ux, dashboard, ia]
---

# Sidebar Reorganization — Tenkning + Forslag

Pontus skisserte 4 grupper. Audit avdekket 23 hjemløse ruter + 4 nye fra wt-1. Dette dokumentet:
1. Mapper alle 71 ruter mot Pontus' grupper
2. Identifiserer hva som mangler (Pontus flagget Oppgaver + HMS — det er mer)
3. Foreslår navngivning + struktur
4. Sier hva som trengs for å implementere

## Pontus' utgangspunkt (det jeg fanget)

```
Oversikt (alene, øverst)
↓
Ledelse / Drift
├── Ansatte
├── Vaktplan
└── Kalender
↓
Administrasjon
├── Organisasjon
├── Rapporter
├── Lønn
└── Avstemming
↓
Kommunikasjon
├── Kanaler
├── Chat
└── Nyheter
```

11 lenker. Resten av 67 ruter er ikke nevnt.

## Hva mangler (utover Oppgaver + HMS)

Konseptuelt 7 grupper til:

| Manglende konsept | Berørte ruter (orphans) | Hvorfor det matter |
|---|---|---|
| **Oppgaver** | (mangler rute) | ADR-0298 unified task capability shipped, ingen UI. Cross-source liste (session_task + personal_task + schedule_day_task + emma_task). Manager OG ansatt trenger dette. |
| **HMS** | `/hms` + 6 sub | Kjerne-compliance Norge hospitality. 7 ruter eksisterer, 0 lenker. Mest kritisk orphan-bunke. |
| **Planlegging** (D4/D5) | `/year-wheel`, `/season/[id]` | Cascade core — sesong + årshjul. Manager-prep "skal vi tegne neste sesong?". |
| **Compliance / Styring** | `/governance`, `/policies`, `/handbook` | Sibling til HMS — workspace-policy + protokoller. Kan være under HMS eller egen. |
| **Forslag / Proposals** | `/proposals`, `/proposals/[id]` | Change-proposal review — agent-foreslått, manager-godkjent. C4 governance core. |
| **Integrasjoner** | `/admin/pos-accounts` (+ ny `/pos-accounts` wt-1) | POS Lightspeed nå, vendor-utvidelse (ADR-0319). Egen plass for "kobling til andre systemer". |
| **Veiledning** | `/help`, `/manuals` (wt-1 ny), `/setup`, `/onboarding-assistant` | Hjelp + onboarding-assistent + setup-wizard. "Hvor får jeg hjelp" som tydelig hjørne. |

Bonus (fits naturligt):
- **Min Tid** (allerede i sidebar nederst — mine-* + shift-clock orphan)
- **AI / Botsson** (`/ai`, `/ai/config` — allerede linket)
- **Notifications** (orphan, men reachable via topbar bell — kan stå alene der)
- **Innstillinger** (allerede linket)

## Forslag — full revidert sidebar

```
┌──────────────────────────────┐
│   Strøm Mat & Bar  [▼]       │  ← workspace-switcher
├──────────────────────────────┤
│ ◆ Oversikt          /dashboard│  ← alene øverst per Pontus
├──────────────────────────────┤
│   DRIFT                      │  ← gruppe-header
│ □ Ansatte           /people  │
│ □ Vaktplan          /schedule│
│ □ Kalender          /calendar│
│ □ Vaktbørs          /schedule/marketplace│
│ □ Oppgaver          /tasks  │  ← NY rute, må bygges
│ □ Forslag           /proposals│ ← link orphan
├──────────────────────────────┤
│   PLANLEGGING                │
│ □ Årshjul           /year-wheel│ ← link orphan
│ □ Sesong            /season/[id]│ ← drill-in
│ □ Setup-veiviser    /setup  │ ← link orphan
├──────────────────────────────┤
│   ADMINISTRASJON             │
│ □ Organisasjon      /organization│
│ □ Lønn              /payroll │
│ □ Avstemming        /reconciliation│
│ □ Rapporter         /reports │
│ □ Kontrakter        /contracts│ ← link orphan (manager-side)
│ □ Kostnader         /cost   │ ← link orphan
│ □ Fakturering       /billing│ ← link orphan (eller flytt til platform-admin)
│ □ Nettside          /website│ ← link orphan (eller behold orphan om ikke-aktiv)
│ □ Innstillinger     /settings│
├──────────────────────────────┤
│   HMS & COMPLIANCE           │
│ □ HMS-oversikt      /hms    │ ← link orphan-hub
│ □ Avvik             /hms/deviations│
│ □ Dokumenter        /hms/documents│
│ □ Trening           /hms/training│
│ □ Drift-sjekk       /hms/drift│
│ □ Styring           /hms/governance│
│ □ Policies          /policies│ ← link orphan
│ □ Handbok           /handbook│ ← link orphan
├──────────────────────────────┤
│   KOMMUNIKASJON              │
│ □ Kanaler           /komm   │
│ □ Chat              /komm/chat│
│ □ Nyheter           /komm/nyheter│
│ □ Desks             /komm/desks│ ← link orphan
│ □ Oversikt          /komm/oversikt│ ← link orphan
├──────────────────────────────┤
│   INTEGRASJONER (admin)      │
│ □ POS               /admin/pos-accounts│ ← link orphan
│ □ (Tripletex-fremover)        │
├──────────────────────────────┤
│   AI & BOTSSON               │
│ □ AI                /ai     │
│ □ Config            /ai/config│
│ □ Onboarding-assistent /onboarding-assistant│ ← link orphan
├──────────────────────────────┤
│   VEILEDNING                 │
│ □ Hjelp             /help   │
│ □ Manualer          /manuals│ ← NY (wt-1 ny)
├──────────────────────────────┤
│ Botsson [aktiv]              │  ← eksisterende widget
├──────────────────────────────┤
│ Ida Holm  Manager · Bar  ⚙   │  ← profile + settings
└──────────────────────────────┘

Bunn (ansatt-modus eller alltid synlig):
┌──────────────────────────────┐
│   MIN TID                    │
│ □ Min plan          /my-schedule│
│ □ Min lønn          /my-salary│
│ □ Min kontrakt      /my-contract│
│ □ Min CV            /my-cv  │
│ □ Min trening       /my-training│
│ □ Min profil        /my-profile/complete│
│ □ Stempelur         /shift-clock│ ← link orphan (mobil-primær men web bør link)
└──────────────────────────────┘
```

## Navngivnings-debatt

| Navn | Alternativ | Anbefaling |
|---|---|---|
| Drift vs Ledelse | "Drift" = daglig prod; "Ledelse" = abstract | **Drift** — passer hospitality (kjøkken/bar drives, ledes ikke) |
| HMS vs "Compliance & HMS" | norsk vs blandet | **HMS** — alle vet hva det er; ikke pynt med engelsk |
| Oppgaver vs "Mine oppgaver" vs "To-do" | scope-spørsmål | **Oppgaver** — capability ADR-0298 listMine() filtrerer per rolle automatisk; sidebar-label er nøytral |
| Forslag vs "Endringsforslag" vs "Proposals" | C4 governance | **Forslag** — kortere, leselig |
| Planlegging vs "Sesong" som top-level | hva er hjørnesteinen | **Planlegging** — Sesong er én aspekt (D4); Setup-veiviser hører også hjemme |
| Integrasjoner vs "Koblinger" vs "Tilkoblinger" | tone | **Integrasjoner** — tech-konnotasjon stemmer med målgruppe (admin) |
| Veiledning vs "Hjelp og manualer" vs "Dokumentasjon" | scope | **Veiledning** — paraply, dekker hjelp + manualer + onboarding-assistent |

## Hva som må implementeres

### Nye ruter (1)

1. **`/dashboard/tasks`** — Cross-source unified task list. Bruk eksisterende capability `task` (ADR-0298 Sortie 3). 6 verktøy klare: `list_mine` + 4 create-varianter + `complete` + `cancel_personal`. Trenger:
   - `apps/web/src/app/dashboard/tasks/page.tsx` — Server Component, fetcher tasks fra 5 kilder via task capability
   - `apps/web/src/app/dashboard/tasks/loading.tsx` — skeleton
   - `apps/web/src/app/dashboard/tasks/_components/TasksPageClient.tsx` — filter (alle/mine/team/i dag/forfalt) + cards per task med kilde-badge + complete-knapp
   - `apps/web/src/app/dashboard/tasks/_hooks/use-tasks.ts` — TanStack Query
   - `apps/web/src/app/dashboard/tasks/_tools/tasks-tools-bridge.tsx` + `use-tasks-tools.ts` — Botsson tool bridge (propose_create_personal, propose_complete, etc.)

### Sidebar-refaktor (1 sortie)

`apps/web/src/components/dashboard/DashboardShell.tsx` har flat lenkeliste i dag (linje 1326+). Må bli grupperte seksjoner:
- Komponent: `<SidebarGroup label="Drift">{children}</SidebarGroup>`
- Hver gruppe collapsible (default ekspandert for første 3 grupper, collapse resten)
- Active-state highlight pr. gruppe når sub-rute er aktiv
- Mobile responsive: gruppene blir til en hamburger-meny med samme struktur

### Ruter å lenke (orphans → home)

Total 23 orphans får sidebar-entry per forslag over. Per orphan:
- Verifisér at siden faktisk fungerer (server-side render uten error)
- Hvis sidens funksjon er aktivt produkt → link i sidebar per forslag
- Hvis funksjonen er død/abandoned → slett ruten (ikke skjul den)

Tre ruter foreslått slettet (ikke aktivt produkt):
- `/dashboard/website` + sub (3 orphans) — er website-builder pågående eller frosset? **Spør Pontus.**
- `/dashboard/onboarding-assistant` vs `/dashboard/setup` — overlap? Ett av dem skal trolig dø. **Spør Pontus.**

### Wt-1 duplikat-reconcile

| Wt-1 ny | Eksisterende på dev | Anbefaling |
|---|---|---|
| `/dashboard/marketplace` | `/dashboard/schedule/marketplace` | Behold dev (sub av schedule). Slett wt-1 versjon. Eller: flytt dev → top-level marketplace + slett wt-1. |
| `/dashboard/pos-accounts` | `/dashboard/admin/pos-accounts` | Behold dev (admin-prefiks markerer admin-only). Slett wt-1 versjon. Eller: bytt til wt-1 (renere URL). |
| `/dashboard/manuals` | (ingen) | Behold wt-1 — ny rute, ingen duplikat. |

Pontus tar disse beslutningene før close-feature på wt-1.

## Implementasjonsplan (2-3 sortier)

| Sortie | Scope | Estimat |
|---|---|---|
| 1 | Sidebar-refaktor i DashboardShell + grupperte seksjoner + alle 23 orphan-links | 1 dag |
| 2 | Build `/dashboard/tasks` page + Botsson tool bridge | 0.5 dag |
| 3 | Wt-1 duplikat-reconcile (slett duplikater, link `/manuals`) + close-feature | 0.5 dag |

Sortie 1 er størst og berører kun ÉN fil (`DashboardShell.tsx`). Lavt risiko, høy verdi.

## Åpne beslutninger (trenger Pontus)

1. **Drift vs Ledelse**: hva kalles toppgruppen? (Anbefalt: Drift)
2. **Compliance under HMS, eller egen gruppe?** (Anbefalt: under HMS — ett mentalt sted for alle compliance-ting)
3. **`/website` — aktivt eller dødt?** (Hvis dødt: slett 3 ruter)
4. **`/onboarding-assistant` vs `/setup` — hvilken overlever?** (Sannsynligvis `/setup` som veiviser-shell + `/onboarding-assistant` som AI-assistent som åpnes inni)
5. **`/billing` — workspace-vendt eller bare platform-admin?** (Hvis workspace-vendt = link i Administrasjon; hvis platform-admin = slett)
6. **Wt-1 duplikat-reconcile** (3 valg per duplikat — se tabell over)
7. **Mobile sidebar-mirror** — skal mobile tabs reflektere ny gruppe-struktur, eller forbli 5-tab fast (Kalender/Vakter/FAB/Chat/Min Tid)? ADR-0133 sier mobile = Approve/Execute, så grupperte sidebar ER nok web-only.

## Excalidraw

Se `SITEMAP-current-vs-proposed.excalidraw` (samme mappe) — visualiserer venstre-side current sidebar vs høyre-side proposed. Rødt = orphan, grønt = linket, gult = sub-rute, blått = ny.
