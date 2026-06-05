// ===== Avstemming (Reconciliation) domain data =====
// Plain script (loads before the babel files), extends window.SmartoutData.
// Model (PRD-03 / 2026-04-19 redesign spec):
//   Avstemming er en SESSION, ikke en approval. Ansatt settler (Fase 1) →
//   admin godkjenner (Fase 2) → lås. Tre nivåer: daglig · yrke · sesong.
//   Handoff-motoren (AI → telefon → admin) er førsteklasses.
// Cast = Bistro Nord (data.js USERS + lonn-data identities), canonical dept colours.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // identity reuse (same uids as lonn-data: jh sl pk ib es ot kn)
  const U = D.USERS || {};
  const NAMES = {
    jh: { name: "Jonas H.", initials: "JH", color: "#3B82F6", role: "Kokk", dept: "kjokken" },
    sl: { name: "Selma L.", initials: "SL", color: "#10B981", role: "Servitør", dept: "sal" },
    pk: { name: "Petter K.", initials: "PK", color: "#A855F7", role: "Servitør", dept: "sal" },
    ib: { name: "Ida B.", initials: "IB", color: "#EAB308", role: "Renhold", dept: "kjokken" },
    es: { name: "Erik S.", initials: "ES", color: "#ec4899", role: "Kokk", dept: "kjokken" },
    ot: { name: "Ole T.", initials: "OT", color: "#864ad2", role: "Bartender", dept: "bar" },
    kn: { name: "Kari N.", initials: "KN", color: "#14b8a6", role: "Servitør", dept: "sal" },
    ma: { name: "Maria A.", initials: "MA", color: "#FF7849", role: "Driftsleder", dept: "sal" },
  };
  const ident = (uid) => Object.assign({}, NAMES[uid] || {}, U[uid] || {});
  const DEPT = (D.LO_DEPT) || {
    kjokken: { id: "kjokken", name: "Kjøkken", c: "#ee560c" },
    sal:     { id: "sal", name: "Sal", c: "#00ab93" },
    bar:     { id: "bar", name: "Bar", c: "#864ad2" },
    event:   { id: "event", name: "Event", c: "#c18200" },
    lager:   { id: "lager", name: "Lager", c: "#008388" },
  };

  // ---------- status grammar (icon + label + tone, never colour alone) ----------
  // tone maps to DS semantic vars: muted | warning | success | error | info
  const REC_STATUS = {
    open:              { id: "open", label: "Åpen", icon: "circle", tone: "muted", order: 2 },
    submitted:         { id: "submitted", label: "Innsendt", icon: "clock", tone: "warning", order: 3 },
    awaiting_approval: { id: "awaiting_approval", label: "Venter på godkjenning", short: "Venter", icon: "alert", tone: "warning", order: 4 },
    approved:          { id: "approved", label: "Godkjent", icon: "check", tone: "success", order: 1 },
    locked:            { id: "locked", label: "Låst", icon: "lock", tone: "muted", order: 0 },
    unreconciled:      { id: "unreconciled", label: "Ikke avstemt", short: "Ikke avstemt", icon: "alert", tone: "error", order: 5 },
  };
  const SEV = {
    critical: { id: "critical", label: "Kritisk", tone: "error", order: 0 },
    high:     { id: "high", label: "Høy", tone: "error", order: 1 },
    medium:   { id: "medium", label: "Middels", tone: "warning", order: 2 },
    low:      { id: "low", label: "Lav", tone: "info", order: 3 },
  };

  const kr0 = (n) => Math.round(n);

  // ---------- shift builder ----------
  // st: approved | pending | disputed | edited
  const sh = (uid, planned, calc, approved, st, note) => {
    const id = ident(uid);
    return {
      uid, role: id.role, dept: id.dept, deptName: DEPT[id.dept].name,
      planned, calculated: calc, approved: approved == null ? calc : approved,
      status: st || "approved", note: note || null,
    };
  };
  // deviation builder
  let _dev = 0;
  const dv = (sev, title, detail, opts) => Object.assign(
    { id: "AV-" + (++_dev), severity: sev, title, detail, status: "open", source: "system", suggestion: null, costImpact: null },
    opts || {}
  );

  // ---------- DAYS ----------
  // Whole-venue daily reconciliation (Bistro Nord). Shift list spans departments.
  const DAYS = [];
  const day = (o) => { DAYS.push(o); return o; };

  // === Uke 22 (25.–31. mai 2026) — current week ===

  // Lør 30.05 — TODAY, still open (in progress, not settled)
  day({
    id: "rd-2026-05-30", date: "2026-05-30", weekday: "Lørdag", dateLabel: "30. mai", short: "Lør 30",
    week: 22, status: "open", today: true,
    revenue: { total: null, source: null, ocr: [] },
    hours: { total: 0, laborPct: null },
    budget: { target: 71500, actual: null },
    settledBy: null, settledAt: null,
    shifts: [sh("sl", 8.0, 0, 0, "pending"), sh("jh", 9.0, 0, 0, "pending"), sh("ot", 7.5, 0, 0, "pending"), sh("pk", 6.0, 0, 0, "pending")],
    deviations: [],
    tasks: [],
    audit: [{ ts: "30.05 10:02", actor: "System", action: "Dag åpnet automatisk ved første innstempling" }],
    handoffs: [],
  });

  // Fre 29.05 — THE FOCUS DAY — awaiting_approval, settled, has blockers
  day({
    id: "rd-2026-05-29", date: "2026-05-29", weekday: "Fredag", dateLabel: "29. mai", short: "Fre 29",
    week: 22, status: "awaiting_approval", focus: true,
    revenue: {
      total: 84230, card: 71840, cash: 12390, vat: 16846, transactions: 312,
      cashCounted: 11940, cashDiff: -450, source: "isettle",
      ocr: [{ id: "z1", label: "Z-rapport iSettle", time: "23:48" }, { id: "z2", label: "Kontanttelling", time: "23:55" }],
    },
    hours: { total: 58.5, laborPct: 31.2 },
    budget: { target: 78000, actual: 84230 },
    settledBy: "kn", settledAt: "29.05 23:55", closeoutBy: "kn", closeoutAt: "29.05 23:58",
    shifts: [
      sh("kn", 8.0, 8.2, 8.2, "approved"),
      sh("sl", 7.5, 7.5, 7.5, "approved"),
      sh("jh", 9.0, 9.6, null, "pending", "0,6t over plan — kjøkken sto lenger på grunn av fullt hus"),
      sh("es", 8.0, 9.2, null, "disputed", "Stemplet ut 00:12, men plan var 23:30. Ansatt mener ekstra rydding var avtalt."),
      sh("ot", 8.5, 8.5, 8.5, "approved"),
      sh("pk", 6.0, 6.4, 6.4, "edited", "Justert +0,4t — overlappende vaktskifte i baren"),
    ],
    deviations: [
      dv("critical", "Kontantdiff −450 kr", "Talt kontant (11 940 kr) er 450 kr lavere enn iSettle (12 390 kr). Over toleranse på 200 kr.", {
        source: "settlement", code: "CASH_DIFF",
        suggestion: "Be siste ut (Kari N.) bekrefte tellingen, eller opprett kontanthendelse. Botsson foreslår handoff til Kari for avklaring.",
      }),
      dv("high", "Vakt over plan uten godkjenning", "Erik S. stemplet ut 00:12 (plan 23:30) — 0,7t udisputert overtid. Status: omtvistet.", {
        source: "shift", code: "SHIFT_OVER", uid: "es",
        suggestion: "Godkjenn 0,7t overtid hvis ekstra rydding var avtalt, eller juster timer ned til plan. Se vakthistorikk.",
      }),
      dv("medium", "Vakt venter på godkjenning", "Jonas H. 0,6t over plan. Ikke omtvistet, men ubekreftet.", { source: "shift", code: "SHIFT_PENDING", uid: "jh" }),
      dv("low", "Omsetning over budsjett", "Faktisk 84 230 kr mot budsjett 78 000 kr (+8 %). Til orientering.", { source: "revenue", code: "REV_OVER" }),
    ],
    tasks: [
      { id: "t1", label: "Kontanttelling utført og signert", done: true, source: "close_out" },
      { id: "t2", label: "Kjøkken nedvask og temperaturlogg", done: true, source: "system" },
      { id: "t3", label: "Søppel og resirkulering ut", done: false, comment: "Rakk ikke glass — Petter tar det lørdag morgen", source: "close_out" },
      { id: "t4", label: "Alarm aktivert og dører låst", done: true, source: "close_out" },
    ],
    audit: [
      { ts: "29.05 16:00", actor: "System", action: "Dag åpnet ved første innstempling" },
      { ts: "29.05 23:48", actor: "iSettle", action: "Z-rapport mottatt — omsetning 84 230 kr (312 transaksjoner)" },
      { ts: "29.05 23:55", actor: "Kari N.", action: "Registrerte dagsoppgjør + kontanttelling (Fase 1)" },
      { ts: "29.05 23:58", actor: "Kari N.", action: "Fullførte close-out (3/4 oppgaver, 1 kommentar)" },
      { ts: "30.05 00:01", actor: "System", action: "2 avvik opprettet automatisk (kontantdiff, omtvistet vakt)" },
    ],
    handoffs: ["ho-1"],
  });

  // Tor 28.05 — submitted (settled, awaiting OCR/approval), clean-ish
  day({
    id: "rd-2026-05-28", date: "2026-05-28", weekday: "Torsdag", dateLabel: "28. mai", short: "Tor 28",
    week: 22, status: "submitted",
    revenue: { total: 61420, card: 54100, cash: 7320, vat: 12284, transactions: 241, cashCounted: 7320, cashDiff: 0, source: "isettle",
      ocr: [{ id: "z1", label: "Z-rapport iSettle", time: "23:31" }] },
    hours: { total: 49.0, laborPct: 29.8 },
    budget: { target: 58000, actual: 61420 },
    settledBy: "sl", settledAt: "28.05 23:34",
    shifts: [sh("sl", 7.5, 7.5, 7.5, "approved"), sh("jh", 8.5, 8.5, 8.5, "approved"), sh("ot", 8.0, 8.0, 8.0, "approved"), sh("ib", 5.0, 5.0, 5.0, "approved")],
    deviations: [dv("low", "Kortandel høy", "94 % av omsetning på kort. Til orientering.", { source: "revenue", code: "CARD_HIGH" })],
    tasks: [{ id: "t1", label: "Kontanttelling utført", done: true, source: "close_out" }, { id: "t2", label: "Nedvask kjøkken", done: true, source: "system" }],
    audit: [{ ts: "28.05 23:31", actor: "iSettle", action: "Z-rapport mottatt" }, { ts: "28.05 23:34", actor: "Selma L.", action: "Registrerte dagsoppgjør (Fase 1)" }],
    handoffs: [],
  });

  // Ons 27.05 — approved (not yet locked)
  day({
    id: "rd-2026-05-27", date: "2026-05-27", weekday: "Onsdag", dateLabel: "27. mai", short: "Ons 27",
    week: 22, status: "approved",
    revenue: { total: 52890, card: 46200, cash: 6690, vat: 10578, transactions: 198, cashCounted: 6690, cashDiff: 0, source: "isettle", ocr: [{ id: "z1", label: "Z-rapport", time: "23:12" }] },
    hours: { total: 44.0, laborPct: 30.1 }, budget: { target: 51000, actual: 52890 },
    settledBy: "kn", settledAt: "27.05 23:15", approvedBy: "ma", approvedAt: "28.05 08:40",
    shifts: [sh("kn", 7.5, 7.5, 7.5, "approved"), sh("es", 8.0, 8.0, 8.0, "approved"), sh("ot", 7.5, 7.5, 7.5, "approved")],
    deviations: [], tasks: [{ id: "t1", label: "Alle stengeoppgaver", done: true, source: "system" }],
    audit: [{ ts: "27.05 23:15", actor: "Kari N.", action: "Dagsoppgjør (Fase 1)" }, { ts: "28.05 08:40", actor: "Maria A.", action: "Godkjente dagen (Fase 2)" }],
    handoffs: [],
  });

  // Tir 26.05 — locked
  day({
    id: "rd-2026-05-26", date: "2026-05-26", weekday: "Tirsdag", dateLabel: "26. mai", short: "Tir 26",
    week: 22, status: "locked",
    revenue: { total: 47310, card: 41800, cash: 5510, vat: 9462, transactions: 176, cashCounted: 5510, cashDiff: 0, source: "isettle", ocr: [] },
    hours: { total: 41.5, laborPct: 31.4 }, budget: { target: 48000, actual: 47310 },
    settledBy: "sl", settledAt: "26.05 23:08", approvedBy: "ma", approvedAt: "27.05 08:20", lockedBy: "ma", lockedAt: "27.05 09:00",
    shifts: [sh("sl", 7.5, 7.5, 7.5, "approved"), sh("jh", 8.0, 8.0, 8.0, "approved")],
    deviations: [], tasks: [], audit: [{ ts: "27.05 09:00", actor: "Maria A.", action: "Låste dagen" }], handoffs: [],
  });

  // Man 25.05 — locked
  day({
    id: "rd-2026-05-25", date: "2026-05-25", weekday: "Mandag", dateLabel: "25. mai", short: "Man 25",
    week: 22, status: "locked",
    revenue: { total: 38940, card: 34900, cash: 4040, vat: 7788, transactions: 142, cashCounted: 4040, cashDiff: 0, source: "isettle", ocr: [] },
    hours: { total: 36.0, laborPct: 30.0 }, budget: { target: 40000, actual: 38940 },
    settledBy: "kn", settledAt: "25.05 22:51", approvedBy: "ma", approvedAt: "26.05 08:15", lockedBy: "ma", lockedAt: "26.05 09:10",
    shifts: [sh("kn", 7.0, 7.0, 7.0, "approved"), sh("es", 7.5, 7.5, 7.5, "approved")],
    deviations: [], tasks: [], audit: [{ ts: "26.05 09:10", actor: "Maria A.", action: "Låste dagen" }], handoffs: [],
  });

  // === Uke 21 (18.–24. mai) ===

  // Søn 24.05 — UNRECONCILED (never settled, overdue) — destructive
  day({
    id: "rd-2026-05-24", date: "2026-05-24", weekday: "Søndag", dateLabel: "24. mai", short: "Søn 24",
    week: 21, status: "unreconciled",
    revenue: { total: 44120, card: 40020, cash: 4100, vat: 8824, transactions: 168, cashCounted: null, cashDiff: null, source: "isettle", ocr: [{ id: "z1", label: "Z-rapport", time: "23:40" }] },
    hours: { total: 39.0, laborPct: 30.2 }, budget: { target: 46000, actual: 44120 },
    settledBy: null, settledAt: null,
    shifts: [sh("pk", 7.0, 7.0, 7.0, "pending"), sh("ot", 7.5, 7.5, 7.5, "pending"), sh("jh", 8.0, 8.0, 8.0, "pending")],
    deviations: [
      dv("high", "Dagsoppgjør aldri registrert", "Ingen ansatt registrerte oppgjør ved stenging. 6 dager forsinket — over policy-frist på 4 dager.", { source: "close_out", code: "NO_SETTLE",
        suggestion: "Be Petter K. (siste ut) registrere oppgjøret nå, eller registrer manuelt fra Z-rapport. Botsson kan starte handoff." }),
      dv("medium", "Kontant ikke talt opp", "Kontantkasse ikke avstemt mot iSettle.", { source: "settlement", code: "NO_CASH" }),
    ],
    tasks: [], audit: [{ ts: "24.05 23:40", actor: "iSettle", action: "Z-rapport mottatt" }, { ts: "28.05 09:00", actor: "System", action: "Dag merket «ikke avstemt» — over frist" }],
    handoffs: ["ho-2"],
  });

  // Lør 23.05 / Fre 22.05 — locked (compact)
  ["23", "22", "21", "20", "19", "18"].forEach((dd, i) => {
    const wd = ["Lørdag", "Fredag", "Torsdag", "Onsdag", "Tirsdag", "Mandag"][i];
    const rev = [79200, 81050, 58400, 49900, 45300, 37800][i];
    day({
      id: "rd-2026-05-" + dd, date: "2026-05-" + dd, weekday: wd, dateLabel: dd + ". mai", short: wd.slice(0, 3) + " " + dd,
      week: 21, status: "locked",
      revenue: { total: rev, card: kr0(rev * 0.86), cash: kr0(rev * 0.14), vat: kr0(rev * 0.2), transactions: kr0(rev / 270), cashCounted: kr0(rev * 0.14), cashDiff: 0, source: "isettle", ocr: [] },
      hours: { total: kr0(rev / 1400), laborPct: 30 + (i % 3) }, budget: { target: kr0(rev * 0.97), actual: rev },
      settledBy: "sl", settledAt: dd + ".05 23:1" + i, approvedBy: "ma", lockedBy: "ma", lockedAt: (Number(dd) + 1) + ".05 09:00",
      shifts: [sh("sl", 7.5, 7.5, 7.5, "approved"), sh("jh", 8, 8, 8, "approved")],
      deviations: [], tasks: [], audit: [{ ts: (Number(dd) + 1) + ".05 09:00", actor: "Maria A.", action: "Låste dagen" }], handoffs: [],
    });
  });

  // ---------- week summaries ----------
  const weekAgg = (n) => {
    const ds = DAYS.filter((d) => d.week === n);
    const rev = ds.reduce((a, d) => a + (d.revenue.total || 0), 0);
    const hrs = ds.reduce((a, d) => a + (d.hours.total || 0), 0);
    return { n, rev, laborPct: rev ? Math.round((hrs * 235 / rev) * 1000) / 10 : 0, count: ds.length };
  };
  const REC_WEEKS = {
    22: Object.assign({ label: "Uke 22", range: "25.–31. mai" }, weekAgg(22)),
    21: Object.assign({ label: "Uke 21", range: "18.–24. mai" }, weekAgg(21)),
  };

  // ---------- preflight (blockers that gate "Godkjenn dagen") ----------
  function preflight(d) {
    const out = [];
    const blockingDevs = d.deviations.filter((x) => (x.severity === "critical" || x.severity === "high") && x.status === "open");
    if (blockingDevs.length) out.push({ key: "dev", tab: "avvik", label: `${blockingDevs.length} blokkerende avvik må løses`, count: blockingDevs.length });
    const pendShifts = d.shifts.filter((s) => s.status === "pending" || s.status === "disputed");
    if (pendShifts.length) out.push({ key: "shift", tab: "vakter", label: `${pendShifts.length} vakter venter på godkjenning`, count: pendShifts.length });
    if (d.revenue.total == null) out.push({ key: "rev", tab: "omsetning", label: "Omsetning ikke registrert", count: 1 });
    if (d.revenue.total != null && d.revenue.cashCounted == null) out.push({ key: "cash", tab: "omsetning", label: "Kontant ikke talt opp", count: 1 });
    if (!d.settledBy && d.status !== "open") out.push({ key: "settle", tab: "oversikt", label: "Dagsoppgjør ikke gjennomført", count: 1 });
    return out;
  }

  // ---------- HANDOFFS (AI → ansatt → admin) ----------
  const REC_HANDOFFS = [
    {
      id: "ho-1", reconId: "rd-2026-05-29", uid: "kn", scope: "deviation", scopeLabel: "Kontantdiff −450 kr · Fre 29.05",
      created: "30.05 00:05", deadline: "30.05 12:00", status: "awaiting", channel: "chat",
      transcript: [
        { from: "ai", meta: "Om kontantdiff −450 kr · Fre 29.05", text: "Hei Kari! Kontanttellingen din (11 940 kr) er 450 kr lavere enn iSettle (12 390 kr). Husker du noe spesielt — veksel, drikkepenger tatt ut, eller en feilslått betaling?", ts: "00:05" },
        { from: "employee", text: "Vi ga 500 kr i veksel til bordet som betalte event-depositum kontant. Glemte å notere det.", ts: "07:42" },
        { from: "ai", meta: "Foreslår løsning", text: "Takk! Da stemmer det med −450 (500 ut, 50 inn i tips). Jeg foreslår en kontanthendelse «veksel event-depositum 500 kr». Maria godkjenner.", ts: "07:43" },
      ],
    },
    {
      id: "ho-2", reconId: "rd-2026-05-24", uid: "pk", scope: "day", scopeLabel: "Manglende dagsoppgjør · Søn 24.05",
      created: "28.05 09:05", deadline: "28.05 17:00", status: "escalated", channel: "voice",
      transcript: [
        { from: "ai", meta: "Om manglende oppgjør · Søn 24.05", text: "Hei Petter! Søndagens dagsoppgjør ble aldri registrert. Kan du bekrefte kontantbeholdningen ved stenging?", ts: "09:05" },
        { from: "ai", meta: "Ingen svar på 2 dager", text: "Påminnelse sendt. Frist nærmer seg.", ts: "30.05 08:00" },
        { from: "admin", text: "Eskalert til telefon — ringer Petter i dag.", ts: "30.05 08:10" },
      ],
    },
    {
      id: "ho-3", reconId: "rd-2026-05-29", uid: "es", scope: "shift", scopeLabel: "Omtvistet vakt 16:00–00:12 · Fre 29.05",
      created: "30.05 00:06", deadline: "30.05 14:00", status: "active", channel: "chat",
      transcript: [
        { from: "ai", meta: "Om vakt 16:00–00:12 · Fre 29.05", text: "Hei Erik! Du stemplet ut 00:12, men planen var til 23:30. Var den ekstra ryddetiden avtalt med vaktleder?", ts: "00:06" },
      ],
    },
    {
      id: "ho-4", reconId: "rd-2026-05-23", uid: "sl", scope: "deviation", scopeLabel: "Avrunding tips · Lør 23.05",
      created: "24.05 08:00", deadline: "24.05 16:00", status: "resolved", channel: "chat",
      transcript: [
        { from: "ai", meta: "Om tipsfordeling · Lør 23.05", text: "Hei Selma! Tipspotten gikk ikke opp med 12 kr. Greit å runde av?", ts: "08:00" },
        { from: "employee", text: "Ja, helt fint å runde ned.", ts: "08:14" },
        { from: "ai", text: "Takk! Løst og logget.", ts: "08:15" },
      ],
    },
  ];
  const HANDOFF_STATUS = {
    active: { label: "Aktiv", tone: "info", icon: "message" },
    awaiting: { label: "Venter på svar", tone: "warning", icon: "clock" },
    escalated: { label: "Eskalert", tone: "error", icon: "phone" },
    resolved: { label: "Løst", tone: "success", icon: "check" },
  };

  // ---------- OCCUPATIONAL (yrkesavstemming) ----------
  const REC_OCCUPATIONAL = {
    professions: [
      { id: "servitor", label: "Servitør", count: 4 },
      { id: "kokk", label: "Kokk", count: 3 },
      { id: "bartender", label: "Bartender", count: 2 },
      { id: "renhold", label: "Renhold", count: 2 },
    ],
    // aggregate for "servitør · mai" (the demo selection)
    aggregate: {
      profession: "servitor", period: "Mai 2026",
      rows: [
        { uid: "sl", active: true, hours: 156.0, sick: 0, revenue: 412000, laborPct: 9.1, variance: 2 },
        { uid: "kn", active: true, hours: 164.0, sick: 4, revenue: 398000, laborPct: 9.6, variance: -1 },
        { uid: "pk", active: true, hours: 84.5, sick: 0, revenue: 210000, laborPct: 9.4, variance: 5 },
        { uid: "ma", active: true, hours: 52.0, sick: 0, revenue: 0, laborPct: 0, variance: 0 },
      ],
      totals: { hours: 456.5, sick: 4, revenue: 1020000, laborPct: 9.4, expected: 9.0 },
      unreconciledDays: 1, // Søn 24.05
    },
  };

  // ---------- SEASON (sesongavstemming) ----------
  const REC_SEASON = {
    cycles: [
      { id: "vinter26", label: "Vinter 2026", range: "des 2025 – feb 2026", status: "lukket" },
      { id: "var26", label: "Vår 2026", range: "mar – mai 2026", status: "aktiv" },
    ],
    selected: {
      id: "var26", label: "Vår 2026",
      budget: { target: 4_200_000, actual: 4_488_000 },
      laborWeeks: [29.4, 30.1, 31.2, 30.8, 29.9, 31.5, 30.6, 30.2, 29.4, 30.0, 31.1, 30.3],
      laborAvg: 30.4, laborTarget: 30.0,
      patterns: [
        { cat: "Kontantdiff", count: 6, trend: "ned", note: "Hovedsakelig veksel ved event-depositum" },
        { cat: "Overtid kjøkken", count: 11, trend: "opp", note: "Fredager går jevnt over plan" },
        { cat: "Manglende oppgjør", count: 2, trend: "flat", note: "Søndager — bør faste rutine" },
      ],
      factors: [
        { id: "fri_kveld", label: "Fredag kveldsfaktor", current: 1.35, suggested: 1.45, reason: "Fredager går jevnt 8 % over budsjett", conf: "high" },
        { id: "son_bemanning", label: "Søndag bemanning", current: 1.0, suggested: 0.9, reason: "Søndager underbelagt på inntekt", conf: "medium" },
      ],
    },
  };

  // ---------- POLICY (W-06) ----------
  const REC_POLICY = [
    { id: "frister", icon: "clock", title: "Frister", desc: "Maks dager uavstemt før eskalering.", fields: [
      { key: "max_unreconciled", label: "Maks dager uavstemt", type: "number", value: 4, unit: "dager" },
      { key: "rolling_window", label: "Rullerende periode", type: "number", value: 30, unit: "dager" },
    ]},
    { id: "toleranse", icon: "scale", title: "Toleranse kontant", desc: "Kontantdiff over grensen oppretter avvik automatisk.", fields: [
      { key: "cash_tol_mode", label: "Type", type: "seg", value: "fast", opts: [["fast", "Fast beløp"], ["pct", "Prosent"]] },
      { key: "cash_tol_amount", label: "Grense", type: "number", value: 200, unit: "kr" },
    ]},
    { id: "kontant", icon: "wallet", title: "Kontantkasse", desc: "Krav til opptelling ved stenging.", fields: [
      { key: "cash_required", label: "Krever opptelling", type: "toggle", value: true },
    ]},
    { id: "godkjenning", icon: "check", title: "Godkjenning", desc: "Administrativ sign-off (Fase 2).", fields: [
      { key: "admin_required", label: "Krever admin-godkjenning", type: "toggle", value: true },
      { key: "approve_deadline", label: "Frist for godkjenning", type: "number", value: 48, unit: "timer" },
      { key: "auto_approve_clean", label: "Auto-godkjenn rene dager", type: "toggle", value: false },
    ]},
    { id: "closeout", icon: "clipcheck", title: "Close-out prompt", desc: "Obligatorisk avsluttingsskjema for siste ut.", fields: [
      { key: "closeout_required", label: "Obligatorisk", type: "toggle", value: true },
      { key: "closeout_trigger", label: "Hvem trigges", type: "seg", value: "last_out", opts: [["last_out", "Siste ut"], ["shift_leader", "Skiftleder"]] },
    ]},
    { id: "handoff", icon: "message", title: "Handoff", desc: "Frist før AI eskalerer til telefon.", fields: [
      { key: "handoff_deadline", label: "Frist før eskalering", type: "number", value: 8, unit: "timer" },
      { key: "handoff_attempts", label: "Maks forsøk", type: "number", value: 2, unit: "" },
      { key: "quiet_hours", label: "Stilletid (ingen varsler)", type: "toggle", value: true },
    ]},
    { id: "las", icon: "lock", title: "Lås-policy", desc: "Når en dag fryses permanent.", fields: [
      { key: "lock_policy", label: "Lås", type: "seg", value: "after_export", opts: [["immediate", "Umiddelbart"], ["after_n", "Etter N dager"], ["after_export", "Etter lønnseksport"]] },
    ]},
    { id: "yrke", icon: "layers", title: "Yrkesavstemming", desc: "Periodisk lukking per yrkesgruppe.", fields: [
      { key: "occupational_enabled", label: "Aktiv", type: "toggle", value: true },
      { key: "occupational_freq", label: "Frekvens", type: "seg", value: "monthly", opts: [["monthly", "Månedlig"], ["manual", "Manuelt"]] },
    ]},
  ];

  Object.assign(D, {
    REC_DAYS: DAYS,
    REC_DAY_BY_ID: DAYS.reduce((m, d) => (m[d.id] = d, m), {}),
    REC_WEEKS, REC_STATUS, REC_SEV: SEV, REC_PREFLIGHT: preflight,
    REC_HANDOFFS, REC_HANDOFF_BY_ID: REC_HANDOFFS.reduce((m, h) => (m[h.id] = h, m), {}),
    REC_HANDOFF_STATUS: HANDOFF_STATUS,
    REC_OCCUPATIONAL, REC_SEASON, REC_POLICY, REC_IDENT: ident, REC_DEPT: DEPT,
  });
})();
