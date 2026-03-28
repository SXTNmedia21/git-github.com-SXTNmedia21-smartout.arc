import type { SlideConfig } from "@smartout/ui";

/**
 * Alkoholservering — Opplæringsflow
 *
 * Interaktiv opplæring i norsk alkohollovgivning for restaurantansatte.
 * Dekker: aldersgrenser, skjenketid, ID-kontroll, åpenbart påvirket,
 * prikksystemet, og ansvar.
 *
 * Basert på Alkoholloven (Lov 1989-06-02-27), Alkoholforskriften,
 * og Helsedirektoratets veiledning.
 *
 * Estimert tid: ~3 minutter.
 */
export const alkoholFlow: SlideConfig[] = [
  // ── 1. HERO ──────────────────────────────────────────
  {
    type: "hero",
    title: "Alkoholservering på {{companyName}}",
    subtitle: "Loven er tydelig. Ansvaret er ditt. La oss sørge for at du er trygg på reglene.",
    transition: "morph",
  },

  // ── 2. GIVE: Hvorfor dette er viktig ─────────────────
  {
    type: "give",
    title: "Hvorfor dette er viktig",
    body: "Alle som serverer alkohol i Norge har et personlig ansvar for å følge Alkoholloven. Brudd kan gi {{companyName}} prikker, bøter — og i verste fall miste skjenkebevillingen. Denne opplæringen tar ca. 3 minutter.",
    layout: "center",
    transition: "fade",
  },

  // ── 3. TAKE: Aldersgrenser ───────────────────────────
  {
    type: "take",
    question: "Hva er aldersgrensen for å kjøpe øl og vin i Norge?",
    answerKey: "ageLimitBeerWine",
    multi: false,
    options: [
      { id: "16", label: "16 år", icon: "users" },
      { id: "18", label: "18 år", icon: "shield" },
      { id: "20", label: "20 år", icon: "clock" },
      { id: "21", label: "21 år", icon: "star" },
    ],
    transition: "push",
  },

  // ── 4. GIVE: Aldersgrenser forklart ──────────────────
  {
    type: "give",
    title: "18 år for øl og vin — 20 år for brennevin",
    body: "Øl, vin og andre drikkevarer under 22 vol% krever at gjesten er fylt 18 år. Brennevin og drikkevarer over 22 vol% krever 20 år. Som ansatt må du selv være 18 år for å servere øl og vin, og 20 år for å servere brennevin. Foreldrenes samtykke overstyrer aldri aldersgrensen.",
    layout: "center",
    transition: "reveal",
  },

  // ── 5. TAKE: Skjenketider ───────────────────────────
  {
    type: "take",
    question: "Når er siste skjenketid for brennevin ifølge norsk lov?",
    answerKey: "spiritsClosingTime",
    multi: false,
    options: [
      { id: "0100", label: "Kl. 01:00", icon: "clock" },
      { id: "0200", label: "Kl. 02:00", icon: "clock" },
      { id: "0300", label: "Kl. 03:00", icon: "clock" },
      { id: "0000", label: "Midnatt", icon: "clock" },
    ],
    transition: "push",
  },

  // ── 6. GIVE: Skjenketider forklart ──────────────────
  {
    type: "give",
    title: "Skjenketid og drikkefrist",
    body: "Nasjonal maks: øl og vin kan serveres 08:00–03:00. Brennevin 13:00–03:00. Men kommunen kan sette strengere regler — sjekk hva som gjelder for {{companyName}}. Etter skjenkestopp har gjestene 30 minutters drikkefrist. Etter det må all alkohol være fjernet.",
    layout: "center",
    transition: "fade",
  },

  // ── 7. TAKE: ID-kontroll ─────────────────────────────
  {
    type: "take",
    question: "Når skal du spørre om legitimasjon?",
    answerKey: "whenToCheckId",
    multi: false,
    options: [
      {
        id: "always",
        label: "Alltid",
        description: "Uansett alder",
        icon: "shield",
      },
      {
        id: "under25",
        label: "Ser ut under 25",
        description: "Retningslinjen i praksis",
        icon: "target",
      },
      {
        id: "under18",
        label: "Ser ut under 18",
        description: "Bare ved aldersgrensen",
        icon: "users",
      },
      {
        id: "never",
        label: "Aldri — de vet best selv",
        description: "Vi stoler på gjestene",
        icon: "heart",
      },
    ],
    transition: "push",
  },

  // ── 8. GIVE: ID-kontroll forklart ────────────────────
  {
    type: "give",
    title: "Spør alle som ser ut som under 25",
    body: "Du har rett og plikt til å be om legitimasjon. I praksis: spør alle som ser ut som under 25. Godkjent ID: pass, førerkort med foto, nasjonalt ID-kort, eller bankID-kort med bilde. Digitalt førerkort på mobil er IKKE gyldig. Bilde av legitimasjon er heller ikke gyldig. Ved tvil — nekter du å servere.",
    layout: "center",
    transition: "scale",
  },

  // ── 9. TAKE: Åpenbart påvirket ─────────────────────
  {
    type: "take",
    question: "En gjest virker tydelig beruset. Hva gjør du?",
    answerKey: "intoxicatedGuest",
    multi: false,
    options: [
      {
        id: "serveWater",
        label: "Serverer vann i stedet",
        icon: "coffee",
      },
      {
        id: "refuse",
        label: "Nekter å servere mer alkohol",
        icon: "shield",
      },
      {
        id: "askFriend",
        label: "Ber vennen bestille",
        icon: "users",
      },
      {
        id: "oneMore",
        label: "Gir én til — det er siste",
        icon: "wine",
      },
    ],
    transition: "push",
  },

  // ── 10. GIVE: Åpenbart påvirket forklart ─────────────
  {
    type: "give",
    title: "Stopp servering. Ingen unntak.",
    body: 'Alkoholloven §8-11 forbyr servering til åpenbart påvirkede personer. Du skal hverken servere dem, la andre bestille for dem, eller gi "en siste". Du skal sørge for at de forlater stedet på en trygg måte. Vurderingen er kontinuerlig — ikke bare ved døren. Brudd gir 4 prikker til {{companyName}}.',
    layout: "center",
    transition: "reveal",
  },

  // ── 11. TAKE: Prikksystemet ──────────────────────────
  {
    type: "take",
    question: "Hvor mange prikker gir servering til mindreårige?",
    answerKey: "pointsUnderage",
    multi: false,
    options: [
      { id: "2", label: "2 prikker", icon: "target" },
      { id: "4", label: "4 prikker", icon: "flame" },
      { id: "8", label: "8 prikker", icon: "shield" },
      { id: "12", label: "12 prikker", icon: "star" },
    ],
    transition: "push",
  },

  // ── 12. GIVE: Prikksystemet forklart ─────────────────
  {
    type: "give",
    title: "8 prikker — det alvorligste bruddet",
    body: "Servering til mindreårige gir 8 av 12 mulige prikker. Ved 12 prikker på to år mister bedriften skjenkebevillingen i minst én uke. Andre brudd: servering til beruset (4 prikker), brudd på skjenketid (4 prikker), ansatt under aldersgrense (4 prikker). Kommunen og politiet gjennomfører jevnlige kontroller.",
    layout: "center",
    transition: "fade",
  },

  // ── 13. TAKE: Hva husker du? ─────────────────────────
  {
    type: "take",
    question: "Hvilke av disse er gyldig legitimasjon?",
    answerKey: "validIdTypes",
    multi: true,
    options: [
      { id: "passport", label: "Norsk pass", icon: "shield" },
      { id: "digitalLicense", label: "Digitalt førerkort (app)", icon: "message" },
      { id: "driverLicense", label: "Fysisk førerkort med foto", icon: "star" },
      { id: "photoOnPhone", label: "Bilde av ID på mobil", icon: "flame" },
      { id: "bankId", label: "BankID-kort med bilde", icon: "handshake" },
      { id: "foreignPassport", label: "Utenlandsk pass", icon: "sparkles" },
    ],
    transition: "push",
  },

  // ── 14. SUMMARY ──────────────────────────────────────
  {
    type: "summary",
    title: "Bra jobba, {{employeeName}}!",
    body: "Du har gjennomført opplæringen i alkoholservering. Husk: du har personlig ansvar hver gang du serverer. Ved tvil — nekt servering. Det er alltid riktig.",
    actions: [
      { label: "Fullfør opplæring", key: "complete", variant: "primary" },
      { label: "Gjenta opplæring", key: "retry", variant: "secondary" },
    ],
    transition: "morph",
  },
];
