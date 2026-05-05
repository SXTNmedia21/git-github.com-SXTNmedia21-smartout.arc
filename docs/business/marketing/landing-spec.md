---
title: "Smartout Landing Page — Komplett Byggspesifikasjon"
id: LANDING_SPEC_FINAL
status: canonical
version: "2.0"
layer: plan
created: 2026-03-28
updated: 2026-03-28
author: pontus
depends_on:
  - LANDING_CONTENT_FINAL
  - SEO_CTA_BENCHMARK_FINAL
tags:
  - landing
  - spec
  - architecture
  - personalization
  - conversion
  - presenter-retriever
---

# LANDING_SPEC_FINAL.md — Komplett Byggspesifikasjon

> Alt en agent trenger for å bygge Smartouts landingsside.
> Ingen spørsmål nødvendig. Alle beslutninger er tatt.

---

## DEL 1: Arkitekturbeslutninger

### ADR-L01: Config-lagring — Hybrid (TS types + database innhold)

**Beslutning:** Lagdelt arkitektur. TypeScript definerer formen. Database inneholder innholdet.

**Begrunnelse:** Smartout har allerede `landing_config` + `landing_config_version` + CMS block builder i Platform Admin (ADR-0046). Å bygge et parallelt statisk TS-system er dobbeltarbeid. Scoring-logikk, persona-inferens og redirect-regler er _kode_ og bør leve i repo. Tekst, bilder og variant-innhold er _innhold_ og bør leve i databasen.

```
packages/types/src/landing.ts    ← FORMEN (types + Zod schema)
apps/landing/src/lib/            ← LOGIKKEN (scoring, inferens, redirect)
landing_config.config_data       ← INNHOLDET (validert jsonb)
Platform Admin CMS               ← EDITOREN (bygger valid config)
Assembler (client-side)           ← RUNTIME (leser config, scorer, rendrer)
```

**Caching:** ISR med revalidate hvert 5. minutt. Config hentes server-side ved page load.

---

### ADR-L02: Presenter/Retriever-mønster

**Beslutning:** Landingssiden er en pipeline av to seksjonstyper:

| Type          | Hva den gjør                                     | Eksempel                       |
| ------------- | ------------------------------------------------ | ------------------------------ |
| **Presenter** | Viser innhold. Variant velges basert på profil.  | Hero, feature-deep, comparison |
| **Retriever** | Stiller et spørsmål. Svaret oppdaterer profilen. | Qualifier, Pain Selector       |

**Begrunnelse:** Tradisjonelle landingssider er statiske. Presenter/Retriever gjør siden til en konverteringsmotor som samler data og tilpasser seg.

---

### ADR-L03: To Retrievers — bransje og smerte

**Beslutning:** To retriever-seksjoner tidlig i trakten.

```
Hero (presenter, universell)
  ↓
Qualifier: "Hva driver du?" (retriever → setter industry)
  ↓
Pain Selector: "Kjenner du deg igjen?" (retriever → setter scores)
  ↓
Action Grid (presenter, algoritmestyrt)
  ↓
Feature Deeps...
```

**Pain Selector absorberer Pain Points.** Ingen separat Pain Points-seksjon. Kortene i Pain Selector ER smertepunktene — gjenkjennelige OG klikkbare. Multi-select. Dobbelt arbeid: innhold + data.

---

### ADR-L04: Diminishing Weights

**Beslutning:** Multi-select i Pain Selector uten tak. Rekkefølgen brukeren klikker avslører prioritet.

```typescript
const CLICK_WEIGHTS = [1.0, 0.6, 0.35, 0.15];
```

Første klikk = det som treffer hardest. Scores adderes med avtagende vekt.

**Begrunnelse:** Maks-2-begrensning bryter flyten og føles som et skjema. En bruker som klikker alle fire er den mest kvalifiserte leaden — ikke begrens dem. Diminishing weights sikrer at Action Grid fortsatt differensierer.

---

### ADR-L05: Action Grid som algoritmestyrt Presenter

**Beslutning:** 12 operative handlinger. Topp 6 vises, sortert etter profil-scores. "Vis alle" for resten. Hvert klikk på et kort er et ytterligere signal.

**Begrunnelse:** Restaurantsjefer tenker i handlinger ("finn vikar"), ikke moduler ("scheduling module"). De 12 handlingene er brukerens språk.

---

### ADR-L06: 6 feature-pilarer + nettside som akkvisisjon

**Beslutning:** Seks feature-deep seksjoner, pluss integrert nettside som trojansk hest.

| #   | Pilar         | Inngangsdør                   | Strategisk rolle              |
| --- | ------------- | ----------------------------- | ----------------------------- |
| 0   | Nettside      | "Gratis nettside restaurant"  | Akkvisisjon — laveste terskel |
| 1   | Vaktplan      | "Vaktplanlegger restaurant"   | Høyeste søkevolum             |
| 2   | HACCP         | "HACCP app", "temperaturlogg" | Compliance = trygghet         |
| 3   | Opplæring     | "Onboarding restaurant"       | Turnover-smerte               |
| 4   | Daglig drift  | "Sjekkliste restaurant"       | Operasjonelt behov            |
| 5   | Kommunikasjon | "Teamchat", "walkie-talkie"   | Unik differensiator           |

---

### ADR-L07: Parallax-strategi

**Beslutning:** Forenklet på mobil. Full på desktop.

| Lag          | Desktop                             | Mobil                                               |
| ------------ | ----------------------------------- | --------------------------------------------------- |
| L0 Bakgrunn  | Parallax 0.3x scroll, orbs animerer | Orbs pulserer, fixed position, ingen scroll-kobling |
| L1 Seksjoner | Normal scroll 1.0x                  | Normal scroll 1.0x                                  |
| L2 Flytende  | Parallax 1.3-1.5x                   | Fjernet helt                                        |
| Retriever    | GSAP ScrollTrigger pin              | CSS position: sticky                                |

**Touch-deteksjon:**

```typescript
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
```

**Begrunnelse:** iOS Safari rubber-banding ødelegger GSAP pin. L2 er GPU-intensiv med touch-inertia. `pointer: coarse` fanger iPad Pro (bred men touch).

---

### ADR-L08: Mr. Botsson — ikke Lise

**Beslutning:** AI-assistenten heter Mr. Botsson overalt. Eksisterende referanser til "Lise Botsson" i landing-koden oppdateres.

---

## DEL 2: Seksjonsflyt og PageConfig

### 2.1 Komplett seksjonsrekkefølge

```
 1. header                  (statisk navigasjon)
 2. hero                    (presenter, universell)
 3. qualifier               (retriever → industry)
 4. pain_selector           (retriever → scores, bransjevariant kort)
 5. action_grid             (presenter, algoritmestyrt)
 6. feature_website         (presenter, bransjevariant)
 7. feature_scheduling      (presenter, bransjevariant)
 8. feature_haccp           (presenter, bransjevariant — skip for bar)
 9. feature_training        (presenter, bransjevariant)
10. feature_operations      (presenter, bransjevariant)
11. feature_communication   (presenter, bransjevariant)
12. time_savings            (presenter, bransjevariant)
13. comparison              (presenter, universell)
14. ai_section              (presenter, universell)
15. norwegian               (presenter, universell)
16. social_proof            (presenter, bransjevariant)
17. pricing_preview         (presenter, universell)
18. founder                 (presenter, universell)
19. final_cta               (presenter, persona-variant)
20. footer                  (statisk)
```

22 seksjoner totalt. 2 retrievers. 13 presenters med bransjevarianter. 7 universelle/statiske.

### 2.2 PageConfig (TypeScript)

```typescript
const defaultLanding: PageConfig = {
  id: "default",
  name: "Smartout Landing",
  sections: [
    { type: "presenter", key: "hero", variants: universal() },
    {
      type: "retriever",
      key: "qualifier",
      question: {
        heading: "Hva driver du?",
        options: [
          {
            id: "restaurant",
            label: "Restaurant",
            icon: "UtensilsCrossed",
            scores: {
              scheduling: 0.5,
              haccp: 0.4,
              compliance: 0.3,
              onboarding: 0.3,
              operations: 0.3,
              communication: 0.2,
              payroll: 0.3,
            },
          },
          {
            id: "hotel",
            label: "Hotell",
            icon: "Building2",
            scores: {
              scheduling: 0.3,
              haccp: 0.3,
              compliance: 0.5,
              onboarding: 0.4,
              operations: 0.4,
              communication: 0.4,
              payroll: 0.2,
            },
          },
          {
            id: "cafe",
            label: "Kafé",
            icon: "Coffee",
            scores: {
              scheduling: 0.4,
              haccp: 0.2,
              compliance: 0.2,
              onboarding: 0.2,
              operations: 0.3,
              communication: 0.3,
              payroll: 0.3,
            },
          },
          {
            id: "bar",
            label: "Bar / Nattklubb",
            icon: "Wine",
            scores: {
              scheduling: 0.5,
              haccp: 0.1,
              compliance: 0.3,
              onboarding: 0.3,
              operations: 0.3,
              communication: 0.2,
              payroll: 0.4,
            },
          },
        ],
        mode: "single",
      },
      stickyHeight: "100vh",
      profileMapping: { field: "industry", source: "option.id" },
    },
    {
      type: "retriever",
      key: "pain_selector",
      question: {
        heading: "Kjenner du deg igjen?",
        subtitle: "Trykk på det som treffer.",
        options: "DYNAMIC",
        mode: "multi",
        weights: "diminishing",
      },
      stickyHeight: "100vh",
      profileMapping: { field: "scores", source: "weighted_sum" },
    },
    { type: "presenter", key: "action_grid", variants: byScore() },
    { type: "presenter", key: "feature_website", variants: byIndustry() },
    { type: "presenter", key: "feature_scheduling", variants: byIndustry() },
    { type: "presenter", key: "feature_haccp", variants: byIndustry() },
    { type: "presenter", key: "feature_training", variants: byIndustry() },
    { type: "presenter", key: "feature_operations", variants: byIndustry() },
    { type: "presenter", key: "feature_communication", variants: byIndustry() },
    { type: "presenter", key: "time_savings", variants: byIndustry() },
    { type: "presenter", key: "comparison", variants: universal() },
    { type: "presenter", key: "ai_section", variants: universal() },
    { type: "presenter", key: "norwegian", variants: universal() },
    { type: "presenter", key: "social_proof", variants: byIndustry() },
    { type: "presenter", key: "pricing_preview", variants: universal() },
    { type: "presenter", key: "founder", variants: universal() },
    { type: "presenter", key: "final_cta", variants: byPersona() },
  ],
  redirectRules: [
    {
      condition: { field: "industry", operator: "==", value: "bar" },
      action: { type: "skip", sections: ["feature_haccp"] },
    },
    {
      condition: { field: "scores.compliance", operator: ">", value: 0.8 },
      action: { type: "reorder", move: "feature_haccp", after: "action_grid" },
    },
    {
      condition: { field: "scores.onboarding", operator: ">", value: 0.8 },
      action: { type: "reorder", move: "feature_training", after: "action_grid" },
    },
    {
      condition: { field: "scores.scheduling", operator: ">", value: 0.8 },
      action: { type: "reorder", move: "feature_scheduling", after: "action_grid" },
    },
  ],
};
```

### 2.3 TypeScript Types

```typescript
// packages/types/src/landing.ts

type SectionType = "presenter" | "retriever";

type VariantStrategy = "universal" | "industry" | "persona" | "score";

type VariantSelector = {
  strategy: VariantStrategy;
  fallback?: VariantStrategy;
  sortBy?: "relevance";
  show?: number;
  expandable?: boolean;
};

type PresenterConfig = {
  type: "presenter";
  key: string;
  variants: VariantSelector;
  parallax?: { layer: "L1" | "L2"; speed: number };
};

type RetrieverOption = {
  id: string;
  label: string;
  icon: string;
  scores: Record<string, number>;
  sublabel?: string;
  body?: string;
};

type RetrieverConfig = {
  type: "retriever";
  key: string;
  question: {
    heading: string;
    subtitle?: string;
    options: RetrieverOption[] | "DYNAMIC";
    mode: "single" | "multi";
    weights?: "diminishing" | "equal";
  };
  stickyHeight: "100vh" | "60vh" | "150vh";
  profileMapping: {
    field: keyof VisitorProfile | "scores";
    source: "option.id" | "highest_score" | "weighted_sum";
  };
};

type RedirecterRule = {
  condition: {
    field: string;
    operator: ">" | "<" | "==" | "exists";
    value: number | string | boolean;
  };
  action:
    | { type: "inject"; section: PresenterConfig; after: string }
    | { type: "skip"; sections: string[] }
    | { type: "reorder"; move: string; after: string };
};

type PageConfig = {
  id: string;
  name: string;
  sections: (PresenterConfig | RetrieverConfig)[];
  redirectRules: RedirecterRule[];
};

// Profil
type Industry = "restaurant" | "hotel" | "cafe" | "bar" | null;
type Persona = "owner" | "manager" | "hr" | "ops" | null;

type VisitorProfile = {
  industry: Industry;
  persona: Persona;
  scores: Record<string, number>;
  signals: {
    scrollDepth: Record<string, number>;
    dwellTime: Record<string, number>;
    clicks: string[];
    ctaHovers: string[];
    painClickOrder: string[];
  };
  source: {
    utm_campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    referrer: string | null;
    device: "desktop" | "tablet" | "mobile";
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
  };
  inferred: {
    persona: Persona;
    confidence: number;
  };
};

// Action Card
type ActionCard = {
  id: string;
  title: string;
  icon: string;
  oneLiner: string;
  expanded: string;
  relevance: Record<string, number>;
};

// Variant-selektorer
function universal(): VariantSelector {
  return { strategy: "universal" };
}
function byIndustry(): VariantSelector {
  return { strategy: "industry", fallback: "universal" };
}
function byPersona(): VariantSelector {
  return { strategy: "persona", fallback: "universal" };
}
function byScore(): VariantSelector {
  return { strategy: "score", sortBy: "relevance", show: 6, expandable: true };
}
```

---

## DEL 3: Scoring og Inferens

### 3.1 Diminishing Weights

```typescript
const CLICK_WEIGHTS = [1.0, 0.6, 0.35, 0.15];

function applyPainScores(
  profile: VisitorProfile,
  clickedCards: PainCard[],
  clickOrder: string[],
): void {
  clickOrder.forEach((cardId, position) => {
    const card = clickedCards.find((c) => c.id === cardId);
    if (!card) return;
    const weight = CLICK_WEIGHTS[position] ?? 0.1;

    Object.entries(card.scores).forEach(([key, value]) => {
      profile.scores[key] = (profile.scores[key] ?? 0) + value * weight;
    });
  });
}
```

### 3.2 Action Grid Scoring

```typescript
function scoreAction(action: ActionCard, profile: VisitorProfile): number {
  return Object.entries(action.relevance).reduce((sum, [key, value]) => {
    const weight = profile.scores[key] ?? 0.5;
    return sum + value * weight;
  }, 0);
}

function sortActionGrid(actions: ActionCard[], profile: VisitorProfile): ActionCard[] {
  return actions
    .map((a) => ({ ...a, score: scoreAction(a, profile) }))
    .sort((a, b) => b.score - a.score);
}
```

### 3.3 Persona Inferens

```typescript
function inferPersona(profile: VisitorProfile): { persona: Persona; confidence: number } {
  const { signals, source } = profile;

  // Prioritet 1: Eksplisitte UTM-signaler
  if (source.utm_campaign?.includes("hr")) return { persona: "hr", confidence: 0.9 };
  if (source.utm_campaign?.includes("ops")) return { persona: "ops", confidence: 0.9 };
  if (source.utm_campaign?.includes("owner")) return { persona: "owner", confidence: 0.9 };

  // Prioritet 2: Adferd
  const topDwell = Object.entries(signals.dwellTime).sort(([, a], [, b]) => b - a)[0];

  if (topDwell?.[0] === "feature_training") return { persona: "hr", confidence: 0.6 };
  if (topDwell?.[0] === "pricing_preview") return { persona: "owner", confidence: 0.7 };
  if (topDwell?.[0] === "feature_communication") return { persona: "manager", confidence: 0.5 };

  // Prioritet 3: Enhet
  if (source.device === "mobile") return { persona: "manager", confidence: 0.4 };

  // Prioritet 4: Tid på døgnet
  if (source.timeOfDay === "evening") return { persona: "owner", confidence: 0.3 };

  return { persona: null, confidence: 0 };
}
```

### 3.4 Signal-prioritet

```
┌───────────┬──────────────────────┬──────────────────┐
│ Prioritet │        Signal        │     Eksempel     │
├───────────┼──────────────────────┼──────────────────┤
│ 1 (høy)   │ Eksplisitt           │ Klikket          │
│           │ brukervalg           │ "Restaurant"     │
├───────────┼──────────────────────┼──────────────────┤
│ 2         │ UTM-parameter        │ ?industry=hotel  │
├───────────┼──────────────────────┼──────────────────┤
│ 3         │ Referrer-kontekst    │ Kom fra          │
│           │                      │ HACCP-bloggpost  │
├───────────┼──────────────────────┼──────────────────┤
│ 4         │ Scroll-adferd        │ Dvelte 30s på    │
│           │ (inferert)           │ vaktplan-seksjon │
├───────────┼──────────────────────┼──────────────────┤
│ 5 (lav)   │ Tid/enhet-heuristikk │ Kveld + desktop  │
│           │                      │ = owner          │
└───────────┴──────────────────────┴──────────────────┘
```

### 3.5 Trigger-punkter for re-evaluering

Assembleren re-evaluerer ved tre punkter:

1. **Page load** — UTM + referrer + device + tid
2. **Retriever-svar** — eksplisitt bransjevalg og smertepunkter
3. **Scroll-milestone** — etter 50% scroll-depth, inferer persona

Ingen re-render av hele siden. Kun seksjoner som endrer variant crossfader via AnimatePresence.

---

## DEL 4: Seksjon-for-seksjon spesifikasjon

### S01: Header

```yaml
type: navigation
position: sticky top
layout: logo_left_nav_right
desktop: Logo · Funksjoner · Priser · Kundehistorier · Docs · Om oss · [Logg inn] · [Start gratis ←]
mobile: Logo · Hamburger → drawer
cta: "Start gratis" → /signup
scroll: Shrink 80px → 56px. Bakgrunn transparent → solid ved scroll > 100px.
tracking: nav_link_clicked { label }
```

### S02: Hero (presenter, universell)

```yaml
layout:
  desktop: 2-kolonne 55/45. Tekst venstre. Skjermbilde høyre.
  mobile: Stacked. Tekst over. Bilde under.
  max_width: 1280px
  padding: 80px top, 64px bottom

content:
  badge: "For restauranter, hoteller og kafeer i Norge"
  h1: "Slutt å administrere. Begynn å drive."
  h1_highlight: "administrere" i primary-color
  subtitle: "Smartout samler vaktplan, opplæring, daglig drift, HACCP og en profesjonell nettside for restauranten din — i én plattform."
  cta_primary: "Start gratis nå" → /signup (primary, large, icon: arrow-right)
  cta_secondary: "Se hvordan det fungerer" → scroll #qualifier (ghost, large)

visual:
  type: dashboard_screenshot — vaktplan ukevisning med lønnskostnad-overlay
  treatment: Rotert 2°, drop-shadow lg, browser-frame
  animation: Fade-in fra høyre, 300ms delay, ease-out

tracking:
  hero_cta_clicked: { variant: primary|secondary }
  hero_visible: scroll-depth 50% og 100%
```

### S03: Qualifier (retriever → industry)

```yaml
layout:
  desktop: Full-width. Tittel sentrert. 4 kort i rad + 1.
  mobile: 2x2 grid + 1 sentrert.
  background: muted/5%
  sticky: 100vh (GSAP pin desktop, CSS sticky mobil)

content:
  h2: "Hva driver du?"
  subtitle: "Vi tilpasser innholdet etter din bransje."
  cards:
    - id: restaurant, icon: 🍽️, label: "Restaurant", sublabel: "15–50 ansatte"
    - id: hotel, icon: 🏨, label: "Hotell", sublabel: "30–150 ansatte"
    - id: cafe, icon: ☕, label: "Kafé", sublabel: "5–20 ansatte"
    - id: bar, icon: 🍸, label: "Bar / Nattklubb", sublabel: "10–30 ansatte"
    - id: other, icon: 🏢, label: "Annen skiftbasert", sublabel: "Fortell oss mer"

behavior:
  on_click: Set profil.industry → selected-state → smooth-scroll videre → alle varianter crossfader
  skip: Scroller forbi → universelle varianter
  utm_override: ?industry=X → pre-selektert + auto-scroll

tracking: qualifier_industry_selected { industry }
animation: Stagger fade-in 50ms, selected: scale 1.05 + primary ring
```

### S04: Pain Selector (retriever → scores)

```yaml
layout:
  desktop: Full-width. Tittel sentrert. 2x2 grid (3-4 kort).
  mobile: Vertikal stack.
  sticky: 100vh
  background: transparent

content:
  h2: "Kjenner du deg igjen?"
  subtitle: "Trykk på det som treffer."
  scroll_hint: "Scroll videre for å se hva Smartout gjør ↓"

  variants:
    restaurant (4 kort):
      - id: scheduling_pain, icon: 📅
        title: "Søndag kveld, vaktplanen"
        body: "Du sitter med regnearket. Ringer tre stykker for å dekke hull. Ser lønnskostnadene først etter at lønna er kjørt."
        scores: { scheduling: 0.9, payroll: 0.5, operations: 0.3 }

      - id: onboarding_pain, icon: 👤
        title: "Ny ansatt på mandag"
        body: "Opplæringen skjer muntlig, mellom service. Ingen vet hvem som har lært hva. Etter tre uker slutter halvparten."
        scores: { onboarding: 0.9, communication: 0.3 }

      - id: compliance_pain, icon: 🌡️
        title: "Mattilsynet ringer"
        body: "Temperaturloggene ligger i en perm bak kaffemaskinen. Halvparten er fylt ut med gårsdagens dato."
        scores: { compliance: 0.9, haccp: 0.8 }

      - id: followup_pain, icon: 📋
        title: "Jager folk for svar"
        body: "Godkjenninger, signaturer, fravær — du bruker halve dagen på å mase. Ingenting skjer av seg selv."
        scores: { operations: 0.7, communication: 0.5 }

    hotel (4 kort):
      - id: silos_pain, icon: 🏢
        title: "Tre avdelinger, tre systemer"
        body: "Resepsjon bruker ett verktøy, housekeeping et annet, restaurant et tredje. Ingen snakker sammen."
        scores: { communication: 0.9, operations: 0.5 }

      - id: crosscompliance_pain, icon: 📋
        title: "Internkontroll på tvers"
        body: "HACCP i kjøkkenet, brannrutiner i resepsjonen, renholdssjekk i rommene — alt i forskjellige permer."
        scores: { compliance: 0.9, haccp: 0.6, operations: 0.4 }

      - id: seasonal_pain, icon: 🔄
        title: "Sesongansatte hvert halvår"
        body: "20 nye til sommeren, 15 til jul. Samme opplæring, fra scratch, hver gang."
        scores: { onboarding: 0.9, scheduling: 0.3 }

      - id: coordination_pain, icon: 📨
        title: "Beskjeder som forsvinner"
        body: "Driftslederen sender SMS. Resepsjonen vet ikke. Housekeeping har ikke fått beskjed. Gjesten klager."
        scores: { communication: 0.9, operations: 0.4 }

    cafe (3 kort):
      - id: dualrole_pain, icon: ⏰
        title: "Du jobber OG administrerer"
        body: "Du står bak disken og prøver å planlegge neste uke mellom bestillingene. Det blir aldri tid."
        scores: { scheduling: 0.8, operations: 0.5, payroll: 0.3 }

      - id: whatsapp_pain, icon: 📱
        title: "WhatsApp er vaktplanen"
        body: "Beskjeder forsvinner oppover i chatten. Ingen vet hvem som jobber på lørdag."
        scores: { communication: 0.9, scheduling: 0.4 }

      - id: binders_pain, icon: 📝
        title: "Permer du aldri åpner"
        body: "IK-mat, renholdsplan, temperaturlogg — du vet de finnes, men de er aldri oppdatert."
        scores: { compliance: 0.7, haccp: 0.5 }

    bar (3 kort):
      - id: nightpay_pain, icon: 🌙
        title: "Kveld og natt, hver helg"
        body: "Kveldstillegg, nattillegg, helgetillegg — du regner feil hver gang. Lønnskostnadene overrasker."
        scores: { payroll: 0.9, scheduling: 0.5 }

      - id: turnover_pain, icon: 🔄
        title: "Høyt gjennomtrekk"
        body: "Bartendere som starter i september er borte til jul. Opplæringen går på repeat."
        scores: { onboarding: 0.9, communication: 0.3 }

      - id: peaks_pain, icon: 📊
        title: "Topper du aldri planlegger for"
        body: "Fotballkamp, nyttårsaften, festival-helg. Du vet det blir kaos, men du planlegger som en vanlig uke."
        scores: { scheduling: 0.8, operations: 0.4 }

behavior:
  on_click: Check-markering + scale 1.02 + primary ring. Scores adderes med diminishing weight.
  deselect: Klikk igjen → fjern. Score trekkes fra.
  no_click: OK — universelle scores brukes. Null problem.
  auto_hint: Etter 3s uten ny interaksjon + minst 1 valg → gentle pulse på scroll-hint.

tracking:
  pain_card_clicked: { industry, card_id, click_position }
  pain_selector_completed: { industry, cards_selected, scores }
```

### S05: Action Grid (presenter, algoritmestyrt)

```yaml
layout:
  desktop: Overskrift sentrert. Topp 6 kort i 3x2 grid. "Vis alle" knapp under.
  mobile: Topp 6 i 2x3 grid. "Vis alle" under.
  padding: 64px

content:
  h2: "Hva trenger du å gjøre?"
  subtitle: "Smartout løser det — med ett trykk."

  cards (alle 12, sortert av algoritmen):
    - id: smart-cover
      title: "Finn vikar"
      icon: 🔍
      oneLiner: "Noen er syk. Hvem kan ta vakten?"
      expanded: "Systemet finner ledige + kvalifiserte → sender push → første ja fyller hullet. Leder godkjenner eller det skjer automatisk."
      relevance: { scheduling: 1.0, communication: 0.3, operations: 0.5, compliance: 0.1, onboarding: 0.0, payroll: 0.2 }

    - id: daily-session
      title: "Dagens drift"
      icon: ✅
      oneLiner: "Hva skal gjøres i dag?"
      expanded: "Automatisk sjekkliste per avdeling. Ansatte kvitterer. Leder ser status i sanntid. Overlevering til neste skift med ett klikk."
      relevance: { operations: 0.9, compliance: 0.4, communication: 0.3, scheduling: 0.2, onboarding: 0.1, payroll: 0.0 }

    - id: shift-tasks
      title: "Mine oppgaver"
      icon: 📋
      oneLiner: "Ansatte vet hva de skal gjøre."
      expanded: "Ved skiftstart: push med oppgavene. Kvitter med ett trykk. Avvik med bilde. Sjefen slipper å bli spurt."
      relevance: { operations: 0.7, compliance: 0.3, communication: 0.2, scheduling: 0.3, onboarding: 0.1, payroll: 0.0 }

    - id: daily-bulletin
      title: "Dagens beskjed"
      icon: 📢
      oneLiner: "Én melding til alle på vakt."
      expanded: "Skriv → push til alle på vakt → kvittering synlig. Erstatter Facebook-gruppen."
      relevance: { communication: 0.9, operations: 0.4, scheduling: 0.1, compliance: 0.0, onboarding: 0.0, payroll: 0.0 }

    - id: shift-swap
      title: "Vaktbytter"
      icon: 🔄
      oneLiner: "Ansatte bytter. Systemet sjekker."
      expanded: "Foreslå bytte → kompetanse + arbeidstid sjekkes → motpart godtar → leder godkjenner."
      relevance: { scheduling: 0.9, compliance: 0.3, communication: 0.2, operations: 0.2, onboarding: 0.0, payroll: 0.1 }

    - id: timesheet-export
      title: "Timer til lønn"
      icon: 💰
      oneLiner: "Fra stempling til lønnsgrunnlag."
      expanded: "Stempling inn/ut → tillegg beregnes automatisk (kveld, helg, helligdag) → eksporter til regnskapsfører."
      relevance: { payroll: 1.0, scheduling: 0.4, compliance: 0.2, operations: 0.1, onboarding: 0.0, communication: 0.0 }

    - id: shift-handoff
      title: "Overlevering"
      icon: 🤝
      oneLiner: "Neste skift vet alt."
      expanded: "Dagskift oppsummerer: gjort, gjenstår, avvik. Kveldsskift ser alt før de starter."
      relevance: { operations: 0.8, communication: 0.6, compliance: 0.2, scheduling: 0.1, onboarding: 0.0, payroll: 0.0 }

    - id: quick-onboard
      title: "Ny på jobb"
      icon: 👤
      oneLiner: "Fra invitasjon til klar."
      expanded: "Inviter → kontrakt signeres → prosedyrer tildeles → readiness-score synlig → klar eller ikke klar."
      relevance: { onboarding: 1.0, compliance: 0.3, communication: 0.2, operations: 0.1, scheduling: 0.0, payroll: 0.0 }

    - id: compliance-check
      title: "Temperatur og kontroll"
      icon: 🌡️
      oneLiner: "HACCP uten permer."
      expanded: "Push til rett person → sjekk + registrer → avvik flagges → dokumentasjon alltid klar."
      relevance: { compliance: 1.0, haccp: 1.0, operations: 0.3, communication: 0.1, scheduling: 0.0, onboarding: 0.0, payroll: 0.0 }

    - id: week-pulse
      title: "Ukeoversikt"
      icon: 📊
      oneLiner: "Alt lederen trenger. Én skjerm."
      expanded: "Bemanning, hull, forespørsler, fravær, budsjett vs. faktisk."
      relevance: { scheduling: 0.7, operations: 0.5, payroll: 0.4, compliance: 0.2, communication: 0.1, onboarding: 0.0 }

    - id: targeted-broadcast
      title: "Melding til gruppe"
      icon: 📨
      oneLiner: "Filtrer. Skriv. Send. Se hvem som leste."
      expanded: "Velg mottakere etter avdeling, rolle, vakt eller team. Lesekvittering per person i sanntid."
      relevance: { communication: 0.9, operations: 0.3, scheduling: 0.1, compliance: 0.1, onboarding: 0.0, payroll: 0.0 }

    - id: escalation-alerts
      title: "Eskaleringsvarsler"
      icon: ⚠️
      oneLiner: "Ingen ting glipper."
      expanded: "Ingen svar innen X min → eskaleres automatisk oppover. Vikarforespørsel, fravær, temperatur, oppgaver."
      relevance: { operations: 0.6, compliance: 0.5, communication: 0.5, scheduling: 0.3, onboarding: 0.1, payroll: 0.0 }

behavior:
  default_show: 6 (sortert av algoritmen)
  expand_button: "Vis alle 12" → viser resten med fade-in
  card_click: Accordion-ekspansjon med expanded-tekst
  card_click_signal: Oppdaterer profil.signals.clicks → re-scorer subtilt
  reorder_on_click: Nei — rekkefølgen er satt. Klikk er kun signal for resten av siden.

card_style:
  default: Kompakt — ikon + title + oneLiner
  expanded: Ikon + title + expanded tekst
  background: card
  border: 1px border
  border_radius: 12px
  padding: 20px
  hover: lift + shadow

tracking:
  action_card_clicked: { card_id, position, is_expanded }
  action_grid_show_all: true
```

### S06: Feature Website (presenter, bransjevariant)

```yaml
layout: feature_deep (alternerende 50/50)
  denne: Tekst venstre, mockup høyre
label: "Inkludert gratis"
h2: "En nettside som oppdaterer seg selv."
body: "Smartout lager en profesjonell nettside for restauranten din — automatisk. Åpningstider, menyer, events og nyheter synkroniseres direkte fra driften din. Du trenger aldri logge inn på en nettside-editor igjen."

features:
  - icon: 🌐, title: "Alltid oppdatert", body: "Endrer du åpningstidene, oppdateres nettsiden automatisk."
  - icon: 🍽️, title: "Meny som lever", body: "Menyen hentes fra produksjonsmodulen. Ny rett? Synlig med én gang."
  - icon: 📅, title: "Events og nyheter", body: "Langbord, julelunsj, ølsmaking — publiser events som vises på nettsiden."
  - icon: 📱, title: "Mobiltilpasset og rask", body: "Profesjonelt design, SSL og hosting inkludert. Gratis."

mockup: Browser-frame med restaurantnettside. Bransjevariant navn/tagline.
  restaurant: "Brasserie K — Moderne nordisk kjøkken midt i Oslo"
  hotel: "Fjordhotellet — Restaurant, konferanse og overnatting"
  cafe: "Café Sør — Kaffe, bakst og lunsj siden 2019"
  bar: "Barrique — Naturvin og cocktails"

nivåer:
  Basic (Free): Én side — åpningstider, beskrivelse, kontakt, kart. SSL + hosting.
  Standard (Standard): Meny, events, nyheter/blogg, bildegalleri.
  Avansert (Pro/Enterprise): Flersidig, eget domene, frie moduler.
```

### S07: Feature Scheduling (presenter, bransjevariant)

```yaml
layout: feature_deep (alternerende — mockup venstre, tekst høyre)
label: "Kjernefunksjon"
h2: "Vaktplanen som regner for deg."
body: "Drag-and-drop planlegging med sanntids lønnskostnad. Kveldstillegg, helgetillegg og overtid beregnes automatisk etter Riksavtalen og arbeidsmiljøloven."

features:
  - icon: 💰, title: "Sanntids lønnskostnad", body: "Se hva uken koster per dag og per ansatt."
  - icon: ⚠️, title: "Automatiske varsler", body: "Overtid og hviletidsbrudd fanges før du publiserer."
  - icon: 📋, title: "Åpne vakter", body: "Publiser ledige vakter. Ansatte melder seg på selv."

ai_i_kontekst: "AI vaktassistent sjekker dekningsgrad, tariff og tilgjengelighet. 20 min istedenfor 3 timer."

mockup: Vaktplan ukevisning med lønnskostnad-overlay.
  restaurant: Kjøkken + Sal, 6 ansatte
  hotel: Resepsjon + Housekeeping + Restaurant, 12 ansatte
  cafe: Enkel dagsvisning, 4 ansatte
  bar: Kveld/natt-fokus, 8 ansatte
```

### S08: Feature HACCP (presenter, bransjevariant — skip for bar)

```yaml
layout: feature_deep (tekst venstre, mockup høyre)
label: "Klar for tilsyn"
h2: "HACCP uten permer."
body: "Temperaturlogging, avvikshåndtering og renholdssjekker — digitalt, tidsstemplet og alltid tilgjengelig."

features:
  - icon: 🔔, title: "Automatiske push-varsler", body: "Rett person, rett tid, rett kontroll."
  - icon: 📸, title: "Avvik med mobilkamera", body: "Fotografer og dokumenter direkte i appen."
  - icon: 📄, title: "Mattilsynet-rapport", body: "Komplett dokumentasjon på sekunder."

ai_i_kontekst: "HMS-inspektør med stemme guider gjennom sjekken. 0 timer forberedelse til tilsyn."

mockup: Mobilskjerm med temperaturregistrering (Kjøl 1: 3.2°C ✓)

redirect_rule: Skip for bar (industry == 'bar')
```

### S09: Feature Training (presenter, bransjevariant)

```yaml
layout: feature_deep (mockup venstre, tekst høyre)
label: "Klar fra dag én"
h2: "Nyansatt i dag. Klar i morgen."
body: "Nye ansatte læres opp via appen — tilpasset rollen, erfaringen og språket. Du ser hvem som er klar og hvem som mangler noe."

features:
  - icon: 🎯, title: "Tilpasset stilling", body: "Kokk og servitør får ulike opplæringsløp."
  - icon: ✅, title: "Kunnskapstester", body: "Bekrefter at de faktisk kan stoffet."
  - icon: 📊, title: "Beredskapspoeng", body: "100% = klar. Under = i prosess. Synlig for leder."

ai_i_kontekst: "Reiseassistent guider gjennom hvert steg. 30 min istedenfor 4 timer per nyansatt."
```

### S10: Feature Operations (presenter, bransjevariant)

```yaml
layout: feature_deep (tekst venstre, mockup høyre)
label: "Fra åpning til stenging"
h2: "Hele dagen — styrt digitalt."
body: "Hver avdeling får sin driftsøkt med sjekklister, oppgaver og overlevering."

features:
  - icon: ⏰, title: "Automatiske sjekklister", body: "Aktiveres til rett tid. Åpning, mellom, stenging."
  - icon: 🤝, title: "Overlevering", body: "Tekst, stemme eller AI-samtale. Neste skift vet alt."
  - icon: ✍️, title: "Daglig signering", body: "Dagen lukkes og arkiveres. Revisjonsspor."

ai_i_kontekst: "Event Engine ruter varsler. Guardian overvåker. Lederpuls leverer daglig sammendrag."
```

### S11: Feature Communication (presenter, bransjevariant)

```yaml
layout: feature_deep (mockup venstre, tekst høyre)
label: "Alt i sanntid"
h2: "Chat. Walkie-talkie. Video. I én app."
body: "Slutt på WhatsApp-grupper og telefonkjeder. Teamchat, push-varsler, walkie-talkie mellom kjøkken og sal, videostrøm fra PC-en, og AI-handoff ved skiftslutt."

features:
  - icon: 💬, title: "Teamchat med kanaler", body: "Avdelingschat, skiftchat, direktemeldinger."
  - icon: 📻, title: "Walkie-talkie", body: "Push-to-talk mellom kjøkken og sal. Fungerer som en radio."
  - icon: 📹, title: "Videostrøm", body: "Se kjøkkenet fra PC-en. Live mellom mobil og desktop."
  - icon: 📞, title: "AI-handoff", body: "Mr. Botsson ringer ved skiftslutt, intervjuer og transkriberer."

mockup: Splitscreen — mobil med walkie-talkie UI / desktop med videostrøm
```

### S12: Time Savings (presenter, bransjevariant)

```yaml
layout:
  desktop: 3 stat-kort øverst + tabell under
  mobile: Stacked
  padding: 80px
  background: muted/5%

content:
  h2: "En hel arbeidsdag — tilbake."
  subtitle: "Smartout sparer deg 8–15 timer administrasjon per uke."

stats:
  - number: "8–15", unit: "timer/uke", label: "Spart for daglig leder"
  - number: "10–15%", label: "Lavere lønnskostnader"
  - number: "3–5", unit: "verktøy", label: "Erstattet med ett"

breakdown_table:
  - task: "Vaktplanlegging", before: "2–4 timer/uke", after: "15–30 min"
  - task: "HACCP og sjekklister", before: "30–60 min/dag", after: "10–15 min"
  - task: "Onboarding per nyansatt", before: "3–5 timer", after: "30–60 min"
  - task: "Oppfølging og jaging", before: "30–60 min/dag", after: "Automatisk"
  - task: "Morgenrutine for leder", before: "30–60 min", after: "2 min"
  - task: "Forberede tilsyn", before: "8–16 timer", after: "0 timer"

source: "Basert på estimater fra norsk restaurantdrift med 15–30 ansatte."
stat_animation: Count-up fra 0 ved scroll-into-view (1200ms ease-out)
```

### S13–S19: Resterende seksjoner

Se `LANDING_CONTENT_FINAL.md` for innhold. Layout-mønster:

| Seksjon         | Layout                                                 | Bakgrunn            |
| --------------- | ------------------------------------------------------ | ------------------- |
| comparison      | 2-kolonne tabell, stagger slide-in                     | muted/5%            |
| ai_section      | Tekst 60% + chat-mockup 40% med sekvensielle meldinger | gradient primary/5% |
| norwegian       | 3 trust-badges i rad                                   | transparent         |
| social_proof    | 3 testimonial-kort, horisontal scroll mobil            | transparent         |
| pricing_preview | 2 kort (Free + Standard highlighted)                   | muted/5%            |
| founder         | Sentrert quote, 720px max, portrett                    | transparent         |
| final_cta       | Full-width banner, persona-variant CTA                 | gradient primary/5% |

---

## DEL 5: Responsivt design

| Breakpoint | Layout                                | Parallax                                            |
| ---------- | ------------------------------------- | --------------------------------------------------- |
| < 640px    | Single column, stacked, hamburger nav | L0 pulsing (fixed), L1 normal, ingen L2, CSS sticky |
| 640–1024px | 2-kolonne der desktop har 3+          | Samme som mobil                                     |
| > 1024px   | Full layout per seksjon-spec          | L0+L1+L2, GSAP ScrollTrigger                        |

Touch-deteksjon: `matchMedia('(pointer: coarse)')` — ikke viewport-bredde.

---

## DEL 6: Animasjon

| Element            | Trigger          | Animasjon                       | Timing            |
| ------------------ | ---------------- | ------------------------------- | ----------------- |
| Seksjon-innhold    | IO threshold 0.2 | Fade-in + slide-up 20px         | 400ms ease-out    |
| Statistikk-tall    | IO threshold 0.5 | Count-up fra 0                  | 1200ms ease-out   |
| Feature-kort       | IO threshold 0.3 | Stagger fade-in                 | 50ms delay mellom |
| Mockup-bilde       | IO threshold 0.3 | Fade-in fra side                | 600ms ease-out    |
| Chat-mockup        | IO threshold 0.5 | Sekvensielle meldinger + typing | 800ms mellom      |
| Pain Selector kort | Klikk            | Scale 1.02 + ring               | 200ms             |
| Bransjebytte       | Qualifier-klikk  | Crossfade alle varianter        | 300ms             |
| CTA-knapper        | Hover            | Lift -2px + shadow              | 150ms             |
| Comparison-rader   | IO               | Slide-in fra venstre/høyre      | 100ms stagger     |
| Action Grid        | Profil-endring   | Reorder med layout animation    | 300ms             |

Alle via CSS transforms/opacity (GPU). Ingen animasjon på `prefers-reduced-motion`. IntersectionObserver overalt. Framer Motion for exit-animasjoner.

---

## DEL 7: Komponent-arkitektur

```
apps/landing/src/
├── components/
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── Qualifier.tsx
│   │   ├── PainSelector.tsx
│   │   ├── ActionGrid.tsx
│   │   ├── FeatureDeep.tsx         (gjenbrukbar med props)
│   │   ├── TimeSavings.tsx
│   │   ├── Comparison.tsx
│   │   ├── AiSection.tsx
│   │   ├── Norwegian.tsx
│   │   ├── SocialProof.tsx
│   │   ├── PricingPreview.tsx
│   │   ├── Founder.tsx
│   │   └── FinalCta.tsx
│   ├── ui/
│   │   ├── SectionWrapper.tsx
│   │   ├── Badge.tsx
│   │   ├── StatCard.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── PainCard.tsx
│   │   ├── ActionCard.tsx
│   │   ├── ChatMockup.tsx
│   │   └── ComparisonRow.tsx
│   └── personalization/
│       ├── ProfileContext.tsx       (React Context med VisitorProfile)
│       ├── useProfile.ts           (hook for å lese/oppdatere profil)
│       ├── Assembler.tsx           (leser config, scorer, velger varianter)
│       ├── VariantRenderer.tsx     (rendrer riktig variant med crossfade)
│       └── signals.ts             (scroll, dwell, click tracking)
├── lib/
│   ├── scoring.ts                  (scoreAction, inferPersona, applyPainScores)
│   ├── redirect-rules.ts          (evaluateRedirectRules)
│   ├── parallax.ts                (isTouchDevice, GSAP setup)
│   └── variants.ts                (selectVariant, byIndustry, byScore)
├── content/
│   └── actions.ts                  (12 ActionCard-definisjoner med relevance)
└── tracking/
    └── posthog.ts                  (event helpers)
```

---

## DEL 8: PostHog Event-katalog

| Event                         | Properties                                      | Trigger          |
| ----------------------------- | ----------------------------------------------- | ---------------- |
| `page_viewed`                 | `{ page, industry, persona, device, utm_* }`    | Pageload         |
| `hero_cta_clicked`            | `{ variant }`                                   | CTA-klikk        |
| `qualifier_industry_selected` | `{ industry }`                                  | Bransjekort      |
| `qualifier_skipped`           | `{}`                                            | Scroll forbi     |
| `pain_card_clicked`           | `{ industry, card_id, click_position }`         | Smertekort       |
| `pain_selector_completed`     | `{ industry, cards_selected, scores }`          | Ferdig/scroll    |
| `action_card_clicked`         | `{ card_id, position, is_expanded }`            | Handlingskort    |
| `action_grid_show_all`        | `{}`                                            | "Vis alle"       |
| `section_visible`             | `{ section, industry_variant, percent }`        | IO               |
| `section_dwell`               | `{ section, seconds }`                          | Timer            |
| `feature_card_clicked`        | `{ feature, section }`                          | Feature-kort     |
| `cta_clicked`                 | `{ section, label, target, persona }`           | Enhver CTA       |
| `cta_hovered`                 | `{ section, label }`                            | Hover > 500ms    |
| `chat_mockup_viewed`          | `{ messages_shown }`                            | Chat-anim ferdig |
| `pricing_card_clicked`        | `{ tier }`                                      | Priskort         |
| `scroll_depth`                | `{ percent }`                                   | 25/50/75/100     |
| `persona_inferred`            | `{ persona, confidence, signals_used }`         | Inferens         |
| `redirect_rule_fired`         | `{ rule_id, action_type }`                      | Redirect         |
| `signup_started`              | `{ source_section, industry, persona, scores }` | Signup           |
