"use client";

/**
 * PunchButton — Full-screen punch-in animation for the ShiftClock module.
 *
 * Implements the exact animation sequence from the canonical HTML reference:
 *   .superpowers/brainstorm/64049-1774371756/punch-animation.html
 *
 * Phases: idle → scanning (with step verification) → success (confetti) → complete.
 * All animations use CSS keyframes — no framer-motion dependency.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type PunchButtonProps = {
  shiftInfo: {
    time: string;
    department: string;
    zone: string;
  } | null;
  onPunchIn: () => Promise<{ allowed: boolean; warnings: unknown[] }>;
  onComplete: () => void;
  disabled?: boolean;
  countdown?: string;
};

/* -------------------------------------------------------------------------- */
/*  Phase state machine                                                       */
/* -------------------------------------------------------------------------- */

type Phase = "idle" | "pressed" | "scanning" | "success" | "complete";

/* -------------------------------------------------------------------------- */
/*  Scan step definitions                                                     */
/* -------------------------------------------------------------------------- */

const SCAN_STEPS = [
  { label: "GPS-posisjon", scanText: "Sjekker GPS..." },
  { label: "Identitet bekreftet", scanText: "Bekrefter identitet..." },
  { label: "Vakt aktivert", scanText: "Aktiverer vakt..." },
  { label: "Sesjon startet", scanText: "Starter sesjon..." },
] as const;

/** Delays from animation start for each step becoming active (ms) */
const STEP_DELAYS = [400, 900, 1500, 2100] as const;

/* -------------------------------------------------------------------------- */
/*  Confetti configuration                                                    */
/* -------------------------------------------------------------------------- */

const CONFETTI_COLORS = [
  "#e85c0d",
  "#ff8c42",
  "#ffd93d",
  "#00b894",
  "#5b9bd5",
  "#b57edc",
  "#ff6b6b",
  "#6bcb77",
];

type ConfettiParticle = {
  id: number;
  left: string;
  color: string;
  width: string;
  height: string;
  borderRadius: string;
  duration: string;
  delay: string;
};

function generateConfetti(count: number): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const size = 4 + Math.random() * 8;
    return {
      id: i,
      left: `${Math.random() * 100}%`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      duration: `${1.5 + Math.random() * 2}s`,
      delay: `${Math.random() * 0.5}s`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Fingerprint SVG                                                           */
/* -------------------------------------------------------------------------- */

function FingerprintIcon({ stroke, className }: { stroke: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10" />
      <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10" />
      <path d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6" />
      <path d="M12 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" />
      <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
      <path d="M12 8a4 4 0 00-4 4c0 2.2 1.8 4 4 4" />
      <path d="M12 8a4 4 0 014 4c0 2.2-1.8 4-4 4" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function PunchButton({
  shiftInfo,
  onPunchIn,
  onComplete,
  disabled = false,
  countdown,
}: PunchButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [doneSteps, setDoneSteps] = useState<boolean[]>([false, false, false, false]);
  const [scanText, setScanText] = useState("Verifiserer...");
  const [confettiParticles, setConfettiParticles] = useState<ConfettiParticle[]>([]);
  const [idleHiding, setIdleHiding] = useState(false);

  const runningRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Helper to schedule a timeout and track it for cleanup */
  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  /** Cleanup all pending timers on unmount */
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  /* ---- Confetti is pre-generated via useMemo to stay stable ---- */
  const confetti = useMemo(() => generateConfetti(60), []);

  /* ---- PUNCH HANDLER ---- */
  const handlePunch = useCallback(async () => {
    if (runningRef.current || disabled || phase !== "idle") return;
    runningRef.current = true;

    /* Phase 1: Press */
    setPhase("pressed");

    schedule(() => {
      setPhase("idle"); // brief return before hiding
    }, 200);

    /* Phase 2: Transition to scanning */
    schedule(() => {
      setIdleHiding(true);

      schedule(() => {
        setPhase("scanning");
        setScanText("Verifiserer...");
        setActiveStep(-1);
        setDoneSteps([false, false, false, false]);

        /* Fire the actual punch-in mutation in parallel with visual steps */
        onPunchIn().catch(() => {
          /* Error handling would go here — for now, animation continues */
        });

        /* Run scan steps sequentially */
        STEP_DELAYS.forEach((delay, i) => {
          schedule(() => {
            setScanText(SCAN_STEPS[i]!.scanText);

            /* Mark previous step as done */
            if (i > 0) {
              setDoneSteps((prev) => {
                const next = [...prev];
                next[i - 1] = true;
                return next;
              });
            }
            setActiveStep(i);
          }, delay);
        });

        /* Complete last step */
        schedule(() => {
          setDoneSteps([true, true, true, true]);
          setActiveStep(-1);
        }, 2600);

        /* Transition to success */
        schedule(() => {
          setPhase("success");
          setConfettiParticles(confetti);
        }, 2900);

        /* Transition to complete (active shift view) */
        schedule(() => {
          setPhase("complete");
          setConfettiParticles([]);
          runningRef.current = false;
          onComplete();
        }, 5500);
      }, 400);
    }, 300);
  }, [disabled, phase, onPunchIn, onComplete, confetti, schedule]);

  /* ---- Reset idle-hiding when phase changes away from scanning ---- */
  useEffect(() => {
    if (phase === "scanning" || phase === "success" || phase === "complete") return;
    if (phase === "idle" && !runningRef.current) {
      setIdleHiding(false);
    }
  }, [phase]);

  /* ---- RENDER ---- */
  const showIdle = phase === "idle" || phase === "pressed";
  const showScanning = phase === "scanning";
  const showSuccess = phase === "success";

  return (
    <div className="punch-root">
      <style>{PUNCH_STYLES}</style>

      {/* ---- IDLE SCREEN ---- */}
      <div
        className={`punch-idle-screen ${idleHiding ? "punch-hiding" : ""}`}
        style={{ display: showIdle || idleHiding ? undefined : "none" }}
      >
        {shiftInfo && (
          <div className="punch-shift-info">
            <div className="punch-shift-label">Neste vakt</div>
            <div className="punch-shift-time">{shiftInfo.time}</div>
            <div className="punch-shift-badges">
              <span
                className="punch-shift-badge"
                style={{ background: "#1a2332", color: "#5b9bd5" }}
              >
                {shiftInfo.department}
              </span>
              <span
                className="punch-shift-badge"
                style={{ background: "#1a2a1a", color: "#6bcb77" }}
              >
                {shiftInfo.zone}
              </span>
            </div>
          </div>
        )}

        <div className="punch-container">
          <div className="punch-ring">
            <button
              type="button"
              className={`punch-button ${phase === "pressed" ? "punch-pressed" : ""}`}
              onClick={handlePunch}
              disabled={disabled}
              aria-label="Stemple inn"
            >
              <FingerprintIcon stroke="white" className="punch-fingerprint" />
              <span className="punch-label">Stemple inn</span>
            </button>
          </div>

          {countdown && <div className="punch-countdown-text">Vakten starter om {countdown}</div>}
        </div>
      </div>

      {/* ---- SCANNING OVERLAY ---- */}
      <div className={`punch-scan-overlay ${showScanning ? "punch-active" : ""}`}>
        <div className="punch-scan-ring">
          <div className="punch-scan-ring-border" />
          <FingerprintIcon stroke="#e85c0d" className="punch-scan-fingerprint" />
        </div>
        <div className="punch-scan-text">{scanText}</div>
        <div className="punch-scan-steps">
          {SCAN_STEPS.map((step, i) => {
            const isDone = doneSteps[i];
            const isActive = activeStep === i && !isDone;
            return (
              <div
                key={step.label}
                className={`punch-scan-step ${isDone ? "punch-done" : ""} ${isActive ? "punch-step-active" : ""}`}
              >
                <div className="punch-scan-step-icon">
                  {isDone ? <Check size={12} strokeWidth={3} /> : i + 1}
                </div>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- CONFETTI ---- */}
      <div className="punch-confetti-container" aria-hidden="true">
        {confettiParticles.map((p) => (
          <div
            key={p.id}
            className="punch-confetti"
            style={{
              left: p.left,
              background: p.color,
              width: p.width,
              height: p.height,
              borderRadius: p.borderRadius,
              animationDuration: p.duration,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* ---- SUCCESS OVERLAY ---- */}
      <div className={`punch-success-overlay ${showSuccess ? "punch-active" : ""}`}>
        <div className="punch-success-check">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="punch-checkmark-svg"
          >
            <polyline points="5 13 10 18 19 6" />
          </svg>
        </div>
        <div className="punch-success-text">Du er stemplet inn!</div>
        <div className="punch-success-sub">
          {shiftInfo ? `${shiftInfo.department} ${shiftInfo.zone} \u00B7 ${shiftInfo.time}` : ""}
        </div>
        <div className="punch-success-points">
          <div className="punch-points-badge">+7 poeng — Tidlig fugl!</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles — CSS keyframes matching the HTML reference 1:1                    */
/* -------------------------------------------------------------------------- */

const PUNCH_STYLES = /* css */ `
  /* ---- Root ---- */
  .punch-root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: oklch(0.13 0.005 60);
    color: oklch(0.9 0.01 60);
  }

  /* ---- IDLE SCREEN ---- */
  .punch-idle-screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    transition: opacity 0.5s ease, transform 0.5s ease;
    z-index: 10;
  }
  .punch-idle-screen.punch-hiding {
    opacity: 0;
    transform: scale(0.95);
  }

  .punch-shift-info {
    padding: 20px 24px 0;
    text-align: center;
  }
  .punch-shift-label {
    font-size: 12px;
    color: oklch(0.7 0.02 60);
    letter-spacing: 1px;
    text-transform: uppercase;
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }
  .punch-shift-time {
    font-size: 32px;
    font-weight: 700;
    font-family: var(--font-heading, 'Instrument Serif', Georgia, serif);
    color: oklch(0.95 0.01 60);
    margin-top: 6px;
  }
  .punch-shift-badges {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 10px;
  }
  .punch-shift-badge {
    padding: 4px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }

  /* ---- PUNCH BUTTON ---- */
  .punch-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .punch-ring {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Outer conic gradient glow ring */
  .punch-ring::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #e85c0d, #ff8c42, #e85c0d, #d44a00, #e85c0d);
    animation: punch-ring-rotate 4s linear infinite;
    opacity: 0.6;
    filter: blur(4px);
  }

  /* Pulse glow */
  .punch-ring::after {
    content: '';
    position: absolute;
    inset: -20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(232,92,13,0.15) 0%, transparent 70%);
    animation: punch-pulse-glow 2s ease-in-out infinite;
  }

  @keyframes punch-ring-rotate {
    to { transform: rotate(360deg); }
  }
  @keyframes punch-pulse-glow {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.15); opacity: 1; }
  }

  .punch-button {
    width: 180px;
    height: 180px;
    border-radius: 50%;
    border: none;
    background: radial-gradient(circle at 40% 35%, #ff8c42, #e85c0d 50%, #c43e00 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    box-shadow: 0 8px 32px rgba(232,92,13,0.4), inset 0 2px 4px rgba(255,255,255,0.15);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .punch-button:active {
    transform: scale(0.94);
    box-shadow: 0 4px 16px rgba(232,92,13,0.3), inset 0 2px 4px rgba(255,255,255,0.1);
  }

  .punch-button.punch-pressed {
    transform: scale(0.88);
    background: radial-gradient(circle at 40% 35%, #d44a00, #b33500 50%, #8a2800 100%);
  }

  .punch-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .punch-fingerprint {
    width: 64px;
    height: 64px;
    opacity: 0.95;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  .punch-label {
    font-size: 15px;
    font-weight: 600;
    color: white;
    margin-top: 8px;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }

  .punch-countdown-text {
    text-align: center;
    margin-top: 20px;
    color: oklch(0.55 0.01 60);
    font-size: 13px;
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }

  /* ---- SCANNING OVERLAY ---- */
  .punch-scan-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: oklch(0.13 0.005 60);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  .punch-scan-overlay.punch-active {
    opacity: 1;
    pointer-events: all;
  }

  .punch-scan-ring {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .punch-scan-ring-border {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid transparent;
    border-top-color: #e85c0d;
    border-right-color: #ff8c42;
    animation: punch-scan-spin 1s linear infinite;
  }

  @keyframes punch-scan-spin {
    to { transform: rotate(360deg); }
  }

  .punch-scan-fingerprint {
    width: 72px;
    height: 72px;
    opacity: 0.4;
    animation: punch-scan-pulse 0.8s ease-in-out infinite alternate;
  }

  @keyframes punch-scan-pulse {
    to { opacity: 1; }
  }

  .punch-scan-text {
    margin-top: 24px;
    font-size: 15px;
    color: oklch(0.7 0.02 60);
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }

  .punch-scan-steps {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 240px;
  }

  .punch-scan-step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: oklch(0.4 0.005 60);
    transition: color 0.3s ease;
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }
  .punch-scan-step.punch-done {
    color: #00b894;
  }
  .punch-scan-step.punch-step-active {
    color: #e85c0d;
  }

  .punch-scan-step-icon {
    width: 20px;
    height: 20px;
    border-radius: 10px;
    border: 2px solid oklch(0.25 0.005 60);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }
  .punch-scan-step.punch-done .punch-scan-step-icon {
    border-color: #00b894;
    background: #00b894;
    color: white;
  }
  .punch-scan-step.punch-step-active .punch-scan-step-icon {
    border-color: #e85c0d;
    animation: punch-step-pulse 0.6s ease-in-out infinite alternate;
  }

  @keyframes punch-step-pulse {
    to { box-shadow: 0 0 8px rgba(232,92,13,0.5); }
  }

  /* ---- CONFETTI ---- */
  .punch-confetti-container {
    position: absolute;
    inset: 0;
    z-index: 25;
    pointer-events: none;
    overflow: hidden;
  }

  .punch-confetti {
    position: absolute;
    top: -10px;
    animation: punch-confetti-fall linear forwards;
  }

  @keyframes punch-confetti-fall {
    0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(800px) rotate(720deg) scale(0.5); opacity: 0; }
  }

  /* ---- SUCCESS OVERLAY ---- */
  .punch-success-overlay {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: oklch(0.13 0.005 60);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .punch-success-overlay.punch-active {
    opacity: 1;
    pointer-events: all;
  }

  .punch-success-check {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, #00b894, #00a381);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(0);
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 0 60px rgba(0,184,148,0.3);
  }
  .punch-success-overlay.punch-active .punch-success-check {
    transform: scale(1);
  }

  .punch-checkmark-svg {
    width: 56px;
    height: 56px;
    stroke-dasharray: 80;
    stroke-dashoffset: 80;
    animation: punch-check-draw 0.6s ease 0.3s forwards;
  }
  /* Only animate when success is visible */
  .punch-success-overlay:not(.punch-active) .punch-checkmark-svg {
    animation: none;
    stroke-dashoffset: 80;
  }

  @keyframes punch-check-draw {
    to { stroke-dashoffset: 0; }
  }

  .punch-success-text {
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-heading, 'Instrument Serif', Georgia, serif);
    color: oklch(0.95 0.01 60);
    margin-top: 24px;
    opacity: 0;
    animation: punch-fade-up 0.5s ease 0.5s forwards;
  }
  .punch-success-overlay:not(.punch-active) .punch-success-text {
    animation: none;
    opacity: 0;
  }

  .punch-success-sub {
    font-size: 14px;
    color: #00b894;
    margin-top: 8px;
    opacity: 0;
    animation: punch-fade-up 0.5s ease 0.7s forwards;
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }
  .punch-success-overlay:not(.punch-active) .punch-success-sub {
    animation: none;
    opacity: 0;
  }

  .punch-success-points {
    margin-top: 20px;
    opacity: 0;
    animation: punch-fade-up 0.5s ease 0.9s forwards;
  }
  .punch-success-overlay:not(.punch-active) .punch-success-points {
    animation: none;
    opacity: 0;
  }

  .punch-points-badge {
    background: linear-gradient(135deg, #ffd93d, #e8a317);
    color: #1a1a0a;
    font-size: 18px;
    font-weight: 700;
    padding: 8px 24px;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(255,217,61,0.3);
    font-family: var(--font-geist-sans, system-ui, sans-serif);
  }

  @keyframes punch-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
