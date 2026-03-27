/**
 * Industry package runtime loader — I1 bootstrap scope only.
 *
 * Loads IndustryPackage with tariff data from tariff_rate_table,
 * falling back to hardcoded defaults when DB data is unavailable.
 *
 * Scope: "What should this workspace look like for this industry?"
 * NOT for D3 runtime tariff resolution — use resolveTariffRate() from cascade lib for that.
 *
 * Fallback chain:
 * 1. Workspace K1b — tariff_rate_table WHERE workspace_id = ? (future: workspace overrides)
 * 2. Platform K1a  — tariff_rate_table WHERE workspace_id IS NULL (seeded by migration)
 * 3. Hardcoded     — static hospitalityPackage constant (always works)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IndustryPackage, IndustryType } from "@smartout/types";
import { hospitalityPackage } from "./packages/hospitality.js";
import { defaultPackage } from "./packages/default.js";

const PACKAGES: Record<IndustryType, IndustryPackage> = {
  hospitality: hospitalityPackage,
  retail: defaultPackage,
  default: defaultPackage,
};

/**
 * Load an IndustryPackage with live tariff rates from the database.
 *
 * Takes an explicit SupabaseClient — never creates its own client.
 * The caller's client determines RLS scope and workspace isolation.
 */
export async function loadIndustryPackage(
  supabase: SupabaseClient,
  industryType: IndustryType,
  workspaceId?: string,
): Promise<IndustryPackage> {
  const base = PACKAGES[industryType];

  // Only hospitality has tariffs to load from DB
  if (industryType !== "hospitality" || base.tariffs.length === 0) {
    return base;
  }

  try {
    // Tier 1: workspace-specific rates (future)
    let rates: TariffRow[] = [];
    if (workspaceId) {
      const { data } = await supabase
        .from("tariff_rate_table")
        .select("rate_type, amount, unit")
        .eq("workspace_id", workspaceId);
      if (data && data.length > 0) {
        rates = data;
      }
    }

    // Tier 2: platform K1a rates (NULL workspace_id)
    if (rates.length === 0) {
      const { data } = await supabase
        .from("tariff_rate_table")
        .select("rate_type, amount, unit")
        .is("workspace_id", null);
      if (data && data.length > 0) {
        rates = data;
      }
    }

    // Tier 3: no DB data available — return hardcoded package as-is
    if (rates.length === 0) {
      return base;
    }

    // Build tariff supplements from DB rows
    return applyRatesToPackage(base, rates);
  } catch {
    // DB error — fall back to hardcoded (tier 3)
    return base;
  }
}

/** Get the hardcoded package without DB lookup — for sync contexts or fallback */
export function getStaticIndustryPackage(industryType: IndustryType): IndustryPackage {
  return PACKAGES[industryType];
}

// -- Internal helpers --

type TariffRow = { rate_type: string; amount: number; unit: string };

function findRate(rates: TariffRow[], rateType: string): TariffRow | undefined {
  return rates.find((r) => r.rate_type === rateType);
}

/** Apply DB tariff rates to the hardcoded package shape */
function applyRatesToPackage(base: IndustryPackage, rates: TariffRow[]): IndustryPackage {
  const kveld = findRate(rates, "kveldstillegg");
  const helg = findRate(rates, "helgetillegg");
  const hellig = findRate(rates, "helligdagstillegg");
  const ot50 = findRate(rates, "overtidstillegg_50");
  const ot100 = findRate(rates, "overtidstillegg_100");
  const minWage = findRate(rates, "minstelonn");

  return {
    ...base,
    tariffs: base.tariffs.map((tariff) => ({
      ...tariff,
      supplements: {
        kveldstillegg: kveld
          ? { ...tariff.supplements.kveldstillegg, rate: kveld.amount }
          : tariff.supplements.kveldstillegg,
        helgetillegg: helg
          ? { ...tariff.supplements.helgetillegg, rate: helg.amount }
          : tariff.supplements.helgetillegg,
        helligdagstillegg: hellig
          ? { ...tariff.supplements.helligdagstillegg, rate: hellig.amount }
          : tariff.supplements.helligdagstillegg,
        overtid_50: ot50
          ? { ...tariff.supplements.overtid_50, threshold_hours: ot50.amount }
          : tariff.supplements.overtid_50,
        overtid_100: ot100
          ? { ...tariff.supplements.overtid_100, threshold_hours: ot100.amount }
          : tariff.supplements.overtid_100,
      },
      minWagePerHour: minWage ? minWage.amount : tariff.minWagePerHour,
    })),
  };
}
