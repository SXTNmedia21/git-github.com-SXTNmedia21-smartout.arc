// ===== Smartout — Kommunikasjon (broadcast / channels) data model =====
// Extends window.SmartoutData with the communication domain.
// Mirrors the established conventions: plain script (loads before babel files),
// extends SmartoutData, reuses the org model from ansatte-data.js (DEPARTMENTS,
// TEAMS, LOCATIONS, ACCESS_LEVELS, EMPLOYEES, EMP_BY_ID) when present.
//
// Vocabulary (uploads/OVERVIEW.md): Avdeling=department · Område=location ·
//   Lag=team · Tilgangsnivå=access level (Ansatt/Leder/Admin/Eier).
//
// Surfaces this powers: Nyheter/Kunngjøringer feed (manager broadcasts, pinned,
//   read receipts), Kanaler (topic/department channels), compose/edit with
//   audience targeting, and channel management (members + permissions).
//
// This is the broadcast/news surface. The 1:1 / group chat (Meldinger) lives in
// the shell as a separate overlay (ChatPanel) — kept deliberately apart.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ---------- defensive org fallbacks (if ansatte-data.js is absent) ----------
  const DEPARTMENTS = D.DEPARTMENTS || {
    kjokken: { id: "kjokken", name: "Kjøkken", color: "#ee560c", leader: "jh" },
    sal: { id: "sal", name: "Sal", color: "#00ab93", leader: "ma" },
    bar: { id: "bar", name: "Bar", color: "#864ad2", leader: "ma" },
    event: { id: "event", name: "Event", color: "#c18200", leader: "ma" },
    lager: { id: "lager", name: "Lager", color: "#008388", leader: "es" },
    admin: { id: "admin", name: "Admin", color: "#7a756e", leader: "es" },
  };
  const TEAMS = D.TEAMS || {
    "lag-kveld": { id: "lag-kveld", name: "Kjøkken kveld", dept: "kjokken", leader: "jh" },
    "lag-helg": { id: "lag-helg", name: "Sal helg", dept: "sal", leader: "ma" },
    "lag-event": { id: "lag-event", name: "Eventcrew", dept: "event", leader: "ma" },
  };
  const LOCATIONS = D.LOCATIONS || {
    "loc-rest": { id: "loc-rest", name: "Restaurant" },
    "loc-ute": { id: "loc-ute", name: "Uteservering" },
    "loc-event": { id: "loc-event", name: "Eventlokale" },
    "loc-kjk": { id: "loc-kjk", name: "Kjøkken" },
    "loc-lager": { id: "loc-lager", name: "Lager & mottak" },
  };
  const ACCESS_LEVELS = D.ACCESS_LEVELS || {
    employee: { id: "employee", label: "Ansatt", tone: "muted" },
    manager: { id: "manager", label: "Leder", tone: "info" },
    admin: { id: "admin", label: "Admin", tone: "purple" },
    owner: { id: "owner", label: "Eier", tone: "orange" },
  };

  // ---------- roster (read-receipt + audience population) ----------
  // Use the canonical employee model when present; otherwise a compact roster of
  // the Bistro Nord cast so the surface is self-sufficient.
  let PEOPLE;
  if (Array.isArray(D.EMPLOYEES) && D.EMPLOYEES.length) {
    PEOPLE = D.EMPLOYEES.map((e) => ({
      id: e.id, name: e.display || e.name, initials: e.initials, color: e.color,
      role: e.stilling, dept: e.placement ? e.placement.primary : "admin",
      depts: e.placement ? e.placement.depts : [e.placement && e.placement.primary].filter(Boolean),
      team: e.placement ? e.placement.team : null,
      locations: e.placement ? e.placement.locations : [],
      access: e.access || "employee", lifecycle: e.lifecycle || "active",
      onDuty: ["ma", "jh", "sl", "ib"].includes(e.id),
    }));
  } else {
    PEOPLE = [
      { id: "ma", name: "Maria A.", initials: "MA", color: "#FF7849", role: "Driftsleder", dept: "admin", depts: ["admin", "sal", "bar"], team: "lag-helg", locations: ["loc-rest"], access: "admin", lifecycle: "active", onDuty: true },
      { id: "es", name: "Erik S.", initials: "ES", color: "#2784d5", role: "Daglig leder", dept: "admin", depts: ["admin", "lager"], team: null, locations: ["loc-rest"], access: "owner", lifecycle: "active", onDuty: false },
      { id: "jh", name: "Jonas H.", initials: "JH", color: "#3B82F6", role: "Sous-chef", dept: "kjokken", depts: ["kjokken"], team: "lag-kveld", locations: ["loc-kjk"], access: "employee", lifecycle: "active", onDuty: true },
      { id: "sl", name: "Selma L.", initials: "SL", color: "#10B981", role: "Servitør", dept: "sal", depts: ["sal", "event"], team: "lag-helg", locations: ["loc-rest"], access: "employee", lifecycle: "active", onDuty: true },
      { id: "pk", name: "Petter K.", initials: "PK", color: "#A855F7", role: "Servitør", dept: "sal", depts: ["sal"], team: null, locations: ["loc-rest"], access: "employee", lifecycle: "trainee", onDuty: false },
      { id: "nv", name: "Nora V.", initials: "NV", color: "#864ad2", role: "Bartender", dept: "bar", depts: ["bar"], team: null, locations: ["loc-rest"], access: "employee", lifecycle: "trainee", onDuty: false },
      { id: "ib", name: "Ida B.", initials: "IB", color: "#EAB308", role: "Renholder", dept: "lager", depts: ["lager", "sal"], team: null, locations: ["loc-rest"], access: "employee", lifecycle: "active", onDuty: true },
      { id: "tr", name: "Tobias R.", initials: "TR", color: "#0891b2", role: "Servitør", dept: "sal", depts: ["sal"], team: "lag-helg", locations: ["loc-rest"], access: "employee", lifecycle: "offboarding", onDuty: false },
      { id: "km", name: "Kari M.", initials: "KM", color: "#db2777", role: "Servitør", dept: "sal", depts: ["sal", "event"], team: null, locations: ["loc-rest"], access: "employee", lifecycle: "inactive", onDuty: false },
    ];
  }
  const PEOPLE_BY_ID = {};
  PEOPLE.forEach((p) => (PEOPLE_BY_ID[p.id] = p));
  // active members = everyone who can receive (excludes offboarding/inactive from "alle")
  const ACTIVE = PEOPLE.filter((p) => p.lifecycle === "active" || p.lifecycle === "trainee");
  const TOTAL = ACTIVE.length;

  // ============================================================
  // Status + type catalogs (tones mirror the app: success/warning/error/info/muted)
  // ============================================================

  // announcement lifecycle
  const ANN_STATUS = {
    draft: { id: "draft", label: "Utkast", tone: "muted", icon: "pen", desc: "Ikke publisert. Kun synlig for forfatter og ledere." },
    scheduled: { id: "scheduled", label: "Planlagt", tone: "info", icon: "clock", desc: "Publiseres automatisk på valgt tidspunkt." },
    published: { id: "published", label: "Publisert", tone: "success", icon: "check", desc: "Levert til mottakere og synlig i kanalen." },
    archived: { id: "archived", label: "Arkivert", tone: "muted", icon: "archive", desc: "Tatt ut av aktiv feed. Beholdes for historikk." },
  };

  // notification priority — operational passes quiet hours
  const ANN_PRIORITY = {
    operational: { id: "operational", label: "Operasjonell", tone: "warning", icon: "bell", desc: "Push med priority=1, mode=operational. Passerer stille timer." },
    normal: { id: "normal", label: "Vanlig", tone: "muted", icon: "bell", desc: "Vanlig varsel. Holdes tilbake i stille timer." },
  };

  // channel kinds
  const CHANNEL_KINDS = {
    kunngjoring: { id: "kunngjoring", label: "Kunngjøringskanal", icon: "megaphone", desc: "Enveis fra ledelsen. Kun ledere kan publisere.", post: "managers" },
    avdeling: { id: "avdeling", label: "Avdelingskanal", icon: "users", desc: "Kanal for én avdeling. Ledere publiserer, medlemmer leser.", post: "managers" },
    tema: { id: "tema", label: "Temakanal", icon: "hash", desc: "Tema-/prosjektkanal. Alle medlemmer kan poste.", post: "members" },
  };

  // audience facets (org vocabulary)
  const AUDIENCE_KINDS = {
    all: { id: "all", label: "Hele teamet", icon: "globe", facet: null },
    on_duty: { id: "on_duty", label: "På vakt i dag", icon: "clock", facet: null },
    department: { id: "department", label: "Avdeling", icon: "building", facet: "depts" },
    team: { id: "team", label: "Lag", icon: "users", facet: "teams" },
    location: { id: "location", label: "Område", icon: "mappin", facet: "locations" },
    access: { id: "access", label: "Tilgangsnivå", icon: "shield", facet: "accessIds" },
  };

  // ---------- audience resolver ----------
  // Returns the list of recipient ids for a given audience descriptor.
  function resolveAudience(aud) {
    if (!aud) return [];
    const pool = ACTIVE;
    switch (aud.kind) {
      case "all": return pool.map((p) => p.id);
      case "on_duty": return pool.filter((p) => p.onDuty).map((p) => p.id);
      case "department": return pool.filter((p) => (p.depts || [p.dept]).some((d) => (aud.depts || []).includes(d))).map((p) => p.id);
      case "team": return pool.filter((p) => (aud.teams || []).includes(p.team)).map((p) => p.id);
      case "location": return pool.filter((p) => (p.locations || []).some((l) => (aud.locations || []).includes(l))).map((p) => p.id);
      case "access": return pool.filter((p) => (aud.accessIds || []).includes(p.access)).map((p) => p.id);
      default: return [];
    }
  }
  function audienceLabel(aud) {
    if (!aud) return "—";
    const k = AUDIENCE_KINDS[aud.kind];
    if (!k) return "—";
    if (aud.kind === "all" || aud.kind === "on_duty") return k.label;
    if (aud.kind === "department") return (aud.depts || []).map((d) => (DEPARTMENTS[d] || {}).name).filter(Boolean).join(" · ") || k.label;
    if (aud.kind === "team") return (aud.teams || []).map((t) => (TEAMS[t] || {}).name).filter(Boolean).join(" · ") || k.label;
    if (aud.kind === "location") return (aud.locations || []).map((l) => (LOCATIONS[l] || {}).name).filter(Boolean).join(" · ") || k.label;
    if (aud.kind === "access") return (aud.accessIds || []).map((a) => (ACCESS_LEVELS[a] || {}).label).filter(Boolean).join(" · ") || k.label;
    return k.label;
  }

  // ---------- channels ----------
  const CHANNELS = [
    { id: "c-kunngjoring", name: "kunngjøringer", kind: "kunngjoring", color: "#f97316", dept: null,
      desc: "Offisielle kunngjøringer fra ledelsen. Festet vises øverst for alle.", members: TOTAL, default: true, archived: false,
      managers: ["ma", "es"], notify: "operational", lastAt: "i dag · 11:30" },
    { id: "c-kjokken", name: "kjøkken", kind: "avdeling", color: "#ee560c", dept: "kjokken",
      desc: "Drift, meny og leveranser for kjøkkenet.", members: 0, archived: false,
      managers: ["jh", "ma"], notify: "normal", lastAt: "i dag · 09:40" },
    { id: "c-sal", name: "sal-og-bar", kind: "avdeling", color: "#00ab93", dept: "sal",
      desc: "Servering, bar og gjestehåndtering.", members: 0, archived: false,
      managers: ["ma"], notify: "normal", lastAt: "i går · 16:42" },
    { id: "c-sommer", name: "sommer-2026", kind: "tema", color: "#c18200", dept: null,
      desc: "Sommersesong, uteservering og sommerfest. Alle kan poste.", members: 14, archived: false,
      managers: ["ma"], notify: "normal", lastAt: "tirsdag · 10:15" },
    { id: "c-vinter", name: "vinter-2025", kind: "tema", color: "#7a756e", dept: null,
      desc: "Avsluttet vintersesong. Arkivert for historikk.", members: 12, archived: true,
      managers: ["ma"], notify: "normal", lastAt: "3. mar · 14:00" },
  ];
  // derive member counts for department channels from the roster
  CHANNELS.forEach((c) => {
    if (c.kind === "avdeling" && c.dept) c.members = ACTIVE.filter((p) => (p.depts || [p.dept]).includes(c.dept)).length;
  });
  const CHANNEL_BY_ID = {};
  CHANNELS.forEach((c) => (CHANNEL_BY_ID[c.id] = c));

  // ---------- announcement builder ----------
  // reads: subset of audience that has confirmed read (with timestamps)
  const reads = (ids) => ids.map((id, i) => ({ emp: id, at: ["09:02", "09:14", "10:31", "10:58", "11:20", "13:40", "14:05", "16:50"][i % 8] }));

  const ANNOUNCEMENTS = [
    {
      id: "a-vinmeny", channel: "c-sommer", author: "ma", title: "Ny vinmeny lansert — smaking torsdag 18:00",
      body: "Vi tar inn syv nye naturviner fra Tilo & Otto denne uken. Alle som jobber i bar eller servering bør være på smakingen torsdag 18:00 før service. Ta med smaksprofil-arket fra forrige runde — vi går gjennom serveringstemperatur og glasstype.",
      status: "published", createdAt: "i går · 16:42", priority: "operational", pinned: true,
      audience: { kind: "department", depts: ["sal", "bar"] },
      reads: reads(["sl", "ib"]),
      edits: [{ at: "i går · 16:42", by: "ma", summary: "Opprettet og publisert" }],
      comments: [
        { id: "cm1", by: "sl", at: "i går · 17:10", body: "Jeg er på! Tar med arket." },
        { id: "cm2", by: "jh", at: "i går · 18:02", body: "Kan kjøkkenet få en kort intro også? Vi matcher til menyen." },
      ],
      attachments: [{ kind: "file", label: "Smaksprofil-ark v3.pdf" }],
    },
    {
      id: "a-ikmat", channel: "c-kunngjoring", author: "ma", title: "HMS — egenkontroll kjølerom i uke 20",
      body: "Mattilsynet varsler tilsyn i uken som kommer. Sjekk at egenkontrollen i kjølerom 1 og 2 er signert daglig før vi åpner. Logg i Smartout under HMS → Egenkontroll. Ta bilde hvis du finner avvik.",
      status: "published", createdAt: "i dag · 09:12", priority: "operational", pinned: true,
      audience: { kind: "on_duty" },
      reads: reads(["jh", "sl", "ib"]),
      edits: [
        { at: "i dag · 09:12", by: "ma", summary: "Opprettet og publisert" },
        { at: "i dag · 09:31", by: "ma", summary: "La til lenke til HMS → Egenkontroll" },
      ],
      comments: [{ id: "cm3", by: "jh", at: "i dag · 09:40", body: "Kjøl 2 er signert. Tar kjøl 1 nå." }],
      attachments: [],
    },
    {
      id: "a-tillegg", channel: "c-kunngjoring", author: "ma", title: "Vakttillegg fra 17. mai-helgen i lønnsslipp",
      body: "Tilleggene for 17. mai-helgen ligger nå i lønnsslippen for april. +50% på selve dagen, +35% kveld før. Sjekk under Lønn → April. Si fra innen fredag hvis noe mangler.",
      status: "published", createdAt: "i dag · 11:30", priority: "normal", pinned: false,
      audience: { kind: "all" },
      reads: reads(["jh", "sl", "ib", "ma"]),
      edits: [{ at: "i dag · 11:30", by: "ma", summary: "Opprettet og publisert" }],
      comments: [],
      attachments: [],
    },
    {
      id: "a-espresso", channel: "c-kjokken", author: "jh", title: "Vi bytter espressomaskinen tirsdag morgen",
      body: "Linea Mini kommer inn tirsdag før åpning. Caffè-stasjonen er stengt fra 07:00 til ca. 10:00. Sett opp pour-over som backup — bønner ligger i skap 3.",
      status: "published", createdAt: "i dag · 09:40", priority: "normal", pinned: false,
      audience: { kind: "department", depts: ["kjokken", "bar"] },
      reads: reads(["jh"]),
      edits: [{ at: "i dag · 09:40", by: "jh", summary: "Opprettet og publisert" }],
      comments: [],
      attachments: [],
    },
    {
      id: "a-sommerfest", channel: "c-sommer", author: "ma", title: "Sommerfest for hele teamet — 14. juni",
      body: "Sett av lørdag 14. juni. Vi tar fri tidlig, drar til Hvaler. Påmelding via Smartout innen 24. mai. Mer info kommer i denne kanalen.",
      status: "scheduled", createdAt: "planlagt · 1. jun 08:00", priority: "normal", pinned: false,
      scheduledFor: "1. juni 2026 · 08:00",
      audience: { kind: "all" },
      reads: [],
      edits: [{ at: "tirsdag · 10:15", by: "ma", summary: "Opprettet som planlagt utsending" }],
      comments: [],
      attachments: [],
    },
    {
      id: "a-onboarding", channel: "c-sal", author: "ma", title: "Onboardingmodul 3: vinservice klar for gjennomgang",
      body: "Petter — modul 3 ligger åpen i Trening-fanen. Vi går gjennom i morgen før service. Regn med 30 minutter.",
      status: "draft", createdAt: "utkast · sist endret i dag", priority: "normal", pinned: false,
      audience: { kind: "team", teams: ["lag-helg"] },
      reads: [],
      edits: [{ at: "i dag · 08:20", by: "ma", summary: "Utkast opprettet" }],
      comments: [],
      attachments: [],
    },
    {
      id: "a-uniform", channel: "c-kunngjoring", author: "es", title: "Ny uniformsleverandør fra juni",
      body: "Vi bytter til Bjørklund Tekstil fra 1. juni. Bestilling av nye skjorter skjer via Maria. Gamle skjorter leveres tilbake innen 15. juni.",
      status: "archived", createdAt: "3. mar · 14:00", priority: "normal", pinned: false,
      audience: { kind: "all" },
      reads: reads(["ma", "jh", "sl", "ib", "tr"]),
      edits: [
        { at: "3. mar · 14:00", by: "es", summary: "Opprettet og publisert" },
        { at: "20. mai · 09:00", by: "ma", summary: "Arkivert — leverandørbytte gjennomført" },
      ],
      comments: [],
      attachments: [],
    },
  ];

  // attach derived counts (targetCount, readCount) so views don't recompute
  ANNOUNCEMENTS.forEach((a) => {
    a.targetIds = resolveAudience(a.audience);
    a.targetCount = a.targetIds.length;
    a.readCount = (a.reads || []).length;
    a.audienceLabel = audienceLabel(a.audience);
  });

  Object.assign(D, {
    KO_PEOPLE: PEOPLE, KO_PEOPLE_BY_ID: PEOPLE_BY_ID, KO_ACTIVE: ACTIVE, KO_TOTAL: TOTAL,
    KO_DEPARTMENTS: DEPARTMENTS, KO_TEAMS: TEAMS, KO_LOCATIONS: LOCATIONS, KO_ACCESS: ACCESS_LEVELS,
    ANN_STATUS, ANN_PRIORITY, CHANNEL_KINDS, AUDIENCE_KINDS,
    CHANNELS, CHANNEL_BY_ID, ANNOUNCEMENTS,
    resolveAudience, audienceLabel,
  });
})();
