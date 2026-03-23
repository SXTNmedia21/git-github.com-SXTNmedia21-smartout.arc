"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

/* ── Wrapper variant: wraps children (Input + error) with autofill indicator ── */

interface AutoFillFieldProps {
  label: string;
  autoFilled?: boolean;
  children: ReactNode;
}

export function AutoFillField({ label, autoFilled = false, children }: AutoFillFieldProps) {
  const [showShimmer, setShowShimmer] = useState(false);
  const prevAutoFilled = useRef(autoFilled);

  useEffect(() => {
    if (!prevAutoFilled.current && autoFilled) {
      setShowShimmer(true);
      const timer = setTimeout(() => setShowShimmer(false), 1500);
      return () => clearTimeout(timer);
    }
    prevAutoFilled.current = autoFilled;
  }, [autoFilled]);

  return (
    <div
      className={cn(
        "space-y-2 transition-all duration-300",
        showShimmer && "animate-autofill-shimmer",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {autoFilled && (
          <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
            <Sparkles className="h-2.5 w-2.5" />
            BRREG
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Input variant: direct Input replacement with shimmer border ── */

interface AutoFillInputProps extends React.ComponentPropsWithoutRef<typeof Input> {
  autoFilled?: boolean;
}

export function AutoFillInput({ autoFilled = false, className, ...props }: AutoFillInputProps) {
  const [showShimmer, setShowShimmer] = useState(false);
  const prevAutoFilled = useRef(autoFilled);

  useEffect(() => {
    if (!prevAutoFilled.current && autoFilled) {
      setShowShimmer(true);
      const timer = setTimeout(() => setShowShimmer(false), 1200);
      return () => clearTimeout(timer);
    }
    prevAutoFilled.current = autoFilled;
  }, [autoFilled]);

  return (
    <div className="relative">
      <Input
        className={cn(
          "transition-all duration-300",
          showShimmer && "animate-autofill-shimmer",
          autoFilled && "border-orange-300 dark:border-orange-700",
          className,
        )}
        {...props}
      />
    </div>
  );
}
