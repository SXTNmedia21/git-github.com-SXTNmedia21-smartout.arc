/**
 * Zustand store tracking the sync queue state.
 *
 * Exposes pendingCount, failedCount, isOnline, and lastSyncedAt
 * for the SyncIndicator component. The SyncWorker calls refresh()
 * after each sync cycle via the onStatusChange callback.
 */
import { create } from "zustand";

import { syncWorker } from "@/lib/sync/worker";

type SyncStatusState = {
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  lastSyncedAt: Date | null;

  /** Re-read counts from SQLite and connectivity from the worker. */
  refresh: () => Promise<void>;
  /** Mark the last successful sync timestamp. */
  markSynced: () => void;
};

export const useSyncStatus = create<SyncStatusState>((set) => ({
  pendingCount: 0,
  failedCount: 0,
  isOnline: true,
  lastSyncedAt: null,

  refresh: async () => {
    const { pending, failed } = await syncWorker.getCounts();
    set({
      pendingCount: pending,
      failedCount: failed,
      isOnline: syncWorker.online,
    });
  },

  markSynced: () => {
    set({ lastSyncedAt: new Date() });
  },
}));
