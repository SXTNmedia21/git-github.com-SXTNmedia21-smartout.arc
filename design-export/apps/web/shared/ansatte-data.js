// ===== Smartout — Ansatte (employee identity & readiness) data model =====
// Extends window.SmartoutData with the people domain (D2 resources).
// Grounded in the VERIFIED Smartout schema + ADR-0429 terminology:
//   profile          = atomic employee record (ONE per human per workspace)
//   user_identity    = global (owns e-mail) — a person can have many profiles
//   employment_contract = source of truth for pay, hours and dates
//   protocol_assignment = the readiness record (counters drive readiness)
//   position + profile_position(thin: profile/position/is_primary) = what you can do
//   profession + profession_training = job class + training-linked competence
//   legal_function(platform-level, no workspace) + profile_legal_function = legal roles
//   profile_access = fine-grained scopes (domain.action, granted_by is plain text)
//   Avdeling=department · Stilling=position · Område=location · Lag=team
//   Tilgangsnivå=profile.role (employee/manager/admin/owner) — platform access
//   Ansvarsnivå (authority_level: vakt/stedfortreder/leder) — operational rank
//   Ledelse = leadership via avdelings-/lag-leder relationships
// PII is masked + role-gated. Lifecycle drives the card. Plural placement is normal.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ---------- Structural vocabulary (Core Structure D1) ----------
  const DEPARTMENTS = {
    kjokken: { id: "kjokken", name: "Kjøkken", arch: "BoH", color: "#ee560c", leader: "jh" },
    sal: { id: "sal", name: "Sal", arch: "FoH", color: "#00ab93", leader: "ma" },
    bar: { id: "bar", name: "Bar", arch: "FoH", color: "#864ad2", leader: "ma" },
    event: { id: "event", name: "Event", arch: "FoH", color: "#c18200", leader: "ma" },
    lager: { id: "lager", name: "Lager", arch: "BoH", color: "#008388", leader: "es" },
    admin: { id: "admin", name: "Admin", arch: "Admin", color: "#7a756e", leader: "es" },
  };
  const LOCATIONS = {
    "loc-rest": { id: "loc-rest", name: "Restaurant", type: "main" },
    "loc-ute": { id: "loc-ute", name: "Uteservering", type: "outdoor" },
    "loc-event": { id: "loc-event", name: "Eventlokale", type: "event" },
    "loc-kjk": { id: "loc-kjk", name: "Kjøkken", type: "kitchen" },
    "loc-lager": { id: "loc-lager", name: "Lager & mottak", type: "storage" },
  };
  const TEAMS = {
    "lag-kveld": { id: "lag-kveld", name: "Kjøkken kveld", dept: "kjokken", leader: "jh" },
    "lag-helg": { id: "lag-helg", name: "Sal helg", dept: "sal", leader: "ma" },
    "lag-event": { id: "lag-event", name: "Eventcrew", dept: "event", leader: "ma" },
  };

  // ---------- The access axes (kept deliberately separate) ----------
  const ACCESS_LEVELS = {
    employee: { id: "employee", label: "Ansatt", tone: "muted", grants: "Egen profil, vakter, oppgaver og opplæring." },
    manager: { id: "manager", label: "Leder", tone: "info", grants: "Administrere team, vaktplan, oppgaver og godkjenninger." },
    admin: { id: "admin", label: "Admin", tone: "purple", grants: "Full drift: ansatte, kontrakter, tilgang og innstillinger." },
    owner: { id: "owner", label: "Eier", tone: "orange", grants: "Alt admin kan, pluss fakturering, arbeidsplass og eierskap." },
  };
  const AUTHORITY_LEVELS = {
    vakt: { id: "vakt", label: "Vakt", tone: "muted", desc: "Utfører eget arbeid på vakt." },
    stedfortreder: { id: "stedfortreder", label: "Stedfortreder", tone: "info", desc: "Trår inn for leder ved fravær." },
    leder: { id: "leder", label: "Leder", tone: "orange", desc: "Operativt ansvar for skift og folk." },
  };
  const LIFECYCLE = {
    trainee: { id: "trainee", label: "Under opplæring", tone: "info", desc: "Onboardes — ikke klar for selvstendig vakt." },
    active: { id: "active", label: "Aktiv", tone: "success", desc: "I full drift." },
    inactive: { id: "inactive", label: "Inaktiv", tone: "muted", desc: "Midlertidig ute (permisjon e.l.)." },
    offboarding: { id: "offboarding", label: "Avslutter", tone: "warning", desc: "I avslutningsløp." },
  };
  const ABSENCE_TYPES = {
    syk: { label: "Sykefravær", icon: "thermometer", tone: "error" },
    foreldre: { label: "Foreldrepermisjon", icon: "heart", tone: "purple" },
    ferie: { label: "Ferie", icon: "umbrella", tone: "info" },
    ulonnet: { label: "Ulønnet permisjon", icon: "clock", tone: "muted" },
    militaer: { label: "Militærtjeneste", icon: "shield", tone: "muted" },
    opplaering: { label: "Opplæringspermisjon", icon: "cap", tone: "info" },
    velferd: { label: "Velferdspermisjon", icon: "heart", tone: "muted" },
  };

  // ============================================================
  // COMPETENCE CATALOGS (shared — referenced by junction records)
  // ============================================================

  // protocol — training/readiness procedure (drives protocol_assignment counters)
  const PROTOCOLS = {
    "pr-ikmat": { id: "pr-ikmat", name: "IK-mat egenkontroll", version: "2.4", procedures: 5, tests: 2, confirmations: 1 },
    "pr-allerg": { id: "pr-allerg", name: "Allergenhåndtering", version: "1.3", procedures: 3, tests: 1, confirmations: 1 },
    "pr-brann": { id: "pr-brann", name: "Brannvern & rømning", version: "2.0", procedures: 4, tests: 1, confirmations: 1 },
    "pr-hms": { id: "pr-hms", name: "HMS-grunnkurs", version: "3.1", procedures: 6, tests: 1, confirmations: 1 },
    "pr-serv": { id: "pr-serv", name: "Serviceopplæring (dag 1–2)", version: "3.0", procedures: 6, tests: 1, confirmations: 1 },
    "pr-onb": { id: "pr-onb", name: "Onboarding servitør", version: "1.2", procedures: 7, tests: 1, confirmations: 2 },
    "pr-alk": { id: "pr-alk", name: "Alkoholloven", version: "1.0", procedures: 2, tests: 1, confirmations: 1 },
    "pr-bar": { id: "pr-bar", name: "Bar-opplæring", version: "1.1", procedures: 5, tests: 1, confirmations: 0 },
    "pr-renhold": { id: "pr-renhold", name: "Renhold & hygiene", version: "1.5", procedures: 4, tests: 1, confirmations: 1 },
    "pr-led": { id: "pr-led", name: "Lederopplæring drift", version: "2.2", procedures: 5, tests: 2, confirmations: 1 },
    "pr-gdpr": { id: "pr-gdpr", name: "Personvern & PII-håndtering", version: "1.4", procedures: 3, tests: 1, confirmations: 1 },
  };

  // position — department-scoped role type (icon/color badge). profile_position is thin.
  const POSITIONS = {
    "pos-driftsleder": { id: "pos-driftsleder", name: "Driftsleder", dept: "admin", profession: "prof-ledelse", season: null, minRole: "manager", skills: ["Drift", "Personalansvar", "Budsjett"], icon: "gauge", color: "#FF7849", active: true, sort: 1 },
    "pos-dagligleder": { id: "pos-dagligleder", name: "Daglig leder", dept: "admin", profession: "prof-ledelse", season: null, minRole: "owner", skills: ["Eierskap", "Strategi"], icon: "building", color: "#2784d5", active: true, sort: 0 },
    "pos-sous": { id: "pos-sous", name: "Sous-chef", dept: "kjokken", profession: "prof-kokk", season: null, minRole: "employee", skills: ["Varmmat", "Bestilling", "Stedfortreder"], icon: "utensils", color: "#ee560c", active: true, sort: 2 },
    "pos-kokk": { id: "pos-kokk", name: "Kokk", dept: "kjokken", profession: "prof-kokk", season: null, minRole: "employee", skills: ["Varmmat", "Kaldmat", "IK-mat"], icon: "utensils", color: "#ee560c", active: true, sort: 3 },
    "pos-servitor": { id: "pos-servitor", name: "Servitør", dept: "sal", profession: "prof-servering", season: null, minRole: "employee", skills: ["Service", "Kasse", "Allergener"], icon: "coffee", color: "#00ab93", active: true, sort: 4 },
    "pos-event-serv": { id: "pos-event-serv", name: "Eventservitør", dept: "event", profession: "prof-servering", season: "sommer", minRole: "employee", skills: ["Selskap", "Bankett"], icon: "ticket", color: "#c18200", active: true, sort: 6 },
    "pos-bartender": { id: "pos-bartender", name: "Bartender", dept: "bar", profession: "prof-bar", season: null, minRole: "employee", skills: ["Drinker", "Skjenking", "Kasse"], icon: "coffee", color: "#864ad2", active: true, sort: 5 },
    "pos-renhold": { id: "pos-renhold", name: "Renholder", dept: "lager", profession: "prof-renhold", season: null, minRole: "employee", skills: ["Renhold", "Kjemikalier"], icon: "sparkle", color: "#008388", active: true, sort: 7 },
  };

  // profession — job class + training-linked competence (universal vs workspace)
  const PROFESSIONS = {
    "prof-kokk": { id: "prof-kokk", name: "Kokkefag", slug: "kokkefag", desc: "Tilberedning av mat etter HACCP og IK-mat.", universal: true, sort: 1,
      training: [{ protocol: "pr-ikmat", weight: 3, required: true }, { protocol: "pr-allerg", weight: 2, required: true }, { protocol: "pr-hms", weight: 1, required: true }, { protocol: "pr-brann", weight: 1, required: false }] },
    "prof-servering": { id: "prof-servering", name: "Servering", slug: "servering", desc: "Gjestehåndtering, salg og allergeninformasjon.", universal: true, sort: 2,
      training: [{ protocol: "pr-serv", weight: 3, required: true }, { protocol: "pr-allerg", weight: 2, required: true }, { protocol: "pr-alk", weight: 1, required: false }] },
    "prof-bar": { id: "prof-bar", name: "Bartending", slug: "bartending", desc: "Drinker, skjenking og kasseføring i bar.", universal: false, sort: 3,
      training: [{ protocol: "pr-bar", weight: 2, required: true }, { protocol: "pr-alk", weight: 2, required: true }, { protocol: "pr-hms", weight: 1, required: true }] },
    "prof-renhold": { id: "prof-renhold", name: "Renhold", slug: "renhold", desc: "Hygiene, renhold og kjemikaliehåndtering.", universal: true, sort: 4,
      training: [{ protocol: "pr-renhold", weight: 2, required: true }, { protocol: "pr-hms", weight: 1, required: true }] },
    "prof-ledelse": { id: "prof-ledelse", name: "Drift & ledelse", slug: "drift-ledelse", desc: "Personalansvar, drift og arbeidsgiverplikter.", universal: false, sort: 0,
      training: [{ protocol: "pr-led", weight: 3, required: true }, { protocol: "pr-gdpr", weight: 2, required: true }, { protocol: "pr-hms", weight: 1, required: true }] },
  };

  // legal_function — platform-level (NO workspace_id). profile_legal_function junction.
  const LEGAL_FUNCTIONS = {
    "lf-verneombud": { id: "lf-verneombud", name: "Verneombud", desc: "Ivaretar ansattes interesser i HMS-saker.", basis: "Arbeidsmiljøloven kap. 6", hours: 40, profession: null },
    "lf-brann": { id: "lf-brann", name: "Brannvernleder", desc: "Ansvar for brannforebygging og rømningsveier.", basis: "Forskrift om brannforebygging § 9", hours: 16, profession: null },
    "lf-forstehjelp": { id: "lf-forstehjelp", name: "Førstehjelpsansvarlig", desc: "Førstehjelpsberedskap på arbeidsplassen.", basis: "Internkontrollforskriften § 5", hours: 8, profession: null },
    "lf-hygiene": { id: "lf-hygiene", name: "Hygieneansvarlig (IK-mat)", desc: "Ansvar for matsikkerhet og egenkontroll.", basis: "IK-mat forskriften § 5", hours: 12, profession: "prof-kokk" },
  };

  // ---------- compact builders ----------
  const cert = (name, status, issued, expires) => ({ name, status, issued, expires });
  // protocol_assignment: pa(id, protocolId, status, [procDone,procTot],[testPass,testTot],[confSign,confTot], extra)
  const pa = (id, protocol, status, proc, test, conf, extra = {}) => ({
    id, profileScoped: true, protocol, version: PROTOCOLS[protocol].version, status,
    proc, test, conf, assignedVia: "protocol", ...extra,
  });

  // ================= EMPLOYEES (profiles) =================
  const EMPLOYEES = [
    // ---------- Maria A. — Driftsleder · aktiv · admin · leder ----------
    {
      id: "ma", name: "Maria Andersen", display: "Maria A.", initials: "MA", color: "#FF7849",
      stilling: "Driftsleder", employeeNo: "BN-0142", profileCode: "PRF-7K2A",
      lifecycle: "active", access: "admin", authority: "leder",
      leadership: ["Avdelingsleder · Sal", "Avdelingsleder · Bar", "Lagleder · Sal helg"],
      language: "Norsk (bokmål)", sync: "synced", started: "1. aug 2023",
      placement: { primary: "admin", depts: ["admin", "sal", "bar"], locations: ["loc-rest", "loc-ute", "loc-event"], team: "lag-helg", deptLeader: "es", teamLeader: "ma",
        history: [{ when: "aug 2023", what: "Ansatt som Servitør · Sal" }, { when: "feb 2024", what: "Forfremmet til Skiftleder" }, { when: "jan 2025", what: "Driftsleder · admin-tilgang" }] },
      contract: { position: "Driftsleder", form: "Fast", pct: 100, weeklyHours: 37.5, scheme: "Dagtid + turnus", payType: "Fastlønn", hourly: null, monthly: 56250, start: "1. aug 2023", end: null, trial: null, overtime: "Avtalt — 50 t/år", signed: "signed", signedAt: "20. jan 2025" },
      positions: [{ position: "pos-driftsleder", isPrimary: true }, { position: "pos-servitor", isPrimary: false }],
      professions: ["prof-ledelse", "prof-servering"],
      legal: [{ fn: "lf-brann", assignedAt: "12. jan 2025", assignedBy: "Erik S.", state: "completed" }, { fn: "lf-hygiene", assignedAt: "1. feb 2024", assignedBy: "Erik S.", state: "completed" }],
      accessScopes: [
        { scope: "employees.read", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "20. jan 2025" },
        { scope: "employees.write", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "20. jan 2025" },
        { scope: "contracts.read", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "20. jan 2025" },
        { scope: "pii.reveal", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "3. mai 2026" },
        { scope: "schedule.publish", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "20. jan 2025" },
        { scope: "payroll.approve", grantedBy: "Erik S.", createdAt: "20. jan 2025", updatedAt: "20. jan 2025" },
      ],
      protocols: [
        pa("a-ma-1", "pr-ikmat", "completed", [5, 5], [2, 2], [1, 1], { assignedAt: "1. feb 2024", assignedBy: "Erik S.", completedAt: "8. feb 2024", nextReviewAt: "8. feb 2027",
          proof: { procedures: [{ step: "Termometer-kalibrering", at: "8. feb 2024 09:10", by: "Maria A.", evidence: { kind: "photo", label: "Foto av kalibreringsetikett" } }, { step: "Avviksprosedyre", at: "8. feb 2024 09:24", by: "Maria A.", evidence: { kind: "signoff", label: "Signert av kvalitetsleder" } }],
            tests: [{ test: "Temperaturgrenser", passed: true, score: "20/20", answers: "20 riktige", ai: null, grader: "Auto", at: "8. feb 2024 09:30" }, { test: "HACCP", passed: true, score: "18/20", answers: "18 riktige", ai: 0.94, grader: "Botsson + Erik S.", at: "8. feb 2024 09:40" }],
            confirmations: [{ conf: "Bekreftet IK-mat ansvar", at: "8. feb 2024 09:42", ip: "84.212.40.11", sig: "Maria Andersen" }] } }),
        pa("a-ma-2", "pr-led", "completed", [5, 5], [2, 2], [1, 1], { assignedAt: "10. jan 2025", assignedBy: "Erik S.", completedAt: "18. jan 2025", nextReviewAt: "18. jan 2027" }),
        pa("a-ma-3", "pr-gdpr", "completed", [3, 3], [1, 1], [1, 1], { assignedAt: "10. jan 2025", assignedBy: "Erik S.", completedAt: "15. jan 2025", nextReviewAt: "15. jan 2026" }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2024", "2027"), cert("HMS-kort", "valid", "2024", "2026"), cert("Alkohollov", "valid", "2024", "2027"), cert("Førstehjelp", "expiring", "2023", "jul 2026")],
      readiness: { blockers: [{ label: "Personvern-resert. forfaller 15. jan 2026", sev: "info" }] },
      absence: [{ type: "ferie", from: "14. jul", to: "1. aug 2026", days: 15, status: "approved" }],
      pii: { personnr: "14039• •••••", bank: "•••• •• •••42", address: "Storgata 14, 0184 Oslo", family: "Gift · 2 barn", taxCard: "Tabell 7100 · 2026" },
      audit: [{ who: "Maria A.", what: "endret tilgangsnivå til Admin", when: "20. jan 2025 · 09:12", kind: "access" }, { who: "Erik S.", what: "signerte arbeidsavtale", when: "20. jan 2025 · 08:40", kind: "contract" }],
    },

    // ---------- Erik S. — Eier / Daglig leder · aktiv · owner · leder ----------
    {
      id: "es", name: "Erik Sørensen", display: "Erik S.", initials: "ES", color: "#2784d5",
      stilling: "Daglig leder", employeeNo: "BN-0001", profileCode: "PRF-0001",
      lifecycle: "active", access: "owner", authority: "leder",
      leadership: ["Eier · Bistro Nord", "Avdelingsleder · Admin", "Avdelingsleder · Lager"],
      language: "Norsk (bokmål)", sync: "synced", started: "1. jan 2021",
      placement: { primary: "admin", depts: ["admin", "lager"], locations: ["loc-rest", "loc-lager"], team: null, deptLeader: null, teamLeader: null,
        history: [{ when: "jan 2021", what: "Grunnla Bistro Nord · Eier" }] },
      contract: { position: "Daglig leder / Eier", form: "Fast", pct: 100, weeklyHours: 40, scheme: "Dagtid", payType: "Fastlønn", hourly: null, monthly: 78000, start: "1. jan 2021", end: null, trial: null, overtime: "Unntatt (ledende stilling)", signed: "signed", signedAt: "1. jan 2021" },
      positions: [{ position: "pos-dagligleder", isPrimary: true }],
      professions: ["prof-ledelse"],
      legal: [{ fn: "lf-verneombud", assignedAt: "1. jan 2021", assignedBy: "Stiftelse", state: "completed" }],
      accessScopes: [
        { scope: "*.admin", grantedBy: "Stiftelse", createdAt: "1. jan 2021", updatedAt: "1. jan 2021" },
        { scope: "billing.manage", grantedBy: "Stiftelse", createdAt: "1. jan 2021", updatedAt: "1. jan 2021" },
        { scope: "workspace.manage", grantedBy: "Stiftelse", createdAt: "1. jan 2021", updatedAt: "1. jan 2021" },
      ],
      protocols: [
        pa("a-es-1", "pr-led", "completed", [5, 5], [2, 2], [1, 1], { assignedAt: "1. jan 2021", assignedBy: "Stiftelse", completedAt: "10. jan 2021", nextReviewAt: "10. jan 2025", status: "expired" }),
        pa("a-es-2", "pr-hms", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "1. jan 2021", assignedBy: "Stiftelse", completedAt: "8. jan 2021", nextReviewAt: "8. jan 2026" }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2021", "2027"), cert("HMS-kort", "valid", "2021", "2027"), cert("Skjenkebevilling", "valid", "2021", "2028")],
      readiness: { blockers: [{ label: "Lederopplæring må resertifiseres (forfalt 10. jan 2025)", sev: "warn" }] },
      absence: [],
      pii: { personnr: "02118• •••••", bank: "•••• •• •••08", address: "Bjørkeveien 3, 0276 Oslo", family: "Gift · 3 barn", taxCard: "Tabell 7150 · 2026" },
      audit: [{ who: "System", what: "opprettet arbeidsplass", when: "1. jan 2021", kind: "system" }],
    },

    // ---------- Jonas H. — Kokk (sous) · aktiv · ansatt · stedfortreder ----------
    {
      id: "jh", name: "Jonas Haugen", display: "Jonas H.", initials: "JH", color: "#3B82F6",
      stilling: "Sous-chef", employeeNo: "BN-0118", profileCode: "PRF-3M9C",
      lifecycle: "active", access: "employee", authority: "stedfortreder",
      leadership: ["Lagleder · Kjøkken kveld"],
      language: "Norsk (bokmål)", sync: "synced", started: "3. mar 2022",
      placement: { primary: "kjokken", depts: ["kjokken"], locations: ["loc-kjk"], team: "lag-kveld", deptLeader: "jh", teamLeader: "jh",
        history: [{ when: "mar 2022", what: "Ansatt som Kokk · Kjøkken" }, { when: "nov 2023", what: "Stedfortreder for kjøkkensjef" }, { when: "apr 2024", what: "Lagleder · Kjøkken kveld" }] },
      contract: { position: "Sous-chef", form: "Fast", pct: 100, weeklyHours: 37.5, scheme: "Turnus", payType: "Fastlønn", hourly: null, monthly: 44500, start: "3. mar 2022", end: null, trial: null, overtime: "Avtalt — 100 t/år", signed: "signed", signedAt: "3. mar 2022" },
      positions: [{ position: "pos-sous", isPrimary: true }, { position: "pos-kokk", isPrimary: false }],
      professions: ["prof-kokk"],
      legal: [{ fn: "lf-hygiene", assignedAt: "1. jun 2023", assignedBy: "Maria A.", state: "completed" }, { fn: "lf-forstehjelp", assignedAt: "3. mar 2025", assignedBy: "Maria A.", state: "in_progress" }],
      accessScopes: [
        { scope: "tasks.assign", grantedBy: "Maria A.", createdAt: "12. apr 2024", updatedAt: "12. apr 2024" },
        { scope: "schedule.read", grantedBy: "Maria A.", createdAt: "12. apr 2024", updatedAt: "12. apr 2024" },
        { scope: "team.kjokken.lead", grantedBy: "Maria A.", createdAt: "12. apr 2024", updatedAt: "12. apr 2024" },
      ],
      protocols: [
        pa("a-jh-1", "pr-ikmat", "completed", [5, 5], [2, 2], [1, 1], { assignedAt: "3. mar 2022", assignedBy: "Maria A.", completedAt: "12. mar 2022", nextReviewAt: "12. mar 2025", status: "expired" }),
        pa("a-jh-2", "pr-allerg", "completed", [3, 3], [1, 1], [1, 1], { assignedAt: "1. mar 2025", assignedBy: "Maria A.", completedAt: "6. mar 2025", nextReviewAt: "6. mar 2027",
          proof: { procedures: [{ step: "Allergenmatrise meny", at: "6. mar 2025 11:02", by: "Jonas H.", evidence: { kind: "signoff", label: "Signert av kjøkkensjef" } }],
            tests: [{ test: "Allergener", passed: true, score: "9/10", answers: "9 riktige", ai: 0.88, grader: "Botsson", at: "6. mar 2025 11:20" }],
            confirmations: [{ conf: "Bekreftet allergenrutine", at: "6. mar 2025 11:25", ip: "84.212.40.18", sig: "Jonas Haugen" }] } }),
        pa("a-jh-3", "pr-hms", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "3. mar 2022", assignedBy: "Maria A.", completedAt: "10. mar 2022", nextReviewAt: "10. mar 2026" }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2022", "2027"), cert("HMS-kort", "valid", "2022", "2026"), cert("Brannvern", "valid", "2024", "2026"), cert("Førstehjelp", "valid", "2025", "2028")],
      readiness: { blockers: [{ label: "IK-mat protokoll må resertifiseres (forfalt 12. mar 2025)", sev: "warn" }] },
      absence: [{ type: "syk", from: "8. mai", to: "9. mai 2026", days: 2, status: "approved" }, { type: "ferie", from: "21. jun", to: "5. jul 2026", days: 11, status: "pending" }],
      pii: { personnr: "19059• •••••", bank: "•••• •• •••17", address: "Markveien 22, 0554 Oslo", family: "Samboer", taxCard: "Tabell 7100 · 2026" },
      audit: [{ who: "Maria A.", what: "satte ansvarsnivå til Stedfortreder", when: "12. nov 2023", kind: "access" }],
    },

    // ---------- Selma L. — Servitør · aktiv · ansatt · vakt ----------
    {
      id: "sl", name: "Selma Lie", display: "Selma L.", initials: "SL", color: "#10B981",
      stilling: "Servitør", employeeNo: "BN-0131", profileCode: "PRF-5T1B",
      lifecycle: "active", access: "employee", authority: "vakt",
      leadership: [],
      language: "Norsk (bokmål)", sync: "synced", started: "15. jan 2024",
      placement: { primary: "sal", depts: ["sal", "event"], locations: ["loc-rest", "loc-ute", "loc-event"], team: "lag-helg", deptLeader: "ma", teamLeader: "ma",
        history: [{ when: "jan 2024", what: "Ansatt som Servitør · Sal" }, { when: "sep 2024", what: "La til Event som ekstra avdeling" }] },
      contract: { position: "Servitør", form: "Fast", pct: 80, weeklyHours: 30, scheme: "Turnus", payType: "Timelønn", hourly: 235, monthly: null, start: "15. jan 2024", end: null, trial: null, overtime: "Etter avtale", signed: "signed", signedAt: "15. jan 2024" },
      positions: [{ position: "pos-servitor", isPrimary: true }, { position: "pos-event-serv", isPrimary: false }],
      professions: ["prof-servering"],
      legal: [],
      accessScopes: [
        { scope: "schedule.read", grantedBy: "System", createdAt: "15. jan 2024", updatedAt: "15. jan 2024" },
        { scope: "tasks.complete", grantedBy: "System", createdAt: "15. jan 2024", updatedAt: "15. jan 2024" },
      ],
      protocols: [
        pa("a-sl-1", "pr-serv", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "15. jan 2024", assignedBy: "Maria A.", completedAt: "20. jan 2024", nextReviewAt: "20. jan 2027" }),
        pa("a-sl-2", "pr-allerg", "completed", [3, 3], [1, 1], [1, 1], { assignedAt: "15. jan 2024", assignedBy: "Maria A.", completedAt: "21. jan 2024", nextReviewAt: "21. jan 2027" }),
        pa("a-sl-3", "pr-alk", "in_progress", [2, 2], [0, 1], [0, 1], { assignedAt: "2. mai 2026", assignedBy: "Maria A.", completedAt: null, nextReviewAt: null }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2024", "2027"), cert("Alkohollov", "expiring", "2024", "jul 2026"), cert("Førstehjelp", "expiring", "2023", "jul 2026"), cert("HMS-kort", "valid", "2024", "2026")],
      readiness: { blockers: [{ label: "Alkoholloven-protokoll pågår (test + signering gjenstår)", sev: "warn" }, { label: "Førstehjelp utløper om 5 uker", sev: "warn" }] },
      absence: [{ type: "ferie", from: "8. jul", to: "22. jul 2026", days: 11, status: "approved" }],
      pii: { personnr: "27089• •••••", bank: "•••• •• •••55", address: "Thorvald Meyers gate 9, 0555 Oslo", family: "Enslig", taxCard: "Tabell 7100 · 2026" },
      audit: [{ who: "Selma L.", what: "ba om innsyn i egen lønnsslipp", when: "2. mai 2026", kind: "pii" }],
    },

    // ---------- Petter K. — Servitør · UNDER OPPLÆRING (dag 2) · ansatt · vakt ----------
    {
      id: "pk", name: "Petter Karlsen", display: "Petter K.", initials: "PK", color: "#A855F7",
      stilling: "Servitør", employeeNo: "BN-0150", profileCode: "PRF-9P4D",
      lifecycle: "trainee", access: "employee", authority: "vakt",
      leadership: [],
      language: "Norsk (bokmål)", sync: "pending", started: "28. mai 2026",
      placement: { primary: "sal", depts: ["sal"], locations: ["loc-rest"], team: null, deptLeader: "ma", teamLeader: "ma",
        history: [{ when: "28. mai 2026", what: "Ansatt som Servitør · onboarding startet" }] },
      contract: { position: "Servitør", form: "Midlertidig", pct: 60, weeklyHours: 22.5, scheme: "Turnus", payType: "Timelønn", hourly: 215, monthly: null, start: "28. mai 2026", end: "28. nov 2026", trial: "6 mnd prøvetid (til 28. nov)", overtime: "Ikke avtalt", signed: "sent", signedAt: null, sentAt: "27. mai 2026" },
      positions: [{ position: "pos-servitor", isPrimary: true }],
      professions: ["prof-servering"],
      legal: [],
      accessScopes: [{ scope: "tasks.complete", grantedBy: "System", createdAt: "28. mai 2026", updatedAt: "28. mai 2026" }],
      onboarding: {
        startedAt: "28. mai 2026", day: 2, totalDays: 5, mentor: "sl",
        steps: [
          { id: "o1", label: "Velkomst & omvisning", status: "done" },
          { id: "o2", label: "Signer arbeidsavtale", status: "pending", blocker: true },
          { id: "o3", label: "Kassesystem", status: "done" },
          { id: "o4", label: "Bordkart & soner", status: "inprogress" },
          { id: "o5", label: "Allergener & meny", status: "notstarted" },
          { id: "o6", label: "Onboarding-quiz (bestått)", status: "notstarted" },
          { id: "o7", label: "Skygging — 3 vakter", status: "notstarted" },
        ],
        welcome: "done",
      },
      protocols: [
        pa("a-pk-1", "pr-onb", "in_progress", [3, 7], [0, 1], [1, 2], { assignedAt: "28. mai 2026", assignedBy: "Maria A.", assignedVia: "lifecycle", assignedRefId: "onboarding-pk", completedAt: null, nextReviewAt: null,
          proof: { procedures: [{ step: "Velkomst & omvisning", at: "28. mai 2026 10:30", by: "Petter K.", evidence: { kind: "signoff", label: "Bekreftet av mentor Selma L." } }, { step: "Kassesystem", at: "28. mai 2026 13:10", by: "Petter K.", evidence: { kind: "photo", label: "Foto av gjennomført salg" } }, { step: "Bordkart & soner", at: "pågår", by: "Petter K.", evidence: null }],
            tests: [{ test: "Onboarding-quiz: Servitør dag 2", passed: false, score: "ikke forsøkt", answers: "—", ai: null, grader: "—", at: "ikke forsøkt" }],
            confirmations: [{ conf: "Bekreftet mottatt personalhåndbok", at: "28. mai 2026 10:05", ip: "84.212.40.51", sig: "Petter Karlsen" }, { conf: "Signert arbeidsavtale", at: "venter signering", ip: null, sig: null }] } }),
        pa("a-pk-2", "pr-allerg", "not_started", [0, 3], [0, 1], [0, 1], { assignedAt: "28. mai 2026", assignedBy: "Maria A.", completedAt: null, nextReviewAt: null }),
      ],
      certs: [cert("Hygienesertifikat", "missing", null, null), cert("HMS-kort", "valid", "2026", "2028"), cert("Alkohollov", "missing", null, null), cert("Førstehjelp", "missing", null, null)],
      readiness: { blockers: [
        { label: "Arbeidsavtale ikke signert", sev: "crit" },
        { label: "Onboarding-quiz ikke bestått", sev: "crit" },
        { label: "Mangler hygienesertifikat", sev: "crit" },
        { label: "3 skyggevakter gjenstår", sev: "warn" },
      ] },
      absence: [],
      pii: { personnr: "11048• •••••", bank: "Ikke registrert", address: "Sofienberggata 4, 0551 Oslo", family: "Enslig", taxCard: "Mangler — purret 28. mai" },
      audit: [{ who: "Maria A.", what: "opprettet profil & startet onboarding", when: "28. mai 2026 · 10:02", kind: "lifecycle" }, { who: "System", what: "sendte arbeidsavtale til signering", when: "27. mai 2026 · 16:20", kind: "contract" }],
    },

    // ---------- Nora V. — Bartender · UNDER OPPLÆRING (dag 1) · ansatt · vakt ----------
    {
      id: "nv", name: "Nora Vik", display: "Nora V.", initials: "NV", color: "#864ad2",
      stilling: "Bartender", employeeNo: "BN-0151", profileCode: "PRF-2N8E",
      lifecycle: "trainee", access: "employee", authority: "vakt",
      leadership: [],
      language: "English", sync: "error", started: "30. mai 2026",
      placement: { primary: "bar", depts: ["bar"], locations: ["loc-rest"], team: null, deptLeader: "ma", teamLeader: null,
        history: [{ when: "30. mai 2026", what: "Profil opprettet · venter velkomst" }] },
      contract: { position: "Bartender", form: "Tilkalling", pct: null, weeklyHours: null, scheme: "Ved behov", payType: "Timelønn", hourly: 225, monthly: null, start: "30. mai 2026", end: null, trial: null, overtime: "Ikke avtalt", signed: "draft", signedAt: null },
      positions: [{ position: "pos-bartender", isPrimary: true }],
      professions: ["prof-bar"],
      legal: [],
      accessScopes: [],
      onboarding: {
        startedAt: "30. mai 2026", day: 1, totalDays: 5, mentor: null,
        steps: [
          { id: "o1", label: "Velkomst & omvisning", status: "notstarted", blocker: true },
          { id: "o2", label: "Signer arbeidsavtale", status: "notstarted", blocker: true },
          { id: "o3", label: "Tildel mentor", status: "notstarted", blocker: true },
          { id: "o4", label: "Bar-opplæring", status: "notstarted" },
          { id: "o5", label: "Alkoholloven", status: "notstarted" },
        ],
        welcome: "notstarted",
      },
      protocols: [
        pa("a-nv-1", "pr-bar", "not_started", [0, 5], [0, 1], [0, 0], { assignedAt: "30. mai 2026", assignedBy: "Maria A.", completedAt: null, nextReviewAt: null }),
        pa("a-nv-2", "pr-alk", "not_started", [0, 2], [0, 1], [0, 1], { assignedAt: "30. mai 2026", assignedBy: "Maria A.", completedAt: null, nextReviewAt: null }),
      ],
      certs: [cert("Hygienesertifikat", "missing", null, null), cert("Alkohollov", "missing", null, null), cert("HMS-kort", "missing", null, null)],
      readiness: { blockers: [
        { label: "Velkomst ikke fullført", sev: "crit" },
        { label: "Arbeidsavtale er utkast — ikke sendt", sev: "crit" },
        { label: "Ingen mentor tildelt", sev: "warn" },
        { label: "Profil-synk feilet", sev: "warn" },
      ] },
      absence: [],
      pii: { personnr: "Ikke registrert", bank: "Ikke registrert", address: "Mangler", family: "Ikke oppgitt", taxCard: "Mangler" },
      audit: [{ who: "Maria A.", what: "opprettet profil", when: "30. mai 2026 · 11:40", kind: "lifecycle" }, { who: "System", what: "profil-synk feilet (mangler personnr)", when: "30. mai 2026 · 11:41", kind: "system" }],
    },

    // ---------- Ida B. — Renholder · aktiv · ansatt · vakt ----------
    {
      id: "ib", name: "Ida Berg", display: "Ida B.", initials: "IB", color: "#EAB308",
      stilling: "Renholder", employeeNo: "BN-0127", profileCode: "PRF-6R3F",
      lifecycle: "active", access: "employee", authority: "vakt",
      leadership: [],
      language: "Norsk (bokmål)", sync: "synced", started: "1. sep 2023",
      placement: { primary: "lager", depts: ["lager", "sal"], locations: ["loc-rest", "loc-kjk", "loc-lager"], team: null, deptLeader: "es", teamLeader: null,
        history: [{ when: "sep 2023", what: "Ansatt som Renholder" }] },
      contract: { position: "Renholder", form: "Fast", pct: 50, weeklyHours: 18.75, scheme: "Dagtid", payType: "Timelønn", hourly: 220, monthly: null, start: "1. sep 2023", end: null, trial: null, overtime: "Ikke avtalt", signed: "signed", signedAt: "1. sep 2023" },
      positions: [{ position: "pos-renhold", isPrimary: true }],
      professions: ["prof-renhold"],
      legal: [{ fn: "lf-verneombud", assignedAt: "1. mar 2025", assignedBy: "Erik S.", state: "completed" }],
      accessScopes: [{ scope: "tasks.complete", grantedBy: "System", createdAt: "1. sep 2023", updatedAt: "1. sep 2023" }],
      protocols: [
        pa("a-ib-1", "pr-renhold", "completed", [4, 4], [1, 1], [1, 1], { assignedAt: "1. sep 2023", assignedBy: "Erik S.", completedAt: "5. sep 2023", nextReviewAt: "5. sep 2026" }),
        pa("a-ib-2", "pr-hms", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "1. sep 2023", assignedBy: "Erik S.", completedAt: "6. sep 2023", nextReviewAt: "6. sep 2026" }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2023", "2026"), cert("HMS-kort", "valid", "2023", "2026"), cert("Kjemikaliesikkerhet", "valid", "2024", "2027")],
      readiness: { blockers: [] },
      absence: [{ type: "velferd", from: "3. jun", to: "3. jun 2026", days: 1, status: "pending" }],
      pii: { personnr: "08077• •••••", bank: "•••• •• •••91", address: "Vøyensvingen 12, 0458 Oslo", family: "Gift · 1 barn", taxCard: "Tabell 7100 · 2026" },
      audit: [],
    },

    // ---------- Tobias R. — Servitør · AVSLUTTER · ansatt · vakt ----------
    {
      id: "tr", name: "Tobias Ruud", display: "Tobias R.", initials: "TR", color: "#0891b2",
      stilling: "Servitør", employeeNo: "BN-0139", profileCode: "PRF-8B2G",
      lifecycle: "offboarding", access: "employee", authority: "vakt",
      leadership: [],
      language: "Norsk (bokmål)", sync: "synced", started: "1. feb 2024",
      placement: { primary: "sal", depts: ["sal"], locations: ["loc-rest", "loc-ute"], team: "lag-helg", deptLeader: "ma", teamLeader: "ma",
        history: [{ when: "feb 2024", what: "Ansatt som Servitør · Sal" }, { when: "15. mai 2026", what: "Leverte oppsigelse" }] },
      contract: { position: "Servitør", form: "Fast", pct: 100, weeklyHours: 37.5, scheme: "Turnus", payType: "Timelønn", hourly: 240, monthly: null, start: "1. feb 2024", end: "14. jun 2026", trial: null, overtime: "Etter avtale", signed: "signed", signedAt: "1. feb 2024" },
      positions: [{ position: "pos-servitor", isPrimary: true }],
      professions: ["prof-servering"],
      legal: [],
      accessScopes: [
        { scope: "schedule.read", grantedBy: "System", createdAt: "1. feb 2024", updatedAt: "1. feb 2024" },
        { scope: "tasks.complete", grantedBy: "System", createdAt: "1. feb 2024", updatedAt: "1. feb 2024" },
      ],
      offboarding: {
        reason: "Egen oppsigelse", lastDay: "14. jun 2026", noticeGiven: "15. mai 2026",
        tasks: [
          { id: "f1", label: "Sluttsamtale", status: "done", owner: "ma" },
          { id: "f2", label: "Tilbakelevering — nøkkel & uniform", status: "pending", owner: "ma" },
          { id: "f3", label: "Overlevering av faste bord/gjester", status: "inprogress", owner: "tr" },
          { id: "f4", label: "Siste lønn & feriepenger beregnet", status: "notstarted", owner: "es" },
          { id: "f5", label: "Fjern tilgang (app, kasse, nøkkelkort)", status: "scheduled", owner: "System", when: "14. jun 23:59" },
          { id: "f6", label: "Sluttattest utstedt", status: "notstarted", owner: "ma" },
        ],
        accessRemoval: "Planlagt 14. jun 23:59",
      },
      protocols: [
        pa("a-tr-1", "pr-serv", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "1. feb 2024", assignedBy: "Maria A.", completedAt: "6. feb 2024", nextReviewAt: "6. feb 2027" }),
      ],
      certs: [cert("Hygienesertifikat", "valid", "2024", "2027"), cert("Alkohollov", "valid", "2024", "2027")],
      readiness: { blockers: [] },
      absence: [],
      pii: { personnr: "13029• •••••", bank: "•••• •• •••73", address: "Grünerløkka 31, 0556 Oslo", family: "Samboer", taxCard: "Tabell 7100 · 2026" },
      audit: [{ who: "Tobias R.", what: "leverte oppsigelse", when: "15. mai 2026 · 14:02", kind: "lifecycle" }, { who: "Maria A.", what: "startet avslutningsløp", when: "15. mai 2026 · 15:10", kind: "lifecycle" }],
    },

    // ---------- Kari M. — Servitør · INAKTIV (foreldreperm) · ansatt · vakt ----------
    {
      id: "km", name: "Kari Moen", display: "Kari M.", initials: "KM", color: "#db2777",
      stilling: "Servitør", employeeNo: "BN-0109", profileCode: "PRF-1K7H",
      lifecycle: "inactive", access: "employee", authority: "vakt",
      leadership: [],
      language: "Norsk (bokmål)", sync: "synced", started: "1. apr 2021",
      placement: { primary: "sal", depts: ["sal", "event"], locations: ["loc-rest", "loc-event"], team: null, deptLeader: "ma", teamLeader: null,
        history: [{ when: "apr 2021", what: "Ansatt som Servitør" }, { when: "feb 2026", what: "Startet foreldrepermisjon" }] },
      contract: { position: "Servitør", form: "Fast", pct: 100, weeklyHours: 37.5, scheme: "Turnus", payType: "Timelønn", hourly: 245, monthly: null, start: "1. apr 2021", end: null, trial: null, overtime: "Etter avtale", signed: "signed", signedAt: "1. apr 2021" },
      positions: [{ position: "pos-servitor", isPrimary: true }],
      professions: ["prof-servering"],
      legal: [],
      accessScopes: [{ scope: "schedule.read", grantedBy: "System", createdAt: "1. apr 2021", updatedAt: "1. feb 2026" }],
      protocols: [
        pa("a-km-1", "pr-serv", "completed", [6, 6], [1, 1], [1, 1], { assignedAt: "1. apr 2021", assignedBy: "Maria A.", completedAt: "6. apr 2021", nextReviewAt: "6. apr 2024", status: "expired" }),
      ],
      certs: [cert("Hygienesertifikat", "expired", "2021", "feb 2026"), cert("Alkohollov", "valid", "2024", "2027")],
      readiness: { blockers: [{ label: "Inaktiv — i foreldrepermisjon til 12. okt", sev: "info" }, { label: "Hygienesertifikat utløpt under permisjon", sev: "warn" }] },
      absence: [{ type: "foreldre", from: "1. feb", to: "12. okt 2026", days: 184, status: "approved" }],
      pii: { personnr: "25069• •••••", bank: "•••• •• •••28", address: "Sannergata 6, 0557 Oslo", family: "Gift · 2 barn", taxCard: "Tabell 7100 · 2026" },
      audit: [{ who: "Maria A.", what: "satte status til Inaktiv (permisjon)", when: "1. feb 2026", kind: "lifecycle" }],
    },
  ];

  const EMP_BY_ID = {};
  EMPLOYEES.forEach((e) => (EMP_BY_ID[e.id] = e));

  // ============================================================
  // DOCUMENT / CONTRACT TEMPLATES (Maler) — system-connected.
  // Templates live in Document Mode (Bibliotek) and are pulled in here.
  // Editor lets you bind placeholders to live system fields, add deep links
  // / shortcuts, and set auto-attach rules (e.g. medarbeidersamtale-skjema).
  // ============================================================
  const SYSTEM_FIELDS = {
    ansatt: { label: "Ansatt", icon: "user", fields: [
      { token: "ansatt.navn", label: "Fullt navn" },
      { token: "ansatt.fornavn", label: "Fornavn" },
      { token: "ansatt.ansattnr", label: "Ansattnummer" },
      { token: "ansatt.stilling", label: "Stilling" },
      { token: "ansatt.avdeling", label: "Avdeling" },
      { token: "ansatt.epost", label: "E-post" },
    ] },
    kontrakt: { label: "Kontrakt", icon: "checkdoc", fields: [
      { token: "kontrakt.form", label: "Ansettelsesform" },
      { token: "kontrakt.prosent", label: "Stillingsprosent" },
      { token: "kontrakt.uketimer", label: "Timer / uke" },
      { token: "kontrakt.lonn", label: "Lønn" },
      { token: "kontrakt.start", label: "Startdato" },
      { token: "kontrakt.slutt", label: "Sluttdato" },
      { token: "kontrakt.provetid", label: "Prøvetid" },
    ] },
    arbeidsplass: { label: "Arbeidsplass", icon: "building", fields: [
      { token: "arbeidsplass.navn", label: "Bedriftsnavn" },
      { token: "arbeidsplass.orgnr", label: "Org.nr" },
      { token: "arbeidsplass.adresse", label: "Adresse" },
      { token: "arbeidsplass.leder", label: "Nærmeste leder" },
    ] },
    dato: { label: "Dato & signatur", icon: "pen", fields: [
      { token: "dato.idag", label: "Dagens dato" },
      { token: "signatur.ansatt", label: "Signatur – ansatt" },
      { token: "signatur.leder", label: "Signatur – leder" },
    ] },
  };

  // shortcuts / deep links you can drop into a template
  const DEEP_LINKS = [
    { label: "Personalhåndbok", target: "doc:personal", icon: "book" },
    { label: "HMS-håndbok", target: "doc:hms", icon: "shield" },
    { label: "Onboarding-løp", target: "route:ansatte", icon: "cap" },
    { label: "Taushetserklæring", target: "tpl:tpl-taushet", icon: "lock" },
    { label: "Vaktplan", target: "route:vaktplan", icon: "grid" },
  ];

  // a block: { t:'h'|'p'|'field'|'sign'|'list', text, items }
  // text may contain {{token}} placeholders + [[deep links]]
  const DOC_TEMPLATES = [
    {
      id: "tpl-fast", name: "Arbeidsavtale – fast ansettelse", type: "kontrakt", category: "Ansettelse",
      version: "3.1", status: "published", updated: "12. mai 2026", owner: "ma", uses: 142, autoAttach: null,
      desc: "Standard arbeidsavtale for faste stillinger. Følger arbeidsmiljøloven §14-6.",
      sections: [
        { id: "s1", title: "Parter", blocks: [
          { t: "p", text: "Mellom {{arbeidsplass.navn}} (org.nr {{arbeidsplass.orgnr}}) og {{ansatt.navn}} (ansattnr {{ansatt.ansattnr}}) er det inngått følgende arbeidsavtale." },
        ] },
        { id: "s2", title: "Stilling og arbeidssted", blocks: [
          { t: "p", text: "Arbeidstaker ansettes som {{ansatt.stilling}} i avdeling {{ansatt.avdeling}}. Arbeidssted er {{arbeidsplass.adresse}}. Nærmeste leder er {{arbeidsplass.leder}}." },
        ] },
        { id: "s3", title: "Arbeidstid og lønn", blocks: [
          { t: "field", text: "Ansettelsesform: {{kontrakt.form}}" },
          { t: "field", text: "Stillingsprosent: {{kontrakt.prosent}} — {{kontrakt.uketimer}} timer per uke" },
          { t: "field", text: "Lønn: {{kontrakt.lonn}}" },
          { t: "field", text: "Tiltredelse: {{kontrakt.start}} · Prøvetid: {{kontrakt.provetid}}" },
        ] },
        { id: "s4", title: "Vilkår og rutiner", blocks: [
          { t: "p", text: "Arbeidstaker plikter å gjøre seg kjent med [[Personalhåndbok]] og [[HMS-håndbok]]. Onboarding gjennomføres etter [[Onboarding-løp]]." },
        ] },
        { id: "s5", title: "Signatur", blocks: [
          { t: "sign", text: "{{signatur.ansatt}} · {{signatur.leder}} · {{dato.idag}}" },
        ] },
      ],
    },
    {
      id: "tpl-mid", name: "Arbeidsavtale – midlertidig", type: "kontrakt", category: "Ansettelse",
      version: "2.0", status: "published", updated: "3. apr 2026", owner: "ma", uses: 34, autoAttach: null,
      desc: "Midlertidig ansettelse / vikariat med sluttdato.",
      sections: [
        { id: "s1", title: "Parter og varighet", blocks: [
          { t: "p", text: "{{ansatt.navn}} ansettes midlertidig som {{ansatt.stilling}} fra {{kontrakt.start}} til {{kontrakt.slutt}}. Grunnlag: {{kontrakt.form}}." },
        ] },
      ],
    },
    {
      id: "tpl-tilkalling", name: "Tilkallingsavtale", type: "kontrakt", category: "Ansettelse",
      version: "1.2", status: "published", updated: "20. feb 2026", owner: "es", uses: 18, autoAttach: null,
      desc: "Avtale om tilkalling ved behov (ringevikar).", sections: [
        { id: "s1", title: "Tilkalling", blocks: [{ t: "p", text: "{{ansatt.navn}} kan tilkalles ved behov som {{ansatt.stilling}}. Timesats: {{kontrakt.lonn}}. Ingen garantert arbeidstid." }] },
      ],
    },
    {
      id: "tpl-medarb", name: "Skjema – medarbeidersamtale", type: "skjema", category: "Oppfølging",
      version: "1.4", status: "published", updated: "8. mai 2026", owner: "ma", uses: 56, autoAttach: "medarbeidersamtale",
      desc: "Strukturert skjema som sendes med automatisk ved hver medarbeidersamtale.",
      sections: [
        { id: "s1", title: "Om samtalen", blocks: [
          { t: "field", text: "Ansatt: {{ansatt.navn}} · {{ansatt.stilling}}" },
          { t: "field", text: "Dato: {{dato.idag}} · Leder: {{arbeidsplass.leder}}" },
        ] },
        { id: "s2", title: "Tema", blocks: [
          { t: "list", items: ["Trivsel og arbeidsmiljø", "Måloppnåelse siden sist", "Kompetanse og utvikling", "Mål for neste periode", "Annet"] },
        ] },
        { id: "s3", title: "Oppsummering og signatur", blocks: [
          { t: "p", text: "Avtalte tiltak dokumenteres og følges opp. Se [[Personalhåndbok]] for rutine." },
          { t: "sign", text: "{{signatur.ansatt}} · {{signatur.leder}}" },
        ] },
      ],
    },
    {
      id: "tpl-taushet", name: "Taushetserklæring", type: "vedlegg", category: "Vedlegg",
      version: "1.0", status: "published", updated: "1. jan 2026", owner: "es", uses: 160, autoAttach: "onboarding",
      desc: "Standard taushetserklæring — auto-vedlegg ved onboarding.", sections: [
        { id: "s1", title: "Erklæring", blocks: [{ t: "p", text: "{{ansatt.navn}} forplikter seg til taushet om forretnings- og personopplysninger ved {{arbeidsplass.navn}}." }, { t: "sign", text: "{{signatur.ansatt}} · {{dato.idag}}" }] },
      ],
    },
    {
      id: "tpl-attest", name: "Sluttattest", type: "vedlegg", category: "Avslutning",
      version: "1.1", status: "draft", updated: "15. mai 2026", owner: "ma", uses: 7, autoAttach: null,
      desc: "Attest ved arbeidsforholdets slutt.", sections: [
        { id: "s1", title: "Attest", blocks: [{ t: "p", text: "{{ansatt.navn}} var ansatt som {{ansatt.stilling}} ved {{arbeidsplass.navn}} fra {{kontrakt.start}} til {{kontrakt.slutt}}." }] },
      ],
    },
  ];

  // ---- Contract activity feed (Contracts Flow → "Nysignerte avtaler") ----
  // Recent signings/sendings across the workspace. status: signed · sent · draft
  const CONTRACT_ACTIVITY = [
    { id: "ca1", profile: "nv", type: "Ny avtale", status: "draft", date: "30. mai 2026", note: "Tilkalling · bartender — utkast, ikke sendt" },
    { id: "ca2", profile: "pk", type: "Ny avtale", status: "sent", date: "27. mai 2026", note: "Midlertidig 60 % · servitør — sendt til signering" },
    { id: "ca3", profile: "sl", type: "Tillegg", status: "signed", date: "24. mai 2026", note: "Alkohollov-tillegg signert" },
    { id: "ca4", profile: "tr", type: "Sluttavtale", status: "signed", date: "15. mai 2026", note: "Oppsigelse bekreftet · siste dag 14. jun" },
    { id: "ca5", profile: "jh", type: "Reforhandlet", status: "signed", date: "12. mai 2026", note: "Fastlønn justert til 44 500 kr/mnd" },
  ];

  Object.assign(D, {
    DEPARTMENTS, LOCATIONS, TEAMS, ACCESS_LEVELS, AUTHORITY_LEVELS, LIFECYCLE, ABSENCE_TYPES,
    PROTOCOLS, POSITIONS, PROFESSIONS, LEGAL_FUNCTIONS, EMPLOYEES, EMP_BY_ID, CONTRACT_ACTIVITY,
    SYSTEM_FIELDS, DEEP_LINKS, DOC_TEMPLATES,
  });
})();
