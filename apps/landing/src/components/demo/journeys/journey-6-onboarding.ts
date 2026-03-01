// ============================================
// journey-6-onboarding.ts
// Journey config: "Onboarding — første dag som ny ansatt"
// Persona: Ny ansatt — new employee goes through day-one onboarding.
// Connected to: journeys/index.ts (registry)
// ============================================

import type { JourneyConfig } from "./types";

const PlaceholderFeature = () => null;

export const journey6Onboarding: JourneyConfig = {
  id: "onboarding",
  persona: "ny-ansatt",
  title: "Onboarding — din første dag",
  subtitle: "Velkommen, godta reglement, fullfør opplæring — klar til vakt.",
  duration: "3 min",
  icon: "UserPlus",
  accentColor: "rose",
  steps: [],
  featureComponent: PlaceholderFeature,
};
