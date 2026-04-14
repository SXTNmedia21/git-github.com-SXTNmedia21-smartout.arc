// packages/training/src/hooks/use-readiness-score.ts
"use client";

import { useMemo } from "react";
import type { ReadinessScore } from "../types.js";
import { useAssignedProtocols } from "./use-assigned-protocols.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type UseReadinessScoreOptions = {
  profileId: string | null;
  workspaceId: string;
  supabase: SupabaseClient;
};

export function useReadinessScore({ profileId, workspaceId, supabase }: UseReadinessScoreOptions) {
  const { data: protocols, isLoading } = useAssignedProtocols({ profileId, workspaceId, supabase });

  const score: ReadinessScore = useMemo(() => {
    if (!protocols || protocols.length === 0) return { percent: 0, completed: 0, total: 0 };
    const completed = protocols.filter((p) => p.assignmentStatus === "completed").length;
    return {
      percent: Math.round((completed / protocols.length) * 100),
      completed,
      total: protocols.length,
    };
  }, [protocols]);

  return { score, isLoading };
}
