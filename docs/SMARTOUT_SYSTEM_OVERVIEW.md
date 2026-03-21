---
title: "Smartout — Systemöversikt"
status: in_progress
updated: 2026-03-05
created: 2026-03-05
module: root
tags: [overview, system, concepts, readiness, operations, ai]
language: sv
note: "Swedish version. Norwegian version: smartout-systemguide.md"
---

# Smartout — Systemöversikt

> Ett samlat dokument för den som vill förstå vad Smartout är, hur det fungerar och varför det är byggt på det sätt det är.

---

## Vad är Smartout?

Smartout är ett operativt styrsystem för skiftbaserade verksamheter — restauranger, hotell, kaféer, butiker. Det är inte ett schemaläggningsprogram och det är inte ett HR-system. Det är plattformen som binder ihop allt som händer i en verksamhet varje dag: vem som jobbar, vad de ska göra, om de kan jobbet, hur verksamheten presterar ekonomiskt — och vem som ansvarar för vad när dagen är slut.

Kärnan i systemet är en enda fråga: **är personalen redo?**

Redo att öppna köket. Redo att ta emot gästerna. Redo att hantera en matsäkerhetsavvikelse. Redo för en ny säsong. Det är det Smartout mäter, driver och rapporterar tillbaka.

Mr. Botsson — systemets AI-kollega — är inte ett tillägg ovanpå plattformen. Det är rösten och intelligensen i varje del av den.

---

## Systemets byggstenar

Smartout är organiserat i ett antal kärnkoncept som hänger tätt samman. De kan läsas separat, men förstås bäst i relation till varandra.

---

### 1. Organisationsstruktur — scenen innan allt börjar

Innan ett enda schema kan läggas eller en enda uppgift skapas måste verksamheten vara kartlagd.

Smartout modellerar en organisation i flera lager:

- **Avdelningar** (Kitchen, Service, Bar) — de operativa enheterna
- **Lokaler och zoner** — de fysiska utrymmena: kök, sal, bardisk, frysutrymme
- **Team** — dynamiska grupper inom en avdelning, ofta säsongsbaserade
- **Positioner** — roller som Servitör, Kock, Bartender — inte personer, utan arbetsuppgifter
- **Tillgångar (Assets)** — frysboxen, kaffemaskinen, kylen vid dish — saker som kräver kontroll

Det handlar inte om ett organisationsschema i traditionell mening. Det handlar om att ge systemet en precis karta över verksamheten så att allt som följer — schema, uppgifter, utbildning, HACCP, ekonomi — kan kopplas till rätt plats, rätt tid och rätt person.

---

### 2. Säsong — planeringens fundament

En säsong är den operativa tidsperiod verksamheten planerar kring. Det kan vara sommarsäsong, vintersäsong, julperiod eller ett helt kalenderår. Säsongen är ramen allt annat hänger på.

När en säsong skapas definieras tre dimensioner:

**Operativt:** Vilka team är aktiva? Vilka policyer gäller? Vilka menyval är tillgängliga?

**Ekonomiskt (budgetmotorn):** Vad är omsättningsmålet för hela perioden? Det bryts sedan ned automatiskt:

- Dagsfaktorer — hur stor andel av veckoomsättningen hamnar på lördag kontra måndag?
- Timmefaktorer — hur ser en typisk middagsservice ut timme för timme?

Från dessa tre ingångsvärden (totalmål, dagsprofil, timprofil) genererar systemet ett fullständigt intäktsmål per timme under hela säsongen — vilket direkt driver bemanningsbehovet. Bemanningstalet är inte en gissning. Det är ett mål.

**Spelifiering:** Säsongen har egna poängregler och leaderboards. Medarbetare samlar poäng under perioden för utfört arbete, kompetens och närvaro.

Säsongen avslutas med en stängning — och historiken lever kvar för jämförelse och lärande.

---

### 3. Schemaläggning — vem, vad och när

Schemaläggning i Smartout sker i ett rutnät: medarbetare vertikalt, dagar horisontalt. Varje cell är ett skift.

Men ett skift är mer än en tid. Det är en **arbetspaket** med:

- Vem som jobbar (person och roll)
- Vilka uppgifter som hör till skiftet
- Vilken zon/position medarbetaren täcker
- Kopplade procedurer och rutiner

Schemat känner till frånvaro, öppna skift och kostnad per dag. Det är ett beslutsunderlag, inte bara en kalender.

**Anciennitetsstyring — senioritetshantering:**
Lönetillägg, övertidsregler och avspasering styrs av arbetsrätten (Arbeidsmiljøloven) och kollektivavtal. Smartout beräknar automatiskt timlön, kväll- och nattillägg, helgtillägg och övertid baserat på varje medarbetares anställningsform, avtalade timmar och faktiska arbetstid. Ingångsvärdet är skiftet. Utgångsvärdet är lönegrundlaget.

---

### 4. Operationer & Daglig styrning — varje dag som en enhet

Det finns ett koncept i Smartout som är viktigare än alla andra att förstå: **Avdelningssessionen**.

Varje dag, för varje aktiv avdelning, skapar systemet automatiskt en session. Den är avdelningens "dag" som en hanterad enhet — en container för allt som händer från öppning till stängning.

Sessionen lever ett eget liv:

```
Kommande → Aktiv → Inväntar signering → Stängd
```

Inne i sessionen finns:

- **Skiften** som bemannar dagen
- **Hooks** — tidstriggers som automatiskt aktiverar procedurer vid specifika tidpunkter (PRE_OPEN, OPEN, MIDDAG, PRE_CLOSE, CLOSE)
- **Uppgiftstavlan** — alla uppgifter för denna dag, oavsett om de kommer från ett skift, en rutin, en hook eller skapas ad-hoc av en chef under dagen
- **Sign-off** — när dagen är slut signerar ansvarig chef sessionen. Ofullständiga uppgifter kräver en kommentar. Handoff-noteringar skrivs till nästa session.

En session kan inte försvinna. Den kan inte manipuleras i efterhand. Den är ett revisionsspår.

---

### 4.1 Hur allt hänger ihop — Roadmap-modellen

Det som gör Smartout sammanhängande är att varje arbetsflöde — ett skift, en onboarding, en HACCP-kontroll, en daglig stängning — följer samma underliggande mönster:

```
START-HOOK  →  [händelse → händelse → händelse]  →  STOP-HOOK
```

Vi kallar detta en **Roadmap**. Den definierar vad som ska ske, i vilken ordning, med vilka krav. Det är blueprinten.

När en Roadmap körs i verkligheten kallas det en **Journey** — det är live-instansen, den som en medarbetare faktiskt genomgår, guidad av Botsson. Och när en ledare tittar på hur det går kallas det ett **Protocol** — samma data, men sett ur ett övervaknings- och kontrollperspektiv.

| Perspektiv       | Namn     | Vad man ser                                 |
| ---------------- | -------- | ------------------------------------------- |
| **Definitionen** | Roadmap  | Blueprinten — steg, triggers, krav          |
| **Upplevelsen**  | Journey  | Live-instansen, guidad av Botsson           |
| **Översikten**   | Protocol | Ledarens vy — status, beredskap, avvikelser |

Det som aktiverar en Roadmap är en **hook** — en tidpunkt eller händelse som triggar starten. Session öppnar. Skift börjar. Ny medarbetare onboardas. Säsong aktiveras. Varje hook kan kopplas till procedurer, rutiner och kontrollpunkter — och allt som sker däremellan loggas som händelser med tidsstämpel, person och resultat.

---

### 5. Avstämning — den digitala handoffen

Smartout bygger på en idé om att varje dag måste stängas ordentligt. Inte bara operativt — utan som ett gemensamt ansvar mellan personal och ledning. Det sker genom tre nivåer av avstämning, där varje nivå bygger på den föregående.

**Daglig avstämning — personalens ansvarsmoment**

När en dag är slut gör personalen sin dagliga handoff. Det är en strukturerad kontrollpunkt där man går igenom vad som är gjort och vad som inte är gjort. Vad som ska följas upp. Avvikelser som har uppstått. Och den data som systemet behöver för att förstå hur dagen gick — omsättning, iZettle-underlag, kassaunderlag och eventuella övriga noteringar.

Det är inte ett formulär. Det är en digital handoff som ersätter post-it-lappen på kylskåpet, det muntliga samtalet i korridoren och Excel-arket som ingen hittar imorgon.

Vad som ska ingå i varje daglig avstämning är konfigurerbart — verksamheten definierar själv vilka kontrollpunkter som är relevanta.

**Administratörens dagavstämning — morgondagens kontrollpunkt**

Dagen efter öppnar admin sin dagavstämning. Här bekräftar man att:

- Alla avvikelser är hanterade
- Inkomna anmälningar och notifieringar är uppföljda
- Omsättningen för dagen är registrerad och bekräftad

Det är inte en granskning — det är ett formellt godkännande. Dagen är inte stängd förrän admin har kvitterat. Systemet markerar dagen som verifierad och låser den.

**Vecko- och månadsöversikt — data som ackumuleras**

Eftersom varje dag registrerar sin omsättning och sina kontrollpunkter byggs vecko- och månadsoversikter automatiskt upp. Ingen manuell sammanställning. Ingen extrapolering. Siffrorna finns — för att de registrerades rätt, varje dag.

Avstämningssystemet är en statisk kontrollpunkt. Det måste genomföras för att systemet ska ha den data det behöver. Det tvingar fram en rytm av ansvar — inte som en kontroll uppifrån, utan som en daglig vana inbyggd i arbetsflödet.

---

### 6. Beredskap (Readiness) — det centrala produktmåttet

Beredskap är det enskilt viktigaste begreppet i Smartout.

En medarbetare är **beredd** när den har slutfört alla protokoll som tilldelats utifrån deras roll, avdelning och team. Inte nästan klart. Klart.

```
Beredskapspoäng = (avklarade protokoll / tilldelade protokoll) × 100%
```

Styrmodellen ser ut så här:

- **Policy** — ett regelverk (t.ex. Livsmedelssäkerhet, Brandskydd)
- **Protokoll** — det som en anställd måste genomgå för att uppfylla policyn
- **Procedur** — steg-för-steg-instruktioner att lära sig och genomföra
- **Kunskapstest** — quiz för att verifiera förståelse
- **Bekräftelse** — digital signatur: "Jag har läst och förstått detta"

När en medarbetare börjar i ett team tilldelas de automatiskt rätt policyer → rätt protokoll → rätt utbildningsinnehåll. Systemet driver dem genom beredskapsprocessen. En chef kan alltid se exakt var varje person befinner sig.

100% beredd = grön. Under 100% = i process. En traineé som jobbar sitt första skift utan att vara beredd = en risk.

---

### 7. HACCP & Livsmedelssäkerhet — compliance som en del av driften

HACCP i Smartout är inte ett separat system. Det är styrmodellen (Policy → Protokoll → Procedur → Rutin) tillämpad på livsmedelssäkerhet.

Temperaturloggning sker via en session hook som triggas vid en specifik tidpunkt och skapar en uppgift. Medarbetaren fyller i temperaturen. Avvikelse flaggas. Eskalering sker automatiskt enligt en Runbook. Korrektiva åtgärder dokumenteras.

Allt är tidsstämplat. Allt är spårbart. Allt är redo för Mattilsynet.

---

### 8. Mr. Botsson — AI-kollegiet

Mr. Botsson är inte en chatbot. Det är ett konversationslager ovanpå hela plattformen, med en tydlig personlighet och minne.

**Tre agentpersonligheter:**

- **Botsson** — driver onboarding-intervjun när en ny arbetsplats konfigureras. Pratar med admin, ställer frågor, fyller i fält, sätter upp avdelningar. Agenten leder.
- **Mr. Botsson** — den dagliga dashboardassistenten. Hjälper med schema, utbildning, operationer och HACCP. Användaren leder.
- **Specialagenter** — HACCP-inspektören, vaktassistenten — kontextspecifika röster för specifika arbetsflöden.

**Hur det fungerar:**
Botsson har ett trelagerssystem:

1. _Missionslager_ — vem är Botsson, vilket språk, vilken röst
2. _Kontextlager_ — vem pratar han med, deras roll, historik, relation
3. _Stagelager_ — vad är uppdraget just nu, vad ska uppnås

Botsson minns. Han har ett vektorminne (pgvector) per arbetsplats, per person. Han anpassar ton och personlighet efter roll, relation och situation. En ny trainee får en annan Botsson än en erfaren manager.

Han är inte ett verktyg du väljer att använda. Han är kollegan som alltid finns där.

---

## Helheten — plan → utför → mät → lär

Det som gör Smartout sammanhängande är att alla dessa delar hänger ihop i ett naturligt flöde:

```
Säsong skapas          → Mål, team, policyer, budget
  ↓
Schema läggs           → Rätt person, rätt tid, rätt roll
  ↓
Dag öppnar             → Avdelningssession aktiveras
  ↓
Skift pågår            → Uppgifter, hooks, HACCP, Botsson
  ↓
Dag stänger            → Signering, dagavstämning, lås
  ↓
Säsong stänger         → KPI, rapporter, lärande, nästa säsong
```

Personal är inte en kostnad att minimera. De är en kapacitet att optimera. Smartout gör det mätbart — från det ögonblick en medarbetare skriver på kontraktet tills den sista kvällen av säsongen är stämplad och låst.

---

## Teknisk not (för den nyfikne)

Smartout är byggt på:

- **Next.js / React** — web dashboard
- **Supabase** — databas, autentisering, Edge Functions
- **PostgreSQL med Row Level Security** — all data är workspace-isolerad
- **Ultravox** — realtidsröst för Botsson
- **Stripe** — prenumerationshantering

Det är en modern SaaS-plattform med starka dataisoleringsgarantier. Varje arbetsplats ser bara sin egen data. Alltid.
