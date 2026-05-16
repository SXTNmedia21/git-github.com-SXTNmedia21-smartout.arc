"use client";

/**
 * DomainChatOwnership — ADR-0238
 *
 * Declares that the parent route owns the domain chat surface, suppressing
 * BotssonShell Orb to passive mode while mounted. Cleans up on unmount.
 *
 * WHY: The dashboard hosts both a domain-specific chat surface (e.g. komm/chat)
 * and the Botsson Orb. Without explicit ownership declaration, both surfaces
 * appear interactive simultaneously — the user has no clear affordance for
 * which input field their message goes to. ADR-0238 mandates that any route
 * embedding a domain chat surface must declare ownership to suppress the Orb.
 *
 * Usage:
 *   // In a page or layout that hosts its own chat input:
 *   <DomainChatOwnership reason="komm/chat messaging surface" />
 *
 * The Orb renders at 0.7 scale + 0.5 opacity with no interaction while mounted.
 * Multiple concurrent declarations are supported (counter per reason string).
 */

import { useEffect } from "react";
import { useBotsson } from "./BotssonProvider";

/* ━━━ Hook: imperative control ━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Lower-level hook for components that need imperative control over domain chat
 * ownership. Declares ownership on mount, revokes on unmount.
 *
 * The reason string is used for debugging and tooltip text in passive Orb mode.
 */
export function useDeclareDomainChatOwnership(reason: string): void {
  const { declareDomainChatOwnership } = useBotsson();

  useEffect(() => {
    const revoke = declareDomainChatOwnership(reason);
    return revoke;
    // reason intentionally included: if a caller changes reason, the old
    // declaration is cleanly revoked and a new one is registered. String
    // literal callsites won't re-fire (stable reference).
  }, [declareDomainChatOwnership, reason]);
}

/* ━━━ Hook: read-only consumer ━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Read-only hook for BotssonShell (and any other consumer) to check whether
 * a domain chat surface currently owns the UI.
 */
export function useDomainChatOwnership(): { isOwned: boolean; reason: string | null } {
  const { isDomainChatOwned, domainChatOwners } = useBotsson();
  // Return the first reason if multiple owners — used for tooltip/debugging only.
  const reason = isDomainChatOwned ? (Array.from(domainChatOwners)[0] ?? null) : null;
  return { isOwned: isDomainChatOwned, reason };
}

/* ━━━ Component: declarative API ━━━━━━━━━━━━━━━━━━━ */

type Props = {
  /**
   * Human-readable description of why this surface owns chat.
   * Shown in the passive Orb tooltip for debugging.
   * Example: "komm/chat messaging surface"
   */
  reason: string;
};

/**
 * Declares that the parent route owns the domain chat surface.
 * Renders nothing — pure side-effect component.
 *
 * Mount this once per route/layout that hosts its own chat input.
 * The Botsson Orb will enter passive mode (0.7 scale, 0.5 opacity,
 * no click interaction) for as long as this component is mounted.
 */
export function DomainChatOwnership({ reason }: Props): null {
  useDeclareDomainChatOwnership(reason);
  return null;
}
