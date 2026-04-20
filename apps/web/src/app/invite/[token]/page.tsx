/**
 * /invite/[token] — invitation landing page.
 *
 * Server Component. Resolves the invitation state server-side from the
 * token param (which is a credential per ADR-0167), then hands off to a
 * Client Component for the RPC call + emit + interaction logic.
 *
 * Five resolved states (see InviteTokenClient):
 *   invalid             — no row, malformed token, or DB error
 *   expired             — pending but expires_at < now, or status=expired
 *   used                — status=accepted or status=cancelled
 *   valid_new_user      — pending + fresh + email has no auth.users row
 *   valid_existing_user — pending + fresh + email exists in auth.users
 *
 * The token itself is passed through to the client because it is required
 * for:
 *   1. track_invitation_opened RPC call on mount (first-open marking)
 *   2. URL continuation into /signup and /login via ?invite=<token>
 *
 * Per ADR-0167 the token NEVER appears in emit payloads — only the first
 * 8 chars (token_preview). See InviteTokenClient for the emit contract.
 */

import { createClient } from "@smartout/supabase/server";
import { InviteTokenClient } from "./invite-token-client";

type Props = { params: Promise<{ token: string }> };

/** UUID v4-ish shape. We only gate early-exit — the DB has the final say. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape returned by the get_invitation_by_token RPC (pending branch). */
type InviteRpcPending = {
  invitation_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: "pending";
  expires_at: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_slug: string | null;
  workspace_logo_url: string | null;
  inviter_name: string | null;
  email_account_exists: boolean;
};

/** Shape returned when the invitation exists but is not pending. */
type InviteRpcTerminal = { status: string };

type InviteRpcResult = InviteRpcPending | InviteRpcTerminal | null;

export type InviteResolvedState =
  | { kind: "invalid" }
  | { kind: "expired"; expiresAt: string | null }
  | { kind: "used"; status: "accepted" | "cancelled" | string }
  | {
      kind: "valid_new_user" | "valid_existing_user";
      invitationId: string;
      workspaceId: string;
      workspaceName: string;
      workspaceSlug: string;
      workspaceLogoUrl: string | null;
      inviterName: string;
      role: string;
      email: string;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      expiresAt: string;
    };

/** Normalize role slug ('employee', 'manager', ...) to a display label. */
function roleLabelNo(role: string): string {
  switch (role) {
    case "employee":
      return "Ansatt";
    case "manager":
      return "Leder";
    case "admin":
      return "Administrator";
    case "owner":
      return "Eier";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  // Early exit on malformed token — no DB round-trip needed.
  if (!token || !UUID_RE.test(token)) {
    return <InviteTokenClient token={token ?? ""} state={{ kind: "invalid" }} roleLabel="" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

  // RPC hard failure — treat as invalid so we don't leak error internals.
  if (error || data === null || data === undefined) {
    return <InviteTokenClient token={token} state={{ kind: "invalid" }} roleLabel="" />;
  }

  // The RPC returns JSON; supabase-js types it as Json. Narrow it.
  const inv = data as unknown as InviteRpcResult;

  if (inv === null) {
    return <InviteTokenClient token={token} state={{ kind: "invalid" }} roleLabel="" />;
  }

  // Terminal, non-pending states (accepted / cancelled / expired-from-DB).
  if (inv.status !== "pending") {
    if (inv.status === "expired") {
      return (
        <InviteTokenClient
          token={token}
          state={{ kind: "expired", expiresAt: null }}
          roleLabel=""
        />
      );
    }
    return (
      <InviteTokenClient token={token} state={{ kind: "used", status: inv.status }} roleLabel="" />
    );
  }

  // Pending — now lazy-check expiry (Q7 verdict: on-read, no cron).
  // Server Component runs per request, not in a render-reuse window, so
  // reading wall-clock time here is intentional.
  const pending = inv as InviteRpcPending;
  const expiresAtMs = Date.parse(pending.expires_at);
  const nowMs = new Date().getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
    return (
      <InviteTokenClient
        token={token}
        state={{ kind: "expired", expiresAt: pending.expires_at }}
        roleLabel=""
      />
    );
  }

  // Valid — route to the new-user or existing-user variant.
  const kind: "valid_new_user" | "valid_existing_user" = pending.email_account_exists
    ? "valid_existing_user"
    : "valid_new_user";

  const role = pending.role ?? "employee";

  return (
    <InviteTokenClient
      token={token}
      roleLabel={roleLabelNo(role)}
      state={{
        kind,
        invitationId: pending.invitation_id,
        workspaceId: pending.workspace_id,
        workspaceName: pending.workspace_name ?? "din nye arbeidsplass",
        workspaceSlug: pending.workspace_slug ?? "smartout",
        workspaceLogoUrl: pending.workspace_logo_url,
        inviterName: pending.inviter_name ?? "En administrator",
        role,
        email: pending.email ?? "",
        phone: pending.phone,
        firstName: pending.first_name,
        lastName: pending.last_name,
        expiresAt: pending.expires_at,
      }}
    />
  );
}
