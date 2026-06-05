// ===== Smartout — Kommunikasjon · Skranke (Helpdesk) data model =====
// Extends window.SmartoutData with the helpdesk domain. Plain script — loads
// after kommunikasjon-data.js and before the babel files, same as the other
// data modules. Reuses the Kommunikasjon roster (KO_PEOPLE) and channels.
//
// Concept: a "Skranke" is a communication channel upgraded into an accountable,
// AI-assisted helpdesk. Normal channels stay forums; helpdesk-enabled channels
// turn questions into tracked CASES (tickets) owned by a responsible person,
// with a lifecycle, SLA, categories and a Botsson (AI) assist layer.
//
// Vocabulary: Skranke=helpdesk · Sak=ticket · Ansvarlig=owner · Frist/SLA=sla.
// Lifecycle (NO): Ny · Venter på ansvarlig · Under arbeid · Venter på ansatt ·
//   Løst · Gjenåpnet.  AI never closes/assigns sensitive cases on its own.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});
  const P = D.KO_PEOPLE_BY_ID || {};
  const ME = "ma"; // Maria A. — manager/owner perspective

  // ---------- helpdesk areas (predefined help domains) ----------
  const AREAS = {
    HR: { id: "HR", label: "HR og personal", icon: "user", color: "#8b5cf6" },
    Bemanning: { id: "Bemanning", label: "Vakt og bemanning", icon: "calendar", color: "#f97316" },
    Drift: { id: "Drift", label: "Drift og rutiner", icon: "layers", color: "#008388" },
    HMS: { id: "HMS", label: "HMS og sikkerhet", icon: "shield", color: "#ee560c" },
    IT: { id: "IT", label: "IT-support", icon: "settings", color: "#2784d5" },
    Onboarding: { id: "Onboarding", label: "Onboarding", icon: "cap", color: "#c18200" },
  };

  // ---------- skranke presets (how a channel becomes a desk) ----------
  const SKRANKE_PRESETS = {
    none: { id: "none", label: "Ingen skranke", icon: null, lede: "Vanlig kanal — alle kan skrive og lese som før.", consequence: null, ai: "av" },
    public: { id: "public", label: "Fag-skranke (offentlig)", icon: "lifebuoy", lede: "Åpen skranke hvor alle i kanalen ser spørsmålene.", consequence: "Ansvarlig svarer. Alle medlemmer ser tråden.", ai: "nevnt-kun" },
    private: { id: "private", label: "HR-skranke (privat)", icon: "lock", lede: "Hver sak får sin egen private undertråd mellom ansatt og ansvarlig.", consequence: "Meldinger er private — kun ansvarlig og den som spør ser dem.", ai: "av" },
    custom: { id: "custom", label: "Tilpasset", icon: "sliders", lede: "Velg hver innstilling manuelt. Anbefaler et forhåndsvalg.", consequence: null, ai: null, warn: true },
  };

  // ---------- AI policy modes ----------
  const AI_MODES = {
    off: { id: "off", label: "Av", desc: "Botsson deltar ikke i denne skranken." },
    mention: { id: "mention", label: "Når nevnt", desc: "Botsson svarer kun når noen skriver @botsson." },
    proactive: { id: "proactive", label: "Proaktiv", desc: "Botsson foreslår svar, triagerer og setter kategori — ansvarlig bekrefter alltid." },
  };

  // ---------- ticket lifecycle ----------
  const CASE_STATUS = {
    ny: { id: "ny", label: "Ny", tone: "info", icon: "sparkle", desc: "Nettopp opprettet. Ikke tildelt arbeid ennå." },
    venter_ansvarlig: { id: "venter_ansvarlig", label: "Venter på ansvarlig", tone: "warning", icon: "clock", desc: "Venter på at ansvarlig svarer." },
    under_arbeid: { id: "under_arbeid", label: "Under arbeid", tone: "orange", icon: "pen", desc: "Ansvarlig jobber med saken." },
    venter_ansatt: { id: "venter_ansatt", label: "Venter på ansatt", tone: "muted", icon: "clock", desc: "Venter på svar fra den som spurte." },
    lost: { id: "lost", label: "Løst", tone: "success", icon: "check", desc: "Avklart og lukket." },
    gjenapnet: { id: "gjenapnet", label: "Gjenåpnet", tone: "warning", icon: "undo", desc: "Åpnet på nytt etter at den var løst." },
  };
  const OPEN_STATES = ["ny", "venter_ansvarlig", "under_arbeid", "venter_ansatt", "gjenapnet"];

  // ---------- priority ----------
  const CASE_PRIORITY = {
    haster: { id: "haster", label: "Haster", tone: "error", icon: "alert", rank: 3 },
    hoy: { id: "hoy", label: "Høy", tone: "warning", icon: "flag", rank: 2 },
    normal: { id: "normal", label: "Normal", tone: "muted", icon: "flag", rank: 1 },
    lav: { id: "lav", label: "Lav", tone: "muted", icon: "flag", rank: 0 },
  };

  // ---------- SLA state ----------
  const SLA_STATE = {
    innen: { id: "innen", label: "Innen frist", tone: "success", icon: "check" },
    snart: { id: "snart", label: "Snart forfalt", tone: "warning", icon: "timer" },
    forfalt: { id: "forfalt", label: "Forfalt", tone: "error", icon: "alert" },
    lost: { id: "lost", label: "Innfridd", tone: "success", icon: "check" },
  };

  // ---------- categories (per area) ----------
  const CATEGORIES = {
    lonn: { id: "lonn", label: "Lønn", area: "HR" },
    sykefravar: { id: "sykefravar", label: "Sykefravær", area: "HR" },
    ferie: { id: "ferie", label: "Ferie og fri", area: "HR" },
    kontrakt: { id: "kontrakt", label: "Kontrakt", area: "HR" },
    vaktbytte: { id: "vaktbytte", label: "Vaktbytte", area: "Bemanning" },
    tilgjengelighet: { id: "tilgjengelighet", label: "Tilgjengelighet", area: "Bemanning" },
    vakttilgang: { id: "vakttilgang", label: "Tilgang vaktplan", area: "Bemanning" },
    rutiner: { id: "rutiner", label: "Rutiner", area: "Drift" },
    utstyr: { id: "utstyr", label: "Utstyr", area: "Drift" },
    leveranser: { id: "leveranser", label: "Leveranser", area: "Drift" },
    egenkontroll: { id: "egenkontroll", label: "Egenkontroll", area: "HMS" },
    avvik: { id: "avvik", label: "Avvik", area: "HMS" },
    vern: { id: "vern", label: "Vernerunde", area: "HMS" },
    tilgang: { id: "tilgang", label: "Tilgang", area: "IT" },
    kasse: { id: "kasse", label: "Kassesystem", area: "IT" },
    enheter: { id: "enheter", label: "Enheter", area: "IT" },
    sjekkliste: { id: "sjekkliste", label: "Sjekkliste", area: "Onboarding" },
    opplaring: { id: "opplaring", label: "Opplæring", area: "Onboarding" },
  };

  // ---------- desks (helpdesk-enabled channels) ----------
  // health: derived signal for the channel-health view (ok/watch/risk)
  const DESKS = [
    { id: "d-personal", slug: "personal", name: "HR og personal", area: "HR", preset: "private",
      desc: "Private spørsmål om lønn, fravær, ferie og kontrakt. Hver sak er en lukket undertråd.",
      owners: ["ma"], categories: ["lonn", "sykefravar", "ferie", "kontrakt"],
      sla: { first: 30, resolve: 8 }, ai: "off", enabled: true, color: "#8b5cf6", members: 14, lastAt: "12 min" },
    { id: "d-bemanning", slug: "bemanning", name: "Vakt og bemanning", area: "Bemanning", preset: "public",
      desc: "Vaktbytter, tilgjengelighet og tilgang til vaktplanen. Synlig for alle i kanalen.",
      owners: ["ma"], categories: ["vaktbytte", "tilgjengelighet", "vakttilgang"],
      sla: { first: 20, resolve: 4 }, ai: "proactive", enabled: true, color: "#f97316", members: 18, lastAt: "3 min" },
    { id: "d-drift", slug: "drift", name: "Drift og rutiner", area: "Drift", preset: "public",
      desc: "Rutiner, utstyr og leveranser. Botsson svarer når den er nevnt.",
      owners: ["es", "jh"], categories: ["rutiner", "utstyr", "leveranser"],
      sla: { first: 60, resolve: 24 }, ai: "mention", enabled: true, color: "#008388", members: 16, lastAt: "1 t" },
    { id: "d-hms", slug: "hms", name: "HMS og sikkerhet", area: "HMS", preset: "public",
      desc: "Egenkontroll, avvik og vernerunder. Avvik eskaleres til HMS-modulen.",
      owners: ["jh"], categories: ["egenkontroll", "avvik", "vern"],
      sla: { first: 30, resolve: 8 }, ai: "mention", enabled: true, color: "#ee560c", members: 12, lastAt: "24 min" },
    { id: "d-it", slug: "it-support", name: "IT-support", area: "IT", preset: "public",
      desc: "Tilgang, enheter og kassesystem. Botsson foreslår løsning før eskalering.",
      owners: ["es"], categories: ["tilgang", "kasse", "enheter"],
      sla: { first: 45, resolve: 12 }, ai: "proactive", enabled: true, color: "#2784d5", members: 11, lastAt: "8 min" },
    { id: "d-onboarding", slug: "onboarding", name: "Onboarding", area: "Onboarding", preset: "public",
      desc: "Sjekklister og opplæring for nyansatte. Botsson peker til riktig modul.",
      owners: ["ma"], categories: ["sjekkliste", "opplaring"],
      sla: { first: 120, resolve: 48 }, ai: "proactive", enabled: true, color: "#c18200", members: 6, lastAt: "I går" },
  ];
  const DESK_BY_ID = {};
  DESKS.forEach((d) => (DESK_BY_ID[d.id] = d));

  // normal (non-helpdesk) channels that could be upgraded — drives the
  // "clearly separated" overview + the empty/upgrade state.
  const NORMAL_CHANNELS = [
    { id: "n-allmenn", slug: "allmenn", name: "Allmenn", desc: "Felles forum for hele teamet.", members: 22 },
    { id: "n-kjokken", slug: "kjøkken", name: "Avdeling — Kjøkken", desc: "Drift og prat for kjøkkenet.", members: 9 },
    { id: "n-teamleder", slug: "teamleder", name: "Teamlederforum", desc: "Diskusjon mellom ledere.", members: 5 },
  ];

  // ---------- cases (tickets) ----------
  // sla: precomputed state per case for the mock. firstResponseMin = minutes to
  // first owner reply (null if not yet). messages: thread; notes: internal-only;
  // activity: timeline incl. AI actions (ai:true).
  const msg = (from, body, at, opts = {}) => Object.assign({ from, body, at }, opts);

  const CASES = [
    {
      id: "s-romjul", desk: "d-personal", area: "HR", category: "ferie", requester: "pk", owner: "ma",
      subject: "Kan jeg jobbe i romjula?", priority: "normal", status: "venter_ansatt",
      createdAt: "i dag · 14:09", updatedAt: "14:21", ageLabel: "14 min", sla: "innen", firstResponseMin: 9, channelThread: "#personal",
      aiSummary: "Petter spør om regler for ekstra vakter i romjula. Helligdager 24.–26. des gir 133 % tillegg; resten er ordinært. Frist for ønsker: fredag.",
      aiConfidence: 0.92, aiSources: ["Personalhåndbok › Tillegg og helligdager", "Tariff § 5"],
      messages: [
        msg("sys", "Botsson opprettet privat sak for Petter", "14:09", { ai: true }),
        msg("pk", "Hei Maria, har fått spørsmål om jeg kan ta ekstra vakter mellom jul og nyttår. Har vi egne regler for romjula, eller er det bare vanlig overtid?", "14:09"),
        msg("ma", "Hei Petter — 24., 25. og 26. desember er helligdager, så der er tillegget 133 %. Resten av romjula teller som vanlig. Si fra innen fredag hvis du ønsker ekstra vakter.", "14:18", { self: true }),
        msg("pk", "Perfekt, takk. Jeg tar 27.–29. hvis det er ledig.", "14:21"),
      ],
      notes: [],
      activity: [
        { at: "14:09", by: "bot", text: "Sak opprettet fra melding i #personal", ai: true },
        { at: "14:09", by: "bot", text: "Foreslo kategori «Ferie og fri» (92 %)", ai: true },
        { at: "14:18", by: "ma", text: "Første svar sendt" },
      ],
    },
    {
      id: "s-vaktilgang", desk: "d-bemanning", area: "Bemanning", category: "vakttilgang", requester: "pk", owner: "ma",
      subject: "Mangler tilgang til vaktplan", priority: "hoy", status: "venter_ansvarlig",
      createdAt: "i dag · 13:40", updatedAt: "13:40", ageLabel: "43 min", sla: "snart", firstResponseMin: null, channelThread: "#bemanning",
      aiSummary: "Petter (lærling) ser ikke vaktplanen i appen. Sannsynlig årsak: tilgangsnivå «Ansatt» mangler rollen «Vaktplan-lese» som tildeles etter onboarding-modul 2.",
      aiConfidence: 0.78, aiSources: ["Ansatte › Petter K. › Tilgang", "Onboarding modul 2"],
      aiDraft: "Hei Petter! Du mangler rollen «Vaktplan-lese» — den åpnes når onboarding-modul 2 er fullført. Jeg gir deg tilgang nå, så ser du planen om et par minutter.",
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #bemanning", "13:40", { ai: true }),
        msg("pk", "Hei! Jeg finner ikke vaktplanen min i appen — det står bare «ingen tilgang». Hva gjør jeg?", "13:40"),
      ],
      notes: [{ by: "ma", at: "13:52", body: "Sjekket — Petter mangler rollen fordi modul 2 ikke er huket av. Fikser etter lunsj." }],
      activity: [
        { at: "13:40", by: "bot", text: "Sak opprettet · kategori «Tilgang vaktplan» (foreslått)", ai: true },
        { at: "13:41", by: "bot", text: "Foreslo årsak fra tilgangslogg — venter på bekreftelse", ai: true },
      ],
    },
    {
      id: "s-sykefravar", desk: "d-personal", area: "HR", category: "sykefravar", requester: "sl", owner: "ma",
      subject: "Spørsmål om sykefravær", priority: "normal", status: "under_arbeid",
      createdAt: "i dag · 11:02", updatedAt: "11:40", ageLabel: "3 t", sla: "innen", firstResponseMin: 14, channelThread: "#personal",
      aiSummary: "Selma lurer på om egenmelding brukt på en delvis dag teller som hel egenmeldingsdag. Svar: nei — egenmelding regnes per kalenderdag uavhengig av timer.",
      aiConfidence: 0.71, aiSources: ["Personalhåndbok › Egenmelding"],
      messages: [
        msg("sys", "Selma startet privat sak", "11:02"),
        msg("sl", "Hei, hvis jeg gikk hjem syk etter halv vakt — teller det som en hel egenmeldingsdag?", "11:02"),
        msg("ma", "Godt spørsmål. La meg dobbeltsjekke mot håndboka, jeg er straks tilbake.", "11:16", { self: true }),
      ],
      notes: [],
      activity: [
        { at: "11:02", by: "ma", text: "Sak åpnet manuelt" },
        { at: "11:16", by: "ma", text: "Satt status «Under arbeid»" },
      ],
    },
    {
      id: "s-kveldsskift", desk: "d-drift", area: "Drift", category: "rutiner", requester: "nv", owner: "es",
      subject: "Uklar rutine for kveldsskift", priority: "normal", status: "ny",
      createdAt: "i dag · 15:02", updatedAt: "15:02", ageLabel: "9 min", sla: "innen", firstResponseMin: null, channelThread: "#drift",
      aiSummary: "Nora er usikker på rekkefølgen for stenging av bar vs. kjøkken på kveldsskift. Det finnes en stengerutine i håndboka, men den nevner ikke bar spesifikt.",
      aiConfidence: 0.54, aiSources: ["Bedriftshåndbok › Stenging (delvis treff)"],
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #drift", "15:02", { ai: true }),
        msg("nv", "Hvem stenger først på kveldsvakt — bar eller kjøkken? Rutinen sier ikke noe om bar.", "15:02"),
      ],
      notes: [],
      activity: [
        { at: "15:02", by: "bot", text: "Sak opprettet · lav sikkerhet på kategori", ai: true },
        { at: "15:02", by: "bot", text: "Flagget: rutinen mangler bar-steg (forslag til Mangler & forbedringer)", ai: true },
      ],
    },
    {
      id: "s-kasse", desk: "d-it", area: "IT", category: "kasse", requester: "nv", owner: "es",
      subject: "Kassesystem henger på terminal 2", priority: "haster", status: "under_arbeid",
      createdAt: "i dag · 14:30", updatedAt: "14:48", ageLabel: "41 min", sla: "snart", firstResponseMin: 6, channelThread: "#it-support",
      aiSummary: "Terminal 2 fryser ved kortbetaling. Kjent feil etter siste oppdatering — anbefalt midlertidig løsning er å rute betaling via terminal 1 og restarte terminal 2.",
      aiConfidence: 0.83, aiSources: ["IT › Kjente feil › Kasse v4.2", "Leverandørstatus"],
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #it-support", "14:30", { ai: true }),
        msg("nv", "Terminal 2 fryser hver gang vi tar kort. Vi har kø ved baren nå!", "14:30"),
        msg("es", "Bruk terminal 1 så lenge, jeg restarter 2 nå. Tar to minutter.", "14:36", { self: true }),
      ],
      notes: [{ by: "es", at: "14:48", body: "Restart hjalp midlertidig. Følger opp med leverandør om permanent fiks." }],
      activity: [
        { at: "14:30", by: "bot", text: "Sak opprettet · prioritet «Haster» (foreslått fra «kø ved baren»)", ai: true },
        { at: "14:36", by: "es", text: "Første svar · midlertidig løsning gitt" },
      ],
    },
    {
      id: "s-egenkontroll", desk: "d-hms", area: "HMS", category: "egenkontroll", requester: "ib", owner: "jh",
      subject: "Egenkontroll kjøl 1 ikke signert", priority: "haster", status: "venter_ansvarlig",
      createdAt: "i dag · 08:50", updatedAt: "08:50", ageLabel: "6 t", sla: "forfalt", firstResponseMin: null, channelThread: "#hms",
      aiSummary: "Ida melder at egenkontroll for kjølerom 1 ikke er signert i dag. Mattilsynet er varslet om tilsyn denne uka — dette bør lukkes før åpning.",
      aiConfidence: 0.88, aiSources: ["HMS › Egenkontroll mat", "Kunngjøring: tilsyn uke 20"],
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #hms", "08:50", { ai: true }),
        msg("ib", "Kjøl 1 er ikke signert i dag, og jeg finner ikke termometeret. Kjøl 2 er ok.", "08:50"),
      ],
      notes: [],
      activity: [
        { at: "08:50", by: "bot", text: "Sak opprettet · prioritet «Haster» (kobling til tilsyn-kunngjøring)", ai: true },
        { at: "12:00", by: "bot", text: "SLA-frist passert — eskalert til ansvarlig", ai: true },
      ],
    },
    {
      id: "s-onboarding", desk: "d-onboarding", area: "Onboarding", category: "sjekkliste", requester: "pk", owner: "ma",
      subject: "Ny ansatt finner ikke onboarding-sjekkliste", priority: "normal", status: "venter_ansatt",
      createdAt: "i går · 16:20", updatedAt: "i dag · 09:10", ageLabel: "1 d", sla: "innen", firstResponseMin: 22, channelThread: "#onboarding",
      aiSummary: "Petter finner ikke onboarding-sjekklisten. Den ligger under Min dag › Onboarding for nye ansatte i prøveperiode. Lenke sendt.",
      aiConfidence: 0.95, aiSources: ["Onboarding modul 1", "Min dag"],
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #onboarding", "i går 16:20", { ai: true }),
        msg("pk", "Jeg finner ikke sjekklista for opplæring noe sted i appen?", "i går 16:20"),
        msg("ma", "Den ligger under Min dag → Onboarding. Sender deg en direktelenke nå 👍", "i dag 09:10", { self: true }),
      ],
      notes: [],
      activity: [
        { at: "i går 16:20", by: "bot", text: "Sak opprettet · kategori «Sjekkliste» (95 %)", ai: true },
        { at: "i dag 09:10", by: "ma", text: "Første svar med lenke" },
      ],
    },
    {
      id: "s-vaktbytte", desk: "d-bemanning", area: "Bemanning", category: "vaktbytte", requester: "tr", owner: "ma",
      subject: "Vaktbytte fredag 28.", priority: "normal", status: "lost",
      createdAt: "tirsdag · 10:12", updatedAt: "tirsdag · 11:30", ageLabel: "2 d", sla: "lost", firstResponseMin: 11, resolveHrs: 1.3, channelThread: "#bemanning",
      aiSummary: "Tobias ønsket å bytte bort fredag 28. Mikkel tok vakten. Bekreftet og oppdatert i vaktplanen.",
      aiConfidence: 0.9, aiSources: ["Vaktplan uke 22"],
      messages: [
        msg("sys", "Botsson opprettet sak fra melding i #bemanning", "10:12", { ai: true }),
        msg("tr", "Kan noen ta fredag 28. fra 18? Har en avtale jeg ikke kommer unna.", "10:12"),
        msg("ma", "Mikkel sa han kan ta den. Jeg legger det inn i planen nå.", "10:23", { self: true }),
        msg("tr", "Tusen takk!", "10:40"),
        msg("sys", "Maria markerte saken som løst", "11:30"),
      ],
      notes: [],
      activity: [
        { at: "10:12", by: "bot", text: "Sak opprettet" },
        { at: "10:23", by: "ma", text: "Første svar" },
        { at: "11:30", by: "ma", text: "Løst · vaktplan oppdatert" },
      ],
    },
    {
      id: "s-allergen", desk: "d-drift", area: "Drift", category: "rutiner", requester: "sl", owner: "es",
      subject: "Allergener i ny vinmeny", priority: "lav", status: "lost",
      createdAt: "i går · 12:00", updatedAt: "i går · 13:10", ageLabel: "1 d", sla: "lost", firstResponseMin: 19, resolveHrs: 1.2, channelThread: "#drift",
      aiSummary: "Selma spurte om allergener i de nye naturvinene. Svovel er eneste relevante allergen — merket på smaksprofil-arket.",
      aiConfidence: 0.86, aiSources: ["Smaksprofil-ark v3"],
      messages: [
        msg("sl", "Er det noen allergener vi må nevne på de nye naturvinene?", "12:00"),
        msg("es", "Bare sulfitter (svovel). Står på smaksprofil-arket i #sommer-2026.", "12:19", { self: true }),
        msg("sys", "Erik markerte saken som løst", "13:10"),
      ],
      notes: [],
      activity: [
        { at: "12:00", by: "es", text: "Sak åpnet" },
        { at: "13:10", by: "es", text: "Løst" },
      ],
    },
    {
      id: "s-fri-nov", desk: "d-personal", area: "HR", category: "ferie", requester: "km", owner: "ma",
      subject: "Trenger fri 15. november", priority: "normal", status: "lost",
      createdAt: "man · 08:42", updatedAt: "man · 09:15", ageLabel: "5 d", sla: "lost", firstResponseMin: 33, resolveHrs: 0.5, channelThread: "#personal",
      aiSummary: "Kari ba om fri 15. november (bursdag). Godkjent — ingen vakt planlagt den dagen.",
      aiConfidence: 0.9, aiSources: ["Vaktplan uke 46"],
      messages: [
        msg("km", "Trenger fri 15. november — bursdag. Håper det går greit.", "08:42"),
        msg("ma", "Helt greit, du står ikke på vakt den dagen uansett. God feiring!", "09:15", { self: true }),
        msg("sys", "Maria markerte saken som løst", "09:15"),
      ],
      notes: [],
      activity: [
        { at: "08:42", by: "ma", text: "Sak åpnet" },
        { at: "09:15", by: "ma", text: "Løst · godkjent" },
      ],
    },
    {
      id: "s-leveranse", desk: "d-drift", area: "Drift", category: "leveranser", requester: "jh", owner: "es",
      subject: "Grønnsakslevering uteble", priority: "hoy", status: "gjenapnet",
      createdAt: "i dag · 07:20", updatedAt: "i dag · 10:05", ageLabel: "8 t", sla: "snart", firstResponseMin: 15, channelThread: "#drift",
      aiSummary: "Morgenlevering fra BAMA uteble. Erik bestilte hastelevering — den kom ikke. Saken er gjenåpnet for oppfølging mot leverandør.",
      aiConfidence: 0.8, aiSources: ["Leverandør › BAMA", "Bestilling #4821"],
      messages: [
        msg("jh", "Grønnsakene kom ikke i morges. Vi mangler til lunsjservice.", "07:20"),
        msg("es", "Ringer BAMA, bestiller haste. Skal være her før 11.", "07:35", { self: true }),
        msg("sys", "Erik markerte saken som løst", "08:00"),
        msg("jh", "Hastebestillingen kom heller ikke. Gjenåpner.", "10:05"),
      ],
      notes: [{ by: "es", at: "10:10", body: "Eskalerer til BAMA kundeansvarlig. Kreditnota bes om." }],
      activity: [
        { at: "07:20", by: "es", text: "Sak åpnet" },
        { at: "08:00", by: "es", text: "Løst" },
        { at: "10:05", by: "jh", text: "Gjenåpnet — levering uteble igjen" },
      ],
    },
  ];

  // ---------- derive open-case counts per desk ----------
  DESKS.forEach((d) => {
    d.openCount = CASES.filter((c) => c.desk === d.id && OPEN_STATES.includes(c.status)).length;
    d.overdueCount = CASES.filter((c) => c.desk === d.id && c.sla === "forfalt").length;
  });

  // ---------- analytics (representative aggregate, last 7 days) ----------
  const SKRANKE_ANALYTICS = {
    openTickets: 42,
    overdue: 6,
    avgFirstResponseMin: 18,
    avgResolutionHrs: 7.4,
    aiAcceptedPct: 68,
    resolvedThisWeek: 119,
    aiDeflectedPct: 31,
    topTopic: "Vaktbytte og fravær",
    // weekly volume (created vs resolved) for the workload chart
    volume: [
      { d: "Man", created: 22, resolved: 19 },
      { d: "Tir", created: 26, resolved: 24 },
      { d: "Ons", created: 18, resolved: 21 },
      { d: "Tor", created: 31, resolved: 27 },
      { d: "Fre", created: 28, resolved: 25 },
      { d: "Lør", created: 12, resolved: 14 },
      { d: "Søn", created: 7, resolved: 9 },
    ],
    recurring: [
      { topic: "Vaktbytte og fravær", count: 34, trend: "up", area: "Bemanning" },
      { topic: "Tilgang til vaktplan", count: 21, trend: "up", area: "Bemanning" },
      { topic: "Egenkontroll og avvik", count: 17, trend: "flat", area: "HMS" },
      { topic: "Kassesystem", count: 12, trend: "down", area: "IT" },
      { topic: "Onboarding-sjekkliste", count: 9, trend: "flat", area: "Onboarding" },
    ],
    workload: [
      { owner: "ma", open: 19, resolvedWk: 54, avgFirstMin: 14 },
      { owner: "es", open: 14, resolvedWk: 41, avgFirstMin: 22 },
      { owner: "jh", open: 9, resolvedWk: 24, avgFirstMin: 26 },
    ],
    health: [
      { desk: "d-bemanning", score: 96, state: "ok" },
      { desk: "d-personal", score: 91, state: "ok" },
      { desk: "d-it", score: 82, state: "watch" },
      { desk: "d-drift", score: 74, state: "watch" },
      { desk: "d-hms", score: 61, state: "risk" },
      { desk: "d-onboarding", score: 88, state: "ok" },
    ],
  };

  Object.assign(D, {
    SK_AREAS: AREAS, SKRANKE_PRESETS, SK_AI_MODES: AI_MODES,
    CASE_STATUS, CASE_PRIORITY, SLA_STATE, SK_CATEGORIES: CATEGORIES, SK_OPEN_STATES: OPEN_STATES,
    DESKS, DESK_BY_ID, NORMAL_CHANNELS, CASES, SKRANKE_ANALYTICS,
    SK_ME: ME,
  });
})();
