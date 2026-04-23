/**
 * useCreateDayInfo — Enqueues a new schedule_day_info row to the offline sync queue.
 *
 * Day info entries are quick notes, events, or alerts attached to a specific date.
 * Goes through the sync queue so managers can add notes even offline.
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { emit, nonEmpty } from "@smartout/telemetry";

export type DayInfoCategory = "note" | "event" | "alert";

export type CreateDayInfoPayload = {
  title: string;
  content: string | null;
  category: DayInfoCategory;
  date: string;
  workspace_id: string;
  created_by: string;
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
      const dayInfoId = randomUUID();

      const rowId = await enqueue("create_day_info", {
        id: dayInfoId,
        title: payload.title,
        content: payload.content,
        category: payload.category,
        date: payload.date,
        workspace_id: payload.workspace_id,
        created_by: payload.created_by,
        scope_type: "workspace",
      });

      void emit({
        event: "day_info created",
        workspace_id: nonEmpty(payload.workspace_id, "workspace_id"),
        actor_id: nonEmpty(payload.created_by, "actor_id"),
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
