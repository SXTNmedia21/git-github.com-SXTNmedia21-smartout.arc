---
title: "Dynamic Landing Engine — Architecture & Scroll System"
status: draft
created: 2026-03-28
updated: 2026-03-28
module: landing
tags: [landing, scroll, parallax, personalization, gsap, framer-motion, conversion]
---

# Dynamic Landing Engine — Design Spec

> Arkitektur for en dynamisk, personalisert landingsside med parallax scroll, soft-gate retrievers, og algoritmestyrt seksjonspresentasjon.

---

## 1. Konsept

Landingssiden er en **konverteringsmotor** som bygger seg selv basert på hvem som ser den. Tre lag:

| Lag               | Hva                                                                 | Ansvar         |
| ----------------- | ------------------------------------------------------------------- | -------------- |
| Seksjonsbibliotek | Statiske React-komponenter i bundlen, varianter per bransje/persona | Rendering      |
| Profilmotor       | Bygger besøksprofil i sanntid fra signaler                          | Klassifisering |
| Assembler         | Velger seksjoner, varianter og rekkefølge basert på profil + config | Orkestrering   |

### Hybrid-modell

AI/regelmotor velger _hvilke_ seksjoner som hentes fra biblioteket. De stables i en state-machine der **Retrievers** (interaktive spørsmål) gater ruten videre. Kombinerer personalisering med interaktiv scoring.

### I1 Industry Intelligence som datakilde

**Landing engine eier IKKE innholdsdata.** All industri-, persona-, smerte- og scoringsdata kommer fra I1 (Industry Intelligence Bootstrap). Landing engine er en **rendering runtime** som konsumerer I1-data.

| Data                                       | Kilde i I1                                                            | Fil                                                            |
| ------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Industrier (restaurant, hotell, kafé, bar) | NACE-kode mapping + IndustryType                                      | `packages/ai/src/industry/defaults.ts`                         |
| Personas (7 segmenter med risikoprofiler)  | AI Council personas                                                   | `docs/engines/industri-inteligence/hospitalety/01-ai-council/` |
| Smertepunkter per bransje                  | Research pack: 5 kjernearbeidsflyter                                  | `docs/engines/industri-inteligence/hospitalety/04-research/`   |
| Industry seed-scores                       | Capability relevance per NACE                                         | I1 relevance mapping (ny)                                      |
| Action-relevance scores                    | Workflow-prioritet per niche                                          | I1 niche taxonomy + workflow KPIs                              |
| Redirect-regler (bar skipper HACCP)        | Prosedyre-mapping per NACE (bar har ikke temperaturkontroll)          | `packages/ai/src/industry/defaults.ts`                         |
| Feature-variant innhold                    | Avdelings-, stilling-, og prosedyredata per NACE                      | I1 bootstrap data                                              |
| Persona-inferens heuristikker              | AI Council persona-profiler                                           | I1 persona model                                               |
| Tariff/regulering-info                     | Riksavtalen, Hotelloverenskomsten                                     | `packages/ai/src/industry/packages/hospitality.ts`             |
| Niche-spesialisering                       | 4 dimensjoner: cuisine, service model, quality, operational intensity | I1 niche taxonomy                                              |

**Arkitektonisk prinsipp:** `sections/content/` importerer og transformerer I1-data til landing-format. Den genererer IKKE egne industridata. Hvis I1 ikke har dataen, utvides I1 — ikke landing engine.

**Eksisterende I1-ressurser:**

- `packages/types/src/industry.ts` — IndustryType, IndustryPackage, IndustryTariff, IndustrySuggestion
- `packages/ai/src/industry/packages/hospitality.ts` — Tariffer, skiftmaler, sesongmaler, ansettelsesdefaults, Botsson-meldinger
- `packages/ai/src/industry/defaults.ts` — NACE-koder, 80+ stillinger, 50+ prosedyrer, avdelingstyper med offsets
- `packages/ai/src/industry/department-classifier.ts` — Avdelingsklassifisering med confidence
- `packages/ai/src/industry/loader.ts` — 3-tier tariff resolution (workspace → platform → hardkodet)

**Ny I1-utvidelse for landing:**

I1 trenger et nytt lag: `LandingIntelligence` — en projeksjon av I1-data spesifikt for landing-kontekst.

```typescript
// packages/ai/src/industry/landing.ts (NY)
type LandingIndustryProfile = {
  id: string; // NACE-basert
  label: string; // "Restaurant"
  icon: string; // Lucide icon name
  sublabel: string; // "15–50 ansatte"
  seedScores: Record<string, number>; // scheduling: 0.5, haccp: 0.4, ...
  painCards: PainCard[]; // 3-4 smertepunkter fra research pack
  redirectRules: RedirecterRule[]; // bransjespesifikk logikk
  featureVariants: Record<string, FeatureContent>; // per feature-seksjon
};

type LandingPersonaProfile = {
  id: string; // "owner", "manager", "hr", "ops"
  inferenceRules: InferenceRule[]; // heuristikker fra AI Council
  ctaVariant: CtaContent; // persona-spesifikk CTA
};

function getLandingProfiles(): LandingIndustryProfile[];
function getLandingPersonas(): LandingPersonaProfile[];
```

Denne funksjonen eksporteres fra `packages/ai/` og importeres av `apps/landing/`. Landing engine kaller den ved build-time (ISR) eller mount-time. Ingen duplisering.

---

## 2. Tre seksjonstyper

| Type           | Rolle                    | DOM-node                              | Input                               | Output                                         |
| -------------- | ------------------------ | ------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| **Presenter**  | Viser innhold            | Ja — rendrer variant basert på profil | `VisitorProfile` + `SectionVariant` | Ingen (fire-and-forget)                        |
| **Retriever**  | Samler data via spørsmål | Ja — sticky 100vh container           | Spørsmålsconfig                     | `{ answers, scores }` → oppdaterer profil      |
| **Redirecter** | Gate-logikk              | Nei — kun assembler-regel             | `VisitorProfile` + scores           | Seksjonsliste-mutasjon (skip, inject, reorder) |

### Kontrakt

```typescript
// Retriever produserer:
{
  answers: Record<string, string>; // "industry": "restaurant"
  scores: Record<string, number>; // "scheduling_pain": 0.8
}

// Assembler konsumerer:
// → Oppdaterer VisitorProfile
// → Alle Presenters re-evaluerer variant via selectVariant()
// → Crossfade skjer automatisk (AnimatePresence)

// Redirecter er logikk i assembleren:
// → Evaluerer profil mellom seksjoner
// → Kan skippe, reorder, eller injisere seksjoner
```

---

## 3. Config-arkitektur

### Beslutning: Hybrid — TS types + database innhold

TypeScript definerer **formen** (types, section keys, variant keys). Database inneholder **innholdet** (tekst, rekkefølge, varianter). Validering via Zod-schema ved skriving.

Passer med eksisterende `landing_config` + `landing_config_version` + ADR-0046.

### TypeScript types (packages/types/src/landing.ts)

```typescript
type SectionType = "presenter" | "retriever";

type VariantSelector =
  | { strategy: "universal" }
  | { strategy: "industry"; fallback: "universal" }
  | { strategy: "persona"; fallback: "universal" }
  | { strategy: "score"; sortBy: "relevance"; show: number; expandable: boolean };

type PresenterConfig = {
  type: "presenter";
  key: string;
  variants: VariantSelector;
  parallax?: { layer: "L1" | "L2"; speed: number };
};

type RetrieverConfig = {
  type: "retriever";
  key: string;
  question: {
    heading: string;
    subtitle?: string;
    options: RetrieverOption[] | "DYNAMIC"; // DYNAMIC = bransjevariant fra content
    mode: "single" | "multi";
    weights?: "diminishing"; // [1.0, 0.6, 0.35, 0.15]
  };
  stickyHeight: "100vh" | "150vh";
  profileMapping: {
    field: keyof VisitorProfile;
    source: "option.id" | "highest_score" | "weighted_sum";
  };
};

type RetrieverOption = {
  id: string;
  label: string;
  icon: string;
  sublabel?: string;
  scores: Record<string, number>;
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
```

### Database innhold (Supabase: landing_config.config_data jsonb)

Config lagres som jsonb i `landing_config`, validert mot Zod-schema ved skriving. ISR-caching ved lesing (revalidate hvert 5. minutt). Fallback til hardkodet universal config ved feil.

---

## 4. Komplett trakt — 22 seksjoner

```
Hero (presenter, universell)
  ↓ scroll
Qualifier: "Hva driver du?" (retriever, sticky 100vh)
  → setter profil.industry
  → scores fra industry-valg legges til (seed: 0.2–0.5)
  ↓ scroll — bransjevariant innhold fra nå av
Pain Selector: "Kjenner du deg igjen?" (retriever, sticky 100vh)
  → bransjevariant kort (3–4 stk)
  → multi-select, diminishing weights
  → setter profil.scores
  ↓ scroll
Action Grid (presenter, algoritmestyrt)
  → topp 6 av 12 handlinger, sortert etter scores
  → "Vis alle" for resten
  ↓ scroll
Feature Deep 0: Nettside (presenter, bransjevariant)
Feature Deep 1: Vaktplan (presenter, bransjevariant)
Feature Deep 2: HACCP (presenter, bransjevariant, skip for bar)
Feature Deep 3: Opplæring (presenter, bransjevariant)
Feature Deep 4: Daglig drift (presenter, bransjevariant)
Feature Deep 5: Kommunikasjon (presenter, bransjevariant)
  ↓ scroll
Time Savings (presenter, bransjevariant)
Comparison (presenter, universell)
AI Section (presenter, universell)
Norwegian (presenter, universell)
Social Proof (presenter, bransjevariant)
Pricing Preview (presenter, universell)
Founder (presenter, universell)
Final CTA (presenter, persona-variant — inferert fra scroll-data)
Footer
```

### Variant-matrise

| Seksjon               | Universal      | Restaurant | Hotell | Kafe   | Bar    |
| --------------------- | -------------- | ---------- | ------ | ------ | ------ |
| hero                  | x              | —          | —      | —      | —      |
| qualifier             | x              | —          | —      | —      | —      |
| pain_selector         | —              | 4 kort     | 4 kort | 3 kort | 3 kort |
| action_grid           | algoritmestyrt | —          | —      | —      | —      |
| feature_website       | —              | x          | x      | x      | x      |
| feature_scheduling    | —              | x          | x      | x      | x      |
| feature_haccp         | —              | x          | x      | x lite | SKIP   |
| feature_training      | —              | x          | x      | x      | x      |
| feature_operations    | —              | x          | x      | x lite | x      |
| feature_communication | —              | x          | x      | x      | x      |
| time_savings          | —              | x          | x      | x      | x      |
| comparison            | x              | —          | —      | —      | —      |
| ai_section            | x              | —          | —      | —      | —      |
| norwegian             | x              | —          | —      | —      | —      |
| social_proof          | —              | x          | x      | x      | x      |
| pricing_preview       | x              | —          | —      | —      | —      |
| founder               | x              | —          | —      | —      | —      |
| final_cta             | owner          | manager    | hr     | ops    | —      |

---

## 5. Scroll & Parallax System

### Beslutning: GSAP ScrollTrigger + Framer Motion hybrid

| Domene          | Bibliotek          | Ansvar                                                      |
| --------------- | ------------------ | ----------------------------------------------------------- |
| Scroll-kontroll | GSAP ScrollTrigger | Parallax (scrub), pin, momentum-kontroll                    |
| UI-animasjon    | Framer Motion      | Entree, exit, crossfade, micro-interactions, spring physics |

Delingen er ren — to biblioteker som aldri sloss om samme domene. GSAP eier scroll-bindingen, Framer Motion eier komponent-animasjon.

### Tre parallax-lag

| Lag                | Innhold                              | Desktop                      | Mobil                                                    |
| ------------------ | ------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| **L0 — Bakgrunn**  | Orbs, gradient-mesh, noise texture   | 0.3x scroll (GSAP scrub)     | Fixed position, pulsing animation (ingen scroll-kobling) |
| **L1 — Seksjoner** | Selve innholdet                      | 1.0x scroll (normal)         | 1.0x scroll (normal)                                     |
| **L2 — Flytende**  | Dekorative former, linjer, partikler | 1.3–1.5x scroll (GSAP scrub) | **Fjernet helt**                                         |

### Mobil-strategi

GSAP ScrollTrigger `pin` + iOS rubber-banding = jank. Løsning:

- **Touch-deteksjon:** `matchMedia('(pointer: coarse)')` — ikke viewport-bredde
- **Pin:** CSS `position: sticky` på touch, GSAP pin på desktop
- **L2:** Fjernet helt på touch — GPU-intensive med touch-inertia
- **L0:** Beholder pulsing-animasjon men kobles fra scroll

```typescript
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

if (!isTouchDevice) {
  ScrollTrigger.create({ pin: true, scrub: true, ... })
}
```

### Retriever scroll-opplevelse

**Beslutning: Soft gate (C) med C1 silent transition.**

Ingen hard scroll-lock. Retriever-seksjonen er en 100vh container med sticky sporsmal inni. Brukeren _kan_ scrolle forbi uten a svare — neste seksjon viser universell variant.

**Transition: B+C kombinert**

- **B (Parallax dissolve):** L0 bakgrunn (orbs, gradient) fortsetter a animere mens retriever er sticky. Gir kontinuitet.
- **C (Scroll unlock + momentum):** Etter svar, scroll er allerede fri (soft gate). Brukeren scroller videre naturlig. Neste seksjon har allerede crossfadet til riktig variant.

**C1 silent transition ved skip:** Sporsmalet fader ut. Neste seksjon (universell variant) glir inn. Ingen indikasjon pa at de "mistet" noe.

**Upgrade path:** Hvis PostHog viser <20% svarer:

1. Gjor container hoyere (150vh)
2. Legg til subtil puls-animasjon pa sporsmalet
3. Introduser scroll-hint
4. Worst case: stram til GSAP `pin: true` — en config-endring, null refaktorering

---

## 6. Profilmotor

### VisitorProfile

```typescript
type Industry = "restaurant" | "hotel" | "cafe" | "bar" | "catering";
type Persona = "owner" | "manager" | "hr" | "ops";

type VisitorProfile = {
  industry: Industry | null;
  persona: Persona | null;
  scores: Record<string, number>;
  signals: {
    scrollDepth: Record<string, number>; // seksjon -> prosent
    dwellTime: Record<string, number>; // seksjon -> sekunder
    clicks: string[]; // element-ider
    ctaHovers: string[]; // CTAer hovret uten klikk
    clickOrder: string[]; // rekkefolge for diminishing weights
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
    persona: Persona | null;
    confidence: number; // 0.0–1.0
  };
};
```

### Signal-prioritet

| Prioritet  | Signal                                 | Eksempel                       |
| ---------- | -------------------------------------- | ------------------------------ |
| 1 (hoyest) | Eksplisitt brukervalg (Retriever-svar) | Klikket "Restaurant"           |
| 2          | UTM-parameter                          | `?industry=hotel`              |
| 3          | Referrer-kontekst                      | Kom fra bloggpost om HACCP     |
| 4          | Scroll-adferd (inferert)               | Dvelte 30s pa vaktplan-seksjon |
| 5 (lavest) | Tid/enhet-heuristikk                   | Kveld + desktop = owner        |

### Persona-inferens (regelbasert, ingen ML)

```typescript
function inferPersona(profile: VisitorProfile): Persona | null {
  const { signals, source } = profile;

  // Eksplisitte signaler vinner
  if (source.utm_campaign?.includes("hr")) return "hr";
  if (source.utm_campaign?.includes("ops")) return "ops";

  // Adferd-basert
  const topDwell = Object.entries(signals.dwellTime).sort(([, a], [, b]) => b - a)[0];

  if (topDwell?.[0] === "feature_training") return "hr";
  if (topDwell?.[0] === "pricing_preview") return "owner";
  if (source.device === "mobile") return "manager";

  // Fallback: tid pa dognet
  if (source.timeOfDay === "evening") return "owner";
  return null;
}
```

### Trigger-punkter for re-evaluering

1. **Page load** — UTM + referrer + device + tid
2. **Retriever-svar** — eksplisitt bransjevalg / smertepunkter
3. **Scroll-milestone** — etter 50% scroll-depth, inferer persona basert pa dwell-time

Ingen re-render av hele siden. Kun seksjoner som faktisk endrer variant crossfader via React context + AnimatePresence.

---

## 7. Pain Selector — Retriever #2

Pain Points og Pain Retriever er fusjonert til en seksjon. Kortene er gjenkjennbare smertepunkter OG klikkbare valg. Multi-select. Diminishing weights.

### Diminishing weights

Rekkefolgen brukeren klikker i er det sterkeste signalet. Forste klikk = hoyest vekt.

```typescript
const CLICK_WEIGHTS = [1.0, 0.6, 0.35, 0.15] as const;

function applyPainScores(
  profile: VisitorProfile,
  clickedCards: PainCard[],
  clickOrder: number[],
): void {
  clickOrder.forEach((cardIndex, position) => {
    const card = clickedCards[cardIndex];
    const weight = CLICK_WEIGHTS[position] ?? 0.1;

    Object.entries(card.scores).forEach(([key, value]) => {
      profile.scores[key] = (profile.scores[key] ?? 0) + value * weight;
    });
  });
}
```

### Eksempel — restauranteier klikker i rekkefolge

```
1. "Sondag kveld, vaktplanen"    x 1.0  -> scheduling +0.9, payroll +0.5
2. "Mattilsynet ringer"          x 0.6  -> compliance +0.54, haccp +0.48
3. "Ny ansatt pa mandag"         x 0.35 -> onboarding +0.32, communication +0.11

Resulterende scores:
  scheduling:    0.90  <- dominerer
  compliance:    0.54
  payroll:       0.50
  haccp:         0.48
  onboarding:    0.32
  communication: 0.11
```

### Bransjevariant kort

| Bransje    | Antall | Kort                                                         |
| ---------- | ------ | ------------------------------------------------------------ |
| Restaurant | 4      | Vaktplan, nyansatt, mattilsynet, oppfolging                  |
| Hotell     | 4      | Tre avdelinger, internkontroll, sesongansatte, kommunikasjon |
| Kafe       | 3      | Jobber+admin, WhatsApp, permer                               |
| Bar        | 3      | Kveld/natt-tillegg, gjennomtrekk, topper                     |

Kafe og bar har 3 kort. Ikke paddet med filler.

### Interaksjon

| Handling                 | Effekt                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Klikk pa kort            | Check-markering + scale(1.02) + primary ring. Scores adderes med diminishing weight                     |
| Klikk igjen              | Deselekt. Score trekkes fra                                                                             |
| Ingen klikk, bare scroll | Universelle scores fra industry-valget brukes                                                           |
| Auto-advance             | Etter 3s uten ny interaksjon + minst 1 valg -> gentle pulse pa "scroll videre"-tekst. Ingen auto-scroll |

---

## 8. Action Grid — Algoritmestyrt presentasjon

12 handlinger. Brukeren ser topp 6 forst, resten bak "Vis alle". Rekkefolge bestemt av vektet scoring mot profil.

### Scoring

```typescript
type ActionCard = {
  id: string;
  title: string;
  icon: string;
  oneLiner: string;
  expanded: string;
  relevance: {
    scheduling: number; // 0.0–1.0
    compliance: number;
    onboarding: number;
    communication: number;
    operations: number;
    payroll: number;
  };
};

function scoreAction(action: ActionCard, profile: VisitorProfile): number {
  return Object.entries(action.relevance).reduce((sum, [key, value]) => {
    const weight = profile.scores[key] ?? 0.5;
    return sum + value * weight;
  }, 0);
}

const sorted = actions
  .map((a) => ({ ...a, score: scoreAction(a, profile) }))
  .sort((a, b) => b.score - a.score);

const visible = sorted.slice(0, 6);
const hidden = sorted.slice(6); // bak "Vis alle"
```

Deterministisk. Ingen ML. Ren vektet dot-product.

### Score-balanse

Industry-scores er seed-verdier (0.2–0.5). Pain Selector adderer oppa. En bruker som bare velger bransje og scroller forbi Pain Selector far en rimelig Action Grid. En bruker som klikker smertepunkter far en mye skarpere en. Belonner interaksjon uten a straffe passivitet.

---

## 9. Default PageConfig

```typescript
const defaultLanding: PageConfig = {
  id: "default",
  name: "Smartout Landing",
  sections: [
    { type: "presenter", key: "hero", variants: { strategy: "universal" } },
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
            },
          },
          {
            id: "cafe",
            label: "Kafe",
            icon: "Coffee",
            scores: {
              scheduling: 0.4,
              haccp: 0.2,
              compliance: 0.2,
              onboarding: 0.2,
              operations: 0.3,
              communication: 0.3,
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
        subtitle: "Trykk pa det som treffer.",
        options: "DYNAMIC",
        mode: "multi",
        weights: "diminishing",
      },
      stickyHeight: "100vh",
      profileMapping: { field: "scores", source: "weighted_sum" },
    },
    {
      type: "presenter",
      key: "action_grid",
      variants: { strategy: "score", sortBy: "relevance", show: 6, expandable: true },
    },
    {
      type: "presenter",
      key: "feature_website",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "feature_scheduling",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "feature_haccp",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "feature_training",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "feature_operations",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "feature_communication",
      variants: { strategy: "industry", fallback: "universal" },
    },
    {
      type: "presenter",
      key: "time_savings",
      variants: { strategy: "industry", fallback: "universal" },
    },
    { type: "presenter", key: "comparison", variants: { strategy: "universal" } },
    { type: "presenter", key: "ai_section", variants: { strategy: "universal" } },
    { type: "presenter", key: "norwegian", variants: { strategy: "universal" } },
    {
      type: "presenter",
      key: "social_proof",
      variants: { strategy: "industry", fallback: "universal" },
    },
    { type: "presenter", key: "pricing_preview", variants: { strategy: "universal" } },
    { type: "presenter", key: "founder", variants: { strategy: "universal" } },
    {
      type: "presenter",
      key: "final_cta",
      variants: { strategy: "persona", fallback: "universal" },
    },
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
  ],
};
```

---

## 10. Variant Selection

### selectVariant()

Resolves which variant to render for a given section based on profile state.

```typescript
type ResolvedVariant = {
  id: string; // "restaurant" | "universal" | "owner"
  content: unknown; // section-specific content from content/*.ts
};

function selectVariant(
  sectionKey: string,
  profile: VisitorProfile,
  selector: VariantSelector,
): ResolvedVariant {
  switch (selector.strategy) {
    case "universal":
      return loadVariant(sectionKey, "universal");

    case "industry":
      if (profile.industry) {
        const variant = loadVariant(sectionKey, profile.industry);
        if (variant) return variant;
      }
      return loadVariant(sectionKey, "universal");

    case "persona":
      if (profile.inferred.persona && profile.inferred.confidence > 0.6) {
        const variant = loadVariant(sectionKey, profile.inferred.persona);
        if (variant) return variant;
      }
      if (profile.persona) {
        const variant = loadVariant(sectionKey, profile.persona);
        if (variant) return variant;
      }
      return loadVariant(sectionKey, "universal");

    case "score":
      // Action Grid — delegate to scoring engine
      return { id: "scored", content: sortActionsByScore(profile) };
  }
}
```

Mest spesifikk variant vinner. Fallback til universal. Persona-variant krever confidence > 0.6 for a unnga flimring pa usikre inferenser.

---

## 11. Accessibility

| Krav                     | Losning                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `prefers-reduced-motion` | Disabler all parallax, GSAP scrub, og scroll-animasjon. Seksjoner vises statisk.           |
| Keyboard-navigasjon      | Retriever-kort tabbable, Enter/Space for valg, Escape for deselekt                         |
| Screen readers           | Retriever har `role="group"` + `aria-label`. Kort har `role="checkbox"` + `aria-checked`   |
| Action Grid              | Tabbable grid med `aria-label` per kort. "Vis alle"-knapp er en toggle med `aria-expanded` |
| Scroll hints             | Visuell "scroll videre"-tekst har `aria-hidden="true"` (dekorativ)                         |
| Fargekontrast            | Alle variant-farger sjekkes mot WCAG AA (4.5:1 tekst, 3:1 interaktive)                     |

---

## 12. PostHog Events (nye)

Utover eksisterende event-katalog i SEO_CTA_BENCHMARK:

| Event                           | Properties                                          | Trigger                      |
| ------------------------------- | --------------------------------------------------- | ---------------------------- |
| `pain_selector_card_clicked`    | `{ industry, card_id, click_position, weight }`     | Smertepunkt-kort klikket     |
| `pain_selector_card_deselected` | `{ industry, card_id }`                             | Kort de-selektert            |
| `pain_selector_completed`       | `{ industry, cards_selected, click_order, scores }` | Scrollet forbi Pain Selector |
| `pain_selector_skipped`         | `{ industry }`                                      | Scrollet forbi uten valg     |
| `action_grid_visible`           | `{ visible_actions, hidden_count, top_score }`      | Action Grid i viewport       |
| `action_grid_card_clicked`      | `{ action_id, position, score }`                    | Handling klikket             |
| `action_grid_expanded`          | `{ total_actions }`                                 | "Vis alle" klikket           |
| `variant_crossfade`             | `{ section, from_variant, to_variant, trigger }`    | Variant byttet               |
| `profile_persona_inferred`      | `{ persona, confidence, signals_used }`             | Persona inferert             |
| `redirect_rule_fired`           | `{ rule_type, condition, affected_sections }`       | Redirecter-regel utfort      |

Alle events har felles properties:

```typescript
{
  industry: string | null,
  persona: string | null,
  device: string,
  landing_session_id: string,
  page_variant: string,  // hash av aktive varianter
  profile_scores: Record<string, number>,
}
```

---

## 13. Komponent-arkitektur

```
apps/landing/src/
  components/
    engine/                     -- Landing Engine runtime
      Assembler.tsx             -- Leser config, evaluerer redirect rules, rendrer seksjoner
      SectionRenderer.tsx       -- Dispatcher: presenter -> PresenterShell, retriever -> RetrieverShell
      PresenterShell.tsx        -- Wrapper: variant selection + parallax layer + entree animation
      RetrieverShell.tsx        -- Wrapper: sticky container + scroll observer + score output
      ParallaxProvider.tsx      -- GSAP ScrollTrigger setup, 3-layer management
      ProfileContext.tsx        -- React Context for VisitorProfile
      useProfile.ts             -- Hook: read/write profile, trigger re-evaluation
      useAssembler.ts           -- Hook: evaluates redirectRules, returns resolved section list
      useParallax.ts            -- Hook: GSAP scrub bindings, touch detection, layer offsets
    sections/                   -- En komponent per seksjon
      Hero.tsx
      Qualifier.tsx             -- Retriever: industry selector
      PainSelector.tsx          -- Retriever: multi-select smertepunkter
      ActionGrid.tsx            -- Presenter: algoritmestyrt grid
      FeatureDeep.tsx           -- Presenter: gjenbrukbar med props (scheduling, haccp, etc.)
      TimeSavings.tsx
      Comparison.tsx
      AiSection.tsx
      Norwegian.tsx
      SocialProof.tsx
      PricingPreview.tsx
      Founder.tsx
      FinalCta.tsx
    sections/content/           -- I1-projeksjon: transformerer I1-data til landing-format
      index.ts                  -- getLandingContent() — importerer fra packages/ai/src/industry/landing.ts
      universal.ts              -- Universelt innhold (ikke bransjespesifikt)
      actions.ts                -- 12 ActionCard-definisjoner med relevance scores FRA I1 workflow-prioriteter
    layers/                     -- Parallax-lag
      BackgroundLayer.tsx       -- L0: orbs, gradient-mesh, noise
      FloatingLayer.tsx         -- L2: dekorative former (desktop only)
  lib/
    scoring.ts                  -- scoreAction(), applyPainScores(), inferPersona()
    config-schema.ts            -- Zod schemas for PageConfig validation
    i1-adapter.ts               -- Adapter: importerer getLandingProfiles() fra packages/ai, transformerer til landing-format
```

---

## 14. Rendering-strategi

### Alle seksjoner i DOM fra start

Alle 22 seksjoner rendres ved mount med universelle varianter. Nar profilen oppdateres, crossfader berarte seksjoner til riktig variant. Null nettverkslatency — komponentene er i bundlen, innholdet er I1-data transformert til landing-format ved build-time (ISR).

### Variant-crossfade

```typescript
// Inne i PresenterShell.tsx
const variant = selectVariant(sectionKey, profile, variants)

<AnimatePresence mode="wait">
  <motion.div
    key={variant.id}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{
      // Asymmetrisk: spring entrance (500ms+), tween exit (250ms)
      // Matcher Nordic Split motion.md: min 250ms exit, 500ms entrance
      enter: { type: "spring", stiffness: 35, damping: 22, mass: 2 },
      exit: { duration: 0.25, ease: [0.4, 0, 1, 1] },
    }}
  >
    <SectionComponent content={variant.content} />
  </motion.div>
</AnimatePresence>
```

### SEO

Server-rendrer universell variant. Personalisering skjer client-side etter hydration. Google ser alltid universelt innhold. Ingen canonical issues — alt er samme URL, bare visuell tilpasning.

---

## 15. GSAP ScrollTrigger — spesifikt bruk

| Feature             | Desktop                                                          | Mobil                                 |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| L0 parallax         | `scrub: true`, speed 0.3x                                        | Disabled — fixed position med pulsing |
| L2 parallax         | `scrub: true`, speed 1.3–1.5x                                    | Disabled — L2 fjernet                 |
| Retriever pin       | GSAP `pin: true` (valgfritt, starter som disabled for soft gate) | CSS `position: sticky`                |
| Section entrance    | Framer Motion `whileInView`                                      | Framer Motion `whileInView`           |
| Momentum etter svar | GSAP scroll-to med easing                                        | Native scroll momentum                |

### GSAP lisens

GSAP gikk til fri lisens (no-charge) i 2024 for alle bruk inkludert kommersielt. ScrollTrigger er inkludert. Ingen lisenskostnad.

---

## 16. Beslutningslogg

| #   | Beslutning                                     | Alternativ                  | Begrunnelse                                                              |
| --- | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| 1   | Hybrid: AI cherry-pick + state machine         | Ren config ELLER ren AI     | Personalisering + interaktiv scoring                                     |
| 2   | Statiske komponenter i bundlen                 | CMS-rendret                 | Null nettverkslatency                                                    |
| 3   | Config: TS types + DB innhold                  | Ren TS ELLER ren DB         | Typesikkerhet + fleksibilitet. Superseder ADR-0046 (krever ADR-0057)     |
| 4   | Alle seksjoner i DOM fra start                 | Lazy mount / virtualisering | Trivielt for 22 seksjoner, unnga kompleksitet                            |
| 5   | Tre parallax-lag (L0, L1, L2)                  | Flat / ett lag              | Dybde og premium-folelse                                                 |
| 6   | Mobil: L0 fixed + L1, ingen L2                 | Full parallax pa mobil      | iOS jank, GPU-kostnad pa touch                                           |
| 7   | Framer Motion forst, GSAP kun ved bevist behov | Bare GSAP / Lenis           | Prototype parallax med FM. GSAP kun hvis pin/scrub krever det (ADR-0058) |
| 8   | Soft gate (C) med C1 silent transition         | Hard scroll-lock (A/B)      | Respekterer brukerautonomi, upgrade path til A                           |
| 9   | B+C transition                                 | Bare B / bare C             | Parallax kontinuitet + naturlig momentum                                 |
| 10  | Pain Selector absorberer Pain Points           | Separate seksjoner          | Reduserer stopp, dobbelt arbeid per interaksjon                          |
| 11  | Diminishing weights [1.0, 0.6, 0.35, 0.15]     | Maks 2 valg                 | Klikkrekkefolge = prioritet, ingen restriksjoner                         |
| 12  | Action Grid: vektet scoring, topp 6            | Fast rekkefolge             | Personalisert uten ML                                                    |
| 13  | Industry-scores som seed (0.2–0.5)             | Hoye seeds (0.7–0.9)        | Differensiering kommer fra Pain Selector                                 |
| 14  | Redirecter = assembler-logikk                  | DOM-node                    | Scroll-posisjon tilgjengelig via GSAP callbacks                          |
| 15  | Regelbasert persona-inferens                   | ML-basert                   | Deterministisk, debuggbar, tilstrekkelig                                 |
| 16  | Landing engine er I1-konsument                 | Selvstendig datakilde       | All industri/persona/smerte-data fra I1. Ingen duplisering.              |
| 17  | Asymmetrisk crossfade (500ms+ inn, 250ms ut)   | Flat 300ms                  | Matcher Nordic Split motion.md. Spring entrance, tween exit.             |
| 18  | landing_session_id (ikke session_id)           | session_id                  | Unnga forveksling med engine_sessions.id i PostHog                       |
| 19  | Types i apps/landing/ (ikke packages/types/)   | Shared package              | Landing-spesifikke typer, flyttes kun ved reell gjenbruk                 |

### Council-betingelser (fra review 2026-03-28)

| #   | Betingelse                                             | Status  |
| --- | ------------------------------------------------------ | ------- |
| C1  | Skriv ADR-0057 som superseder ADR-0046                 | Pending |
| C2  | Fas implementasjonen i 4 faser                         | Pending |
| C3  | GSAP ikke pre-godkjent — FM-prototype forst            | Pending |
| C4  | i18n fra dag en — ingen hardkodet norsk                | Pending |
| C5  | Eksplisitt Agent System Boundary-seksjon               | Pending |
| C6  | Redirect rule-presedensregler definert                 | Pending |
| C7  | Telemetri-approach avklart (emit() vs direkte PostHog) | Pending |
