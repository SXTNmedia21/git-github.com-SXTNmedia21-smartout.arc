/* ===== Rapporter & innsikt — shared mock data =====
   Plain script (loads before babel files). Extends window.SmartoutData with the
   reporting domain: multi-venue KPIs, AI insights, data sources, scheduled
   reports, drilldown breakdowns, builder presets. Reuses the Bistro Nord cast.

   World: "Nord Gruppen" — Bistro Nord (flagship, Maria's house) + 3 siblings.
   Numbers are coherent across the module: the focus period is Uke 22 (25.–31. mai
   2026); "i dag" in-app is fre 30. mai 2026. */
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ---------- venues (multi-location) ----------
  // Each carries its own headline KPI snapshot so the comparison view is real.
  const RAP_VENUES = [
    { id: "all", name: "Nord Gruppen", short: "Alle", type: "group", color: "#1c1814", city: "4 steder" },
    { id: "nord", name: "Bistro Nord", short: "Nord", type: "venue", color: "#f97316", city: "Grünerløkka", lead: "ma", flagship: true },
    { id: "brygga", name: "Bistro Brygga", short: "Brygga", type: "venue", color: "#00ab93", city: "Aker Brygge", lead: "et" },
    { id: "torget", name: "Kafé Torget", short: "Torget", type: "venue", color: "#864ad2", city: "Sentrum", lead: "ol" },
    { id: "express", name: "Nord Express", short: "Express", type: "venue", color: "#c18200", city: "Storo · levering", lead: "kk" },
  ];

  // ---------- periods ----------
  const RAP_PERIODS = [
    { id: "w22", label: "Uke 22", range: "25.–31. mai", kind: "week", active: true },
    { id: "w21", label: "Uke 21", range: "18.–24. mai", kind: "week" },
    { id: "may", label: "Mai 2026", range: "01.–31. mai", kind: "month" },
    { id: "q2", label: "Q2 2026", range: "apr–jun", kind: "quarter" },
    { id: "ytd", label: "Hittil i år", range: "jan–mai", kind: "ytd" },
  ];

  // ---------- the 7 headline KPIs (Driftsleder + Eier share these, emphasis differs)
  // value/prev for delta; spark = 8-week trend; target for the budget bar; tone drives color.
  // dir: which direction is "good" (so over/under target reads correctly).
  const RAP_KPIS = [
    {
      id: "labor_pct", label: "Lønnskostnad", group: "Kostnad", unit: "%", fmt: "pct",
      value: 29.4, prev: 27.1, target: 28.0, dir: "down", tone: "warn", icon: "scale",
      sub: "av omsetning", deltaLabel: "+2,3 pp vs uke 21",
      spark: [26.8, 27.2, 26.5, 27.9, 28.4, 27.1, 28.6, 29.4],
      personas: { eier: 1, drift: 2 },
      note: "Over måltallet på 28 % — drevet av overtid på kjøkken.",
    },
    {
      id: "rev_per_hour", label: "Omsetning / arbeidstime", group: "Produktivitet", unit: "kr", fmt: "kr",
      value: 842, prev: 889, target: 880, dir: "up", tone: "warn", icon: "gauge",
      sub: "per bemannet time", deltaLabel: "−47 kr vs uke 21",
      spark: [905, 894, 901, 878, 872, 889, 861, 842],
      personas: { eier: 2, drift: 1 },
      note: "Falt selv om gjestetallet steg — for mye bemanning mot omsetning.",
    },
    {
      id: "wage_budget", label: "Lønn vs budsjett", group: "Kostnad", unit: "kr", fmt: "krsign",
      value: 38200, prev: 12400, target: 0, dir: "down", tone: "crit", icon: "wallet",
      sub: "denne uka", deltaLabel: "+25 800 kr vs uke 21",
      spark: [-4200, 2100, 8600, 5400, 11200, 12400, 24800, 38200],
      personas: { eier: 1, drift: 3 },
      note: "4,2 % over lønnsbudsjettet. Akkumulert avvik for mai: +112 400 kr.",
    },
    {
      id: "avg_check", label: "Snittbong", group: "Salg", unit: "kr", fmt: "kr",
      value: 412, prev: 396, target: 400, dir: "up", tone: "ok", icon: "ticket",
      sub: "per gjest", deltaLabel: "+16 kr vs uke 21",
      spark: [384, 390, 388, 395, 401, 396, 405, 412],
      personas: { eier: 3, drift: 5 },
      note: "Mersalg på dessert + vin trekker opp. Beste uke i år.",
    },
    {
      id: "overtime", label: "Overtid", group: "Bemanning", unit: "t", fmt: "hour",
      value: 18.5, prev: 14.2, target: 10, dir: "down", tone: "crit", icon: "timer",
      sub: "denne uka", deltaLabel: "+4,3 t vs uke 21",
      spark: [8.5, 9.2, 11.0, 10.4, 13.6, 14.2, 16.8, 18.5],
      personas: { eier: 5, drift: 4 },
      note: "Kjøkken står for 12,5 t. To ansatte nærmer seg AML-grensen.",
    },
    {
      id: "coverage", label: "Dekningsgrad", group: "Bemanning", unit: "%", fmt: "pct",
      value: 91, prev: 88, target: 95, dir: "up", tone: "warn", icon: "users",
      sub: "planlagt vs behov", deltaLabel: "+3 pp vs uke 21",
      spark: [86, 89, 87, 90, 88, 88, 92, 91],
      personas: { eier: 6, drift: 6 },
      note: "Ett udekket kveldshull i bar fre 31/5.",
    },
    {
      id: "sales_per_emp", label: "Salg per ansatt", group: "Produktivitet", unit: "kr", fmt: "kr",
      value: 14250, prev: 13980, target: 15000, dir: "up", tone: "ok", icon: "trendUp",
      sub: "denne uka", deltaLabel: "+270 kr vs uke 21",
      spark: [13100, 13420, 13650, 13880, 14010, 13980, 14180, 14250],
      personas: { eier: 4, drift: 7 },
      note: "Sal-teamet ligger 9 % over gruppesnittet.",
    },
  ];

  // secondary KPIs (shown in the grid / drilldowns, not the hero strip)
  const RAP_KPIS_MORE = [
    { id: "revenue", label: "Omsetning", value: 1284500, fmt: "kr0", unit: "kr", delta: "+6,1 %", tone: "ok", icon: "coffee", sub: "uke 22" },
    { id: "guests", label: "Gjester", value: 3118, fmt: "num", unit: "", delta: "+11,2 %", tone: "ok", icon: "users", sub: "antall · uke 22" },
    { id: "labor_hours", label: "Bemannede timer", value: 1526, fmt: "num", unit: "t", delta: "+8,9 %", tone: "warn", icon: "clock", sub: "uke 22" },
    { id: "absence", label: "Fravær", value: 4.8, fmt: "pct", unit: "%", delta: "+1,1 pp", tone: "warn", icon: "umbrella", sub: "korttid · uke 22" },
    { id: "margin", label: "Dekningsbidrag", value: 62.3, fmt: "pct", unit: "%", delta: "−1,4 pp", tone: "warn", icon: "scale", sub: "etter varekost + lønn" },
    { id: "dept_cost", label: "Kjøkken lønn", value: 41.2, fmt: "pct", unit: "%", delta: "+3,8 pp", tone: "crit", icon: "utensils", sub: "av avd.-omsetning" },
    { id: "forecast", label: "Prognose neste uke", value: 1310000, fmt: "kr0", unit: "kr", delta: "+2,0 %", tone: "ok", icon: "sparkle", sub: "uke 23 · 86 % sikkerhet" },
    { id: "no_show", label: "No-show vakter", value: 2, fmt: "num", unit: "", delta: "−1", tone: "ok", icon: "userCheck", sub: "uke 22" },
  ];

  // ---------- per-venue KPI matrix (for comparison view) ----------
  // [labor_pct, rev_per_hour, avg_check, overtime, coverage, revenue]
  const RAP_VENUE_KPIS = {
    nord:    { labor_pct: 29.4, rev_per_hour: 842, avg_check: 412, overtime: 18.5, coverage: 91, revenue: 384500, guests: 933, trend: "down" },
    brygga:  { labor_pct: 26.8, rev_per_hour: 921, avg_check: 468, overtime: 9.4,  coverage: 96, revenue: 512300, guests: 1094, trend: "up" },
    torget:  { labor_pct: 31.6, rev_per_hour: 612, avg_check: 188, overtime: 6.2,  coverage: 93, revenue: 214700, guests: 1142, trend: "flat" },
    express: { labor_pct: 24.1, rev_per_hour: 1040, avg_check: 286, overtime: 4.0, coverage: 98, revenue: 173000, guests: 605, trend: "up" },
  };

  // group totals for the "all" scope
  const RAP_GROUP = { labor_pct: 28.1, rev_per_hour: 853, avg_check: 338, overtime: 38.1, coverage: 94, revenue: 1284500, guests: 3774 };

  // ---------- labor vs revenue dual trend (7 days, uke 22) ----------
  const RAP_TREND_DAYS = [
    { d: "Man", rev: 142000, labor: 38900, guests: 392, gap: 0 },
    { d: "Tir", rev: 138500, labor: 39600, guests: 378, gap: 0 },
    { d: "Ons", rev: 161200, labor: 42100, guests: 441, gap: 0 },
    { d: "Tor", rev: 174800, labor: 47300, guests: 489, gap: 1 },
    { d: "Fre", rev: 228400, labor: 71200, guests: 612, gap: 1 },
    { d: "Lør", rev: 251600, labor: 74800, guests: 668, gap: 0 },
    { d: "Søn", rev: 188000, labor: 64400, guests: 538, gap: 0 },
  ];

  // hourly labor-vs-demand heat for a focused day (Fre) — drilldown
  const RAP_HOURLY = [
    { h: "11", demand: 38, staffed: 52 }, { h: "12", demand: 64, staffed: 60 },
    { h: "13", demand: 71, staffed: 64 }, { h: "14", demand: 44, staffed: 60 },
    { h: "15", demand: 31, staffed: 52 }, { h: "16", demand: 42, staffed: 48 },
    { h: "17", demand: 68, staffed: 64 }, { h: "18", demand: 92, staffed: 80 },
    { h: "19", demand: 96, staffed: 88 }, { h: "20", demand: 78, staffed: 88 },
    { h: "21", demand: 54, staffed: 76 }, { h: "22", demand: 36, staffed: 52 },
  ];

  // ---------- AI insights (foregrounded engine) ----------
  // sev: crit/warn/info/ok. status: new/approved/dismissed/assigned. conf 0-100.
  // sources cite connected data. actions per the brief: approve/dismiss/assign/export.
  const RAP_INSIGHTS = [
    {
      id: "ins1", sev: "crit", conf: 94, kpi: "labor_pct", venue: "nord",
      title: "Lønnskostnaden steg 8,4 % mot forrige uke",
      summary: "Bistro Nord brukte 38 900 kr mer på lønn enn uke 21, mens omsetningen kun økte 6,1 %. Differansen tilsvarer ca. 2,1 ekstra dagsverk.",
      why: "Botsson sammenholdt bemannede timer fra Vaktplan med faktisk omsetning fra POS. Avviket konsentrerer seg på kjøkken torsdag–lørdag, der vakter ble forlenget manuelt etter publisering.",
      sources: [
        { ic: "grid", t: "Vaktplan uke 22", meta: "1 526 t" },
        { ic: "wallet", t: "Lønn · derivert", meta: "+38 900 kr" },
        { ic: "coffee", t: "POS-omsetning", meta: "+6,1 %" },
      ],
      rec: "Reduser kjøkkenbemanning man–ons med 1 rolle og flytt forlengelser til godkjenning før de iverksettes.",
      impact: "≈ 14 200 kr/uke", change: "+8,4 %",
    },
    {
      id: "ins2", sev: "warn", conf: 88, kpi: "coverage", venue: "nord",
      title: "Fredagens middagsvakt var overbemannet med 2,5 årsverk",
      summary: "Mellom 14:00 og 16:00 var det 60 % mer bemanning enn etterspørselen tilsa. Samme mønster gjentar seg 3 av 4 fredager.",
      why: "Timefordelt bemanning fra Vaktplan ble sammenlignet med gjestekurve fra POS og bookinger. Etterspørselen faller etter lunsj, men kveldsvaktene starter for tidlig.",
      sources: [
        { ic: "grid", t: "Vaktplan · fre", meta: "12 vakter" },
        { ic: "users", t: "Gjestekurve POS", meta: "−54 % kl. 15" },
        { ic: "calendar", t: "Bookinger fre", meta: "4 bord" },
      ],
      rec: "Forskyv 2 kveldsvakter fra 15:00 til 17:00. Anslått innsparing uten å svekke service.",
      impact: "≈ 3 400 kr/fre", change: "2,5 årsverk",
    },
    {
      id: "ins3", sev: "crit", conf: 91, kpi: "overtime", venue: "nord",
      title: "Kjøkkenets lønnskostnad er over mål pga. overtid",
      summary: "Kjøkken ligger på 41,2 % lønnsandel mot mål 34 %. 12,5 av 18,5 overtidstimer er på kjøkken denne uka.",
      why: "Botsson koblet overtidstimer per avdeling mot avdelingsomsetning. Jonas H. og Ole T. har begge passert 9 t overtid og nærmer seg AML-grensen.",
      sources: [
        { ic: "timer", t: "Overtidslogg", meta: "12,5 t kjøkken" },
        { ic: "utensils", t: "Avd. Kjøkken", meta: "41,2 %" },
        { ic: "shield", t: "AML-grense", meta: "2 nær grense" },
      ],
      rec: "Tildel en ekstravakt fra vikarpoolen tor–lør og still inn overtidsvarsel ved 8 t.",
      impact: "≈ 9 800 kr/uke", change: "+3,8 pp",
    },
    {
      id: "ins4", sev: "warn", conf: 83, kpi: "rev_per_hour", venue: "nord",
      title: "Gjestetallet steg, men omsetning per arbeidstime falt",
      summary: "Gjester +11,2 %, men omsetning per arbeidstime −5,3 %. Flere gjester ga ikke høyere produktivitet — bemanningen vokste raskere enn salget.",
      why: "Botsson sammenholdt gjesteantall (POS + booking) med bemannede timer. Snittbongen er god; problemet er forholdet timer/omsetning på dagtid.",
      sources: [
        { ic: "users", t: "Gjester", meta: "+11,2 %" },
        { ic: "gauge", t: "Oms./time", meta: "842 kr" },
        { ic: "clock", t: "Bemannede t", meta: "+8,9 %" },
      ],
      rec: "Se drilldown på dagtidsvakter man–ons; etterspørselen bærer ikke dagens bemanning.",
      impact: "≈ 6 100 kr/uke", change: "−5,3 %",
    },
    {
      id: "ins5", sev: "info", conf: 79, kpi: "coverage", venue: "nord",
      title: "Prognosen tilsier 1 færre rolle på mandagslunsj",
      summary: "Etterspørselsmodellen for uke 23 viser lav mandagstrafikk. Du kan kutte 1 rolle på lunsj uten å treffe dekningsmålet.",
      why: "Prognosen bygger på 8 ukers gjestemønster, værvarsel og bookinger for uke 23. Mandag ligger 22 % under ukesnittet.",
      sources: [
        { ic: "sparkle", t: "Prognose uke 23", meta: "86 % sikkerhet" },
        { ic: "calendar", t: "Bookinger man", meta: "1 bord" },
        { ic: "globe", t: "Værvarsel", meta: "regn" },
      ],
      rec: "Fjern 1 lunsjrolle (sal) mandag uke 23 i utkastet til vaktplan.",
      impact: "≈ 1 900 kr", change: "−1 rolle",
    },
    {
      id: "ins6", sev: "ok", conf: 90, kpi: "avg_check", venue: "brygga",
      title: "Bistro Brygga slår snittbong-målet for 3. uke på rad",
      summary: "Snittbong 468 kr (mål 400). Mersalgskampanjen på vin gir 14 % høyere bongverdi enn gruppesnittet.",
      why: "POS-bongdata viser at vin-attach er 31 % på Brygga mot 19 % i gruppen. Mønsteret kan kopieres til Bistro Nord.",
      sources: [
        { ic: "ticket", t: "Bonganalyse", meta: "468 kr" },
        { ic: "coffee", t: "Vin-attach", meta: "31 %" },
      ],
      rec: "Del Bryggas vin-script med Bistro Nord og Torget som rutine i Bibliotek.",
      impact: "≈ 11 000 kr/uke", change: "+17 %",
    },
  ];

  // ---------- AI activity log (generated / approved / dismissed / scheduled) ----------
  const RAP_ACTIVITY = [
    { id: "ac1", kind: "generated", who: "bot", text: "genererte 6 innsikter for uke 22", t: "fre 06:00", ic: "sparkle" },
    { id: "ac2", kind: "approved", who: "ma", text: "godkjente «Reduser kjøkkenbemanning man–ons»", t: "tor 16:40", ic: "check" },
    { id: "ac3", kind: "scheduled", who: "ma", text: "endret «Ukentlig lønnsrapport» til mandag 07:00", t: "tor 14:10", ic: "timer" },
    { id: "ac4", kind: "dismissed", who: "et", text: "avviste «Overbemannet lørdag» — planlagt arrangement", t: "ons 11:25", ic: "x" },
    { id: "ac5", kind: "assigned", who: "ma", text: "tildelte «Overtid kjøkken» til Jonas H.", t: "ons 09:02", ic: "userCheck" },
    { id: "ac6", kind: "exported", who: "ol", text: "eksporterte «Avdelingslønnsomhet» til PDF", t: "tir 17:50", ic: "download" },
  ];

  // ---------- report builder ----------
  const RAP_PRESETS = [
    { id: "p1", name: "Ukentlig lønnsrapport", desc: "Lønnskostnad %, timer og avvik per avdeling", ic: "wallet", dims: ["Uke", "Avdeling"], sources: ["Lønn", "Vaktplan"], hot: true },
    { id: "p2", name: "Lønnsavvik", desc: "Budsjett vs faktisk lønn med forklaringer", ic: "scale", dims: ["Måned", "Sted"], sources: ["Lønn", "Budsjett"] },
    { id: "p3", name: "Salg vs bemanning", desc: "Omsetning per arbeidstime time for time", ic: "gauge", dims: ["Dag", "Time"], sources: ["POS", "Vaktplan"], hot: true },
    { id: "p4", name: "Gjesteetterspørsel vs plan", desc: "Prognose mot faktisk bemanning", ic: "users", dims: ["Uke", "Time"], sources: ["POS", "Booking", "Vaktplan"] },
    { id: "p5", name: "Avdelingslønnsomhet", desc: "Dekningsbidrag per avdeling og rolle", ic: "utensils", dims: ["Måned", "Avdeling", "Rolle"], sources: ["POS", "Lønn", "Regnskap"] },
    { id: "p6", name: "Kostnadslekkasje", desc: "Overtid, svinn og avvik som tærer på margin", ic: "alert", dims: ["Uke", "Sted"], sources: ["Lønn", "Utgifter", "POS"] },
  ];
  const RAP_DIMENSIONS = [
    { id: "period", label: "Periode", icon: "calendar", value: "Uke 22", opts: ["I dag", "Denne uka", "Uke 22", "Mai 2026", "Q2 2026", "Egendefinert"] },
    { id: "location", label: "Sted", icon: "mappin", value: "Bistro Nord", opts: ["Nord Gruppen", "Bistro Nord", "Bistro Brygga", "Kafé Torget", "Nord Express"] },
    { id: "dept", label: "Avdeling", icon: "utensils", value: "Alle", opts: ["Alle", "Kjøkken", "Sal", "Bar", "Event", "Lager"] },
    { id: "team", label: "Lag", icon: "users", value: "Alle lag", opts: ["Alle lag", "Kjøkken dag", "Kjøkken kveld", "Sal kveld"] },
    { id: "role", label: "Rolle", icon: "user", value: "Alle", opts: ["Alle", "Kokk", "Servitør", "Bartender", "Renhold", "Skiftleder"] },
    { id: "shift", label: "Vakttype", icon: "clock", value: "Alle", opts: ["Alle", "Dag", "Kveld", "Helg", "Natt"] },
    { id: "source", label: "Datakilde", icon: "layers", value: "POS + Lønn", opts: ["Alle kilder", "POS", "Lønn", "Vaktplan", "Booking", "Levering"] },
  ];
  const RAP_METRIC_LIB = [
    { id: "labor_pct", label: "Lønnskostnad %", on: true },
    { id: "rev_per_hour", label: "Omsetning / time", on: true },
    { id: "overtime", label: "Overtid", on: true },
    { id: "avg_check", label: "Snittbong", on: false },
    { id: "guests", label: "Gjester", on: false },
    { id: "absence", label: "Fravær", on: false },
    { id: "coverage", label: "Dekningsgrad", on: false },
    { id: "margin", label: "Dekningsbidrag", on: false },
  ];

  // ---------- data sources / integrations ----------
  // status: ok / syncing / warning / error / off. conf = source confidence.
  const RAP_SOURCES = [
    {
      id: "pos", name: "PowerOffice POS", kind: "Kasse / POS", ic: "coffee", status: "ok", conf: 99,
      last: "for 4 min siden", freq: "Sanntid", rows: "12 480 bonger", health: 99,
      mapped: 14, total: 14, owner: "Automatisk", note: "Omsetning, bonger, varelinjer, betaling.",
    },
    {
      id: "payroll", name: "Visma Lønn", kind: "Lønn", ic: "wallet", status: "ok", conf: 97,
      last: "i natt 02:00", freq: "Daglig", rows: "7 ansatte", health: 96,
      mapped: 11, total: 12, owner: "Maria A.", note: "Timer, satser, tillegg, fravær.",
    },
    {
      id: "schedule", name: "Smartout Vaktplan", kind: "Bemanning", ic: "grid", status: "ok", conf: 100,
      last: "for 1 min siden", freq: "Sanntid", rows: "1 526 timer", health: 100,
      mapped: 9, total: 9, owner: "Internt", note: "Vakter, roller, dekning, overtid.",
    },
    {
      id: "guest", name: "DinnerBooking", kind: "Booking / gjester", ic: "calendar", status: "warning", conf: 84,
      last: "for 38 min siden", freq: "Hver time", rows: "214 bookinger", health: 81,
      mapped: 6, total: 8, owner: "Maria A.", note: "2 felt umappet: «bordtype», «no-show».",
    },
    {
      id: "delivery", name: "Foodora", kind: "Levering", ic: "remote", status: "syncing", conf: 90,
      last: "synker nå…", freq: "Hver time", rows: "605 ordre", health: 88,
      mapped: 7, total: 9, owner: "Automatisk", note: "Leveringssalg, gebyr, leveringstid.",
    },
    {
      id: "expenses", name: "Tripletex Utgifter", kind: "Kostnader", ic: "file", status: "warning", conf: 72,
      last: "i går 23:10", freq: "Daglig", rows: "186 bilag", health: 68,
      mapped: 8, total: 12, owner: "Eier", note: "4 bilag uten kategori — påvirker margin.",
    },
    {
      id: "accounting", name: "Tripletex Regnskap", kind: "Regnskap", ic: "scale", status: "ok", conf: 95,
      last: "i natt 03:30", freq: "Daglig", rows: "Hovedbok", health: 94,
      mapped: 10, total: 10, owner: "Eier", note: "Kontoplan, dekningsbidrag, budsjett.",
    },
    {
      id: "manual", name: "Manuelle opplastinger", kind: "Manuelt", ic: "download", status: "off", conf: null,
      last: "ingen aktive", freq: "Ved behov", rows: "0 filer", health: null,
      mapped: 0, total: 0, owner: "Maria A.", note: "Last opp CSV/Excel for engangsanalyser.",
    },
  ];

  // field-mapping detail for the guest source (the one with warnings)
  const RAP_MAPPING = {
    source: "guest",
    fields: [
      { src: "booking_date", dst: "Dato", status: "ok", conf: 100, sample: "2026-05-30" },
      { src: "covers", dst: "Antall gjester", status: "ok", conf: 99, sample: "4" },
      { src: "service", dst: "Servering", status: "ok", conf: 96, sample: "Middag" },
      { src: "channel", dst: "Bookingkanal", status: "ok", conf: 92, sample: "Web" },
      { src: "table_type", dst: "— ikke mappet —", status: "unmapped", conf: null, sample: "window-2" },
      { src: "no_show_flag", dst: "— ikke mappet —", status: "unmapped", conf: null, sample: "false" },
      { src: "guest_note", dst: "Gjestenotat", status: "low", conf: 61, sample: "Bursdag, allergi" },
      { src: "deposit", dst: "Depositum", status: "ok", conf: 88, sample: "500" },
    ],
    warnings: [
      { t: "2 felt er ikke mappet", s: "«bordtype» og «no-show» brukes i 2 rapporter — disse vil mangle data.", sev: "warn" },
      { t: "«Gjestenotat» har lav sikkerhet", s: "Fritekst — Botsson tolker allergi/anledning med 61 % sikkerhet.", sev: "info" },
    ],
  };

  // ---------- scheduled reports ----------
  // cadence + recipients (role groups) + next/last run + status + audit.
  const RAP_RECIPIENT_GROUPS = [
    { id: "owners", label: "Eiere", n: 2, color: "#f97316" },
    { id: "gm", label: "Restaurantsjefer", n: 4, color: "#00ab93" },
    { id: "finance", label: "Økonomi", n: 2, color: "#864ad2" },
    { id: "hr", label: "HR", n: 1, color: "#c18200" },
    { id: "ops", label: "Drift", n: 3, color: "#2784d5" },
    { id: "leads", label: "Teamledere", n: 6, color: "#008388" },
  ];
  const RAP_SCHEDULED = [
    {
      id: "s1", name: "Ukentlig lønnsrapport", preset: "Ukentlig lønnsrapport",
      cadence: "Ukentlig", when: "Mandag 07:00", channel: "E-post + app", status: "active",
      next: "man 02.06 · 07:00", last: "man 26.05 · 07:00 · levert",
      recipients: ["owners", "gm", "finance"], scope: "Nord Gruppen", format: "PDF", owner: "ma",
    },
    {
      id: "s2", name: "Daglig driftspuls", preset: "Salg vs bemanning",
      cadence: "Daglig", when: "Hver dag 06:00", channel: "App-varsel", status: "active",
      next: "lør 31.05 · 06:00", last: "fre 30.05 · 06:00 · levert",
      recipients: ["gm", "ops"], scope: "Per sted", format: "App", owner: "ma",
    },
    {
      id: "s3", name: "Avdelingslønnsomhet", preset: "Avdelingslønnsomhet",
      cadence: "Månedlig", when: "1. i måneden 08:00", channel: "E-post", status: "active",
      next: "man 01.06 · 08:00", last: "ons 01.05 · 08:00 · levert",
      recipients: ["owners", "finance"], scope: "Nord Gruppen", format: "PDF + Excel", owner: "ol",
    },
    {
      id: "s4", name: "Kostnadslekkasje", preset: "Kostnadslekkasje",
      cadence: "Ukentlig", when: "Fredag 16:00", channel: "E-post", status: "paused",
      next: "satt på pause", last: "fre 23.05 · 16:00 · levert",
      recipients: ["owners", "ops"], scope: "Bistro Nord", format: "PDF", owner: "ma",
    },
    {
      id: "s5", name: "Overtidsvarsel", preset: "Kostnadslekkasje",
      cadence: "Daglig", when: "Ved terskel · 8 t", channel: "App + SMS", status: "active",
      next: "utløses ved terskel", last: "tor 29.05 · 14:22 · utløst",
      recipients: ["gm", "hr"], scope: "Per sted", format: "App", owner: "ma",
    },
  ];
  const RAP_DELIVERY_LOG = [
    { id: "d1", report: "Daglig driftspuls", t: "fre 30.05 · 06:00", to: "7 mottakere", status: "ok", opened: "5 åpnet" },
    { id: "d2", report: "Overtidsvarsel", t: "tor 29.05 · 14:22", to: "5 mottakere", status: "ok", opened: "4 åpnet" },
    { id: "d3", report: "Daglig driftspuls", t: "tor 29.05 · 06:00", to: "7 mottakere", status: "ok", opened: "6 åpnet" },
    { id: "d4", report: "Ukentlig lønnsrapport", t: "man 26.05 · 07:00", to: "8 mottakere", status: "ok", opened: "8 åpnet" },
    { id: "d5", report: "Daglig driftspuls", t: "ons 28.05 · 06:00", to: "7 mottakere", status: "warn", opened: "1 levering feilet" },
  ];

  // ---------- drilldown breakdowns (per KPI) ----------
  // generic builder: by department, by role, by day, contributing factors.
  const RAP_DRILL = {
    labor_pct: {
      byDept: [
        { id: "kjokken", name: "Kjøkken", val: 41.2, target: 34, hours: 612, color: "#ee560c" },
        { id: "sal", name: "Sal", val: 24.6, target: 26, hours: 588, color: "#00ab93" },
        { id: "bar", name: "Bar", val: 22.1, target: 24, hours: 196, color: "#864ad2" },
        { id: "event", name: "Event", val: 18.4, target: 20, hours: 78, color: "#c18200" },
        { id: "lager", name: "Lager", val: 12.0, target: 14, hours: 52, color: "#008388" },
      ],
      byDay: RAP_TREND_DAYS.map((x) => ({ d: x.d, val: +((x.labor / x.rev) * 100).toFixed(1) })),
      factors: [
        { t: "Overtid kjøkken", v: "+2,1 pp", sev: "crit", ic: "timer" },
        { t: "Forlengede vakter tor–lør", v: "+1,4 pp", sev: "warn", ic: "clock" },
        { t: "Lavere lunsjsalg man–ons", v: "+0,9 pp", sev: "warn", ic: "trendUp" },
        { t: "Helligdagstillegg 17. mai-uke", v: "−0,3 pp", sev: "info", ic: "calendar" },
      ],
    },
  };

  // expose
  Object.assign(D, {
    RAP_VENUES, RAP_PERIODS, RAP_KPIS, RAP_KPIS_MORE, RAP_VENUE_KPIS, RAP_GROUP,
    RAP_TREND_DAYS, RAP_HOURLY, RAP_INSIGHTS, RAP_ACTIVITY, RAP_PRESETS,
    RAP_DIMENSIONS, RAP_METRIC_LIB, RAP_SOURCES, RAP_MAPPING, RAP_RECIPIENT_GROUPS,
    RAP_SCHEDULED, RAP_DELIVERY_LOG, RAP_DRILL,
  });
})();
