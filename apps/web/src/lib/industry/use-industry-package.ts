import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { hospitalityPackage } from "./packages/hospitality";
import { defaultPackage } from "./packages/default";
import type { IndustryPackage, IndustryType } from "./types";

const PACKAGES: Record<IndustryType, IndustryPackage> = {
  hospitality: hospitalityPackage,
  retail: defaultPackage,
  default: defaultPackage,
};

function detectIndustryType(intelligenceData: unknown): IndustryType {
  if (!intelligenceData || typeof intelligenceData !== "object") return "default";
  const data = intelligenceData as Record<string, unknown>;

  // Check brregData for NACE code
  const brreg = data.brregData as Record<string, unknown> | undefined;
  const naceCode = brreg?.naceCode;
  if (typeof naceCode === "string") {
    // NACE 56.x = restaurants/catering, 55.x = hotels/accommodation
    if (naceCode.startsWith("56") || naceCode.startsWith("55")) {
      return "hospitality";
    }
  }

  // Fallback: check scrapedData for restaurant-related keywords
  const scraped = data.scrapedData as Record<string, unknown> | undefined;
  const companyType = scraped?.companyType;
  if (typeof companyType === "string" && /restaurant|cafe|bar|hotel|servering/i.test(companyType)) {
    return "hospitality";
  }

  return "default";
}

export function useIndustryPackage(): IndustryPackage {
  const { workspace } = useWorkspace();

  const { data: intelligenceData } = useQuery({
    queryKey: ["workspace-intelligence", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("workspace")
        .select("intelligence_data")
        .eq("workspace_id", workspace.workspace_id)
        .single();
      return data?.intelligence_data ?? null;
    },
    staleTime: Infinity,
  });

  return useMemo(() => {
    const type = detectIndustryType(intelligenceData);
    return PACKAGES[type];
  }, [intelligenceData]);
}
