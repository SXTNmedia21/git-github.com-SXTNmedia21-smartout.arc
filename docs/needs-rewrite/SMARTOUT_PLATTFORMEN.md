---
title: "Smartout — Plattformen som driver restaurangen"
status: in_progress
updated: 2026-03-05
created: 2026-03-05
module: root
tags: [overview, concept, readiness, event-motor, gamification, menu, operations]
---

# Smartout — Plattformen som driver restaurangen

> För restaurangägaren som vill förstå vad Smartout faktiskt är, varför det är byggt som det är, och hur det gör att systemet tickar och går av sig självt.

---

## Den enkla sanningen

En restaurant är inte svår att driva. Det är svårt att driva den **konsekvent**.

Samma öppningsrutin varje dag. Samma temperaturkontroll klockan 11. Samma stängningssignering. Samma onboarding när en ny sommarjobbare börjar. Samma dagliga handoff när chefen lämnar och nattpersonalen tar vid.

Problemet är inte att folk inte vet vad de ska göra. Problemet är att det inte finns ett system som _säkerställer_ att det faktiskt blir gjort — och som minns det, dokumenterar det och rapporterar tillbaka.

Det är det Smartout är. Inte ett schemaläggningsprogram. Inte ett HR-system. En plattform där du en gång definierar hur din verksamhet ska fungera — och sedan ser till att den gör det, dag efter dag, oavsett vem som jobbar.

---

## Allt börjar med en Roadmap

Det viktigaste konceptet att förstå i Smartout är det vi kallar **Event Motor** — och grundprincipen är enkel:

> Allt i Smartout är en process med en start, ett antal händelser, och ett slut.

Vi kallar detta en **Roadmap**. Det kan vara ett skift. En onboarding. En öppningsrutin. En HACCP-kontroll. En säsong. En daglig stängning.

```
START-HOOK  →  [händelse → händelse → händelse]  →  STOP-HOOK
```

**Start-hook** är det ögonblick något börjar. En medarbetare klockar in. En ny dag aktiveras. En trainee öppnar onboardingsidan.

**Händelser** är allt som sker däremellan. Steg avklarade. Data sparad. Test godkänt. Avvikelse flaggad. Poäng intjänade.

**Stop-hook** är det ögonblick något avslutas. Skiftet stämplas ut. Sessionen signeras. Säsongen arkiveras.

### Start- och stop-hooks — vad finns och vad kan du skapa?

Smartout levereras med en uppsättning inbyggda triggers som täcker de vanligaste scenarierna:

| Hook                | När den utlöses                           |
| ------------------- | ----------------------------------------- |
| `session.open`      | Avdelningssessionens starttid nås         |
| `session.pre_close` | X minuter innan sessionen stänger         |
| `session.close`     | Sessionens sluttid                        |
| `shift.start`       | En medarbetare börjar sitt skift          |
| `shift.end`         | En medarbetare avslutar sitt skift        |
| `season.play`       | Säsongen aktiveras                        |
| `onboarding.start`  | En ny medarbetare öppnar onboardingflödet |

Men du kan också skapa egna hooks och definiera exakt när de ska trigga — till exempel "klockan 11:00 på vardagar" eller "2 timmar före stängning på lördagar." Du kopplar sedan en hook till en eller flera procedurer, rutiner eller kontrollpunkter.

### Tre perspektiv på samma sak

En Roadmap ser olika ut beroende på vem som tittar:

| Perspektiv       | Namn     | Vad man ser                                                 |
| ---------------- | -------- | ----------------------------------------------------------- |
| **Definitionen** | Roadmap  | Blueprinten — steg, triggers, krav                          |
| **Upplevelsen**  | Journey  | "Jag gör det här nu" — live-instansen som guidas av Botsson |
| **Översikten**   | Protocol | "Hur går det?" — ledaren ser status, avvikelser, beredskap  |

Du bygger Roadmaps en gång. Systemet kör dem sedan varje dag.

---

## Organisationen som karta

Innan ett enda schema läggs eller en enda rutin skapas måste systemet känna till din verksamhet.

Smartout modellerar din organisation i lager:

- **Avdelningar** (Kök, Sal, Bar) — de operativa enheterna
- **Lokaler och zoner** — de fysiska utrymmena: kylrum, bardisk, frysutrymme
- **Team** — grupper inom en avdelning, ofta säsongsbaserade
- **Positioner** — roller som Servitör, Kock, Bartender — inte personer, utan funktioner
- **Tillgångar** — frysboxen, kaffemaskinen, kylen vid disk — saker som kräver kontroll

Det är inte ett organisationsschema. Det är kartan som gör att en hook vet var den ska trigga, att en uppgift vet vem den tillhör, och att ett temperaturlarm vet vilken tillgång det gäller.

---

## Säsongen — ramen allt hänger på

En säsong är den operativa period du planerar kring. Sommarsäsong. Vintersäsong. Julperiod. Eller ett helt kalenderår.

När du skapar en säsong definierar du tre dimensioner:

**Operativt:** Vilka team är aktiva? Vilka policyer gäller? Vilken meny kör vi?

**Ekonomiskt — budgetmotorn:**
Du anger ett omsättningsmål för hela perioden. Systemet bryter automatiskt ned det:

- **Dagsfaktorer** — hur stor andel av veckoomsättningen hamnar på lördag kontra måndag?
- **Timmefaktorer** — hur ser en typisk middagsservice ut timme för timme?

Från dessa tre ingångsvärden genereras ett fullständigt intäktsmål per timme under hela säsongen. Det driver direkt hur många personer du behöver — och när.

**Spelifiering:** Mer om det längre ned.

Säsongen är startskottet. Trycker du PLAY aktiveras allting — avdelningssessioner börjar skapas dagligen, leaderboards startar, och systemet börjar mäta.

---

## Menyhantering — mer än recept

De flesta system lagrar recept. Smartout bygger en **produktionsmotor**.

Det handlar inte om att ha en receptdatabas. Det handlar om att besvara den fråga köket ställer varje dag: _Vad behöver vi preparera? Hur mycket? Vem gör det? När?_

### Produkten — fyra dimensioner

I Smartout definieras varje rätt som ett objekt med fyra dimensioner:

| Dimension    | Vad det innebär                                          |
| ------------ | -------------------------------------------------------- |
| **Mängd**    | Ingredienser, enheter, svinn, yield                      |
| **Kostnad**  | Råvarukostnad per portion, per batch, per säsong         |
| **Tid**      | Prepareringstid, tillagningstid, tid per station         |
| **Funktion** | Vilken station, vilken utrustning, vilken fas i servicen |

**Tid och funktion är det som gör skillnaden.**

En rätt innehåller inte bara "200g kycklingfilé." Den innehåller "200g kycklingfilé, 45 minuters sous vide på station 2, följt av 3 minuters grill på station 3, redo klockan 17:30."

Det gör att systemet kan:

- Koordinera köksprocessen automatiskt
- Beräkna total prepareringstid per dag utifrån förväntad gästvolym
- Fördela arbetsbelastning mellan stationer
- Generera preplistor baserade på säsongens timmefaktorer
- Koppla HACCP-kontroller direkt till metoder som kräver dem (temperaturer, hygienkrav)

### Lagermodellen

Ingrediens → Metod → Recept → Rätt → Meny → Produktionsplan

Varje lager är oberoende och återanvändbart. En metod (sous vide 62°C i 45 min) definieras en gång och används i hundra rätter. Ändras metoden, uppdateras alla rätter som använder den.

---

## Operationer — varje dag som en hanterad enhet

Varje dag, för varje aktiv avdelning, skapar systemet automatiskt en **Avdelningssession**. Det är avdelningens dag som en hanterad enhet — en container för allt som händer från öppning till stängning.

```
Kommande → Aktiv → Inväntar signering → Stängd
```

Inne i en session finns:

- **Skiften** som bemannar dagen
- **Hooks** — automatiska triggers som aktiverar procedurer vid exakta tidpunkter
- **Uppgiftstavlan** — allt som ska göras denna dag, oavsett om det kom från ett skift, en rutin, en hook eller skapades ad-hoc av en chef
- **Sign-off** — dagen stängs inte förrän ansvarig chef har signerat, ofullständiga uppgifter kommenterats och handoff-noteringar skrivits till nästa session

En session kan inte försvinna. Den kan inte manipuleras i efterhand. Den är ett revisionsspår.

---

## Avstämning — den digitala handoffen

Varje dag måste stängas ordentligt. Det sker i tre lager:

**Daglig avstämning — personalens handoff**

När dagen är slut gör personalen en strukturerad handoff. Vad är gjort. Vad är inte gjort. Avvikelser. Och den data systemet behöver — omsättning, iZettle-underlag, kassaunderlag. Det ersätter post-it-lappen på kylskåpet, det muntliga samtalet i korridoren och Excel-arket som ingen hittar imorgon.

Vad som ingår i varje daglig avstämning är konfigurerbart per verksamhet.

**Administratörens dagavstämning**

Dagen efter öppnar admin sin dagavstämning. Bekräftar att avvikelser är hanterade, notifieringar uppföljda, omsättningen verifierad. Dagen låses formellt.

**Vecko- och månadsöversikt**

Eftersom varje dag registrerar sin data ackumuleras vecko- och månadsöversikter automatiskt. Inga manuella sammanställningar.

---

## Styrmodellen — hur du bygger regler som håller

Beredskap är det centrala produktmåttet i Smartout. En medarbetare är **beredd** när den har slutfört alla protokoll som tilldelats utifrån sin roll, avdelning och team.

```
Beredskapspoäng = (avklarade protokoll / tilldelade protokoll) × 100%
```

Styrmodellen bygger på en kedja:

**Policy** — "Det här måste hända." Regelverket. Livsmedelssäkerhet, brandskydd, alkoholtillstånd.

**Protokoll** — "Så här uppfyller vi det." En policy → ett protokoll → ett utbildningspaket.

**Procedur** — Steg-för-steg-instruktioner. Det som medarbetaren lär sig och sedan utför.

**Rutin** — Det som gör att proceduren faktiskt körs. En rutin är en schemalagd exekvering kopplad till en hook. "Temperaturkontroll ska köras var 4:e timme" — det är en rutin.

**Runbook** — Det som aktiveras när något går fel. En avvikelse flaggas → Runbooken triggar → eskaleringskedja aktiveras → ledaren informeras.

**Kontrollista** — Verifieringen efteråt. "Gjordes proceduren?" Aldrig fristående — alltid kopplad till en Rutin eller Runbook.

**Kunskapstest & Bekräftelse** — Medarbetaren visar att den förstår, och signerar digitalt att den tagit del.

När en medarbetare börjar i ett team tilldelas de automatiskt rätt policyer → rätt protokoll → rätt innehåll. Systemet driver dem. 100% klart = beredd.

---

## HACCP — inbyggt i driften

HACCP-compliance är inte ett separat system i Smartout. Det är styrmodellen tillämpad på livsmedelssäkerhet.

Temperaturloggning är en rutin kopplad till en session hook som triggar klockan 11, 15 och 19. Avvikelse flaggas automatiskt. Runbooken aktiveras. Eskalering sker. Korrektiva åtgärder dokumenteras.

Allt är tidsstämplat. Allt är spårbart. Allt är redo för Mattilsynet.

---

## Spelifiering — att göra jobbet värt att vinna

Det är här Smartout gör något som inget annat system gör.

Varje Roadmap — varje procedur, varje skift, varje protokoll — kan kopplas till ett poängsystem. Du definierar reglerna: vad ger poäng, hur mycket, under vilken säsong.

**Poäng intjänas när:**

- Uppgifter slutförs i tid
- Procedurer genomförs utan avvikelser
- Protokoll avslutas (beredskapspoäng)
- Medarbetaren är punktlig
- Skift fylls i frivilligt

**Leaderboards** är säsongsbaserade och synliga för medarbetarna. Team mot team. Avdelning mot avdelning. Individ mot individ.

Det handlar inte om att kontrollera personal. Det handlar om att göra det bra jobbet synligt — och ge folk ett sätt att se sin egen utveckling.

Spelifiering aktiveras när du trycker PLAY på en säsong. Den stängs av när säsongen arkiveras. Nästa säsong börjar på noll.

---

## Mr. Botsson — kollegan som alltid finns där

Botsson är inte en chatbot. Det är rösten och intelligensen i hela plattformen.

Han har tre roller:

**Botsson (onboarding)** — Sätter upp din arbetsplats genom ett samtal. Ställer frågor, föreslår avdelningar, fyller i fält, skapar strukturen. Agenten leder.

**Mr. Botsson (daglig drift)** — Dashboardassistenten. Hjälper med schema, utbildning, HACCP, avvikelser. Användaren leder.

**Specialagenter** — HACCP-inspektören, vaktassistenten — kontextspecifika röster för specifika arbetsflöden.

Botsson minns. Han har ett minne per arbetsplats, per person. En ny trainee får en annan Botsson än en erfaren manager. Han anpassar sig efter vem han pratar med och vad de behöver.

---

## Helheten — sätt det upp, se det rulla

```
Du konfigurerar:
  Organisationsstruktur      → avdelningar, zoner, tillgångar
  Säsong                     → mål, team, budget, faktorer
  Styrmodellen               → policyer, protokoll, procedurer, rutiner
  Menyn                      → ingredienser, metoder, rätter, produktionslogik
  Spelifiering               → poängregler, leaderboard-konfiguration

Systemet kör:
  Dagliga sessioner          → skapar sig automatiskt, öppnar, stänger
  Hooks triggar              → procedurer och rutiner exekveras vid rätt tidpunkt
  Medarbetare guidar         → Botsson finns vid varje steg
  Avvikelser hanteras        → Runbooks aktiveras, eskalering sker
  Dagen stängs               → handoff, dagavstämning, lås
  Poäng räknas               → leaderboard uppdateras i realtid
  Säsongen arkiveras         → KPI, analys, underlag för nästa säsong
```

Från det ögonblick en medarbetare skriver på kontraktet till den sista kvällen av säsongen är stämplad och låst — systemet minns allt, rapporterar allt, och ser till att ingenting faller igenom sprickorna.

Din roll är inte att köra maskinen. Din roll är att styra den.
