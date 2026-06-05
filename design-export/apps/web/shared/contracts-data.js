// ===== Smartout — Contract Management data (Kontrakter / Avtaler) =====
// Extends window.SmartoutData with the premium contract-orchestration model:
//   tariffs + grades (Botsson legal/MCP advisor)  ·  structured builder templates
//   contract instances (lifecycle)  ·  missing-info  ·  audit trail
//   onboarding schema  ·  external signing provider
// Smartout ORCHESTRATES (templates → generation → completion → dispatch → tracking).
// The signing itself happens in an external e-signing provider.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ============================================================
  // EXTERNAL SIGNING PROVIDER (provider-agnostic orchestration)
  // ============================================================
  const CT_PROVIDER = {
    name: "ekstern signeringsleverandør",
    short: "Signering",
    method: "BankID",
    note: "Smartout sender avtalen til signering hos en ekstern leverandør. Selve signeringen skjer der — Smartout holder oversikt, status og sporbarhet før og etter.",
  };

  // ============================================================
  // TARIFF / LØNNSTRINN  — Botsson's MCP-trained legal advisor.
  // Riksavtalen (NHO Reiseliv ↔ Fellesforbundet) for serverings-/
  // overnattingsbransjen. Botsson recommends a grade; never auto-applies.
  // ============================================================
  const CT_TARIFF = {
    id: "riksavtalen",
    name: "Riksavtalen",
    parties: "NHO Reiseliv ↔ Fellesforbundet",
    period: "2024–2026",
    source: "Riksavtalen 2024–2026 · Skatteetaten · Arbeidsmiljøloven §14-6",
    grades: [
      { id: "g-ny", code: "Trinn 1", label: "Nybegynner", anc: "0–1 år", floor: 198, note: "Uten fagbrev, under 1 års ansiennitet." },
      { id: "g-erf", code: "Trinn 2", label: "Erfaren", anc: "1–3 år", floor: 214, note: "Uten fagbrev, opparbeidet ansiennitet." },
      { id: "g-fag", code: "Trinn 3", label: "Fagarbeider", anc: "fagbrev", floor: 236, note: "Bestått fagbrev (kokk/servitør). Lovregulert minstesats." },
      { id: "g-fag2", code: "Trinn 4", label: "Fagarbeider +", anc: "fagbrev · 4+ år", floor: 252, note: "Fagbrev med lang ansiennitet." },
      { id: "g-ans", code: "Trinn 5", label: "Med ansvar", anc: "skiftleder", floor: 274, note: "Skift-/stedansvar, nøkkelfunksjon." },
    ],
    supplements: [
      { id: "kveld", label: "Kveldstillegg", rule: "kl. 18–24 på hverdager", val: "+22 kr/t", legal: true },
      { id: "natt", label: "Nattillegg", rule: "kl. 00–06", val: "+45 kr/t", legal: true },
      { id: "helg", label: "Helgetillegg", rule: "lør 13 – søn 24", val: "+25 kr/t", legal: true },
      { id: "helligdag", label: "Helligdagstillegg", rule: "røde dager", val: "+100 %", legal: true },
    ],
  };

  // Botsson advisory chat seeds (assistive, MCP-backed, never autonomous).
  const CT_BOT_THREAD = [
    { who: "bot", text: "Jeg er koblet til Riksavtalen 2024–2026 og regelverket hos Skatteetaten og Arbeidstilsynet. Spør meg om lønnstrinn, tillegg eller hva loven krever — jeg foreslår, du bekrefter." },
  ];
  const CT_BOT_QA = [
    {
      q: "Hvilket lønnstrinn passer for en kokk med fagbrev og 3 års erfaring?",
      conf: 0.93,
      text: "For kokk med bestått fagbrev anbefaler jeg **Trinn 3 · Fagarbeider** — minstesats **236 kr/t** etter Riksavtalen. 3 års ansiennitet ligger under terskelen for Trinn 4 (4+ år), så Trinn 3 er korrekt nå, med automatisk opprykk ved 4 år.",
      sources: ["Riksavtalen §4 — Lønnsbestemmelser", "Fagbrevregister (Skatteetaten)"],
      apply: { field: "grade", value: "g-fag", label: "Sett Trinn 3 · Fagarbeider (236 kr/t)" },
    },
    {
      q: "Er kveldstillegg lovpålagt?",
      conf: 0.97,
      text: "Ja. Tillegg for arbeid mellom **kl. 18 og 24** på hverdager er regulert i Riksavtalen og kan ikke avtales bort. Smartout legger dette inn som et **lovpålagt** tillegg — du kan ikke fjerne det, bare øke det.",
      sources: ["Riksavtalen §5 — Tillegg", "Arbeidsmiljøloven §10-11"],
      apply: { field: "supp", value: "kveld", label: "Legg til Kveldstillegg (+22 kr/t)" },
    },
    {
      q: "Hva er lengste lovlige prøvetid?",
      conf: 0.98,
      text: "Prøvetid kan avtales i inntil **6 måneder** (aml §15-6). Den må stå skriftlig i avtalen for å gjelde. Jeg har satt 6 mnd som standard — du kan kortne den.",
      sources: ["Arbeidsmiljøloven §15-6"],
      apply: null,
    },
  ];

  // ============================================================
  // EMPLOYEE GROUPS — templates are organized by group.
  // ============================================================
  const CT_GROUPS = [
    { id: "kjokken", label: "Kjøkken", dept: "kjokken", icon: "thermometer", roles: ["Kokk", "Sous-chef", "Kjøkkenassistent", "Oppvask"] },
    { id: "servering", label: "Servering & Sal", dept: "sal", icon: "users", roles: ["Servitør", "Hovmester", "Vertskap"] },
    { id: "bar", label: "Bar", dept: "bar", icon: "wallet", roles: ["Bartender", "Barback"] },
    { id: "event", label: "Event", dept: "event", icon: "calendar", roles: ["Eventvert", "Eventkoordinator"] },
    { id: "drift", label: "Drift & Ledelse", dept: "admin", icon: "shield", roles: ["Driftsleder", "Skiftleder"] },
  ];

  // ============================================================
  // BUILDER SECTION SCHEMA — the guided multi-section template builder.
  // Each section: legal flag, fields. field.kind: required | optional | auto | legal
  //   required = must be set before publish
  //   legal    = lovpålagt, locked content
  //   auto     = filled automatically from profile/tariff at generation
  //   optional = dynamic / conditional
  // ============================================================
  const CT_BUILDER_SECTIONS = [
    {
      id: "group", title: "Ansattgruppe og rolle", icon: "users", accent: "var(--info)",
      desc: "Hvem malen gjelder for. Styrer hvilke standardverdier og tariff som foreslås.",
      fields: [
        { k: "required", label: "Ansattgruppe", val: "Kjøkken" },
        { k: "required", label: "Rolle / stilling", val: "Kokk" },
        { k: "required", label: "Ansettelsesform", val: "Fast" },
        { k: "optional", label: "Profesjon / fagfelt", val: "Fagkokk" },
      ],
    },
    {
      id: "place", title: "Arbeidsplass og lokasjon", icon: "building", accent: "var(--dept-lager)",
      desc: "Arbeidssted, avdeling og hvem som er nærmeste leder.",
      fields: [
        { k: "auto", label: "Bedrift", val: "Bistro Nord (org. 912 345 678)" },
        { k: "required", label: "Avdeling", val: "Kjøkken" },
        { k: "required", label: "Arbeidssted", val: "Storgata 14, 0184 Oslo" },
        { k: "auto", label: "Nærmeste leder", val: "Settes ved ansettelse" },
      ],
    },
    {
      id: "hours", title: "Arbeidstid og fleksitid", icon: "clock", accent: "var(--dept-bar)",
      desc: "Stillingsprosent, ukentlig arbeidstid og arbeidstidsordning.",
      fields: [
        { k: "required", label: "Stillingsprosent", val: "100 %" },
        { k: "required", label: "Timer per uke", val: "37,5 t" },
        { k: "required", label: "Arbeidstidsordning", val: "Turnus" },
        { k: "legal", label: "Daglig/ukentlig arbeidstid (aml §10-4)", val: "Maks 9 t/dag · 40 t/uke" },
        { k: "optional", label: "Fleksitidsavtale", val: "Ikke aktiv" },
      ],
    },
    {
      id: "pay", title: "Lønn, tariff og tillegg", icon: "wallet", accent: "var(--success)",
      desc: "Lønnsmodell, tariff-binding og kompensasjonslogikk. Botsson foreslår trinn.",
      fields: [
        { k: "auto", label: "Tariffavtale", val: "Riksavtalen 2024–2026" },
        { k: "required", label: "Lønnstrinn", val: "Trinn 3 · Fagarbeider" },
        { k: "auto", label: "Grunnlønn (minstesats)", val: "236 kr/t" },
        { k: "legal", label: "Kvelds-, natt- og helgetillegg", val: "Etter Riksavtalen §5" },
        { k: "optional", label: "Bonus / resultatlønn", val: "Ikke aktiv" },
        { k: "optional", label: "Goder (måltid, klær)", val: "Fri arbeidsuniform · personalmåltid" },
      ],
    },
    {
      id: "training", title: "Opplæringsplan", icon: "cap", accent: "var(--purple)",
      desc: "Opplæringsløpet knyttet til ansattgruppen. Hentes fra HMS- og personalhåndbok.",
      fields: [
        { k: "auto", label: "Tilknyttet opplæringsløp", val: "Kjøkken · onboarding (8 moduler)" },
        { k: "required", label: "Obligatorisk før selvstendig vakt", val: "HACCP · Brannvern · Allergener" },
        { k: "optional", label: "Sertifiseringer", val: "Mattilsynet IK-mat" },
      ],
    },
    {
      id: "duties", title: "Forventninger og ansvar", icon: "clipcheck", accent: "var(--orange)",
      desc: "Ansvar, forventninger, retningslinjer og plikter. Lenkes til håndbøkene.",
      fields: [
        { k: "auto", label: "Stillingsbeskrivelse", val: "Fra rollebibliotek · Kokk" },
        { k: "required", label: "Personalhåndbok", val: "Forpliktet til å gjøre seg kjent" },
        { k: "required", label: "HMS-håndbok", val: "Forpliktet til å gjøre seg kjent" },
        { k: "optional", label: "Taushetserklæring", val: "Auto-vedlegg" },
      ],
    },
    {
      id: "legal", title: "Lovpålagte definisjoner og vilkår", icon: "scale", accent: "var(--error)",
      desc: "Minstekrav i arbeidsavtalen etter arbeidsmiljøloven §14-6. Låst innhold.",
      fields: [
        { k: "legal", label: "Partenes identitet", val: "Arbeidsgiver + arbeidstaker" },
        { k: "legal", label: "Tiltredelsestidspunkt", val: "Startdato" },
        { k: "legal", label: "Oppsigelsesfrister (aml §15-3)", val: "Gjensidig 1 mnd i prøvetid" },
        { k: "legal", label: "Ferie og feriepenger (ferieloven)", val: "12,0 % · 5 uker" },
        { k: "legal", label: "Pensjon (OTP)", val: "Innmeldt fra dag 1" },
      ],
    },
    {
      id: "fields", title: "Påkrevd ansattinformasjon", icon: "user", accent: "var(--dept-sal)",
      desc: "Hvilke felter ansatt må fylle ut. Mangler samles inn ved første innlogging.",
      fields: [
        { k: "required", label: "Fullt navn", val: "Fra profil" },
        { k: "required", label: "Fødselsnummer / D-nummer", val: "Samles inn ved onboarding", collect: true },
        { k: "required", label: "Adresse", val: "Samles inn ved onboarding", collect: true },
        { k: "required", label: "Kontonummer", val: "Samles inn ved onboarding", collect: true },
        { k: "optional", label: "Nærmeste pårørende", val: "Samles inn ved onboarding", collect: true },
      ],
    },
  ];

  // ============================================================
  // STRUCTURED TEMPLATES (premium) — keyed to employee group.
  // completeness drives the builder progress + AI summary.
  // ============================================================
  const CT_TEMPLATES = [
    { id: "ct-kjokken-fast", name: "Kjøkken · Fast ansettelse", group: "kjokken", role: "Kokk", form: "Fast",
      version: "3.1", status: "published", updated: "12. mai 2026", owner: "ma", uses: 24, completeness: 100,
      desc: "Komplett mal for faste kjøkkenstillinger. Bundet til Riksavtalen, fagbrev-trinn og kjøkkenets opplæringsløp.",
      grade: "g-fag", tariff: "riksavtalen", autoFields: 9, reqFields: 14, legalFields: 8, optFields: 5 },
    { id: "ct-servering-fast", name: "Servering · Fast ansettelse", group: "servering", role: "Servitør", form: "Fast",
      version: "2.4", status: "published", updated: "3. apr 2026", owner: "ma", uses: 31, completeness: 100,
      desc: "Faste serveringsstillinger med skjenke-tillegg og salens opplæringsløp.",
      grade: "g-erf", tariff: "riksavtalen", autoFields: 8, reqFields: 13, legalFields: 8, optFields: 4 },
    { id: "ct-servering-mid", name: "Servering · Midlertidig / sesong", group: "servering", role: "Servitør", form: "Midlertidig",
      version: "2.0", status: "published", updated: "2. mai 2026", owner: "es", uses: 18, completeness: 96,
      desc: "Sesong- og vikariatstillinger med sluttdato og lovgrunnlag for midlertidighet.",
      grade: "g-ny", tariff: "riksavtalen", autoFields: 8, reqFields: 13, legalFields: 9, optFields: 3 },
    { id: "ct-bar-tilkalling", name: "Bar · Tilkalling", group: "bar", role: "Bartender", form: "Tilkalling",
      version: "1.2", status: "published", updated: "20. feb 2026", owner: "es", uses: 9, completeness: 88,
      desc: "Ringevikar i baren. Ingen garantert arbeidstid. Mangler oppdatert tillegg-tabell.",
      grade: "g-erf", tariff: "riksavtalen", autoFields: 6, reqFields: 11, legalFields: 7, optFields: 2 },
    { id: "ct-drift-leder", name: "Drift · Leder (fastlønn)", group: "drift", role: "Skiftleder", form: "Fast",
      version: "1.0", status: "draft", updated: "28. mai 2026", owner: "ma", uses: 0, completeness: 62,
      desc: "Lederstillinger på fastlønn med ansvar og nøkkelfunksjon. Under arbeid — mangler bonuslogikk og opplæringsplan.",
      grade: "g-ans", tariff: "riksavtalen", autoFields: 5, reqFields: 9, legalFields: 8, optFields: 1 },
    { id: "ct-event-mid", name: "Event · Tilkalling", group: "event", role: "Eventvert", form: "Tilkalling",
      version: "1.0", status: "draft", updated: "30. mai 2026", owner: "ma", uses: 0, completeness: 40,
      desc: "Påbegynt mal for eventverter ved behov. Ikke klar for bruk.",
      grade: "g-ny", tariff: "riksavtalen", autoFields: 3, reqFields: 6, legalFields: 6, optFields: 0 },
  ];

  // ============================================================
  // CONTRACT INSTANCES — lifecycle pipeline.
  // status: draft | ready | sent | viewed | signed | rejected | expired | failed
  // ============================================================
  const CT_CONTRACTS = [
    {
      id: "k-pontus", who: "pontus", name: "Pontus Lindroth", role: "Kokk", dept: "kjokken",
      form: "Fast", pct: 100, grade: "g-fag", hourly: 236, start: "10. jun 2026",
      template: "ct-kjokken-fast", manager: "jh", status: "draft", completion: 72,
      created: "30. mai 2026", note: "Auto-generert fra mal. Mangler 3 opplysninger fra ansatt.",
      provider: CT_PROVIDER.short, isNew: true,
      missing: ["m-fnr", "m-konto", "m-paror"],
    },
    {
      id: "k-petter", who: "pk", name: "Petter K.", role: "Servitør", dept: "sal",
      form: "Midlertidig", pct: 60, grade: "g-ny", hourly: 214, start: "1. jun 2026", end: "30. nov 2026",
      template: "ct-servering-mid", manager: "ma", status: "sent", completion: 100,
      created: "27. mai 2026", sent: "27. mai 2026 14:20", note: "Sendt til signering. Venter på ansatt.",
      provider: CT_PROVIDER.short, missing: [],
    },
    {
      id: "k-nora", who: "nv", name: "Nora V.", role: "Bartender", dept: "bar",
      form: "Tilkalling", pct: null, grade: "g-erf", hourly: 225, start: "2. jun 2026",
      template: "ct-bar-tilkalling", manager: "ma", status: "viewed", completion: 100,
      created: "29. mai 2026", sent: "29. mai 2026 09:10", viewed: "30. mai 2026 18:42",
      note: "Åpnet hos signeringsleverandør — ikke signert ennå.", provider: CT_PROVIDER.short, missing: [],
    },
    {
      id: "k-selma", who: "sl", name: "Selma L.", role: "Servitør", dept: "sal",
      form: "Fast", pct: 80, grade: "g-erf", hourly: 235, start: "—",
      template: "ct-servering-fast", manager: "ma", status: "signed", completion: 100,
      created: "22. mai 2026", sent: "23. mai 2026", signed: "24. mai 2026 11:05",
      note: "Tillegg signert. Synket til lønn og profil.", provider: CT_PROVIDER.short, missing: [],
      kind: "Tillegg", kindNote: "Alkohollov-tillegg",
    },
    {
      id: "k-jonas", who: "jh", name: "Jonas H.", role: "Sous-chef", dept: "kjokken",
      form: "Fast", pct: 100, grade: "g-fag2", monthly: 44500, start: "—",
      template: "ct-kjokken-fast", manager: "es", status: "signed", completion: 100,
      created: "10. mai 2026", sent: "11. mai 2026", signed: "12. mai 2026 09:30",
      note: "Reforhandlet fastlønn. Aktiv og gyldig.", provider: CT_PROVIDER.short, missing: [],
      kind: "Reforhandlet",
    },
    {
      id: "k-tobias", who: "tr", name: "Tobias R.", role: "Servitør", dept: "sal",
      form: "Fast", pct: 100, grade: "g-erf", hourly: 240, start: "—", end: "14. jun 2026",
      template: "ct-servering-fast", manager: "ma", status: "expired", completion: 100,
      created: "1. mai 2026", sent: "2. mai 2026", note: "Signeringslenke utløpt — sluttavtale må sendes på nytt.",
      provider: CT_PROVIDER.short, missing: [], kind: "Sluttavtale",
    },
  ];

  // ============================================================
  // MISSING INFORMATION — what · who · required-before-signing · collectible
  // ============================================================
  const CT_MISSING = {
    "m-fnr": { label: "Fødselsnummer", who: "Pontus (ansatt)", required: true, collect: true, status: "venter", why: "Lovpålagt for arbeidsavtale, lønn og A-melding (Skatteetaten)." },
    "m-konto": { label: "Kontonummer", who: "Pontus (ansatt)", required: false, collect: true, status: "venter", why: "Trengs før første lønnsutbetaling, ikke før signering." },
    "m-paror": { label: "Nærmeste pårørende", who: "Pontus (ansatt)", required: false, collect: true, status: "venter", why: "Valgfritt — anbefalt for HMS-beredskap." },
  };

  // ============================================================
  // AUDIT TRAIL — activity history per contract (orchestration + AI).
  // kind: create | ai | edit | send | view | sign | reject | expire | system
  // ============================================================
  const CT_AUDIT = {
    "k-pontus": [
      { kind: "create", who: "Maria A.", text: "Opprettet kontrakt fra mal «Kjøkken · Fast ansettelse»", at: "30. mai 09:02" },
      { kind: "ai", who: "Botsson", text: "Foreslo Trinn 3 · Fagarbeider (236 kr/t) basert på fagbrev. Godkjent av Maria A.", at: "30. mai 09:03", conf: 0.93 },
      { kind: "ai", who: "Botsson", text: "Oppdaget 3 manglende opplysninger. Anbefalte innsamling ved onboarding.", at: "30. mai 09:03" },
      { kind: "edit", who: "Maria A.", text: "Bekreftet startdato 10. jun 2026 og leder Jonas H.", at: "30. mai 09:05" },
    ],
    "k-petter": [
      { kind: "create", who: "Maria A.", text: "Opprettet midlertidig avtale fra mal", at: "27. mai 14:02" },
      { kind: "ai", who: "Botsson", text: "Bekreftet lovgrunnlag for midlertidighet (aml §14-9 b · sesong)", at: "27. mai 14:05", conf: 0.9 },
      { kind: "send", who: "Maria A.", text: "Sendt til ekstern signering (BankID)", at: "27. mai 14:20" },
    ],
    "k-nora": [
      { kind: "create", who: "Maria A.", text: "Opprettet tilkallingsavtale", at: "29. mai 09:02" },
      { kind: "send", who: "Maria A.", text: "Sendt til ekstern signering", at: "29. mai 09:10" },
      { kind: "view", who: "Signeringsleverandør", text: "Nora V. åpnet dokumentet", at: "30. mai 18:42" },
    ],
    "k-selma": [
      { kind: "create", who: "Maria A.", text: "Opprettet alkohollov-tillegg", at: "22. mai 10:00" },
      { kind: "send", who: "Maria A.", text: "Sendt til signering", at: "23. mai 08:30" },
      { kind: "view", who: "Signeringsleverandør", text: "Selma L. åpnet dokumentet", at: "23. mai 12:10" },
      { kind: "sign", who: "Selma L.", text: "Signert med BankID", at: "24. mai 11:05" },
      { kind: "system", who: "Smartout", text: "Synket til lønn og ansattprofil", at: "24. mai 11:06" },
    ],
    "k-tobias": [
      { kind: "create", who: "Maria A.", text: "Opprettet sluttavtale", at: "1. mai 13:00" },
      { kind: "send", who: "Maria A.", text: "Sendt til signering", at: "2. mai 09:00" },
      { kind: "expire", who: "Signeringsleverandør", text: "Signeringslenke utløpt etter 14 dager", at: "16. mai 09:00" },
    ],
  };

  // ============================================================
  // EMPLOYEE FIRST-LOGIN ONBOARDING — step-by-step schema.
  // For the new hire (Pontus). One task per screen, reassuring, mobile-first.
  // ============================================================
  const CT_ONBOARD = {
    who: "Pontus Lindroth", role: "Kokk", dept: "Kjøkken", start: "10. juni 2026",
    workplace: "Bistro Nord · Storgata 14, Oslo", manager: "Jonas H.", inviter: "Maria A.",
    steps: [
      { id: "welcome", title: "Velkommen til Bistro Nord", kind: "intro",
        body: "Hei Pontus! Maria har invitert deg som kokk. Vi trenger noen få opplysninger for å gjøre arbeidsavtalen din klar — det tar under to minutter.", icon: "heart" },
      { id: "personal", title: "Personlige opplysninger", kind: "form", icon: "user",
        body: "Bekreft navn og kontaktinfo.", fields: [
          { label: "Fullt navn", val: "Pontus Lindroth", prefilled: true },
          { label: "Mobilnummer", val: "+47 •••", placeholder: "+47 400 00 000" },
          { label: "E-post", val: "pontus@epost.no", prefilled: true },
        ] },
      { id: "address", title: "Adresse", kind: "form", icon: "mappin",
        body: "Hvor bor du? Brukes på arbeidsavtalen.", fields: [
          { label: "Gateadresse", placeholder: "f.eks. Markveien 12" },
          { label: "Postnr og sted", placeholder: "0554 Oslo" },
        ] },
      { id: "id", title: "Fødselsnummer", kind: "form", icon: "lock", privacy: true,
        body: "Lovpålagt for arbeidsavtale og lønn. Lagres kryptert og deles kun med Skatteetaten.", fields: [
          { label: "Fødselsnummer (11 siffer)", placeholder: "•• •• •• •••••", sensitive: true },
        ] },
      { id: "bank", title: "Kontonummer", kind: "form", icon: "wallet",
        body: "For lønnsutbetaling. Du kan endre dette senere.", fields: [
          { label: "Kontonummer", placeholder: "1234 56 78901" },
        ] },
      { id: "emergency", title: "Nærmeste pårørende", kind: "form", icon: "phone", optional: true,
        body: "Valgfritt, men anbefalt for HMS-beredskap.", fields: [
          { label: "Navn", placeholder: "Navn på pårørende" },
          { label: "Telefon", placeholder: "+47 …" },
        ] },
      { id: "confirm", title: "Bekreft stillingen", kind: "confirm", icon: "checkdoc",
        body: "Stemmer dette? Si fra til Maria hvis noe er feil.", rows: [
          { k: "Rolle", v: "Kokk · Kjøkken" },
          { k: "Arbeidssted", v: "Bistro Nord, Oslo" },
          { k: "Oppstart", v: "10. juni 2026" },
          { k: "Nærmeste leder", v: "Jonas H." },
        ] },
      { id: "training", title: "Opplæringsplanen din", kind: "training", icon: "cap",
        body: "Dette er løpet ditt de første ukene. Du fullfører det i appen.", items: [
          { t: "HACCP & mattrygghet", s: "Før første selvstendige vakt", req: true },
          { t: "Brannvern & rømning", s: "Uke 1", req: true },
          { t: "Allergener & meny", s: "Uke 1", req: true },
          { t: "Kjøkkenrutiner", s: "Uke 2", req: false },
        ] },
      { id: "terms", title: "Nøkkelvilkår", kind: "terms", icon: "scale",
        body: "Kort oppsummert. Den fullstendige avtalen signerer du med BankID i neste steg.", rows: [
          { k: "Lønn", v: "236 kr/t · Trinn 3 Fagarbeider" },
          { k: "Stilling", v: "100 % · fast · turnus" },
          { k: "Prøvetid", v: "6 måneder" },
          { k: "Ferie", v: "5 uker · 12 % feriepenger" },
        ] },
      { id: "done", title: "Klar for signering", kind: "done", icon: "check",
        body: "Takk, Pontus! Alt er på plass. Vi sender deg over til BankID-signering nå.", icon2: "sparkle" },
    ],
  };

  Object.assign(D, {
    CT_PROVIDER, CT_TARIFF, CT_BOT_THREAD, CT_BOT_QA, CT_GROUPS,
    CT_BUILDER_SECTIONS, CT_TEMPLATES, CT_CONTRACTS, CT_MISSING, CT_AUDIT, CT_ONBOARD,
  });
})();
