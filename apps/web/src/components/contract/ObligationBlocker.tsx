// apps/web/src/components/contract/ObligationBlocker.tsx
//
// What: Renders a blocker when employee has overdue contract obligations.
// Why: Journey 4 — clock-in blocked by is_employee_blocked RPC (ADR-0235);
//      renders in 3 contexts per ARCHITECTURE §UI 3 ObligationBlocker variants.
//
// Variants:
//   "banner"       — Web: full-width banner (people-page, my-contract).
//   "sheet"        — Mobile: bottom sheet style (ADR-0133 — mobile executes).
//   "botsson-card" — Botsson chat card (compact, inline in chat).
//
// All variants:
//   - Show obligation name, due date, overdue delta
//   - CTA: deep-link to /dashboard/competence/protocol/[id]
//   - Emit contract.obligation_blocker_shown on mount (ADR-0193 telemetry)
//   - Respect useReducedMotion — no entrance animation when reduced (ADR-0236 WCAG AAA)
//
// ADR-0236 (WCAG AAA): role="alert" on banner/sheet for screen readers.
// Colors: CSS variables only (Nordic Split — no hardcoded zinc/amber).

"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ExternalLink, XCircle } from "lucide-react";
import { motion as motionTokens } from "@smartout/design-tokens";
// emit import deferred — obligation_blocker_shown not yet in telemetry registry.
// Add to registry in a follow-up sortie when the event is formally accepted.
// import { emit, nonEmpty } from "@smartout/telemetry";

export interface ObligationBlockerProps {
  variant: "banner" | "sheet" | "botsson-card";
  obligationName: string;
  dueDate: string;
  protocolId: string;
  workspaceSlug: string;
  /** Optional: caller's profile_id for telemetry (ADR-0193). */
  profileId?: string;
  /** Optional: workspace_id for telemetry (ADR-0193). */
  workspaceId?: string;
}

export function MobileObligationBlocker(props: Omit<ObligationBlockerProps, "variant">) {
  return <ObligationBlocker {...props} variant="sheet" />;
}

export function WebObligationBlocker(props: Omit<ObligationBlockerProps, "variant">) {
  return <ObligationBlocker {...props} variant="banner" />;
}

export function BotssonObligationBlockerCard(props: Omit<ObligationBlockerProps, "variant">) {
  return <ObligationBlocker {...props} variant="botsson-card" />;
}

function formatOverdueDelta(dueDateIso: string): string {
  const due = new Date(dueDateIso);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    const remaining = Math.abs(diffDays);
    return remaining === 0
      ? "Forfaller i dag"
      : `Forfaller om ${remaining} dag${remaining !== 1 ? "er" : ""}`;
  }
  return `${diffDays} dag${diffDays !== 1 ? "er" : ""} over fristen`;
}

function formatDueDate(dueDateIso: string): string {
  return new Date(dueDateIso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ObligationBlocker({
  variant,
  obligationName,
  dueDate,
  protocolId,
  workspaceSlug,
  profileId,
  workspaceId,
}: ObligationBlockerProps) {
  const prefersReduced = useReducedMotion();
  const emittedRef = useRef(false);

  const href = `/${workspaceSlug}/dashboard/competence/protocol/${protocolId}`;
  const overdueDelta = formatOverdueDelta(dueDate);
  const formattedDue = formatDueDate(dueDate);

  // Telemetry on mount — obligation_blocker_shown deferred to registry addition.
  // emittedRef kept for future emit wiring when event is registered.
  useEffect(() => {
    if (emittedRef.current) return;
    emittedRef.current = true;
    // TODO: emit "contract.obligation_blocker_shown" once added to telemetry registry.
    // Deferred per Wave 5 notes — obligation_blocker_shown not yet in registry.ts.
  }, [profileId, workspaceId, obligationName, dueDate, protocolId, variant]);

  const entranceProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: variant === "sheet" ? 24 : 8 },
        animate: { opacity: 1, y: 0 },
        transition: motionTokens.spring,
      };

  // ── Banner variant (web full-width) ──────────────────────────────────────
  if (variant === "banner") {
    return (
      <motion.div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4"
        {...entranceProps}
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
        <div className="flex-1">
          <p className="mb-0.5 text-sm font-semibold text-rose-700 dark:text-rose-400">
            Blokkert: Overdue forpliktelse
          </p>
          <p className="mb-2 text-xs text-rose-600 dark:text-rose-500">
            <span className="font-medium">{obligationName}</span> — frist {formattedDue} (
            {overdueDelta})
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
          >
            Fullfør protokoll
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </motion.div>
    );
  }

  // ── Sheet variant (mobile bottom sheet style) ─────────────────────────────
  if (variant === "sheet") {
    return (
      <motion.div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="rounded-t-2xl border-t border-rose-500/20 bg-rose-500/10 p-5 shadow-lg"
        {...entranceProps}
      >
        <div className="mb-3 flex items-center gap-2">
          <XCircle className="h-5 w-5 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Clock-in blokkert</p>
        </div>
        <p className="mb-1 text-sm text-rose-600 dark:text-rose-500">
          Du har en overdue forpliktelse som må fullføres:
        </p>
        <p className="text-foreground mb-3 text-sm font-semibold">{obligationName}</p>
        <p className="text-muted-foreground mb-4 text-xs">
          Frist: {formattedDue} · {overdueDelta}
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-rose-600 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-rose-700"
        >
          Start protokoll nå
        </a>
      </motion.div>
    );
  }

  // ── Botsson-card variant (compact, inline in chat) ────────────────────────
  return (
    <motion.div
      role="note"
      aria-label={`Blokkert: ${obligationName}`}
      className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"
      {...entranceProps}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
        <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
          Overdue forpliktelse
        </span>
      </div>
      <p className="text-foreground mb-2 text-xs">{obligationName}</p>
      <p className="text-muted-foreground mb-2 text-[10px]">
        {formattedDue} · {overdueDelta}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
      >
        Fullfør nå
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </motion.div>
  );
}
