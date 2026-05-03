import type {
  BulkInvitePayload,
  BulkInviteResponse,
  SingleInvitePayload,
  SingleInviteResponse,
} from "./types";

export type SubmitResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };

// Minimal fetch shape — avoids DOM lib so the package works in mobile too.
type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export type SubmitOptions = {
  endpoint?: string;
  fetchImpl?: FetchLike;
  headers?: Record<string, string>;
};

const DEFAULT_ENDPOINT = "/api/admin/invite";

export async function submitSingleInvite(
  payload: SingleInvitePayload,
  options: SubmitOptions = {},
): Promise<SubmitResult<SingleInviteResponse>> {
  return submit<SingleInviteResponse>(payload, "Invite failed", options);
}

export async function submitBulkInvite(
  payload: BulkInvitePayload,
  options: SubmitOptions = {},
): Promise<SubmitResult<BulkInviteResponse>> {
  return submit<BulkInviteResponse>(payload, "Batch invite failed", options);
}

async function submit<T>(
  payload: unknown,
  defaultErrorMessage: string,
  options: SubmitOptions,
): Promise<SubmitResult<T>> {
  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
  const fetchImpl = options.fetchImpl ?? globalFetch;
  if (!fetchImpl) {
    return { ok: false, error: "No fetch implementation available" };
  }
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: unknown;
      };
      return {
        ok: false,
        error: errBody.error ?? defaultErrorMessage,
        details: errBody.details,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
