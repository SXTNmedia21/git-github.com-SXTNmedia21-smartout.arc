/**
 * Zustand store for pinned conversations.
 * Persisted to MMKV — pins are local per device.
 */

import { create } from "zustand";

const CACHE_KEY = "cache:pinned-conversations";

function loadPinned(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as string[]) : [];
  } catch {
    return [];
  }
}

function persistPinned(ids: string[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(ids));
  } catch {
    // Cache not available
  }
}

type PinnedState = {
  pinnedIds: string[];
  isPinned: (conversationId: string) => boolean;
  togglePin: (conversationId: string) => void;
};

export const usePinnedConversations = create<PinnedState>((set, get) => ({
  pinnedIds: loadPinned(),

  isPinned: (conversationId: string) => get().pinnedIds.includes(conversationId),

  togglePin: (conversationId: string) => {
    const current = get().pinnedIds;
    const next = current.includes(conversationId)
      ? current.filter((id) => id !== conversationId)
      : [...current, conversationId];
    persistPinned(next);
    set({ pinnedIds: next });
  },
}));
