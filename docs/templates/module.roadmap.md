---
title: "[Modulnavn] — Roadmap"
id: ROADMAP_[SHORT_ID]
version: "1.0"
status: draft
module: [module-slug]
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: [navn]
tags:
  - roadmap
  - [modul]
journeys:
  - J-XXX
---

# [Modulnavn] — Roadmap

> **[Slogan]** — én setning som fanger verdien modulen leverer.

**Kort** — 1–2 setninger: hvem er det for, og hva skal føles «ferdig» når modulen fungerer?

**Mellom** — 3–5 setninger: kontekst, avgrensning (in/out), og hvordan denne roadmapen skal brukes (levende dokument, oppdateres når status endres — ikke en detaljert spec).

---

## Status — les først

| Verdi | Betydning |
| ----- | --------- |
| `live` | Fungerer — brukbar i prod/pilot, akseptanse oppfylt |
| `in_progress` | Pågår — aktiv utvikling eller utrulling |
| `planned` | Planlagt — prioritert, ikke startet |
| `blocked` | Blokkert — avhengighet eller beslutning mangler |
| `deferred` | Utsett — bevisst parkert |

---

## Oversikt (ett blikk)

| # | UX-journey | Status | Kommentar |
| - | ---------- | ------ | --------- |
| 1 | [Kort navn] | `live` \| `in_progress` \| `planned` \| `blocked` \| `deferred` | [Valgfri — én linje] |
| 2 | [Kort navn] | `planned` | |
| 3 | [Kort navn] | `in_progress` | |

> **Tips:** Hold oversiktstabellen synkron med seksjonene under. Den er det mennesker skanner først.

---

## 1. [UX-journey — kort navn]

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **[aktør]** vil jeg **[handling]** slik at **[utfall]**. | `live` | |

---

## 2. [UX-journey — kort navn]

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **[aktør]** vil jeg **[handling]** slik at **[utfall]**. | `planned` | |

---

## 3. [UX-journey — kort navn]

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **[aktør]** vil jeg **[handling]** slik at **[utfall]**. | `in_progress` | |

---

<!-- Flere journeys: kopier seksjon 3. Nummerer 4, 5, … -->

## Koblinger (valgfritt)

| Type | Referanse |
| ---- | --------- |
| Journey-spec | `docs/journeys/[slug]/` |
| Arkitektur | `docs/architecture/…` |
| Linear | SMA-XXX |

---

> Etter første fylling: legg inn i `docs/INDEX.md` under modul/roadmap. Oppdater `updated` i frontmatter når status endres.
