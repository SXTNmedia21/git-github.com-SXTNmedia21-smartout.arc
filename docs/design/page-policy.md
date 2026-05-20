---
title: "Page Policy — operasjonalisering av dashboard-page-pattern"
status: canonical
updated: 2026-05-15
created: 2026-05-15
module: design
tags: [policy, audit, dashboard, nordic-split, enforcement]
---

# Page Policy

Operasjonalisering av [dashboard-page-pattern.md](./dashboard-page-pattern.md). Policyen er **regelsettet**. Page Policy er **håndhevelsen**: konkrete grep-kommandoer, audit-protokoll, per-side rapport-template.

Bruk når en side skal sjekkes mot kanonisk `/dashboard` (WebDayControl) referanse på fire akser: **padding, farger, kort, meny**.

---

## 1. Kanonisk referanse

`/dashboard` (WebDayControl) — `apps/web/src/components/day/WebDayControl.tsx`.

| Aksel | Verdi | Linje |
|---|---|---|
| **Padding** outer | `relative flex h-full min-h-0 flex-1 flex-col overflow-hidden` | L169 |
| **Padding** content | `p-4 pt-1 md:p-6 md:pt-3` | L202, L226 |
| **Header** layout | `mb-5 flex items-end justify-between gap-4` | L204, L245 |
| **H1** | `font-heading text-foreground text-3xl leading-tight tracking-tight` | L206, L247 |
| **Subtitle** | `text-muted-foreground mt-1 text-sm` | L209, L250 |
| **Tabs** | `<PageTabNav>` komponent, `mb-5` | L279-286 |
| **Body** | `min-h-0 flex-1 overflow-hidden` | L289 |
| **Kort** | `border-border bg-card rounded-2xl border p-5 shadow-sm` | L382 |
| **Ambient orb** | radial-gradient via `var(--brand-orange)` color-mix | L144-149, L172-175 |
| **State-machine** | `<AnimatePresence mode="wait">` med loading/no-data/ready branches | L177 |
| **Motion** | `motionTokens.spring` / `.exitMs` / `.easingArray` | L156-166, L297 |

---

## 2. Audit-protokoll

Kjør i rekkefølge per side under audit.

### Steg 1: Padding-drift

```bash
# Ytre wrapper må ha min-h-0 flex-1 overflow-hidden
grep -n "flex h-full.*flex-col" apps/web/src/app/dashboard/<page>/**/*.tsx

# Bør IKKE matche overflow-y-auto eller overflow-auto på ytre wrapper
grep -n "h-full.*overflow-y-auto" apps/web/src/app/dashboard/<page>/**/*.tsx

# Innhold padding må være responsive (p-4 pt-1 md:p-6 md:pt-3), ikke flat p-6
grep -n "className=.*\"[^\"]*p-6[^\"]*\"" apps/web/src/app/dashboard/<page>/**/*.tsx | grep -v "md:p-6"
```

### Steg 2: Farge-drift (Nordic Split)

```bash
# Forbudte palettenavn
grep -rn "zinc-\|gray-\|slate-\|neutral-\|stone-" apps/web/src/app/dashboard/<page>/

# Tillatt: CSS-variabler via Tailwind-arbitrary `text-[color:var(--...)]`
```

### Steg 3: Kort-drift

```bash
# Kanonisk kort skal være rounded-2xl + p-5 + shadow-sm
grep -rn "rounded-xl\|rounded-lg" apps/web/src/app/dashboard/<page>/_components/ | grep -i "bg-card"
# Hver hit = potensiell drift. rounded-xl tillatt på små tiles/badges, IKKE på primær-innhold.

# Manglende shadow-sm på primær-kort
grep -rn "bg-card.*rounded-2xl" apps/web/src/app/dashboard/<page>/_components/ | grep -v "shadow-sm"
```

### Steg 4: Meny/tab-drift

```bash
# Sider med sub-views må bruke PageTabNav-komponent, ikke ad-hoc tab-bar
grep -rn "role=\"tablist\"" apps/web/src/app/dashboard/<page>/_components/
# Hver hit utenfor PageTabNav = drift.

grep -rn "PageTabNav" apps/web/src/app/dashboard/<page>/
# 0 hits + side har tabs = drift.
```

### Steg 5: Motion-token-drift

```bash
grep -rn "stiffness:\|damping:" apps/web/src/app/dashboard/<page>/ | grep -v "motionTokens\."
grep -rn "duration: 0\.\|ease: \[" apps/web/src/app/dashboard/<page>/ | grep -v "motionTokens\."
```

---

## 3. Severity-rubrikk

| Severity | Eksempel | Handling |
|---|---|---|
| **P0 critical** | Hardkodet zinc/gray/slate; side scroller selv (`overflow-y-auto` på outer) | Fix før neste deploy |
| **P1 high** | Manglende `<PageTabNav>`, ad-hoc tab-bar | Fix i polish-sortie |
| **P2 medium** | rounded-xl på primær-kort, manglende shadow-sm, hardkodet motion-tall | Fix i samme PR som annet polish |
| **P3 low** | tracking-[-0.02em] vs leading-tight tracking-tight | Cosmetic, kan vente |

---

## 4. Audit-rapport-template

Hver audit produserer fil i `docs/design/page-policy-audits/YYYY-MM-DD-<page>.md`:

```markdown
---
title: "Page Policy Audit — <page>"
status: draft | reviewed | fixed
updated: YYYY-MM-DD
audited_against: dashboard-page-pattern.md (commit <SHA>)
reference: /dashboard (WebDayControl.tsx)
---

# <Page> — drift-rapport

## Sammendrag
- P0: N findings
- P1: N findings
- P2: N findings
- P3: N findings

## Funn

### A. Padding
| Fil:linje | Drift | Severity | Fix |
|---|---|---|---|
| ... | ... | P? | ... |

### B. Farger
...

### C. Kort
...

### D. Meny
...

## Fix-rekkefølge
1. ...
2. ...
```

---

## 5. Akseptanse — når en side er "compliant"

Alle disse må gjelde:

- [ ] Steg 1 returnerer 0 outer `overflow-y-auto`/`overflow-auto` hits
- [ ] Steg 1 returnerer 0 flat `p-6` hits uten `md:` prefix
- [ ] Steg 2 returnerer 0 zinc/gray/slate/neutral/stone hits
- [ ] Steg 3 returnerer 0 `rounded-xl`/`rounded-lg` hits på primær `bg-card` kort
- [ ] Steg 3 returnerer 0 `bg-card.*rounded-2xl` uten `shadow-sm`
- [ ] Steg 4 — hvis sub-views: bruker `<PageTabNav>`; ingen `role="tablist"` utenfor komponenten
- [ ] Steg 5 returnerer 0 hardkodet stiffness/damping/duration utenfor `motionTokens.*`
- [ ] Side har ambient orb radial-gradient via CSS-var
- [ ] Side har `<AnimatePresence mode="wait">` rundt state-grenene

---

## 6. Når policyen oppdateres

Page Policy referer alltid til **siste commit** av `dashboard-page-pattern.md`. Hvis kanonen endrer seg:
1. Oppdater `dashboard-page-pattern.md` (canonical)
2. Bump `updated:` her
3. Re-audit polished pages — eksisterende rapporter får `status: outdated`

---

## Changelog
| Dato | Endring | Forfatter |
|---|---|---|
| 2026-05-15 | Initial — operasjonaliserer dashboard-page-pattern fra 2026-04-29 | Pontus + Claude |
