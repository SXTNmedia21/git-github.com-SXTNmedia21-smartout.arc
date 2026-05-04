"use client";

/**
 * PasswordStrengthMeter — 5-segment visual indicator for password strength.
 *
 * Extracted from the inline implementation that lived in
 * /reset-password/page.tsx so the same heuristic + visuals can be reused by
 * /update-password (Wave C new route) and eventually the /signup password tab.
 *
 * Heuristic (matches original reset-password/page.tsx behavior):
 *   +1 length >= 8
 *   +1 length >= 12
 *   +1 has uppercase
 *   +1 has digit
 *   +1 has special char
 * Score 0-5 maps to one of three visual buckets:
 *   0-2 -> destructive (red)
 *   3   -> warning (amber)
 *   4-5 -> success (green)
 */

import { cn } from "@/lib/utils";

type Props = {
  password: string;
  /** Min length floor — currently display-only; heuristic still references 8/12. */
  minLength?: number;
};

const STRENGTH_LABELS = ["—", "Svakt", "Svakt", "Middels", "Sterk", "Sterk"] as const;

function computeStrength(password: string): number {
  if (!password) return 0;
  let s = 0;
  if (password.length >= 8) s++;
  if (password.length >= 12) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/\d/.test(password)) s++;
  if (/[^A-Za-z0-9]/.test(password)) s++;
  return s;
}

export function PasswordStrengthMeter({ password, minLength = 8 }: Props) {
  const strength = computeStrength(password);
  const label = STRENGTH_LABELS[strength];

  return (
    <div>
      <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
        <span>Styrke</span>
        <span className={strength >= 4 ? "text-success" : undefined}>{label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= strength
                ? strength >= 4
                  ? "bg-success"
                  : strength >= 3
                    ? "bg-warning"
                    : "bg-destructive"
                : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Min. {minLength} tegn · inkl. stor bokstav · inkl. tall
      </p>
    </div>
  );
}
