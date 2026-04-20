"use client";

/**
 * TaskRunner — Generic task display primitive.
 *
 * Renders a card with icon, title, description, a children slot for
 * task-specific content, and CTA / defer action buttons.
 * Used across contract composition, onboarding wizards, and similar flows.
 */

import * as React from "react";
import { Button } from "../components/button";
import type { TaskRunnerProps } from "./types";

export function TaskRunner({
  title,
  description,
  ctaLabel,
  onCtaClick,
  showDefer = false,
  onDefer,
  icon: Icon,
  children,
  isLoading = false,
  isDisabled = false,
}: TaskRunnerProps) {
  return (
    <div className="bg-card mx-auto max-w-lg rounded-xl border p-6 shadow-sm">
      {/* Header: icon + title + description */}
      <div className="mb-4 flex items-start gap-4">
        {Icon && (
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-primary h-5 w-5" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-heading text-lg font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>

      {/* Task-specific content slot */}
      <div className="mb-6">{children}</div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button className="flex-1" onClick={onCtaClick} disabled={isDisabled || isLoading}>
          {isLoading ? "Laster..." : ctaLabel}
        </Button>

        {showDefer && onDefer && (
          <Button variant="ghost" onClick={onDefer} disabled={isLoading}>
            Ikke nå
          </Button>
        )}
      </div>
    </div>
  );
}
