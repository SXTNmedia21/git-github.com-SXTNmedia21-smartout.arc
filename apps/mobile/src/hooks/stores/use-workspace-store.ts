/**
 * Zustand store for the selected workspace/profile context.
 * Persists the selected profile_id to MMKV so multi-workspace users
 * return to the right workspace on app restart.
 *
 * All hooks that resolve "current profile" (useMyProfile, useMyShifts, etc.)
 * should read selectedProfileId from this store when available.
 */

import { create } from "zustand";
import { storage } from "@/lib/cache/mmkv";

type WorkspaceState = {
  /** The profile_id of the workspace the user selected. Null = not yet chosen (use first active). */
  selectedProfileId: string | null;
  /** Set when user picks a workspace in workspace-select. */
  setSelectedProfile: (profileId: string) => void;
  /** Clear on sign-out so next sign-in starts fresh. */
  clearSelectedProfile: () => void;
};

const CACHE_KEY = "cache:selected-profile-id";

function loadInitialProfileId(): string | null {
  try {
    return storage.getString(CACHE_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistProfileId(profileId: string | null) {
  try {
    if (profileId) {
      storage.set(CACHE_KEY, profileId);
    } else {
      storage.delete(CACHE_KEY);
    }
  } catch {
    // MMKV not available (e.g. web platform)
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedProfileId: loadInitialProfileId(),
  setSelectedProfile: (profileId) => {
    persistProfileId(profileId);
    set({ selectedProfileId: profileId });
  },
  clearSelectedProfile: () => {
    persistProfileId(null);
    set({ selectedProfileId: null });
  },
}));
