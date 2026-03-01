// ============================================
// journey-5-haccp.ts
// Journey config: "Utfør en HACCP-kontroll"
// Persona: Ansatt — employee does temperature checks.
// Connected to: journeys/index.ts (registry)
// ============================================

import type { JourneyConfig } from "./types";

const PlaceholderFeature = () => null;

export const journey5Haccp: JourneyConfig = {
  id: "haccp",
  persona: "ansatt",
  title: "Utfør en HACCP-kontroll",
  subtitle: "Sjekk temperaturer og registrer eventuelle avvik.",
  duration: "2 min",
  icon: "Thermometer",
  accentColor: "emerald",
  steps: [],
  featureComponent: PlaceholderFeature,
};
