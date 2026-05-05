---
title: "Dashboard Page Pattern — Oversikt-stil"
status: canonical
updated: 2026-04-29
created: 2026-04-29
module: design
tags: [pattern, dashboard, nordic-split, page-layout]
---

# Dashboard Page Pattern — Oversikt-stil

Kanonisk struktur etablert på `/dashboard` (WebDayControl) 2026-04-29. Alle nye dashboard-flater (Ansatte, Vaktplan, Rapporter, Avstemming, Avvik osv.) skal følge dette mønsteret. Bygger på Nordic Split-skill og Reports-side-mønster.

---

## 1. Side-shell

### 1.1 Outer container
```tsx
<div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
  {/* Header → Tabs → Body */}
</div>
```

| Egenskap | Verdi | Hvorfor |
|---|---|---|
| Padding base | `p-4 pt-1` | DashboardShell `/dashboard` legger på `p-2`. Total = 24px sider, 12px topp |
| Padding md+ | `md:p-6 md:pt-3` | Total med shell = 32px sider, 20px topp |
| Layout | `flex flex-col` | Header + tabs shrink, body flex-1 |
| Overflow | `min-h-0 overflow-hidden` (på body) | Side scroller ALDRI selv. Kun array-elementer i kort scroller |

**Hvorfor ingen ytre kort:** Innholdet er flatet ut. Ingen wrapper-kort med ramme + shadow. Hvert sub-kort står fritt på `bg-background`.

### 1.2 Page header
Reports-stil: H1 + subtitle inline + actions høyre.

```tsx
<div className="mb-5 flex items-end justify-between gap-4">
  <div className="min-w-0">
    <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
      {pageTitle}
    </h1>
    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
      {/* Subtitle: kontekst-pills, mono-tall, status */}
    </div>
  </div>
  <div className="flex items-center gap-1.5">
    {/* Actions: navigator, kebab, AI-knapp */}
  </div>
</div>
```

| Element | Stil |
|---|---|
| H1 | `font-heading text-3xl leading-tight tracking-tight` |
| Subtitle | `text-muted-foreground mt-1 text-sm` |
| Subtitle separator | `<span aria-hidden className="opacity-50">·</span>` |
| Mono-tall i subtitle | `font-mono tabular-nums` |
| Header → tabs gap | `mb-5` |

### 1.3 Tab-nav
Reuse `<PageTabNav>` (`apps/web/src/components/dashboard/PageTabNav.tsx`). Pill-row stil matchet med Reports.

```tsx
<div className="mb-5">
  <PageTabNav tabs={TAB_DEFS} active={tab} onChange={setTab} />
</div>
```

Bytt aldri ut tab-stilen ad hoc — bruk komponenten.

### 1.4 Body
Body fyller resterende høyde. Ingen page-scroll.

```tsx
<div className="min-h-0 flex-1 overflow-hidden">
  {/* Tab content */}
</div>
```

Hvis tab-innhold trenger scroll → tab-en bestemmer selv hvordan (typisk `scrollbar-thin overflow-y-auto pr-1` på lister, ikke på sider).

---

## 2. Kort-primitiv

**Én og kun én kort-stil overalt:**

```tsx
<div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
  {/* content */}
</div>
```

| Variant | Bruk |
|---|---|
| Standard | KpiAccentTile, ActivityLog, MustDoCard, DayTimelineStrip, DayEventList, sidebar-kort |
| Med glow | Topp-høyre glow-blob `pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl bg-{accent}-500/20` |
| Asymmetric KPI | `KpiAccentTile` — eget komponent (under) |

**Forbudt:**
- `bg-white` / `bg-zinc-*` / `bg-gray-*` / hex i className (Nordic Split)
- Egne ad-hoc bakgrunner som `bg-muted/40` på sub-kort — alle kort skal se LIK ut
- Variere shadow per kort
- Variere border-radius (kun `rounded-2xl`)

---

## 3. KpiAccentTile

Pakkesti: `@smartout/ui` → `KpiAccentTile`.

Asymmetrisk 2-stat-kort med glow + ikon-chip + primær (BIG) + sekundær (small).

```tsx
<KpiAccentTile
  title="På vakt"
  icon={Users}
  accent="emerald"
  primary={{ label: "På vakt nå", value: 4 }}
  secondary={{ label: "Kommer i dag", value: 8 }}
  trend={{ direction: "up", label: "+12%" }}
  onClick={() => onNavigate("roster")}
/>
```

### 3.1 Anatomi
| Lag | Stil |
|---|---|
| Outer | `bg-card border-border rounded-2xl border p-5 shadow-sm` |
| Glow | `-top-12 -right-12 h-36 w-36 rounded-full blur-3xl bg-{accent}-500/20` |
| Icon-chip | `h-9 w-9 rounded-xl border bg-{accent}-50 dark:bg-{accent}-500/10 text-{accent}-600` |
| Eyebrow-tittel | `text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground` |
| Primary value | `font-mono text-[44px] font-black leading-none tracking-[-0.02em] tabular-nums` |
| Primary unit | `text-muted-foreground text-[15px] font-medium` |
| Primary label | `text-muted-foreground mt-1.5 text-[12px] font-medium` |
| Secondary row | `border-t pt-3` med label venstre + tall høyre |
| Secondary value | `font-mono text-[15px] font-semibold tabular-nums` |
| Trend pill | `rounded-full bg-background/60 backdrop-blur shadow-sm` |
| Hover (interactive) | `hover:-translate-y-0.5 hover:shadow-md cursor-pointer` |

### 3.2 Accent-paletter
`emerald | blue | purple | orange | rose | amber`

| Tile | Accent | Når rose |
|---|---|---|
| På vakt | emerald | — |
| Oppgaver | blue | — |
| Avvik | orange | rose når eskalerte > 0 |
| Arbeidstid | purple | — |
| Lønn | emerald | — |
| Omsetning | amber | — |

### 3.3 Click-drilldown
`onClick` → router.push eller setTab. Tile har `role="button"`, `tabIndex=0`, Enter/Space-handler. Drillen til:
- En tab i samme side (vanligst)
- EntityDrawer hvis entitet er kjent (cascade_task, shift, profile, deviation)

---

## 4. Layout-grid

### 4.1 KPI-strip
6 tiles, 3-col på lg+:
```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {/* 6 KpiAccentTiles */}
</div>
```

### 4.2 Main + sidebar
```tsx
<div className="grid h-full min-h-0 grid-cols-1 gap-5 overflow-hidden lg:grid-cols-[1fr_340px]">
  <div className="flex min-h-0 flex-col gap-5 overflow-hidden">
    {/* Main: KPI top + 2-col under */}
  </div>
  <aside className="scrollbar-thin grid content-start gap-3.5 overflow-y-auto pr-1">
    {/* Sidebar: drill-down kort, siste meldinger */}
  </aside>
</div>
```

| Kolonne | Bredde | Scroll |
|---|---|---|
| Main | `1fr` | `overflow-hidden` (kort scroller internt) |
| Sidebar | `340px` | `overflow-y-auto` (mange kort kan stables) |

### 4.3 2-col under KPI
Når man har to fyll-kort under KPI (typisk ActivityLog + MustDo):
```tsx
<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
  <CardA />
  <CardB />
</div>
```

Begge kort har `flex h-full flex-col` så de fyller resterende høyde, listen scroller internt med `flex-1 overflow-y-auto`.

---

## 5. Scroll-disiplin

**Regel:** Siden scroller ALDRI. Bare lister i kort.

| Element | Scroll-strategi |
|---|---|
| Page-shell | `overflow-hidden` |
| KPI-grid | Fast høyde, `shrink-0` |
| Card-listen (ul) | `flex-1 overflow-y-auto pr-1` (kun internt) |
| Sidebar | `overflow-y-auto` (godkjent fordi det er en kolonne med stable kort) |
| Tab-content (TimelineTab) | Eget `flex-col h-full` med sticky strip + scrollbar liste |

`scrollbar-thin`-klassen brukes der listen er synlig — droppes når scroll er internt og lite.

---

## 6. Typografi

| Nivå | Stil | Bruk |
|---|---|---|
| H1 | `font-heading text-3xl leading-tight tracking-tight` | Page header |
| H2/H3 | `text-foreground text-sm font-bold tracking-tight` | Card-titler |
| Eyebrow | `text-[10-11px] font-bold tracking-[0.14em] uppercase text-muted-foreground` | Kort-toppmerker, sektion-labels |
| Body | Geist Sans default | Brødtekst |
| Tall | `font-mono tabular-nums` | Alltid på KPI-tall, tider, beløp |
| Big number | `font-mono text-[44px] font-black leading-none tracking-[-0.02em] tabular-nums` | KpiAccentTile primary |
| Body-tall | `font-mono text-[13-15px] font-semibold tabular-nums` | Sekundære tall |
| Body-tekst | `text-foreground text-sm` (13px-14px) | Card content |
| Sekundær body | `text-muted-foreground text-[12px]` | Subtitler, meta |

**Regel:** Heading-fonten (Instrument Serif) brukes KUN på H1 (page-titler) og store sektion-titler. Card-titler bruker Geist Sans bold.

---

## 7. Farger

Alle farger via CSS-variabler eller tokenized Tailwind palette. Aksent-farger er i Tailwind palette (purple/emerald/blue/orange/rose/amber) — IKKE zinc/gray/slate/neutral/stone.

Standard surfaces:
- `bg-background` — page bg (kommer fra Nordic Split warm OKLCH)
- `bg-card` — alle kort
- `bg-muted` — subtle surface (icon-chips, inntastingsfelt)
- `border-border` — alle rammer
- `text-foreground` — primær tekst
- `text-muted-foreground` — sekundær tekst

---

## 8. Interaktive mønstre

### 8.1 Klikk → drawer
`useEntityDrawerOptional()` → `openDrawer(type, id)`.

Støttede typer (per 2026-04-29):
- `department`, `profile`, `team`, `shift`, `department_session`, `shift_template`, `cascade_task`, `deviation`

Klikk på sidebar-Avvik, ActivityLog innslag, KPI-tile → drawer hvis entity er kjent. Ellers tab-nav.

### 8.2 Klikk → tab
`onNavigate(tabKey)` propag fra parent. Kun for entity-typer drawer ikke dekker (booking, note, broadcast).

### 8.3 Klikk → router.push
For cascade-tasks med `task.href` når drawer ikke har relevant tab — fallback.

---

## 9. Motion

Bruk tokens fra `@smartout/design-tokens`:

```ts
import { motion as motionTokens } from "@smartout/design-tokens";
// motionTokens.spring        — content swap (stiffness 35, damping 22, mass 2.2)
// motionTokens.springSnappy  — button press, badge pop (45/24/2)
// motionTokens.springGentle  — orb breathing (30/20/2.5)
// motionTokens.enterMs       — 500ms entrance
// motionTokens.exitMs        — 250ms exit
```

Enter `{ opacity: 0, y: 8 }` → `{ opacity: 1, y: 0 }` med `motionTokens.spring`. Tab swap bruker `AnimatePresence mode="wait"`.

---

## 10. Akseptansekriterier (når noen ny side bygges)

- [ ] Outer = `flex h-full flex-col p-4 pt-1 md:p-6 md:pt-3`, ingen ytre kort
- [ ] Header = H1 `text-3xl` + subtitle `text-sm muted` + actions høyre, `mb-5`
- [ ] Tabs (hvis side har sub-views) = `<PageTabNav>`, `mb-5`
- [ ] Body = `min-h-0 flex-1 overflow-hidden` — siden scroller ikke selv
- [ ] Alle kort = `bg-card border-border rounded-2xl border p-5 shadow-sm`
- [ ] KPI-tiles bruker `<KpiAccentTile>` med samme accent-mapping
- [ ] Alle tall = `font-mono tabular-nums`
- [ ] Lister scroller internt med `flex-1 overflow-y-auto pr-1`
- [ ] Klikkbare entiteter åpner drawer via `useEntityDrawerOptional`
- [ ] 0 hits på `text-(zinc|gray|slate|neutral|stone)-` / `bg-zinc-` / hex farger i className
- [ ] Spring physics-prop på alle Framer Motion (`type: "spring", ...motionTokens.spring`)

---

## 11. Eksempler i koden

| Side | Path | Stil-kvalitet |
|---|---|---|
| `/dashboard` (WebDayControl) | `apps/web/src/components/day/WebDayControl.tsx` | ★ Kanonisk |
| `/dashboard/reports` | `apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx` | ★ Inspirasjon |

Bygges neste:
- `/dashboard/people` (Ansatte) — design-lift planlagt
- `/dashboard/schedule` (Vaktplan) — egen sortie
- `/dashboard/reconciliation` (Avstemming) — recon-v2 sub-sortie

---

## Changelog
| Dato | Endring | Forfatter |
|---|---|---|
| 2026-04-29 | Initial doc fra design-runden på Oversikt | Pontus + Claude |
