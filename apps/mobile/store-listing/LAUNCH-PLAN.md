---
title: Google Play Launch Plan — Smartout Mobile
status: in_progress
updated: 2026-03-29
created: 2026-03-29
module: mobile
tags: [launch, google-play, android]
---

# Google Play Launch Plan

## Status

| Fas                          | Status      | Blocker     |
| ---------------------------- | ----------- | ----------- |
| A. Build                     | DONE        | —           |
| B. Store listing content     | DONE        | —           |
| C. Account & credentials     | IN PROGRESS | Pontus      |
| D. Play Console setup        | NOT STARTED | Venter pa C |
| E. Closed testing (14 dagar) | NOT STARTED | Venter pa D |
| F. Production release        | NOT STARTED | Venter pa E |

---

## A. Android Build

- [x] EAS Build production profile konfigurert
- [x] .aab bygget og tilgjengelig
- [x] Alle build-feil fikset (.easignore, Metro stubs, node-linker)
- [x] Kontosletting implementert (Google Play-krav)

**Build artifact:** https://expo.dev/artifacts/eas/2M6XUnTrvsR9d1GjT9yfXY.aab
**Build ID:** 0e65489d-fa78-469c-9b9c-d894d2777586

---

## B. Store Listing Content

- [x] App-texter (NO + EN) — se `google-play-listing.md`
- [x] IARC content rating svar — se `google-play-listing.md`
- [x] Data safety deklarasjon — se `google-play-listing.md`
- [x] Permissions-motivering — se `google-play-listing.md`
- [ ] Feature graphic 1024x500 — `graphics/feature-graphic.png`
- [ ] Screenshots 1080x1920 x 6-8 — `screenshots/`
- [x] Privacy policy URL — https://smartout.ai/personvern

---

## C. Account & Credentials

### Google Play Developer Account

- [ ] Konto opprettet pa play.google.com/console
- [ ] Identitetsverifisering fullfort (1-3 dager)
- [ ] Utvikler-epost: \***\*\*\*\*\***\_\_\***\*\*\*\*\***

### Google Service Account (for EAS Submit)

1. [ ] Play Console → Setup → API access → Link Cloud-prosjekt
2. [ ] Cloud Console → Create Service Account → rolle: "Service Account User"
3. [ ] Play Console → gi kontoen "Release Manager"-tilgang
4. [ ] Cloud Console → Keys → Add Key → JSON → last ned
5. [ ] Plasser filen: `store-listing/credentials/google-service-account.json`
6. [ ] Kopier til: `apps/mobile/google-service-account.json`

---

## D. Play Console Setup

### Opprett appen

- [ ] Play Console → Create app
  - App name: **Smartout**
  - Default language: **Norwegian (nb-NO)**
  - App or game: **App**
  - Free or paid: **Free**

### Store listing

- [ ] App name, short description, full description (fra google-play-listing.md)
- [ ] App icon 512x512 (fra `assets/icon.png` — verifiser storrelse)
- [ ] Feature graphic 1024x500 (fra `graphics/`)
- [ ] Screenshots min 2, maks 8 (fra `screenshots/`)
- [ ] Contact details: support@smartout.ai, smartout.ai
- [ ] Privacy policy: https://smartout.ai/personvern

### Content rating

- [ ] Fyll ut IARC-skjema (svar i google-play-listing.md)

### Data safety

- [ ] Fyll ut alle kategorier (svar i google-play-listing.md)

### Target audience

- [ ] Alder: 18+
- [ ] Ingen barn-targeting

---

## E. Closed Testing

> Nye utviklerkontoer KREVER 14 dagers lukket testing med 12+ testere
> for a fa tilgang til production track.

- [ ] Opprett "Closed testing" track i Play Console
- [ ] Last opp .aab til internal/closed track
- [ ] Legg til 12+ tester-epostadresser
- [ ] Start 14-dagers countdown
- [ ] Dato startet: **\_\_**
- [ ] Dato ferdig: **\_\_**

### Testere (minimum 12)

| #   | Navn/Epost | Status |
| --- | ---------- | ------ |
| 1   |            |        |
| 2   |            |        |
| 3   |            |        |
| 4   |            |        |
| 5   |            |        |
| 6   |            |        |
| 7   |            |        |
| 8   |            |        |
| 9   |            |        |
| 10  |            |        |
| 11  |            |        |
| 12  |            |        |

---

## F. Production Release

- [ ] 14-dagers testing fullfort
- [ ] Production track tilgjengelig
- [ ] Promote fra closed → production
- [ ] Google review (1-3 dager)
- [ ] LIVE pa Google Play

---

## Filstruktur

```
apps/mobile/store-listing/
├── LAUNCH-PLAN.md           ← denne filen
├── google-play-listing.md   ← all tekst, IARC, data safety
├── .gitignore               ← blokkerer credentials/
├── credentials/             ← service account JSON (ALDRI commit)
├── graphics/                ← feature graphic, promo-bilder
└── screenshots/             ← 1080x1920 skjermbilder
```

---

## Logg

| Dato       | Hva                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| 2026-03-29 | Build lykkes etter 8 forsok. Fikset: .easignore, Metro node stubs, node-linker=hoisted, React 19.2.4 |
| 2026-03-29 | Kontosletting implementert (Edge Function + UI)                                                      |
| 2026-03-29 | Store listing content ferdig (NO + EN)                                                               |
| 2026-03-29 | Launch plan opprettet. Venter pa credentials fra Pontus                                              |
