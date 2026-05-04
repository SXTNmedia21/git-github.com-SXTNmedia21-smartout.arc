"use client";

/**
 * InvitationContextHeader — top-of-screen context block for /invite/[token].
 *
 * Renders workspace logo (or tinted initial fallback), workspace name in
 * Instrument Serif, the inviter attribution, a role pill, and optional start
 * date. Used on every /invite/[token] variant (new user, existing user,
 * mobile-web) so the user immediately sees WHERE they're being invited,
 * by WHOM, and to do WHAT.
 *
 * Per ADR-0167 invitation tokens are credentials. This component NEVER
 * accepts or renders the raw token — it only consumes already-resolved
 * workspace/inviter/role data that the page loader looked up via token.
 *
 * Entrance: staggered spring (120ms per child).
 */

import Image from "next/image";
import { workspaceAccentOklch } from "@smartout/design-tokens";

type Props = {
  workspaceName: string;
  workspaceSlug: string;
  /** Optional workspace logo URL. Falls back to a tinted initial badge. */
  workspaceLogoUrl?: string;
  inviterName: string;
  role: string;
  /** Caller-formatted start date ("1. juli 2026"). */
  startDate?: string;
};

export function InvitationContextHeader({
  workspaceName,
  workspaceSlug,
  workspaceLogoUrl,
  inviterName,
  role,
  startDate,
}: Props) {
  const accent = workspaceAccentOklch(workspaceSlug);
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-col gap-4">
      {/* 48px workspace badge — tinted with per-slug accent when no logo. */}
      <div
        className="animate-auth-in border-border/60 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border shadow-sm"
        style={{
          animationDelay: "0ms",
          backgroundColor: workspaceLogoUrl ? undefined : accent,
        }}
        aria-hidden={workspaceLogoUrl ? undefined : true}
      >
        {workspaceLogoUrl ? (
          <Image
            src={workspaceLogoUrl}
            alt={workspaceName}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-heading text-xl leading-none text-white">{initial}</span>
        )}
      </div>

      {/* Workspace name — Instrument Serif. */}
      <h1
        className="animate-auth-in font-heading text-foreground text-[2rem] leading-[1.08] tracking-tight"
        style={{ animationDelay: "120ms" }}
      >
        {workspaceName}
      </h1>

      {/* Inviter line */}
      <p
        className="animate-auth-in text-muted-foreground -mt-2 text-sm"
        style={{ animationDelay: "240ms" }}
      >
        <span className="text-foreground font-medium">{inviterName}</span> har invitert deg som
      </p>

      {/* Role pill + start date line */}
      <div
        className="animate-auth-in flex flex-wrap items-center gap-2 text-sm"
        style={{ animationDelay: "360ms" }}
      >
        <span
          className="border-border/60 bg-muted text-foreground inline-flex items-center rounded-full border px-3 py-1 text-[0.8125rem] font-medium"
          // Role pill gets a subtle accent dot so it visually ties to the workspace badge.
          style={{ boxShadow: `inset 0 0 0 1px ${accent}` }}
        >
          <span
            className="mr-2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {role}
        </span>
        {startDate && (
          <span className="text-muted-foreground">
            <span className="text-border mx-1">·</span>
            Start {startDate}
          </span>
        )}
      </div>
    </div>
  );
}
