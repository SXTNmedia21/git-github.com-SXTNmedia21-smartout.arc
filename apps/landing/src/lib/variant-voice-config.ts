// ============================================
// variant-voice-config.ts
// Per-variant voice widget and AI section configuration.
// Maps each landing variant to a persona with voice context,
// accent colors, placeholder copy, and AI capability cards.
// Connected to: VoiceDemoWidget.tsx (consumes voice config)
//               Variant*Landing.tsx (consumes AI section config)
//               voice-assistant.tsx (receives variantContext)
// ============================================

import type { LandingVariant } from "./landing-variant";

/** Keys for the static accent color class map. */
export type AccentColorKey =
  | "orange"
  | "orange-action"
  | "slate"
  | "emerald"
  | "amber"
  | "yellow"
  | "rose";

/** Configuration for the voice demo widget per variant. */
export type VariantVoiceConfig = {
  variant: LandingVariant;
  personaName: string;
  personaRole: string;
  accentColor: AccentColorKey;
  placeholderTitle: string;
  placeholderSubtitle: string;
  usePulse: boolean;
  /** Prompt context sent to Ultravox so Lise adapts her tone to the persona. */
  promptContext: string;
};

/** A single AI capability card displayed in the SmartOut AI section. */
export type AiCapabilityCard = {
  title: string;
  description: string;
};

/** Configuration for the SmartOut AI section per variant. */
export type VariantAiSectionConfig = {
  heading: string;
  subheading: string | null;
  capabilities: AiCapabilityCard[];
};

/**
 * Static Tailwind class maps for accent theming.
 *
 * Why: Tailwind cannot safely generate dynamic classes like
 * `border-${color}-500/30` at build time. We pre-define the
 * full class strings for each accent key so Tailwind's JIT
 * compiler includes them in the CSS bundle.
 */
export const ACCENT_COLORS: Record<
  AccentColorKey,
  {
    border: string;
    borderHover: string;
    bg: string;
    text: string;
    textMuted: string;
    badgeBorder: string;
    badgeBg: string;
    badgeText: string;
    glow: string;
    buttonBg: string;
    buttonHover: string;
  }
> = {
  orange: {
    border: "border-orange-500/30",
    borderHover: "hover:border-orange-500/50",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    textMuted: "text-orange-500/50",
    badgeBorder: "border-orange-500/20",
    badgeBg: "bg-orange-500/10",
    badgeText: "text-orange-400",
    glow: "bg-orange-500/5",
    buttonBg: "bg-orange-500",
    buttonHover: "hover:bg-orange-400",
  },
  "orange-action": {
    border: "border-orange-500/30",
    borderHover: "hover:border-orange-500/50",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    textMuted: "text-orange-500/50",
    badgeBorder: "border-orange-500/20",
    badgeBg: "bg-orange-500/10",
    badgeText: "text-orange-400",
    glow: "bg-orange-500/5",
    buttonBg: "bg-orange-500",
    buttonHover: "hover:bg-orange-400",
  },
  slate: {
    border: "border-slate-500/30",
    borderHover: "hover:border-slate-500/50",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    textMuted: "text-slate-500/50",
    badgeBorder: "border-slate-500/20",
    badgeBg: "bg-slate-500/10",
    badgeText: "text-slate-400",
    glow: "bg-slate-500/5",
    buttonBg: "bg-slate-500",
    buttonHover: "hover:bg-slate-400",
  },
  emerald: {
    border: "border-emerald-500/30",
    borderHover: "hover:border-emerald-500/50",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    textMuted: "text-emerald-500/50",
    badgeBorder: "border-emerald-500/20",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    glow: "bg-emerald-500/5",
    buttonBg: "bg-emerald-500",
    buttonHover: "hover:bg-emerald-400",
  },
  amber: {
    border: "border-amber-500/30",
    borderHover: "hover:border-amber-500/50",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    textMuted: "text-amber-500/50",
    badgeBorder: "border-amber-500/20",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-400",
    glow: "bg-amber-500/5",
    buttonBg: "bg-amber-500",
    buttonHover: "hover:bg-amber-400",
  },
  yellow: {
    border: "border-yellow-400/30",
    borderHover: "hover:border-yellow-400/50",
    bg: "bg-yellow-400/10",
    text: "text-yellow-400",
    textMuted: "text-yellow-400/50",
    badgeBorder: "border-yellow-400/20",
    badgeBg: "bg-yellow-400/10",
    badgeText: "text-yellow-400",
    glow: "bg-yellow-400/5",
    buttonBg: "bg-yellow-400",
    buttonHover: "hover:bg-yellow-300",
  },
  rose: {
    border: "border-rose-400/30",
    borderHover: "hover:border-rose-400/50",
    bg: "bg-rose-950/20",
    text: "text-rose-300",
    textMuted: "text-rose-400/50",
    badgeBorder: "border-rose-300/20",
    badgeBg: "bg-rose-950/20",
    badgeText: "text-rose-300",
    glow: "bg-rose-950/10",
    buttonBg: "bg-rose-400/20",
    buttonHover: "hover:bg-rose-400/30",
  },
};

/** Per-variant voice widget configuration. */
export const VARIANT_VOICE_CONFIG: Record<LandingVariant, VariantVoiceConfig> = {
  B: {
    variant: "B",
    personaName: "Ingrid",
    personaRole: "Daglig leder",
    accentColor: "orange",
    placeholderTitle: "Lise venter...",
    placeholderSubtitle:
      "Klikk her for \u00e5 vekke r\u00f8stassistenten og still sp\u00f8rsm\u00e5l om vaktplan, onboarding eller rutiner.",
    usePulse: true,
    promptContext:
      "Du snakker med en bes\u00f8kende som sannsynligvis er daglig leder for en restaurant eller hotell. Fokuser p\u00e5 den totale oversikten \u2014 tidsbesparelse, ansattforn\u00f8ydhet og compliance.",
  },
  E: {
    variant: "E",
    personaName: "Lars Erik",
    personaRole: "Kj\u00f8kkensjef",
    accentColor: "orange-action",
    placeholderTitle: "Sp\u00f8r Lise.",
    placeholderSubtitle:
      "Rett p\u00e5 sak \u2014 f\u00e5 svar om vaktplan, oppl\u00e6ring og rutiner.",
    usePulse: true,
    promptContext:
      "Du snakker med en erfaren kj\u00f8kkensjef. Fokuser p\u00e5 effektivitet, tidsbesparelse og kj\u00f8kkendrift. V\u00e6r direkte og konkret \u2014 denne personen har det travelt.",
  },
  T: {
    variant: "T",
    personaName: "Thomas",
    personaRole: "Senior HR-direkt\u00f8r",
    accentColor: "slate",
    placeholderTitle: "Sp\u00f8r AI-assistenten.",
    placeholderSubtitle: "F\u00e5 svar om compliance, integrasjoner og revisjonsspor.",
    usePulse: true,
    promptContext:
      "Du snakker med en senior HR-direkt\u00f8r med 30+ \u00e5rs erfaring med ERP-systemer. Fokuser p\u00e5 data, compliance, integrasjoner og revisjonsspor. Bruk konkrete tall og fakta.",
  },
  K: {
    variant: "K",
    personaName: "Katrine",
    personaRole: "Branjer\u00e5dgiver",
    accentColor: "emerald",
    placeholderTitle: "Sp\u00f8r om bevisene.",
    placeholderSubtitle: "Dokumenterte resultater, ROI og casestudier.",
    usePulse: true,
    promptContext:
      "Du snakker med en erfaren hospitality-konsulent som evaluerer verkt\u00f8y for sine klienter. Fokuser p\u00e5 dokumentert ROI, m\u00e5lbare resultater og casestudier fra norske bedrifter.",
  },
  A: {
    variant: "A",
    personaName: "Ahmad",
    personaRole: "Hotellsjef",
    accentColor: "amber",
    placeholderTitle: "Snakk med Lise.",
    placeholderSubtitle: "Sp\u00f8r om oppl\u00e6ring, spr\u00e5kst\u00f8tte og karrierevei.",
    usePulse: true,
    promptContext:
      "Du snakker med noen som verdsetter inkludering og flerspr\u00e5klig st\u00f8tte. Snakk tydelig og enkelt. Fokuser p\u00e5 visuell oppl\u00e6ring, spr\u00e5kst\u00f8tte og karrieremuligheter.",
  },
  F: {
    variant: "F",
    personaName: "Fatima",
    personaRole: "Renholdsarbeider",
    accentColor: "yellow",
    placeholderTitle: "Trykk for \u00e5 snakke.",
    placeholderSubtitle: "",
    usePulse: false,
    promptContext:
      "Du snakker med noen som kanskje har begrenset leseevne. Snakk sv\u00e6rt enkelt, kort og tydelig. Bruk korte setninger. Maksimalt 1\u20132 setninger per svar.",
  },
  S: {
    variant: "S",
    personaName: "Signe",
    personaRole: "Sommelier",
    accentColor: "rose",
    placeholderTitle: "En samtale om kvalitet.",
    placeholderSubtitle: "Utforsk hvordan teknologi l\u00f8fter h\u00e5ndverket.",
    usePulse: false,
    promptContext:
      "Du snakker med en erfaren sommelier og kvalitetsekspert. V\u00e6r raffinert og presis. Fokuser p\u00e5 h\u00e5ndverk, presisjon, kvalitetsstandarder og balansen mellom tradisjon og teknologi.",
  },
};

/** Per-variant SmartOut AI section configuration. */
export const VARIANT_AI_SECTION: Record<LandingVariant, VariantAiSectionConfig> = {
  B: {
    heading: "M\u00f8t SmartOut AI",
    subheading: "Kunstig intelligens som faktisk forst\u00e5r servicebransjen.",
    capabilities: [
      {
        title: "Stemmecoaching",
        description: "Lise veileder ansatte gjennom rutiner og prosedyrer med stemmen.",
      },
      {
        title: "Proaktive varsler",
        description: "AI-drevne p\u00e5minnelser om sertifiseringer, vakter og compliance.",
      },
      {
        title: "Smart planlegging",
        description: "Automatisk vaktplanlegging basert p\u00e5 kompetanse og tilgjengelighet.",
      },
    ],
  },
  E: {
    heading: "AI som leverer.",
    subheading: "Raske svar. Automatisert drift. Null venting.",
    capabilities: [
      {
        title: "3 sekunder",
        description:
          "Gjennomsnittlig responstid p\u00e5 alle sp\u00f8rsm\u00e5l om drift og rutiner.",
      },
      {
        title: "Auto-planlegging",
        description: "Vaktplaner som lager seg selv basert p\u00e5 bemanning og kompetanse.",
      },
      {
        title: "AI-sjekklister",
        description: "Daglige kontroller som tilpasser seg automatisk etter sesong og avdeling.",
      },
    ],
  },
  T: {
    heading: "AI-drevet compliance",
    subheading: "Revisjonsklar dokumentasjon generert automatisk.",
    capabilities: [
      {
        title: "Automatisk revisjonsspor",
        description: "Komplett audit trail for alle oppl\u00e6ringsaktiviteter og sertifiseringer.",
      },
      {
        title: "Compliance-prediksjon",
        description: "AI identifiserer potensielle compliance-hull f\u00f8r de oppst\u00e5r.",
      },
      {
        title: "Anomali-deteksjon",
        description: "Automatisk flagging av uvanlige m\u00f8nstre i oppl\u00e6ring og drift.",
      },
    ],
  },
  K: {
    heading: "Dokumentert AI-effekt",
    subheading: "M\u00e5lbare forbedringer fra dag \u00e9n.",
    capabilities: [
      {
        title: "67% tidsbesparelse",
        description: "Gjennomsnittlig reduksjon i oppl\u00e6ringstid hos norske klienter.",
      },
      {
        title: "43% lavere feilrate",
        description: "F\u00e6rre avvik og compliance-brudd med AI-assistert oppl\u00e6ring.",
      },
      {
        title: "3 mnd tilbakebetaling",
        description: "Dokumentert ROI innen f\u00f8rste kvartal for alle klientst\u00f8rrelser.",
      },
    ],
  },
  A: {
    heading: "AI som forst\u00e5r deg",
    subheading: "Oppl\u00e6ring p\u00e5 ditt spr\u00e5k, i ditt tempo.",
    capabilities: [
      {
        title: "Flerspr\u00e5klig AI",
        description: "Lise snakker 15+ spr\u00e5k og tilpasser seg automatisk.",
      },
      {
        title: "Stemmehjelper",
        description: "Still sp\u00f8rsm\u00e5l med stemmen \u2014 ingen lesing n\u00f8dvendig.",
      },
      {
        title: "Visuell oppl\u00e6ring",
        description: "Bilder og video som viser hva du skal gj\u00f8re, steg for steg.",
      },
    ],
  },
  F: {
    heading: "AI hjelper deg",
    subheading: null,
    capabilities: [
      { title: "Snakk med AI", description: "" },
      { title: "AI forst\u00e5r deg", description: "" },
    ],
  },
  S: {
    heading: "Intelligens med balanse",
    subheading: "Teknologi som respekterer h\u00e5ndverket.",
    capabilities: [
      {
        title: "H\u00e5ndverksbevisst teknologi",
        description:
          "AI som forst\u00e5r forskjellen mellom standardisering og kvalitetsh\u00e5ndverk.",
      },
      {
        title: "Sommelierniv\u00e5 presisjon",
        description: "Oppl\u00e6ringsprogrammer utviklet med bransjens fineste eksperter.",
      },
      {
        title: "Kontinuerlig forbedring",
        description: "AI som l\u00e6rer av dine standarder og tilpasser seg din bedrift.",
      },
    ],
  },
};
