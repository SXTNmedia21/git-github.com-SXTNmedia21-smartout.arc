---
title: "Smartout Modern Dark"
status: draft
updated: 2026-04-10
created: 2026-03-01
module: design
tags: []
---

# Designprofil: Smartout Modern Dark (Onboarding & Dashboard)

Detta dokument sammanfattar designprofilen och utseendet från applikationens centrala delar (ex. "Sesongplanlegging" och Dashboardshell). Syftet med detta dokument är att säkra designkonsensus och kunna återanvända samma estetik i framtida komponenter.

## 1. Sammanfattning av "Viben"

- **Känsla:** Editorial, lugn, modern, premium, luftig och mjuk.
- **Ljus/Mörker:** Hög kontrast i mörkt läge (dark mode), men mjukt ljussatt genom ambienta glödeffekter ("glowing orbs") som ger gränssnittet liv.
- **Syfte:** Att bryta mot "tråkig B2B-mjukvara" genom att ge administratörer och chefer en redaktionell, nästan magasinskänsla när de arbetar i systemet.

## 2. Färger & Kontrast (Color System)

- **Bakgrunder:**
  - _Dark Mode:_ Extremt mörkt grått, nära rent svart (`bg-zinc-950` för huvudytor, `#0c0c0e` eller `#0a0a0c` för sidomenyer).
  - _Light Mode:_ Byggs med `oklch`-värden för att få en subtil, varm gräddton (t.ex. `bg-[oklch(0.965_0.003_55)]`) snarare än platt, död vit.
- **Avdelare (Borders):** Ytterst subtila. I dark mode används färger som `border-white/[0.04]`, `border-white/[0.08]` eller `border-zinc-800`. Detta gör att gränssnittet upplevs sammanhängande och svävande snarare än instängt i rutor.
- **Text & Transparens:** Ren vit (`text-white`) används strikt för stora huvudrubriker. Brödtext och labels tvättas ut i transparens (t.ex. `text-white/40`, `text-white/25`) för att ge visuell hierarki utan att tävla om uppmärksamhet.
- **Accent & Brand:** En varm orange/amber (`orange-500`) utgör primär accentfärg. Används för aktiva statusar, selection-bakgrund (`selection:bg-orange-500/30`), och action-knappar (ibland med en gradient till rose: `from-orange-600 to-rose-600`).

## 3. Typografi (Typography)

- **Display / Huvudrubriker (Serif):** Använder systemets `font-heading` (ofta en stilig serif som _Instrument Serif_). Formateras massivt för att ge ett editorial uttryck:
  - Exempel: `text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight`. Detta ger en extremt tight, stor och självsäker rubrik (t.ex. "Din första sesong.").
- **Gränssnitt / Brödtext (Sans-serif):** Mycket ren och funktionell (ex. _Geist Sans_). Snabb, lättläst och anpassad för datatunga vyer.
- **Metadata / Kategorier:** Använder små versaler med kraftig spärrning (`text-[10px] font-bold tracking-widest uppercase`). Skapar utmärkt och "tyst" struktur för etiketter och sidopanelssektioner (t.ex. "SESONG", "LEDELSE").

## 4. Former & Geometri (Shapes)

- **Rundade element (Radius):** Mycket runda, vänliga och organiska former.
  - Stora inmatningsfält och primära knappar har ofta `rounded-2xl` eller `rounded-xl`.
  - Ingen brutal fyrkantighet, med undantag från "split-screens" som delar skärmens fulla yta.
- **Inputs & Kontroller:** Stora och luftiga. Exempelvis textfält: `px-6 py-5 text-xl bg-white/[0.05] border-white/[0.08]`. De känns mjuka, inbjudande och taktila att klicka i.

## 5. Layout & Luft (Space & Grid)

- **Extrem padding:** "White space" behandlas som ett av de viktigaste designelementen. Mycket generös padding används (t.ex. `px-10 py-20 lg:px-16` i onboarding).
- **Split-Layout:** Vyer delas ofta vertikalt, exempelvis 38% utrymme till vänster för redaktionell rubrik/kontext och 62% till höger för själva formuläret/innehållet.
- **Scrollbars:** Nästan osynliga. En transparent "overlay scroll" används, som bara visar thumben när man hovrar, vilket bevarar den rena estetiken utan att innehållet hoppar.

## 6. Rörelse & Animationer (Motion & Interaction)

- **Ambient Glow / Drifting:** I bakgrunden av stora vyer används CSS-keyframes (`ambient-drift-1`, `onboarding-drift-x`) som rör oklch-glödande former långsamt över skärmen. Detta skapar en "andande" upplevelse som känns lugnande och dynamisk på samma gång.
- **Mjuka entréer:** Allt innehåll tonar in mjukt och glider på plats (ex. Framer Motion med `opacity: 0, y: 20` -> `opacity: 1, y: 0` och en custom easing-kurva `[0.16, 1, 0.3, 1]` med en duration på `0.8` sekunder). Inget "poppar in" brutalt.
- **Hover States:** Subtila färgändringar (t.ex. `hover:bg-zinc-900/50`) kombinerat med svaga drop-shadows med färg (t.ex. `shadow-[0_0_10px_rgba(234,88,12,0.8)]` på små badges) ger taktil feedback.

## Teknisk Stack & Implementering

- **Tailwind v4:** Inga config-filer; design-tokens ligger direkt inuti CSS via `@theme inline` (ex. `oklch()`, variblar).
- **Färgmodell:** `oklch` används tungt för att hantera ljus-/färgresor mellan moduler utan att blöda över i oönskade gråtoner, vilket garanterar korrekta och vackra färgövergångar.
