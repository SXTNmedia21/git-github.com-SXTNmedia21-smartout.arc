"use client";

/**
 * apps/web/src/app/dashboard/admin/pos-accounts/_components/PosAccountsList.tsx
 *
 * POS Accounts client island — list + Connect Lightspeed modal.
 *
 * Design (smartout-nordic-split):
 *   - font-heading heading, CSS vars throughout (bg-background, text-foreground,
 *     border-border, bg-muted, text-muted-foreground).
 *   - Status badge via semantic CSS vars: --color-success (active), --color-muted (inactive).
 *   - Motion: motionTokens.spring (list enter), motionTokens.springSnappy (button press).
 *   - Glassmorphism empty state: bg-background/80 backdrop-blur-xl.
 *   - Lucide icons only (Plug, CheckCircle2, XCircle, RefreshCw, Plus).
 *
 * Server action contract (stage-engine path):
 *   POST /api/botsson/chat with intent "connect_pos" or direct stage-engine
 *   capability dispatch. V1 uses a Next.js Server Action for simplicity —
 *   the action calls the capability tool body directly (admin auth verified
 *   server-side via Supabase session). Real OAuth2 (ADR-0310) will route via
 *   Edge Function.
 *
 * TanStack Query mutation: emit() in onSuccess is handled by the capability
 * tool (pos.account.connected event). The Server Action resolves, router.refresh()
 * re-fetches the server data.
 *
 * References:
 *   ADR-0305 — POS adapter, connect/disconnect admin surface.
 *   smartout-nordic-split — CSS vars, motion tokens, glassmorphism recipe.
 */

import { useState, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Plug, CheckCircle2, XCircle, RefreshCw, Plus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PosAccountRow } from "../page";
import { PosAccountsToolsBridge } from "../_tools/pos-accounts-tools-bridge";

// ─── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
      ].join(" ")}
      aria-label={`Status: ${status}`}
    >
      {isActive ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      ) : (
        <XCircle className="h-3 w-3" aria-hidden="true" />
      )}
      {isActive ? "Aktiv" : "Inaktiv"}
    </span>
  );
}

// ─── Connect modal ─────────────────────────────────────────────────────────

function ConnectModal({
  isOpen,
  onClose,
  onConnect,
  loading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (externalId: string, oauthCode: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [externalId, setExternalId] = useState("");
  const [oauthCode, setOauthCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalId.trim() || !oauthCode.trim()) return;
    await onConnect(externalId.trim(), oauthCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Koble til Lightspeed"
    >
      {/* Backdrop */}
      <motion.div
        className="bg-background/60 absolute inset-0 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel — glassmorphism recipe */}
      <motion.div
        className="bg-background/80 border-border relative z-10 w-full max-w-md rounded-xl border p-6 shadow-lg backdrop-blur-xl"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: "spring", ...motionTokens.spring }}
      >
        <h2 className="font-heading text-foreground mb-1 flex items-center gap-2 text-lg">
          <Plug className="text-muted-foreground h-5 w-5" aria-hidden="true" />
          Koble til Lightspeed K-Series
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">
          V1 mock: skriv inn konto-ID og autorisasjonskode. Real OAuth2 (ADR-0310) kommer i neste
          sortie.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">
              Konto-ID (external_account_id)
            </span>
            <input
              type="text"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-border rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              placeholder="ls-account-001"
              required
              aria-required="true"
              disabled={loading}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-medium">OAuth-kode</span>
            <input
              type="text"
              value={oauthCode}
              onChange={(e) => setOauthCode(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-border rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              placeholder="code-from-lightspeed"
              required
              aria-required="true"
              disabled={loading}
            />
          </label>

          {error && (
            <div className="bg-muted text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <motion.button
              type="button"
              onClick={onClose}
              className="border-border text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm transition-colors"
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", ...motionTokens.springSnappy }}
              disabled={loading}
            >
              Avbryt
            </motion.button>
            <motion.button
              type="submit"
              className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", ...motionTokens.springSnappy }}
              disabled={loading || !externalId.trim() || !oauthCode.trim()}
              aria-busy={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-label="Kobler til..." />
              ) : (
                "Koble til"
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function PosAccountsList({
  accounts,
  workspaceId,
}: {
  accounts: PosAccountRow[];
  workspaceId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = useCallback(
    async (externalId: string, oauthCode: string) => {
      setConnectLoading(true);
      setConnectError(null);
      try {
        // workspace_id is derived server-side (ADR-0151) — never sent from client.
        const res = await fetch("/api/botsson/pos/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            external_account_id: externalId,
            oauth_code: oauthCode,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setModalOpen(false);
        router.refresh();
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : "Ukjent feil.");
      } finally {
        setConnectLoading(false);
      }
    },
    [router],
  );

  const hasAccounts = accounts.length > 0;

  // Serialized snapshot for the Botsson tool bridge — public metadata only.
  // ADR-0077: never forward oauth_token / refresh_token.
  const toolAccounts = useMemo(
    () =>
      accounts.map((a) => ({
        pos_account_id: a.pos_account_id,
        name: a.vendor === "lightspeed_kseries" ? "Lightspeed K-Series" : a.vendor,
        external_account_id: a.external_account_id,
        connected_at: a.created_at,
        is_active: a.status === "active",
      })),
    [accounts],
  );

  return (
    <>
      {/* Botsson read-only tools — registers on mount, cleans up on unmount */}
      <PosAccountsToolsBridge accounts={toolAccounts} workspaceIsActive={true} />

      <AnimatePresence>
        {modalOpen && (
          <ConnectModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onConnect={handleConnect}
            loading={connectLoading}
            error={connectError}
          />
        )}
      </AnimatePresence>

      {/* ─── Content ──────────────────────────────────────────────────── */}
      {hasAccounts ? (
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {accounts.length} tilkoblet konto{accounts.length !== 1 ? "er" : ""}
            </p>
            <motion.button
              onClick={() => setModalOpen(true)}
              className="border-border text-foreground hover:bg-muted flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors"
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", ...motionTokens.springSnappy }}
              aria-label="Koble til ny POS-konto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Koble til ny
            </motion.button>
          </div>

          {/* Account rows */}
          <motion.ul
            className="flex flex-col gap-2"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.06 } },
            }}
            role="list"
            aria-label="POS-kontoer"
          >
            {accounts.map((account) => (
              <motion.li
                key={account.pos_account_id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { type: "spring", ...motionTokens.spring },
                  },
                }}
                className="border-border bg-muted/40 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Plug className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-medium">
                      {account.vendor === "lightspeed_kseries"
                        ? "Lightspeed K-Series"
                        : account.vendor}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {account.external_account_id}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={account.status} />
                  {account.last_synced_at && (
                    <span className="text-muted-foreground hidden text-xs sm:block">
                      Sist synkronisert{" "}
                      {new Date(account.last_synced_at).toLocaleString("nb-NO", {
                        timeZone: "Europe/Oslo",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      ) : (
        /* ─── Empty state — glassmorphism recipe ─────────────────────── */
        <motion.div
          className="bg-background/80 border-border flex flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-12 text-center backdrop-blur-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", ...motionTokens.spring }}
          role="status"
          aria-label="Ingen POS-kontoer tilkoblet"
        >
          <div className="bg-muted rounded-full p-4">
            <Plug className="text-muted-foreground h-8 w-8" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-foreground text-base">Ingen POS-konto tilkoblet</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              Koble til Lightspeed K-Series for å hente salgsdata og forbedre bemanningsprognoser.
            </p>
          </div>
          <motion.button
            onClick={() => setModalOpen(true)}
            className="bg-foreground text-background flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", ...motionTokens.springSnappy }}
            aria-label="Koble til Lightspeed K-Series"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Koble til Lightspeed
          </motion.button>
        </motion.div>
      )}
    </>
  );
}
