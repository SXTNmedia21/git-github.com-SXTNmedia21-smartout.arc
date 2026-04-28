import type { InviteChannel, InviteDraft, InviteRow } from "./types";

// Storage interface — web supplies localStorage adapter, mobile supplies AsyncStorage adapter.
export type DraftStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const DRAFT_KEY_PREFIX = "smartout:invite-draft:";

function key(workspaceId: string): string {
  return `${DRAFT_KEY_PREFIX}${workspaceId}`;
}

export async function loadDraft(
  storage: DraftStorage,
  workspaceId: string,
): Promise<InviteDraft | null> {
  try {
    const raw = await storage.getItem(key(workspaceId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const draft = parsed as Partial<InviteDraft>;
    if (!draft.row || typeof draft.row !== "object") return null;
    return {
      row: draft.row as InviteDraft["row"],
      channels: Array.isArray(draft.channels) ? (draft.channels as InviteChannel[]) : ["link"],
    };
  } catch {
    return null;
  }
}

export async function saveDraft(
  storage: DraftStorage,
  workspaceId: string,
  row: InviteRow,
  channels: Set<InviteChannel>,
): Promise<void> {
  try {
    const { id: _id, errors: _errors, ...rest } = row;
    const payload: InviteDraft = {
      row: rest,
      channels: Array.from(channels),
    };
    await storage.setItem(key(workspaceId), JSON.stringify(payload));
  } catch {
    // quota exceeded or storage disabled — draft loss acceptable
  }
}

export async function clearDraft(storage: DraftStorage, workspaceId: string): Promise<void> {
  try {
    await storage.removeItem(key(workspaceId));
  } catch {
    // ignore
  }
}

type WebLocalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

// Web localStorage adapter — synchronous under the hood, async-compatible signature.
// Avoids depending on the DOM lib so this package can be consumed by mobile too.
export function createLocalStorageAdapter(): DraftStorage | null {
  const w = (globalThis as { localStorage?: WebLocalStorage }).localStorage;
  if (!w) return null;
  return {
    getItem: (k) => w.getItem(k),
    setItem: (k, v) => w.setItem(k, v),
    removeItem: (k) => w.removeItem(k),
  };
}
