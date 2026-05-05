// Calendar data — Pontus Lindroth, Café Skuta, Mai 2026
// Pontus is a shift leader / sous-chef → sees personal shifts, tasks, deviations,
// and bookings for the venue.

window.CAL = (() => {
  // Departments mirror /day/data.js + design system
  const DEPTS = {
    kjokken: { key: 'kjokken', label: 'Kjøkken', color: '#ee560c' },
    sal:     { key: 'sal',     label: 'Sal',     color: '#00ab93' },
    bar:     { key: 'bar',     label: 'Bar',     color: '#864ad2' },
    event:   { key: 'event',   label: 'Event',   color: '#c18200' },
  };

  // Norwegian short day names (Mon-first)
  const DAY_SHORT = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];
  const DAY_LONG  = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
  const MONTH = 'Mai 2026';

  // Build a 31-day month: Mai 2026 starts on a Friday (May 1).
  // We label days by their weekday index (0=Mon … 6=Sun).
  // May 4 = Monday (the day shown in the screenshot).
  const startWeekday = 4; // May 1 2026 is Friday → index 4
  const daysInMonth = 31;

  function dayMeta(dateNum) {
    const wd = (startWeekday + (dateNum - 1)) % 7;
    return { date: dateNum, weekday: wd, dayShort: DAY_SHORT[wd], dayLong: DAY_LONG[wd], isWeekend: wd >= 5 };
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => dayMeta(i + 1));

  // ── Items ─────────────────────────────────────────────────────────────────
  // Types: shift, task, booking, deviation, note
  // Each has: id, type, date (1-31), title, time, dept, status, … extras
  const items = [
    // ── Mon May 4 (the screenshot day) — "today" baseline -------------------
    { id: 'sh-04-1', type: 'shift', date: 4, title: 'Servitørvakt', dept: 'sal',
      time: '15:00–23:00', role: 'Servitør', zone: 'Sone B',
      status: 'upcoming', planned: 8.0,
      coworkers: ['Bjørn (åpner)', 'Cecilie (lunsj)', 'Dennis (leder)'] },
    { id: 'tk-04-1', type: 'task', date: 4, title: 'Kjøleskap ikke sjekket',
      sub: 'Avvik · prosedyre', time: '17:00', dept: 'kjokken',
      status: 'overdue', priority: 'high',
      desc: 'Daglig temperaturlogg ble ikke fullført på siste vakt. Mål: alle kjølerom under 4 °C. Ta bilde av displayet.',
      evidence: { required: 3, taken: 0 } },
    { id: 'bk-04-1', type: 'booking', date: 4, title: 'Stort selskap i kveld',
      sub: 'Bord 8–12 reservert for 30 pers fra kl 19', time: '19:00–22:00', dept: 'sal',
      status: 'confirmed', guests: 30, tables: '8 · 9 · 10 · 11 · 12',
      contact: 'Ingrid Solheim · 99 88 77 66',
      notes: '2 vegetar, 1 glutenfri. Bursdagskake kommer egen leveranse 18:30.' },

    // ── Tue May 5 — busy lunch + booking -------------------------------------
    { id: 'sh-05-1', type: 'shift', date: 5, title: 'Lunsjvakt', dept: 'kjokken',
      time: '11:00–17:00', role: 'Sous-chef', status: 'upcoming', planned: 6.0 },
    { id: 'tk-05-1', type: 'task', date: 5, title: 'Mottakskontroll Tine',
      sub: 'Lager · åpningsrutine', time: '10:30', dept: 'kjokken', status: 'todo' },
    { id: 'tk-05-2', type: 'task', date: 5, title: 'Allergenkort oppdatering',
      sub: 'Ny fiskerett på menyen', time: '12:00', dept: 'sal', status: 'todo' },
    { id: 'bk-05-1', type: 'booking', date: 5, title: 'Bryllupsplanlegging',
      sub: 'Befaring · brudepar Eriksen', time: '14:00', dept: 'event',
      status: 'confirmed', guests: 2, contact: 'Maria Eriksen' },

    // ── Wed May 6 — off-day with one prep task -------------------------------
    { id: 'tk-06-1', type: 'task', date: 6, title: 'Gjennomgang ny meny',
      sub: 'Egenutvikling · 30 min', dept: 'kjokken', status: 'todo' },
    { id: 'nt-06-1', type: 'note', date: 6, title: 'Fri',
      sub: 'Ingen vakt planlagt', dept: 'sal' },

    // ── Thu May 7 -----------------------------------------------------------
    { id: 'sh-07-1', type: 'shift', date: 7, title: 'Mellomvakt', dept: 'kjokken',
      time: '12:00–20:00', role: 'Sous-chef', status: 'upcoming', planned: 8.0 },
    { id: 'tk-07-1', type: 'task', date: 7, title: 'HMS-runde',
      sub: 'Ukentlig · alle soner', time: '15:00', dept: 'kjokken', status: 'todo' },
    { id: 'tk-07-2', type: 'task', date: 7, title: 'Kontrollere kvalitet fiskefilet',
      sub: 'Med bilde', time: '13:00', dept: 'kjokken', status: 'todo',
      evidence: { required: 2, taken: 0 } },

    // ── Fri May 8 — high-pressure day ---------------------------------------
    { id: 'sh-08-1', type: 'shift', date: 8, title: 'Kveldsvakt', dept: 'kjokken',
      time: '15:00–24:00', role: 'Skiftleder', status: 'upcoming', planned: 9.0,
      isShiftLead: true },
    { id: 'bk-08-1', type: 'booking', date: 8, title: 'Firmamiddag · Telenor',
      sub: '24 pers · 3-retter', time: '18:30', dept: 'sal',
      status: 'confirmed', guests: 24 },
    { id: 'bk-08-2', type: 'booking', date: 8, title: 'Bursdag · Hansen',
      sub: '12 pers', time: '20:00', dept: 'sal',
      status: 'confirmed', guests: 12 },
    { id: 'tk-08-1', type: 'task', date: 8, title: 'Pre-service briefing',
      sub: 'Hele teamet', time: '15:30', dept: 'kjokken', status: 'todo' },
    { id: 'tk-08-2', type: 'task', date: 8, title: 'Avstemming · stempel ut',
      sub: 'Skiftleder-rutine', time: '23:30', dept: 'kjokken', status: 'todo' },

    // ── Sat May 9 -----------------------------------------------------------
    { id: 'sh-09-1', type: 'shift', date: 9, title: 'Helgevakt', dept: 'sal',
      time: '11:00–19:00', role: 'Servitør', status: 'upcoming', planned: 8.0 },
    { id: 'bk-09-1', type: 'booking', date: 9, title: 'Konfirmasjon · Bjerke',
      sub: '40 pers · privat sal', time: '13:00', dept: 'event',
      status: 'confirmed', guests: 40 },

    // ── Sun May 10 — fri ----------------------------------------------------
    { id: 'nt-10-1', type: 'note', date: 10, title: 'Fri',
      sub: 'Ingen vakt planlagt', dept: 'sal' },

    // Misc spots in the month for the month-view to feel alive ----------------
    { id: 'sh-12-1', type: 'shift', date: 12, title: 'Kveldsvakt', dept: 'sal', time: '15:00–23:00', status: 'upcoming', role: 'Servitør', planned: 8 },
    { id: 'sh-13-1', type: 'shift', date: 13, title: 'Mellomvakt', dept: 'kjokken', time: '12:00–20:00', status: 'upcoming', role: 'Sous-chef', planned: 8 },
    { id: 'sh-15-1', type: 'shift', date: 15, title: 'Kveldsvakt', dept: 'kjokken', time: '15:00–24:00', status: 'upcoming', role: 'Skiftleder', planned: 9, isShiftLead: true },
    { id: 'sh-16-1', type: 'shift', date: 16, title: 'Helgevakt', dept: 'sal', time: '11:00–19:00', status: 'upcoming', role: 'Servitør', planned: 8 },
    { id: 'bk-16-1', type: 'booking', date: 16, title: 'Bryllup · Eriksen', sub: '80 pers · hele restauranten', time: '15:00', dept: 'event', status: 'confirmed', guests: 80 },
    { id: 'bk-17-1', type: 'booking', date: 17, title: '17. mai brunch', sub: 'Bordsetting hele dagen', time: '11:00', dept: 'sal', status: 'confirmed', guests: 120 },
    { id: 'sh-17-1', type: 'shift', date: 17, title: 'Festdag-skift', dept: 'kjokken', time: '09:00–17:00', status: 'upcoming', role: 'Sous-chef', planned: 8 },
    { id: 'sh-19-1', type: 'shift', date: 19, title: 'Mellomvakt', dept: 'kjokken', time: '12:00–20:00', status: 'upcoming', role: 'Sous-chef', planned: 8 },
    { id: 'sh-20-1', type: 'shift', date: 20, title: 'Lunsjvakt', dept: 'kjokken', time: '11:00–17:00', status: 'upcoming', role: 'Sous-chef', planned: 6 },
    { id: 'sh-22-1', type: 'shift', date: 22, title: 'Kveldsvakt', dept: 'kjokken', time: '15:00–24:00', status: 'upcoming', role: 'Skiftleder', planned: 9, isShiftLead: true },
    { id: 'sh-23-1', type: 'shift', date: 23, title: 'Helgevakt', dept: 'sal', time: '11:00–19:00', status: 'upcoming', role: 'Servitør', planned: 8 },
    { id: 'bk-23-1', type: 'booking', date: 23, title: 'Privat selskap', sub: '18 pers', time: '19:00', dept: 'sal', status: 'confirmed', guests: 18 },
    { id: 'sh-26-1', type: 'shift', date: 26, title: 'Lunsjvakt', dept: 'kjokken', time: '11:00–17:00', status: 'upcoming', role: 'Sous-chef', planned: 6 },
    { id: 'sh-29-1', type: 'shift', date: 29, title: 'Kveldsvakt', dept: 'kjokken', time: '15:00–24:00', status: 'upcoming', role: 'Skiftleder', planned: 9, isShiftLead: true },
    { id: 'bk-29-1', type: 'booking', date: 29, title: 'Avslutning · NTNU', sub: '60 pers · 4-retters', time: '18:00', dept: 'event', status: 'confirmed', guests: 60 },
    { id: 'sh-30-1', type: 'shift', date: 30, title: 'Helgevakt', dept: 'sal', time: '11:00–19:00', status: 'upcoming', role: 'Servitør', planned: 8 },

    // Some completed history before May 4 (so the user sees the past)
    { id: 'sh-01-1', type: 'shift', date: 1, title: '1. mai · stengt', dept: 'sal',
      time: 'fri', status: 'completed', planned: 0, sub: 'Helligdag — restauranten stengt' },
    { id: 'sh-02-1', type: 'shift', date: 2, title: 'Helgevakt', dept: 'sal',
      time: '11:00–19:00', status: 'completed', actual: 8.2, planned: 8 },
    { id: 'sh-03-1', type: 'shift', date: 3, title: 'Søndagsvakt', dept: 'kjokken',
      time: '12:00–20:00', status: 'completed', actual: 8.0, planned: 8 },
    { id: 'tk-03-1', type: 'task', date: 3, title: 'Stengerutine', sub: '4/4 fullført',
      dept: 'kjokken', status: 'done' },
  ];

  // ── Staff ────────────────────────────────────────────────────────────────
  // The team Pontus works with at Café Skuta.
  const ME = { id: 'pontus', name: 'Pontus L.', role: 'Sous-chef · Skiftleder', dept: 'kjokken', initials: 'PL', color: '#ea7a3b' };
  const STAFF = [
    ME,
    { id: 'cecilie', name: 'Cecilie K.', role: 'Servitør',     dept: 'sal',     initials: 'CK', color: '#00ab93' },
    { id: 'bjorn',   name: 'Bjørn H.',   role: 'Servitør',     dept: 'sal',     initials: 'BH', color: '#1f9d6e' },
    { id: 'dennis',  name: 'Dennis M.',  role: 'Daglig leder', dept: 'sal',     initials: 'DM', color: '#3b86d8' },
    { id: 'maja',    name: 'Maja R.',    role: 'Kokk',         dept: 'kjokken', initials: 'MR', color: '#d8492a' },
    { id: 'henrik',  name: 'Henrik S.',  role: 'Kjøkkensjef',  dept: 'kjokken', initials: 'HS', color: '#864ad2' },
    { id: 'lars',    name: 'Lars T.',    role: 'Bartender',    dept: 'bar',     initials: 'LT', color: '#a86adb' },
    { id: 'silje',   name: 'Silje N.',   role: 'Servitør',     dept: 'sal',     initials: 'SN', color: '#c18200' },
    { id: 'kristin', name: 'Kristin Ø.', role: 'Eventansvarlig', dept: 'event', initials: 'KØ', color: '#e6a82e' },
  ];

  // Assign owners to all existing shifts; Pontus owns kjøkken-skifter,
  // resten distribueres deterministisk for en realistisk vaktliste.
  const OWNERS = {
    'sh-01-1': 'silje',  'sh-02-1': 'cecilie','sh-03-1': 'maja',
    'sh-04-1': 'cecilie','sh-05-1': 'pontus', 'sh-07-1': 'pontus',
    'sh-08-1': 'pontus', 'sh-09-1': 'bjorn',  'sh-12-1': 'silje',
    'sh-13-1': 'maja',   'sh-15-1': 'pontus', 'sh-16-1': 'cecilie',
    'sh-17-1': 'pontus', 'sh-19-1': 'maja',   'sh-20-1': 'pontus',
    'sh-22-1': 'pontus', 'sh-23-1': 'bjorn',  'sh-26-1': 'pontus',
    'sh-29-1': 'pontus', 'sh-30-1': 'silje',
  };

  // Extra team-shifts so Vaktliste / "Alle" føles bemannet
  const teamShifts = [
    // Mon May 4 — full bemanning
    { id: 'sh-04-2', type: 'shift', date: 4, owner: 'pontus',  title: 'Kveldsvakt',   dept: 'kjokken', time: '15:00–23:00', role: 'Sous-chef',     status: 'upcoming', planned: 8 },
    { id: 'sh-04-3', type: 'shift', date: 4, owner: 'maja',    title: 'Kveldsvakt',   dept: 'kjokken', time: '15:00–23:00', role: 'Kokk',          status: 'upcoming', planned: 8 },
    { id: 'sh-04-4', type: 'shift', date: 4, owner: 'henrik',  title: 'Lunsjvakt',    dept: 'kjokken', time: '10:00–16:00', role: 'Kjøkkensjef',   status: 'upcoming', planned: 6 },
    { id: 'sh-04-5', type: 'shift', date: 4, owner: 'bjorn',   title: 'Åpningsvakt',  dept: 'sal',     time: '10:00–16:00', role: 'Servitør',      status: 'upcoming', planned: 6 },
    { id: 'sh-04-6', type: 'shift', date: 4, owner: 'dennis',  title: 'Skiftleder',   dept: 'sal',     time: '14:00–23:00', role: 'Daglig leder',  status: 'upcoming', planned: 9, isShiftLead: true },
    { id: 'sh-04-7', type: 'shift', date: 4, owner: 'lars',    title: 'Barvakt',      dept: 'bar',     time: '17:00–01:00', role: 'Bartender',     status: 'upcoming', planned: 8 },
    // Tue May 5
    { id: 'sh-05-2', type: 'shift', date: 5, owner: 'cecilie', title: 'Lunsjvakt',    dept: 'sal',     time: '11:00–17:00', role: 'Servitør',      status: 'upcoming', planned: 6 },
    { id: 'sh-05-3', type: 'shift', date: 5, owner: 'henrik',  title: 'Lunsjvakt',    dept: 'kjokken', time: '10:00–16:00', role: 'Kjøkkensjef',   status: 'upcoming', planned: 6 },
    { id: 'sh-05-4', type: 'shift', date: 5, owner: 'kristin', title: 'Eventprep',    dept: 'event',   time: '13:00–17:00', role: 'Eventansvarlig', status: 'upcoming', planned: 4 },
    // Thu May 7
    { id: 'sh-07-2', type: 'shift', date: 7, owner: 'cecilie', title: 'Kveldsvakt',   dept: 'sal',     time: '15:00–23:00', role: 'Servitør',      status: 'upcoming', planned: 8 },
    { id: 'sh-07-3', type: 'shift', date: 7, owner: 'lars',    title: 'Barvakt',      dept: 'bar',     time: '17:00–01:00', role: 'Bartender',     status: 'upcoming', planned: 8 },
    // Fri May 8 — høytrykk, fullt skift
    { id: 'sh-08-2', type: 'shift', date: 8, owner: 'maja',    title: 'Kveldsvakt',   dept: 'kjokken', time: '15:00–24:00', role: 'Kokk',          status: 'upcoming', planned: 9 },
    { id: 'sh-08-3', type: 'shift', date: 8, owner: 'henrik',  title: 'Mellomvakt',   dept: 'kjokken', time: '12:00–20:00', role: 'Kjøkkensjef',   status: 'upcoming', planned: 8 },
    { id: 'sh-08-4', type: 'shift', date: 8, owner: 'cecilie', title: 'Kveldsvakt',   dept: 'sal',     time: '15:00–24:00', role: 'Servitør',      status: 'upcoming', planned: 9 },
    { id: 'sh-08-5', type: 'shift', date: 8, owner: 'bjorn',   title: 'Kveldsvakt',   dept: 'sal',     time: '15:00–24:00', role: 'Servitør',      status: 'upcoming', planned: 9 },
    { id: 'sh-08-6', type: 'shift', date: 8, owner: 'silje',   title: 'Kveldsvakt',   dept: 'sal',     time: '17:00–24:00', role: 'Servitør',      status: 'upcoming', planned: 7 },
    { id: 'sh-08-7', type: 'shift', date: 8, owner: 'lars',    title: 'Barvakt',      dept: 'bar',     time: '17:00–02:00', role: 'Bartender',     status: 'upcoming', planned: 9 },
    { id: 'sh-08-8', type: 'shift', date: 8, owner: 'kristin', title: 'Event Telenor', dept: 'event',  time: '17:00–23:00', role: 'Eventansvarlig', status: 'upcoming', planned: 6 },
    // Sat May 9
    { id: 'sh-09-2', type: 'shift', date: 9, owner: 'cecilie', title: 'Helgevakt',    dept: 'sal',     time: '11:00–19:00', role: 'Servitør',      status: 'upcoming', planned: 8 },
    { id: 'sh-09-3', type: 'shift', date: 9, owner: 'maja',    title: 'Helgevakt',    dept: 'kjokken', time: '11:00–19:00', role: 'Kokk',          status: 'upcoming', planned: 8 },
    { id: 'sh-09-4', type: 'shift', date: 9, owner: 'kristin', title: 'Konfirmasjon', dept: 'event',   time: '12:00–18:00', role: 'Eventansvarlig', status: 'upcoming', planned: 6 },
  ];

  // Attach owner to existing items where mapped
  for (const it of items) {
    if (it.type === 'shift' && OWNERS[it.id]) it.owner = OWNERS[it.id];
  }
  items.push(...teamShifts);

  // The "today" date (matches screenshot)
  const TODAY = 4;

  // Personal stats per day
  function dayStats(date) {
    const its = items.filter(i => i.date === date);
    return {
      tasks:   its.filter(i => i.type === 'task'),
      shifts:  its.filter(i => i.type === 'shift'),
      bookings: its.filter(i => i.type === 'booking'),
      notes:   its.filter(i => i.type === 'note'),
      all: its,
    };
  }

  function staffById(id) { return STAFF.find(s => s.id === id) || null; }

  return { DEPTS, DAY_SHORT, DAY_LONG, MONTH, days, items, TODAY, dayStats, STAFF, ME, staffById };
})();
