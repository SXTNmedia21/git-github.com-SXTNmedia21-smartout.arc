"use client";

import { useMemo } from "react";
import { useAssignedProtocols } from "@/app/dashboard/my-training/_hooks/use-assigned-protocols";

export function useReadinessScore(profileId: string | null) {
  const { data: protocols, isLoading } = useAssignedProtocols(profileId);

  const score = useMemo(() => {
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
