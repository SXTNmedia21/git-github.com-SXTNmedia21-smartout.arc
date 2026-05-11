"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionListItem, SessionDetail } from "@/app/api/botsson/sessions/_schema";

const SESSIONS_KEY = ["botsson", "sessions"] as const;

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async (): Promise<SessionListItem[]> => {
      const res = await fetch("/api/botsson/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const body = (await res.json()) as { sessions: SessionListItem[] };
      return body.sessions;
    },
    staleTime: 30_000,
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, "detail", id] as const,
    enabled: !!id,
    queryFn: async (): Promise<SessionDetail> => {
      const res = await fetch(`/api/botsson/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      return (await res.json()) as SessionDetail;
    },
  });
}

export function useArchiveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/botsson/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive");
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: SESSIONS_KEY });
      const prev = qc.getQueryData<SessionListItem[]>(SESSIONS_KEY);
      if (prev) {
        qc.setQueryData<SessionListItem[]>(
          SESSIONS_KEY,
          prev.filter((s) => s.id !== id),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(SESSIONS_KEY, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}
