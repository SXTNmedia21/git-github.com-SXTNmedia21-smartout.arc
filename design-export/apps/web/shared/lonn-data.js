// ===== Lønn (Payroll) domain data =====
// Plain script (loads before the babel files), extends window.SmartoutData.
// Model: calc-engine DERIVES every line from shifts + rules; the human only
// confirms deviations and locks. One open period (April 2026) is the live job.
// Cast = Bistro Nord (data.js USERS) + canonical dept colours.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ---------- departments (canonical colours) ----------
  const LO_DEPT = {
    kjokken: { id: "kjokken", name: "Kjøkken", c: "#ee560c" },
    sal:     { id: "sal", name: "Sal", c: "#00ab93" },
    bar:     { id: "bar", name: "Bar", c: "#864ad2" },
    event:   { id: "event", name: "Event", c: "#c18200" },
    lager:   { id: "lager", name: "Lager", c: "#008388" },
  };

  // money helpers used at build time
  const r2 = (n) => Math.round(n * 100) / 100;
  const r0 = (n) => Math.round(n);

  // identity (reuse data.js USERS where present; extend for payroll-only cast)
  const U = (window.SmartoutData && window.SmartoutData.USERS) || {};
  const NAMES = {
    jh: { name: "Jonas H.", initials: "JH", color: "#3B82F6" },
    sl: { name: "Selma L.", initials: "SL", color: "#10B981" },
    pk: { name: "Petter K.", initials: "PK", color: "#A855F7" },
    ib: { name: "Ida B.", initials: "IB", color: "#EAB308" },
    es: { name: "Erik S.", initials: "ES", color: "#ec4899" },
    ot: { name: "Ole T.", initials: "OT", color: "#864ad2" },
    kn: { name: "Kari N.", initials: "KN", color: "#14b8a6" },
  };
  const ident = (uid) => U[uid] || NAMES[uid] || { name: uid, initials: "?", color: "#888" };

  // ---------- employees in the OPEN period (April 2026) ----------
  // hours: sched (planlagt), actual (faktisk), ot, kveld, helg, hellig
  // pay:   type, rate (kr/t), monthly (fastlønn), pct (stilling), manual (kr)
  const raw = [
    { uid: "jh", dept: "kjokken", role: "Kokk",     type: "Fastlønn",   monthly: 42000, pct: 100, rate: 258,
      sched: 162.5, actual: 168.0, ot: 5.5, kveld: 12.0, helg: 16.5, hellig: 8.0, manual: 200, manualNote: "Ekstra hjelp Skjærtorsdag" },
    { uid: "ot", dept: "bar",     role: "Bartender", type: "Timebasert", monthly: 0,    pct: 80,  rate: 232,
      sched: 152.0, actual: 161.5, ot: 9.5, kveld: 18.5, helg: 24.0, hellig: 8.5, manual: 0 },
    { uid: "sl", dept: "sal",     role: "Servitør",  type: "Timebasert", monthly: 0,    pct: 90,  rate: 228,
      sched: 156.0, actual: 156.0, ot: 0,   kveld: 8.0,  helg: 12.0, hellig: 0,   manual: 0 },
    { uid: "kn", dept: "sal",     role: "Servitør",  type: "Fastlønn",   monthly: 38200, pct: 100, rate: 235,
      sched: 162.5, actual: 164.0, ot: 1.5, kveld: 4.0,  helg: 8.0,  hellig: 0,   manual: 350, manualNote: "Vaktbytte-bonus" },
    { uid: "es", dept: "kjokken", role: "Kokk",      type: "Timebasert", monthly: 0,    pct: 75,  rate: 240,
      sched: 130.0, actual: 142.0, ot: 12.0, kveld: 16.5, helg: 20.0, hellig: 8.5, manual: 0 },
    { uid: "pk", dept: "bar",     role: "Servitør",  type: "Deltid",     monthly: 0,    pct: 50,  rate: 225,
      sched: 80.0,  actual: 84.5,  ot: 4.5, kveld: 22.0, helg: 16.0, hellig: 0,   manual: 0 },
    { uid: "ib", dept: "kjokken", role: "Renhold",   type: "Timebasert", monthly: 0,    pct: 90,  rate: 222,
      sched: 144.0, actual: 144.0, ot: 0,   kveld: 0,    helg: 0,    hellig: 0,   manual: 0 },
  ];

  // derive each line (calc-engine) → breakdown + gross + net
  const LO_EMPLOYEES = raw.map((e) => {
    const id = ident(e.uid);
    const baseKr   = r0(e.actual * e.rate);
    const kveldKr  = r0(e.kveld * e.rate * 0.25);
    const helgKr   = r0(e.helg * e.rate * 0.50);
    const helligKr = r0(e.hellig * e.rate * 1.00);
    const otKr     = r0(e.ot * e.rate * 0.50);
    const gross    = baseKr + kveldKr + helgKr + helligKr + otKr + e.manual;
    const net      = r0(gross * 0.712);
    const breakdown = [
      { code: "BASE_HOURLY", label: `Grunnlønn · ${e.actual.toFixed(1)}t × ${e.rate}`, kr: baseKr },
      ...(e.kveld  ? [{ code: "SUPP_KVELD",  label: `Kveldstillegg · ${e.kveld.toFixed(1)}t × 25%`, kr: kveldKr }] : []),
      ...(e.helg   ? [{ code: "SUPP_HELG",   label: `Helgtillegg · ${e.helg.toFixed(1)}t × 50%`, kr: helgKr }] : []),
      ...(e.hellig ? [{ code: "SUPP_HELLIG", label: `Helligdagstillegg · ${e.hellig.toFixed(1)}t × 100%`, kr: helligKr }] : []),
      ...(e.ot     ? [{ code: "SUPP_OT",     label: `Overtid · ${e.ot.toFixed(1)}t × 50%`, kr: otKr }] : []),
      ...(e.manual ? [{ code: "MANUAL",      label: `Manuelt · ${e.manualNote || "tillegg"}`, kr: e.manual }] : []),
    ];
    return { ...e, name: id.name, initials: id.initials, color: id.color, deptName: (LO_DEPT[e.dept] || {}).name, deptColor: (LO_DEPT[e.dept] || {}).c, baseKr, kveldKr, helgKr, helligKr, otKr, gross, net, breakdown };
  });

  // period totals (calc)
  const sum = (k) => LO_EMPLOYEES.reduce((a, e) => a + e[k], 0);
  const LO_TOTALS = {
    sched: r2(sum("sched")), actual: r2(sum("actual")), ot: r2(sum("ot")),
    kveld: r2(sum("kveld")), helg: r2(sum("helg")), hellig: r2(sum("hellig")),
    manual: sum("manual"), gross: sum("gross"), net: sum("net"),
    suppKr: sum("kveldKr") + sum("helgKr") + sum("helligKr") + sum("otKr"),
  };

  // ---------- shifts per employee (for the drill-down) ----------
  // compact; the prominent cases (jh, ot, es) carry the dramatic days.
  const sh = (date, kl, planned, actual, opts = {}) => ({ date, kl, planned, actual, ...opts });
  const LO_SHIFTS = {
    jh: [
      sh("01.04 ti", "14:00–22:00", 8.0, 8.0, { kveld: true }),
      sh("05.04 lø", "14:00–23:00", 9.0, 9.5, { kveld: true, helg: true, ot: 0.5 }),
      sh("13.04 sø", "11:00–19:00", 8.0, 8.0, { helg: true, dayLabel: "Palmesøndag" }),
      sh("17.04 to", "14:00–22:00", 8.0, 8.0, { kveld: true, hellig: true, dayLabel: "Skjærtorsdag" }),
      sh("20.04 sø", "11:00–19:00", 8.0, 8.0, { helg: true, dayLabel: "Påskedag", warn: "Stempling mangler — brukte planlagt 19:00" }),
    ],
    ot: [
      sh("04.04 fr", "17:00–01:00", 8.0, 8.5, { kveld: true, ot: 0.5 }),
      sh("12.04 lø", "16:00–01:00", 9.0, 10.0, { kveld: true, helg: true, ot: 1.0 }),
      sh("17.04 to", "16:00–23:00", 7.0, 7.0, { kveld: true, hellig: true, dayLabel: "Skjærtorsdag", warn: "Rød dag — krever bekreftelse" }),
      sh("19.04 lø", "16:00–02:00", 9.0, 10.0, { kveld: true, helg: true, ot: 1.0 }),
      sh("26.04 lø", "16:00–02:00", 9.0, 11.0, { kveld: true, helg: true, ot: 2.0, warn: "OT over avtalt grense (8t/mnd)" }),
    ],
    es: [
      sh("06.04 sø", "10:00–18:00", 8.0, 9.0, { helg: true, ot: 1.0 }),
      sh("15.04 ti", "11:00–21:00", 8.0, 10.0, { kveld: true, ot: 2.0, warn: "OT over grense (4t/mnd, 75%)" }),
      sh("17.04 to", "11:00–19:00", 8.0, 8.0, { hellig: true, dayLabel: "Skjærtorsdag", warn: "Rød dag — krever bekreftelse" }),
      sh("22.04 ti", "11:00–21:00", 8.0, 9.0, { kveld: true, ot: 1.0 }),
    ],
    sl: [
      sh("03.04 to", "16:00–23:00", 7.0, 7.0, { kveld: true }),
      sh("11.04 fr", "16:00–23:00", 7.0, 7.0, { kveld: true }),
      sh("12.04 lø", "13:00–21:00", 8.0, 8.0, { helg: true }),
    ],
    kn: [
      sh("02.04 on", "11:00–19:00", 8.0, 8.5, { ot: 0.5 }),
      sh("12.04 lø", "13:00–21:00", 8.0, 8.0, { helg: true }),
      sh("18.04 fr", "16:00–20:00", 4.0, 4.0, { kveld: true }),
    ],
    pk: [
      sh("06.04 sø", "02:00–06:00", 4.0, 4.0, { warn: "Nattillegg ikke beregnet automatisk" }),
      sh("12.04 lø", "18:00–00:00", 6.0, 6.5, { kveld: true, helg: true, ot: 0.5, warn: "Pause < 20 min — la til 8 min lønnet" }),
      sh("19.04 lø", "18:00–00:00", 6.0, 6.0, { kveld: true, helg: true }),
    ],
    ib: [
      sh("07.04 ma", "06:00–14:00", 8.0, 8.0, {}),
      sh("14.04 ma", "06:00–14:00", 8.0, 8.0, {}),
      sh("21.04 ma", "06:00–14:00", 8.0, 8.0, {}),
    ],
  };

  // ---------- deviations (unresolved derivation issues) ----------
  // kind: error (blokkerer lås) · warning (info på slipp) · info (ack)
  const LO_DEVIATIONS = [
    { id: "D-103", kind: "error", code: "OVERTID_OVER_GRENSE", uid: "ot", title: "Overtid over avtalt grense",
      detail: "Ole har 9.5t overtid i april — avtalt grense er 8t/mnd.", date: "26.04", requires: "Bekreftelse fra ansvarlig + ansatt", status: "open",
      suggestion: "Hovedavtale §10.1 setter 8t/mnd som standardgrense. Ole signerte vakten i appen 26.04 kl 02:11 — bekreft for å låse perioden.", note: "Dekket lørdag for Petter — gikk over fordi det var travelt." },
    { id: "D-104", kind: "error", code: "HELLIGDAG_KOLLISJON", uid: "ot", title: "Vakt 17.04 (Skjærtorsdag) krever bekreftelse",
      detail: "Hovedavtalen krever signert tillegg for arbeid på rød dag.", date: "17.04", requires: "Lederbekreftelse", status: "open",
      suggestion: "Hovedavtale §10.3 krever signert tillegg ved arbeid på bevegelig helligdag. Ole signerte i Smartout 14.04 kl 09:12 — bekreft for å låse perioden." },
    { id: "D-105", kind: "error", code: "HELLIGDAG_KOLLISJON", uid: "es", title: "Vakt 17.04 (Skjærtorsdag) krever bekreftelse",
      detail: "Hovedavtalen krever signert tillegg for arbeid på rød dag.", date: "17.04", requires: "Lederbekreftelse", status: "open",
      suggestion: "Samme grunnlag som Ole — Erik signerte i appen 14.04 kl 10:40. Bekreft begge samtidig fra Bot-Sson." },
    { id: "D-106", kind: "error", code: "OVERTID_OVER_GRENSE", uid: "es", title: "Overtid over avtalt grense",
      detail: "Erik har 12t overtid — grunnstilling 75% tillater 4t/mnd.", date: "15.04", requires: "Bekreftelse", status: "open",
      suggestion: "Stillingen er 75%. Overtid utover 4t/mnd må bekreftes manuelt eller justeres mot timebank." },
    { id: "D-107", kind: "warning", code: "STEMPLING_GLEMT", uid: "jh", title: "Stempling mangler · brukte planlagt tid",
      detail: "Vakt 20.04 mangler ut-stempling. Calc-engine brukte planlagt 19:00.", date: "20.04", requires: "Bekreftelse", status: "open",
      suggestion: "Jonas glemte å stemple ut. Calc brukte planlagt sluttid (19:00). Bekreft, eller korriger tiden manuelt." },
    { id: "D-108", kind: "warning", code: "PAUSE_KORT", uid: "pk", title: "Pause < 20 min på 6t-vakt",
      detail: "Pausen 12.04 var 12 min. Smartout la til 8 min lønnet pause.", date: "12.04", requires: "Info", status: "open",
      suggestion: "Automatisk håndtert etter arbeidsmiljøloven. Ingen handling nødvendig — vises som info på lønnsslippen." },
    { id: "D-109", kind: "warning", code: "TILLEGG_MANGLER", uid: "pk", title: "Nattillegg ikke beregnet automatisk",
      detail: "Calc-engine har ingen regel for vaktene 02:00–06:00.", date: "06.04", requires: "Manuelt grep eller ny regel", status: "open",
      suggestion: "Det finnes ingen SUPP_NATT-regel som dekker 02:00–06:00. Legg til regel, eller før et manuelt tillegg på denne vakten." },
    { id: "D-110", kind: "info", code: "RECALC_DIFF", uid: "kn", title: "Recalc endret brutto med +120 kr",
      detail: "Tillegg-regel «Helgkveld» publisert 18.04 påvirket vakt 12.04.", date: "19.04", requires: "Til orientering", status: "ack" },
    { id: "D-111", kind: "info", code: "RECALC_DIFF", uid: "sl", title: "Recalc endret brutto med +60 kr",
      detail: "Samme regelpublisering som over.", date: "19.04", requires: "Til orientering", status: "ack" },
  ];

  // ---------- periods (the index / switcher) ----------
  const LO_PERIODS = [
    { id: "2026-04", label: "April 2026",    start: "01.04", end: "30.04", emp: 7, lines: 89, gross: LO_TOTALS.gross, net: LO_TOTALS.net, status: "open" },
    { id: "2026-03", label: "Mars 2026",     start: "01.03", end: "31.03", emp: 7, lines: 86, gross: 218900, net: 158420, status: "approved" },
    { id: "2026-02", label: "Februar 2026",  start: "01.02", end: "28.02", emp: 6, lines: 78, gross: 198450, net: 143900, status: "exported" },
    { id: "2026-01", label: "Januar 2026",   start: "01.01", end: "31.01", emp: 6, lines: 81, gross: 207320, net: 150100, status: "exported" },
    { id: "2025-12", label: "Desember 2025", start: "01.12", end: "31.12", emp: 6, lines: 92, gross: 251890, net: 181200, status: "exported" },
  ];

  // ---------- supplement rules (calc-engine config) ----------
  const LO_RULES = [
    { code: "SUPP_KVELD", label: "Kveldstillegg",    amount: "+25%",         when: "Hverdag 18:00 – 22:00",              applies: "Alle ansatte", active: true, hits: 47, kr: 12250 },
    { code: "SUPP_NATT",  label: "Nattillegg",        amount: "+45%",         when: "22:00 – 06:00",                      applies: "Alle",          active: false, hits: 0, kr: 0, warn: "ikke aktiv — dekker ikke 02:00–06:00" },
    { code: "SUPP_HELG",  label: "Helgtillegg",       amount: "+50%",         when: "Lørdag 13:00 – Søndag 23:59",        applies: "Alle",          active: true, hits: 38, kr: 18900 },
    { code: "SUPP_HELLIG",label: "Helligdagstillegg", amount: "+100%",        when: "Bevegelige helligdager (auto)",      applies: "Alle",          active: true, hits: 6,  kr: 6120, warn: "krever lederbekreftelse" },
    { code: "SUPP_NYTTAR",label: "Nyttårsaften e/16",  amount: "+100%",        when: "31.12 16:00 – 01.01",                applies: "Alle",          active: true, hits: 0,  kr: 0 },
    { code: "OT_DAG",     label: "Daglig overtid",    amount: "+50%",         when: "> 9t/dag",                           applies: "Timebasert",    active: true, hits: 11, kr: 4180 },
    { code: "OT_MND",     label: "Månedlig overtid",  amount: "+50%",         when: "> 162.5t/mnd",                       applies: "Fastlønn",      active: true, hits: 2,  kr: 1633 },
    { code: "TIPS",       label: "Tipspott · ut",     amount: "Skattepliktig", when: "Månedlig fordeling",                applies: "Sal + bar",     active: true, hits: 0,  kr: 4320 },
  ];

  // rule tester trace (SUPP_KVELD against a real shift)
  const LO_RULE_TRACE = {
    rule: "SUPP_KVELD", uid: "jh", shiftLabel: "Jonas · 09.04 17:00–22:00", hours: 5.0, rate: 258,
    lines: [
      { t: "match window: 18:00–22:00 → 4.0t" },
      { t: "before window: 17:00–18:00 → 1.0t (no supp)" },
      { t: "base: 4.0t × 258 = 1 032" },
      { t: "supp: 1 032 × 0.25 = 258 ✓", tone: "ok" },
      { t: "+ no overlap with SUPP_HELG", tone: "ok" },
      { t: "+ no overlap with SUPP_HELLIG", tone: "ok" },
    ],
    result: "total = 258 kr · added to derived line",
    testedAgainst: "89 vakter i april · treffer 47 vakter · 12 250 kr i tillegg totalt",
  };

  // ---------- settings (policy defaults) ----------
  const LO_SETTINGS = {
    period: [
      { key: "type", label: "Periode-type", value: "Måned", seg: ["Måned", "14 dager"] },
      { key: "lock", label: "Lås-frist (default)", value: "5. i måneden etter", hint: "Auto-låses kl 23:59" },
      { key: "pay", label: "Utbetalingsdato", value: "15. i måneden etter", hint: "Vises på lønnsslippen" },
      { key: "recalc", label: "Recalc-strategi", value: "Auto · ved endring i vakter eller regler" },
    ],
    hours: [
      { key: "week", label: "Standard ukestimer", value: "37.5 t/uke", hint: "Definerer fulltidsstilling" },
      { key: "otmnd", label: "OT-grense (default)", value: "162.5 t/mnd", hint: "Over telles som overtid" },
      { key: "pause", label: "Min. pause (8t-vakt)", value: "30 min · betalt" },
      { key: "stamp", label: "Når stempling mangler", value: "Bruk planlagt + advarsel" },
    ],
    confirmations: [
      { key: "ot", label: "OT over avtalt grense", detail: "Ansvarlig + ansatt må bekrefte", on: true, blocking: true },
      { key: "red", label: "Vakt på rød dag", detail: "Krever signert tillegg", on: true, blocking: true },
      { key: "stamp", label: "Stempling mangler", detail: "Vises som advarsel — ikke blokkerende", on: true, warn: true },
      { key: "pause", label: "Pause < minimum", detail: "Smartout legger til lønnet pause automatisk", on: true },
      { key: "recalc", label: "Recalc endrer brutto > 200 kr", detail: "Varsle ansatt etter lås", on: true },
    ],
  };

  // ======================================================
  // EMPLOYEE (min-lønn) — "din" lønn
  // ======================================================
  const ML = {
    current: { period: "April 2026", net: 27890, gross: 38450, hours: 168.0, supp: 2461, bank: "+6t 30m", payslipDate: "28.04" },
    payslips: [
      { id: "p-03", period: "Mars 2026",    net: 28430, gross: 38468, paid: "15.04", status: "approved", open: true,
        lines: [
          { label: "Grunnlønn · 156t × 230", kr: 35880 },
          { label: "Kveldstillegg · 12t × 25%", kr: 690 },
          { label: "Helgtillegg · 16.5t × 50%", kr: 1898 },
          { label: "Brutto", kr: 38468, total: true },
          { label: "Forskuddsskatt", kr: -8420, neg: true },
          { label: "Pensjon · 2%", kr: -769, neg: true },
          { label: "Fagforening", kr: -150, neg: true },
        ],
        hours: { actual: 156.0, helg: 16.5, kveld: 12.0 } },
      { id: "p-02", period: "Februar 2026", net: 26150, gross: 36100, paid: "15.03", status: "approved" },
      { id: "p-01", period: "Januar 2026",  net: 27890, gross: 38200, paid: "15.02", status: "approved" },
      { id: "p-12", period: "Desember 2025",net: 31420, gross: 42800, paid: "15.01", status: "approved", tag: "Hellig" },
    ],
    banks: [
      { key: "plus", icon: "clock", label: "Pluss/minus-bank", pos: 6.5, max: 20, unit: "t" },
      { key: "avsp", icon: "calendar", label: "Avspasering", pos: 4.0, max: 40, unit: "t" },
      { key: "ferie", icon: "mappin", label: "Ferie igjen", pos: 18, max: 25, unit: " dager" },
      { key: "egen", icon: "alert", label: "Egenmelding", pos: 8, max: 24, unit: " dager", tone: "warning" },
    ],
    adjustments: [
      { date: "30.04", text: "OT godkjent · vakt 28.04", delta: "+1t 30m", tone: "pos", source: "auto" },
      { date: "24.04", text: "Avspasering brukt · halv dag", delta: "−4t 00m", tone: "neg", source: "manuelt" },
      { date: "17.04", text: "Skjærtorsdag ×2", delta: "+8t 30m", tone: "pos", source: "auto" },
      { date: "12.04", text: "Forskjøvet pause", delta: "+0t 30m", tone: "pos", source: "auto" },
      { date: "03.04", text: "Ekstra vakt", delta: "+2t 00m", tone: "pos", source: "auto" },
    ],
    // a thing that needs the employee's signature before lock
    pending: {
      id: "D-104", code: "HELLIGDAG_KOLLISJON", title: "Bekreft tillegg for rød dag",
      date: "17.04", shift: "Skjærtorsdag · 16:00–23:00",
      why: "Hovedavtale §10.3 krever at du signerer tillegget for arbeid på bevegelig helligdag. Når du har signert, kan lønnen for april låses.",
      extra: { grunnlag: "Helligdagstillegg +100%", timer: "7.0t", kr: 1624 },
    },
  };

  D.LO_DEPT = LO_DEPT;
  D.LO_EMPLOYEES = LO_EMPLOYEES;
  D.LO_EMP_BY_ID = Object.fromEntries(LO_EMPLOYEES.map((e) => [e.uid, e]));
  D.LO_SHIFTS = LO_SHIFTS;
  D.LO_TOTALS = LO_TOTALS;
  D.LO_DEVIATIONS = LO_DEVIATIONS;
  D.LO_PERIODS = LO_PERIODS;
  D.LO_RULES = LO_RULES;
  D.LO_RULE_TRACE = LO_RULE_TRACE;
  D.LO_SETTINGS = LO_SETTINGS;
  D.ML_PAY = ML;
})();
