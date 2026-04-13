---
title: Smartout — Grunnlag for prising
status: draft
updated: 2026-04-13
created: 2026-04-13
module: billing
tags: [prising, strategi, faktagrunnlag]
---

# Smartout — Grunnlag for prising

**Versjon:** 2.0
**Dato:** 13. april 2026
**Eier:** Pontus Lindroth
**Formål:** Enkelt faktagrunnlag for prisarbeid. Ingen anbefalinger — bare fakta.

---

## 1. Hva Smartout er

Smartout er en alt-i-ett-plattform for skiftbaserte bedrifter. Åtte produktområder:

| Område | Hva det dekker |
|---|---|
| **Vaktliste** | Vaktplanlegging, skiftmaler, åpne skift, arbeidsbudsjett, sesongkonfigurasjon |
| **Tid og oppmøte** | Stemplingsur, GPS-verifisering, overtidsvarsler, lønnsgrunnlag, tillegg |
| **Ansatte og HR** | Ansattoversikt, kontrakter, e-signering, roller, avdelinger, team |
| **Oppgaver** | Daglige rutiner, sjekklister, driftsoversikt |
| **Opplæring** | Strukturert læring, onboarding, kompetansesporing, readiness |
| **IK-mat / HACCP** | Temperaturlogg, renhold, avviksregistrering, sikkerhetsrunder |
| **Kommunikasjon** | Intern chat, kanaler, push-varsler, morgendigest |
| **AI og automasjon** | 15 AI-funksjoner: stemmeassistent, planleggingsmotor, guardian, rapporter |

Alt er bygget i én plattform med felles brukerbase og delte data. Se `Smartout features.md` for komplett funksjonsliste per modul.

---

## 2. Nåværende prismodell (kontrakter)

Kontraktene som er signert i dag bruker denne strukturen:

| Element | Verdi |
|---|---|
| Basispris | 995 NOK / mnd / workspace |
| Inkluderte ansatte | 10 |
| Pris per tilleggsbruker | 50 NOK / mnd |
| Mva | Eks. mva |
| Fakturering | Variabelt (definert i kontrakt) |
| Basis | Forskudd |
| Tilleggsbrukere | Etterskudd |
| Oppsigelsestid | 1 måned |
| Angrerett | 30 dager |

Onboarding faktureres separat (se eget dokument: `Smartout onboarding-nivåer.md`).

> Stripe er ikke koblet på ennå — fakturering skjer manuelt.

---

## 3. Hva vi kan ta betalt for

Tre prisbærere som kan kombineres:

| Prisbærer | Eksempel | Skaleringstype |
|---|---|---|
| **Workspace** | Selskapet / kunden | Flat pris per kunde |
| **Ansatt** | Antall aktive ansatte | Skalerer med kundens størrelse |
| **Funksjon** | AI, automasjon, rapporter | Skalerer med funksjonsbehov |

---

## 4. Fire grunnmodeller

| Modell | Slik fungerer det | Fordel | Ulempe |
|---|---|---|---|
| **Flat pris** | Én pris per workspace. Alt inkludert. | Enklest å selge og fakturere | Vanskelig å differensiere |
| **Modulbasert** | Kunden betaler for moduler de bruker | Fleksibelt, kunden vokser inn | Mer kompleks å kommunisere |
| **Forbruksbasert** | Per transaksjon (AI-kall, vakter, avvik) | Skalerer naturlig | Uforutsigbart for kunden |
| **Freemium** | Gratis grunnlag, betalt oppgradering | Lav terskel, høy adopsjon | Krever volum for å lønne seg |

> Modellene utelukker ikke hverandre — de kan kombineres.

---

## 5. Konkurranseutsetting som salgsverktøy

Kunder som allerede har et system (f.eks. Planday for vaktplan) kan tilbys modulspesifikke gratisperioder som matcher oppsigelsestiden hos eksisterende leverandør.

Eksempel: Kunden har Planday med 3 mnd oppsigelse. Smartout kan gi overlappende modul gratis i 3 mnd, og aktivere den til ordinær pris etterpå.

Se `Smartout konkurrentanalyse.md` for oversikt over konkurrenter per funksjonsområde.

---

## 6. Åpne spørsmål

Beslutninger arbeidsgruppen må ta:

1. **Prismodell** — Hvilken grunnmodell (eller kombinasjon) skal vi bruke?
2. **Prisbærer** — Workspace-flat, per ansatt, per modul, eller kombinasjon?
3. **Plannivåer** — Hvor mange planer, og hva inkluderes i hver?
4. **Inkluderte ansatte** — Beholde 10 inkludert, eller alt per bruker?
5. **Volumrabatt** — Synkende pris ved flere ansatte?
6. **Modulpakker** — Selge enkeltvis eller i bunter?
7. **Bransjepakker** — Ferdige oppsett for restaurant, hotell, retail?
8. **AI-kostnader** — Inkludert i plan, eller forbruksbasert?
9. **Onboarding** — Skal nivåene endres med ny prismodell? (se `Smartout onboarding-nivåer.md`)
10. **Migrasjon** — Hvordan flyttes eksisterende kunder til ny modell?

---

## 7. Vedlegg

- Org.nr.: 929 620 291 (Smartout AS)
- Stripe er planlagt men ikke koblet — fakturering er manuell
- Workspace-isolasjon via RLS er etablert
- Multi-tenant arkitektur støtter per-workspace og per-bruker
- Kontraktsvariablene i dag: `subscription_plan`, `subscription_price`, `included_users`, `extra_user_price`, `billing_interval`

---

**Relaterte dokumenter:**

- `Smartout features.md` — Komplett funksjonsoversikt (moduler + AI)
- `Smartout konkurrentanalyse.md` — Pris- og funksjonssammenligning med konkurrenter
- `Smartout onboarding-nivåer.md` — Definisjon av tre onboarding-pakker
