import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// NACE codes that map to each industry type
const INDUSTRY_NACE: Record<IndustryType, string> = {
  hospitality: "56.101",
  retail: "47.110",
  default: "00.000",
};

function detectIndustryType(intelligenceData: unknown): IndustryType {
  if (!intelligenceData || typeof intelligenceData !== "object") return "default";
  const data = intelligenceData as Record<string, unknown>;

  // Check for manually set industry type first
  if (typeof data.industryType === "string") {
    const manual = data.industryType as string;
    if (manual in PACKAGES) return manual as IndustryType;
  }

  // Check brregData for NACE code
  const brreg = data.brregData as Record<string, unknown> | undefined;
  const naceCode = brreg?.naceCode;
  if (typeof naceCode === "string") {
    if (naceCode.startsWith("56") || naceCode.startsWith("55")) {
      return "hospitality";
    }
    if (naceCode.startsWith("47")) {
      return "retail";
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

export type UseIndustryPackageResult = {
  package: IndustryPackage;
  detectedType: IndustryType;
  setIndustryType: (type: IndustryType) => void;
  isPersisting: boolean;
};

export function useIndustryPackage(): UseIndustryPackageResult {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  // Local override for instant UI feedback
  const [localOverride, setLocalOverride] = useState<IndustryType | null>(null);

  const queryKey = ["workspace-intelligence", workspace.workspace_id];

  const { data: intelligenceData } = useQuery({
    queryKey,
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

  const dbDetectedType = useMemo(() => detectIndustryType(intelligenceData), [intelligenceData]);

  // Local override wins over DB-detected type
  const detectedType = localOverride ?? dbDetectedType;

  const persistMutation = useMutation({
    mutationFn: async (type: IndustryType) => {
      const supabase = createClient();
      const existing =
        intelligenceData && typeof intelligenceData === "object"
          ? (intelligenceData as Record<string, unknown>)
          : {};
      const merged = {
        ...existing,
        industryType: type,
        brregData: {
          ...(existing.brregData as Record<string, unknown> | undefined),
          naceCode: INDUSTRY_NACE[type],
        },
      };
      const { error } = await supabase
        .from("workspace")
        .update({ intelligence_data: merged })
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const setIndustryType = useCallback(
    (type: IndustryType) => {
      // Instant local update — no waiting for DB
      setLocalOverride(type);
      // Persist to DB in background
      persistMutation.mutate(type);
    },
    [persistMutation],
  );

  const pkg = useMemo(() => PACKAGES[detectedType], [detectedType]);

  return {
    package: pkg,
    detectedType,
    setIndustryType,
    isPersisting: persistMutation.isPending,
  };
}
