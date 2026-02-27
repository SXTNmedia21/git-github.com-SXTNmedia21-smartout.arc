# SMARTOUT — Full Dokumentasjonsindex

> **Formål:** Komplett index for å dokumentere hele Smartout-appen.
> Hver modul inneholder underkategorier som skal fylles ut for migrering.
> Brukes som rammeverk — fyll ut én seksjon om gangen.
>
> **Oppdatert:** February 24, 2026
> **Endringer:** Rolle-/tilgangsmodell oppdatert til Core Architecture v2. Modul 1 oppdatert. Job → Position rename. Modul 4 oppdatert til Operations & Task Management.

---

## 0. FUNDAMENT

### 0.1 Produktidentitet

- Hva er Smartout (Employee Readiness System)
- Målgruppe og personas
- Verdiforslag og kjerneproblem (75% turnover)
- Prismodell og planer

### 0.2 Arkitektur & Teknisk Stack

- System-oversikt (Next.js, React Native, Supabase, n8n, Vercel, DigitalOcean)
- Multi-tenant modell (workspace-isolasjon via RLS)
- API-struktur og Edge Functions
- Autentisering (Supabase Auth: email, magic link, SMS OTP)
- Miljøer (prod, staging, dev)

### 0.3 Datamodell (Global)

- Komplett ER-diagram
- 11 Core Types (User, CompanyMember, Company, Workspace, Profile, Department, Location, Team, Policy, Season, Protocol)
- Governance Model (Protocol → Procedure, Routine, Runbook, ControlList, KnowledgeTest, Confirmation)
- Extension Types (Zone, Asset, Position)
- Option Sets (alle enums)
- Primærnøkler (UUIDs) og fremmednøkler
- Indekser og constraints

### 0.4 Rolle- og Tilgangsmodell

- **Roller:** Employee → Manager → Admin → Owner
- **Statuser:** trainee → active → inactive → offboarding
- **Leader:** Teamattributt (team.leader_profile_id), ikke en rolle
- **Access:** Role × Team × Season × Module × Status
- Tilgangsmatrise per rolle
- Workspace-scoping
- RLS-regler (Row Level Security)
- Custom permissions via Policy (policy_type: "access")

### 0.5 Designsystem

- Tailwind CSS + shadcn/ui
- Fargepalett og typografi
- Komponentbibliotek (knapper, kort, modaler, inputs)
- Responsive breakpoints (desktop og mobil likestilt)
- Ikon- og bildebruk
- Navigasjonsmønster

---

## 1. ONBOARDING & BRUKERREGISTRERING

> **Dokument:** SMARTOUT_MODULE_1_ONBOARDING.md

### 1.1 Workspace-opprettelse (First Run)

- Admin signup flow (email/SSO)
- Opprett Company og første Workspace
- Workspace setup wizard (avdelinger, lokasjoner, stillinger, moduler)
- Stripe abonnement (trial)

### 1.2 Invitasjonsflyt

- Invitasjonsmetoder (e-post/SMS/lenke/bulk CSV)
- Invitasjonsdata (navn, avdeling, stilling, rolle, team)
- Aksepteringsflyt (ny bruker vs. eksisterende)
- Auto-opprettelse: User + Profile (trainee) + CompanyMember
- Invitasjonshåndtering (resend, cancel, expire, track)

### 1.3 Trainee Mode

- Tre-system arkitektur: Trainee Mode + Module Journeys + Protocol Training
- Core Journey (Smartout grunnleggende)
- Module Journeys (per installert modul, AI-rekkefølge)
- Admin/Leader godkjenningsgate
- Hard deadline: første vakt
- 48-timers eskalering
- Sandbox-regler (blandet: punch sandbox, chat real)
- Trainee synlighet i vaktplan (badge)
- Trainee gamification (poeng overføres til aktiv sesong)

### 1.4 Profil-oppsett

- Personlig informasjon
- Kontaktinformasjon
- Nødkontakt (navn, telefon, relasjon)
- Profilbilde
- Språkpreferanser (preferred_language)
- Varslingsinnstillinger

### 1.5 AI-veiledet Onboarding (Mr. Botsson)

- Chat-first, stemme som oppgradering
- 6 UI-verktøy (navigate, highlight, tooltip, spotlight, autofill, celebrate)
- 6 operasjonelle verktøy (progress, checkpoint, suggest, sandbox, complete, escalate)
- Profilspesifikk tilpasning (stilling, erfaring, læringshastighet, språk)
- Adaptiv dybde for aktive ansatte ved nye moduler

### 1.6 Løpende Readiness

- Cross-training (avdelingsbytte: ingen trainee mode, kun nye protocols)
- Sesongendringer (AI proaktiv veiledning for nye rutiner)
- Policy-oppdateringer (delta-onboarding)

---

## 2. ORGANISASJONSSTRUKTUR

> **Dokument:** SMARTOUT_MODULE_2_ORG_STRUCTURE.md

### 2.1 Workspace

- Workspace-innstillinger
- Firmalogo og branding
- Standardverdier og konfigurasjoner
- Abonnement og fakturering

### 2.2 Lokasjoner (Locations)

- Opprett/rediger lokasjon
- Adresse, GPS-koordinater, kontaktinfo
- Lokasjonstype (main, outdoor, kitchen, event, storage)
- Kapasitet

### 2.3 Soner (Zones) — extends Location

- Serverings- og arbeidssoner (Section 1, Seaside, Penthouse)
- Sesongbevisst (sommersoner, julesoner)
- Kapasitet per sone
- Tilknytning til vaktplanlegging

### 2.4 Eiendeler (Assets) — extends Location

- Utstyr og kontrollpunkter (Register, Walk-in Fridge, Oven)
- Kobling til Governance (Policy → Protocol for vedlikehold/sikkerhet)
- Opplæringskrav (requires_training)
- Rutinekrav (requires_routine)

### 2.5 Avdelinger (Departments)

- Opprett/rediger avdeling (Kjøkken, Sal, Bar, etc.)
- Avdelingsfarge og ikon
- Avdelingsleder
- Permanent struktur (aldri sesongbevisst)

### 2.6 Team

- Opprett/rediger team
- Teammedlemmer og teamleder
- Tilknytning til avdeling (eller cross-departmental)
- Sesongbevisst (vinterteam, eventteam)
- Teamtyper (operational, access, cross_department, seasonal, custom)

### 2.7 Stillinger (Positions)

- Stillingstyper (Servitør, Kokk, Bartender, Oppvaskhjelp, etc.)
- Krav og kompetanser per stilling (skill_requirements)
- Minimum rolle-nivå (min_role_level)
- Tilknytning til avdeling
- Sesongbevisst (Grill Chef sommar, Julbord Kokk jul)
- Stilling tilordnes per vakt, ikke per profil

---

## 3. VAKTPLANLEGGING (SCHEDULING)

> **Dokument:** SMARTOUT_MODULE_3_SCHEDULING.md (nåværende: smartout-modul3-vaktplanlegging.md)

### 3.1 Kalender & Oversikt

- Uke-/månedsvisning
- Filtrering per avdeling/team/ansatt
- Fargekoding per vakttype
- Drag-and-drop planlegging
- Tre visningsmodi: Ansatt, Stilling, Team

### 3.2 Skiftoppretting

- Opprett vakt fra Shift Template (start, slutt, pause)
- Tilordne ansatt (inkludert trainees med badge)
- Dagkategori (morgen, kveld, natt, helg)
- Gjentakende vakter
- Publisering av vaktplan

### 3.3 Tilgjengelighet

- Ansatte registrerer tilgjengelighet
- Ønsker om fri
- Konflikthåndtering

### 3.4 Vaktbytte

- Ansatt ber om bytte
- Velg kollega som erstatning
- Leder godkjenner/avviser
- Varsling til alle parter

### 3.5 Åpen-vakt-tavle

- Upubliserte vakter
- Ansatte melder interesse
- Leder tildeler

### 3.6 Stemplings-/Punchclock

- Stemple inn/ut
- GPS-verifisering (valgfritt)
- Avvikshåndtering (for sent, for tidlig)
- Pauseregistrering
- Autokorreksjon-regler
- Sandbox-modus for trainees

### 3.7 Overtidshåndtering

- Automatisk deteksjon av overtid
- Regler per ansettelsestype
- Godkjenningsflyt
- Beregning av overtidstillegg

---

## 4. OPERATIONS & TASK MANAGEMENT

> **Dokument:** SMARTOUT_MODULE_4_OPERATIONS.md

### 4.1 Department Session

- Daglig operasjonell container per avdeling
- Auto-generert fra Department Schedule
- Livssyklus: upcoming → active → pending_signoff → closed | missed
- Sign-off med autoritetsnivåer

### 4.2 Department Schedule

- Åpningstider per avdeling per sesong
- Ukentlige standarder + datooverstyrelser
- Oppløsningslogikk (dato > uke > standard)

### 4.3 Session Hooks

- Tidsbaserte triggere (pre_open, open, scheduled, pre_close, close)
- Kobling til Procedures og Routines fra Governance
- Gjentakende hooks (f.eks. temperatursjekk hver 4. time)
- Ukedagsfiltrering

### 4.4 Shift Templates

- Forhåndskonfigurerte vaktpakker
- Prosedyrer, lokasjoner, soner per mal
- Snapshot ved vaktoppretting (versjonering)

### 4.5 Session Tasks (oppgaveinstanser)

- Oppgaver fra hooks, maler, ad-hoc, arv, og recurring
- Full sporbarhet (hvem, når, hva, avvik)
- Statusflyt: pending → available → in_progress → completed | skipped | overdue | escalated

### 4.6 Ad-hoc oppgaver

- Sanntidsopprettelse av leder
- Tilordning: person, stilling, team, lokasjon, sone, alle på vakt
- Prioritetsnivåer med tilhørende varsling

### 4.7 Recurring Tasks (vedlikeholdsoppgaver)

- Lokasjonsbaserte, planlagte oppgaver
- Frekvens: daglig, ukentlig, månedlig, etc.
- Uavhengig av vakter og hooks

### 4.8 Shift Inheritance (dekningslogikk)

- Oppgaver arves ved fravær/no-show
- Oppgaver tilhører sesjonen, ikke vakten

### 4.9 Informasjonslag

- Session Notes (kategoriserte, tidsstemplede)
- Day Brief (AI-kompilert sammendrag)
- Handoff (strukturert kunnskapsoverføring, tekst/stemme/AI-call)

### 4.10 AI Operations Layer

- Triage, Monitor, Compile, Predict, Act, Learn
- AI autoritetsnivåer (autonomous, notify+suggest, notify, escalate, never)
- AI Event Log (full transparens)
- Konfigurerbar per workspace

### 4.11 Gamification

- Poengopptjening fra oppgavefullføring
- Boosters og penalties
- Konfigurerbare poengsatser (AI-foreslått)
- Synlighet: full, personal_only, managers_only
- Trainee-poeng overføres til aktiv sesong

---

## 5. HACCP & MATSIKKERHET

> **Dokument:** SMARTOUT_MODULE_5_HACCP.md

### 5.1 Temperaturlogging

- Digital registrering av kjøl/frys
- Planlagt kontrollfrekvens (via Session Hooks / Routines)
- Grenseverdier og varsler ved avvik (trigger Runbook)
- Historikk og rapporter

### 5.2 Hygiene-sjekklister

- Daglige renholdsrutiner (via Procedures)
- Dokumentasjon av rengjøring
- Signering og tidsstempel
- Sporbarhet

### 5.3 Avviksrapportering

- Opprett avviksrapport (deviation_flagged på session_task)
- Kategorisering (matsikkerhet, hygiene, sikkerhet, etc.)
- Bilder og dokumentasjon (completion_data)
- Korrigerende tiltak (via Runbook)
- Oppfølging og lukking (via Control List)

### 5.4 Kontrollpunkter

- Definere kritiske kontrollpunkter per lokasjon (via Assets + Policy)
- Tilknytning til sjekklister
- Inspeksjonsklare rapporter for myndigheter

### 5.5 Sertifiseringer & Kurs

- Mattrygghets-sertifiseringer per ansatt
- Utløpsdatoer og påminnelser
- Dokumentlagring

---

## 6. OPPLÆRING & KOMPETANSE (TRAINING)

> **Dokument:** SMARTOUT_MODULE_6_TRAINING.md

### 6.1 Protocol Training (tredje onboarding-system)

- Policy → Protocol → Procedure/KnowledgeTest/Confirmation
- Readiness: alle tildelte protocols fullført = READY ✓
- Tildeles via team/avdelingsmedlemskap
- Lengre tidslinje enn Trainee Mode

### 6.2 Opplæringsmoduler

- Opprett moduler med multimedia-innhold
- Tekst, bilder, video
- Steg-for-steg instruksjoner (Procedures)
- Tilknytning til stilling/avdeling/team

### 6.3 Kurs og Læringsløp

- Sett sammen moduler til kurs
- Rekkefølge og forutsetninger
- Tidsestimat per kurs
- Obligatoriske vs. valgfrie kurs

### 6.4 Quizzer og Tester (Knowledge Tests)

- Opprett spørsmål (flervalg, sant/usant, fritekst)
- Poengsetting og bestått-grense (pass_threshold)
- Tilfeldig rekkefølge
- Maks forsøk (max_attempts)

### 6.5 Fremdriftssporing

- Moduler fullført per ansatt
- Quizresultater og gjennomsnittscore
- Tidsbruk per modul
- Kompetansematrise (ansatt × ferdighet)
- Readiness score (% av tildelte protocols fullført)

### 6.6 Digitale Håndbøker

- Stillingsspesifikke håndbøker
- Innholdsfortegnelse og navigasjon
- Versjonskontroll (Protocol.version)
- Lesbekreftelse fra ansatt (Confirmation)

### 6.7 AI-tilpasset Opplæring

- Identifisere kunnskapshull
- Personaliserte anbefalinger
- Adaptiv vanskelighetsgrad
- Automatiske påminnelser ved mangler

---

## 7. FRAVÆR & PERMISJON

### 7.1 Ferieforespørsler

- Ansatt søker om ferie
- Visning av feriesaldo
- Leder godkjenner/avviser
- Konfliktsjekk mot vaktplan
- Ferie-kalender oversikt

### 7.2 Sykefravær

- Registrere egenmelding
- Sykemelding (lege)
- Dagstelling og perioder
- Arbeidsgiverperiode vs. NAV
- Oppfølgingsplaner

### 7.3 Annet Fravær

- Permisjon med/uten lønn
- Foreldrepermisjon
- Militærtjeneste
- Opplæringspermisjon
- Velferdspermisjoner

### 7.4 Fraværsoversikt

- Kalendervisning per ansatt
- Statistikk per avdeling
- Fraværsmønster og trender
- Saldo-oversikt (ferie, fleksitid, TOIL)

### 7.5 Forespørsler & Godkjenninger

- Forespørselstyper (\_requestTypes)
- Godkjenningsflyt
- Varsling ved status-endring
- Historikk

---

## 8. LØNN & ØKONOMI (PAYROLL)

### 8.1 Lønnsgrunnlag

- Lønnstyper (fast/time)
- Grunnlønn per ansatt
- Ansettelseskategori (heltid, deltid, tilkalling, etc.)
- Effektiv timesats-beregning

### 8.2 Tillegg & Supplementer

- Kvelds-/nattillegg
- Helgetillegg
- Helligdagstillegg
- Overtidstillegg (40% / 50%)
- Regler per dagkategori (\_dayCategory)

### 8.3 Overtid & Timebank

- Overtidsberegning for faste vs. timelønnede
- Timebank (TOIL) saldo og regler
- Utbetaling vs. avspasering
- Utløpsdatoer
- Norsk arbeidsrett-regler

### 8.4 Fravær-lønn

- Sykelønn (arbeidsgiverperiode)
- Feriepengeberegning
- Permisjon med lønn
- NAV-refusjoner

### 8.5 Lønnsberegning

- Månedlig lønnskjøring
- Skift → Tillegg → Trekk → Brutto
- Arbeidsgiveravgift (14.1%)
- Feriepenger (12%)
- Pensjon (OTP 2%)
- Validering og kontroll

### 8.6 Rapporter

- Lønnslipp per ansatt
- Lønnskostnad per avdeling
- Overtidsrapport
- Feriepenge-rapport
- Budsjett vs. faktisk

---

## 9. KOMMUNIKASJON

> **Dokument:** SMARTOUT_MODULE_9_COMMUNICATION.md

### 9.1 Teamchat

- Gruppechat per avdeling/team
- Direktemeldinger
- Medieopplasting (bilder, filer)
- Varsler og lesebekreftelse

### 9.2 Varsler & Notifikasjoner

- Push-notifikasjoner
- In-app varsler
- SMS (via Twilio)
- E-post (via Resend)
- Varslingsinnstillinger per bruker (Profile.notification_pref)
- Stille timer (quiet hours)
- Rate limiting

### 9.3 Kunngjøringer

- Workspace-brede meldinger
- Avdelingsspesifikke kunngjøringer
- Prioritet og synlighet
- Lesebekreftelse

### 9.4 Skift-overlevering (Handoff)

- Tekst, stemme, eller AI-call metoder
- Ekstraksjon av hendelser og avvik (AI)
- Strukturert rapport til neste sesjon
- Feeds inn i Day Brief

### 9.5 Eskaleringer

- Automatisk eskalering ved ubesvart
- Eskaleringskjede (Team Leader → Manager → Admin)
- Varsling ved eskalering
- Timeout-regler (konfigurerbare)

---

## 10. REPORTS, DASHBOARDS & RECONCILIATION

> **Dokument:** SMARTOUT_MODULE_10_REPORTS.md

### 10.1 Daily Reconciliation

- Sättelfunktion (Settlement) via OCR fra kassa/terminal
- Hard lock på punch-out for oppgjør
- Admin-godkjenning av arbeidsdag og timer
- Avviksmotor (5 domener: Safety, Customer, Procedure, System, Material)
- Handoff Motor med AI-styrt data-innhenting

### 10.2 Rekonsiliering & Rapportering

- Role Reconciliation (Aggregering per stilling/rolle over tid)
- Season Reconciliation (Strategisk evaluering av budsjett vs. faktisk)
- Location Routine Sessions (QR-basert stempling for hotellrom/etasjer)
- HR, Drift- og Økonomirapportering

### 10.3 KPI Dashboard & Alert Engine

- Kjerne-KPI-er (Omsetning per time, Lønnsprosent)
- Proaktiv styring (Hva trenger vi per time) vs reaktiv (Hva leverte vi)
- Tertiær-alerts: lav produktivitet, gap mot mål, budsjett-burnrate

---

## 11. INNSTILLINGER & ADMINISTRASJON

### 11.1 Workspace-innstillinger

- Firmanavn, logo, branding
- Tidssone og lokalitet
- Standardverdier (skiftlengder, pauser, etc.) — via Policy
- Moduler av/på per plan (active_modules[])

### 11.2 Brukeradministrasjon

- Opprett/rediger/deaktiver bruker
- Rolletildeling (employee, manager, admin, owner)
- Avdelings-/teamtilhørighet
- Ansettelsesprofil
- Status (trainee, active, inactive, offboarding)

### 11.3 Lønnsinnstillinger

- Tilleggsregler og satser — via Policy (policy_type: payroll)
- Dagkategorier og tidsgrenser
- Overtidsregler
- Feriepengesats
- Pensjon og arbeidsgiveravgift

### 11.4 Varslingsinnstillinger

- Globale varslingsregler
- Kanalprioritet (push, SMS, e-post, voice)
- Rate limits
- Stille timer-standard

### 11.5 Integrasjoner

- Supabase (backend)
- Twilio (SMS/voice)
- Resend (e-post)
- Stripe (betaling)
- n8n (workflow automation)

### 11.6 Data & Eksport

- GDPR-eksport per bruker
- Datahåndtering og sletting
- Backup-rutiner
- Audit log

---

## 12. AI-LAGET (MR. BOTSSON)

### 12.1 Chat-grensesnitt

- Tekstchat i appen
- Kontekstuell bevissthet (hvem spør, hvilken rolle, hvilken sesjon)
- Samtalehistorikk
- Foreslåtte handlinger

### 12.2 Stemmegrensesnitt (Voice AI)

- Ultravox-integrasjon
- Twilio-telefoni
- Norsk språkstøtte + preferred_language
- Samtaleflyt og avbruddshandtering
- Tool calling fra stemme

### 12.3 Kontekstmotor (Context Engine)

- Brukerprofil og kontekstvektor
- Indekser (reliability, engagement, progress, loyalty, capacity, risk)
- Sentiment-sporing
- Modus-deteksjon (på jobb, fri, trening, trainee, etc.)
- Preferanser

### 12.4 Kunnskapsmotor (Knowledge Engine)

- RAG med embeddings (pgvector)
- Dokumentlagring og chunking
- Semantisk søk
- Rolle- og workspace-filtrering
- Kildesporing

### 12.5 Reisemotor (Journey Engine)

- Onboarding: Trainee Mode + Module Journeys (checkpoint tracking, AI dynamic guidance)
- Offboarding (status: offboarding → data preservation)
- Forfremmelser (role changes, new protocol assignments)
- Progress monitoring og eskalering

### 12.6 Lønnsmotor (Payroll Engine)

- Lønnsberegning fra skiftdata
- Tilleggsberegning
- Norsk arbeidsrett-validering
- Lønnkjøring og historikk

### 12.7 Kommunikasjonsmotor (Communication Engine)

- Meldingsformatering med kontekst + maler
- Kanalvalg basert på preferanser
- SMS, e-post, push, voice
- Leveringssporing

### 12.8 Operasjonsmotor (Operation Engine)

- Daglig driftsstyring via Department Sessions
- Sjekklister og overleveringer
- Proaktive varsler og påminnelser
- Reaktiv hendelseshåndtering (Triage, Monitor, Predict)
- Mål-sporing

### 12.9 Læringsmotor (Learning Engine)

- Opprette treningsinnhold
- Quiz-generering og scoring
- Fremdriftssporing per bruker
- Anbefalinger basert på kunnskapshull
- Ferdighetskartlegging

### 12.10 Forretningsmotor (Business Engine)

- KPI-sporing
- Finansiell oversikt
- Juridiske dokumenter og kontrakter
- Strategisk planlegging
- Rapportgenerering

---

## 13. MULTI-TENANT & SKALERING

> **Dokument:** SMARTOUT_MODULE_13_MULTITENANT.md

### 13.1 Workspace-isolasjon

- Dataisolasjon mellom workspaces (workspace_id på alle tabeller)
- RLS-policyer (Supabase Row Level Security)
- Cross-workspace admin (Smartout Super-Admin)

### 13.2 Ytelse

- Caching-strategi
- Database-indeksering
- API rate limiting
- Lastbalansering

### 13.3 Abonnement & Betaling

- Stripe-integrasjon
- Plan-nivåer og begrensninger (max_profiles)
- Oppgradering/nedgradering
- Fakturering
- Trainee-count mot planlimit

---

## 14. PRODUCTION & MENU MANAGEMENT

> **Dokument:** SMARTOUT_MODULE_14_PRODUCTION.md

### 14.1 Ingredienser & Råvarer

- Masterdata på råvarer
- Prepp-tid per enhet (system level facts)
- Svinn-prosent per ingrediens

### 14.2 Oppskrifter (Recipes) & Retter (Dishes)

- Ingredienser → Oppskrift → Rett
- Steg-for-steg metode med tidsestimat og temperaturer
- Produksjonsplan koblet til Retter
- Kobling til treningsmateriell (video/prosedyrer)

### 14.3 Meny & Bookings (Calculation Engine)

- Menyer (samling av retter) og sesong-mapping
- Booking → Gjestetall og menyvalg
- Produksjonskalkulator (automatisk uttrekk, plukkliste, tidsestimat)
- Daglig Production Session (vises i Department Session)
- Avfallsregistrering (Waste log)

---

## 15. SEASON PLANNING & BUDGET ENGINE

> **Dokument:** SMARTOUT_MODULE_15_SEASON_PLANNING.md

### 15.1 Budsjett & Mål

- Totalt omsetningsmål for sesong
- Mål-lønnsprosent (Target labor %)
- Alkohol-estimater
- Dag-faktorer (distribusjon gjennom uken)
- Time-faktorer (vektet verdi av åpningstimer)

### 15.2 Kalkuleringsmotor & Bemanningsturbomotor

- Nedbrytning til dagsmål
- Nedbrytning til timesmål (hour factor \* day factor)
- Konvertering av timesmål og lønnsprosent til Bemanningsbehov per time
- Integrerer mot Vaktplan (Scheduling) for dekningsgrad

### 15.3 Maskinlæring (Learning Engine)

- Registrering av planlagt vs. faktisk (Day, Hour, Alcohol)
- Historisk justeringsforslag etter sesong
- Opprettelse av overrides (Dato-spesifikke justeringer, f.eks 17. mai)

---

## 16. JURIDISK & COMPLIANCE

### 16.1 Norsk Arbeidsrett

- Arbeidsmiljøloven-regler i systemet
- Arbeidstidsbestemmelser
- Overtidsregler
- Ferielov
- Tariffavtaler (Fellesforbundet etc.)
- Trainee-lønn (betalt kun i planlagte timer)

### 16.2 GDPR

- Personvernserklæring
- Databehandleravtale
- Samtykke-håndtering
- Rett til innsyn
- Rett til sletting
- PII-deteksjon og håndtering
- Dataminimering

### 16.3 Mattilsynet

- HACCP-krav (via Governance: Policy → Protocol → Routine → Control List)
- Dokumentasjonsplikt
- Inspeksjonsberedskap

---

## VEDLEGG

### A. Option Sets (Alle Enums)

- \_rate_Type (Fixed, Hourly, Multiplier, Percentage, Calculated)
- \_salary_category (Base pay, Overtime, Supplement, Absence, Deductions)
- \_wageAdjustmentType (Hourly, After x Hours, Fixed, Holiday, etc.)
- \_wageAdjustment (Percentage, kr amount, kr fixed, Fixed)
- \_adjustmentType (Hourly, Fixed salary, Holiday Pay, etc.)
- \_dayCategory (Morning, Mid day, Afternoon, Evening, Night, Weekend)
- \_employmentCategory (Full time, Part time, Temporary, Flexible, Apprentice)
- \_requestTypes (Available, Not available, Vacation, Sick day, Flextime, etc.)
- \_accountTypes (Vacation, Parental leave, Sick leave, Flextime/TOIL, etc.)
- \_absenceType (Sick leave, Parental leave, Vacation, Unpaid leave, etc.)
- \_profileStatus (trainee, active, inactive, offboarding)
- \_profileRole (employee, manager, admin, owner)
- \_seasonType (default, calendar, focus, cycle, custom)
- \_seasonStatus (draft, active, archived)
- \_hookType (pre_open, open, scheduled, pre_close, close, custom)
- \_taskStatus (pending, available, in_progress, completed, skipped, overdue, escalated)
- \_sessionStatus (upcoming, active, pending_signoff, closed, missed)
- \_inviteStatus (pending, accepted, expired, cancelled)

### B. API-endepunkter

- Supabase Edge Functions
- n8n workflow-triggers
- Webhook-URLer

### C. Brukerflyter (User Flows)

- Workspace opprettelse (admin first run)
- Ansattinvitasjon og akseptering
- Trainee → Active overgang
- Detaljerte steg-for-steg flytdiagrammer
- Happy path + edge cases
- Feilhåndtering per flyt

### D. Datamigrering

- Mapping: Bubble-datatype → SQL-tabell
- Transformasjonsregler
- Migreringsrekkefølge (avhengigheter)
- Valideringssjekklister
