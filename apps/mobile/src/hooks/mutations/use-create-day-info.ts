/**
 * useCreateDayInfo — Enqueues a new schedule_day_info row to the offline sync queue.
 *
 * Day info entries are quick notes, events, or alerts attached to a specific date.
 * Goes through the sync queue so managers can add notes even offline.
 *
 * ADR-0134: identity (workspace_id, actor_id) is resolved via getProfileContext()
 * before emit — caller-supplied IDs were forgeable attribution (L-0083 / L-0177).
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

export type DayInfoCategory = "note" | "event" | "alert";

export type CreateDayInfoPayload = {
  title: string;
  content: string | null;
  category: DayInfoCategory;
  date: string;
};

type UseCreateDayInfoReturn = {
  createDayInfo: (payload: CreateDayInfoPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useCreateDayInfo(): UseCreateDayInfoReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createDayInfo = useCallback(async (payload: CreateDayInfoPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      // ADR-0134: resolve identity from server before any write or emit.
      // Throws on unauthenticated / missing profile — fail fast, no corrupt telemetry.
      const { profileId, workspaceId } = await getProfileContext();

      const dayInfoId = randomUUID();

      const rowId = await enqueue("create_day_info", {
        id: dayInfoId,
        title: payload.title,
        content: payload.content,
        category: payload.category,
        date: payload.date,
        workspace_id: workspaceId,
        created_by: profileId,
        scope_type: "workspace",
      });

      void emit({
        event: "day_info created",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          data: { category: payload.category, date: payload.date },
        },
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { createDayInfo, isSubmitting };
}
