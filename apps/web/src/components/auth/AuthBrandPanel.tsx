"use client";

import Image from "next/image";
import { workspaceAccentOklch } from "@smartout/design-tokens";

type Variant = "default" | "workspace-invite" | "minimal";

type Props = {
  /** Panel variant — controls layout + which content slots render. */
  variant?: Variant;
  /** Main brand headline — rendered in Instrument Serif. */
  headline?: React.ReactNode;
  /** Subtitle line below the headline. */
  subtitle?: string;
  /** Fine-print bottom label (e.g. "NORDIC SPLIT · v2026.04"). */
  footer?: string;
  /** workspace-invite: name of the target workspace. */
  workspaceName?: string;
  /** workspace-invite: slug — drives ambient orb tint via workspaceAccentOklch. */
  workspaceSlug?: string;
  /** workspace-invite: who sent the invitation. */
  inviterName?: string;
  /** workspace-invite: the invited role (Servitør, Kokk, Admin, ...). */
  role?: string;
  /** workspace-invite: formatted start date ("1. juli 2026"). */
  startDate?: string;
};

/**
 * Nordic Split brand panel used across portal auth screens.
 *
 * Variants:
 *   - "default"          signup/reset/welcome marketing (headline + subtitle + footer)
 *   - "workspace-invite" /invite/[token]: shows inviter + workspace + role,
 *                        ambient orb tinted with workspaceAccentOklch(slug)
 *   - "minimal"          /update-password + /select-workspace: logo + version only
 *
 * Login has its own animated version inline because the panel swaps/darkens
 * during login choreography and is coupled to that page's state.
 *
 * 44% width (lg+), warm OKLCH dark surface, radial-gradient ambient orbs.
 */
export function AuthBrandPanel({
  variant = "default",
  headline,
  subtitle = "Alt du trenger for opplæring, drift og utvikling — samlet i ett system.",
  footer = "NORDIC SPLIT · v2026.04",
  workspaceName,
  workspaceSlug,
  inviterName,
  role,
  startDate,
}: Props) {
  // For the invite variant, the second orb gets tinted with the workspace
  // accent — gives each workspace a subtly distinct visual signature.
  const inviteAccent =
    variant === "workspace-invite" && workspaceSlug ? workspaceAccentOklch(workspaceSlug) : null;

  // ADR-0366: CSS var references used; dynamic inviteAccent path retains computed value
  const orbs =
    inviteAccent !== null
      ? "radial-gradient(circle at 30% 35%, color-mix(in oklch, var(--brand-orange-warm) 35%, transparent), transparent 55%)," +
        `radial-gradient(circle at 72% 72%, ${inviteAccent.replace(")", " / 0.28)")}, transparent 60%),` +
        "radial-gradient(circle at 20% 90%, color-mix(in oklch, var(--brand-purple) 10%, transparent), transparent 55%)"
      : "radial-gradient(circle at 30% 35%, color-mix(in oklch, var(--brand-orange-warm) 35%, transparent), transparent 55%)," +
        "radial-gradient(circle at 72% 72%, color-mix(in oklch, var(--brand-orange) 22%, transparent), transparent 60%)," +
        "radial-gradient(circle at 20% 90%, color-mix(in oklch, var(--brand-purple) 10%, transparent), transparent 55%)";

  return (
    <div
      className="relative hidden flex-[0_0_44%] overflow-hidden lg:flex"
      style={{ background: "var(--panel)" }}
    >
      {/* Ambient orbs — radial gradients, not blur blobs (per Nordic Split skill). */}
      <div className="pointer-events-none absolute inset-0" style={{ background: orbs }} />
      {/* Faint noise overlay */}
      <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-12">
        <div className="animate-auth-in" style={{ animationDelay: "0ms" }}>
          <Image
            src="/smartout-logo.png"
            alt="Smartout"
            width={110}
            height={38}
            className="opacity-80 brightness-0 invert"
            priority
          />
        </div>

        {variant === "minimal" ? (
          // Minimal variant: no headline body — just the logo (above)
          // and footer. Used by /update-password + /select-workspace where
          // the focus should stay on the form.
          <div aria-hidden />
        ) : variant === "workspace-invite" ? (
          <div className="max-w-[380px]">
            {inviterName && (
              <p
                className="animate-auth-in text-[0.8125rem] tracking-[0.04em] text-white/45 uppercase"
                style={{ animationDelay: "120ms" }}
              >
                {inviterName} inviterer deg til
              </p>
            )}
            <h2
              className="animate-auth-in font-heading mt-3 text-[2.5rem] leading-[1.04] tracking-tight text-white"
              style={{ animationDelay: "240ms" }}
            >
              {workspaceName ?? "din nye arbeidsplass"}
            </h2>
            {role && (
              <p
                className="animate-auth-in mt-5 text-[0.95rem] leading-relaxed text-white/60"
                style={{ animationDelay: "360ms" }}
              >
                Rolle: <span className="text-white/80">{role}</span>
                {startDate && (
                  <>
                    <span className="mx-2 text-white/30">·</span>
                    <span className="text-white/80">Start {startDate}</span>
                  </>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-[380px]">
            <h2
              className="animate-auth-in font-heading text-[2.75rem] leading-[1.02] tracking-tight text-white"
              style={{ animationDelay: "200ms" }}
            >
              {headline ?? (
                <>
                  Teamet ditt,
                  <br />
                  <span style={{ color: "var(--brand-orange-warm)" }}>klar</span> fra dag en.
                </>
              )}
            </h2>
            <p
              className="animate-auth-in mt-5 text-[0.95rem] leading-relaxed text-white/55"
              style={{ animationDelay: "320ms" }}
            >
              {subtitle}
            </p>
          </div>
        )}

        <p className="text-[0.7rem] tracking-[0.08em] text-white/30 uppercase">{footer}</p>
      </div>
    </div>
  );
}
