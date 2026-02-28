"use client";

import * as React from "react";
import { cn } from "../lib/utils";

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type PremiumButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  rippleClassName?: string;
};

const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ className, children, onPointerDown, disabled, rippleClassName, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);
    const rippleId = React.useRef(0);

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (disabled) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      const id = rippleId.current++;

      setRipples((current) => [...current, { id, x, y, size }]);
      window.setTimeout(() => {
        setRipples((current) => current.filter((ripple) => ripple.id !== id));
      }, 680);
    };

    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        className={cn(
          "group relative isolate inline-flex items-center justify-center overflow-hidden rounded-lg px-4 py-2",
          "text-sm font-semibold transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
          "focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          "hover:-translate-y-px hover:scale-105 hover:shadow-[0_14px_30px_rgba(249,115,22,0.28)]",
          "active:translate-y-px active:scale-[0.97] active:shadow-[inset_0_3px_10px_rgba(0,0,0,0.35)]",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.18) inset, 0 0 20px rgba(249,115,22,0.25)",
          }}
        />

        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            aria-hidden
            className={cn(
              "premium-ripple pointer-events-none absolute rounded-full opacity-0",
              rippleClassName,
            )}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
            }}
          />
        ))}

        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>

        <style>{`
          @keyframes premium-button-ripple {
            0% {
              transform: scale(0.2);
              opacity: 0.55;
            }
            70% {
              opacity: 0.24;
            }
            100% {
              transform: scale(1);
              opacity: 0;
            }
          }

          .premium-ripple {
            animation: premium-button-ripple 680ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      </button>
    );
  },
);

PremiumButton.displayName = "PremiumButton";

export { PremiumButton };
export type { PremiumButtonProps };
