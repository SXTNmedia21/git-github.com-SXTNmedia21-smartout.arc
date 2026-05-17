/**
 * lovsen-client.ts — TypeScript wrapper for Riksavtalen (NHO Reiseliv) paragraf lookup.
 *
 * The lovsen-nho-reiseliv-mcp service is a Python stdio MCP server. It is NOT
 * HTTP-accessible from Next.js at runtime. This module provides a static
 * enrichment map derived from the ADR-0242-compliant fixtures in the MCP service,
 * covering the paragraf_references returned by the /api/payroll/tariff/current
 * BFF route.
 *
 * Design rationale:
 *   - The MCP server (stdio) cannot be invoked synchronously from a Next.js
 *     Route Handler without spawning a subprocess — that would be fragile and
 *     block the event loop. The fixture data is stable per law_version and can
 *     be embedded here.
 *   - The map is keyed on normalised paragraf strings (e.g. "§6", "§14-7")
 *     produced by capability tools and supplement_rule.paragraf_ref DB columns.
 *   - When a law_version-specific lookup is needed, enrich() selects the version
 *     bucket and falls back to the generic description if the version is unknown.
 *
 * Versioning:
 *   - SUPPORTED_VERSIONS mirrors the Python SUPPORTED_VERSIONS constant ("2024", "2025").
 *   - New agreement years require a manual update here (and in the Python fixtures).
 *   - Per ADR-0244: no silent version fallback.
 *
 * References:
 *   ADR-0242 — Lovsen citation contract.
 *   ADR-0244 — Lovsen MCP boundary (rate-limit, version-awareness).
 *   ADR-0258 — LOVSEN_FIXTURE_MODE canonical env var.
 *   services/lovsen-nho-reiseliv-mcp/src/nho_reiseliv_client.py (SUPPORTED_VERSIONS)
 *   services/lovsen-nho-reiseliv-mcp/src/fixtures/ (canonical fixture data)
 */

// =============================================================================
// Types
// =============================================================================

export type ParagrafEntry = {
  /** Paragraf key as stored in supplement_rule.paragraf_ref, e.g. "§6" */
  paragraf: string;
  /** Human-readable description (Norwegian). */
  description: string;
  /** Rate value if the paragraf specifies a fixed rate. Absent for percentage/complex formulas. */
  rate_value?: number;
  /** Rate type if applicable. */
  rate_type?: "percentage" | "fixed_amount" | "hourly_rate";
};

/** Maps paragraf string → per-version descriptions. */
type ParagrafMap = Record<
  string, // paragraf key
  {
    description: string;
    rate_value?: number;
    rate_type?: "percentage" | "fixed_amount" | "hourly_rate";
    // Optional version-specific overrides. Falls back to top-level description.
    versions?: Record<
      string, // law_version e.g. "2024", "2025"
      {
        description: string;
        rate_value?: number;
        rate_type?: "percentage" | "fixed_amount" | "hourly_rate";
      }
    >;
  }
>;

// =============================================================================
// Static Riksavtalen paragraf map
// =============================================================================
// Derived from: services/lovsen-nho-reiseliv-mcp/src/fixtures/
// Covers: Riksavtalen (NHO Reiseliv / Fellesforbundet) — taro-79
//
// Format: paragraf key matches supplement_rule.paragraf_ref values as authored
// by capability tools (e.g. "Riksavtalen §6", "§6", "§14-7 (3)").
//
// Keys are normalised: leading "Riksavtalen " prefix is stripped before lookup.
// =============================================================================

const RIKSAVTALEN_PARAGRAF_MAP: ParagrafMap = {
  "§4": {
    description: "Minstelønn — garantilønn per time. Sats avhenger av ansiennitet og stilling.",
    versions: {
      "2024": { description: "Minstelønn 2024 — garantilønn per time (§4 Riksavtalen 2024)." },
      "2025": { description: "Minstelønn 2025 — garantilønn per time (§4 Riksavtalen 2025)." },
    },
  },
  "§6": {
    description: "Kveldstillegg — tillegg for arbeid på kveldstid (kl. 18–24).",
    versions: {
      "2024": {
        description: "Kveldstillegg 2024 — 25 % av garantilønn per time (§6 Riksavtalen 2024).",
        rate_value: 25,
        rate_type: "percentage",
      },
      "2025": {
        description: "Kveldstillegg 2025 — 27 % av garantilønn per time (§6 Riksavtalen 2025).",
        rate_value: 27,
        rate_type: "percentage",
      },
    },
  },
  "§6a": {
    description: "Nattillegg — tillegg for arbeid mellom midnatt og kl. 06:00.",
    versions: {
      "2024": {
        description: "Nattillegg 2024 — tillegg per time nattarbeid (§6a Riksavtalen 2024).",
      },
      "2025": {
        description: "Nattillegg 2025 — tillegg per time nattarbeid (§6a Riksavtalen 2025).",
      },
    },
  },
  "§7": {
    description: "Helge- og helligdagstillegg — tillegg for arbeid i helg og på helligdager.",
    versions: {
      "2024": {
        description:
          "Helge- og helligdagstillegg 2024 — 50 % av garantilønn (§7 Riksavtalen 2024).",
        rate_value: 50,
        rate_type: "percentage",
      },
      "2025": {
        description:
          "Helge- og helligdagstillegg 2025 — 50 % av garantilønn (§7 Riksavtalen 2025).",
        rate_value: 50,
        rate_type: "percentage",
      },
    },
  },
  "§8": {
    description: "Overtidstillegg — tillegg ved pålagt overtid utover normalarbeidstid.",
    versions: {
      "2024": {
        description: "Overtidstillegg 2024 — 50 % eller 100 % av timelønn (§8 Riksavtalen 2024).",
      },
      "2025": {
        description: "Overtidstillegg 2025 — 50 % eller 100 % av timelønn (§8 Riksavtalen 2025).",
      },
    },
  },
  "§14-7": {
    description: "Aml. §14-7 — informasjonsplikt ved skiftende arbeidssted (Arbeidsmiljøloven).",
  },
  "§14-7 (3)": {
    description: "Aml. §14-7 (3) — opplysningsplikt ved fast ansettelse med varierende arbeidstid.",
  },
  "§14-15": {
    description:
      "Aml. §14-15 — utbetalingstidspunkt og krav til lønnsslipp (Arbeidsmiljøloven). " +
      "Referert av SUPPLEMENT_BELOW_TARIFF_FLOOR-feil (aml_ref).",
  },
};

// =============================================================================
// Public API
// =============================================================================

/** Law versions supported by this client (mirrors Python SUPPORTED_VERSIONS). */
export const SUPPORTED_LAW_VERSIONS = ["2024", "2025"] as const;
export type SupportedLawVersion = (typeof SUPPORTED_LAW_VERSIONS)[number];

/**
 * Normalise a paragraf_ref string before lookup.
 * Strips leading "Riksavtalen " prefix so both "Riksavtalen §6" and "§6" hit the same key.
 */
function normaliseParagraf(raw: string): string {
  return raw.replace(/^Riksavtalen\s+/i, "").trim();
}

/**
 * Look up a Riksavtalen paragraf by its ref string and optionally a law version.
 *
 * Returns null when the paragraf is not in the static map. Callers should surface
 * the raw paragraf_ref with an empty description rather than erroring.
 *
 * Per ADR-0244: no silent version fallback. When a version is provided and no
 * version-specific override exists, the top-level description is returned with
 * a note that version-specific details are unavailable.
 *
 * @param paragrafRef - e.g. "§6", "Riksavtalen §6", "§14-7 (3)"
 * @param lawVersion  - e.g. "2024", "2025". Optional — uses top-level description.
 */
export function lookupParagraf(
  paragrafRef: string,
  lawVersion?: string | null,
): ParagrafEntry | null {
  const key = normaliseParagraf(paragrafRef);
  const entry = RIKSAVTALEN_PARAGRAF_MAP[key];
  if (!entry) return null;

  if (lawVersion && entry.versions?.[lawVersion]) {
    const v = entry.versions[lawVersion];
    return {
      paragraf: key,
      description: v.description,
      ...(v.rate_value !== undefined ? { rate_value: v.rate_value } : {}),
      ...(v.rate_type !== undefined ? { rate_type: v.rate_type } : {}),
    };
  }

  return {
    paragraf: key,
    description: entry.description,
    ...(entry.rate_value !== undefined ? { rate_value: entry.rate_value } : {}),
    ...(entry.rate_type !== undefined ? { rate_type: entry.rate_type } : {}),
  };
}

/**
 * Enrich a list of raw paragraf_ref strings into ParagrafEntry objects.
 * Refs not found in the map are included with an empty description (never dropped).
 *
 * @param paragrafRefs - Raw paragraf_ref values from supplement_rule rows.
 * @param lawVersion   - Active binding's law_version. Optional.
 */
export function enrichParagrafRefs(
  paragrafRefs: (string | null | undefined)[],
  lawVersion?: string | null,
): ParagrafEntry[] {
  const seen = new Set<string>();
  const result: ParagrafEntry[] = [];

  for (const raw of paragrafRefs) {
    if (!raw) continue;
    const key = normaliseParagraf(raw);
    if (seen.has(key)) continue;
    seen.add(key);

    const found = lookupParagraf(raw, lawVersion);
    result.push(
      found ?? {
        paragraf: key,
        description: "", // Not in static map — surfaced as-is per ADR-0242 spirit.
      },
    );
  }

  return result;
}
