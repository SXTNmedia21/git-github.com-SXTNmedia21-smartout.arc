/* Mock data — Hotell Sentralen, Oslo. Lør 23. mai 2026. Multi-outlet hotel restaurant. */
(function() {
const OUTLET = {
  property: "Hotell Sentralen",
  city: "Oslo",
  date: "Lørdag 23. mai 2026",
  shortDate: "Lør 23. mai",
  weekno: 21,
  // "now" anchor in minutes from 06:00 (i.e. day start). 14:35 → 8h35m → 515 min
  nowMinutes: 8 * 60 + 35,
};

// Areas (day_lines). Each has open/close hours in HH:MM and a color token.
const AREAS = [
  {
    id: "frokost",
    name: "Frokost Café",
    short: "FROKOST",
    open: "06:00",
    close: "11:00",
    color: "dept-event",
    icon: "utensils-crossed",
    capacity: 60,
  },
  {
    id: "kitchen",
    name: "Kjøkken",
    short: "KJØKKEN",
    open: "07:00",
    close: "23:30",
    color: "dept-kitchen",
    icon: "utensils-crossed",
    capacity: null,
  },
  {
    id: "bistro",
    name: "Bistro Nord",
    short: "BISTRO",
    open: "11:00",
    close: "23:00",
    color: "dept-floor",
    icon: "utensils-crossed",
    capacity: 48,
  },
  {
    id: "spisesal",
    name: "Grand Spisesal",
    short: "SPISESAL",
    open: "17:00",
    close: "23:30",
    color: "dept-floor",
    icon: "utensils-crossed",
    capacity: 84,
  },
  {
    id: "bar",
    name: "Bar Aurora",
    short: "BAR",
    open: "15:00",
    close: "02:00",
    color: "dept-bar",
    icon: "wine",
    capacity: 36,
  },
  {
    id: "event",
    name: "Fjorden Eventsal",
    short: "FJORDEN",
    open: "18:00",
    close: "01:00",
    color: "dept-event",
    icon: "users",
    capacity: 120,
    booked: "Bryllup Andersen · 22 pax",
  },
];

// Routine segments — service-phase ribbons across the full day
const ROUTINE = [
  { id: "r1", label: "Rigg & prep", start: "06:00", end: "07:30", tone: "phase-prep" },
  { id: "r2", label: "Frokostservice", start: "07:30", end: "11:00", tone: "phase-service" },
  { id: "r3", label: "Bytteomgang", start: "11:00", end: "11:30", tone: "phase-bridge" },
  { id: "r4", label: "Lunsj", start: "11:30", end: "14:30", tone: "phase-service" },
  { id: "r5", label: "Mellomrom · prep middag", start: "14:30", end: "17:00", tone: "phase-prep" },
  { id: "r6", label: "Middagsservice", start: "17:00", end: "22:30", tone: "phase-service-warm" },
  { id: "r7", label: "Bar & kveld", start: "22:30", end: "01:30", tone: "phase-late" },
  { id: "r8", label: "Stengt · oppvask", start: "01:30", end: "02:00", tone: "phase-close" },
];

// Employees with role + assigned area
const EMPLOYEES = [
  // Frokost (early)
  { id: "helene", name: "Helene Strand", role: "Frokostkokk", area: "frokost", shift: ["06:00", "11:30"], img: null, lvl: "active" },
  { id: "oskar", name: "Oskar Lund", role: "Servitør", area: "frokost", shift: ["06:30", "11:30"], img: null, lvl: "active" },

  // Kjøkken
  { id: "mathias", name: "Mathias Berg", role: "Kjøkkensjef", area: "kitchen", shift: ["08:00", "22:00"], img: null, lvl: "active" },
  { id: "yusra", name: "Yusra Ali", role: "Sous chef", area: "kitchen", shift: ["10:00", "22:30"], img: null, lvl: "active" },
  { id: "aino", name: "Aino Virtanen", role: "Kokk", area: "kitchen", shift: ["11:00", "23:00"], img: null, lvl: "active" },
  { id: "petter", name: "Petter Holm", role: "Kokk lærling", area: "kitchen", shift: ["06:00", "14:30"], img: null, lvl: "trainee" },
  { id: "magnus", name: "Magnus Vik", role: "Oppvask", area: "kitchen", shift: ["14:00", "00:30"], img: null, lvl: "active" },

  // Sal
  { id: "even", name: "Even Sørli", role: "Servitør", area: "bistro", shift: ["11:00", "20:00"], img: null, lvl: "active" },
  { id: "klara", name: "Klara Dahl", role: "Servitør", area: "bistro", shift: ["16:00", "23:30"], img: null, lvl: "active" },
  { id: "lin", name: "Lin Tran", role: "Hostess", area: "spisesal", shift: ["16:30", "23:00"], img: null, lvl: "active" },

  // Bar
  { id: "nora", name: "Nora Eikrem", role: "Bartender", area: "bar", shift: ["15:00", "23:00"], img: null, lvl: "active" },
  { id: "rashid", name: "Rashid Karim", role: "Bartender", area: "bar", shift: ["19:00", "02:00"], img: null, lvl: "active" },

  // Event
  { id: "tomas", name: "Tomás Reyes", role: "Eventsjef", area: "event", shift: ["15:00", "01:00"], img: null, lvl: "active" },
  { id: "isa", name: "Isa Solli", role: "Servitør event", area: "event", shift: ["18:00", "01:00"], img: null, lvl: "active" },
];

// Tasks at slots — referenced by employee id OR area id (unassigned).
// status: "done" | "active" | "upcoming" | "overdue" | "skipped"
// priority: "urgent" | "high" | "normal" | "low"
const TASKS = [
  // FROKOST
  { id: "t1", area: "frokost", emp: "helene", title: "Frokostbuffet rigg", start: "06:00", end: "07:00", status: "done", priority: "normal" },
  { id: "t2", area: "frokost", emp: "oskar", title: "Åpne dører + kaffe-stasjon", start: "06:45", end: "07:15", status: "done", priority: "normal" },
  { id: "t3", area: "frokost", emp: "helene", title: "Påfyll varme retter", start: "08:30", end: "09:00", status: "done", priority: "normal" },
  { id: "t4", area: "frokost", emp: "oskar", title: "Rydding etter frokost", start: "11:00", end: "11:30", status: "done", priority: "low" },

  // KJØKKEN
  { id: "t5", area: "kitchen", emp: "petter", title: "Mise en place lunsj", start: "10:30", end: "11:30", status: "done", priority: "high" },
  { id: "t6", area: "kitchen", emp: "mathias", title: "Bytteomgang frokost→lunsj", start: "11:00", end: "11:30", status: "done", priority: "high" },
  { id: "t7", area: "kitchen", emp: "yusra", title: "Sjekk mise en place sal", start: "12:30", end: "12:45", status: "done", priority: "normal" },
  { id: "t8", area: "kitchen", emp: "magnus", title: "Inntak vareleveranse", start: "14:15", end: "14:45", status: "active", priority: "high" },
  { id: "t9", area: "kitchen", emp: "aino", title: "Prep middag — fisk", start: "14:45", end: "16:30", status: "upcoming", priority: "normal" },
  { id: "t10", area: "kitchen", emp: "yusra", title: "Sauser + dressing", start: "15:30", end: "17:00", status: "upcoming", priority: "normal" },
  { id: "t11", area: "kitchen", emp: "mathias", title: "Briefing kjøkkencrew", start: "16:30", end: "16:50", status: "upcoming", priority: "high" },
  { id: "t12", area: "kitchen", emp: "petter", title: "HACCP — kjøletemp runde", start: "13:00", end: "13:15", status: "done", priority: "normal", flagged: "avvik" },

  // BISTRO
  { id: "t13", area: "bistro", emp: "even", title: "Lunsj-oppdekk + meny", start: "11:00", end: "11:30", status: "done", priority: "normal" },
  { id: "t14", area: "bistro", emp: "even", title: "Lunsjservice", start: "11:30", end: "14:30", status: "done", priority: "normal" },
  { id: "t15", area: "bistro", emp: "even", title: "Oppdekk middag", start: "16:00", end: "17:00", status: "upcoming", priority: "normal" },
  { id: "t16", area: "bistro", emp: "klara", title: "Vinkurs · 8 gjester", start: "18:30", end: "19:30", status: "upcoming", priority: "high" },

  // SPISESAL
  { id: "t17", area: "spisesal", emp: "lin", title: "Reservasjonsoversikt", start: "16:30", end: "17:00", status: "upcoming", priority: "normal" },
  { id: "t18", area: "spisesal", emp: null, title: "Sjekk linskap + servietter", start: "17:00", end: "17:30", status: "upcoming", priority: "low" },

  // BAR
  { id: "t19", area: "bar", emp: "nora", title: "Bar-rigg + cocktail-prep", start: "15:00", end: "16:30", status: "upcoming", priority: "normal" },
  { id: "t20", area: "bar", emp: "nora", title: "Vinkurs cocktail-pairing", start: "18:30", end: "19:30", status: "upcoming", priority: "high" },
  { id: "t21", area: "bar", emp: "rashid", title: "Bytteomgang kveld", start: "22:30", end: "23:00", status: "upcoming", priority: "normal" },

  // EVENT
  { id: "t22", area: "event", emp: "tomas", title: "Briefing eventcrew", start: "15:30", end: "16:00", status: "upcoming", priority: "high" },
  { id: "t23", area: "event", emp: "tomas", title: "Oppdekk Fjorden · bryllup", start: "16:00", end: "18:00", status: "upcoming", priority: "urgent" },
  { id: "t24", area: "event", emp: "isa", title: "Bryllup Andersen · velkomst", start: "19:00", end: "20:00", status: "upcoming", priority: "high" },
  { id: "t25", area: "event", emp: "isa", title: "Hovedrett · 22 pax", start: "20:00", end: "21:30", status: "upcoming", priority: "high" },
];

// Deviations (avvik) — anchored by time + area
const DEVIATIONS = [
  { id: "d1", area: "kitchen", time: "14:12", title: "Kjøletemp brudd · skap 3", severity: "high", status: "open", reporter: "petter" },
  { id: "d2", area: "bistro", time: "12:55", title: "Glass i sal — gjest", severity: "normal", status: "resolved", reporter: "even" },
];

// Broadcasts / notes — manager → staff
const NOTES = [
  { id: "n1", time: "08:10", from: "Sofia", scope: "Alle", text: "God morgen — full bemanning i dag." },
  { id: "n2", time: "11:45", from: "Sofia", scope: "Kjøkken + Sal", text: "Dagens spes: glutenfri lasagne. Kom fram til Mathias før service." },
  { id: "n3", time: "14:00", from: "Sofia", scope: "Kjøkken + Event", text: "Storgruppe kl 19 — 22 pax på Fjorden. Bekreftet fisk for 4 gjester." },
];

// Templates available to apply on day_line
const TEMPLATES = [
  { id: "tpl1", name: "Standard helg · Bistro", tasks: 14, used: 23 },
  { id: "tpl2", name: "Frokostservice 06–11", tasks: 8, used: 188 },
  { id: "tpl3", name: "Eventkveld · 20–60 pax", tasks: 19, used: 11 },
  { id: "tpl4", name: "Lav bemanning · søndag", tasks: 11, used: 7 },
];

// Role-anchored fixed tasks — these belong to a ROLE, not a person.
// When someone is on shift in that role, they pick these up.
const ROLES = [
  { id: 'frokostkokk', label: 'Frokostkokk',  area: 'frokost',  color: 'dept-event' },
  { id: 'kjokkensjef', label: 'Kjøkkensjef',  area: 'kitchen',  color: 'dept-kitchen' },
  { id: 'souschef',    label: 'Sous chef',    area: 'kitchen',  color: 'dept-kitchen' },
  { id: 'kokk',        label: 'Kokk',         area: 'kitchen',  color: 'dept-kitchen' },
  { id: 'oppvask',     label: 'Oppvask',      area: 'kitchen',  color: 'dept-storage' },
  { id: 'servitor',    label: 'Servitør',     area: 'bistro',   color: 'dept-floor' },
  { id: 'hostess',     label: 'Hostess',      area: 'spisesal', color: 'dept-floor' },
  { id: 'bartender',   label: 'Bartender',    area: 'bar',      color: 'dept-bar' },
  { id: 'eventsjef',   label: 'Eventsjef',    area: 'event',    color: 'dept-event' },
];

// Fixed tasks per role (the "rolltask" library — what each role *always* does on a shift)
const ROLE_TASKS = [
  // Frokostkokk
  { id: 'rt1', role: 'frokostkokk', title: 'Rigg frokostbuffet', start: '06:00', end: '07:00', recurring: 'hver dag' },
  { id: 'rt2', role: 'frokostkokk', title: 'Påfyll varme retter', start: '08:30', end: '09:00', recurring: 'hver dag' },
  { id: 'rt3', role: 'frokostkokk', title: 'Bytteomgang frokost → lunsj', start: '11:00', end: '11:30', recurring: 'hver dag' },
  { id: 'rt4', role: 'frokostkokk', title: 'Rydd buffet', start: '10:30', end: '11:00', recurring: 'hver dag' },

  // Kjøkkensjef
  { id: 'rt5', role: 'kjokkensjef', title: 'Sjekk vareleveranse', start: '08:30', end: '09:00', recurring: 'hver dag' },
  { id: 'rt6', role: 'kjokkensjef', title: 'Briefing kjøkkencrew', start: '10:30', end: '10:50', recurring: 'hver dag' },
  { id: 'rt7', role: 'kjokkensjef', title: 'HACCP-runde', start: '13:00', end: '13:30', recurring: 'hver dag' },
  { id: 'rt8', role: 'kjokkensjef', title: 'Briefing kveldsservice', start: '16:30', end: '16:50', recurring: 'hver dag' },

  // Sous chef
  { id: 'rt9', role: 'souschef', title: 'Mise en place lunsj', start: '10:00', end: '11:30', recurring: 'hver dag' },
  { id: 'rt10', role: 'souschef', title: 'Sauser + dressing middag', start: '15:30', end: '17:00', recurring: 'hver dag' },

  // Kokk
  { id: 'rt11', role: 'kokk', title: 'Prep middag', start: '14:30', end: '16:30', recurring: 'hver dag' },
  { id: 'rt12', role: 'kokk', title: 'Service kjøkken', start: '17:00', end: '22:00', recurring: 'hver dag' },

  // Oppvask
  { id: 'rt13', role: 'oppvask', title: 'Inntak vareleveranse', start: '14:15', end: '14:45', recurring: 'hver dag' },
  { id: 'rt14', role: 'oppvask', title: 'Oppvask service', start: '17:00', end: '23:00', recurring: 'hver dag' },
  { id: 'rt15', role: 'oppvask', title: 'Avsluttende rengjøring', start: '23:00', end: '00:30', recurring: 'hver dag' },

  // Servitør
  { id: 'rt16', role: 'servitor', title: 'Lunsj-oppdekk', start: '11:00', end: '11:30', recurring: 'hver dag' },
  { id: 'rt17', role: 'servitor', title: 'Lunsjservice', start: '11:30', end: '14:30', recurring: 'hver dag' },
  { id: 'rt18', role: 'servitor', title: 'Oppdekk middag', start: '16:00', end: '17:00', recurring: 'hver dag' },
  { id: 'rt19', role: 'servitor', title: 'Middagsservice', start: '17:00', end: '22:00', recurring: 'hver dag' },

  // Hostess
  { id: 'rt20', role: 'hostess', title: 'Reservasjons-gjennomgang', start: '16:30', end: '17:00', recurring: 'hver dag' },
  { id: 'rt21', role: 'hostess', title: 'Velkomst middag', start: '17:00', end: '22:30', recurring: 'hver dag' },

  // Bartender
  { id: 'rt22', role: 'bartender', title: 'Bar-rigg + cocktail-prep', start: '15:00', end: '16:30', recurring: 'hver dag' },
  { id: 'rt23', role: 'bartender', title: 'Service bar', start: '16:30', end: '22:30', recurring: 'hver dag' },
  { id: 'rt24', role: 'bartender', title: 'Bytteomgang', start: '22:30', end: '23:00', recurring: 'ved bytte' },
  { id: 'rt25', role: 'bartender', title: 'Kassetelling + rapport', start: '01:30', end: '02:00', recurring: 'hver dag' },

  // Eventsjef
  { id: 'rt26', role: 'eventsjef', title: 'Briefing eventcrew', start: '15:30', end: '16:00', recurring: 'ved booking' },
  { id: 'rt27', role: 'eventsjef', title: 'Oppdekk Fjorden', start: '16:00', end: '18:00', recurring: 'ved booking' },
  { id: 'rt28', role: 'eventsjef', title: 'Service event', start: '19:00', end: '23:00', recurring: 'ved booking' },
];

window.TimelineData = { OUTLET, AREAS, ROUTINE, EMPLOYEES, TASKS, DEVIATIONS, NOTES, TEMPLATES, ROLES, ROLE_TASKS };

// ─── helpers ────────────────────────────────────────────────
function hmToMin(s) {
  // accepts "HH:MM" or "HH:MM next-day" — values > "06:00" are same day; otherwise +24h
  const [h, m] = s.split(":").map(Number);
  let t = h * 60 + m;
  // Day starts at 06:00 → anything 00:00–05:59 is next-day (+24*60)
  if (t < 6 * 60) t += 24 * 60;
  return t - 6 * 60; // minutes from day start
}
function minToHM(min) {
  const t = (min + 6 * 60) % (24 * 60);
  const h = Math.floor(t / 60), m = t % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
window.hmToMin = hmToMin;
window.minToHM = minToHM;
})();
