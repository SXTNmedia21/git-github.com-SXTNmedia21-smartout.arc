"use client";

import type { ReactNode } from "react";
import { SectionReveal, RevealItem } from "./SectionReveal";

interface HeroCardAction {
  label: string;
  onClick: () => void;
}

interface HeroCardProps {
  title: string;
  subtitle?: string;
  primaryAction: HeroCardAction;
  secondaryAction?: HeroCardAction;
  children?: ReactNode;
}

export function HeroCard({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  children,
}: HeroCardProps) {
  return (
    <SectionReveal>
      <div className="border-border/60 bg-background/70 rounded-2xl border p-10 shadow-2xl backdrop-blur-xl sm:p-14">
        <div className="flex flex-col items-center gap-8">
          <RevealItem>
            <h1 className="font-heading text-center text-[1.85rem] leading-[1.15] tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
          </RevealItem>

          {subtitle && (
            <RevealItem>
              <p className="text-center text-lg leading-relaxed text-white/50">{subtitle}</p>
            </RevealItem>
          )}

          {children && <RevealItem>{children}</RevealItem>}

          <RevealItem>
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="flex flex-1 items-center justify-center rounded-xl bg-[oklch(0.75_0.18_55)] px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-[oklch(0.72_0.18_55)] hover:shadow-xl active:scale-[0.98]"
              >
                {primaryAction.label}
              </button>

              {secondaryAction && (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="flex flex-1 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-8 py-4 text-lg font-semibold text-white/70 transition-all hover:border-white/[0.12] hover:bg-white/[0.07] active:scale-[0.98]"
                >
                  {secondaryAction.label}
                </button>
              )}
            </div>
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}
