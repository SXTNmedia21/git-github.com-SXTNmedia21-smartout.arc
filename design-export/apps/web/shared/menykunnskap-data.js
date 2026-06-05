// ===== Menykunnskap — domain data =====
// Extends window.SmartoutData with the menu-knowledge / staff-training world for
// Bistro Nord. Plain script (load before the babel files). Norwegian (bokmål).
// Cast stays consistent with shared/data.js (Maria, Jonas, Selma, Petter, Ida) and
// adds a few servers so the leaderboard reads richly.
(function () {
  const D = (window.SmartoutData = window.SmartoutData || {});

  // ---------- allergens (EU 14, the relevant subset) ----------
  // non-color-only: every chip carries a short code + label
  const ALLERGENS = {
    gluten:   { code: "GL", label: "Gluten" },
    skalldyr: { code: "SK", label: "Skalldyr" },
    blotdyr:  { code: "BD", label: "Bløtdyr" },
    egg:      { code: "EG", label: "Egg" },
    fisk:     { code: "FI", label: "Fisk" },
    melk:     { code: "ME", label: "Melk" },
    notter:   { code: "NØ", label: "Nøtter" },
    selleri:  { code: "SE", label: "Selleri" },
    sennep:   { code: "SN", label: "Sennep" },
    sulfitt:  { code: "SU", label: "Sulfitt" },
    soya:     { code: "SO", label: "Soya" },
  };

  // ---------- menus (cards on the dashboard) ----------
  const MENUS = [
    { id: "vinter-mat",  name: "Vintermeny — mat",   kind: "mat",     icon: "utensils", items: 14, coverage: 92, ready: 7, total: 11, avg: 87, updated: "i går", source: "foto",  status: "publisert", review: 1 },
    { id: "vinkart",     name: "Vinkart",            kind: "vin",      icon: "wallet",   items: 22, coverage: 78, ready: 5, total: 11, avg: 74, updated: "3 dager", source: "pdf",   status: "publisert", review: 4 },
    { id: "cocktail",    name: "Cocktailkart",       kind: "cocktail", icon: "coffee",   items: 9,  coverage: 88, ready: 6, total: 11, avg: 81, updated: "5 dager", source: "tekst", status: "publisert", review: 0 },
    { id: "lunsj",       name: "Lunsjmeny — uke 22",  kind: "mat",     icon: "utensils", items: 8,  coverage: 41, ready: 0, total: 11, avg: 0,  updated: "i dag",   source: "foto",  status: "ekstraherer", review: 0 },
    { id: "ol",          name: "Ølkart",             kind: "ol",       icon: "coffee",   items: 11, coverage: 64, ready: 4, total: 11, avg: 69, updated: "2 uker",  source: "lenke", status: "utkast",    review: 2 },
  ];

  const KIND_LABEL = { mat: "Mat", vin: "Vin", cocktail: "Cocktail", ol: "Øl", dessert: "Dessert" };
  const SOURCE_LABEL = { foto: "Foto", pdf: "PDF", lenke: "Lenke", tekst: "Tekst", manuell: "Manuelt", svar: "Leders svar" };
  const SOURCE_ICON = { foto: "camera", pdf: "file", lenke: "link", tekst: "pen", manuell: "pen", svar: "message" };

  // ---------- dish / drink knowledge cards (knowledge base) ----------
  // facts[].conf 0–100, source ∈ SOURCE_LABEL, verified bool. unverified+lowconf surfaces in the verify queue.
  const DISHES = [
    {
      id: "ribeye", menu: "vinter-mat", kind: "mat", name: "Grillet ribeye",
      category: "Hovedrett", price: 389, station: "Grill",
      desc: "Grillet ribeye med brunet smør-poteter, peppersaus og syltet rødløk.",
      allergens: ["melk", "sennep", "sulfitt"],
      ingredients: ["Ribeye 300 g", "Mandelpotet", "Brunet smør", "Grønn pepper", "Fløte", "Syltet rødløk"],
      pairing: "Pinot Noir, Burgund", upsell: "Foreslå et glass Pinot Noir — fyldig nok for grillsmaken.",
      story: "Kjøttet er fra Røros-trakter, mørnet 30 dager. Vi griller det over bøk.",
      coverage: 96,
      facts: [
        { id: "f1", label: "Grilltid før hvile", value: "4 min per side, hviler 6 min", conf: 62, source: "svar", verified: true, q: true },
        { id: "f2", label: "Tilberedningsgrad (standard)", value: "Medium (rosa kjerne)", conf: 88, source: "foto", verified: true },
        { id: "f3", label: "Saus laget in-house", value: "Ja — peppersaus kokes på huset", conf: 70, source: "svar", verified: true },
        { id: "f4", label: "Opprinnelse kjøtt", value: "Røros, 30 dagers mørning", conf: 95, source: "svar", verified: true },
      ],
    },
    {
      id: "torsk", menu: "vinter-mat", kind: "mat", name: "Arktisk torsk",
      category: "Hovedrett", price: 345, station: "Varm",
      desc: "Arktisk skreitorsk med blåskjellsaus, dilljolje og sesonggrønnsaker.",
      allergens: ["fisk", "blotdyr", "melk"],
      ingredients: ["Skrei (linefanget)", "Blåskjell", "Dill", "Fløte", "Hvitvin", "Sesonggrønnsaker"],
      pairing: "Riesling Kabinett, Mosel", upsell: "Riesling Kabinett løfter syren i blåskjellsausen.",
      story: "Skreien er linefanget i Lofoten — vi får den fersk to ganger i uka. Det er det som gjør den vår.",
      coverage: 90,
      flag: "allergen",
      facts: [
        { id: "f1", label: "Allergen å fremheve", value: "Bløtdyr (blåskjell) + fisk", conf: 98, source: "foto", verified: true, allergen: true },
        { id: "f2", label: "Hva gjør den lokalt særegen", value: "Linefanget skrei fra Lofoten, fersk 2× i uka", conf: 74, source: "svar", verified: true, q: true },
        { id: "f3", label: "Blåskjellsaus in-house", value: "Ja", conf: 80, source: "svar", verified: true },
        { id: "f4", label: "Kan tilberedes uten melk?", value: "Nei — sausen er fløtebasert", conf: 55, source: "manuell", verified: false, q: true },
      ],
    },
    {
      id: "risotto", menu: "vinter-mat", kind: "mat", name: "Viltsopprisotto",
      category: "Hovedrett", price: 295, station: "Varm",
      desc: "Viltsopprisotto med lagret parmesan og sprø grønnkål.",
      allergens: ["melk", "selleri", "sulfitt"],
      ingredients: ["Carnaroli-ris", "Kantarell & sjampinjong", "Lagret parmesan", "Grønnkål", "Hvitvin", "Grønnsakskraft"],
      pairing: "Pinot Noir, Burgund", upsell: "Vegetarisk — anbefal Pinot Noir eller alkoholfri eplemost.",
      story: "Soppen plukkes lokalt om høsten og fryses ned — vi bruker vår egen kraft.",
      coverage: 84, vegetar: true,
      facts: [
        { id: "f1", label: "Vegetarisk", value: "Ja (inneholder melk/parmesan)", conf: 92, source: "foto", verified: true },
        { id: "f2", label: "Beste vinparing", value: "Pinot Noir, Burgund", conf: 86, source: "manuell", verified: true, q: true },
        { id: "f3", label: "Parmesan = animalsk løpe", value: "Ja — ikke for streng vegetarianer", conf: 60, source: "svar", verified: false },
      ],
    },
    {
      id: "burger", menu: "vinter-mat", kind: "mat", name: "Husets burger",
      category: "Hovedrett", price: 265, station: "Grill",
      desc: "Husets burger med røkt cheddar, aioli og pommes frites.",
      allergens: ["gluten", "melk", "egg", "sennep"],
      ingredients: ["Storfekjøtt 180 g", "Briochebrød", "Røkt cheddar", "Aioli", "Sylteagurk", "Pommes frites"],
      pairing: "Lokal IPA", upsell: "Lokal IPA er den klassiske matchen — nevn den til ølfolket.",
      story: "Burgerbrødet bakes av vårt eget bakeri tre kvartaler unna.",
      coverage: 88,
      facts: [
        { id: "f1", label: "Standard stekegrad", value: "Gjennomstekt (medium på forespørsel)", conf: 90, source: "foto", verified: true },
        { id: "f2", label: "Aioli in-house", value: "Ja — inneholder rå egg", conf: 76, source: "svar", verified: true, allergen: true },
        { id: "f3", label: "Glutenfritt brød mulig", value: "Ja, må bestilles", conf: 68, source: "manuell", verified: true },
      ],
    },
    {
      id: "pannacotta", menu: "vinter-mat", kind: "dessert", name: "Multekrem panna cotta",
      category: "Dessert", price: 145, station: "Kald",
      desc: "Panna cotta med multekrem og havrecrumble.",
      allergens: ["melk", "gluten"],
      ingredients: ["Fløte", "Vanilje", "Multe", "Havrecrumble", "Gelatin"],
      pairing: "Riesling (søt) eller iste", upsell: "Avslutt måltidet med et glass søt Riesling.",
      story: "Multene er håndplukket på Hardangervidda av leverandøren vår, Fjellbær AS.",
      coverage: 79,
      facts: [
        { id: "f1", label: "Inneholder gelatin", value: "Ja — ikke vegetarisk", conf: 84, source: "foto", verified: true },
        { id: "f2", label: "Leverandør multe", value: "Fjellbær AS, Hardangervidda", conf: 70, source: "svar", verified: true, q: true },
        { id: "f3", label: "Glutenfri variant", value: "Uavklart — crumble inneholder havre", conf: 40, source: "manuell", verified: false, q: true },
      ],
    },
  ];

  const DRINKS = [
    {
      id: "riesling", menu: "vinkart", kind: "vin", name: "Riesling Kabinett",
      category: "Hvitvin", price: 128, priceTier: "Glass / flaske", glass: true,
      region: "Mosel, Tyskland", grape: "Riesling", notes: "Sitrus, eple, mineralsk, lett restsøtlig.",
      pairing: "Arktisk torsk, skalldyr", upsell: "Selg som glass til torsken — naturlig match.",
      story: "Vår husriesling fra en liten produsent i Mosel — alltid på glass.",
      coverage: 82,
      facts: [
        { id: "f1", label: "Tilgjengelig på glass", value: "Ja — 128 kr", conf: 96, source: "pdf", verified: true },
        { id: "f2", label: "Restsødme", value: "Lett (off-dry)", conf: 64, source: "lenke", verified: true, q: true },
        { id: "f3", label: "Beste matparing", value: "Torsk, skalldyr, krydret mat", conf: 80, source: "manuell", verified: true },
      ],
    },
    {
      id: "pinot", menu: "vinkart", kind: "vin", name: "Pinot Noir",
      category: "Rødvin", price: 145, priceTier: "Glass / flaske", glass: true,
      region: "Burgund, Frankrike", grape: "Pinot Noir", notes: "Røde bær, jordtoner, silkemyke tanniner.",
      pairing: "Ribeye, viltsopprisotto", upsell: "Trygg anbefaling til både kjøtt og sopp.",
      story: "",
      coverage: 71,
      facts: [
        { id: "f1", label: "Tilgjengelig på glass", value: "Ja — 145 kr", conf: 90, source: "pdf", verified: true },
        { id: "f2", label: "Tjenestetemperatur", value: "14–16 °C", conf: 58, source: "lenke", verified: false, q: true },
        { id: "f3", label: "Druetype", value: "100 % Pinot Noir", conf: 88, source: "pdf", verified: true },
      ],
    },
    {
      id: "espresso", menu: "cocktail", kind: "cocktail", name: "Espresso Martini",
      category: "Cocktail", price: 165, method: "Ristet", glass: false,
      ingredients: ["Vodka", "Kaffelikør", "Espresso", "Sukkerlake"], garnish: "3 kaffebønner",
      glassware: "Coupe", profile: "Kraftig, ristet, bittersøt",
      pairing: "Dessert / etter middag", upsell: "Perfekt i stedet for dessert.",
      story: "Vi bruker espresso fra vår egen bønnebrenner.",
      coverage: 90,
      facts: [
        { id: "f1", label: "Ristet eller rørt", value: "Ristet (for skummet topp)", conf: 94, source: "tekst", verified: true, q: true },
        { id: "f2", label: "Glass", value: "Coupe", conf: 90, source: "tekst", verified: true },
        { id: "f3", label: "Garnityr", value: "3 kaffebønner", conf: 86, source: "tekst", verified: true },
      ],
    },
    {
      id: "negroni", menu: "cocktail", kind: "cocktail", name: "Nordic Negroni",
      category: "Cocktail", price: 158, method: "Rørt", glass: false,
      ingredients: ["Akevitt", "Campari", "Søt vermut"], garnish: "Appelsinskall",
      glassware: "Tumbler m/ isklump", profile: "Bitter, urtete, sterk",
      pairing: "Aperitiff", upsell: "Vår vri — akevitt i stedet for gin.",
      story: "Vår signaturvri: norsk akevitt erstatter ginen.",
      coverage: 86,
      facts: [
        { id: "f1", label: "Rørt eller ristet", value: "Rørt — aldri ristet", conf: 96, source: "tekst", verified: true, q: true },
        { id: "f2", label: "Vri på original", value: "Akevitt erstatter gin", conf: 88, source: "svar", verified: true, q: true },
        { id: "f3", label: "Glass", value: "Tumbler med stor isklump", conf: 84, source: "tekst", verified: true },
      ],
    },
    {
      id: "ipa", menu: "ol", kind: "ol", name: "Lokal IPA",
      category: "Tappeøl", price: 109, glass: true,
      region: "Grünerløkka Bryggeri", profile: "Sitrus, humle, middels bitter (5,8 %)",
      pairing: "Husets burger", upsell: "Klassisk burger-match.",
      story: "Brygget tre kilometer unna — vi bytter sesongbrygg hver måned.",
      coverage: 64,
      facts: [
        { id: "f1", label: "Alkoholprosent", value: "5,8 %", conf: 92, source: "lenke", verified: true },
        { id: "f2", label: "Bryggeri", value: "Grünerløkka Bryggeri, Oslo", conf: 80, source: "lenke", verified: true, q: true },
        { id: "f3", label: "På fat", value: "Ja", conf: 70, source: "lenke", verified: false },
      ],
    },
  ];

  // ---------- staff readiness / leaderboard ----------
  // status: topp | klar | retake | ikke-klar  (non-color-only labels used in UI)
  const MK_STAFF = [
    { id: "ev", name: "Emil V.",   initials: "EV", color: "#0EA5E9", role: "Servitør", score: 100, status: "topp",     streak: 12, completed: 5, required: 5, last: "i dag", weak: null,           menusDone: ["vinter-mat", "vinkart", "cocktail"] },
    { id: "ar", name: "Amalie R.", initials: "AR", color: "#EC4899", role: "Servitør", score: 96,  status: "klar",     streak: 8,  completed: 5, required: 5, last: "i dag", weak: null,           menusDone: ["vinter-mat", "vinkart", "cocktail"] },
    { id: "sl", name: "Selma L.",  initials: "SL", color: "#10B981", role: "Servitør", score: 91,  status: "klar",     streak: 5,  completed: 4, required: 5, last: "i går", weak: "Cocktail",     menusDone: ["vinter-mat", "vinkart"] },
    { id: "jh", name: "Jonas H.",  initials: "JH", color: "#3B82F6", role: "Kokk",      score: 88,  status: "retake",   streak: 3,  completed: 4, required: 5, last: "i går", weak: "Vinkart",      menusDone: ["vinter-mat"] },
    { id: "pk", name: "Petter K.", initials: "PK", color: "#A855F7", role: "Servitør", score: 74,  status: "ikke-klar", streak: 0, completed: 2, required: 5, last: "4 dager", weak: "Allergener",  menusDone: [] },
    { id: "sm", name: "Sara M.",   initials: "SM", color: "#F59E0B", role: "Servitør", score: 61,  status: "ikke-klar", streak: 0, completed: 1, required: 5, last: "6 dager", weak: "Vinkart",     menusDone: [] },
  ];

  // ---------- quiz model ----------
  const QTYPES = {
    flervalg:   { label: "Flervalg",        icon: "list" },
    sveip:      { label: "Sveip (sant/usant)", icon: "swap" },
    allergen:   { label: "Finn allergenet", icon: "alert" },
    match:      { label: "Koble rett til ingrediens", icon: "layers" },
    anbefaling: { label: "Beste anbefaling", icon: "star" },
    timing:     { label: "Tilberedningstid", icon: "timer" },
    pairing:    { label: "Vinparing",        icon: "wallet" },
    scenario:   { label: "Servicescenario",  icon: "users" },
    lyn:        { label: "Lynrunde",          icon: "zap" },
  };

  // builder rounds (quiz builder preview)
  const QUIZ_ROUNDS = [
    { id: "r1", title: "Oppvarming",        type: "sveip",      n: 4, diff: "Lett",     time: 1 },
    { id: "r2", title: "Retter & råvarer",  type: "match",      n: 5, diff: "Middels",  time: 3 },
    { id: "r3", title: "Allergener",        type: "allergen",   n: 4, diff: "Middels",  time: 2 },
    { id: "r4", title: "Vin & drikke",      type: "pairing",    n: 4, diff: "Middels",  time: 2 },
    { id: "r5", title: "Gjest & service",   type: "scenario",   n: 3, diff: "Vanskelig", time: 3 },
    { id: "r6", title: "Lynrunde",          type: "lyn",        n: 6, diff: "Blandet",  time: 1 },
  ];

  // the playable staff quiz (subset, with teaching feedback)
  const QUIZ_QUESTIONS = [
    {
      id: "q1", type: "sveip", round: "Oppvarming",
      prompt: "Nordic Negroni røres — den ristes aldri.",
      dish: "negroni",
      answer: true,
      options: [{ k: true, t: "Sant" }, { k: false, t: "Usant" }],
      teach: "Riktig. En Negroni røres alltid for å beholde klarhet og styrke. Risting tilfører luft og gjør den uklar.",
    },
    {
      id: "q2", type: "allergen", round: "Allergener",
      prompt: "Hvilket allergen MÅ du nevne for Arktisk torsk?",
      dish: "torsk",
      options: [{ k: "a", t: "Nøtter" }, { k: "b", t: "Bløtdyr (blåskjell)" }, { k: "c", t: "Soya" }, { k: "d", t: "Sennep" }],
      answer: "b",
      teach: "Blåskjell er bløtdyr — et av de 14 merkepliktige allergenene. Retten inneholder også fisk og melk (fløtesaus).",
    },
    {
      id: "q3", type: "pairing", round: "Vin & drikke",
      prompt: "Hva er beste vinparing til viltsopprisottoen?",
      dish: "risotto",
      options: [{ k: "a", t: "Pinot Noir, Burgund" }, { k: "b", t: "Champagne brut" }, { k: "c", t: "Riesling Kabinett" }, { k: "d", t: "Amarone" }],
      answer: "a",
      teach: "Pinot Noir har jordtoner og myke tanniner som matcher soppens umami uten å overdøve risottoen.",
    },
    {
      id: "q4", type: "anbefaling", round: "Gjest & service",
      prompt: "En førstegangsgjest spør hvordan ribeyen er. Hva sier du?",
      dish: "ribeye",
      options: [
        { k: "a", t: "«Det er en biff med poteter.»" },
        { k: "b", t: "«300 g ribeye fra Røros, 30 dagers mørning, grillet over bøk — vi serverer den medium.»" },
        { k: "c", t: "«Vet ikke helt, skal jeg sjekke?»" },
        { k: "d", t: "«Den er litt seig, ta heller fisken.»" },
      ],
      answer: "b",
      teach: "Konkret historie + opprinnelse + tilberedning skaper tillit og selger retten. Nevn gjerne et glass Pinot Noir til.",
    },
    {
      id: "q5", type: "match", round: "Retter & råvarer",
      prompt: "Hva gjør Bistro Nords torsk lokalt særegen?",
      dish: "torsk",
      options: [
        { k: "a", t: "Den er frossen og importert" },
        { k: "b", t: "Linefanget skrei fra Lofoten, levert fersk to ganger i uka" },
        { k: "c", t: "Den paneres og friteres" },
        { k: "d", t: "Den serveres rå" },
      ],
      answer: "b",
      teach: "Det er ferskheten og opprinnelsen som er historien — linefanget skrei fra Lofoten, to leveranser i uka.",
    },
    {
      id: "q6", type: "timing", round: "Lynrunde",
      prompt: "Hvor lenge hviler ribeyen etter grilling?",
      dish: "ribeye",
      options: [{ k: "a", t: "0 min — serveres rett fra grillen" }, { k: "b", t: "6 min" }, { k: "c", t: "20 min" }],
      answer: "b",
      teach: "6 minutters hvile lar kjøttsaften fordele seg. Maria bekreftet dette i verifiseringen.",
    },
  ];

  // ---------- AI extraction stages (the «Botsson leser menyen» screen) ----------
  const EXTRACT_STAGES = [
    { id: "read",     label: "Leser kilde",            detail: "Foto · 2 sider",          done: true,  count: null },
    { id: "kat",      label: "Kjenner igjen kategorier", detail: "Forrett · Hovedrett · Dessert", done: true, count: 3 },
    { id: "retter",   label: "Finner retter",          detail: "8 retter identifisert",    done: true,  count: 8 },
    { id: "ingred",   label: "Trekker ut ingredienser", detail: "Per rett",                done: true,  count: 41 },
    { id: "allergen", label: "Markerer allergener",    detail: "Antyder fra ingredienser", done: true,  count: 12, warn: true },
    { id: "pris",     label: "Leser priser",           detail: "7 av 8 funnet",            done: true,  count: 7,  warn: true },
    { id: "pairing",  label: "Foreslår paringer",      detail: "Mot vinkartet",            done: false, count: 5 },
    { id: "mangler",  label: "Flagger mangler",        detail: "Det Botsson er usikker på", done: false, count: 4 },
  ];

  // structured cards resolved out of the scan (extraction result preview)
  const EXTRACT_ITEMS = [
    { id: "e1", name: "Grillet ribeye",       cat: "Hovedrett", price: 389, conf: 96, allergens: ["melk", "sennep"], status: "sikker" },
    { id: "e2", name: "Arktisk torsk",        cat: "Hovedrett", price: 345, conf: 92, allergens: ["fisk", "blotdyr"], status: "sikker" },
    { id: "e3", name: "Viltsopprisotto",      cat: "Hovedrett", price: 295, conf: 84, allergens: ["melk"], status: "sjekk" },
    { id: "e4", name: "Husets burger",        cat: "Hovedrett", price: 265, conf: 88, allergens: ["gluten", "melk", "egg"], status: "sikker" },
    { id: "e5", name: "Multekrem panna cotta", cat: "Dessert",   price: 145, conf: 79, allergens: ["melk"], status: "sjekk" },
    { id: "e6", name: "Dagens suppe",         cat: "Forrett",   price: null, conf: 44, allergens: [], status: "mangler" },
  ];

  // ---------- conversational verification interview ----------
  // kind: bekreft (confirm assumption) · korriger (fix) · utvid (local knowledge)
  const VERIFY_QUESTIONS = [
    {
      id: "v1", kind: "bekreft", dish: "ribeye",
      q: "Jeg antar ribeyen serveres medium som standard. Stemmer det?",
      why: "Lest fra menybildet «rosa kjerne». Servitører bør vite standardgraden.",
      src: ["Menyfoto", "Kategori: Hovedrett"],
      assumption: "Medium (rosa kjerne)",
      kind_options: [{ k: "ja", t: "Ja, stemmer" }, { k: "nei", t: "Nei, juster" }],
    },
    {
      id: "v2", kind: "utvid", dish: "ribeye",
      q: "Hvor lenge grilles ribeyen før den hviler? Dette spør gjester ofte om.",
      why: "Fant ingen tilberedningstid i kilden. Gjør quizen mer presis.",
      src: ["Mangler i kilde"],
      placeholder: "F.eks. 4 min per side, hviler 6 min",
    },
    {
      id: "v3", kind: "korriger", dish: "torsk",
      q: "Jeg markerte bløtdyr og fisk som allergener for torsken. Er det noe jeg har glemt?",
      why: "Allergener er sikkerhetskritisk — jeg ber alltid om bekreftelse før publisering.",
      src: ["Ingrediens: blåskjell", "Ingrediens: fløte"],
      assumption: "Bløtdyr, fisk, melk",
      kind_options: [{ k: "ja", t: "Riktig markert" }, { k: "nei", t: "Legg til/fjern" }],
      critical: true,
    },
    {
      id: "v4", kind: "utvid", dish: "torsk",
      q: "Hva gjør fiskeretten deres annerledes enn en standard torskerett?",
      why: "Lokal historie gjør at staben selger retten med selvtillit.",
      src: ["Lokal kunnskap"],
      placeholder: "F.eks. linefanget skrei fra Lofoten, fersk 2× i uka",
    },
    {
      id: "v5", kind: "utvid", dish: null,
      q: "Hvilken rett anbefaler servitørene oftest til en førstegangsgjest?",
      why: "Brukes i «beste anbefaling»-spørsmål og hjelper mersalg.",
      src: ["Servicekultur"],
      placeholder: "F.eks. Arktisk torsk — vår mest lokale rett",
    },
  ];

  // ---------- manager analytics (knowledge gaps) ----------
  const GAP_BY_DISH = [
    { name: "Viltsopprisotto", menu: "Mat", correct: 52, kind: "Vinparing + vegetar-spørsmål" },
    { name: "Pinot Noir",      menu: "Vin", correct: 58, kind: "Serveringstemperatur" },
    { name: "Multekrem panna cotta", menu: "Dessert", correct: 61, kind: "Glutenfri variant" },
    { name: "Lokal IPA",       menu: "Øl",  correct: 64, kind: "Alkoholprosent + bryggeri" },
    { name: "Arktisk torsk",   menu: "Mat", correct: 71, kind: "Allergen-detaljer" },
  ];
  const GAP_BY_CATEGORY = [
    { name: "Allergener", correct: 68 },
    { name: "Vinkart",    correct: 64 },
    { name: "Cocktail",   correct: 81 },
    { name: "Hovedretter", correct: 86 },
    { name: "Service & mersalg", correct: 79 },
  ];

  // activity log — provenance of facts
  const MK_LOG = [
    { id: "l1", icon: "message", who: "Maria A.", text: "bekreftet grilltid på ribeye (4 min/side, hvile 6 min)", time: "08:42", src: "svar" },
    { id: "l2", icon: "camera",  who: "Botsson",  text: "leste 8 retter fra menyfoto", time: "08:38", src: "foto" },
    { id: "l3", icon: "alert",   who: "Botsson",  text: "flagget manglende pris på «Dagens suppe»", time: "08:38", src: "foto" },
    { id: "l4", icon: "pen",     who: "Maria A.", text: "la til lokal historie om skrei fra Lofoten", time: "i går", src: "manuell" },
    { id: "l5", icon: "check",   who: "Maria A.", text: "publiserte Vintermeny-quiz til 11 ansatte", time: "i går", src: "manuell" },
  ];

  // ---------- dish "photo" art (generated plate/glass look) ----------
  // No external images: each card renders an appetizing abstract plated-food
  // (or glass) motif from a small palette, so every quiz HAS an image by
  // default. Users can still drop a real photo on top (mk_img_plate_<id>).
  const ART = {
    ribeye:  { type: "plate", main: ["#6f3c20", "#83491f"], side: "#d6ac63", garnish: "#a23f5d" },
    torsk:   { type: "plate", main: ["#f1e8d4", "#f8f1e2"], side: "#bcc99a", garnish: "#5f7d3c" },
    risotto: { type: "plate", main: ["#e6d4a3", "#efe1bb"], side: "#cf9c3d", garnish: "#436029" },
    burger:  { type: "plate", main: ["#c2843c", "#a75e2b"], side: "#e1c25f", garnish: "#7a8f3f" },
    pannacotta: { type: "plate", main: ["#f4ecdb", "#fbf5e9"], side: "#e0a02a", garnish: "#d76b2a" },
    negroni: { type: "glass", liquid: ["#bb3a2a", "#d75a31"], rim: "#e7a24e", garnish: "#e7793a" },
    pinot:   { type: "glass", liquid: ["#7d1f2c", "#a02f3c"], rim: "#caa6a0", garnish: "#7d1f2c" },
    riesling: { type: "glass", liquid: ["#e7d77f", "#f1e8a8"], rim: "#efe7c4", garnish: "#cdb24a" },
    ipa:     { type: "glass", liquid: ["#c8862b", "#e0a838"], rim: "#f3dda0", garnish: "#9c6520" },
    eplemost: { type: "glass", liquid: ["#d9a83e", "#e7c25c"], rim: "#f1dca0", garnish: "#9c6f24" },
  };
  const allById = {};
  [...DISHES, ...DRINKS].forEach((c) => { allById[c.id] = c; });
  function mkDishArt(id) {
    if (ART[id]) return ART[id];
    const card = allById[id];
    if (card) {
      if (["vin", "drikke", "ol", "cocktail"].includes(card.kind))
        return { type: "glass", liquid: ["#a02f3c", "#c2543f"], rim: "#e7c08a", garnish: "#7d1f2c" };
      const cat = (card.category || "").toLowerCase();
      if (cat.includes("dessert")) return { type: "plate", main: ["#f3ead8", "#fbf5e8"], side: "#e0a02a", garnish: "#d76b2a" };
      if (cat.includes("forrett")) return { type: "plate", main: ["#eadfc5", "#f4ecd8"], side: "#bcc99a", garnish: "#5f7d3c" };
    }
    return { type: "plate", main: ["#7a4524", "#9a5a2a"], side: "#d6ac63", garnish: "#a23f5d" };
  }

  Object.assign(D, {
    MK_ALLERGENS: ALLERGENS,
    mkDishArt: mkDishArt,
    MK_MENUS: MENUS,
    MK_KIND_LABEL: KIND_LABEL,
    MK_SOURCE_LABEL: SOURCE_LABEL,
    MK_SOURCE_ICON: SOURCE_ICON,
    MK_DISHES: DISHES,
    MK_DRINKS: DRINKS,
    MK_STAFF: MK_STAFF,
    MK_QTYPES: QTYPES,
    MK_QUIZ_ROUNDS: QUIZ_ROUNDS,
    MK_QUIZ_QUESTIONS: QUIZ_QUESTIONS,
    MK_EXTRACT_STAGES: EXTRACT_STAGES,
    MK_EXTRACT_ITEMS: EXTRACT_ITEMS,
    MK_VERIFY_QUESTIONS: VERIFY_QUESTIONS,
    MK_GAP_BY_DISH: GAP_BY_DISH,
    MK_GAP_BY_CATEGORY: GAP_BY_CATEGORY,
    MK_LOG: MK_LOG,
    // helper: every knowledge card (dish + drink)
    mkAllCards: () => [...DISHES, ...DRINKS],
    mkVerifyQueue: () => [...DISHES, ...DRINKS].flatMap((c) => c.facts.filter((f) => !f.verified || f.conf < 65).map((f) => ({ ...f, card: c.name, cardId: c.id, kind: c.kind }))),
  });
})();
