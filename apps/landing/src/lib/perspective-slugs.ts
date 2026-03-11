// ============================================
// perspective-slugs.ts
// Maps URL slugs to landing page variant identifiers.
// Each slug represents a unique perspective on Smartout.
//
// Routing: smartout.ai/drift → variant E
//          smartout.ai/?v=E  → redirect 301 → /drift
//
// Connected to: app/[slug]/page.tsx (slug routing)
//               middleware.ts (legacy ?v= redirects)
//               landing-variant.ts (legacy variant hook)
// ============================================

import type { LandingVariant } from "./variant-voice-config";

/** Extended variant type including the 3 new perspectives. */
export type PerspectiveVariant = LandingVariant | "V" | "I" | "M";

/** Perspective slug configuration. */
export type PerspectiveSlug = {
  slug: string;
  variant: PerspectiveVariant;
  /** Max 6 words — the core message. */
  perspective: string;
  /** Short description of the angle. */
  angle: string;
};

/**
 * All 10 perspectives mapped to URL slugs.
 * The default (B) variant lives at `/` and is not in this list.
 */
export const PERSPECTIVE_SLUGS: PerspectiveSlug[] = [
  {
    slug: "drift",
    variant: "E",
    perspective: "Kaos koster mer enn du tror",
    angle: "Kostnad av dårlige verktøy — frustrert operatør",
  },
  {
    slug: "tilsyn",
    variant: "T",
    perspective: "Alltid klar for tilsyn",
    angle: "Compliance/HACCP — kvalitetsfokusert",
  },
  {
    slug: "vekst",
    variant: "K",
    perspective: "Voks uten å miste kvalitet",
    angle: "Skalering — kjede/multi-lokasjon",
  },
  {
    slug: "tilhorighet",
    variant: "A",
    perspective: "Du hører til fra dag én",
    angle: "Tilhørighet — den unge/usikre",
  },
  {
    slug: "opplaering",
    variant: "F",
    perspective: "Ingen starter uforberedt",
    angle: "Opplæring — den nye ansatte",
  },
  {
    slug: "handverk",
    variant: "S",
    perspective: "Håndverket fortjener bedre",
    angle: "Stolthet i faget — den erfarne",
  },
  {
    slug: "vaktliste",
    variant: "V",
    perspective: "Riktig person, riktig tid",
    angle: "Intelligent vaktliste — driftsansvarlig",
  },
  {
    slug: "ai",
    variant: "I",
    perspective: "En kollega som aldri glemmer",
    angle: "AI som medarbeider — tech-nysgjerrig",
  },
  {
    slug: "kommunikasjon",
    variant: "M",
    perspective: "Slutt å gjenta deg selv",
    angle: "Kommunikasjon/oppfølging — sliten leder",
  },
];

/** Lookup: slug string → perspective config. */
export const SLUG_MAP = new Map(PERSPECTIVE_SLUGS.map((p) => [p.slug, p]));

/** Lookup: legacy variant letter → slug string. */
export const VARIANT_TO_SLUG = new Map(PERSPECTIVE_SLUGS.map((p) => [p.variant, p.slug]));

/** All valid slugs for static generation. */
export const ALL_SLUGS = PERSPECTIVE_SLUGS.map((p) => p.slug);
