// ===== Smartout — Håndbok / Bibliotek data =====
// Extends window.SmartoutData with HANDBOOKS, HB_PEOPLE, HB_GAPS, HB_TEMPLATES.
// Three workspaces: Bedriftshåndbok · HMS-håndbok · Personalhåndbok.
// Cast & world stay consistent with ../data.js (Bistro Nord, Vinter 2026).
(function () {
  // ---- people (owners) — mirror the Bistro Nord cast ----
  const P = {
    ma: { init: "MA", name: "Maria A.", color: "#FF7849", role: "Driftsleder" },
    jh: { init: "JH", name: "Jonas H.", color: "#3B82F6", role: "Kokk" },
    sl: { init: "SL", name: "Selma L.", color: "#10B981", role: "Servitør · Tillitsvalgt" },
    pk: { init: "PK", name: "Petter K.", color: "#A855F7", role: "Servitør" },
    ib: { init: "IB", name: "Ida B.", color: "#EAB308", role: "Renhold" },
    sk: { init: "SK", name: "Sara K.", color: "#0E9F6E", role: "Kvalitetsleder" },
    et: { init: "ET", name: "Erik T.", color: "#864ad2", role: "Daglig leder" },
  };

  // status vocabulary: approved · review · draft · outdated · archived
  const ST = {
    approved: { label: "Godkjent", tone: "ok" },
    review: { label: "Til gjennomgang", tone: "info" },
    draft: { label: "Utkast", tone: "muted" },
    outdated: { label: "Utdatert", tone: "warn" },
    archived: { label: "Arkivert", tone: "muted" },
  };

  // ---- a helper to build documents compactly ----
  const doc = (o) => Object.assign({
    state: "approved", owner: P.ma, updated: "12. mai 2026", version: "1.0",
    due: null, read: 3, comments: 0, related: [], attachments: [], body: null,
  }, o);

  // ════════════════════ BEDRIFTSHÅNDBOK ════════════════════
  const bedrift = {
    id: "bedrift", name: "Bedriftshåndbok", short: "Bedrift", icon: "building",
    accent: "#8b5cf6",
    tagline: "Slik driver vi Bistro Nord",
    desc: "Selskapets operativsystem — roller, team, ansvar, arbeidsflyt og rutinene som holder driften i gang gjennom Smartout.",
    health: 82, owner: P.et,
    chapters: [
      { id: "b-org", n: 1, title: "Organisasjon og struktur", icon: "layers", state: "completed", docs: [
        doc({ id: "b-org-1", title: "Avdelinger, områder og lag", state: "approved", owner: P.et, version: "2.1", updated: "3. mai 2026", read: 14, summary: "Hvordan Bistro Nord er delt inn: Kjøkken, Sal, Bar, Event og Lager — og hvordan lag og områder henger sammen." }),
        doc({ id: "b-org-2", title: "Tilgangsnivåer (Ansatt / Leder / Admin / Eier)", state: "approved", owner: P.et, version: "1.4", updated: "3. mai 2026", read: 14, summary: "Hva hvert tilgangsnivå kan se og gjøre i Smartout." }),
      ]},
      { id: "b-roles", n: 2, title: "Roller og ansvar", icon: "users", state: "completed", docs: [
        doc({ id: "b-roles-1", title: "Driftsleder", state: "approved", owner: P.et, version: "1.3", read: 12, summary: "Ansvar for daglig drift, bemanning, avvik og økonomi i vakt." }),
        doc({ id: "b-roles-2", title: "Vaktleder", state: "approved", owner: P.ma, version: "1.1", read: 9 }),
        doc({ id: "b-roles-3", title: "Kjøkkensjef", state: "review", owner: P.jh, version: "1.0", updated: "27. mai 2026", read: 4, due: "31. mai 2026", comments: 2, summary: "Ansvar for meny, råvarer, HACCP og kjøkkenbemanning. Oppdatert med nye innkjøpsrutiner." }),
      ]},
      { id: "b-flow", n: 3, title: "Arbeidsflyt og rutiner", icon: "route", state: "in_progress", docs: [
        doc({ id: "b-flow-1", title: "Daglig driftsrytme (åpning → stenging)", state: "approved", owner: P.ma, version: "2.0", read: 16, summary: "Fra åpningssjekk til dagsoppgjør — timeplanen for en vanlig dag." }),
        doc({ id: "b-flow-2", title: "Vaktbytte og overlevering", state: "approved", owner: P.ma, version: "1.2", read: 11 }),
        doc({ id: "b-flow-3", title: "Eskaleringsvei ved hendelser", state: "draft", owner: P.ma, version: "0.4", updated: "29. mai 2026", read: 1, due: "5. jun 2026", summary: "Hvem kontaktes når, og i hvilken rekkefølge, ved drifts- og sikkerhetshendelser." }),
        doc({ id: "b-flow-4", title: "Dagsoppgjør og kasse", state: "outdated", owner: P.et, version: "1.0", updated: "9. nov 2025", read: 8, due: "Forfalt 1. mai", summary: "Rutine for kasseoppgjør. Henviser til gammelt kassesystem — må oppdateres." }),
      ]},
      { id: "b-tools", n: 4, title: "Verktøy og systemer", icon: "sliders", state: "completed", docs: [
        doc({ id: "b-tools-1", title: "Smartout — slik bruker vi det", state: "approved", owner: P.ma, version: "1.5", read: 18 }),
        doc({ id: "b-tools-2", title: "Kassesystem og betaling", state: "approved", owner: P.et, version: "1.1", read: 10 }),
      ]},
      { id: "b-how", n: 6, title: "Slik jobber vi her", icon: "heart", state: "todo", docs: [] },
      { id: "b-contracts", n: 5, title: "Arbeidsavtaler og kontraktsmaler", icon: "checkdoc", state: "in_progress", tool: "contracts",
        intro: "Her bor kontraktsmal-generatoren. Maler defineres som styrte dokumenter, bundet til Riksavtalen og lønnstrinn, og brukes av Kontrakter-modulen til å auto-generere arbeidsavtaler.",
        docs: [
          doc({ id: "b-ct-kjokken-fast", title: "Kjøkken · Fast ansettelse", state: "approved", owner: P.et, version: "3.1", updated: "12. mai 2026", read: 24, summary: "Komplett mal for faste kjøkkenstillinger. Bundet til Riksavtalen fagbrev-trinn og kjøkkenets opplæringsløp.", tplId: "ct-kjokken-fast" }),
          doc({ id: "b-ct-servering-fast", title: "Servering · Fast ansettelse", state: "approved", owner: P.ma, version: "2.4", updated: "3. apr 2026", read: 31, summary: "Faste serveringsstillinger med skjenke-tillegg og salens opplæringsløp.", tplId: "ct-servering-fast" }),
          doc({ id: "b-ct-servering-mid", title: "Servering · Midlertidig / sesong", state: "approved", owner: P.et, version: "2.0", updated: "2. mai 2026", read: 18, summary: "Sesong- og vikariatstillinger med sluttdato og lovgrunnlag for midlertidighet.", tplId: "ct-servering-mid" }),
          doc({ id: "b-ct-bar-tilkalling", title: "Bar · Tilkalling", state: "review", owner: P.et, version: "1.2", updated: "20. feb 2026", read: 9, due: "3. jun 2026", comments: 1, summary: "Ringevikar i baren. Mangler oppdatert tillegg-tabell — til gjennomgang.", tplId: "ct-bar-tilkalling" }),
          doc({ id: "b-ct-drift-leder", title: "Drift · Leder (fastlønn)", state: "draft", owner: P.ma, version: "1.0", updated: "28. mai 2026", read: 0, due: "10. jun 2026", summary: "Lederstillinger på fastlønn med ansvar og nøkkelfunksjon. Under arbeid.", tplId: "ct-drift-leder" }),
          doc({ id: "b-ct-event-mid", title: "Event · Tilkalling", state: "draft", owner: P.ma, version: "1.0", updated: "30. mai 2026", read: 0, summary: "Påbegynt mal for eventverter ved behov. Ikke klar for bruk.", tplId: "ct-event-mid" }),
        ] },
    ],
  };

  // ════════════════════ HMS-HÅNDBOK (deepest) ════════════════════
  const hms = {
    id: "hms", name: "HMS-håndbok", short: "HMS", icon: "shield",
    accent: "#f97316",
    tagline: "Trygt arbeid, trygg mat",
    desc: "Internkontroll for helse, miljø og sikkerhet — risiko, prosedyrer, avvik, vernerunder, beredskap og lovpålagt dokumentasjon. Bygger på IK-mat-veiviseren.",
    health: 74, owner: P.sk, statutory: true,
    chapters: [
      { id: "h-intro", n: 1, title: "Innledning og formål", icon: "flag", state: "completed", docs: [
        doc({ id: "h-intro-1", title: "Mål og omfang for HMS-arbeidet", state: "approved", owner: P.sk, version: "2.0", updated: "2. mai 2026", read: 17, summary: "Hva internkontrollen dekker, hvem den gjelder for, og hvordan den følges opp." }),
      ]},
      { id: "h-roles", n: 2, title: "Roller og ansvar i HMS", icon: "users", state: "completed", docs: [
        doc({ id: "h-roles-1", title: "HMS-ansvarlig og verneombud", state: "approved", owner: P.sk, version: "1.3", read: 13, summary: "Ansvarsfordeling mellom daglig leder, HMS-ansvarlig og verneombud." }),
        doc({ id: "h-roles-2", title: "Den ansattes ansvar", state: "approved", owner: P.sk, version: "1.1", read: 15 }),
      ]},
      { id: "h-risk", n: 3, title: "Risikovurdering", icon: "alert", state: "in_progress", docs: [
        doc({ id: "h-risk-1", title: "Risikovurdering kjøkken 2026", state: "review", owner: P.sk, version: "3.0", updated: "26. mai 2026", read: 6, due: "2. jun 2026", comments: 3, summary: "Kartlegging av farer ved varme overflater, kniver, sklirisiko og kjemikalier. Klar for godkjenning." }),
        doc({ id: "h-risk-2", title: "Risikovurdering bar og servering", state: "approved", owner: P.sk, version: "2.1", read: 9 }),
        doc({ id: "h-risk-3", title: "Kjemikalieoversikt (sikkerhetsdatablad)", state: "outdated", owner: P.ib, version: "1.0", updated: "14. jan 2025", read: 7, due: "Forfalt 14. jan", summary: "Stoffkartotek for rengjøringsmidler. Tre nye midler mangler datablad." }),
      ]},
      { id: "h-proc", n: 4, title: "Prosedyrer og sikre rutiner", icon: "clipcheck", state: "in_progress", docs: [
        doc({ id: "h-proc-1", title: "IK-mat — internkontroll mattrygghet", state: "approved", owner: P.sk, version: "2.4", updated: "12. apr 2026", read: 19, summary: "Det lovpålagte internkontrollsystemet for mattrygghet. Bygd via veiviseren — 9 av 10 kapitler fullført.", isWizard: true }),
        doc({ id: "h-proc-2", title: "Temperaturkontroll kjøl og frys", state: "approved", owner: P.sk, version: "2.4", read: 16, summary: "Daglig kontroll etter HACCP. Knyttet til oppgaven «Morgenrutine kjøl»." }),
        doc({ id: "h-proc-3", title: "Renhold og hygiene", state: "approved", owner: P.ib, version: "1.5", read: 12 }),
        doc({ id: "h-proc-4", title: "Mottakskontroll varer", state: "draft", owner: P.jh, version: "0.6", updated: "28. mai 2026", read: 2, due: "4. jun 2026", summary: "Sjekk av temperatur, holdbarhet og emballasje ved levering." }),
      ]},
      { id: "h-dev", n: 5, title: "Avvikshåndtering", icon: "swap", state: "completed", docs: [
        doc({ id: "h-dev-1", title: "Slik melder og lukker vi avvik", state: "approved", owner: P.sk, version: "2.0", read: 18, summary: "Fra registrering i Smartout til lukket avvik med tiltak — med eksempler." }),
        doc({ id: "h-dev-2", title: "Eksempel: Temperaturavvik Kjøl 3", state: "approved", owner: P.ma, version: "1.0", read: 5, summary: "Reelt avvik brukt som læringseksempel." }),
      ]},
      { id: "h-insp", n: 6, title: "Vernerunder og inspeksjoner", icon: "eye", state: "in_progress", docs: [
        doc({ id: "h-insp-1", title: "Sjekkliste vernerunde", state: "approved", owner: P.sk, version: "1.2", read: 8 }),
        doc({ id: "h-insp-2", title: "Vernerunde Q2 2026 — rapport", state: "draft", owner: P.sk, version: "0.3", updated: "20. mai 2026", read: 3, due: "10. jun 2026" }),
      ]},
      { id: "h-fire", n: 7, title: "Brannvern", icon: "alert", state: "completed", docs: [
        doc({ id: "h-fire-1", title: "Branninstruks og rømningsveier", state: "approved", owner: P.et, version: "1.4", read: 19, summary: "Plassering av slukkeutstyr, rømningsveier og opptreden ved brann." }),
        doc({ id: "h-fire-2", title: "Logg — brannøvelse og kontroll", state: "approved", owner: P.et, version: "1.0", read: 6 }),
      ]},
      { id: "h-emerg", n: 8, title: "Førstehjelp og beredskap", icon: "heart", state: "in_progress", docs: [
        doc({ id: "h-emerg-1", title: "Førstehjelpsrutine", state: "review", owner: P.sk, version: "1.1", updated: "27. mai 2026", read: 7, due: "3. jun 2026", comments: 1 }),
        doc({ id: "h-emerg-2", title: "Beredskapsplan — alvorlig hendelse", state: "draft", owner: P.et, version: "0.5", read: 2, due: "12. jun 2026" }),
      ]},
      { id: "h-train", n: 9, title: "Opplæring og kompetanse", icon: "cap", state: "in_progress", docs: [
        doc({ id: "h-train-1", title: "Opplæringsplan HMS for nyansatte", state: "approved", owner: P.sk, version: "1.2", read: 11 }),
        doc({ id: "h-train-2", title: "Kompetansematrise og sertifikater", state: "review", owner: P.ma, version: "1.0", updated: "25. mai 2026", read: 4, due: "1. jun 2026", comments: 2, summary: "Hvem har gyldig hygienesertifikat, brannvern og førstehjelp. Tre sertifikater utløper snart." }),
      ]},
      { id: "h-improve", n: 10, title: "Forbedringstiltak", icon: "trendUp", state: "todo", optional: true, docs: [] },
    ],
  };

  // ════════════════════ PERSONALHÅNDBOK ════════════════════
  const personal = {
    id: "personal", name: "Personalhåndbok", short: "Personal", icon: "heart",
    accent: "#008388",
    tagline: "Et godt sted å jobbe",
    desc: "Kultur, forventninger og rettigheter — fra ansettelse og onboarding til oppfølging, utvikling, ferie og goder. Støttende, tydelig og menneskesentrert.",
    health: 79, owner: P.ma,
    chapters: [
      { id: "p-culture", n: 1, title: "Kultur og verdier", icon: "heart", state: "completed", docs: [
        doc({ id: "p-culture-1", title: "Slik er det å jobbe hos oss", state: "approved", owner: P.et, version: "1.2", read: 17, summary: "Verdiene våre, hvordan vi snakker med hverandre og gjestene, og hva vi forventer." }),
        doc({ id: "p-culture-2", title: "Mangfold og inkludering", state: "approved", owner: P.ma, version: "1.0", read: 12 }),
      ]},
      { id: "p-employ", n: 2, title: "Ansettelse og kontrakt", icon: "file", state: "completed", docs: [
        doc({ id: "p-employ-1", title: "Arbeidsavtale — mal og vilkår", state: "approved", owner: P.et, version: "2.0", read: 9, summary: "Standard arbeidsavtale, prøvetid, oppsigelsestid og stillingsbrøk." }),
        doc({ id: "p-employ-2", title: "Taushetsplikt og rolleforventninger", state: "approved", owner: P.et, version: "1.1", read: 8 }),
      ]},
      { id: "p-onboard", n: 3, title: "Onboarding", icon: "cap", state: "in_progress", docs: [
        doc({ id: "p-onboard-1", title: "Onboardingplan — første 30 dager", state: "approved", owner: P.ma, version: "1.3", read: 14, summary: "Dag for dag-plan for nyansatte: opplæring, faddere og sjekkpunkter." }),
        doc({ id: "p-onboard-2", title: "Sjekkliste fadder", state: "review", owner: P.sl, version: "1.0", updated: "26. mai 2026", read: 5, due: "2. jun 2026", comments: 1 }),
        doc({ id: "p-onboard-3", title: "Velkomstbrev", state: "draft", owner: P.ma, version: "0.7", read: 1, due: "6. jun 2026" }),
      ]},
      { id: "p-follow", n: 4, title: "Oppfølging og utvikling", icon: "trendUp", state: "in_progress", docs: [
        doc({ id: "p-follow-1", title: "Mal: medarbeidersamtale", state: "approved", owner: P.ma, version: "1.1", read: 10 }),
        doc({ id: "p-follow-2", title: "Læringsplan og fagutvikling", state: "draft", owner: P.ma, version: "0.5", updated: "24. mai 2026", read: 2, due: "8. jun 2026", summary: "Hvordan ansatte kan utvikle seg — kurs, fagbrev og interne løft." }),
      ]},
      { id: "p-time", n: 5, title: "Ferie, fravær og goder", icon: "calendar", state: "completed", docs: [
        doc({ id: "p-time-1", title: "Ferieregler og -planlegging", state: "approved", owner: P.ma, version: "1.4", read: 16, summary: "Hvordan ferie søkes og fordeles, og hvordan høytider håndteres." }),
        doc({ id: "p-time-2", title: "Egenmelding og sykefravær", state: "approved", owner: P.et, version: "1.2", read: 13 }),
        doc({ id: "p-time-3", title: "Personalgoder og rabatter", state: "outdated", owner: P.et, version: "1.0", updated: "1. des 2025", read: 11, due: "Forfalt 1. mai", summary: "Oversikt over goder. Nye satser fra 2026 mangler." }),
      ]},
      { id: "p-conduct", n: 6, title: "Rettigheter og varsling", icon: "scale", state: "in_progress", docs: [
        doc({ id: "p-conduct-1", title: "Rettigheter og plikter", state: "approved", owner: P.et, version: "1.1", read: 12 }),
        doc({ id: "p-conduct-2", title: "Varslingsrutine", state: "review", owner: P.sl, version: "1.0", updated: "28. mai 2026", read: 6, due: "4. jun 2026", comments: 2, summary: "Trygg vei for å varsle om kritikkverdige forhold. Utarbeidet med tillitsvalgt." }),
      ]},
      { id: "p-rep", n: 7, title: "Tillitsvalgt og medvirkning", icon: "users", state: "todo", docs: [] },
    ],
  };

  // ════════════════════ SYSTEMMANUAL ════════════════════
  const system = {
    id: "system", name: "Systemmanual", short: "System", icon: "sliders",
    accent: "#c2410c",
    tagline: "Slik fungerer Smartout",
    desc: "Produktmanualen for Smartout selv — moduler, roller, XP, rang, ansiennitet, vaktansvar, daglig rack-sjekk, telemetri og datapolicy. Onboarding og kilde til sannhet for hvordan systemet brukes.",
    health: 88, owner: P.et,
    chapters: [
      { id: "sy-grunn", n: 1, title: "Grunnlag", icon: "flag", state: "completed", docs: [
        doc({ id: "sy-oversikt", title: "Systemoversikt", state: "approved", owner: P.et, version: "2.1", read: 21, summary: "Hva Smartout er, hvilke deler det består av, og hvordan mennesker, oppgaver, vakter, kunnskap og etterlevelse henger sammen i ett operativsystem." }),
        doc({ id: "sy-formaal", title: "Formål med manualen", state: "approved", owner: P.et, version: "1.4", read: 18, summary: "Hvorfor manualen finnes, hvem den er for, og hvordan den brukes som Smartouts levende kilde til sannhet." }),
      ]},
      { id: "sy-roller", n: 2, title: "Roller og onboarding", icon: "cap", state: "completed", docs: [
        doc({ id: "sy-onboarding", title: "Rollebasert onboarding", state: "approved", owner: P.ma, version: "1.8", read: 16, summary: "Eget startløp for hver rolle — Ansatt, Vaktansvarlig, Leder, Admin og Eier — med hva du må forstå, sette opp og følge." }),
      ]},
      { id: "sy-moduler", n: 3, title: "Moduler og bruk", icon: "layers", state: "completed", docs: [
        doc({ id: "sy-modulbibliotek", title: "Modulbibliotek", state: "approved", owner: P.et, version: "2.0", read: 14, summary: "Hver hovedmodul i Smartout — Vaktliste, Oppgaver, Rutiner, IK-mat, Vaktbytte m.fl. — hva den gjør, hvem som eier den, og hvordan den kobles." }),
        doc({ id: "sy-bruk", title: "Funksjonalitet og bruksmønstre", state: "approved", owner: P.ma, version: "1.3", read: 11, summary: "Praktiske eksempler fra virkeligheten — fra onboarding og rutiner til vaktbytte, avvik og XP etter verifisert arbeid." }),
      ]},
      { id: "sy-utvikling", n: 4, title: "Rang, XP og ansiennitet", icon: "trendUp", state: "in_progress", docs: [
        doc({ id: "sy-rang", title: "Rangsystemet", state: "approved", owner: P.et, version: "1.6", read: 13, summary: "Profesjonell progresjonsmodell fra Beginner til Lead, knyttet til ekte arbeid, ansvar, ferdigheter og verifiserte hendelser." }),
        doc({ id: "sy-xp", title: "XP og ansiennitet", state: "approved", owner: P.et, version: "1.5", read: 12, summary: "Forskjellen på XP (aktivitet nå) og ansiennitet (langsiktig tillit), hvilke data som påvirker dem, og hva som krever godkjenning." }),
        doc({ id: "sy-eksamen", title: "Ansiennitetseksamen", state: "review", owner: P.sk, version: "1.1", updated: "27. mai 2026", read: 6, due: "3. jun 2026", comments: 1, summary: "Hvordan ansatte validerer forståelsen av ansvar, rutiner, sikkerhet og IK-mat før de får vaktansvar." }),
      ]},
      { id: "sy-drift", n: 5, title: "Daglig drift", icon: "shield", state: "completed", docs: [
        doc({ id: "sy-vaktansvarlig", title: "Daglig vaktansvarlig-sjekk", state: "approved", owner: P.ma, version: "1.7", read: 17, summary: "Hver dag må ha én tildelt vaktansvarlig. Slik sjekker Smartout det automatisk, foreslår kandidater og varsler manglende dekning." }),
        doc({ id: "sy-rack", title: "Daglig rack-sjekk", state: "approved", owner: P.ma, version: "1.4", read: 15, summary: "Driftsklar-sjekken som verifiserer at vakter, ansvar, rutiner, oppgaver, sertifikater og IK-mat er på plass før dagen starter." }),
      ]},
      { id: "sy-styring", n: 6, title: "System og styring", icon: "sliders", state: "in_progress", docs: [
        doc({ id: "sy-telemetri", title: "Telemetri og hendelser", state: "approved", owner: P.et, version: "1.9", read: 9, summary: "Hvordan Smartout lytter til systemhendelser og oversetter verifiserte handlinger til skår, progresjon, automasjon og rapportering." }),
        doc({ id: "sy-governance", title: "Gamification-styring", state: "approved", owner: P.sk, version: "1.2", read: 8, summary: "Gamification som et kontrollert tilbakemeldingssystem for vekst, ansvar, kvalitet og tillit — med tak, nedkjøling og kategoribalanse." }),
        doc({ id: "sy-pipes", title: "Pipe-ansvar", state: "draft", owner: P.et, version: "1.0", updated: "29. mai 2026", read: 3, due: "6. jun 2026", summary: "Eierskapskjedene som flytter arbeid, data og godkjenninger gjennom systemet — med eier, innspill, handling, utfall og eskalering." }),
        doc({ id: "sy-data", title: "Datapolicy", state: "approved", owner: P.et, version: "1.3", read: 10, summary: "Hvordan Smartout håndterer data — fra profil og vakter til telemetri, XP og revisjonslogg — med innsyn, retting og oppbevaring." }),
      ]},
      { id: "sy-ref", n: 7, title: "Avtaler og referanse", icon: "file", state: "completed", docs: [
        doc({ id: "sy-avtaler", title: "Avtaler", state: "approved", owner: P.et, version: "1.1", read: 12, summary: "Avtalemaler: systembruk, databehandling, rolleansvar, vaktansvar, sertifisering, vaktbytte og åpenhet om XP og rang." }),
        doc({ id: "sy-ordliste", title: "Ordliste", state: "approved", owner: P.ma, version: "1.5", read: 14, summary: "Sentrale Smartout-begreper forklart kort — fra trigger-token til ansiennitet og anti-gaming-kontroll." }),
      ]},
    ],
  };

  // ════════════════════ OPPLÆRINGSHÅNDBOK (menykunnskap & quiz) ════════════════════
  // Training is produced here: a menu is captured (foto/PDF/lenke/tekst), Botsson reads
  // it, the manager verifies + adds local knowledge, and a playable quiz is built.
  // training:true unlocks the menu-capture production flow + the training cockpit.
  const opplaering = {
    id: "opplaering", name: "Opplæringshåndbok", short: "Opplæring", icon: "cap",
    accent: "#b7791f",
    tagline: "Det vi serverer, kan vi",
    desc: "Menykunnskap, vin og drikke, allergener og service — fanget rett fra menyene og krydret med vår egen lokale kunnskap. Botsson bygger spillbare quizer, og staben blir skiftklar før service.",
    health: 71, owner: P.ma, training: true,
    chapters: [
      { id: "o-mat", n: 1, title: "Menykunnskap — mat", icon: "utensils", state: "in_progress", docs: [
        doc({ id: "o-mat-1", title: "Vintermeny — retter & råvarer", state: "approved", owner: P.jh, version: "2.0", updated: "30. mai 2026", read: 11, quiz: true, source: "foto", summary: "5 hovedretter med råvarer, tilberedning, allergener og lokal historie. Spillbar quiz publisert til staben — snitt 87 %." }),
        doc({ id: "o-mat-2", title: "Lunsjmeny uke 22", state: "draft", owner: P.ma, version: "0.3", updated: "i dag", read: 0, source: "foto", summary: "Fanget fra foto i dag. Botsson har lest 6 retter — allergener venter på din bekreftelse før quizen bygges." }),
        doc({ id: "o-mat-3", title: "Signaturretter og historien bak", state: "review", owner: P.jh, version: "1.1", updated: "27. mai 2026", read: 4, due: "2. jun 2026", comments: 2, summary: "Opprinnelse, leverandører og «slik sier vi det her» — det som gjør rettene våre lokale." }),
      ]},
      { id: "o-drikke", n: 2, title: "Vin, cocktail & øl", icon: "wallet", state: "in_progress", docs: [
        doc({ id: "o-drikke-1", title: "Vinkart — druer, regioner & paring", state: "review", owner: P.sl, version: "1.0", updated: "28. mai 2026", read: 5, due: "3. jun 2026", comments: 1, quiz: true, source: "pdf", summary: "22 viner med drue, region, tasting-notater og paring. 4 fakta er ubekreftet og svekker quiz-presisjonen." }),
        doc({ id: "o-drikke-2", title: "Cocktailkart — metode & garnityr", state: "approved", owner: P.sl, version: "1.3", read: 9, quiz: true, source: "tekst", summary: "Ingredienser, glass, metode (rørt/ristet) og mersalgsøyeblikk for husets cocktailer." }),
        doc({ id: "o-drikke-3", title: "Ølkart", state: "draft", owner: P.pk, version: "0.4", updated: "26. mai 2026", read: 1, source: "lenke", summary: "Tappeøl og flaskeøl — bryggeri, prosent og paring. Importert fra leverandørlenke, må verifiseres." }),
      ]},
      { id: "o-allergen", n: 3, title: "Allergener & mattrygghet", icon: "alert", state: "in_progress", docs: [
        doc({ id: "o-allergen-1", title: "De 14 allergenene i praksis", state: "approved", owner: P.sk, version: "1.2", read: 14, quiz: true, summary: "Hva hvert allergen er, hvor det skjuler seg på menyen, og hvordan vi snakker om det med gjesten." }),
        doc({ id: "o-allergen-2", title: "Allergener per rett", state: "review", owner: P.sk, version: "1.0", updated: "29. mai 2026", read: 6, due: "1. jun 2026", comments: 1, summary: "Oppslagstabell koblet til menyen. Sikkerhetskritisk — godkjennes av kvalitetsleder før publisering." }),
        doc({ id: "o-allergen-3", title: "Trygg kommunikasjon ved matallergi", state: "draft", owner: P.sl, version: "0.6", read: 2, due: "5. jun 2026", summary: "Hva servitøren sier og gjør ved oppgitt allergi — fra bestilling til kjøkken til servering." }),
      ]},
      { id: "o-service", n: 4, title: "Service & mersalg", icon: "star", state: "in_progress", docs: [
        doc({ id: "o-service-1", title: "Beste anbefaling til førstegangsgjest", state: "approved", owner: P.ma, version: "1.1", read: 12, quiz: true, summary: "Hvordan staben beskriver rettene med selvtillit og foreslår den lokale favoritten." }),
        doc({ id: "o-service-2", title: "Mersalg uten å presse", state: "draft", owner: P.ma, version: "0.5", updated: "25. mai 2026", read: 3, due: "7. jun 2026", summary: "Naturlige paringer og oppgraderinger — et glass til retten, dessert i stedet for kaffe." }),
      ]},
      { id: "o-onboard", n: 5, title: "Velkomstquiz for nyansatte", icon: "cap", state: "todo", optional: true, docs: [] },
    ],
  };

  const HANDBOOKS = [bedrift, hms, personal, system, opplaering];

  // overall + per-book health metrics for the dashboard
  const allDocs = HANDBOOKS.flatMap(h => h.chapters.flatMap(c => c.docs));
  const HB_HEALTH = {
    score: 78,
    total: allDocs.length,
    approved: allDocs.filter(d => d.state === "approved").length,
    review: allDocs.filter(d => d.state === "review").length,
    draft: allDocs.filter(d => d.state === "draft").length,
    outdated: allDocs.filter(d => d.state === "outdated").length,
    overdue: allDocs.filter(d => d.due && /forfalt/i.test(d.due)).length,
  };

  // missing documentation + improvement suggestions (Botsson-detected)
  const HB_GAPS = [
    { id: "g1", kind: "missing", sev: "crit", book: "hms", icon: "alert", title: "Beredskapsplan mangler godkjenning", why: "Lovpålagt dokument står som utkast. Uten godkjent beredskapsplan er internkontrollen ufullstendig.", action: "Fullfør og send til godkjenning", owner: P.et },
    { id: "g2", kind: "outdated", sev: "warn", book: "hms", icon: "history", title: "Stoffkartotek er 16 måneder gammelt", why: "Tre nye rengjøringsmidler er tatt i bruk uten registrert sikkerhetsdatablad.", action: "Oppdater kjemikalieoversikt", owner: P.ib },
    { id: "g3", kind: "owner", sev: "warn", book: "bedrift", icon: "user", title: "Kapittel «Slik jobber vi her» mangler eier", why: "Ingen er ansvarlig for innholdet, så det blir ikke fulgt opp eller revidert.", action: "Sett ansvarlig", owner: null },
    { id: "g4", kind: "outdated", sev: "warn", book: "bedrift", icon: "history", title: "Dagsoppgjør viser til gammelt kassesystem", why: "Rutinen beskriver et system dere ikke lenger bruker. Kan skape feil i oppgjøret.", action: "Oppdater rutine", owner: P.et },
    { id: "g5", kind: "improve", sev: "info", book: "personal", icon: "sparkle", title: "Onboarding kan kobles til kompetansematrisen", why: "Botsson ser at opplæringspunktene i onboarding overlapper med HMS-kompetanse. Å koble dem hindrer dobbeltarbeid.", action: "Se forslag", owner: P.ma },
    { id: "g6", kind: "missing", sev: "info", book: "personal", icon: "plus", title: "Kapittel «Tillitsvalgt og medvirkning» er tomt", why: "Personalhåndboken bør beskrive medvirkning og partssamarbeid.", action: "Start kapittel", owner: P.ma },
  ];

  // Botsson-foreslåtte dokumenter per kapittel — det som typisk mangler eller
  // er lurt å ha. Hver: { title, why, conf } (conf = anbefalt metode-styrke).
  // Vises i "Lag nytt dokument"-velgeren når et kapittel er valgt.
  const HB_SUGGEST = {
    // ---- Bedrift ----
    "b-org": [
      { title: "Organisasjonskart", why: "Visuell oversikt over avdelinger og rapporteringslinjer." },
      { title: "Åpningstider og kontaktinfo", why: "Samlet kontaktkort for drift, presse og leverandører." },
    ],
    "b-roles": [
      { title: "Bartender / barsjef", why: "Bar mangler en egen rollebeskrivelse — de andre rollene har det." },
      { title: "Stedfortrederordning", why: "Hvem trår inn når driftsleder er borte. Bør være avklart." },
    ],
    "b-flow": [
      { title: "Stengerutine — kjøkken og sal", why: "Botsson finner ingen egen stengesjekkliste, bare åpning." },
      { title: "Håndtering av store bookinger", why: "Selskaper over 20 gjester trenger en egen flyt." },
    ],
    "b-tools": [
      { title: "Bestillingssystem for varer", why: "Rutine for hvordan og når varer bestilles." },
      { title: "Wi-Fi, skjermer og musikk", why: "Praktisk oppsett for gjesteopplevelsen." },
    ],
    "b-how": [
      { title: "Verdiene våre i praksis", why: "Kapitlet er tomt — start med hva verdiene betyr i en vakt." },
      { title: "Slik tar vi imot gjester", why: "Felles standard for gjestemøtet, fra dør til betaling." },
    ],
    // ---- HMS (lovpålagt — sterke anbefalinger) ----
    "h-intro": [
      { title: "HMS-mål for året", why: "Konkrete, målbare mål gjør internkontrollen etterprøvbar.", conf: "med" },
    ],
    "h-roles": [
      { title: "Verneombudets årshjul", why: "Når vernerunder, møter og gjennomganger skal skje.", conf: "med" },
      { title: "AMU / partssamarbeid", why: "Beskriv hvordan ansatte medvirker i HMS-arbeidet." },
    ],
    "h-risk": [
      { title: "Risikovurdering — sal og gjester", why: "Kjøkken og bar er dekket, men ikke sal/servering.", conf: "high" },
      { title: "Risikovurdering — alenearbeid", why: "Kvelds- og nattarbeid alene er en kjent risiko som bør vurderes.", conf: "high" },
      { title: "Ergonomi og tunge løft", why: "Belastningsskader er vanligst i bransjen — mangler i dag." },
    ],
    "h-proc": [
      { title: "Allergenhåndtering", why: "Lovpålagt under matinformasjonsforskriften — Botsson finner ingen egen prosedyre.", conf: "high" },
      { title: "Sikker bruk av kjøkkenmaskiner", why: "Kuttemaskin, mikser og frityre bør ha en egen sikker rutine.", conf: "med" },
      { title: "Trygg håndtering av varm olje", why: "Hyppig skadeårsak. Knyttes til opplæring av nyansatte." },
    ],
    "h-dev": [
      { title: "Eskaleringsmatrise for avvik", why: "Når et avvik skal løftes til leder, eier eller tilsyn." },
      { title: "Årsaksanalyse (5 hvorfor)", why: "Mal for å finne rotårsak på gjentakende avvik." },
    ],
    "h-insp": [
      { title: "Sjekkliste egenkontroll månedlig", why: "Lettere internkontroll mellom de store vernerundene." },
      { title: "Oppfølgingsplan etter vernerunde", why: "Sikrer at funn faktisk lukkes med frist og ansvarlig.", conf: "med" },
    ],
    "h-fire": [
      { title: "Evakueringsplan med møteplass", why: "Branninstruksen finnes, men ikke en egen evakueringsplan.", conf: "high" },
      { title: "Logg — kontroll av slukkeutstyr", why: "Dokumentér årlig kontroll av apparater og slanger." },
    ],
    "h-emerg": [
      { title: "Beredskapsplan — alvorlig hendelse", why: "Står som utkast og er lovpålagt. Bør fullføres og godkjennes.", conf: "high" },
      { title: "Varslingsliste ved krise", why: "Hvem ringes i hvilken rekkefølge — nødnummer, eier, pårørende.", conf: "high" },
      { title: "Tiltakskort — kutt, brannskade, kvelning", why: "Korte handlingskort til oppslag på kjøkkenet." },
    ],
    "h-train": [
      { title: "Årlig HMS-opplæringsplan", why: "Hvem skal ha hvilken opplæring, og når den fornyes.", conf: "med" },
      { title: "Logg — gjennomført opplæring", why: "Dokumentér at opplæring faktisk er gitt og forstått." },
    ],
    "h-improve": [
      { title: "Forbedringsforslag fra ansatte", why: "Kapitlet er tomt — start en enkel rutine for innspill." },
    ],
    // ---- Personal ----
    "p-culture": [
      { title: "Kjøreregler for sosiale medier", why: "Hvordan ansatte omtaler jobben offentlig." },
    ],
    "p-employ": [
      { title: "Sjekkliste ved oppsigelse / sluttsamtale", why: "Ryddig avslutning — utstyr, tilgang og erfaringer." },
      { title: "Mal: midlertidig ansettelse / ekstrahjelp", why: "Egen kontraktsmal for tilkallingsvakter." },
    ],
    "p-onboard": [
      { title: "30-60-90-dagers oppfølging", why: "Strukturerte sjekkpunkter etter onboardingens første måned." },
    ],
    "p-follow": [
      { title: "Mal: utviklingsplan", why: "Konkret plan for ansatte som vil ta fagbrev eller mer ansvar." },
      { title: "Lønnssamtale — rammer og prosess", why: "Forutsigbarhet rundt lønnsutvikling." },
    ],
    "p-time": [
      { title: "Permisjonsreglement", why: "Velferdspermisjon, omsorgsdager og ulønnet permisjon mangler." },
      { title: "Personalgoder 2026 — oppdatert", why: "Gjeldende dokument er forfalt; nye satser mangler.", conf: "med" },
    ],
    "p-conduct": [
      { title: "Retningslinje mot trakassering", why: "Konkretiserer varslingsrutinen med forebygging og håndtering.", conf: "med" },
    ],
    "p-rep": [
      { title: "Tillitsvalgtordningen hos oss", why: "Kapitlet er tomt — beskriv valg, rolle og møtepunkter." },
      { title: "Drøftings- og informasjonsmøter", why: "Hvordan partene møtes jevnlig." },
    ],
    // ---- Opplæring (lag helst fra meny) ----
    "o-mat": [
      { title: "Dagens & sesongretter", why: "Faste retter er dekket, men dagens/sesong skifter ofte og bør ha egen mini-quiz." },
      { title: "86-liste og utsolgt-rutine", why: "Hva staben sier når en rett er utsolgt — og hva de foreslår i stedet." },
    ],
    "o-drikke": [
      { title: "Alkoholfrie alternativer", why: "Stadig flere gjester spør — bør være en del av drikkekunnskapen.", conf: "med" },
      { title: "Kaffe, te og avec", why: "Avslutningen på måltidet mangler egen kunnskapsmodul." },
    ],
    "o-allergen": [
      { title: "Krysskontaminering på kjøkkenet", why: "Lovpålagt forståelse — hvordan vi unngår at allergener smitter mellom retter.", conf: "high" },
      { title: "Gluten- og melkefrie tilpasninger", why: "Hvilke retter kan tilpasses, og hvordan det bestilles inn til kjøkkenet." },
    ],
    "o-service": [
      { title: "Håndtering av matallergi ved bordet", why: "Konkret scenario-trening fra gjest oppgir allergi til retten er servert trygt.", conf: "med" },
      { title: "Vinanbefaling per rett", why: "Koble menyen og vinkartet — én trygg paring per hovedrett." },
    ],
    "o-onboard": [
      { title: "Velkomstquiz for nyansatte", why: "Kapitlet er tomt — en kort meny-intro nyansatte tar første uke." },
    ],
  };

  const HB_TEMPLATES = [
    { id: "t1", title: "Risikovurdering", book: "hms", icon: "alert", used: 4 },
    { id: "t2", title: "Prosedyre / sikker rutine", book: "hms", icon: "clipcheck", used: 9 },
    { id: "t3", title: "Avviksbehandling", book: "hms", icon: "swap", used: 12 },
    { id: "t4", title: "Rollebeskrivelse", book: "bedrift", icon: "user", used: 6 },
    { id: "t5", title: "Medarbeidersamtale", book: "personal", icon: "users", used: 3 },
    { id: "t6", title: "Onboardingplan", book: "personal", icon: "cap", used: 2 },
    { id: "t7", title: "Menykunnskap fra meny", book: "opplaering", icon: "camera", used: 5 },
  ];

  window.SmartoutData = Object.assign(window.SmartoutData || {}, {
    HB_PEOPLE: P, HB_STATUS: ST, HANDBOOKS, HB_HEALTH, HB_GAPS, HB_TEMPLATES, HB_SUGGEST,
  });
})();
