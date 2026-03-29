"use client";

import { useBotsson } from "./BotssonProvider";
import type { OrbStatus } from "./types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Orb — The living circle            */
/*                                             */
/*  Uses CSS vars — works in light + dark.    */
/*  Notification: dark core, rotating halo,   */
/*  ripple rings, floating particles.         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StatusGlyph({ status }: { status: OrbStatus }) {
  switch (status) {
    case "speaking":
      return (
        <div className="flex items-center justify-center gap-[2px]" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-background/80 w-[2px] animate-[Botsson-bar_0.8s_ease-in-out_infinite] rounded-full"
              style={{
                height: 5 + Math.abs(2 - i) * 2.5,
                animationDelay: `${i * 0.07}s`,
              }}
            />
          ))}
        </div>
      );
    case "thinking":
      return (
        <div className="bg-background/50 h-2 w-2 animate-[Botsson-pulse_1.5s_ease-in-out_infinite] rounded-full" />
      );
    case "listening":
      return (
        <div className="border-background/60 bg-background/20 h-2.5 w-2.5 rounded-full border-[1.5px]" />
      );
    case "notification":
      return null;
    default:
      return <div className="bg-background/35 h-1.5 w-1.5 rounded-full" />;
  }
}

/** The notification orb — dark, glowing, alive */
function NotificationOrb() {
  const particles = [
    { angle: 30, delay: 0 },
    { angle: 110, delay: 0.4 },
    { angle: 200, delay: 0.8 },
    { angle: 280, delay: 1.2 },
    { angle: 340, delay: 0.6 },
  ];

  return (
    <>
      {/* Ripple rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={`ripple-${i}`}
          className="border-brand-orange/30 absolute inset-0 rounded-full border"
          style={{
            animation: "Botsson-notify-ripple 2.4s ease-out infinite",
            animationDelay: `${i * 0.8}s`,
          }}
          aria-hidden
        />
      ))}

      {/* Rotating halo */}
      <div
        className="absolute rounded-full"
        style={{
          inset: -3,
          background:
            "conic-gradient(from 0deg, transparent 0%, var(--brand-orange) 25%, transparent 50%, color-mix(in srgb, var(--brand-orange) 50%, transparent) 75%, transparent 100%)",
          opacity: 0.4,
          animation: "Botsson-notify-rotate 3s linear infinite",
          maskImage: "radial-gradient(circle, transparent 55%, black 60%, black 100%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 55%, black 60%, black 100%)",
        }}
        aria-hidden
      />

      {/* Dark core — uses foreground color (dark in light mode, dark in dark mode) */}
      <div
        className="absolute inset-1 rounded-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-950"
        style={{ animation: "Botsson-notify-throb 2s ease-in-out infinite" }}
      />

      {/* Surface shimmer */}
      <div
        className="pointer-events-none absolute inset-1.5 rounded-full"
        style={{
          background:
            "linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--brand-orange) 8%, transparent) 45%, rgba(255,255,255,0.04) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "Botsson-notify-shimmer 3s ease-in-out infinite",
        }}
        aria-hidden
      />

      {/* Bell icon */}
      <div className="relative z-10 flex items-center justify-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-brand-orange"
          style={{ filter: "drop-shadow(0 0 6px var(--brand-orange))" }}
        >
          <path
            d="M8 1C6 1 4.5 2.5 4.5 4.5V7.5L3 9.5V10.5H13V9.5L11.5 7.5V4.5C11.5 2.5 10 1 8 1Z"
            fill="currentColor"
            fillOpacity="0.9"
          />
          <path
            d="M6.5 11C6.5 12.1 7.2 13 8 13C8.8 13 9.5 12.1 9.5 11"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const offsetX = Math.cos(rad) * 14;
        const offsetY = Math.sin(rad) * 14;
        return (
          <div
            key={`particle-${i}`}
            className="bg-brand-orange absolute rounded-full"
            style={{
              width: 3,
              height: 3,
              left: `calc(50% + ${offsetX}px)`,
              top: `calc(50% + ${offsetY}px)`,
              animation: "Botsson-particle-float 2s ease-out infinite",
              animationDelay: `${p.delay}s`,
            }}
            aria-hidden
          />
        );
      })}
    </>
  );
}

export function BotssonOrb() {
  const { state } = useBotsson();
  const isNotification = state.orbStatus === "notification";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {isNotification ? (
        <NotificationOrb />
      ) : (
        <>
          <div
            className="border-background/20 absolute inset-0.5 animate-[Botsson-breathe_3s_ease-in-out_infinite] rounded-full border"
            aria-hidden
          />
          <StatusGlyph status={state.orbStatus} />
        </>
      )}
    </div>
  );
}
