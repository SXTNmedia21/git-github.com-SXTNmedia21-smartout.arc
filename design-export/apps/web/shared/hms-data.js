// ===== Smartout — HMS (helse · miljø · sikkerhet) data model =====
// Extends window.SmartoutData with the HMS operational domain.
// Turns handbook content into visible execution: protocols → routines → tasks,
// training/quiz/manual completion, evidence, comments, readiness, audit log, AI.
//
// Reuses the existing world (Bistro Nord cast, DEPARTMENTS/LOCATIONS, PROTOCOLS)
// and links every HMS protocol back to a real chapter in the HMS-håndbok
// (window.SmartoutData.HANDBOOKS → id "hms"). Plain script — loads before babel.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});
  const emp = (id) => (D.EMP_BY_ID && D.EMP_BY_ID[id]) || { id, display: id, initials: "?", color: "#888", stilling: "" };

  // ---------- the three HMS areas (visually distinct, calm) ----------
  // Helse = soft teal · Miljø = natural green · Sikkerhet = amber→red (risk)
  const HMS_CATEGORIES = {
    helse: {
      id: "helse", name: "Helse", icon: "heart", accent: "#0e8c8c", soft: "rgba(14,140,140,.10)",
      tagline: "Trygge folk, sunt arbeidsmiljø",
      desc: "Smittevern, hygiene, ergonomi og arbeidshelse — at folk holder seg friske og trygge på jobb.",
      status: "ok", compliance: 91, prevCompliance: 88,
      trend: [82, 84, 83, 86, 88, 90, 91],
      handbookPath: "HMS-håndbok › Helse",
    },
    miljo: {
      id: "miljo", name: "Miljø", icon: "globe", accent: "#3c8c4a", soft: "rgba(60,140,74,.10)",
      tagline: "Bærekraftig drift",
      desc: "Avfall og kildesortering, energi- og vannforbruk og miljøfarlige stoffer — driften vår sitt fotavtrykk.",
      status: "warn", compliance: 76, prevCompliance: 79,
      trend: [84, 82, 81, 80, 78, 77, 76],
      handbookPath: "HMS-håndbok › Miljø",
    },
    sikkerhet: {
      id: "sikkerhet", name: "Sikkerhet", icon: "shield", accent: "#c2700c", soft: "rgba(194,112,12,.12)",
      tagline: "Beredt på det som kan skje",
      desc: "Brannvern, evakuering, risikovurdering, førstehjelp og sikker bruk av utstyr — det som beskytter liv.",
      status: "crit", compliance: 68, prevCompliance: 72,
      trend: [78, 77, 75, 74, 72, 70, 68],
      handbookPath: "HMS-håndbok › Sikkerhet",
    },
  };
  const HMS_CAT_ORDER = ["helse", "miljo", "sikkerhet"];

  const HMS_IMPORTANCE = {
    kritisk: { id: "kritisk", label: "Kritisk", tone: "error", desc: "Lovpålagt / liv og helse" },
    hoy: { id: "hoy", label: "Høy", tone: "warning", desc: "Vesentlig for trygg drift" },
    normal: { id: "normal", label: "Normal", tone: "muted", desc: "God praksis" },
  };

  // ---------- compact builders ----------
  const routine = (id, name, cadence, ownerRole, last, next, status) => ({ id, name, cadence, ownerRole, last, next, status });
  const evi = (kind, label, by, at) => ({ kind, label, by, at });

  // =================================================================
  // PROTOCOLS — the heart of HMS execution. Each links to a handbook
  // chapter and carries routines, required training, tasks, evidence.
  // =================================================================
  const HMS_PROTOCOLS = [
    // ───────────────── HELSE ─────────────────
    {
      id: "hp-smitte", cat: "helse", code: "HMS-H-01", title: "Sykdom og smittevern på arbeidsplassen",
      importance: "kritisk", owner: "es", ownerRole: "Daglig leder",
      handbook: { book: "hms", chapterId: "h-proc", docId: "h-proc-3", path: "HMS-håndbok › Helse › Smittevern", chapterTitle: "Prosedyrer og sikre rutiner" },
      roles: ["pos-kokk", "pos-servitor", "pos-renhold", "pos-bartender"], locations: ["loc-rest", "loc-kjk", "loc-lager"],
      status: "ok", compliance: 94, trend: [88, 89, 90, 92, 93, 94, 94],
      checklist: { done: 11, total: 12 }, openTasks: 1, overdue: 0, missingTraining: 1, incidents: 0, comments: 2,
      nextReview: "12. aug 2026", lastTask: { title: "Daglig hygienekontroll", by: "Ida B.", at: "I dag 07:40" },
      routines: [
        routine("r-h1", "Daglig hygiene- og håndvaskkontroll", "Daglig", "Renholder", "I dag 07:40", "I morgen 07:00", "ontrack"),
        routine("r-h2", "Sykdomsregistrering ved symptomer", "Ved behov", "Skiftleder", "26. mai", "—", "ontrack"),
        routine("r-h3", "Gjennomgang smittevernrutine", "Kvartalsvis", "Daglig leder", "1. apr", "1. jul 2026", "due"),
      ],
      trainings: ["Smittevern og hygienerutiner"], quizzes: ["Smittevern grunnkontroll"], manuals: ["Rutine ved sykdomssymptomer"],
      evidence: [evi("photo", "Foto av rengjort kjøkkensone", "Ida B.", "I dag 07:42"), evi("signoff", "Signert hygienekontroll uke 22", "Maria A.", "26. mai 14:10")],
    },
    {
      id: "hp-hygiene", cat: "helse", code: "HMS-H-02", title: "Renhold og personlig hygiene",
      importance: "hoy", owner: "ib", ownerRole: "Renholder",
      handbook: { book: "hms", chapterId: "h-proc", docId: "h-proc-3", path: "HMS-håndbok › Helse › Renhold og hygiene", chapterTitle: "Prosedyrer og sikre rutiner" },
      roles: ["pos-renhold", "pos-kokk"], locations: ["loc-rest", "loc-kjk", "loc-lager"],
      status: "ok", compliance: 89, trend: [80, 82, 84, 85, 87, 88, 89],
      checklist: { done: 8, total: 9 }, openTasks: 1, overdue: 0, missingTraining: 0, incidents: 0, comments: 0,
      nextReview: "5. sep 2026", lastTask: { title: "Renholdsplan kveld", by: "Ida B.", at: "I går 23:10" },
      routines: [
        routine("r-h4", "Renholdsplan åpning", "Daglig", "Renholder", "I dag 07:15", "I morgen 07:00", "ontrack"),
        routine("r-h5", "Dypvask kjøkken", "Ukentlig", "Renholder", "23. mai", "30. mai 2026", "due"),
      ],
      trainings: ["Renhold og hygiene"], quizzes: ["Hygienekontroll"], manuals: ["Renholdsplan og soner"],
      evidence: [evi("signoff", "Signert renholdsplan kveld", "Ida B.", "I går 23:10")],
    },
    {
      id: "hp-ergonomi", cat: "helse", code: "HMS-H-03", title: "Ergonomi og arbeidsbelastning",
      importance: "normal", owner: "ma", ownerRole: "Driftsleder",
      handbook: { book: "hms", chapterId: "h-risk", docId: "h-risk-1", path: "HMS-håndbok › Helse › Ergonomi", chapterTitle: "Risikovurdering" },
      roles: ["pos-kokk", "pos-servitor", "pos-bartender"], locations: ["loc-rest", "loc-kjk"],
      status: "warn", compliance: 82, trend: [86, 85, 84, 83, 83, 82, 82],
      checklist: { done: 4, total: 6 }, openTasks: 2, overdue: 1, missingTraining: 2, incidents: 1, comments: 1,
      nextReview: "Forfalt 20. mai", lastTask: { title: "Vernerunde løft og rygg", by: "Maria A.", at: "18. mai" },
      routines: [
        routine("r-h6", "Vernerunde ergonomi", "Halvårlig", "Verneombud", "18. mai", "Forfalt 20. mai", "behind"),
        routine("r-h7", "Pause- og rotasjonsrutine kjøkken", "Daglig", "Skiftleder", "I dag", "I morgen", "ontrack"),
      ],
      trainings: ["Ergonomi og løfteteknikk"], quizzes: [], manuals: ["Riktig løfteteknikk"],
      evidence: [],
    },

    // ───────────────── MILJØ ─────────────────
    {
      id: "mp-avfall", cat: "miljo", code: "HMS-M-01", title: "Avfallshåndtering og kildesortering",
      importance: "hoy", owner: "ma", ownerRole: "Driftsleder",
      handbook: { book: "hms", chapterId: "h-improve", docId: null, path: "HMS-håndbok › Miljø › Avfall og bærekraft", chapterTitle: "Forbedringstiltak" },
      roles: ["pos-kokk", "pos-servitor", "pos-renhold"], locations: ["loc-kjk", "loc-lager"],
      status: "warn", compliance: 74, trend: [82, 80, 79, 77, 76, 75, 74],
      checklist: { done: 6, total: 10 }, openTasks: 3, overdue: 1, missingTraining: 3, incidents: 0, comments: 4,
      nextReview: "1. jul 2026", lastTask: { title: "Tømming kildesortering", by: "Ida B.", at: "I dag 06:50" },
      routines: [
        routine("r-m1", "Kildesortering og tømming", "Daglig", "Renholder", "I dag 06:50", "I morgen 06:30", "ontrack"),
        routine("r-m2", "Veiing og logg matsvinn", "Daglig", "Kokk", "I går", "I dag 22:00", "due"),
        routine("r-m3", "Henting farlig avfall", "Månedlig", "Driftsleder", "2. mai", "Forfalt 2. jun", "behind"),
      ],
      trainings: ["Kildesortering for driftsteam"], quizzes: ["Miljørutiner kontroll"], manuals: ["Avfallssoner og leverandørkrav"],
      evidence: [evi("photo", "Foto av sorterte avfallssoner", "Ida B.", "I dag 06:52"), evi("file", "Matsvinnlogg uke 21.pdf", "Jonas H.", "23. mai")],
    },
    {
      id: "mp-energi", cat: "miljo", code: "HMS-M-02", title: "Energi- og vannforbruk",
      importance: "normal", owner: "es", ownerRole: "Daglig leder",
      handbook: { book: "hms", chapterId: "h-improve", docId: null, path: "HMS-håndbok › Miljø › Energi", chapterTitle: "Forbedringstiltak" },
      roles: ["pos-kokk", "pos-bartender"], locations: ["loc-kjk", "loc-rest"],
      status: "ok", compliance: 85, trend: [78, 80, 81, 82, 84, 84, 85],
      checklist: { done: 5, total: 6 }, openTasks: 0, overdue: 0, missingTraining: 1, incidents: 0, comments: 0,
      nextReview: "15. sep 2026", lastTask: { title: "Nedstenging utstyr", by: "Jonas H.", at: "I går 23:30" },
      routines: [
        routine("r-m4", "Sjekk nedstenging utstyr", "Daglig", "Skiftleder", "I går 23:30", "I dag 23:00", "ontrack"),
        routine("r-m5", "Avlesning strøm og vann", "Månedlig", "Daglig leder", "1. mai", "1. jun 2026", "due"),
      ],
      trainings: ["Energibevisst drift"], quizzes: [], manuals: ["Sjekkliste nedstenging"],
      evidence: [evi("signoff", "Signert nedstenging kveld", "Jonas H.", "I går 23:30")],
    },
    {
      id: "mp-kjemi", cat: "miljo", code: "HMS-M-03", title: "Kjemikalier og miljøfarlig avfall",
      importance: "kritisk", owner: "ib", ownerRole: "Renholder",
      handbook: { book: "hms", chapterId: "h-risk", docId: "h-risk-3", path: "HMS-håndbok › Miljø › Kjemikalier", chapterTitle: "Risikovurdering" },
      roles: ["pos-renhold", "pos-kokk"], locations: ["loc-lager", "loc-kjk"],
      status: "crit", compliance: 61, trend: [74, 72, 70, 67, 64, 62, 61],
      checklist: { done: 3, total: 8 }, openTasks: 4, overdue: 2, missingTraining: 2, incidents: 1, comments: 3,
      nextReview: "Forfalt 14. jan", lastTask: { title: "Stoffkartotek-oppdatering", by: "—", at: "Ikke startet" },
      routines: [
        routine("r-m6", "Oppdater stoffkartotek (datablad)", "Halvårlig", "Renholder", "14. jan 2025", "Forfalt 14. jan", "behind"),
        routine("r-m7", "Kontroll oppbevaring kjemikalier", "Månedlig", "Verneombud", "2. mai", "2. jun 2026", "due"),
      ],
      trainings: ["Kjemikaliesikkerhet", "Kildesortering for driftsteam"], quizzes: ["Miljørutiner kontroll"], manuals: ["Sikker oppbevaring av kjemikalier"],
      evidence: [],
    },

    // ───────────────── SIKKERHET ─────────────────
    {
      id: "sp-brann", cat: "sikkerhet", code: "HMS-S-01", title: "Brannvern og evakuering",
      importance: "kritisk", owner: "ma", ownerRole: "HMS-ansvarlig",
      handbook: { book: "hms", chapterId: "h-fire", docId: "h-fire-1", path: "HMS-håndbok › Sikkerhet › Brann og evakuering", chapterTitle: "Brannvern" },
      roles: ["pos-driftsleder", "pos-sous", "pos-servitor", "pos-bartender"], locations: ["loc-rest", "loc-kjk", "loc-event", "loc-lager"],
      status: "warn", compliance: 79, trend: [84, 83, 82, 81, 80, 79, 79],
      checklist: { done: 7, total: 9 }, openTasks: 2, overdue: 1, missingTraining: 2, incidents: 0, comments: 3,
      nextReview: "1. jun 2026", lastTask: { title: "Kontroll slukkeutstyr", by: "Erik S.", at: "20. mai" },
      routines: [
        routine("r-s1", "Kontroll slukkeutstyr og rømningsveier", "Månedlig", "Brannvernleder", "20. mai", "20. jun 2026", "due"),
        routine("r-s2", "Brannøvelse / evakueringstest", "Halvårlig", "HMS-ansvarlig", "12. feb", "Forfalt 12. aug", "behind"),
        routine("r-s3", "Sjekk rømningsveier fri", "Daglig", "Skiftleder", "I dag 16:00", "I morgen", "ontrack"),
      ],
      trainings: ["Brannvern for skiftledere"], quizzes: ["Evakueringsrutine test"], manuals: ["Branninstruks og møteplass"],
      evidence: [evi("signoff", "Signert kontroll slukkeutstyr", "Erik S.", "20. mai 11:00"), evi("photo", "Foto rømningsvei øst", "Selma L.", "I dag 16:02")],
    },
    {
      id: "sp-risiko", cat: "sikkerhet", code: "HMS-S-02", title: "Risikovurdering kjøkken",
      importance: "kritisk", owner: "ma", ownerRole: "HMS-ansvarlig",
      handbook: { book: "hms", chapterId: "h-risk", docId: "h-risk-1", path: "HMS-håndbok › Sikkerhet › Risiko", chapterTitle: "Risikovurdering" },
      roles: ["pos-kokk", "pos-sous"], locations: ["loc-kjk"],
      status: "warn", compliance: 80, trend: [76, 77, 78, 79, 79, 80, 80],
      checklist: { done: 6, total: 8 }, openTasks: 1, overdue: 0, missingTraining: 1, incidents: 1, comments: 3,
      nextReview: "2. jun 2026", lastTask: { title: "Risikogjennomgang varme overflater", by: "Maria A.", at: "26. mai" },
      routines: [
        routine("r-s4", "Risikovurdering ved endring", "Ved behov", "HMS-ansvarlig", "26. mai", "—", "ontrack"),
        routine("r-s5", "Vernerunde kjøkken", "Kvartalsvis", "Verneombud", "10. mar", "10. jun 2026", "due"),
      ],
      trainings: ["HMS-grunnkurs"], quizzes: ["Risikoforståelse kjøkken"], manuals: ["Sikker håndtering av varme og kniver"],
      evidence: [evi("file", "Risikovurdering kjøkken 2026.pdf", "Maria A.", "26. mai")],
    },
    {
      id: "sp-forstehjelp", cat: "sikkerhet", code: "HMS-S-03", title: "Førstehjelp og beredskap",
      importance: "hoy", owner: "ma", ownerRole: "HMS-ansvarlig",
      handbook: { book: "hms", chapterId: "h-emerg", docId: "h-emerg-1", path: "HMS-håndbok › Sikkerhet › Beredskap", chapterTitle: "Førstehjelp og beredskap" },
      roles: ["pos-driftsleder", "pos-servitor"], locations: ["loc-rest", "loc-event"],
      status: "crit", compliance: 63, trend: [72, 70, 68, 66, 65, 64, 63],
      checklist: { done: 4, total: 8 }, openTasks: 3, overdue: 2, missingTraining: 4, incidents: 0, comments: 1,
      nextReview: "3. jun 2026", lastTask: { title: "Kontroll førstehjelpsskap", by: "Selma L.", at: "15. mai" },
      routines: [
        routine("r-s6", "Kontroll førstehjelpsskap", "Månedlig", "Førstehjelpsansvarlig", "15. mai", "15. jun 2026", "due"),
        routine("r-s7", "Beredskapsplan-gjennomgang", "Årlig", "Daglig leder", "—", "Ikke startet", "behind"),
      ],
      trainings: ["Førstehjelp grunnkurs", "Brannvern for skiftledere"], quizzes: ["Beredskap test"], manuals: ["Førstehjelpsrutine"],
      evidence: [],
    },
    {
      id: "sp-maskin", cat: "sikkerhet", code: "HMS-S-04", title: "Sikker bruk av maskiner og kniver",
      importance: "hoy", owner: "jh", ownerRole: "Sous-chef",
      handbook: { book: "hms", chapterId: "h-risk", docId: "h-risk-1", path: "HMS-håndbok › Sikkerhet › Utstyr", chapterTitle: "Risikovurdering" },
      roles: ["pos-kokk", "pos-sous"], locations: ["loc-kjk"],
      status: "ok", compliance: 88, trend: [82, 83, 84, 86, 87, 88, 88],
      checklist: { done: 7, total: 8 }, openTasks: 0, overdue: 0, missingTraining: 1, incidents: 0, comments: 0,
      nextReview: "20. aug 2026", lastTask: { title: "Sjekk vernebryter kvern", by: "Jonas H.", at: "I dag 09:10" },
      routines: [
        routine("r-s8", "Kontroll vern på maskiner", "Ukentlig", "Sous-chef", "I dag 09:10", "6. jun 2026", "ontrack"),
      ],
      trainings: ["Sikker maskinbruk"], quizzes: [], manuals: ["Bruksanvisning kjøkkenmaskiner"],
      evidence: [evi("signoff", "Signert vernkontroll kvern", "Jonas H.", "I dag 09:10")],
    },
  ];
  const HMS_PROTO_BY_ID = {};
  HMS_PROTOCOLS.forEach((p) => (HMS_PROTO_BY_ID[p.id] = p));

  // =================================================================
  // TRAINING / QUIZ / MANUAL completion tracking
  // status: completed · inprogress · overdue · missing · due
  // =================================================================
  const trk = (id, e, kind, item, proto, status, score, deadline, cert, last) =>
    ({ id, emp: e, kind, item, proto, cat: HMS_PROTO_BY_ID[proto] ? HMS_PROTO_BY_ID[proto].cat : "helse", status, score, deadline, cert, last });

  const HMS_TRACKING = [
    // Sikkerhet — brann
    trk("t1", "sl", "quiz", "Evakueringsrutine test", "sp-brann", "completed", "92%", "fullført", "valid", "I dag 10:14"),
    trk("t2", "jh", "training", "Brannvern for skiftledere", "sp-brann", "completed", "bestått", "fullført", "valid", "20. mai"),
    trk("t3", "pk", "manual", "Branninstruks og møteplass", "sp-brann", "missing", "—", "28. mai", "none", "Aldri åpnet"),
    trk("t4", "ma", "training", "Brannvern for skiftledere", "sp-brann", "completed", "bestått", "fullført", "valid", "12. feb"),
    trk("t5", "nv", "quiz", "Evakueringsrutine test", "sp-brann", "missing", "—", "5. jun", "none", "Aldri startet"),
    // Helse — smittevern
    trk("t6", "jh", "training", "Smittevern og hygienerutiner", "hp-smitte", "overdue", "—", "Forfalt 22. mai", "expiring", "1. mar"),
    trk("t7", "sl", "training", "Smittevern og hygienerutiner", "hp-smitte", "completed", "bestått", "fullført", "valid", "14. mai"),
    trk("t8", "ib", "training", "Renhold og hygiene", "hp-hygiene", "completed", "bestått", "fullført", "valid", "5. sep 2025"),
    trk("t9", "pk", "quiz", "Smittevern grunnkontroll", "hp-smitte", "inprogress", "60%", "4. jun", "none", "I dag 09:30"),
    trk("t10", "sl", "manual", "Rutine ved sykdomssymptomer", "hp-smitte", "completed", "lest", "fullført", "valid", "14. mai"),
    // Miljø
    trk("t11", "ib", "training", "Kildesortering for driftsteam", "mp-avfall", "completed", "bestått", "fullført", "valid", "10. apr"),
    trk("t12", "jh", "quiz", "Miljørutiner kontroll", "mp-avfall", "overdue", "—", "Forfalt 18. mai", "none", "2. mai"),
    trk("t13", "pk", "training", "Kildesortering for driftsteam", "mp-avfall", "missing", "—", "10. jun", "none", "Aldri startet"),
    trk("t14", "ib", "manual", "Sikker oppbevaring av kjemikalier", "mp-kjemi", "completed", "lest", "fullført", "valid", "12. jan"),
    trk("t15", "jh", "training", "Kjemikaliesikkerhet", "mp-kjemi", "overdue", "—", "Forfalt 14. jan", "expired", "10. jan 2025"),
    // Sikkerhet — øvrig
    trk("t16", "ma", "manual", "HMS-protokollgjennomgang", "sp-risiko", "due", "—", "Om 7 dager", "valid", "26. mai"),
    trk("t17", "sl", "training", "Førstehjelp grunnkurs", "sp-forstehjelp", "overdue", "—", "Forfalt 15. mai", "expiring", "2023"),
    trk("t18", "jh", "training", "Sikker maskinbruk", "sp-maskin", "completed", "bestått", "fullført", "valid", "20. apr"),
    trk("t19", "pk", "training", "Førstehjelp grunnkurs", "sp-forstehjelp", "missing", "—", "12. jun", "none", "Aldri startet"),
    trk("t20", "es", "training", "Brannvern for skiftledere", "sp-brann", "completed", "bestått", "fullført", "valid", "1. mar"),
  ];

  // =================================================================
  // EMPLOYEE READINESS — cleared / missing / overdue / cert / blocked
  // =================================================================
  const ready = (e, status, items, blockedFrom) => ({ emp: e, status, items, blockedFrom: blockedFrom || [] });
  const HMS_READINESS = [
    ready("ma", "cleared", [{ k: "Alle HMS-krav oppfylt", t: "ok" }], []),
    ready("sl", "overdue", [{ k: "Førstehjelp forfalt (15. mai)", t: "overdue" }, { k: "Førstehjelp-sertifikat utløper", t: "cert" }], ["Beredskapsansvar"]),
    ready("jh", "overdue", [{ k: "Smittevern-opplæring forfalt", t: "overdue" }, { k: "Miljøquiz forfalt", t: "overdue" }], []),
    ready("ib", "cleared", [{ k: "Renhold, kjemikalie og miljø i orden", t: "ok" }], []),
    ready("pk", "blocked", [{ k: "Branninstruks ikke lest", t: "missing" }, { k: "Smittevern-quiz pågår", t: "inprogress" }, { k: "Mangler hygienesertifikat", t: "cert" }], ["Selvstendig vakt", "Kassesalg alkohol"]),
    ready("nv", "blocked", [{ k: "Evakueringstest ikke startet", t: "missing" }, { k: "Mangler HMS-grunnkurs", t: "missing" }], ["Selvstendig vakt"]),
    ready("es", "cleared", [{ k: "Brannvernleder-ansvar oppfylt", t: "ok" }], []),
  ];

  // =================================================================
  // HMS TASKS & CHECKLISTS — operational execution generated by routines
  // =================================================================
  const task = (o) => Object.assign({
    status: "open", evidenceRequired: false, photos: 0, deviation: false, comments: 0, critical: false, completedAt: null, completedBy: null,
  }, o);
  const HMS_TASKS = [
    task({ id: "k1", title: "Kontroll slukkeutstyr og rømningsveier", proto: "sp-brann", cat: "sikkerhet", role: "Brannvernleder", location: "loc-rest", due: "20. jun 09:00", critical: true, evidenceRequired: true, status: "open" }),
    task({ id: "k2", title: "Brannøvelse / evakueringstest Q2", proto: "sp-brann", cat: "sikkerhet", role: "HMS-ansvarlig", location: "loc-rest", due: "Forfalt 12. aug", critical: true, evidenceRequired: true, status: "overdue", deviation: true, comments: 2 }),
    task({ id: "k3", title: "Daglig hygiene- og håndvaskkontroll", proto: "hp-smitte", cat: "helse", role: "Renholder", location: "loc-kjk", due: "I dag 07:00", evidenceRequired: true, photos: 1, status: "done", completedAt: "I dag 07:42", completedBy: "ib" }),
    task({ id: "k4", title: "Tømming og logg kildesortering", proto: "mp-avfall", cat: "miljo", role: "Renholder", location: "loc-lager", due: "I dag 06:30", evidenceRequired: true, photos: 1, status: "done", completedAt: "I dag 06:52", completedBy: "ib" }),
    task({ id: "k5", title: "Veiing og logg matsvinn", proto: "mp-avfall", cat: "miljo", role: "Kokk", location: "loc-kjk", due: "I dag 22:00", evidenceRequired: true, status: "open" }),
    task({ id: "k6", title: "Oppdater stoffkartotek (3 nye midler)", proto: "mp-kjemi", cat: "miljo", role: "Renholder", location: "loc-lager", due: "Forfalt 14. jan", critical: true, status: "overdue", deviation: true, comments: 1 }),
    task({ id: "k7", title: "Kontroll førstehjelpsskap", proto: "sp-forstehjelp", cat: "sikkerhet", role: "Førstehjelpsansvarlig", location: "loc-rest", due: "15. jun 12:00", evidenceRequired: true, status: "open" }),
    task({ id: "k8", title: "Sjekk rømningsveier fri", proto: "sp-brann", cat: "sikkerhet", role: "Skiftleder", location: "loc-rest", due: "I dag 16:00", evidenceRequired: true, photos: 1, status: "done", completedAt: "I dag 16:02", completedBy: "sl" }),
    task({ id: "k9", title: "Kontroll vern på kjøkkenmaskiner", proto: "sp-maskin", cat: "sikkerhet", role: "Sous-chef", location: "loc-kjk", due: "6. jun 10:00", status: "done", completedAt: "I dag 09:10", completedBy: "jh", evidenceRequired: true }),
    task({ id: "k10", title: "Vernerunde ergonomi", proto: "hp-ergonomi", cat: "helse", role: "Verneombud", location: "loc-kjk", due: "Forfalt 20. mai", status: "overdue", comments: 1 }),
    task({ id: "k11", title: "Henting farlig avfall", proto: "mp-avfall", cat: "miljo", role: "Driftsleder", location: "loc-lager", due: "Forfalt 2. jun", status: "overdue", critical: true }),
    task({ id: "k12", title: "Dypvask kjøkken", proto: "hp-hygiene", cat: "helse", role: "Renholder", location: "loc-kjk", due: "30. mai 23:00", evidenceRequired: true, status: "open" }),
  ];

  // =================================================================
  // AVVIK (deviations / nonconformities) — Kanban lifecycle
  // status: meldt → arbeid → verifisering → lukket
  // sev: kritisk · hoy · lav   ·   reporter/owner are emp uids
  // =================================================================
  const dev = (o) => Object.assign({
    sev: "hoy", status: "meldt", comments: 0, photos: 0, cause: null, tiltak: null, due: null, sla: null,
  }, o);
  const HMS_DEVIATIONS = [
    dev({ id: "AV-218", title: "Temperaturavvik Kjøl 3 — over +4 °C i 32 min", cat: "helse", sev: "kritisk", status: "meldt",
      proto: "hp-smitte", location: "loc-kjk", reporter: "jh", owner: "ma", reportedAt: "I dag 06:48", due: "I dag 12:00", sla: "Haster",
      desc: "Morgenkontroll viste +5,2 °C på Kjøl 3. Mistanke om løs pakning. Varer flyttet til Kjøl 1.", comments: 2, photos: 1 }),
    dev({ id: "AV-217", title: "Glatt gulv ved oppvask — manglende sklimatte", cat: "sikkerhet", sev: "hoy", status: "meldt",
      proto: "sp-maskin", location: "loc-kjk", reporter: "sl", owner: "ma", reportedAt: "I dag 08:10", due: "31. mai",
      desc: "Nesten-ulykke: ansatt skled ved oppvaskstasjon. Sklimatte mangler etter dypvask.", comments: 1, photos: 1 }),
    dev({ id: "AV-215", title: "Brannøvelse / evakueringstest 9 mnd forsinket", cat: "sikkerhet", sev: "kritisk", status: "arbeid",
      proto: "sp-brann", location: "loc-rest", reporter: "sk", owner: "es", reportedAt: "12. mai", due: "31. mai", sla: "Lovpålagt",
      desc: "Halvårlig evakueringstest ikke gjennomført siden 12. feb. Hull i lovpålagt rutine.",
      cause: "Manglende planlagt dato etter lederbytte.", tiltak: "Booket torsdag 16:30, skiftledere varslet.", comments: 3, photos: 0 }),
    dev({ id: "AV-212", title: "Stoffkartotek mangler datablad på 3 nye midler", cat: "miljo", sev: "kritisk", status: "arbeid",
      proto: "mp-kjemi", location: "loc-lager", reporter: "sk", owner: "ib", reportedAt: "I går 15:40", due: "4. jun", sla: "Før tilsyn",
      desc: "Tre nye rengjøringsmidler tatt i bruk uten registrert sikkerhetsdatablad.",
      cause: "Innkjøp uten HMS-registrering.", tiltak: "Ida henter datablad fra leverandør, oppdaterer kartotek.", comments: 1, photos: 0 }),
    dev({ id: "AV-209", title: "Vernerunde ergonomi — tunge løft ved vareplukk", cat: "helse", sev: "hoy", status: "arbeid",
      proto: "hp-ergonomi", location: "loc-lager", reporter: "ma", owner: "sk", reportedAt: "20. mai", due: "10. jun",
      desc: "Gjentatte tunge løft over skulderhøyde i lager. Verneombud meldte under vernerunde.",
      cause: "Hylleplassering tvinger løft over skulder.", tiltak: "Flytte tunge varer til midthøyde + traller.", comments: 1, photos: 1 }),
    dev({ id: "AV-205", title: "Kuttskade ved grønnsakskutter — manglende vern", cat: "sikkerhet", sev: "hoy", status: "verifisering",
      proto: "sp-maskin", location: "loc-kjk", reporter: "jh", owner: "es", reportedAt: "8. mai", due: "28. mai",
      desc: "Mindre kuttskade da fingervern manglet på kutteren. Førstehjelp gitt, ingen sykefravær.",
      cause: "Vern demontert ved rengjøring og ikke remontert.", tiltak: "Vern remontert + sjekkpunkt lagt i daglig kontroll. Verifiseres av verneombud.", comments: 2, photos: 1 }),
    dev({ id: "AV-201", title: "Tom såpedispenser ved inngang sal", cat: "helse", sev: "lav", status: "verifisering",
      proto: "hp-smitte", location: "loc-rest", reporter: "ib", owner: "ib", reportedAt: "I dag 07:45", due: "I dag",
      desc: "Dispenser ved gjesteinngang var tom under morgenkontroll.",
      cause: "Ikke fylt ved stenging i går.", tiltak: "Fylt opp + lagt til i kveldssjekkliste.", comments: 0, photos: 1 }),
    dev({ id: "AV-198", title: "Henting farlig avfall forsinket", cat: "miljo", sev: "hoy", status: "lukket",
      proto: "mp-avfall", location: "loc-lager", reporter: "ma", owner: "ib", reportedAt: "2. jun", due: "5. jun",
      desc: "Farlig avfall (frityrolje, kjemikalier) ikke hentet på avtalt dato.",
      cause: "Manglende bestilling hos renovatør.", tiltak: "Henting bestilt og gjennomført. Fast påminnelse opprettet.", comments: 0, photos: 0 }),
    dev({ id: "AV-193", title: "Røykvarsler ute av drift på lager", cat: "sikkerhet", sev: "kritisk", status: "lukket",
      proto: "sp-brann", location: "loc-lager", reporter: "sl", owner: "es", reportedAt: "28. apr", due: "29. apr",
      desc: "Røykvarsler på lager pep ikke ved test.",
      cause: "Utladet batteri.", tiltak: "Batteri byttet, alle varslere testet og logget.", comments: 1, photos: 1 }),
  ];

  const HMS_DEV_STAGES = [
    { id: "meldt", label: "Meldt", tone: "var(--error)", desc: "Nytt avvik — trenger eier og vurdering" },
    { id: "arbeid", label: "Under arbeid", tone: "var(--warning)", desc: "Årsak kartlegges, tiltak iverksettes" },
    { id: "verifisering", label: "Verifisering", tone: "var(--info)", desc: "Tiltak utført — verifiseres av ansvarlig" },
    { id: "lukket", label: "Lukket", tone: "var(--success)", desc: "Verifisert og dokumentert" },
  ];

  // =================================================================
  // COMMENTS & FOLLOW-UP — mentions, priority, owner, due, resolution
  // =================================================================
  const HMS_COMMENTS = [
    { id: "c1", anchor: "sp-brann", anchorLabel: "Brannvern og evakuering", author: "ma", priority: "hoy", internal: true, text: "Evakueringstesten er forsinket — @es kan vi sette en dato før helgen? Skiftlederne må være med.", mentions: ["es"], owner: "es", due: "31. mai", resolved: false, at: "I dag 08:20", attachments: 0 },
    { id: "c2", anchor: "mp-kjemi", anchorLabel: "Kjemikalier og miljøfarlig avfall", author: "sk", priority: "kritisk", internal: false, text: "Tre nye rengjøringsmidler mangler sikkerhetsdatablad. Dette er et avvik vi må lukke før neste tilsyn.", mentions: ["ib"], owner: "ib", due: "4. jun", resolved: false, at: "I går 15:40", attachments: 1 },
    { id: "c3", anchor: "k2", anchorLabel: "Brannøvelse / evakueringstest Q2", author: "es", priority: "hoy", internal: true, text: "Enig. Foreslår torsdag 16:30 etter lunsjrush. Booker møteplass.", mentions: [], owner: "es", due: "29. mai", resolved: true, at: "I dag 09:05", attachments: 0 },
    { id: "c4", anchor: "hp-smitte", anchorLabel: "Sykdom og smittevern", author: "ib", priority: "normal", internal: false, text: "Hygienekontroll OK i dag, men dispenser ved inngang sal var tom. Fylt opp.", mentions: [], owner: null, due: null, resolved: true, at: "I dag 07:45", attachments: 1 },
    { id: "c5", anchor: "sp-forstehjelp", anchorLabel: "Førstehjelp og beredskap", author: "ma", priority: "hoy", internal: true, text: "Fire ansatte mangler førstehjelpskurs. @sl kan du ta en runde og melde på?", mentions: ["sl"], owner: "sl", due: "12. jun", resolved: false, at: "I går 11:10", attachments: 0 },
  ];

  // =================================================================
  // ACTIVITY / AUDIT LOG — filterable, export-ready
  // kind: routine · quiz · training · comment · protocol · evidence · ai · approval · handbook
  // =================================================================
  const HMS_ACTIVITY = [
    { id: "a1", kind: "evidence", cat: "helse", who: "ib", what: "lastet opp foto-bevis for «Daglig hygienekontroll»", when: "I dag 07:42", ref: "hp-smitte" },
    { id: "a2", kind: "quiz", cat: "sikkerhet", who: "sl", what: "fullførte quiz «Evakueringsrutine test» med 92%", when: "I dag 10:14", ref: "sp-brann" },
    { id: "a3", kind: "comment", cat: "sikkerhet", who: "ma", what: "kommenterte på «Brannvern og evakuering»", when: "I dag 08:20", ref: "sp-brann" },
    { id: "a4", kind: "ai", cat: "miljo", who: "bot", what: "foreslo sjekkliste fra kapittel «Avfall og bærekraft» — venter godkjenning", when: "I dag 08:02", ref: "mp-avfall" },
    { id: "a5", kind: "routine", cat: "sikkerhet", who: "sl", what: "fullførte rutine «Sjekk rømningsveier fri»", when: "I dag 16:02", ref: "sp-brann" },
    { id: "a6", kind: "approval", cat: "sikkerhet", who: "es", what: "godkjente kontroll av slukkeutstyr", when: "20. mai 11:00", ref: "sp-brann" },
    { id: "a7", kind: "training", cat: "miljo", who: "ib", what: "fullførte opplæring «Kildesortering for driftsteam»", when: "10. apr 14:20", ref: "mp-avfall" },
    { id: "a8", kind: "handbook", cat: "sikkerhet", who: "ma", what: "oppdaterte håndbokkapittel «Brannvern»", when: "2. mai 09:30", ref: "sp-brann" },
    { id: "a9", kind: "protocol", cat: "miljo", who: "sk", what: "merket «Kjemikalier» som avvik — stoffkartotek utdatert", when: "I går 15:40", ref: "mp-kjemi" },
    { id: "a10", kind: "comment", cat: "sikkerhet", who: "es", what: "løste oppfølging på «Brannøvelse Q2»", when: "I dag 09:05", ref: "sp-brann" },
  ];

  // =================================================================
  // AI HMS ASSISTANT — suggestions w/ source refs, confirmation-gated
  // AI never publishes, assigns mandatory training, or marks compliant
  // without human confirmation.
  // =================================================================
  const HMS_AI = [
    {
      id: "ai1", kind: "gap", cat: "sikkerhet", title: "Evakueringstest er 9 mnd forsinket",
      body: "Brannøvelsen skulle vært gjennomført halvårlig — siste var 12. feb. Det er et hull i en kritisk, lovpålagt rutine.",
      sources: [{ label: "HMS-håndbok › Brannvern", ref: "sp-brann" }, { label: "Rutine r-s2", ref: "sp-brann" }],
      action: "Foreslå dato og varsle skiftledere", confirm: "Ingenting sendes før du bekrefter.", toast: "Forslag til evakueringstest klargjort",
    },
    {
      id: "ai2", kind: "checklist", cat: "miljo", title: "Generer sjekkliste fra «Avfall og bærekraft»",
      body: "Kapittelet beskriver 6 krav til kildesortering som ennå ikke finnes som oppgaver. Jeg kan lage en sjekkliste — du redigerer før den publiseres.",
      sources: [{ label: "HMS-håndbok › Miljø › Avfall", ref: "mp-avfall" }],
      action: "Lag utkast til sjekkliste", confirm: "Utkast — publiseres ikke automatisk.", toast: "Sjekkliste-utkast laget",
    },
    {
      id: "ai3", kind: "training", cat: "sikkerhet", title: "4 ansatte mangler førstehjelpskurs",
      body: "Førstehjelp-protokollen krever kurs for beredskapsroller. Selma, Petter, Nora og Jonas står uten. Jeg kan foreslå påmelding.",
      sources: [{ label: "Førstehjelp-protokoll", ref: "sp-forstehjelp" }, { label: "Kompetansematrise", ref: null }],
      action: "Foreslå påmelding (krever bekreftelse)", confirm: "Obligatorisk opplæring tildeles kun etter din bekreftelse.", toast: "Påmeldingsforslag klargjort",
    },
    {
      id: "ai4", kind: "audit", cat: "helse", title: "Forbered tilsynssammendrag",
      body: "Jeg kan samle status, bevis og avvik på tvers av Helse, Miljø og Sikkerhet til et tilsynsklart sammendrag med kildehenvisninger.",
      sources: [{ label: "Alle HMS-protokoller", ref: null }],
      action: "Lag tilsynssammendrag", confirm: "Du gjennomgår før eksport.", toast: "Tilsynssammendrag under arbeid",
    },
  ];

  // =================================================================
  // BIBLIOTEK RELATIONS — everything below links to a parent protocol.
  // Legal refs · processes · procedures (content) · trainings · quizzes
  // · manuals · enforceable protocol-wide policies.
  // =================================================================
  const HMS_LEGAL = {
    "lov-aml": { id: "lov-aml", name: "Arbeidsmiljøloven", basis: "LOV-2005-06-17-62", scope: "Kap. 3–4 · systematisk HMS-arbeid og arbeidsmiljø", url: "lovdata.no/lov/2005-06-17-62" },
    "lov-ik": { id: "lov-ik", name: "Internkontrollforskriften", basis: "FOR-1996-12-06-1127", scope: "§5 · krav til systematisk internkontroll", url: "lovdata.no/forskrift/1996-12-06-1127" },
    "lov-ikmat": { id: "lov-ikmat", name: "IK-mat / Matlovsforskriften", basis: "FOR-1994-12-15-1187", scope: "Egenkontroll og sporbarhet for mattrygghet", url: "lovdata.no/forskrift/1994-12-15-1187" },
    "lov-brann": { id: "lov-brann", name: "Forskrift om brannforebygging", basis: "FOR-2015-12-17-1710", scope: "§9–11 · brannvern, rømning og øvelser", url: "lovdata.no/forskrift/2015-12-17-1710" },
    "lov-foru": { id: "lov-foru", name: "Forurensningsloven", basis: "LOV-1981-03-13-6", scope: "Plikt til å unngå forurensning og håndtere avfall", url: "lovdata.no/lov/1981-03-13-6" },
    "lov-avfall": { id: "lov-avfall", name: "Avfallsforskriften", basis: "FOR-2004-06-01-930", scope: "Kildesortering og farlig avfall", url: "lovdata.no/forskrift/2004-06-01-930" },
  };

  const HMS_PROCESSES = {
    "px-drift": { id: "px-drift", name: "Daglig driftsrytme", book: "bedrift", chapter: "Arbeidsflyt og rutiner", desc: "Åpning → drift → stenging der HMS-kontrollene er flettet inn i dagen." },
    "px-avvik": { id: "px-avvik", name: "Avvikshåndtering", book: "hms", chapter: "Avvikshåndtering", desc: "Registrering → tiltak → lukking av avvik i Smartout." },
    "px-mottak": { id: "px-mottak", name: "Mottakskontroll varer", book: "hms", chapter: "Prosedyrer og sikre rutiner", desc: "Temperatur, holdbarhet og emballasje ved levering." },
    "px-vakt": { id: "px-vakt", name: "Vaktbytte og overlevering", book: "bedrift", chapter: "Arbeidsflyt og rutiner", desc: "Overlevering av åpne HMS-punkter mellom skift." },
  };

  // protocol-wide enforceable policies + relations (by protocol id)
  const PROTO_REL = {
    "hp-smitte": { policies: ["Ansatte med symptomer på mage-/tarminfeksjon skal ikke håndtere mat, og melder fra samme dag.", "Håndvask ved oppstart, etter pauser og etter råvarehåndtering — uten unntak.", "Sykdom registreres i Smartout og utløser vurdering av vikar."], legal: ["lov-ikmat", "lov-ik"], processes: ["px-drift", "px-avvik"] },
    "hp-hygiene": { policies: ["Renholdsplan følges for hver sone, hvert skift.", "Brudd på hygienekrav stopper drift i berørt sone til utbedret."], legal: ["lov-ikmat"], processes: ["px-drift"] },
    "hp-ergonomi": { policies: ["Tunge løft over 25 kg utføres med hjelpemiddel eller to personer.", "Rotasjon mellom oppgaver ved repetitivt arbeid."], legal: ["lov-aml", "lov-ik"], processes: ["px-drift"] },
    "mp-avfall": { policies: ["All emballasje kildesorteres etter gjeldende soner.", "Matsvinn veies og logges hver kveld.", "Farlig avfall leveres kun til godkjent mottak."], legal: ["lov-avfall", "lov-foru"], processes: ["px-drift", "px-mottak"] },
    "mp-energi": { policies: ["Utstyr som ikke er i bruk slås av ved stenging.", "Avvik i forbruk meldes til driftsleder."], legal: ["lov-foru"], processes: ["px-drift"] },
    "mp-kjemi": { policies: ["Alle kjemikalier skal ha oppdatert sikkerhetsdatablad før bruk.", "Kjemikalier oppbevares i låst, merket skap.", "Rengjøringsmidler blandes aldri."], legal: ["lov-foru", "lov-ik", "lov-avfall"], processes: ["px-avvik"] },
    "sp-brann": { policies: ["Rømningsveier holdes til enhver tid frie.", "Ingen vakt åpner uten gjennomført rømningsvei-sjekk.", "Evakueringsøvelse gjennomføres halvårlig — ikke valgfritt."], legal: ["lov-brann", "lov-ik"], processes: ["px-drift", "px-avvik"] },
    "sp-risiko": { policies: ["Risikovurdering oppdateres ved enhver endring i utstyr, meny eller bemanning.", "Tiltak fra risikovurdering iverksettes før arbeidet starter."], legal: ["lov-aml", "lov-ik"], processes: ["px-avvik"] },
    "sp-forstehjelp": { policies: ["Minst én førstehjelpsansvarlig på hver vakt.", "Førstehjelpsskap kontrolleres månedlig og fylles ved mangel."], legal: ["lov-ik", "lov-aml"], processes: ["px-avvik"] },
    "sp-maskin": { policies: ["Maskiner brukes kun med vern på plass.", "Defekt utstyr merkes og tas ut av drift umiddelbart."], legal: ["lov-aml", "lov-ik"], processes: ["px-drift"] },
  };
  const DEFAULT_POLICIES = ["Protokollen er bindende for alle berørte roller.", "Avvik registreres og lukkes innen frist.", "Påkrevd opplæring må være fullført før selvstendig utførelse."];

  // ---------- procedures (one per routine) with readable content ----------
  const RICH_PROC = {
    "r-h1": [
      { p: "Daglig kontroll av hygiene og håndvask sikrer at smittevernet holdes i hevd gjennom hele driften. Utføres ved åpning av Renholder, og stikkprøves av skiftleder." },
      { h: "Slik gjør du", p: "Kontroller at alle håndvaskstasjoner har såpe, papir og varmt vann. Sjekk at dispensere ved inngang sal og kjøkken er fylt. Tørk av kontaktflater (dørhåndtak, kortterminaler)." },
      { h: "Bevis", p: "Ta ett foto av rengjort kjøkkensone og signer kontrollen i Smartout. Bevis lagres automatisk på protokollen «Sykdom og smittevern»." },
      { h: "Ved avvik", p: "Tom dispenser fylles umiddelbart. Manglende varmtvann meldes som avvik og varsles driftsleder før åpning." },
    ],
    "r-s1": [
      { p: "Månedlig kontroll av slukkeutstyr og rømningsveier er et lovpålagt brannforebyggende tiltak. Utføres av brannvernleder." },
      { h: "Slik gjør du", p: "Kontroller at brannslukkere er plombert, trykksatt og innen kontrolldato. Gå alle rømningsveier og bekreft at de er frie og at nødlys virker. Sjekk at møteplassen er tydelig merket." },
      { h: "Bevis", p: "Signer kontrollen og fest foto av hver rømningsvei. Avvik dokumenteres med bilde." },
      { h: "Ved avvik", p: "Blokkert rømningsvei utbedres umiddelbart. Defekt slukkeutstyr tas ut av bruk og erstattes samme dag." },
    ],
    "r-m1": [
      { p: "Daglig kildesortering og tømming holder avfallssonene i orden og oppfyller kravene til leverandør og kommune." },
      { h: "Slik gjør du", p: "Tøm og sorter rest, papp, plast, glass/metall og matavfall i riktige soner. Komprimer papp. Sett farlig avfall til side i merket beholder." },
      { h: "Bevis", p: "Foto av sorterte soner lastes opp ved fullføring." },
      { h: "Ved avvik", p: "Feilsortert avfall korrigeres. Overfylte beholdere meldes til driftsleder for ekstra henting." },
    ],
  };
  const genProcContent = (name, role, cadence) => ([
    { p: `Denne prosedyren beskriver hvordan «${name}» utføres ${(cadence || "").toLowerCase()} ved Bistro Nord. Ansvarlig rolle er ${role}.` },
    { h: "Slik gjør du", p: "Følg sjekklisten i rekkefølge og marker hvert punkt når det er utført. Ved avvik fra normal tilstand registreres avvik i Smartout, og ansvarlig leder varsles." },
    { h: "Bevis", p: "Der det kreves, dokumenteres utførelsen med foto eller signering. Bevis lagres automatisk på protokollen og er tilgjengelig for tilsyn." },
    { h: "Ved avvik", p: "Stopp arbeidet dersom det utgjør fare. Registrer avvik med beskrivelse og tiltak, og følg det opp til det er lukket." },
  ]);

  const HMS_PROCEDURES = {};
  // enrich routines with procedure + tasks; build procedure entities
  HMS_PROTOCOLS.forEach((p) => {
    p.policies = (PROTO_REL[p.id] || {}).policies || DEFAULT_POLICIES;
    p.legalIds = (PROTO_REL[p.id] || {}).legal || ["lov-ik"];
    p.processIds = (PROTO_REL[p.id] || {}).processes || [];
    (p.routines || []).forEach((r) => {
      const pid = "pd-" + r.id;
      r.procedure = pid;
      r.protocol = p.id;
      r.tasks = [
        { id: r.id + "-t1", title: "Forberedelse og klargjøring", role: r.ownerRole, status: "done" },
        { id: r.id + "-t2", title: r.name, role: r.ownerRole, status: r.status === "behind" ? "overdue" : r.status === "due" ? "open" : "done" },
        { id: r.id + "-t3", title: "Registrer bevis og signer kontroll", role: r.ownerRole, status: r.status === "ontrack" ? "done" : "open" },
      ];
      HMS_PROCEDURES[pid] = {
        id: pid, protocol: p.id, routine: r.id, cat: p.cat,
        title: r.name, summary: `Sikker rutine knyttet til ${p.title}.`,
        owner: p.owner, ownerRole: r.ownerRole, cadence: r.cadence,
        legalIds: p.legalIds,
        content: RICH_PROC[r.id] || genProcContent(r.name, r.ownerRole, r.cadence),
      };
    });
    p.procIds = (p.routines || []).map((r) => r.procedure);
  });

  // ---------- training / quiz / manual catalogs (parented to a protocol) ----------
  const slug = (s) => s.toLowerCase().replace(/[æ]/g, "a").replace(/[øö]/g, "o").replace(/[å]/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const HMS_TRAININGS = {}, HMS_QUIZZES = {}, HMS_MANUALS = {};
  const TR_BY_TITLE = {}, QZ_BY_TITLE = {}, MN_BY_TITLE = {};

  const RICH_QUIZ = {
    "Evakueringsrutine test": { pass: 80, questions: [
      { q: "Hvor er møteplassen ved evakuering?", choices: ["Parkeringsplassen foran", "På bakrommet", "I kjøkkenet"], correct: 0 },
      { q: "Hva gjør du først ved brannalarm?", choices: ["Fortsetter å servere", "Varsler gjester og starter evakuering", "Henter verdisaker"], correct: 1 },
      { q: "Hvem har ansvar for opptelling på møteplassen?", choices: ["Den som oppdaget brannen", "Skiftleder", "Først ankomne gjest"], correct: 1 },
    ] },
    "Smittevern grunnkontroll": { pass: 80, questions: [
      { q: "Når skal du vaske hender?", choices: ["Kun før vakt", "Ved oppstart, etter pauser og etter råvarehåndtering", "Bare hvis de er synlig skitne"], correct: 1 },
      { q: "Du har symptomer på omgangssyke. Hva gjør du?", choices: ["Jobber med hansker", "Melder fra og håndterer ikke mat", "Tar en paracet"], correct: 1 },
    ] },
    "Miljørutiner kontroll": { pass: 70, questions: [
      { q: "Hvor leveres farlig avfall?", choices: ["I restavfall", "Til godkjent mottak", "I papp-containeren"], correct: 1 },
      { q: "Hvor ofte logges matsvinn?", choices: ["Hver kveld", "En gang i måneden", "Kun ved tilsyn"], correct: 0 },
    ] },
  };
  const RICH_MANUAL = {
    "Branninstruks og møteplass": [
      { h: "Ved brann", p: "Varsle: rop «Brann!» og utløs nærmeste brannalarm. Redde: hjelp gjester og kolleger ut. Slukke: bruk slukker kun hvis det er trygt. Møteplass: parkeringsplassen foran inngangen." },
      { h: "Møteplass og opptelling", p: "Alle samles på møteplassen. Skiftleder teller opp ansatte og gjester mot vaktlista i Smartout og melder status til brannvesenet." },
      { h: "Etter hendelsen", p: "Ingen går inn igjen før brannvesenet gir klarsignal. Hendelsen registreres som avvik samme dag." },
    ],
    "Rutine ved sykdomssymptomer": [
      { h: "Symptomer", p: "Ved feber, oppkast eller diaré skal du ikke møte på vakt der du håndterer mat. Meld fra til skiftleder så tidlig som mulig." },
      { h: "Tilbake på jobb", p: "Du kan håndtere mat igjen tidligst 48 timer etter siste symptom på mage-/tarminfeksjon." },
    ],
    "Avfallssoner og leverandørkrav": [
      { h: "Soner", p: "Avfall sorteres i rest, papp, plast, glass/metall, matavfall og farlig avfall. Hver sone er merket med farge og symbol." },
      { h: "Leverandørkrav", p: "Henteavtale med kommunen krever ren fraksjon. Feilsortering kan medføre gebyr og avvises ved henting." },
    ],
  };
  const genModules = (title) => ([
    { title: "Innledning og formål", mins: 4 },
    { title: "Krav og regelverk", mins: 6 },
    { title: title, mins: 8 },
    { title: "Praktisk gjennomgang", mins: 7 },
  ]);
  const genQuestions = (title) => ([
    { q: `Hva er hovedformålet med «${title}»?`, choices: ["Pynt", "Trygg og forskriftsmessig drift", "Raskere service"], correct: 1 },
    { q: "Hvor registreres avvik?", choices: ["På en lapp", "I Smartout", "Ingen steder"], correct: 1 },
  ]);
  const genSections = (title) => ([
    { h: "Om denne manualen", p: `Manualen «${title}» gir steg-for-steg veiledning. Den er ment som praktisk oppslag i daglig drift og er knyttet til den aktuelle HMS-protokollen.` },
    { h: "Slik bruker du den", p: "Les gjennom seksjonene før du utfører oppgaven. Følg punktene i rekkefølge og spør skiftleder ved tvil." },
  ]);

  HMS_PROTOCOLS.forEach((p) => {
    p.trainingIds = []; p.quizIds = []; p.manualIds = [];
    (p.trainings || []).forEach((t) => {
      const id = "tr-" + slug(t);
      if (!HMS_TRAININGS[id]) { HMS_TRAININGS[id] = { id, title: t, protocol: p.id, cat: p.cat, duration: 25, summary: `Påkrevd opplæring for ${p.title}.`, modules: genModules(t) }; TR_BY_TITLE[t] = id; }
      p.trainingIds.push(id);
    });
    (p.quizzes || []).forEach((t) => {
      const id = "qz-" + slug(t);
      if (!HMS_QUIZZES[id]) { const rich = RICH_QUIZ[t]; HMS_QUIZZES[id] = { id, title: t, protocol: p.id, cat: p.cat, pass: rich ? rich.pass : 80, questions: rich ? rich.questions : genQuestions(t) }; QZ_BY_TITLE[t] = id; }
      p.quizIds.push(id);
    });
    (p.manuals || []).forEach((t) => {
      const id = "mn-" + slug(t);
      if (!HMS_MANUALS[id]) { HMS_MANUALS[id] = { id, title: t, protocol: p.id, cat: p.cat, summary: `Manual knyttet til ${p.title}.`, sections: RICH_MANUAL[t] || genSections(t) }; MN_BY_TITLE[t] = id; }
      p.manualIds.push(id);
    });
  });

  // ---------- HMS handbook view-model (mirrors HANDBOOKS → "hms", adds relations) ----------
  const HMS_BOOK = {
    id: "hms", name: "HMS-håndbok", short: "HMS", accent: "#f97316",
    tagline: "Trygt arbeid, trygg mat",
    desc: "Internkontroll for helse, miljø og sikkerhet. Hvert kapittel forankrer protokollene som gjør policy om til daglig utførelse.",
    statutory: true, owner: "ma",
    // chapters grouped by category, each lists the protocols it owns
    chapters: SD_CHAPTERS(),
  };
  function SD_CHAPTERS() {
    // derive chapters from protocols' handbook.chapterTitle, grouped
    const map = {};
    HMS_PROTOCOLS.forEach((p) => {
      const key = p.handbook.chapterId;
      if (!map[key]) map[key] = { id: key, title: p.handbook.chapterTitle, path: p.handbook.path.split(" › ").slice(0, 2).join(" › "), cat: p.cat, protocols: [] };
      map[key].protocols.push(p.id);
    });
    return Object.values(map);
  }

  // ---------- rollups for the dashboard ----------
  const catRollup = (cat) => {
    const ps = HMS_PROTOCOLS.filter((p) => p.cat === cat);
    return {
      protocols: ps.length,
      open: ps.reduce((s, p) => s + p.openTasks, 0),
      overdue: ps.reduce((s, p) => s + p.overdue, 0),
      missingTraining: ps.reduce((s, p) => s + p.missingTraining, 0),
      incidents: ps.reduce((s, p) => s + p.incidents, 0),
      comments: ps.reduce((s, p) => s + p.comments, 0),
    };
  };

  Object.assign(D, {
    HMS_CATEGORIES, HMS_CAT_ORDER, HMS_IMPORTANCE,
    HMS_PROTOCOLS, HMS_PROTO_BY_ID, HMS_TRACKING, HMS_READINESS,
    HMS_TASKS, HMS_DEVIATIONS, HMS_DEV_STAGES, HMS_COMMENTS, HMS_ACTIVITY, HMS_AI, HMS_catRollup: catRollup,
    HMS_LEGAL, HMS_PROCESSES, HMS_PROCEDURES, HMS_TRAININGS, HMS_QUIZZES, HMS_MANUALS, HMS_BOOK,
  });
})();
