"use client";

/**
 * WorkspaceCard — entry card in the /select-workspace grid.
 *
 * Shows a workspace the signed-in user is a member of, with:
 *   - 44px initial badge tinted via workspaceAccentOklch(slug)
 *   - workspace name (semibold)
 *   - user's role in that workspace
 *   - last-active timestamp + optional quick-status
 *   - optional "active" highlight for the most-recently-used workspace
 *
 * Nordic Split tokens only (bg-background, border-border, etc.).
 * Active state adds a brand-orange border + subtle warm shadow glow.
 */

import { workspaceAccentOklch } from "@smartout/design-tokens";
import { cn } from "@/lib/utils";

type Props = {
  workspaceName: string;
  workspaceSlug: string;
  /** Role label in Norwegian ("Servitør", "Admin", "Daglig leder", ...). */
  userRole: string;
  /** Human-formatted last-active ("2 min siden", "I dag", "3 dager siden"). */
  lastActive?: string;
  /** Short status line ("2 aktive vakter", "12 ansatte"). Caller formats. */
  quickStatus?: string;
  /** Recently-used — adds brand-orange accent. */
  active?: boolean;
  onClick?: () => void;
};

export function WorkspaceCard({
  workspaceName,
  workspaceSlug,
  userRole,
  lastActive,
  quickStatus,
  active,
  onClick,
}: Props) {
  const accent = workspaceAccentOklch(workspaceSlug);
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group bg-background border-border text-left",
        "flex w-full flex-col gap-3 rounded-2xl border p-5 shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-200",
        "hover:-translate-y-[1px] hover:shadow-md",
        "focus-visible:ring-brand-orange/40 focus-visible:ring-2 focus-visible:outline-none",
        active && "border-brand-orange shadow-[var(--shadow-cta-sm)]",
      )}
      aria-label={`Velg ${workspaceName}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          <span className="font-heading text-lg leading-none text-white">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-[1.0625rem] leading-tight font-semibold">
            {workspaceName}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[0.8125rem]">{userRole}</p>
        </div>
      </div>

      {(lastActive || quickStatus) && (
        <div className="border-border/70 flex items-center justify-between border-t pt-3 text-xs">
          {lastActive ? (
            <span className="text-muted-foreground">{lastActive}</span>
          ) : (
            <span aria-hidden />
          )}
          {quickStatus && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
              {quickStatus}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
