import type { JSONContent } from "@tiptap/core";

export type Template = {
  id: string;
  title: string;
  description: string;
  content: JSONContent;
};

// --- Helpers ---

function heading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text: string): JSONContent {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function bold(text: string): JSONContent {
  return { type: "text", text, marks: [{ type: "bold" }] };
}

function paragraphWithBold(boldText: string, rest: string): JSONContent {
  return {
    type: "paragraph",
    content: [bold(boldText), { type: "text", text: rest }],
  };
}

function bulletList(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function doc(...nodes: JSONContent[]): JSONContent {
  return { type: "doc", content: nodes };
}

// --- Chapter Templates ---

const identityMission: Template[] = [
  {
    id: "identity-mission-standard",
    title: "Misjon og servicelofte",
    description: "Standard mal for restaurantens identitet, misjon og servicelofte",
    content: doc(
      heading(1, "Var identitet og misjon"),
      heading(2, "Misjonserklaering"),
      paragraph(
        "Vi skaper gjestfrihet som gjor at gjester foler seg velkomne fra forste oyeblikk. Vart mal er a levere matopplevelser av hoy kvalitet i et miljo preget av varme og profesjonalitet.",
      ),
      heading(2, "Servicelofte"),
      paragraph("Hvert besok skal oppleves personlig, konsistent og minneverdig. Vi lover:"),
      bulletList([
        "Vennlig og oppmerksom service fra ankomst til avreise",
        "Mat tilberedt med ferske, kvalitetssikrede ravarar",
        "Et rent, trygt og innbydende miljo til enhver tid",
        "Raske og profesjonelle losninger nar noe gar galt",
      ]),
      heading(2, "Readiness-definisjon"),
      paragraph(
        'En ansatt er "klar" nar alle tildelte policyer er laert og alle protokoller er fullfort. Readiness-score = prosentandel fullforte protokolltildelinger.',
      ),
      heading(2, "Merkevaretone og kommunikasjonsstil"),
      paragraph(
        "Vi kommuniserer varmt, direkte og profesjonelt. Vi bruker et uformelt men respektfullt sprak — bade med gjester og med hverandre.",
      ),
    ),
  },
];

const organizationModel: Template[] = [
  {
    id: "org-model-restaurant",
    title: "Restaurantorganisasjon",
    description: "Standard organisasjonsmodell med avdelinger, team og roller",
    content: doc(
      heading(1, "Organisasjonsmodell"),
      heading(2, "Avdelinger"),
      bulletList([
        "Kjokken — Matproduksjon og mise en place",
        "Restaurant (sal/servering) — Gjesteservice og salgsarbeid",
        "Bar — Drikkeservering og cocktailproduksjon",
        "Catering — Eksternt arrangement og leveranse",
        "Renhold — Hygiene og vedlikehold av lokaler",
        "Event — Spesialarrangementer og eventplanlegging",
      ]),
      heading(2, "Roller og rollestige"),
      paragraphWithBold("Lederroller: ", "Kjokkenleder, Salleder, Barleder"),
      paragraphWithBold("Kjerneoperatorer: ", "Kokk, Servitor, Bartender, Renholder"),
      paragraphWithBold("Stotteoperatorer: ", "Assistent, Runner, Barback"),
      paragraphWithBold("Spesialister: ", "Sommelier, Eventkoordinator"),
      heading(2, "Team og ledertilordning"),
      bulletList([
        "Kjokkenteam — Leder: Kjokkenleder",
        "Salteam — Leder: Salleder",
        "Barteam — Leder: Barleder",
        "Lederteam — Alle avdelingsledere + daglig leder",
      ]),
      heading(2, "Beslutningsmyndighet"),
      paragraph(
        "Hver avdelingsleder har beslutningsmyndighet innenfor sin avdeling. Tverrgaende beslutninger eskaleres til lederteamet. Budsjettrammer og personalendringer godkjennes av daglig leder.",
      ),
    ),
  },
  {
    id: "org-model-workforce",
    title: "Arbeidsstyrkemodell",
    description: "Kohorter, kontrakter og bemanningsprinsipper",
    content: doc(
      heading(1, "Arbeidsstyrke og kohorter"),
      heading(2, "Arbeidsstyrkesammensetning"),
      paragraph("Restauranten opererer med en sammensatt arbeidsstyrke tilpasset bransjen:"),
      bulletList([
        "Voksne morsmalsbrukere — fulltid og deltid",
        "Ikke-morsmalsbrukere — tilpasset opplaering og kommunikasjon",
        "Mindrearige laerlinger — med lovpalagte vaktbegrensninger",
        "Pensjonister pa deltid — fleksibel bemanning",
        "Frilansere og tilkallingsvikarer — ved behov",
      ]),
      heading(2, "Kontraktsrammer"),
      paragraph(
        "Ansettelseskontrakter er knyttet til rollekategori. Hver rolle har definert minimumskompetanse og protokolltildelinger som ma fullores for a oppna full readiness.",
      ),
      heading(2, "Vaktplanforutsetninger"),
      bulletList([
        "Tre-maneders rullerende vaktplan som grunnlinje",
        "Kohort-bevisste vaktbegrensninger (mindrearige, gravide, etc.)",
        "Dag- og timevariansmodell for sesongbemanng",
        "Helg- og eventbelastning handtert med tilleggsressurser",
      ]),
    ),
  },
];

const dailyOperations: Template[] = [
  {
    id: "daily-ops-standard",
    title: "Daglig driftsmodell",
    description: "Apning, service og stenging med kontrollpunkter",
    content: doc(
      heading(1, "Daglig driftsmodell"),
      heading(2, "Apningssekvens"),
      paragraph("Trigger: Planlagt pre-open-vindu. Vaktleder aktiverer apningssesjon."),
      bulletList([
        "Miljokontroll — Temperatur, lys, musikk, renhold bekreftet",
        "Bemanningskontroll — Alle planlagte pa plass, erstatning ved frafall",
        "System- og utstyrskontroll — POS, bestillingssystem, kjoleutstyr verifisert",
        "Apningssjekkliste fullfort og signert av vaktleder",
      ]),
      heading(2, "Midt-service kontroll"),
      paragraphWithBold(
        "Service readiness: ",
        "Rolledekning validert, ingen kritiske hull i obligatoriske roller.",
      ),
      bulletList([
        "Kapasitetssjekk mot ettersporselsestimat",
        "Allergenbriefing gjennomfort ved skiftstart",
        "Kryssforurensningskontroll aktiv mellom kjokken og sal",
      ]),
      heading(2, "Stenge- og overleveringssekvens"),
      paragraph("Trigger: Planlagt lukkevindu. Stengingsmodus aktiveres."),
      bulletList([
        "Oppgavelukking — Alle asstatte oppgaver fullfort",
        "Kassaoppgjor og verdihandtering",
        "Hygienelukking — Renhold etter stengestandard",
        "Sikkerhetskontroll — Lasing, alarm, kameraer",
        "Stengingsbekreftelse og overleveringsrapport signert",
      ]),
      heading(2, "Eventdags-varianter"),
      paragraph(
        "Ved spesialarrangementer aktiveres utvidede sjekklister med ekstra bemanning, justert mise en place og dedikert eventkoordinator.",
      ),
    ),
  },
  {
    id: "daily-ops-pipelines",
    title: "Driftspipeliner",
    description: "Event Motor-baserte pipeliner for daglig drift",
    content: doc(
      heading(1, "Driftspipeliner"),
      paragraph(
        "Hver pipeline folger monsteret: Start-Hook -> Utforing -> Verifiseringsport -> Stopp-Hook",
      ),
      heading(2, "Apningspipeline"),
      bulletList([
        "Start-hook: Vaktleder aktiverer apningssesjon",
        "Utforing: Miljo-, bemannings- og systemkontroller",
        "Verifiseringsport: Alle apningspunkter fullfort",
        "Stopp-hook: Apningsbekreftelse signert",
      ]),
      heading(2, "Temperaturkontrollpipeline"),
      bulletList([
        "Trigger: Planlagte intervaller + varemottak",
        "Utforing: Temperaturmaling, terskelsjekk, umiddelbare korrigeringer",
        "Verifiseringsport: Alle loggforinger registrert, avvik behandlet",
        "Stopp-hook: Signert logg og avviksavslutning",
      ]),
      heading(2, "Lukke- og overleveringspipeline"),
      bulletList([
        "Trigger: Planlagt lukkevindu",
        "Utforing: Oppgavelukking, kasse, hygiene, sikkerhet",
        "Verifiseringsport: Alle obligatoriske lukkekontroller fullfort",
        "Stopp-hook: Lukkebekreftelse og overleveringsrapport",
      ]),
    ),
  },
];

const safetyCompliance: Template[] = [
  {
    id: "safety-compliance-full",
    title: "Sikkerhets- og etterlevelsespolicyer",
    description: "Komplett sett med mattrygghet, hygiene, allergen og brannvern",
    content: doc(
      heading(1, "Sikkerhet og etterlevelse"),
      heading(2, "Mattrygghet"),
      paragraphWithBold(
        "Temperaturovervaking og kaldkjede: ",
        "Alle kjolevarer skal holde korrekt temperatur gjennom hele verdikjeden. Avvik loggfores umiddelbart.",
      ),
      paragraphWithBold(
        "Sporbarhet og avvikshandtering: ",
        "Alle ravarar skal kunne spores tilbake til leverandor. Ved avvik folges tilbaketrekkingsprosessen.",
      ),
      heading(2, "Hygiene og renhold"),
      bulletList([
        "Handvaskrutine ved hvert stasjonsskifte og etter pause",
        "Overflatedesinfisering minimum hver time i produksjonssoner",
        "Rengjoringsplan med signering for alle soner",
        "Personlig hygiene: Rent toey, harbunn/nett, ingen smykker",
      ]),
      heading(2, "Allergenhandtering og merking"),
      bulletList([
        "Oppdatert allergenliste synlig for alt kjokken- og salpersonale",
        "Allergenbriefing ved hvert skiftstart",
        "Eksplisitt kommunikasjon mellom sal og kjokken ved allergenbestillinger",
        "Kryssforurensningskontroller ved tilberedning og servering",
      ]),
      heading(2, "Skjenkekontroll og aldersgrense"),
      bulletList([
        "Legitimasjonssjekk ved minste tvil — 18 ar for ol/vin, 20 ar for sprit",
        "Ansvarlig alkoholservering — avslutningskriterier tydelig kommunisert",
        "Skjenkebevillingsregler gjennomgatt ved onboarding og arlig oppdatering",
      ]),
      heading(2, "Brannvern og evakuering"),
      bulletList([
        "Brannslukkerutstyr kontrollert manedlig",
        "Evakueringsplan oppslatt og gjennomgatt kvartalsvis",
        "Alle ansatte kjenner samlingsplass og evakueringsrute",
        "Brannvarslingstest gjennomfort etter plan",
      ]),
    ),
  },
  {
    id: "safety-mattilsynet",
    title: "Mattilsynet-krav",
    description: "Krav og rutiner knyttet til Mattilsynets forskrifter",
    content: doc(
      heading(1, "Mattilsynet — Krav og rutiner"),
      heading(2, "IK-mat (internkontroll)"),
      paragraph(
        "Virksomheten skal ha et dokumentert internkontrollsystem for mattrygghet. Systemet skal vaere tilgjengelig for alle ansatte og oppdateres minimum arlig.",
      ),
      heading(2, "Temperaturlogging"),
      bulletList([
        "Kjolevarer: Maling ved varemottak og minst 2 ganger daglig",
        "Varmholding: Minst 65°C — kontroll for servering",
        "Nedkjoling: Fra 60°C til under 4°C innen 4 timer",
        "Alle malinger loggfores digitalt med tidsstempel",
      ]),
      heading(2, "Varemottak"),
      bulletList([
        "Temperaturkontroll ved mottak",
        "Visuell kontroll av emballasje og holdbarhet",
        "FIFO-prinsippet (First In, First Out) i alle lager",
        "Avviste varer loggfores med arsak og leverandornotifikasjon",
      ]),
      heading(2, "Minimumsdekning"),
      paragraph(
        "Ingen restaurant skal anses fullt aktivert uten minst en aktiv policy per obligatorisk gruppe, tilhorende verifiseringsmekanisme (sjekkliste/test/bekreftelse), og en definert eskaleringsvei.",
      ),
    ),
  },
];

const communication: Template[] = [
  {
    id: "communication-standard",
    title: "Kommunikasjon og eskalering",
    description: "Kanaler, rapportering og eskaleringsmatrise",
    content: doc(
      heading(1, "Kommunikasjon og eskalering"),
      heading(2, "Vaktkanaler"),
      paragraph("All operativ kommunikasjon under vakt skjer gjennom definerte kanaler:"),
      bulletList([
        "Akutt: Direkte muntlig + varsling i system (brann, allergi, skade)",
        "Operativ: Vaktkanal i meldingssystem (bemanningsendring, utstyrsfeil)",
        "Informativ: Daglig logg og overleveringsrapport",
      ]),
      heading(2, "Hendelsesrapportering"),
      paragraph(
        "Alle hendelser som avviker fra normal drift skal rapporteres umiddelbart. Rapporteringsvei:",
      ),
      bulletList([
        "Observasjon av avvik -> Muntlig varsling til vaktleder",
        "Vaktleder logger hendelse i avvikssystem",
        "Alvorlige hendelser eskaleres til daglig leder innen 30 minutter",
      ]),
      heading(2, "Eskaleringsmatrise"),
      paragraphWithBold(
        "Niva 1 (Operativ): ",
        "Vaktleder loser pa stedet — bemanningshull, sma driftsavvik.",
      ),
      paragraphWithBold(
        "Niva 2 (Taktisk): ",
        "Daglig leder — gjentatte avvik, gjesteklager, personalkonflikt.",
      ),
      paragraphWithBold(
        "Niva 3 (Strategisk): ",
        "Eier/driftsstyre — alvorlige hendelser, mediasaker, myndighetskrav.",
      ),
      heading(2, "Vaktsluttrapportering"),
      paragraph(
        "Ved hvert vaktskifte leveres en kort overleveringsrapport som dekker: Trafikkflyt, avvik, ulosde saker og beskjeder til neste vakt.",
      ),
    ),
  },
];

const onboardingTraining: Template[] = [
  {
    id: "onboarding-standard",
    title: "Onboarding og opplaering",
    description: "Fra pre-boarding til full readiness med milepeler og mentor",
    content: doc(
      heading(1, "Onboarding og opplaering"),
      heading(2, "Pre-boarding sjekkliste"),
      bulletList([
        "Arbeidskontrakt signert og arkivert",
        "Bruker opprettet i system med riktig rolle og avdeling",
        "Velkomstpakke sendt med praktisk informasjon",
        "Mentor tilordnet basert pa rolle og avdeling",
        "Forste vakt planlagt med overlapping for oppfolgning",
      ]),
      heading(2, "Dag 1-7 milepeler"),
      paragraphWithBold(
        "Dag 1: ",
        "Omvisning, introduksjon til team, systeminnlogging, sikkerhetsbriefing.",
      ),
      paragraphWithBold(
        "Dag 2-3: ",
        "Skygging av mentor. Grunnleggende prosedyrer for apning/stenging.",
      ),
      paragraphWithBold(
        "Dag 4-5: ",
        "Forste selvstendige oppgaver under tilsyn. Allergen- og hygieneopplaering.",
      ),
      paragraphWithBold(
        "Dag 6-7: ",
        "Kunnskapstest for grunnleggende policyer. Evaluering med mentor og leder.",
      ),
      heading(2, "Mentormodell"),
      paragraph(
        "Hver ny ansatt far en dedikert mentor i sin avdeling. Mentoren folger opp daglig de forste 7 dagene, ukentlig de neste 3 ukene, og er tilgjengelig for sporsmaler i hele proveperioden.",
      ),
      heading(2, "Readiness-progresjon"),
      paragraph(
        "Readiness males som prosentandel fullforte protokolltildelinger. En trainee promoveres til aktiv status nar alle obligatoriske protokoller er gjennomfort og godkjent.",
      ),
      bulletList([
        "Trainee-modus: Fullstendig brukergrensesnitt, ingen live-pavirkning",
        "Eskalering ved 48 timer uten progresjon",
        "Kunnskapstester kreves for alle sikkerhetskritiske policyer",
      ]),
    ),
  },
  {
    id: "onboarding-journeys",
    title: "Opplaeringsreiser",
    description: "Definerte laeringsreiser per rolle og kompetanseomrade",
    content: doc(
      heading(1, "Opplaeringsreiser"),
      heading(2, "Protokolltildeling per rolle"),
      paragraph(
        "Hver rolle har et definert sett med protokoller som ma fullores. Tildelingen skjer automatisk ved rolleoppsett.",
      ),
      heading(2, "Reise: Ny servitor"),
      bulletList([
        "Grunnleggende hygiene og mattrygghet",
        "Allergenhandtering — teori og praksis",
        "POS-system og bestillingsflyt",
        "Gjesteinteraksjon og servicestandard",
        "Skjenkeregler og alderskontroll",
        "Kassaoppgjor og stengerutiner",
      ]),
      heading(2, "Reise: Ny kokk"),
      bulletList([
        "Mattrygghet og temperaturkontroll",
        "Hygiene i produksjonssone",
        "Allergenhandtering og krysskontaminering",
        "Varemottak og lagring (FIFO)",
        "Mise en place og stasjonsforberedelse",
        "Rengjoring og avfallshandtering",
      ]),
      heading(2, "Kunnskapstester"),
      paragraph(
        "Etter hver protokollmodul gjennomfores en kunnskapstest. Bestaatt test kreves for a ga videre. Resultater lagres og er synlige for leder.",
      ),
    ),
  },
];

const scheduling: Template[] = [
  {
    id: "scheduling-principles",
    title: "Vaktplan og bemanning",
    description: "Planlegging, apne vakter, bytte og overtidsregler",
    content: doc(
      heading(1, "Vaktplan og bemanning"),
      heading(2, "Planleggingsprinsipper"),
      bulletList([
        "Tre-maneders rullerende planhorisont",
        "Bemanningsbehov basert pa sesongbudsjett og dag-/timefaktorer",
        "Kohort-bevisst planlegging (mindrearige, gravide, deltidsansatte)",
        "Helge- og eventbelastning handtert med tilleggsressurser",
      ]),
      heading(2, "Apne vakter og erstatning"),
      paragraph("Nar en vakt star ubemannet folges denne arbeidsflyten:"),
      bulletList([
        "Systemet identifiserer kvalifiserte tilgjengelige ansatte",
        "Automatisk varsling sendes til aktuelle kandidater",
        "Forste aksept bekreftes — andre far avslag",
        "Ved ingen aksept eskaleres til vaktleder for manuell losning",
      ]),
      heading(2, "Vaktbytte og godkjenning"),
      bulletList([
        "Ansatte kan foreslaa bytte via systemet",
        "Byttet valideres automatisk mot kompetansekrav og lovkrav",
        "Leder godkjenner eller avviser — begrunnelse ved avslag",
        "Historikk over bytter loggfores for oppfolging",
      ]),
      heading(2, "Overtid og mindrearige"),
      paragraphWithBold(
        "Overtid: ",
        "Maks 10 timer overtid per 7 dager. Varsling ved 80% av grense.",
      ),
      paragraphWithBold(
        "Mindrearige (under 18): ",
        "Maks 8 timer per dag, ikke etter kl. 23:00. Ingen alkoholservering.",
      ),
    ),
  },
];

const qualityService: Template[] = [
  {
    id: "quality-service-standards",
    title: "Kvalitets- og servicestandarder",
    description: "Gjesteinteraksjon, stasjonsklar og service recovery",
    content: doc(
      heading(1, "Kvalitet og service"),
      heading(2, "Gjesteinteraksjon"),
      paragraph("Hver gjesteinteraksjon skal folge disse prinsippene:"),
      bulletList([
        "Oynekontakt og hilsen innen 30 sekunder etter ankomst",
        "Aktiv lytting — gjenta bestilling for bekreftelse",
        "Proaktiv oppfolging — sjekk tilfredshet etter hovedrett",
        "Personlig avskjed og invitasjon til a komme tilbake",
      ]),
      heading(2, "Stasjonsklar (Station Readiness)"),
      paragraph("Hver stasjon skal vaere fullt klargjort for serviceperioden starter:"),
      bulletList([
        "Mise en place komplett og kvalitetskontrollert",
        "Utstyr rengjort og funksjonskontrollert",
        "Nok materialer for forventet volum + 20% buffer",
        "Allergenliste oppdatert og synlig pa stasjonen",
      ]),
      heading(2, "Service Recovery"),
      paragraph("Nar noe gar galt, handler vi raskt og med empati:"),
      bulletList([
        "Anerkjenn problemet umiddelbart — ikke forsvar eller bagatelliser",
        "Tilby konkret losning innen 2 minutter",
        "Folg opp med gjesten for slutten av besoket",
        "Logg hendelsen for laering og forbedring",
      ]),
      heading(2, "Kvalitetssikringskontroller"),
      bulletList([
        "Daglig mise en place-kontroll for service",
        "Ukentlig mystery guest-evaluering (intern eller ekstern)",
        "Manedlig gjennomgang av gjesteklager og tiltak",
        "Kvartalsvis serviceopplaering for alle kundevendte roller",
      ]),
    ),
  },
];

const incidentResponse: Template[] = [
  {
    id: "incident-response-standard",
    title: "Hendelseshandtering",
    description: "Avvikskategorier, tiltak, korrigering og forebygging",
    content: doc(
      heading(1, "Hendelseshandtering"),
      heading(2, "Avvikskategorier"),
      paragraphWithBold(
        "Kritisk: ",
        "Matforgiftning, alvorlig skade, brann, myndighetspalegg. Umiddelbar eskalering til daglig leder og eventuelt nodtjenester.",
      ),
      paragraphWithBold(
        "Hoy: ",
        "Gjentatt temperaturavvik, allergensvikt, gjesteskade. Eskalering innen 30 minutter.",
      ),
      paragraphWithBold(
        "Medium: ",
        "Driftsavbrudd, utstyrsfeil, bemanningshull. Handteres av vaktleder.",
      ),
      paragraphWithBold("Lav: ", "Mindre prosessavvik, forsinkelser. Loggfores for trendanalyse."),
      heading(2, "Umiddelbar inneslutning"),
      bulletList([
        "Stopp kilden til avviket umiddelbart",
        "Sikre gjester og ansatte",
        "Dokumenter situasjonen (foto, tidspunkt, involverte)",
        "Varsle riktig niva ifolge eskaleringsmatrisen",
      ]),
      heading(2, "Korrigerende tiltak"),
      paragraph("Etter inneslutning utpekes en eier for korrigerende tiltak:"),
      bulletList([
        "Rotersaksanalyse — hva gikk galt og hvorfor",
        "Definere korrigerende handling med tidsfrist",
        "Validere at tiltaket faktisk loser problemet",
        "Oppdatere relevant prosedyre eller sjekkliste",
      ]),
      heading(2, "Lukking og forebygging"),
      bulletList([
        "Saken lukkes forst nar korrigerende tiltak er verifisert",
        "Forebyggende notater legges til for fremtidig referanse",
        "Trender analyseres manedlig for systemiske problemer",
        "Relevante laerdommer deles med teamet i neste briefing",
      ]),
    ),
  },
  {
    id: "incident-deviation-pipeline",
    title: "Avvikspipeline",
    description: "Steg-for-steg flyt for avvikshandtering",
    content: doc(
      heading(1, "Avvikspipeline"),
      paragraph("Pipeline for hendelser og avvik folger Event Motor-monsteret:"),
      heading(2, "1. Trigger"),
      paragraph("Avvikspipelinen aktiveres ved oppdaget policybrudd eller rapportert hendelse."),
      heading(2, "2. Start-hook: Avvikssak opprettes"),
      bulletList([
        "Automatisk saksnummer tildeles",
        "Kategori og alvorlighetsgrad settes",
        "Ansvarlig eier utpekes basert pa avdeling og type",
      ]),
      heading(2, "3. Utforing"),
      bulletList([
        "Klassifiser alvorlighetsgrad",
        "Gjennomfor innesluttingstiltak",
        "Tildel eier for korrigerende handling",
        "Definer og implementer korreksjon",
      ]),
      heading(2, "4. Verifiseringsport"),
      paragraph("Korrigerende tiltak ma valideres av leder for saken kan lukkes."),
      heading(2, "5. Stopp-hook: Sak lukket"),
      paragraph("Saken lukkes med forebyggende notater. Rapporten arkiveres for trendanalyse."),
    ),
  },
];

const kpiReview: Template[] = [
  {
    id: "kpi-review-cadence",
    title: "KPI og gjennomgangssyklus",
    description: "Daglig, ukentlig og manedlig review med ansvar",
    content: doc(
      heading(1, "KPI og gjennomgang"),
      heading(2, "Daglig operativ gjennomgang"),
      paragraph("Gjennomfores av vaktleder ved slutten av hver dag:"),
      bulletList([
        "Omsetning vs. budsjett (dag og kumulativ)",
        "Bemanningsgrad — faktisk vs. planlagt",
        "Antall avvik registrert og status",
        "Gjestetilfredshet — umiddelbar tilbakemelding",
        "Temperatur- og hygienekontroller fullfort",
      ]),
      heading(2, "Ukentlig arbeidsstyrke- og etterlevelsesreview"),
      paragraph("Gjennomfores av daglig leder med avdelingsledere:"),
      bulletList([
        "Sykefravear og vakttapto timer",
        "Overtidsbruk vs. grenser",
        "Onboarding-progresjon for nye ansatte",
        "Apne avvik og korrigeringstidslinje",
        "Readiness-score per avdeling",
      ]),
      heading(2, "Manedlig kvalitets- og bevaringsreview"),
      paragraph("Gjennomfores av lederteamet:"),
      bulletList([
        "Gjennomsnittlig gjestetilfredshet og trender",
        "Ansattomsetning og bevaringsrate",
        "Opplaeringsfullforingsgrad",
        "Avvikstrender og systemiske problemer",
        "Budsjettavvik og korrigerende tiltak",
      ]),
      heading(2, "Handlingstracker og eierskap"),
      paragraph(
        "Hver identifisert handling far en eier, en tidsfrist og en statuskode. Uloste handlinger eskaleres automatisk ved fristoverskridelse.",
      ),
      bulletList([
        "Gront: Fullfort innen frist",
        "Gult: Under arbeid, innen frist",
        "Rodt: Forfalt — eskalert til neste niva",
      ]),
    ),
  },
];

export const CHAPTER_TEMPLATES: Record<string, Template[]> = {
  "identity-mission": identityMission,
  "organization-model": organizationModel,
  "daily-operations": dailyOperations,
  "safety-compliance": safetyCompliance,
  communication: communication,
  "onboarding-training": onboardingTraining,
  scheduling: scheduling,
  "quality-service": qualityService,
  "incident-response": incidentResponse,
  "kpi-review": kpiReview,
};
