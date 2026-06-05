// ===== Planlegging — global calendar data layer =====
// Loads BEFORE planlegging-views/panels/page. Exposes window.PL (data + helpers).
// Coherent with the Bistro Nord cast (data.js / vaktplan) and the app's Week 22
// calendar: Mon 27/5 – Sun 2/6 2026, today = Thu 30/5 (idx 3). May 1 2026 = Wednesday.
(function () {
  // ---------- departments (reuse the canonical dept colours) ----------
  const DEPT = {
    kjokken: { id: "kjokken", name: "Kjøkken", c: "#ee560c" },
    sal:     { id: "sal", name: "Sal", c: "#00ab93" },
    bar:     { id: "bar", name: "Bar", c: "#864ad2" },
    event:   { id: "event", name: "Event", c: "#c18200" },
  };

  // ---------- staff (matches vaktplan EMP) ----------
  const STAFF = [
    { id: "ma", name: "Maria A.", init: "MA", c: "#FF7849", role: "Driftsleder", dep: "sal" },
    { id: "jh", name: "Jonas H.", init: "JH", c: "#3B82F6", role: "Kokk", dep: "kjokken" },
    { id: "ao", name: "Anna O.", init: "AO", c: "#f59e0b", role: "Kokk", dep: "kjokken" },
    { id: "sl", name: "Selma L.", init: "SL", c: "#10B981", role: "Servitør", dep: "sal" },
    { id: "pk", name: "Petter K.", init: "PK", c: "#A855F7", role: "Servitør", dep: "sal" },
    { id: "ea", name: "Even A.", init: "EA", c: "#14b8a6", role: "Vertinne", dep: "sal" },
    { id: "mh", name: "Mats H.", init: "MH", c: "#864ad2", role: "Bartender", dep: "bar" },
  ];
  const empById = (id) => STAFF.find(e => e.id === id) || { name: "—", init: "?", c: "#888" };

  // ---------- entity types (the legend) ----------
  // Each calendar item type has a distinct visual signature.
  const ETYPE = {
    shift:   { id: "shift", label: "Vakt", plural: "Vakter", icon: "grid", c: "#6b6256", tint: "var(--secondary)" },
    booking: { id: "booking", label: "Booking", plural: "Bookinger", icon: "utensils", c: "#2784d5" },
    event:   { id: "event", label: "Event", plural: "Eventer", icon: "ticket", c: "#f97316" },
    leave:   { id: "leave", label: "Fravær", plural: "Fravær", icon: "umbrella", c: "#c18200" },
    hours:   { id: "hours", label: "Åpningstid", plural: "Åpningstider", icon: "door", c: "#7a756e" },
    season:  { id: "season", label: "Sesong", plural: "Sesonger", icon: "wheel", c: "#8b5cf6" },
  };
  const TYPE_ORDER = ["shift", "booking", "event", "leave", "hours", "season"];

  // ---------- the demo week (matches vaktplan DAYS) ----------
  // iso = "M-D"; wd = weekday index (Mon=0)
  const WEEK = [
    { wd: 0, dn: "Man", dl: "Mandag", d: 27, m: 5, iso: "5-27", we: false },
    { wd: 1, dn: "Tir", dl: "Tirsdag", d: 28, m: 5, iso: "5-28", we: false },
    { wd: 2, dn: "Ons", dl: "Onsdag", d: 29, m: 5, iso: "5-29", we: false },
    { wd: 3, dn: "Tor", dl: "Torsdag", d: 30, m: 5, iso: "5-30", we: false, today: true },
    { wd: 4, dn: "Fre", dl: "Fredag", d: 31, m: 5, iso: "5-31", we: false },
    { wd: 5, dn: "Lør", dl: "Lørdag", d: 1, m: 6, iso: "6-1", we: true },
    { wd: 6, dn: "Søn", dl: "Søndag", d: 2, m: 6, iso: "6-2", we: true },
  ];
  const TODAY_ISO = "5-30";

  // month metadata for the month grid (internally consistent with WEEK)
  const MONTHS = {
    5: { name: "Mai", year: 2026, days: 31, firstWd: 2 },   // May 1 2026 = Wednesday
    6: { name: "Juni", year: 2026, days: 30, firstWd: 5 },  // Jun 1 2026 = Saturday
  };
  const MONTH_NAMES = ["Januar","Februar","Mars","April","Mai","Juni","Juli","August","September","Oktober","November","Desember"];
  const isoOf = (m, d) => `${m}-${d}`;
  const DAYS_IN = { 1:31, 2:28, 3:31, 4:30, 5:31, 6:30, 7:31, 8:31, 9:30, 10:31, 11:30, 12:31 };
  // weekday math anchored to May 1 2026 = Wednesday (Mon=0 → idx 2)
  function monthMeta(m) {
    if (MONTHS[m]) return MONTHS[m];
    let wd = 2;
    if (m > 5) { for (let k = 5; k < m; k++) wd = (wd + DAYS_IN[k]) % 7; }
    else { for (let k = m; k < 5; k++) wd -= DAYS_IN[k]; wd = ((wd % 7) + 7) % 7; }
    return { name: MONTH_NAMES[m - 1], year: 2026, days: DAYS_IN[m], firstWd: wd };
  }
  const wdOf = (m, d) => (monthMeta(m).firstWd + d - 1) % 7;

  // ---------- opening hours (weekly standard + exceptions) ----------
  // open/close in decimal hours; 25 = 01:00 next day
  const HOURS_STD = [
    { wd: 0, open: 11, close: 23, label: "11–23" },
    { wd: 1, open: 11, close: 23, label: "11–23" },
    { wd: 2, open: 11, close: 23, label: "11–23" },
    { wd: 3, open: 11, close: 23, label: "11–23" },
    { wd: 4, open: 11, close: 25, label: "11–01" },
    { wd: 5, open: 11, close: 25, label: "11–01" },
    { wd: 6, open: 12, close: 22, label: "12–22" },
  ];
  // date-specific overrides (exceptions / special dates / closed periods)
  const HOURS_EXC = [
    { iso: "5-31", open: 11, close: 25, label: "11–01", kind: "event", note: "Forlenget til 01:00 — Live jazz" },
    { iso: "6-1", open: 9, close: 25, label: "09–01", kind: "special", note: "Bryllup fra 14:00 + kveldsåpent" },
    { iso: "5-17", open: 9, close: 16, label: "09–16", kind: "special", note: "17. mai-brunsj" },
    { iso: "6-2", open: null, close: null, label: "Stengt", kind: "closed", note: "Ingen åpningstid satt — mangler" },
  ];
  const hoursFor = (iso, wd) => {
    const exc = HOURS_EXC.find(h => h.iso === iso);
    if (exc) return { ...exc, exception: true };
    return { ...HOURS_STD[wd], exception: false };
  };

  // ---------- shifts (subset for calendar overlay; coherent w/ vaktplan) ----------
  const sh = (e, iso, role, dep, st, en, opt = {}) =>
    ({ type: "shift", id: "s-" + e + "-" + iso, e, iso, role, dep, st, en, t: `${pad(st)}–${pad(en)}`, status: "published", ...opt });
  const pad = (h) => `${String(Math.floor(h % 24)).padStart(2, "0")}:00`.slice(0, 5);
  const SHIFTS = [
    sh("ma", "5-27", "Driftsleder", "sal", 9, 17, { lc: "closed" }),
    sh("ma", "5-28", "Driftsleder", "sal", 9, 17, { lc: "settled" }),
    sh("ma", "5-29", "Driftsleder", "sal", 9, 17, { lc: "settled" }),
    sh("ma", "5-30", "Driftsleder", "sal", 9, 17, { lc: "active", now: true }),
    sh("ma", "5-31", "Driftsleder", "sal", 9, 17, {}),
    sh("jh", "5-28", "Kokk", "kjokken", 11, 20, { lc: "settled" }),
    sh("jh", "5-30", "Kokk", "kjokken", 11, 20, { lc: "active", now: true }),
    sh("jh", "5-31", "Kokk", "kjokken", 14, 23, {}),
    sh("jh", "6-1", "Kokk", "kjokken", 12, 22, {}),
    sh("ao", "5-27", "Kokk", "kjokken", 8, 16, { lc: "closed" }),
    sh("ao", "5-29", "Kokk", "kjokken", 8, 16, { lc: "settled" }),
    sh("ao", "5-30", "Kokk", "kjokken", 8, 16, { lc: "active", now: true }),
    sh("sl", "5-30", "Servitør", "sal", 16, 23, { status: "draft" }),
    sh("sl", "5-31", "Servitør", "sal", 16, 23, {}),
    sh("sl", "6-1", "Servitør", "sal", 11, 19, { warn: "Søkt fri denne dagen" }),
    sh("pk", "5-31", "Servitør", "sal", 11, 19, { status: "draft", warn: "Passerer 37,5t" }),
    sh("pk", "6-1", "Servitør", "sal", 16, 23, {}),
    sh("ea", "5-28", "Vertinne", "sal", 12, 20, { lc: "settled" }),
    sh("ea", "5-31", "Vertinne", "sal", 18, 24, { status: "changed" }),
    sh("ea", "6-1", "Vertinne", "sal", 10, 18, {}),
    sh("mh", "5-29", "Bartender", "bar", 17, 23, { lc: "settled" }),
    sh("mh", "5-30", "Bartender", "bar", 17, 23, { lc: "active", now: true }),
    sh("mh", "6-1", "Bartender", "bar", 17, 25, {}),
  ];

  // ---------- bookings (customer reservations) ----------
  const bk = (id, iso, st, en, name, guests, table, dep, status, src, opt = {}) =>
    ({ type: "booking", id, iso, st, en, t: `${pad(st)}–${pad(en)}`, name, guests, table, dep, status, src, ...opt });
  const BOOKINGS = [
    bk("b1", "5-27", 18, 20, "Familien Berg", 4, "Bord 7", "sal", "confirmed", "web", { phone: "99 11 22 33", note: "Bursdag — ønsker kakefat" }),
    bk("b2", "5-28", 19, 21.5, "Hansen AS — middag", 12, "Bord 8·9·10", "event", "confirmed", "phone", { phone: "92 00 11 22", note: "Firmamiddag, 3-retters, allergi: skalldyr (1)" }),
    bk("b3", "5-29", 17.5, 19, "Ingrid Solheim", 2, "Bord 3", "sal", "seated", "walk", { phone: "48 22 19 04" }),
    bk("b4", "5-30", 13, 14, "Lunsj — Nordås skole", 18, "Sal bak", "sal", "confirmed", "phone", { note: "Skoleklasse, fast meny, 12:45 oppmøte" }),
    bk("b5", "5-30", 19, 21, "Dahl + 1", 2, "Bord 2", "sal", "confirmed", "web", { phone: "91 44 55 66" }),
    bk("b6", "5-30", 20, 22, "Bjørk selskap", 8, "Bord 11", "sal", "pending", "web", { phone: "45 90 12 34", note: "Avventer bekreftelse på antall" }),
    bk("b7", "5-31", 18, 20.5, "Kvale bryllup-prøve", 6, "Sal hjørne", "event", "confirmed", "phone", { note: "Smaksmeny før bryllup 1/6" }),
    bk("b8", "5-31", 21, 23, "Vennegjeng Holm", 10, "Bar-området", "bar", "confirmed", "web", { note: "Live jazz-kveld" }),
    bk("b9", "5-31", 23, 23.5, "Sen booking — Aas", 4, "Bord 5", "bar", "warn", "web", { note: "Utenfor åpningstid? sjekk", conflict: "hours" }),
    bk("b10", "6-1", 14, 18, "Kvale BRYLLUP", 60, "Hele sal", "event", "confirmed", "phone", { note: "60 gjester, eget oppsett, koordinator: Maria" }),
    bk("b11", "6-1", 19, 21, "Strand familie", 5, "Bord 6", "sal", "confirmed", "web", {}),
    bk("b12", "6-2", 13, 15, "Søndagslunsj — Rør", 3, "Bord 4", "sal", "cancelled", "web", { note: "Kansellert av gjest" }),
  ];

  // ---------- events (demand drivers) ----------
  const ev = (id, iso, st, en, title, dep, demand, opt = {}) =>
    ({ type: "event", id, iso, st, en, t: st != null ? `${pad(st)}–${pad(en)}` : "Hele dagen", title, dep, demand, ...opt });
  const EVENTS = [
    ev("e1", "5-28", 19, 22, "Quiz-kveld", "bar", "med", { season: "var", note: "Fast tirsdagsquiz, ~40 gjester", staffing: "+1 bartender", allday: false }),
    ev("e2", "5-29", 18, 20, "Vinsmaking — vår", "event", "med", { season: "var", note: "12 påmeldte, sommelier booket", staffing: "+1 vert", allday: false }),
    ev("e3", "5-31", 20, 25, "Live jazz", "bar", "high", { season: "var", note: "Forventet fullt hus + utvidet åpningstid", staffing: "+1 bartender, +1 servitør", allday: false }),
    ev("e4", "6-1", null, null, "Kvale bryllup", "event", "high", { season: "var", note: "Privat selskap, 60 gjester, stenger sal for ordinær drift fra 14", staffing: "Full eventbemanning", allday: true }),
    ev("e5", "5-30", null, null, "Bama storleveranse", "kjokken", "low", { season: "var", note: "Ekstra varemottak kl. 09:30", staffing: "Ingen ekstra", allday: true }),
  ];

  // ---------- leave requests ----------
  const lv = (id, e, from, to, kind, status, opt = {}) =>
    ({ type: "leave", id, e, from, to, kind, status, ...opt });
  const LEAVE = [
    lv("l1", "ao", "5-27", "5-29", "Ferie", "approved", { note: "Godkjent 3 uker siden", days: 3 }),
    lv("l2", "pk", "5-30", "5-30", "Egenmelding", "pending", { note: "Meldt syk i morges", days: 1, impact: "Petter står på lunsj torsdag" }),
    lv("l3", "sl", "6-1", "6-1", "Permisjon", "pending", { note: "Søkt fri — kolliderer med bryllupsvakt", days: 1, conflict: "shift", impact: "Selma er satt opp 11–19 lørdag (bryllup)" }),
    lv("l4", "mh", "6-2", "6-2", "Avspasering", "approved", { note: "Avtalt forrige uke", days: 1 }),
    lv("l5", "ea", "5-28", "5-28", "Velferdspermisjon", "rejected", { note: "Avslått — for kort varsel", days: 1 }),
  ];

  // ---------- year-wheel seasons (annual planning context) ----------
  // mStart/mEnd inclusive month numbers (1-12); wraps for winter.
  // Rich planning fields (budget / factors / goals) mirror the old Year Wheel "Machine Room".
  const DAYF = { Man: 1.0, Tir: 0.9, Ons: 1.0, Tor: 1.2, Fre: 1.8, Lør: 2.4, Søn: 0.6 };
  const HOURF = [0,0,0,0,0,0,0.1,0.3,0.5,0.6,0.8,1.2,1.5,1.2,0.8,0.8,1.0,1.4,2.4,2.3,2.0,1.4,1.0,0.3];
  const OH = { Man: "11–23", Tir: "11–23", Ons: "11–23", Tor: "11–23", Fre: "11–01", Lør: "11–01", Søn: "12–22" };
  const SEASONS = [
    { id: "vinter", name: "Vinter 2026", mStart: 12, mEnd: 2, c: "#5b8def", status: "archived", demand: "Lav–middels",
      concept: "Vinterkos & after-ski", note: "Tunge helger, rolige hverdager", events: ["Nyttårsmeny", "Vinterferie-uke 8"],
      range: "1. des – 28. feb", days: 90, revenue: 4200000, revenueActual: 4050000, laborPct: 33, teams: 1, avgWage: 280, avgTicket: 540, seasonFactor: 0.9,
      openHours: { Man: "11–22", Tir: "11–22", Ons: "11–22", Tor: "11–23", Fre: "11–24", Lør: "11–24", Søn: "Stengt" }, overrides: 1,
      dayFactors: { Man: 0.9, Tir: 0.8, Ons: 0.9, Tor: 1.1, Fre: 1.6, Lør: 2.0, Søn: 0.5 }, hourFactors: HOURF,
      goals: ["Holde kjøkken bemannet tross lav pågang", "Teste ny lunsjmeny", "Null matsvinn på buffet"], missing: [], seededFrom: "Riksavtalen · hospitality-baseline" },
    { id: "var", name: "Vår 2026", mStart: 3, mEnd: 5, c: "#3fb27f", status: "active", demand: "Stigende",
      concept: "Vårmeny & uteservering åpner", note: "Påske + 17. mai gir topper", events: ["Påskemeny", "17. mai-brunsj", "Uteservering åpner"],
      range: "1. mar – 31. mai", days: 92, revenue: 6800000, revenueActual: 4120000, laborPct: 30, teams: 2, avgWage: 285, avgTicket: 600, seasonFactor: 1.0,
      openHours: OH, overrides: 3,
      dayFactors: DAYF, hourFactors: HOURF,
      goals: ["Full uteservering åpnet før 17. mai", "Vårmeny lansert i alle avdelinger", "Øke lunsjandel med 15 %"], missing: [], seededFrom: "Riksavtalen · hospitality-baseline" },
    { id: "sommer", name: "Sommer 2026", mStart: 6, mEnd: 8, c: "#f0a93f", status: "planned", demand: "Høy",
      concept: "Sommermeny, full uteservering, turister", note: "Behov for sommerbemanning", events: ["Sommermeny lansering", "Festspill-uka", "Fellesferie-dekning"],
      range: "1. jun – 31. aug", days: 92, revenue: 12000000, revenueActual: null, laborPct: 30, teams: 3, avgWage: 280, avgTicket: 650, seasonFactor: 1.2,
      openHours: OH, overrides: 2,
      dayFactors: { Man: 1.0, Tir: 1.0, Ons: 1.1, Tor: 1.3, Fre: 1.9, Lør: 2.4, Søn: 0.9 },
      hourFactors: [0,0,0,0,0,0,0.1,0.4,0.6,0.7,0.9,1.3,1.6,1.3,0.9,0.9,1.1,1.5,2.4,2.4,2.1,1.5,1.1,0.4],
      goals: ["Nå 12 M NOK i omsetning", "Null overtid for kokker", "Introdusere ny vegetar-meny", "Trene 3 servitører til senior"],
      missing: ["Åpningstider for Bar", "Bemanningsplan sommer", "Min. 1 avdeling full"], seededFrom: "Riksavtalen · hospitality-baseline" },
    { id: "host", name: "Høst 2025", mStart: 9, mEnd: 11, c: "#c97b4a", status: "archived", demand: "Middels",
      concept: "Høstmeny & vilt", note: "Julebord-sesong starter i nov", events: ["Høstmeny", "Julebord åpner booking"],
      range: "1. sep – 30. nov", days: 91, revenue: 3400000, revenueActual: 3320000, laborPct: 31, teams: 2, avgWage: 280, avgTicket: 590, seasonFactor: 1.0,
      openHours: OH, overrides: 4,
      dayFactors: DAYF, hourFactors: HOURF,
      goals: ["Høstmeny & vilt på plass", "Åpne julebord-booking i november", "Maks kapasitet lør/søn"], missing: [], seededFrom: "Riksavtalen · hospitality-baseline" },
  ];
  // planning events on the year wheel (pins)
  const YEAR_PINS = [
    { iso: "4-12", m: 4, d: 12, title: "Påskemeny lansering", season: "var", kind: "menu" },
    { iso: "5-17", m: 5, d: 17, title: "17. mai-brunsj", season: "var", kind: "event" },
    { iso: "5-20", m: 5, d: 20, title: "Uteservering åpner", season: "var", kind: "ops" },
    { iso: "6-6", m: 6, d: 6, title: "Sommermeny lansering", season: "sommer", kind: "menu" },
    { iso: "6-15", m: 6, d: 15, title: "Kickoff sommerbemanning", season: "sommer", kind: "staffing" },
    { iso: "7-1", m: 7, d: 1, title: "Festspill-uka", season: "sommer", kind: "event" },
    { iso: "11-1", m: 11, d: 1, title: "Julebord åpner booking", season: "host", kind: "booking" },
  ];

  // ---------- booking status config ----------
  const BSTATUS = {
    confirmed: { label: "Bekreftet", c: "var(--success)", soft: "rgba(17,173,50,0.12)" },
    pending:   { label: "Avventer", c: "var(--warning)", soft: "rgba(193,130,0,0.12)" },
    seated:    { label: "Ankommet", c: "var(--info)", soft: "rgba(39,132,213,0.12)" },
    warn:      { label: "Sjekk", c: "var(--error)", soft: "rgba(231,0,11,0.10)" },
    cancelled: { label: "Kansellert", c: "var(--muted)", soft: "var(--secondary)" },
  };
  const LSTATUS = {
    approved: { label: "Godkjent", c: "var(--success)", soft: "rgba(17,173,50,0.12)" },
    pending:  { label: "Venter", c: "var(--warning)", soft: "rgba(193,130,0,0.12)" },
    rejected: { label: "Avslått", c: "var(--muted)", soft: "var(--secondary)" },
  };
  const SRC = { web: "Nett", phone: "Telefon", walk: "Drop-in" };
  const DEMAND = { low: { label: "Lav", c: "var(--muted)" }, med: { label: "Middels", c: "var(--warning)" }, high: { label: "Høy", c: "var(--orange)" } };

  // ---------- saved views ----------
  // entities = which types are visible; default highlights one workflow
  const SAVED_VIEWS = [
    { id: "ops", name: "Dagens drift", icon: "home", view: "day", entities: ["shift", "booking", "event", "leave", "hours"], desc: "Alt som skjer i dag" },
    { id: "bookings", name: "Kun bookinger", icon: "utensils", view: "week", entities: ["booking", "hours", "event"], desc: "Reservasjoner & kapasitet" },
    { id: "staffing", name: "Bemanningsdekning", icon: "grid", view: "week", entities: ["shift", "leave", "event"], desc: "Vakter mot fravær & demand" },
    { id: "leave", name: "Fraværsoversikt", icon: "umbrella", view: "month", entities: ["leave", "shift"], desc: "Ferie, fri & egenmeldinger" },
    { id: "demand", name: "Eventer + demand", icon: "ticket", view: "month", entities: ["event", "season", "booking"], desc: "Demand-drivere & sesong" },
    { id: "year", name: "Årshjul-kontekst", icon: "wheel", view: "year", entities: ["season", "event"], desc: "Sesonger & årsplan" },
  ];

  // ---------- filter facets ----------
  const FILTERS = {
    location: { label: "Lokasjon", opts: [["bn", "Bistro Nord"], ["ut", "Uteservering"], ["ev", "Eventlokale"]] },
    dept: { label: "Avdeling", opts: Object.values(DEPT).map(d => [d.id, d.name]) },
    role: { label: "Rolle", opts: [["Driftsleder","Driftsleder"],["Kokk","Kokk"],["Servitør","Servitør"],["Vertinne","Vertinne"],["Bartender","Bartender"]] },
    bstatus: { label: "Bookingstatus", opts: [["confirmed","Bekreftet"],["pending","Avventer"],["seated","Ankommet"],["cancelled","Kansellert"]] },
    lstatus: { label: "Fraværsstatus", opts: [["approved","Godkjent"],["pending","Venter"],["rejected","Avslått"]] },
  };

  // ---------- conflict & coverage intelligence ----------
  // computed-style attention items (kept explicit for the demo)
  const ATTENTION = [
    { id: "a1", sev: "crit", type: "booking", icon: "clock", iso: "5-31",
      title: "Booking utenfor åpningstid", body: "Aas (4 gj.) er satt til 23:00 fredag, men ordinær åpningstid er til 23:00. Eventunntak gjelder til 01:00 — bekreft at bordet skal stå.", ref: "b9",
      action: "Åpne booking" },
    { id: "a2", sev: "crit", type: "shift", icon: "alert", iso: "5-31",
      title: "Underbemannet — fredag kveld", body: "Live jazz gir høy demand 20–01, men det mangler 1 bartender og 1 servitør på kveldsvakten. Dekning 83 %.", ref: "e3",
      action: "Til vaktplan" },
    { id: "a3", sev: "warn", type: "leave", icon: "umbrella", iso: "6-1",
      title: "Fraværskonflikt — Selma lørdag", body: "Selma har søkt permisjon 1/6, men er satt opp 11–19 samme dag — bryllupsdagen med 60 gjester. Avgjør før du svarer på søknaden.", ref: "l3",
      action: "Vurder søknad" },
    { id: "a4", sev: "warn", type: "hours", icon: "door", iso: "6-2",
      title: "Mangler åpningstid", body: "Søndag 2/6 har ingen åpningstid satt. Sett standard (12–22) eller marker som stengt så bookinger valideres riktig.", ref: "6-2",
      action: "Sett åpningstid" },
    { id: "a5", sev: "info", type: "event", icon: "ticket", iso: "5-31",
      title: "Demand-spike: Live jazz", body: "Fredagens event forventes å fylle baren. Botsson foreslår å åpne en ekstra vakt på Vaktbørs.", ref: "e3",
      action: "Se forslag" },
  ];

  // ---------- helpers ----------
  const GRID_START = 8, GRID_END = 25; // 08:00 → 01:00
  const inWeek = (iso) => WEEK.some(w => w.iso === iso);
  const shiftsOn = (iso) => SHIFTS.filter(s => s.iso === iso);
  const bookingsOn = (iso) => BOOKINGS.filter(b => b.iso === iso);
  const eventsOn = (iso) => EVENTS.filter(e => e.iso === iso);
  const leaveOn = (iso) => {
    const wk = WEEK.find(w => w.iso === iso);
    return LEAVE.filter(l => {
      const f = WEEK.find(w => w.iso === l.from), t = WEEK.find(w => w.iso === l.to);
      if (f && t && wk) return wk.wd >= f.wd && wk.wd <= t.wd;
      return l.from === iso;
    });
  };
  const seasonForMonth = (m) => SEASONS.find(s => s.mStart <= s.mEnd ? (m >= s.mStart && m <= s.mEnd) : (m >= s.mStart || m <= s.mEnd));

  // counts per type for a given week (used by filter chips)
  const weekCounts = () => {
    let shift = 0, booking = 0, event = 0, leave = 0;
    WEEK.forEach(w => { shift += shiftsOn(w.iso).length; booking += bookingsOn(w.iso).length; event += eventsOn(w.iso).length; });
    leave = LEAVE.filter(l => inWeek(l.from)).length;
    return { shift, booking, event, leave, hours: 7, season: 1 };
  };

  window.PL = {
    DEPT, STAFF, empById, ETYPE, TYPE_ORDER, WEEK, TODAY_ISO, MONTHS, MONTH_NAMES, isoOf, wdOf, monthMeta, DAYS_IN,
    HOURS_STD, HOURS_EXC, hoursFor, SHIFTS, BOOKINGS, EVENTS, LEAVE, SEASONS, YEAR_PINS,
    BSTATUS, LSTATUS, SRC, DEMAND, SAVED_VIEWS, FILTERS, ATTENTION,
    GRID_START, GRID_END, pad, inWeek, shiftsOn, bookingsOn, eventsOn, leaveOn, seasonForMonth, weekCounts,
  };
})();
