"use client";

import Image from "next/image";

type Props = {
  /** Main brand headline — rendered in Instrument Serif. */
  headline?: React.ReactNode;
  /** Subtitle line below the headline. */
  subtitle?: string;
  /** Fine-print bottom label (e.g. "NORDIC SPLIT · v2026.04"). */
  footer?: string;
};

/**
 * Static Nordic Split brand panel used on signup/reset/welcome.
 * Login has its own animated version inline because the panel swaps/darkens
 * during login choreography and is coupled to that page's state.
 *
 * 44% width (lg+), warm OKLCH dark surface, radial-gradient ambient orbs.
 */
export function AuthBrandPanel({
  headline,
  subtitle = "Alt du trenger for opplæring, drift og utvikling — samlet i ett system.",
  footer = "NORDIC SPLIT · v2026.04",
}: Props) {
  return (
    <div
      className="relative hidden flex-[0_0_44%] overflow-hidden lg:flex"
      style={{ background: "oklch(0.18 0.03 50)" }}
    >
      {/* Ambient orbs — radial gradients, not blur blobs (per Nordic Split skill). */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 35%, oklch(0.72 0.16 45 / 0.35), transparent 55%)," +
            "radial-gradient(circle at 72% 72%, oklch(0.65 0.22 40 / 0.22), transparent 60%)," +
            "radial-gradient(circle at 20% 90%, oklch(0.55 0.18 300 / 0.10), transparent 55%)",
        }}
      />
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

        <div className="max-w-[380px]">
          <h2
            className="animate-auth-in font-heading text-[2.75rem] leading-[1.02] tracking-tight text-white"
            style={{ animationDelay: "200ms" }}
          >
            {headline ?? (
              <>
                Teamet ditt,
                <br />
                <span style={{ color: "oklch(0.78 0.16 45)" }}>klar</span> fra dag en.
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

        <p className="text-[0.7rem] tracking-[0.08em] text-white/30 uppercase">{footer}</p>
      </div>
    </div>
  );
}
