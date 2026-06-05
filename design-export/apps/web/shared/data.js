// Mock data for SmartOut Task Manager prototype
// Norwegian-language operative environment

const USERS = {
  ma: { id: 'ma', name: 'Maria A.', initials: 'MA', color: '#FF7849', role: 'Driftsleder' },
  jh: { id: 'jh', name: 'Jonas H.', initials: 'JH', color: '#3B82F6', role: 'Kokk' },
  sl: { id: 'sl', name: 'Selma L.', initials: 'SL', color: '#10B981', role: 'Servitør' },
  pk: { id: 'pk', name: 'Petter K.', initials: 'PK', color: '#A855F7', role: 'Servitør' },
  ib: { id: 'ib', name: 'Ida B.', initials: 'IB', color: '#EAB308', role: 'Renhold' },
  bot: { id: 'bot', name: 'Botsson', initials: 'BS', color: '#0F172A', role: 'AI-assistent' },
};

const ME = USERS.ma;

// Folders are curated categories
const FOLDERS = [
  { id: 'hms', name: 'HMS & IK-mat', icon: '🛡', color: '#DC2626', count: 8 },
  { id: 'drift', name: 'Drift', icon: '⚙', color: '#2563EB', count: 14 },
  { id: 'onboarding', name: 'Onboarding', icon: '👋', color: '#7C3AED', count: 3 },
  { id: 'vedlikehold', name: 'Vedlikehold', icon: '🔧', color: '#0891B2', count: 5 },
  { id: 'kjokken', name: 'Kjøkken', icon: '🍳', color: '#EA580C', count: 9 },
  { id: 'salg', name: 'Salg & gjest', icon: '✨', color: '#DB2777', count: 4 },
];

const TAGS = ['morgenrutine', 'kveld', 'helg', 'kjøling', 'mattilsyn', 'leverandør', 'ny-ansatt', 'ekstra'];

// Origin badges
const ORIGIN = {
  session: { label: 'Rutine', color: '#2563EB', bg: '#DBEAFE' },
  adhoc: { label: 'Ad-hoc', color: '#7C3AED', bg: '#EDE9FE' },
  protocol: { label: 'Protokoll', color: '#0F766E', bg: '#CCFBF1' },
  deviation: { label: 'Avviks-oppfølging', color: '#DC2626', bg: '#FEE2E2' },
};

const TASKS = [
  {
    id: 't1', cat: 'ikmat', book: 'hms', chapter: 'Egenkontroll mat (IK-mat)',
    title: 'Temperaturkontroll – kjøl & frys',
    description: 'Sjekk alle kjøleskap og frysere på kjøkkenet. Logg temperatur. Avvik > +4°C → opprett avvik.',
    priority: 'critical',
    status: 'overdue',
    origin: 'session',
    folder: 'hms',
    tags: ['morgenrutine', 'kjøling', 'mattilsyn'],
    deadline: '08:00',
    deadlineRel: '32 min forsinket',
    estimate: 10,
    location: 'Kjøkken – sone A',
    assignee: 'ma',
    requiresEvidence: true,
    requiresApproval: false,
    manual: 'm-temp',
    subtasks: [
      { id: 's1', title: 'Kjøl 1 (grønnsak)', done: true, value: '+3,2°C', user: 'ma' },
      { id: 's2', title: 'Kjøl 2 (kjøtt)', done: true, value: '+2,1°C', user: 'ma' },
      { id: 's3', title: 'Kjøl 3 (meieri)', done: false, value: null },
      { id: 's4', title: 'Frys 1', done: false, value: null },
      { id: 's5', title: 'Frys 2 (lager)', done: false, value: null },
    ],
    activity: [
      { type: 'create', user: 'bot', text: 'Aktivert fra åpningssjekkliste', time: '07:00' },
      { type: 'start', user: 'ma', text: 'startet oppgaven', time: '08:14' },
      { type: 'check', user: 'ma', text: 'logget Kjøl 1: +3,2°C', time: '08:15' },
      { type: 'check', user: 'ma', text: 'logget Kjøl 2: +2,1°C', time: '08:18' },
      { type: 'comment', user: 'jh', text: 'Husk å sjekke pakningen på Kjøl 3, den var løs i går.', time: '08:21' },
    ],
  },
  {
    id: 't2', book: 'hms', chapter: 'Egenkontroll mat (IK-mat)',
    title: 'Avvik #214 – løs pakning på Kjøl 3',
    description: 'Følg opp avvik registrert i går kveld. Pakning må byttes eller strammes.',
    priority: 'critical',
    status: 'todo',
    origin: 'deviation',
    folder: 'vedlikehold',
    tags: ['kjøling'],
    deadline: '12:00',
    deadlineRel: 'om 3t 28min',
    estimate: 25,
    location: 'Kjøkken – sone A',
    assignee: 'ma',
    requiresEvidence: true,
    requiresApproval: true,
    manual: 'm-pakning',
    subtasks: [
      { id: 's1', title: 'Inspiser pakning', done: false },
      { id: 's2', title: 'Strammes eller byttes', done: false },
      { id: 's3', title: 'Foto før/etter', done: false },
      { id: 's4', title: 'Test temperatur i 30 min', done: false },
    ],
    activity: [
      { type: 'create', user: 'jh', text: 'opprettet avvik #214', time: 'i går 22:14' },
      { type: 'assign', user: 'bot', text: 'tildelte oppgaven til Maria A.', time: '06:00' },
    ],
  },
  {
    id: 't3', book: 'bedrift', chapter: 'Kjøkken',
    title: 'Lunsj-prep: salatbar',
    description: 'Klargjør salatbar før lunsjrush. Følg menyplanen for uke 19.',
    priority: 'high',
    status: 'inprogress',
    origin: 'session',
    folder: 'kjokken',
    tags: [],
    deadline: '11:00',
    deadlineRel: 'om 2t 28min',
    estimate: 45,
    location: 'Kjøkken – kald sone',
    assignee: 'jh',
    requiresEvidence: false,
    requiresApproval: false,
    manual: null,
    subtasks: [
      { id: 's1', title: 'Vask og kutt grønnsaker', done: true },
      { id: 's2', title: 'Lag dagens dressing (sitron-tahini)', done: true },
      { id: 's3', title: 'Fyll på toppinger', done: false },
      { id: 's4', title: 'Rydd og tørk benk', done: false },
    ],
    activity: [],
  },
  {
    id: 't4', book: 'personal', chapter: 'Onboarding',
    title: 'Onboarding: Petter dag 2',
    description: 'Andre opplæringsdag for Petter. Gå gjennom kassesystem og bordplassering.',
    priority: 'high',
    status: 'todo',
    origin: 'protocol',
    folder: 'onboarding',
    tags: ['ny-ansatt'],
    deadline: '14:00',
    deadlineRel: 'om 5t 28min',
    estimate: 90,
    location: 'Salgsområde',
    assignee: 'sl',
    requiresEvidence: true,
    requiresApproval: false,
    manual: 'm-onboarding',
    subtasks: [
      { id: 's1', title: 'Kassesystem – grunnleggende', done: false },
      { id: 's2', title: 'Bordkart og soner', done: false },
      { id: 's3', title: 'Allergener og menyspørsmål', done: false },
      { id: 's4', title: 'Quiz: bestått', done: false },
    ],
    activity: [
      { type: 'create', user: 'bot', text: 'Aktivert fra opplæringsprotokoll "Servitør dag 2"', time: '06:00' },
    ],
  },
  {
    id: 't5', cat: 'oppgave', book: 'hms', chapter: 'Renhold & hygiene',
    title: 'Renhold – toaletter (gjest)',
    description: 'Gjennomfør standard renholdssjekk på gjestetoaletter.',
    priority: 'normal',
    status: 'todo',
    origin: 'session',
    folder: 'hms',
    tags: ['morgenrutine'],
    deadline: '10:30',
    deadlineRel: 'om 1t 58min',
    estimate: 15,
    location: 'Gjestetoaletter',
    assignee: 'ib',
    requiresEvidence: true,
    requiresApproval: false,
    manual: 'm-renhold',
    subtasks: [
      { id: 's1', title: 'Vask og desinfiser servant', done: false },
      { id: 's2', title: 'Vask gulv', done: false },
      { id: 's3', title: 'Fyll såpe og papir', done: false },
      { id: 's4', title: 'Sjekkpunkt-foto', done: false },
    ],
    activity: [],
  },
  {
    id: 't6', book: 'hms', chapter: 'Egenkontroll mat (IK-mat)',
    title: 'Sjekk leveranse fra Bama',
    description: 'Mottakskontroll: temperatur, kvalitet, riktig antall. Signer fraktbrev.',
    priority: 'normal',
    status: 'todo',
    origin: 'adhoc',
    folder: 'drift',
    tags: ['leverandør'],
    deadline: '09:30',
    deadlineRel: 'om 58min',
    estimate: 10,
    location: 'Vareleveranse',
    assignee: 'ma',
    requiresEvidence: false,
    requiresApproval: false,
    manual: null,
    subtasks: [
      { id: 's1', title: 'Sjekk temperatur ved levering', done: false },
      { id: 's2', title: 'Tell mot fraktbrev', done: false },
      { id: 's3', title: 'Signer og arkiver', done: false },
    ],
    activity: [
      { type: 'create', user: 'jh', text: 'opprettet og tildelte deg', time: '07:42' },
    ],
  },
  {
    id: 't7', book: 'bedrift', chapter: 'Vedlikehold',
    title: 'Bytt ølfat – IPA',
    description: 'Fatet er nesten tomt. Sjekk koblinger.',
    priority: 'normal',
    status: 'todo',
    origin: 'adhoc',
    folder: 'drift',
    tags: ['ekstra'],
    deadline: 'I dag',
    deadlineRel: null,
    estimate: 8,
    location: 'Bar',
    assignee: 'pk',
    requiresEvidence: false,
    requiresApproval: false,
    manual: 'm-olfat',
    subtasks: [],
    activity: [],
  },
  {
    id: 't8', book: 'bedrift', chapter: 'Drift',
    title: 'Estetikk-sjekk: bordoppdekking',
    description: 'Sjekk at alle bord er pent dekket før åpning.',
    priority: 'low',
    status: 'todo',
    origin: 'session',
    folder: 'salg',
    tags: ['morgenrutine'],
    deadline: '11:00',
    deadlineRel: 'om 2t 28min',
    estimate: 10,
    location: 'Salgsområde',
    assignee: 'sl',
    requiresEvidence: false,
    requiresApproval: false,
    manual: null,
    subtasks: [],
    activity: [],
  },
  {
    id: 't9', book: 'bedrift', chapter: 'Vedlikehold',
    title: 'Ukesrengjøring av kaffemaskin',
    description: 'Full deep-clean i henhold til manual.',
    priority: 'low',
    status: 'todo',
    origin: 'session',
    folder: 'vedlikehold',
    tags: ['kveld'],
    deadline: '22:00',
    deadlineRel: 'om 13t 28min',
    estimate: 20,
    location: 'Bar',
    assignee: 'pk',
    requiresEvidence: true,
    requiresApproval: false,
    manual: 'm-kaffe',
    subtasks: [],
    activity: [],
  },
  {
    id: 't10', book: 'hms', chapter: 'Egenkontroll mat (IK-mat)',
    title: 'Tøm fettutskiller',
    description: 'Månedlig vedlikehold. Logg vekt og signer.',
    priority: 'normal',
    status: 'done',
    origin: 'session',
    folder: 'hms',
    tags: ['mattilsyn'],
    deadline: 'I går',
    deadlineRel: null,
    estimate: 30,
    location: 'Bakgård',
    assignee: 'ma',
    requiresEvidence: true,
    requiresApproval: true,
    manual: null,
    subtasks: [],
    activity: [],
    completedAt: 'I går 16:42',
  },
];

// Manuals (instruksjonshåndbøker)
const MANUALS = {
  'm-temp': {
    id: 'm-temp',
    title: 'Temperaturkontroll – Standard prosedyre',
    version: '2.4',
    updated: '12. apr 2026',
    author: 'Sara K. (Kvalitetsleder)',
    folder: 'hms',
    estimatedReadTime: 4,
    description: 'Daglig kontroll av kjøl- og fryseskap. Følger Mattilsynets HACCP-krav.',
    sections: [
      {
        id: 'sec-1',
        title: 'Før du starter',
        type: 'text',
        content: [
          'Du trenger: kalibrert termometer, loggbok eller mobilapp, og rene hender.',
          'Sjekk at termometeret er kalibrert siste 6 måneder. Kalibreringsdato står på etiketten på baksiden.',
        ],
      },
      {
        id: 'sec-2',
        title: 'Slik måler du',
        type: 'video',
        content: [
          'Plasser termometeret midt i skapet, ikke mot vegg eller ventil. Vent 30 sekunder før du leser av.',
        ],
        videoTitle: 'Riktig plassering av termometer',
        videoDuration: '1:42',
      },
      {
        id: 'sec-q',
        title: 'Hvorfor dette er viktig',
        type: 'quote',
        content: ['Feil temperatur i kjøl er den vanligste årsaken til at mat må kastes — og til avvik ved tilsyn. Tar du målingen riktig, fanger du problemet før gjesten gjør det.'],
        by: 'Sara K., Kvalitetsleder',
      },
      {
        id: 'sec-3',
        title: 'Akseptable grenser',
        type: 'image',
        content: [
          'Kjøl: 0°C til +4°C. Ideelt +2°C til +3°C.',
          'Frys: -18°C eller lavere.',
          'Ved avvik: følg avviksprosedyre under "Hva gjør jeg ved avvik".',
        ],
      },
      {
        id: 'sec-4',
        title: 'Hva gjør jeg ved avvik',
        type: 'checklist',
        content: [
          'Mål på nytt etter 5 minutter for å bekrefte.',
          'Sjekk om dør har stått åpen, eller om det har vært strømbrudd.',
          'Opprett avvik i Smartout med foto av termometer.',
          'Flytt utsatte varer til annet kjøl/frys.',
          'Varsle leder umiddelbart hvis temperatur > +8°C.',
        ],
      },
      {
        id: 'sec-5',
        title: 'Logg og signer',
        type: 'text',
        content: [
          'Alle målinger logges automatisk når du registrerer dem i appen.',
          'Tidsstempel og brukernavn settes på.',
          'Loggen er tilgjengelig for Mattilsynet i 3 år.',
        ],
      },
    ],
  },
  'm-pakning': {
    id: 'm-pakning',
    title: 'Bytte/justere pakning på kjøl/frys',
    version: '1.1',
    updated: '03. mar 2026',
    author: 'Erik T. (Vedlikehold)',
    folder: 'vedlikehold',
    estimatedReadTime: 6,
    description: 'Slik strammer eller bytter du pakning på Liebherr-skap.',
    sections: [
      { id: 's1', title: 'Verktøy du trenger', type: 'text', content: ['Stjerneskrutrekker PH2, ny pakning (artikkelnr 8201-44), spritklut.'] },
      { id: 's2', title: 'Demonter gammel pakning', type: 'video', content: ['Trekk forsiktig fra hjørnet og rundt.'], videoTitle: 'Demontering av pakning', videoDuration: '2:18' },
      { id: 's3', title: 'Rens spor', type: 'image', content: ['Bruk spritklut i sporet før montering.'] },
      { id: 's4', title: 'Monter ny pakning', type: 'checklist', content: ['Start i øverste hjørne', 'Trykk inn hele veien rundt', 'Sjekk at den ligger jevnt', 'Lukk dør og test sug'] },
    ],
  },
  'm-onboarding': {
    id: 'm-onboarding',
    title: 'Servitør – Dag 2 opplæring',
    version: '3.0',
    updated: '01. apr 2026',
    author: 'Maria A. (Driftsleder)',
    folder: 'onboarding',
    estimatedReadTime: 12,
    description: 'Strukturert opplæring i kasse, bordkart og menyhåndtering.',
    sections: [
      { id: 's1', title: 'Velkommen', type: 'text', content: ['I dag fokuserer vi på kassesystem og gjestehåndtering.'] },
      { id: 's2', title: 'Kassesystem', type: 'video', content: ['Demo av PowerOffice-kassen.'], videoTitle: 'Kassesystem-grunnkurs', videoDuration: '8:24' },
      { id: 's3', title: 'Bordkart', type: 'image', content: ['Memorer sone A, B og C.'] },
      { id: 's4', title: 'Allergener', type: 'checklist', content: ['Gluten', 'Laktose', 'Nøtter', 'Skalldyr', 'Egg', 'Soya'] },
    ],
  },
  'm-renhold': { id: 'm-renhold', title: 'Renhold gjestetoaletter', version: '1.5', updated: '20. mar 2026', author: 'Ida B.', folder: 'hms', estimatedReadTime: 3, description: 'Daglig sjekk og rengjøring.', sections: [{ id: 's1', title: 'Kjemikalier', type: 'text', content: ['Bruk Krystal allrent og Antibac.'] }] },
  'm-olfat': { id: 'm-olfat', title: 'Bytte ølfat', version: '1.0', updated: '15. feb 2026', author: 'Petter K.', folder: 'drift', estimatedReadTime: 2, description: 'Trygg og rask fatbytte.', sections: [] },
  'm-kaffe': { id: 'm-kaffe', title: 'Deep-clean kaffemaskin', version: '2.0', updated: '10. apr 2026', author: 'Sara K.', folder: 'vedlikehold', estimatedReadTime: 8, description: 'Ukentlig grundig rengjøring.', sections: [] },
};

// Priority configuration
const PRIORITY = {
  critical: { label: 'Kritisk', color: '#DC2626', bg: '#FEE2E2', dot: '🔴', order: 0 },
  high: { label: 'Høy', color: '#EA580C', bg: '#FFEDD5', dot: '🟠', order: 1 },
  normal: { label: 'Normal', color: '#475569', bg: '#F1F5F9', dot: '⚪', order: 2 },
  low: { label: 'Lav', color: '#94A3B8', bg: '#F8FAFC', dot: '⚪', order: 3 },
};

const STATUS = {
  todo: { label: 'Ikke startet', color: '#64748B' },
  inprogress: { label: 'Pågår', color: '#2563EB' },
  awaiting: { label: 'Venter godkjenning', color: '#A855F7' },
  overdue: { label: 'Forsinket', color: '#DC2626' },
  done: { label: 'Ferdig', color: '#10B981' },
};

// === Manualskaper-draft ===
// Botsson har lyttet til en ansatt forklare rutinen og generert dette skjelettet.
// Per-blokk confidence: 'high' | 'med' | 'low' (low = trenger menneske)
const MANUAL_DRAFT = {
  id: 'd-pakning',
  title: 'Bytte pakning på Liebherr kjølskap',
  status: 'draft',
  source: {
    type: 'voice',
    label: 'Stemmeopptak fra Erik T.',
    duration: '7:42',
    capturedAt: '14. apr · 09:21',
    note: 'Erik forklarte rutinen mens han byttet pakning på Kjøl 3.',
  },
  meta: {
    folder: 'vedlikehold',
    tags: ['kjøling', 'vedlikehold'],
    estimatedReadTime: 6,
    author: 'Botsson · gjennomgått av Maria A.',
  },
  generatedAt: '14. apr · 09:34',
  overallConfidence: 0.82,
  sections: [
    {
      id: 'sec-1',
      title: 'Verktøy og forberedelse',
      blocks: [
        { id: 'b1', type: 'text', confidence: 'high', content: 'Du trenger stjerneskrutrekker PH2, ny pakning (artikkelnr 8201-44) og en spritklut.' },
        { id: 'b2', type: 'callout', tone: 'tip', confidence: 'med', content: 'Ta bilde av gammel pakning før du fjerner den — det gjør montering enklere.' },
        { id: 'b3', type: 'image', confidence: 'high', label: 'Verktøy lagt frem på benk', source: 'Klippet fra video 0:14' },
      ],
    },
    {
      id: 'sec-2',
      title: 'Demonter gammel pakning',
      blocks: [
        { id: 'b4', type: 'video', confidence: 'high', label: 'Demontering av pakning', duration: '2:18', source: 'Opptak fra Erik' },
        { id: 'b5', type: 'text', confidence: 'high', content: 'Trekk forsiktig fra øverste hjørne. Pakningen sitter i et spor — den kommer ut hele veien rundt uten verktøy.' },
        { id: 'b6', type: 'callout', tone: 'warning', confidence: 'low', content: 'Erik nevnte noe om at man må passe på en plastclips — usikker på hvor. Trenger bekreftelse.' },
      ],
    },
    {
      id: 'sec-3',
      title: 'Rens spor',
      blocks: [
        { id: 'b7', type: 'text', confidence: 'high', content: 'Bruk spritklut i hele sporet. Det skal være helt rent og tørt før montering.' },
        { id: 'b8', type: 'image', confidence: 'med', label: 'Rensing av spor', source: 'Klippet fra video 3:42' },
      ],
    },
    {
      id: 'sec-4',
      title: 'Monter ny pakning',
      blocks: [
        { id: 'b9', type: 'checklist', confidence: 'high', items: [
          'Start i øverste hjørne',
          'Trykk inn hele veien rundt med tommelen',
          'Sjekk at den ligger jevnt — ingen bølger',
          'Lukk dør og test sug med papirlapp',
        ]},
        { id: 'b10', type: 'evidence', confidence: 'high', kind: 'photo', content: 'Foto av ferdig montert pakning' },
      ],
    },
    {
      id: 'sec-5',
      title: 'Test og logg',
      blocks: [
        { id: 'b11', type: 'text', confidence: 'med', content: 'La skapet stå lukket i 30 minutter. Mål så temperaturen.' },
        { id: 'b12', type: 'evidence', confidence: 'high', kind: 'check', content: 'Bekreft at temperatur er innenfor +2°C til +4°C.' },
      ],
    },
  ],
};

// === Quiz-draft ===
// Botsson har lest menyen + onboarding-manualen og foreslått 11 spørsmål.
// Hvert spørsmål: type, kilde-ref, vekt, forklaring, confidence, media (valgfritt)
const QUIZ_DRAFT = {
  id: 'q-onboarding',
  title: 'Onboarding-quiz: Servitør dag 2',
  status: 'draft',
  source: {
    type: 'manual+menu',
    label: 'Manual «Servitør dag 2» + Meny vår 2026',
    capturedAt: '14. apr · 11:08',
    note: 'Botsson har lest 4 manualer og menyen, og foreslått 11 spørsmål med varierte svartyper.',
  },
  meta: {
    folder: 'onboarding',
    tags: ['ny-ansatt', 'servitør'],
    estimatedTime: 8,
    passingScore: 80,
    author: 'Botsson · ikke gjennomgått',
  },
  generatedAt: '14. apr · 11:14',
  questions: [
    {
      id: 'q1', type: 'single', confidence: 'high', weight: 1,
      prompt: 'Hva er minimumstemperaturen for varm servering?',
      source: 'Manual «Temperaturkontroll» · seksjon 3',
      options: ['+45°C', '+55°C', '+63°C', '+75°C'],
      correct: 2,
      explanation: 'Varm mat skal serveres ved minst +63°C ifølge HACCP-regelverket.',
    },
    {
      id: 'q2', type: 'multi', confidence: 'high', weight: 2,
      prompt: 'Hvilke av disse er allergener vi alltid må kunne svare på?',
      source: 'Manual «Servitør dag 2» · Allergener',
      options: ['Gluten', 'Vann', 'Laktose', 'Nøtter', 'Sukker', 'Skalldyr'],
      correct: [0, 2, 3, 5],
      explanation: 'Mattilsynet krever opplyst gluten, laktose, nøtter, skalldyr m.fl. Vann og sukker er ikke allergener.',
    },
    {
      id: 'q3', type: 'image-choice', confidence: 'med', weight: 1,
      prompt: 'Hvilket bord er sone B-3?',
      source: 'Manual «Servitør dag 2» · Bordkart',
      options: [
        { label: 'Vindusbord til venstre', placeholder: 'Bordkart A' },
        { label: 'Midt mot baren', placeholder: 'Bordkart B' },
        { label: 'Hjørnebord ved scenen', placeholder: 'Bordkart C' },
        { label: 'Bord på terrassen', placeholder: 'Bordkart D' },
      ],
      correct: 1,
      explanation: 'Sone B er midtsonen. B-3 er det tredje bordet sett fra inngangen.',
    },
    {
      id: 'q4', type: 'truefalse', confidence: 'high', weight: 1,
      prompt: 'Det er greit å servere fisk uten å spørre om allergi hvis gjesten ikke har nevnt det.',
      source: 'Manual «Servitør dag 2» · Allergener',
      correct: false,
      explanation: 'Du må alltid spørre om allergier før servering, spesielt med fisk og skalldyr.',
    },
    {
      id: 'q5', type: 'short-text', confidence: 'med', weight: 1,
      prompt: 'Hva heter dressingen vi serverer til dagens salat denne uken?',
      source: 'Meny vår 2026 · Uke 19',
      correctText: 'Sitron-tahini',
      explanation: 'Sitron-tahini er ukens dressing. Sjekk alltid ukens menyplan på morgenmøtet.',
    },
    {
      id: 'q6', type: 'long-text', confidence: 'low', weight: 2,
      prompt: 'Beskriv kort hvordan du håndterer en gjest som klager på maten.',
      source: 'Manual «Gjestehåndtering» (mangler — Botsson trenger menneske)',
      explanation: 'Vurderes manuelt av leder. Ingen automatisk fasit ennå.',
    },
    {
      id: 'q7', type: 'sort', confidence: 'high', weight: 2,
      prompt: 'Sett rekkefølgen for å åpne en flaske vin ved bordet.',
      source: 'Manual «Vinservice»',
      items: ['Vis etiketten til gjesten', 'Skjær folien', 'Trekk korken', 'Tørk flaskehalsen', 'La gjesten smake'],
      correctOrder: [0, 1, 2, 3, 4],
      explanation: 'Standard vinservice: presentere → skjære → trekke → tørke → la gjest smake.',
    },
    {
      id: 'q8', type: 'match', confidence: 'med', weight: 2,
      prompt: 'Match retten med riktig allergen-merking.',
      source: 'Meny vår 2026',
      pairs: [
        { left: 'Cæsarsalat', right: 'Egg + gluten' },
        { left: 'Risotto med scampi', right: 'Skalldyr + laktose' },
        { left: 'Tomatsuppe', right: 'Laktose' },
        { left: 'Sjokolademousse', right: 'Egg + laktose + nøtter' },
      ],
      explanation: 'Sjekk alltid menyens allergen-kolonne. Risotto har både skalldyr og laktose.',
    },
    {
      id: 'q9', type: 'scale', confidence: 'med', weight: 1,
      prompt: 'På en skala 1–5: hvor sikker føler du deg på kassesystemet?',
      source: 'Selvevaluering',
      min: 1, max: 5,
      labels: ['Helt fersk', 'Trenger mer øvelse', 'Greit', 'Trygg', 'Kan lære andre'],
      explanation: 'Selvevaluering — leder bruker dette til å planlegge mer øving.',
    },
    {
      id: 'q10', type: 'hotspot', confidence: 'med', weight: 2,
      prompt: 'Klikk på hvor brannslukkeren er plassert i kjøkkenet.',
      source: 'Manual «HMS» · Plantegning',
      placeholder: 'Plantegning av kjøkken',
      hotspot: { x: 72, y: 38, radius: 10 },
      explanation: 'Brannslukkeren henger ved utgangen til kjølerom — godt synlig fra hele kjøkkenet.',
    },
    {
      id: 'q11', type: 'number', confidence: 'high', weight: 1,
      prompt: 'Hvor mange minutter skal kjøttet hvile etter steking?',
      source: 'Manual «Stekeguide»',
      correctNumber: 5,
      tolerance: 1, unit: 'min',
      explanation: 'Kjøtt skal hvile 4–6 minutter for at saften skal sette seg.',
    },
  ],
};

// === Rutiner (proaktiv motor) ===
// A routine is an operational procedure that recurs on a trigger and generates
// real tasks in Oppgaver / Dagslinjen / Min dag. Each links to a procedure/manual,
// a handbook (book), an owner + responsible role, and a scope (team/role/location).
// completion = rolling on-time completion rate; behind = currently lagging.
const ROUTINES = [
  {
    id: 'r-temp', title: 'Daglig temperaturkontroll – kjøl & frys',
    category: 'ikmat',
    book: 'hms', chapter: 'Egenkontroll mat (IK-mat)', type: 'Egenkontroll',
    trigger: 'Hver dag kl. 08:00', cadence: 'Daglig', window: '08:00–09:00',
    scope: 'Lag · Kjøkken', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Kjøkkensjef', priority: 'critical', manual: 'm-temp',
    procedure: 'Mål temperatur → registrer avvik → varsle ansvarlig → dokumenter tiltak',
    steps: 5, evidence: true, active: true,
    lastRun: 'I dag 08:14', nextRun: 'I morgen 08:00', streak: 23, completion: 0.96, behind: false, task: 't1',
  },
  {
    id: 'r-apning', title: 'Åpningsrutine restaurant',
    category: 'apning',
    book: 'bedrift', chapter: 'Drift', type: 'Driftsrutine',
    trigger: 'Hver dag · ved åpning', cadence: 'Daglig', window: '09:00–10:00',
    scope: 'Område · Sal', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Skiftleder', priority: 'high', manual: null,
    procedure: 'Lys & musikk → kasseoppgjør → bordoppdekking → klargjør uteservering',
    steps: 8, evidence: false, active: true,
    lastRun: 'I dag 09:06', nextRun: 'I morgen 09:00', streak: 41, completion: 0.92, behind: false, task: 't8',
  },
  {
    id: 'r-lunsj', title: 'Lunsj-prep: salatbar & dagens',
    category: 'faste',
    book: 'bedrift', chapter: 'Kjøkken', type: 'Driftsrutine',
    trigger: 'Hver dag kl. 10:00', cadence: 'Måltid', window: '10:00–11:00',
    scope: 'Lag · Kjøkken', locations: 'Bistro Nord',
    owner: 'jh', responsible: 'Kokk', priority: 'high', manual: null,
    procedure: 'Følg menyplan → klargjør salatbar → dagens dressing → fyll toppinger',
    steps: 4, evidence: false, active: true,
    lastRun: 'I dag 10:12', nextRun: 'I morgen 10:00', streak: 12, completion: 0.88, behind: false, task: 't3',
  },
  {
    id: 'r-renhold', title: 'Renhold gjestetoaletter',
    category: 'vask',
    book: 'hms', chapter: 'Renhold & hygiene', type: 'Renhold',
    trigger: 'Hver dag · 2 ganger', cadence: 'Daglig', window: '10:30 / 16:00',
    scope: 'Rolle · Renhold', locations: 'Bistro Nord',
    owner: 'ib', responsible: 'Renholder', priority: 'normal', manual: 'm-renhold',
    procedure: 'Vask servant → vask gulv → fyll forbruk → sjekkpunkt-foto',
    steps: 4, evidence: true, active: true,
    lastRun: 'I går 16:20', nextRun: 'I dag 10:30', streak: 30, completion: 0.78, behind: true, task: 't5',
  },
  {
    id: 'r-kaffe', title: 'Ukesrengjøring av kaffemaskin',
    category: 'vedlikehold',
    book: 'bedrift', chapter: 'Vedlikehold', type: 'Vedlikehold',
    trigger: 'Hver søndag kl. 22:00', cadence: 'Ukentlig', window: '22:00–22:30',
    scope: 'Rolle · Bartender', locations: 'Bistro Nord',
    owner: 'pk', responsible: 'Bartender', priority: 'low', manual: 'm-kaffe',
    procedure: 'Deep-clean iht. manual → bytt filter → logg',
    steps: 6, evidence: true, active: true,
    lastRun: 'Søn 25/5 22:10', nextRun: 'Søn 1/6 22:00', streak: 8, completion: 1.0, behind: false, task: 't9',
  },
  {
    id: 'r-fett', title: 'Tøm fettutskiller',
    category: 'vedlikehold',
    book: 'hms', chapter: 'Egenkontroll mat (IK-mat)', type: 'Egenkontroll',
    trigger: 'Månedlig · 1. virkedag', cadence: 'Månedlig', window: 'Innen 16:00',
    scope: 'Rolle · Driftsleder', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Driftsleder', priority: 'normal', manual: null,
    procedure: 'Tøm → logg vekt → signer → arkiver kvittering',
    steps: 3, evidence: true, active: true,
    lastRun: 'I går 16:42', nextRun: '1. jul', streak: 6, completion: 1.0, behind: false, task: 't10',
  },
  {
    id: 'r-onboarding', title: 'Nyansatt onboarding & rolleopplæring',
    category: 'faste',
    book: 'personal', chapter: 'Onboarding', type: 'Opplæringsprotokoll',
    trigger: 'Ved ny ansettelse', cadence: 'Hendelse', window: 'Dag 1–5',
    scope: 'Rolle · ny ansatt', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Driftsleder', priority: 'high', manual: 'm-onboarding',
    procedure: 'Velkomst → system & rutiner → skygging → quiz → sertifisering',
    steps: 4, evidence: true, active: true,
    lastRun: 'Petter K. · dag 2', nextRun: 'Petter K. · dag 2 i dag', streak: 3, completion: 0.5, behind: false, task: 't4',
  },
  {
    id: 'r-leveranse', title: 'Mottakskontroll varelevering',
    category: 'ikmat',
    book: 'hms', chapter: 'Egenkontroll mat (IK-mat)', type: 'Egenkontroll',
    trigger: 'Ved levering · man/ons/fre', cadence: 'Hendelse', window: 'Ved ankomst',
    scope: 'Lag · Kjøkken', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Kjøkkensjef', priority: 'normal', manual: null,
    procedure: 'Sjekk temperatur → tell mot fraktbrev → signer → avvik ved feil',
    steps: 3, evidence: false, active: false,
    lastRun: 'Ons 28/5', nextRun: 'Pauset', streak: 0, completion: 0.0, behind: false, task: null,
  },
  {
    id: 'r-stenging', title: 'Stengerutine restaurant',
    category: 'stenging',
    book: 'bedrift', chapter: 'Drift', type: 'Driftsrutine',
    trigger: 'Hver dag · ved stenging', cadence: 'Daglig', window: '23:00–24:00',
    scope: 'Område · Sal', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Skiftleder', priority: 'high', manual: null,
    procedure: 'Kasseoppgjør → rydde & låse → slå av utstyr → sett alarm',
    steps: 7, evidence: false, active: true,
    lastRun: 'I går 23:48', nextRun: 'I dag 23:00', streak: 38, completion: 0.94, behind: false, task: null,
  },
  {
    id: 'r-brann', title: 'Brannrunde & rømningsveier',
    category: 'brann',
    book: 'hms', chapter: 'Brannvern', type: 'Vernerunde',
    trigger: 'Hver dag · før åpning', cadence: 'Daglig', window: '09:00–09:15',
    scope: 'Område · hele huset', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Brannvernleder', priority: 'critical', manual: null,
    procedure: 'Sjekk rømningsveier → slukkeutstyr → nødlys → kvitter runde',
    steps: 4, evidence: true, active: true,
    lastRun: 'I dag 09:02', nextRun: 'I morgen 09:00', streak: 41, completion: 0.98, behind: false, task: null,
  },
  {
    id: 'r-vern', title: 'Vernerunde HMS',
    category: 'vern',
    book: 'hms', chapter: 'Internkontroll HMS', type: 'Vernerunde',
    trigger: 'Månedlig · 1. mandag', cadence: 'Månedlig', window: 'Innen vaktslutt',
    scope: 'Område · hele huset', locations: 'Bistro Nord',
    owner: 'ma', responsible: 'Verneombud', priority: 'high', manual: null,
    procedure: 'Gå runde → registrer avvik → tiltaksplan → signer med verneombud',
    steps: 6, evidence: true, active: true,
    lastRun: 'Man 5/5', nextRun: 'Man 2/6', streak: 5, completion: 0.83, behind: true, task: null,
  },
];

// Routine categories — used for filtering on the Rutiner-fane.
const ROUTINE_CATEGORIES = {
  apning: { label: 'Åpning', icon: 'sun' },
  stenging: { label: 'Stenging', icon: 'moon' },
  ikmat: { label: 'IK-mat', icon: 'thermometer' },
  vern: { label: 'Vern & HMS', icon: 'shield' },
  brann: { label: 'Brannrunder', icon: 'flag' },
  vask: { label: 'Vask & renhold', icon: 'sparkle' },
  vedlikehold: { label: 'Vedlikehold', icon: 'settings' },
  faste: { label: 'Regelbundne', icon: 'repeat' },
};
// Intensitet (rekkefølge for filter-chips)
const ROUTINE_CADENCE = ['Daglig', 'Ukentlig', 'Månedlig', 'Måltid', 'Hendelse'];

// === Toppliste (uka) — hvem som har utført mest ===
const TASK_BOARD = [
  { id: 'jh', done: 47, ontime: 0.96, streak: 6 },
  { id: 'ma', done: 39, ontime: 1.0, streak: 9 },
  { id: 'ib', done: 34, ontime: 0.91, streak: 4 },
  { id: 'sl', done: 28, ontime: 0.89, streak: 2 },
  { id: 'pk', done: 21, ontime: 0.84, streak: 1 },
];

// =====================================================================
// CONTROL FORMS — schemas for the shared Flow Controller (kontroll).
// One source, consumed by BOTH web (OppFormViewer) and mobile (MFormViewer).
// Control types: tall (måling) · sjekk (ja/avvik) · vurdering · foto · qr · signatur.
// section.intro renders as a «Husk:»-callout (instruction). Reusable across
// Vern (vernerunde) · HMS · IK · Mat · innhenting (mottakskontroll).
// =====================================================================
const CONTROL_FORMS = {
  t1: {
    kind: 'Egenkontroll (IK-mat)', chapter: 'HMS › Egenkontroll mat', color: '#c2700c',
    sections: [
      { title: 'Kjøl og frys', qs: [
        { id: 'q1', type: 'tall', prompt: 'Kjøl 1 (grønnsak)', unit: '°C', max: 4 },
        { id: 'q2', type: 'tall', prompt: 'Kjøl 2 (kjøtt)', unit: '°C', max: 4 },
        { id: 'q3', type: 'tall', prompt: 'Kjøl 3 (meieri)', unit: '°C', max: 4 },
        { id: 'q4', type: 'tall', prompt: 'Frys 1', unit: '°C', max: -18 },
        { id: 'q5', type: 'sjekk', prompt: 'Dører lukker tett?' },
      ] },
      { title: 'Visuell kontroll', intro: 'termometeret skal stå minst 30 sek før avlesning, og kjøl/frys-dører skal alltid kunne lukkes tett.', qs: [
        { id: 'q6', type: 'foto', prompt: 'Foto av termometer på Kjøl 3', req: true },
        { id: 'q7', type: 'sjekk', prompt: 'Ingen synlig kondens eller is' },
        { id: 'q8', type: 'vurdering', prompt: 'Generell tilstand i kjøl/frys' },
      ] },
      { title: 'Sporbarhet og signering', qs: [
        { id: 'q9', type: 'qr', prompt: 'Skann QR på Kjøl 3 for å bekrefte enhet', code: 'KJØL-03' },
        { id: 'q10', type: 'signatur', prompt: 'Signer kontrollen', req: true },
      ] },
    ],
  },
};

const CONTROL_TEMPLATES = {
  vern: {
    kind: 'Vernerunde', chapter: 'HMS › Vernerunder og inspeksjoner', color: '#e7000b',
    sections: [
      { title: 'Rømning og brann', intro: 'nødutganger og rømningsveier skal alltid være frie og tydelig merket.', qs: [
        { id: 'v1', type: 'sjekk', prompt: 'Rømningsvei øst fri for hindringer' },
        { id: 'v2', type: 'sjekk', prompt: 'Rømningsvei vest fri for hindringer' },
        { id: 'v3', type: 'sjekk', prompt: 'Brannslukker på plass og trykk OK' },
        { id: 'v4', type: 'foto', prompt: 'Foto av merket rømningsvei', req: true },
      ] },
      { title: 'Ergonomi og maskinvern', qs: [
        { id: 'v5', type: 'sjekk', prompt: 'Vern på kjøkkenmaskiner montert' },
        { id: 'v6', type: 'vurdering', prompt: 'Ergonomi ved arbeidsstasjoner' },
        { id: 'v7', type: 'sjekk', prompt: 'Ingen skadde kabler eller kontakter' },
      ] },
      { title: 'Sporbarhet og signering', qs: [
        { id: 'v8', type: 'qr', prompt: 'Skann QR på vernerunde-sonen', code: 'VERN-SAL-01' },
        { id: 'v9', type: 'signatur', prompt: 'Signer vernerunden', req: true },
      ] },
    ],
  },
  mottak: {
    kind: 'Mottakskontroll', chapter: 'HMS › Egenkontroll mat', color: '#008388',
    sections: [
      { title: 'Ved levering', intro: 'kjølevarer skal være ≤ 4 °C ved mottak, frostvarer ≤ −18 °C. Avvik = ikke ta imot.', qs: [
        { id: 'm1', type: 'tall', prompt: 'Temperatur kjølevarer', unit: '°C', max: 4 },
        { id: 'm2', type: 'tall', prompt: 'Temperatur frostvarer', unit: '°C', max: -18 },
        { id: 'm3', type: 'sjekk', prompt: 'Emballasje hel og ren?' },
        { id: 'm4', type: 'sjekk', prompt: 'Holdbarhetsdato innenfor?' },
      ] },
      { title: 'Mengde og dokumentasjon', qs: [
        { id: 'm5', type: 'sjekk', prompt: 'Antall stemmer mot fraktbrev?' },
        { id: 'm6', type: 'foto', prompt: 'Foto av fraktbrev', req: true },
        { id: 'm7', type: 'qr', prompt: 'Skann følgeseddel-QR', code: 'BAMA-2026-0530' },
        { id: 'm8', type: 'signatur', prompt: 'Signer mottak', req: true },
      ] },
    ],
  },
  renhold: {
    kind: 'Renholdskontroll', chapter: 'HMS › Renhold & hygiene', color: '#11ad32',
    sections: [
      { title: 'Servant og flater', qs: [
        { id: 'r1', type: 'sjekk', prompt: 'Servant vasket og desinfisert' },
        { id: 'r2', type: 'sjekk', prompt: 'Speil og flater pusset' },
        { id: 'r3', type: 'vurdering', prompt: 'Generelt inntrykk' },
      ] },
      { title: 'Gulv og forbruk', intro: 'bruk riktig dosering desinfeksjon og sett ut «vått gulv»-skilt ved vask.', qs: [
        { id: 'r4', type: 'sjekk', prompt: 'Gulv vasket' },
        { id: 'r5', type: 'sjekk', prompt: 'Såpe og papir fylt opp' },
        { id: 'r6', type: 'foto', prompt: 'Sjekkpunkt-foto', req: true },
      ] },
      { title: 'Signering', qs: [
        { id: 'r7', type: 'signatur', prompt: 'Signer renholdssjekken', req: true },
      ] },
    ],
  },
  vedlikehold: {
    kind: 'Vedlikeholdslogg', chapter: 'HMS › Egenkontroll mat', color: '#864ad2',
    sections: [
      { title: 'Tømming', intro: 'fettutskiller tømmes månedlig, og vekt loggføres for sporbarhet.', qs: [
        { id: 'd1', type: 'tall', prompt: 'Vekt tømt fett', unit: 'kg', max: 50 },
        { id: 'd2', type: 'sjekk', prompt: 'Utskiller tømt helt' },
        { id: 'd3', type: 'foto', prompt: 'Foto etter tømming', req: true },
      ] },
      { title: 'Kontroll og signering', qs: [
        { id: 'd4', type: 'sjekk', prompt: 'Lokk og pakning intakt' },
        { id: 'd5', type: 'qr', prompt: 'Skann enhets-QR', code: 'FETT-01' },
        { id: 'd6', type: 'signatur', prompt: 'Signer vedlikehold', req: true },
      ] },
    ],
  },
};

function controlCat(task) {
  if (!task) return null;
  const s = ((task.title || '') + ' ' + (task.chapter || '') + ' ' + (task.cat || '')).toLowerCase();
  if (/vernerunde|rømning|inspeksjon|brannvern|brannrunde/.test(s)) return 'vern';
  if (/mottak|leveranse|varemottak|fraktbrev/.test(s)) return 'mottak';
  if (/renhold|hygiene|rengjør|dypvask|toalett/.test(s)) return 'renhold';
  if (/fettutskiller|vedlikehold|service|filter/.test(s)) return 'vedlikehold';
  if (/temperatur|kjøl|frys|ik-?mat|egenkontroll/.test(s)) return 'ikmat';
  return null;
}
function resolveControlForm(task) {
  if (!task) return null;
  if (CONTROL_FORMS[task.id]) return CONTROL_FORMS[task.id];
  const cat = controlCat(task);
  if (cat === 'ikmat') return CONTROL_FORMS.t1;        // IK-mat uses the rich reference schema
  return (cat && CONTROL_TEMPLATES[cat]) || null;
}

// =====================================================================
// CHAT (Meldinger) — the canonical shared chat model.
// ONE source consumed by BOTH web (ChatPanel/ChatInfo/ChatCard in shell.jsx)
// and mobile (MConversation/MChatInfo/MChatCard in apps/mobile/chat.jsx),
// so the two clients can never drift. ADR-0429 org vocabulary throughout.
// =====================================================================
const ROLE_LABEL = { employee: 'Ansatt', manager: 'Leder', admin: 'Admin', owner: 'Eier' };

// staff roster with org facets (Avdeling · Område · Lag · Tilgangsnivå)
const CHAT_STAFF = [
  { uid: 'ma', name: 'Maria A.', init: 'MA', c: '#FF7849', dept: 'Admin', loc: 'Restaurant', team: 'Morgen', role: 'manager', now: true, today: true, dates: ['tor', 'fre'] },
  { uid: 'jh', name: 'Jonas H.', init: 'JH', c: '#3B82F6', dept: 'BoH', loc: 'Kjøkken', team: 'Kveld', role: 'employee', now: true, today: true, dates: ['fre', 'lør'] },
  { uid: 'sl', name: 'Selma L.', init: 'SL', c: '#10B981', dept: 'FoH', loc: 'Restaurant', team: 'Kveld', role: 'employee', now: false, today: true, dates: ['tor', 'fre'] },
  { uid: 'pk', name: 'Petter K.', init: 'PK', c: '#A855F7', dept: 'Bar', loc: 'Bar', team: 'Helg', role: 'employee', now: true, today: true, dates: ['lør', 'søn'] },
  { uid: 'ib', name: 'Ida B.', init: 'IB', c: '#EAB308', dept: 'BoH', loc: 'Kjøkken', team: 'Morgen', role: 'employee', now: true, today: true, dates: ['tor'] },
  { uid: 'es', name: 'Erik S.', init: 'ES', c: '#ec4899', dept: 'BoH', loc: 'Kjøkken', team: 'Kveld', role: 'manager', now: false, today: true, dates: ['fre'] },
  { uid: 'ot', name: 'Ole T.', init: 'OT', c: '#864ad2', dept: 'Bar', loc: 'Bar', team: 'Kveld', role: 'employee', now: true, today: true, dates: ['fre', 'lør'] },
  { uid: 'kn', name: 'Kari N.', init: 'KN', c: '#14b8a6', dept: 'FoH', loc: 'Restaurant', team: 'Helg', role: 'employee', now: false, today: false, dates: ['lør', 'søn'] },
  { uid: 'sb', name: 'Sofia B.', init: 'SB', c: '#f472b6', dept: 'FoH', loc: 'Event-floor', team: 'Kveld', role: 'employee', now: false, today: false, dates: ['søn'] },
  { uid: 'nl', name: 'Nora L.', init: 'NL', c: '#38bdf8', dept: 'BoH', loc: 'Lager', team: 'Morgen', role: 'employee', now: true, today: true, dates: ['tor', 'fre'] },
];
const CHAT_FACETS = [
  { key: 'dept', label: 'Avdeling', opts: ['FoH', 'BoH', 'Bar', 'Admin'] },
  { key: 'loc', label: 'Område', opts: ['Restaurant', 'Kjøkken', 'Bar', 'Lager', 'Event-floor'] },
  { key: 'team', label: 'Lag', opts: ['Morgen', 'Kveld', 'Helg'] },
  { key: 'role', label: 'Tilgangsnivå', opts: ['employee', 'manager', 'admin', 'owner'] },
];
const CHAT_DATES = [['tor', 'Tor 30'], ['fre', 'Fre 31'], ['lør', 'Lør 1'], ['søn', 'Søn 2']];
const CHAT_AUD_MODES = [
  { id: 'group', ic: 'users', ttl: 'Gruppechat', desc: 'Velg medlemmer manuelt' },
  { id: 'now', ic: 'clock', ttl: 'På vakt nå', desc: 'Alle som jobber akkurat nå', live: true },
  { id: 'today', ic: 'calendar', ttl: 'På vakt i dag', desc: 'Alle med vakt i dag' },
  { id: 'date', ic: 'calendar', ttl: 'Bestemt dato', desc: 'Alle med vakt en valgt dag' },
];
const CHAT_PIN_OPTS = [['1t', '1 time'], ['8t', '8 timer'], ['24t', 'Til i morgen'], ['7d', '7 dager'], ['alltid', 'Alltid'], ['egen', 'Egendefinert…']];

// real shared-attachment cards, keyed by the attach-menu label
const CHAT_CARD_SAMPLES = {
  Bilde: { type: 'image', title: 'Kjøl 3 – løs pakning', dim: '1280 × 960' },
  Video: { type: 'video', title: 'Riktig plassering av termometer', dur: '1:42' },
  Event: { type: 'event', title: 'Vinsmaking – nye naturviner', when: 'Tor 30. mai · 18:00', loc: 'Restaurant', going: ['JH', 'SL', 'PK'], goingN: 12, c: '#00ab93' },
  Booking: { type: 'booking', guest: 'Familien Berg', pax: 4, table: 'Bord 12', when: 'I dag · 19:30', c: '#c18200' },
  Oppgave: { type: 'task', title: 'Temperaturkontroll – kjøl & frys', due: '08:00 · forsinket', folder: 'HMS & IK-mat', fc: '#DC2626', status: 'Forsinket', tone: 'crit' },
  Vakt: { type: 'shift', role: 'Kokk', when: 'Fre 31. mai · 17–23', dept: 'Kjøkken · BoH', c: '#ee560c', status: 'Ledig', tone: 'warn' },
  Manual: { type: 'manual', title: 'Temperaturkontroll – standard prosedyre', meta: 'v2.4 · 4 min lesing' },
  Dokument: { type: 'doc', title: 'IK-mat internkontroll 2026.pdf', ext: 'PDF', size: '1,8 MB', pages: '12 sider' },
  Quiz: { type: 'quiz', title: 'Onboarding-quiz: Servitør dag 2', meta: '11 spørsmål · bestått 80 %' },
  Spørring: { type: 'poll', q: 'Hvem kan ta lørdagsvakten 17–23?', opts: [['Jonas H.', 3], ['Selma L.', 1], ['Kan ikke', 1]] },
};
// attach-menu layout (icon, label, isMedia) — shared so both clients show the same menu
const CHAT_ATTACH_MENU = [
  ['camera', 'Bilde', true], ['video', 'Video', true],
  ['calendar', 'Event'], ['users', 'Booking'], ['list', 'Oppgave'], ['grid', 'Vakt'],
  ['book', 'Manual'], ['file', 'Dokument'], ['help', 'Quiz'], ['checkdoc', 'Spørring'],
];

const CHAT_CONVS = [
  { id: 'team-kjokken', type: 'group', name: 'Kjøkken-teamet', sub: '5 medlemmer', c: '#ee560c', online: true },
  { id: 'jh', type: 'dm', uid: 'jh', online: true },
  { id: 'alle', type: 'group', name: 'Alle ansatte', sub: '12 medlemmer', c: '#864ad2', online: false },
  { id: 'pk', type: 'dm', uid: 'pk', online: true },
  { id: 'sl', type: 'dm', uid: 'sl', online: false },
  { id: 'ib', type: 'dm', uid: 'ib', online: false },
];
const CHAT_UNREAD = { 'team-kjokken': 3, jh: 2 };
const CHAT_THREADS = {
  'team-kjokken': [
    { from: 'me', text: 'God morgen team. Husk temperaturkontroll før åpning.', time: '07:05' },
    { from: 'ib', text: 'På plass. Starter med kjøl nå.', time: '07:48' },
    { from: 'jh', text: 'Husk å sjekke pakningen på Kjøl 3, den var løs i går.', time: '08:21' },
    { from: 'jh', card: { type: 'image', title: 'Kjøl 3 – løs pakning', dim: '1280 × 960' }, time: '08:22' },
    { from: 'me', text: 'Bra fanget. Jeg legger inn et avvik og en oppgave.', time: '08:25' },
    { from: 'me', card: { type: 'task', title: 'Temperaturkontroll – kjøl & frys', due: '08:00 · forsinket', folder: 'HMS & IK-mat', fc: '#DC2626', status: 'Forsinket', tone: 'crit' }, time: '08:25' },
  ],
  jh: [
    { from: 'jh', text: 'Morn! Kjøl 3 viser fortsatt +5 grader.', time: '08:12' },
    { from: 'me', text: 'Takk. Jeg er på vei ned for å se på pakningen.', time: '08:13' },
    { from: 'jh', text: 'Skal jeg ta kveldsvakten på fredag? Ser den er ledig.', time: '08:18' },
    { from: 'me', card: { type: 'shift', role: 'Kokk', when: 'Fre 31. mai · 17–23', dept: 'Kjøkken · BoH', c: '#ee560c', status: 'Ledig', tone: 'warn' }, time: '08:19' },
  ],
  alle: [{ from: 'me', text: 'God morgen alle sammen. Fin dag i vente.', time: '07:30' }],
  pk: [
    { from: 'pk', text: 'Kan du godkjenne timene mine for lørdag?', time: 'i går' },
    { from: 'me', text: 'Godkjent. Bra jobba på helgevakten.', time: 'i går' },
  ],
  sl: [{ from: 'sl', text: 'Takk for i dag. Ses i morgen.', time: 'i går' }],
  ib: [{ from: 'ib', text: 'Gjestetoalettene er ferdig rengjort.', time: 'ons' }],
};

window.SmartoutData = { USERS, ME, FOLDERS, TAGS, ORIGIN, TASKS, MANUALS, MANUAL_DRAFT, QUIZ_DRAFT, PRIORITY, STATUS, ROUTINES, TASK_BOARD, ROUTINE_CATEGORIES, ROUTINE_CADENCE, CONTROL_FORMS, CONTROL_TEMPLATES, controlCat, resolveControlForm,
  ROLE_LABEL, CHAT_STAFF, CHAT_FACETS, CHAT_DATES, CHAT_AUD_MODES, CHAT_PIN_OPTS, CHAT_CARD_SAMPLES, CHAT_ATTACH_MENU, CHAT_CONVS, CHAT_UNREAD, CHAT_THREADS };
