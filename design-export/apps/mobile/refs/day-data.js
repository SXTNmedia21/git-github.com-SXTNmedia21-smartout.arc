// Mock data — Dag-informasjon prototype
// Café Skuta · Kjøkken · Mandag 19. april 2026
// Anna Olsen (ansatt) + Marcus Lien (leder) + Pontus Sjögren (admin)

const SESSION = {
  id: "ses-2026-04-19-kjokken",
  date: "2026-04-19",
  dayLong: "Mandag",
  dayNum: "19",
  month: "april",
  year: "2026",
  relativeLabel: "I dag",
  dept: "Kjøkken",
  deptKey: "kjokken",
  location: "Café Skuta",
  plannedOpen: "11:00",
  plannedClose: "23:00",
  openedAt: "10:58",
  closedAt: null,
  graceMinutes: 15,
  openedBy: { name: "Bjørn Tandberg", role: "Sous-chef", time: "10:58" },
  signoffNotes: "",
};

const PHASES = {
  upcoming:        { key: "upcoming",        label: "Starter snart",      tone: "neutral", icon: "clock",     help: "Starter 11:00 — om 2t 28m" },
  active:          { key: "active",          label: "Pågår",              tone: "active",  icon: "zap",       help: "Åpnet 10:58 · pågått 3t 34m" },
  pending_signoff: { key: "pending_signoff", label: "Venter på oppgjør",  tone: "warn",    icon: "check",     help: "Siste ut 23:12 · venter på Marcus" },
  closed:          { key: "closed",          label: "Stengt",             tone: "neutral", icon: "archive",   help: "Stengt 23:47 · admin-oppgjør neste" },
  missed:          { key: "missed",          label: "Ikke åpnet",         tone: "error",   icon: "alert",     help: "Skulle åpnet 11:00 · grace 15m overskredet" },
  locked:          { key: "locked",          label: "Låst",               tone: "brand",   icon: "lock",      help: "Låst av Pontus · 20. april 08:14" },
};

const KPIS = [
  { key: "revenue",    label: "Omsetning",  value: "87 400", unit: "kr", planned: "84 000 kr", delta: "+4.0%",  deltaDir: "up",   sub: "Mål 84 000 kr" },
  { key: "hours",      label: "Arbeidstid", value: "42.5",   unit: "t",  planned: "41.0t",     delta: "+1.5t",  deltaDir: "down", sub: "Planlagt 41.0t" },
  { key: "laborcost",  label: "Lønn",       value: "11 900", unit: "kr", planned: "12 500 kr", delta: "−4.8%",  deltaDir: "up",   sub: "Under budsjett" },
  { key: "laborpct",   label: "Labor %",    value: "13.6",   unit: "%",  planned: "15% mål",   delta: "−1.4pp", deltaDir: "up",   sub: "Mål 15%" },
  { key: "tasksdone",  label: "Oppgaver",   value: "22",     unit: "/ 25", sub: "3 overført" },
  { key: "deviations", label: "Avvik",      value: "1",      unit: "åpne", sub: "1 løst" },
];

const SHIFTS = [
  { id: "s1", name: "Marcus Lien",    role: "Kjøkkensjef",    initials: "ML", dept: "kjokken", start: "08:00", end: "16:00", status: "completed", live: false, break: null,  planned: 8.0, actual: 8.0 },
  { id: "s2", name: "Bjørn Tandberg", role: "Sous-chef",      initials: "BT", dept: "kjokken", start: "10:58", end: "19:00", status: "active",    live: true,  break: null,  planned: 8.0, actual: 3.6 },
  { id: "s3", name: "Cecilie Ruud",   role: "Kokk",           initials: "CR", dept: "kjokken", start: "12:00", end: "20:00", status: "active",    live: true,  break: "pause", planned: 7.5, actual: 2.5 },
  { id: "s4", name: "Anna Olsen",     role: "Servitør",       initials: "AO", dept: "sal",     start: "15:00", end: "23:00", status: "upcoming",  live: false, break: null,  planned: 8.0, actual: 0, isMe: true },
  { id: "s5", name: "Dennis Hauge",   role: "Manager",        initials: "DH", dept: "sal",     start: "08:00", end: "18:00", status: "active",    live: true,  break: null,  planned: 9.0, actual: 6.6 },
  { id: "s6", name: "Henrik Strøm",   role: "Kokkelærling",   initials: "HS", dept: "kjokken", start: "15:00", end: "23:00", status: "upcoming",  live: false, break: null,  planned: 8.0, actual: 0 },
  { id: "s7", name: "Nora Berg",      role: "Oppvasker",      initials: "NB", dept: "kjokken", start: "17:00", end: "23:00", status: "upcoming",  live: false, break: null,  planned: 6.0, actual: 0 },
];

const HOOKS = [
  {
    id: "h1", type: "pre_open", title: "Åpningsrutine", time: "10:30", offset: "−30m", state: "completed", progress: "5/5",
    tasks: [
      { id: "t1", title: "Sjekk kjølerom temperatur",      owner: "Bjørn",   done: true,  compliance: true,  note: "Alle under 4°C" },
      { id: "t2", title: "Tørk bord og stoler",            owner: "Bjørn",   done: true,  compliance: false },
      { id: "t3", title: "Sett opp kasseapparat",          owner: "Marcus",  done: true,  compliance: false },
      { id: "t4", title: "Tenn stearinlys",                owner: "Bjørn",   done: true,  compliance: false },
      { id: "t5", title: "Slipp ut dagens meny på tavle",  owner: "Marcus",  done: true,  compliance: false },
    ],
  },
  {
    id: "h2", type: "open", title: "Åpningssjekk", time: "11:00", offset: "0m", state: "completed", progress: "2/2",
    tasks: [
      { id: "t6", title: "Hygienerunde gulv og benker",    owner: "Cecilie", done: true, compliance: true, evidence: "3/3 bilder" },
      { id: "t7", title: "Allergenkort synlig på bar",     owner: "Bjørn",   done: true, compliance: true },
    ],
  },
  {
    id: "h3", type: "scheduled", title: "Lunsj-prep", time: "12:00", offset: "+1t", state: "in_progress", progress: "2/4",
    tasks: [
      { id: "t8",  title: "Forberede dagens suppe",        owner: "Cecilie", done: true,  compliance: false },
      { id: "t9",  title: "Salat-mise en place",           owner: "Bjørn",   done: true,  compliance: false },
      { id: "t10", title: "Svinekjøtt prep til middag",    owner: "Cecilie", done: false, compliance: false, active: true },
      { id: "t11", title: "Kontrollere kvalitet fiskefilet", owner: "Bjørn", done: false, compliance: true, evidence: "0/2 bilder" },
    ],
  },
  {
    id: "h4", type: "scheduled", title: "Kveldsservering", time: "17:00", offset: "+6t", state: "upcoming", progress: "0/3",
    tasks: [
      { id: "t12", title: "Mise en place middag",          owner: "Henrik", done: false, compliance: false },
      { id: "t13", title: "Temperaturlogg kl 18",          owner: "Anna",   done: false, compliance: true },
      { id: "t14", title: "Sett opp nattskift-checklist",  owner: "Marcus", done: false, compliance: false },
    ],
  },
  {
    id: "h5", type: "pre_close", title: "Stengerutine", time: "22:30", offset: "−30m", state: "upcoming", progress: "0/4",
    tasks: [
      { id: "t15", title: "Rengjøring grill og fett-trap", owner: "Henrik", done: false, compliance: true },
      { id: "t16", title: "Temperaturlogg kjøleskap",      owner: "Nora",   done: false, compliance: true, evidence: "0/3 bilder" },
      { id: "t17", title: "Kontanttelling",                owner: "Marcus", done: false, compliance: false },
      { id: "t18", title: "Låse bakdør og sette alarm",    owner: "Marcus", done: false, compliance: false },
    ],
  },
];

const DEVIATIONS = [
  {
    id: "dv1", severity: "high", type: "Temperatur", status: "open",
    title: "Kjølerom 2 over grenseverdi 20 min",
    desc: "Temperatur nådde 9.2°C kl 13:45. Anna Olsen oppdaget ved rutinesjekk. Varer flyttet til kjølerom 3. Kompressor kontrolleres av tekniker.",
    reporter: "Anna Olsen", time: "13:45", photos: 3, assignedTo: "Marcus Lien",
  },
  {
    id: "dv2", severity: "medium", type: "Hygiene", status: "resolved",
    title: "Manglende håndvask-logg kl 12",
    desc: "Cecilie noterte pause uten å oppdatere logg. Manuelt ført inn av Bjørn i ettertid.",
    reporter: "System", time: "12:14", photos: 0, assignedTo: "Bjørn Tandberg", resolvedBy: "Bjørn", resolvedAt: "12:28",
  },
];

const BROADCASTS = [
  { id: "b1", type: "note",   author: "Marcus Lien", role: "Kjøkkensjef",    time: "09:12", title: "Lunsj-gjest: bordbestilling 14", body: "Familie på 8, to barn, en vegetar. Sett av stort bord ved vindu." },
  { id: "b2", type: "alert",  author: "Pontus Sjögren", role: "Admin",         time: "08:30", title: "Leverandør forsinket 30min", body: "Tine-lastebilen kommer 10:30 i stedet for 10:00. Planlegg prep deretter." },
  { id: "b3", type: "reminder", author: "System",    role: "Auto",             time: "11:00", title: "Husk allergen-oppdatering", body: "Ny fiskerett på menyen — sjekk at allergenkort er synlig." },
];

// Personal (Anna Olsen's) week
const MY_WEEK = [
  { date: "2026-04-13", dayShort: "Man", dayNum: "13", hasShift: false, label: "Ingen vakt" },
  { date: "2026-04-14", dayShort: "Tir", dayNum: "14", hasShift: true,  start: "11:00", end: "19:00", dept: "Kjøkken", role: "Servitør" },
  { date: "2026-04-15", dayShort: "Ons", dayNum: "15", hasShift: false, label: "Ingen vakt" },
  { date: "2026-04-16", dayShort: "Tor", dayNum: "16", hasShift: true,  start: "15:00", end: "23:00", dept: "Bar",     role: "Servitør" },
  { date: "2026-04-17", dayShort: "Fre", dayNum: "17", hasShift: true,  start: "15:00", end: "23:00", dept: "Kjøkken", role: "Servitør" },
  { date: "2026-04-18", dayShort: "Lør", dayNum: "18", hasShift: true,  start: "10:00", end: "18:00", dept: "Kjøkken", role: "Servitør", done: true },
  { date: "2026-04-19", dayShort: "Søn", dayNum: "19", hasShift: true,  start: "15:00", end: "23:00", dept: "Kjøkken", role: "Servitør", isToday: true },
];

// My personal timer (during-view)
const MY_SHIFT = {
  start: "15:00", end: "23:00",
  clockedInAt: "14:58",
  elapsed: "03:34:15",      // stored only for the static screenshot; real timer ticks
  earned: 892,               // NOK
  rate: 255,                 // NOK/t
  bonus: 29,                 // kr tillegg
  hoursSoFar: 3.5,
  role: "Servitør", zone: "Sone B", dept: "Kjøkken",
  breakTaken: 0,
  colleagues: ["Bjørn (åpner)", "Cecilie (lunsj)", "Dennis (leder)"],
};

// Week-grid for web day control (reconciliation list)
const WEEK_GRID = [
  { id: "d-mon", date: "2026-04-19", day: "Man", status: "active",          revenue: null,    labor: null },
  { id: "d-tue", date: "2026-04-20", day: "Tir", status: "upcoming",        revenue: null,    labor: null },
  { id: "d-wed", date: "2026-04-21", day: "Ons", status: "upcoming",        revenue: null,    labor: null },
  { id: "d-thu", date: "2026-04-22", day: "Tor", status: "upcoming",        revenue: null,    labor: null },
  { id: "d-fri", date: "2026-04-23", day: "Fre", status: "upcoming",        revenue: null,    labor: null },
  { id: "d-sat", date: "2026-04-24", day: "Lør", status: "upcoming",        revenue: null,    labor: null },
  { id: "d-sun", date: "2026-04-25", day: "Søn", status: "upcoming",        revenue: null,    labor: null },
];

const RECON_LIST = [
  { date: "19. apr", dept: "Kjøkken", revenue: null,    laborPct: null, status: "active" },
  { date: "19. apr", dept: "Bar",     revenue: null,    laborPct: null, status: "active" },
  { date: "18. apr", dept: "Kjøkken", revenue: 91200,   laborPct: 13.1, status: "pending_signoff" },
  { date: "18. apr", dept: "Bar",     revenue: 26500,   laborPct: 18.9, status: "closed" },
  { date: "17. apr", dept: "Kjøkken", revenue: 94200,   laborPct: 14.2, status: "closed" },
  { date: "17. apr", dept: "Bar",     revenue: 23100,   laborPct: 21.8, status: "closed" },
  { date: "16. apr", dept: "Kjøkken", revenue: 81900,   laborPct: 14.8, status: "locked" },
  { date: "16. apr", dept: "Bar",     revenue: 21400,   laborPct: 22.4, status: "locked" },
  { date: "15. apr", dept: "Kjøkken", revenue: 76800,   laborPct: 15.2, status: "locked" },
  { date: "14. apr", dept: "Kjøkken", revenue: null,    laborPct: null, status: "missed" },
];

window.DATA = { SESSION, PHASES, KPIS, SHIFTS, HOOKS, DEVIATIONS, BROADCASTS, MY_WEEK, MY_SHIFT, WEEK_GRID, RECON_LIST };
