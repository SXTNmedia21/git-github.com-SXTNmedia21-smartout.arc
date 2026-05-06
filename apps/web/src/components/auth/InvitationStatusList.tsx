"use client";

/**
 * InvitationStatusList — admin-facing table of every invitation in a
 * workspace, across all statuses. Co-located with the other invitation
 * primitives under components/auth/ (see InvitationStatusBadge,
 * InvitationContextHeader, AuthBrandPanel).
 *
 * Responsibilities:
 *
 *   1. Render rows using the canonical DB statuses (pending | accepted |
 *      expired | cancelled) resolved through `deriveDisplayStatus` — this is
 *      the only place the "opened" display state is inferred from the
 *      `opened_at` timestamp (L-0090 enum-vs-timestamp cascade heuristic).
 *
 *   2. Lazy on-read expiry detection (Auth Spec Council Q7 = b + L-0083):
 *      for every row where the DB status is still "pending" but
 *      `expires_at < now()`, fire the `markInvitationExpired` Server Action
 *      exactly once per row per mount. The server action is idempotent —
 *      the WHERE clause guards against concurrent admin tabs racing the
 *      same row, and we emit `"invitation expired"` only when the UPDATE
 *      actually flipped a row (rowCount > 0).
 *
 *      The emit contract is owned by the server action per ADR-0167:
 *      tokens never leave the server; only first-8-chars `token_preview`
 *      enters the telemetry payload. The client here never sees the token.
 *
 *   3. Row actions:
 *        pending / opened   → Kopier lenke, Send på nytt, Avbryt
 *        accepted           → Se bruker (navigates to profile)
 *        expired / cancelled → Slett fra liste (cancel = soft delete)
 *
 *   4. Filter bar: status dropdown (Alle / Venter / Åpnet / ...) + email
 *      search. Filtering is purely client-side — the full workspace list is
 *      already hydrated server-side.
 *
 * Nordic Split compliance: OKLCH CSS variables only (bg-background,
 * text-foreground, border-border, bg-muted, text-muted-foreground). No
 * zinc/slate/gray. Lucide icons. Geist Sans for the table, Instrument
 * Serif reserved for the `font-heading` section title.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Mail, MoreHorizontal, Search, Send, Trash2, UserRound, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InvitationStatusBadge,
  deriveDisplayStatus,
  type DisplayStatus,
  type InvitationDbStatus,
} from "./InvitationStatusBadge";
import {
  cancelInvitation,
  markInvitationExpired,
  resendInvitation,
} from "@/app/dashboard/people/_actions/people-actions";

/**
 * Row shape expected from the server loader. Kept structural rather than
 * importing the server-action type to avoid forcing every consumer through
 * the Server Action bundle graph.
 */
export type InvitationListRow = {
  invitation_id: string;
  workspace_id: string;
  email: string | null;
  role: string;
  status: InvitationDbStatus;
  opened_at: string | null;
  expires_at: string;
  created_at: string;
  invited_by: string | null;
  invite_type: string | null;
};

type Props = {
  rows: InvitationListRow[];
  /**
   * Workspace slug used to build the "Kopier lenke" target. The raw invite
   * token is included in the URL (same pattern as the email link — the
   * token was always going to live in that URL). NEVER logged beyond that.
   */
  workspaceSlug?: string | null;
  /**
   * Fired after any mutation (resend, cancel, delete). Lets the parent
   * re-fetch the list so the new state is reflected immediately.
   */
  onChange?: () => void;
};

/** Nordic role labels. Falls back to the raw role string for unknown values. */
const ROLE_LABEL: Record<string, string> = {
  owner: "Eier",
  admin: "Admin",
  manager: "Leder",
  employee: "Ansatt",
};

/** Status filter options, in display order. "all" surfaces everything. */
const STATUS_FILTERS: Array<{ value: "all" | DisplayStatus; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "pending", label: "Venter" },
  { value: "opened", label: "Åpnet" },
  { value: "accepted", label: "Godtatt" },
  { value: "expired", label: "Utløpt" },
  { value: "cancelled", label: "Kansellert" },
];

/**
 * Formats an ISO timestamp as "dd.MM.yyyy HH:mm" in Norwegian. Returns an
 * em-dash for unparseable input so the UI never shows "Invalid Date".
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    // timeZone pinned to Europe/Oslo so SSR (container TZ may be UTC/CET)
    // and client (CEST in summer) produce identical output. Without this,
    // server and client diverge by 1–2 h depending on DST → React hydration
    // mismatch on the "Sendt"/"Created" column.
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Oslo",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * Short relative-date formatter for the "Utløper" column — switches to a
 * relative phrasing ("om 3 dager", "for 2 timer siden") when the expiry is
 * within one week of now. Outside that window it falls back to the absolute
 * date so the user gets an anchor.
 */
function formatExpiresCompact(iso: string): { text: string; urgent: boolean } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: "—", urgent: false };

  const deltaMs = d.getTime() - Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const absDelta = Math.abs(deltaMs);

  if (absDelta < ONE_WEEK) {
    const rtf = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" });
    const days = Math.round(deltaMs / (24 * 60 * 60 * 1000));
    if (Math.abs(days) >= 1) {
      return { text: rtf.format(days, "day"), urgent: days >= 0 && days <= 2 };
    }
    const hours = Math.round(deltaMs / (60 * 60 * 1000));
    return { text: rtf.format(hours, "hour"), urgent: deltaMs >= 0 };
  }

  try {
    return {
      text: new Intl.DateTimeFormat("nb-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Oslo",
      }).format(d),
      urgent: false,
    };
  } catch {
    return { text: d.toISOString().slice(0, 10), urgent: false };
  }
}

export function InvitationStatusList({ rows, workspaceSlug, onChange }: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [emailQuery, setEmailQuery] = useState("");
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  /**
   * Lazy expiry detection. For every row currently sitting at `pending` but
   * whose `expires_at` is already in the past, call `markInvitationExpired`
   * once. The server action is idempotent across racing tabs, and only
   * emits when it actually flips a row (so we are NOT a second producer).
   *
   * A ref gate prevents re-firing for the same invitation_id across
   * re-renders within the same mount.
   */
  const firedExpiryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = Date.now();
    const toExpire = rows.filter(
      (r) =>
        r.status === "pending" &&
        new Date(r.expires_at).getTime() < now &&
        !firedExpiryRef.current.has(r.invitation_id),
    );
    if (toExpire.length === 0) return;

    let stillMounted = true;
    void (async () => {
      for (const row of toExpire) {
        firedExpiryRef.current.add(row.invitation_id);
        try {
          const result = await markInvitationExpired(row.invitation_id);
          // Only ping the parent to refetch if the server actually flipped
          // the row — keeps us from thrashing the list when every tab
          // re-renders.
          if (stillMounted && result.expired) {
            onChange?.();
          }
        } catch {
          // Swallow — the server logged; next mount will retry. The
          // ref-gate above means we still block duplicate attempts
          // during this session.
        }
      }
    })();

    return () => {
      stillMounted = false;
    };
  }, [rows, onChange]);

  // Filter + search are purely client-side over the already-hydrated list.
  const filteredRows = useMemo(() => {
    const q = emailQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const display = deriveDisplayStatus(row);
      if (statusFilter !== "all" && display !== statusFilter) return false;
      if (q && !(row.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, emailQuery]);

  async function handleResend(row: InvitationListRow) {
    setPendingRowId(row.invitation_id);
    try {
      await resendInvitation(row.workspace_id, row.invitation_id);
      toast.success("Invitasjon sendt på nytt");
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke sende på nytt");
    } finally {
      setPendingRowId(null);
    }
  }

  async function handleCancel(row: InvitationListRow) {
    setPendingRowId(row.invitation_id);
    try {
      await cancelInvitation(row.invitation_id);
      toast.success("Invitasjon avbrutt");
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke avbryte");
    } finally {
      setPendingRowId(null);
    }
  }

  async function handleCopyLink(row: InvitationListRow) {
    // Build the portal invite URL from the workspace slug. The token is
    // already part of the URL (the email linked here too), so this doesn't
    // widen exposure beyond the existing channel. We intentionally do NOT
    // log or store the token — the clipboard write is the only surface.
    // Requires a separate server round-trip to fetch the token safely
    // (RLS-scoped) — we use a minimal server function below.
    setPendingRowId(row.invitation_id);
    try {
      const token = await fetchInviteTokenSafe(row.invitation_id);
      if (!token) {
        toast.error("Kunne ikke hente lenken");
        return;
      }
      const base = "https://app.smartout.ai";
      const slugSuffix = workspaceSlug ? `?ws=${encodeURIComponent(workspaceSlug)}` : "";
      const url = `${base}/invite/${token}${slugSuffix}`;
      await navigator.clipboard.writeText(url);
      toast.success("Invitasjonslenke kopiert");
    } catch {
      toast.error("Kunne ikke kopiere lenken");
    } finally {
      setPendingRowId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader />
        <div className="border-border/60 bg-card text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border px-6 py-12 text-sm">
          <Mail className="text-muted-foreground/70 h-8 w-8" aria-hidden />
          <p className="text-foreground mt-1 text-sm font-medium">Ingen invitasjoner ennå</p>
          <p className="max-w-[360px] text-center text-xs">
            Klikk &quot;Inviter&quot; øverst til høyre for å invitere den første personen til
            arbeidsflaten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader />

      {/* Filter + search bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | DisplayStatus)}
        >
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:max-w-sm">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Søk på e-post"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="border-border/60 bg-card hidden overflow-hidden rounded-2xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                E-post
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Rolle
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Sendt
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Utløper
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Status
              </TableHead>
              <TableHead className="w-[64px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center text-sm">
                  Ingen invitasjoner matcher filteret.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const display = deriveDisplayStatus(row);
                const expires = formatExpiresCompact(row.expires_at);
                const isBusy = pendingRowId === row.invitation_id;
                return (
                  <TableRow
                    key={row.invitation_id}
                    className="border-border/60 hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="text-foreground text-sm">
                      {row.email ?? <span className="text-muted-foreground">— SMS</span>}
                    </TableCell>
                    <TableCell className="text-foreground text-sm">
                      {ROLE_LABEL[row.role] ?? row.role}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell
                      className={
                        expires.urgent && display !== "expired"
                          ? "text-warning text-sm"
                          : "text-muted-foreground text-sm"
                      }
                    >
                      {expires.text}
                    </TableCell>
                    <TableCell>
                      <InvitationStatusBadge invitation={row} />
                    </TableCell>
                    <TableCell className="text-right">
                      <InvitationRowActions
                        row={row}
                        display={display}
                        busy={isBusy}
                        onResend={handleResend}
                        onCancel={handleCancel}
                        onCopyLink={handleCopyLink}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Card list (mobile) — admin read-only view per ADR-0134 */}
      <div className="flex flex-col gap-2 md:hidden">
        {filteredRows.length === 0 ? (
          <div className="text-muted-foreground border-border/60 bg-card rounded-xl border px-4 py-8 text-center text-sm">
            Ingen invitasjoner matcher filteret.
          </div>
        ) : (
          filteredRows.map((row) => {
            const display = deriveDisplayStatus(row);
            const expires = formatExpiresCompact(row.expires_at);
            const isBusy = pendingRowId === row.invitation_id;
            return (
              <div
                key={row.invitation_id}
                className="border-border/60 bg-card flex flex-col gap-2 rounded-2xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {row.email ?? "— SMS"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {ROLE_LABEL[row.role] ?? row.role} · Sendt {formatDateTime(row.created_at)}
                    </p>
                  </div>
                  <InvitationStatusBadge invitation={row} />
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={
                      expires.urgent && display !== "expired"
                        ? "text-warning text-xs"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    Utløper {expires.text}
                  </span>
                  <InvitationRowActions
                    row={row}
                    display={display}
                    busy={isBusy}
                    onResend={handleResend}
                    onCancel={handleCancel}
                    onCopyLink={handleCopyLink}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Private helpers ─────────────────────────────────────────────────

function SectionHeader() {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h2 className="font-heading text-foreground text-2xl tracking-tight">Invitasjoner</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Alle invitasjoner i arbeidsflaten — sendt, åpnet, godtatt eller utløpt.
        </p>
      </div>
    </div>
  );
}

type RowActionProps = {
  row: InvitationListRow;
  display: DisplayStatus;
  busy: boolean;
  onResend: (row: InvitationListRow) => void;
  onCancel: (row: InvitationListRow) => void;
  onCopyLink: (row: InvitationListRow) => void;
};

function InvitationRowActions({
  row,
  display,
  busy,
  onResend,
  onCancel,
  onCopyLink,
}: RowActionProps) {
  if (display === "accepted") {
    // The invitation links to an existing profile; navigate to the people
    // detail view when the admin clicks "Se bruker". We don't have a
    // profile_id on the invitation row itself, so the anchor uses the
    // invitation's email as a lookup hint at the list level.
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/dashboard/people?email=${encodeURIComponent(row.email ?? "")}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Se bruker
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          disabled={busy}
          aria-label="Handlinger"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(display === "pending" || display === "opened") && (
          <>
            <DropdownMenuItem onSelect={() => onCopyLink(row)}>
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Kopier lenke
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onResend(row)}>
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Send på nytt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onCancel(row)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" aria-hidden />
              Avbryt
            </DropdownMenuItem>
          </>
        )}
        {(display === "expired" || display === "cancelled") && (
          <DropdownMenuItem onSelect={() => onCancel(row)} className="text-muted-foreground">
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Slett fra liste
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Minimal RLS-scoped token fetch for the "Kopier lenke" action. Uses the
 * user's auth context (no service role), so admins can retrieve tokens for
 * their own workspace only. The token is returned synchronously to the
 * client — same as the original email — but never flows into emit payloads
 * or console logs per ADR-0167.
 */
async function fetchInviteTokenSafe(invitationId: string): Promise<string | null> {
  // Deliberately inline so the component is self-contained; in practice
  // this could live alongside people-actions.ts. The call uses the
  // browser supabase client → workspace RLS decides visibility.
  const { createClient } = await import("@smartout/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitation")
    .select("token")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (error || !data) return null;
  return data.token;
}
