"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma Overlay                              */
/*                                            */
/*  Floating Botsson Orb / Shell mount only.  */
/*  Provider scope is owned by BotssonHost    */
/*  (server-safe, SSR-preserving sibling).    */
/*                                            */
/*  Loaded via dynamic({ ssr: false }) from   */
/*  DashboardShell so the Orb chunk stays     */
/*  client-only without affecting children    */
/*  SSR.                                       */
/*                                            */
/*  ADR-0238, ADR-0337, ADR-0362.             */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import "./Botsson.css";
import { BotssonShell } from "./BotssonShell";

export function EmmaOverlay() {
  return <BotssonShell />;
}
