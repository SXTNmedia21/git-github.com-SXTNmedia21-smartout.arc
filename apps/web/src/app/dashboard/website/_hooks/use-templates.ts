"use client";

import { useMemo } from "react";
import { getAllTemplates } from "@smartout/website";
import type { WebsiteTemplate } from "@smartout/website";

export type { WebsiteTemplate };

/**
 * Returns all registered website templates from @smartout/website.
 * This is a pure in-memory read — no DB call, no loading state.
 * Templates are registered at package import time via the registry module.
 */
export function useTemplates() {
  // getAllTemplates() is synchronous and side-effect-free, but we memoize to
  // avoid rebuilding the array on every render.
  const templates = useMemo(() => getAllTemplates(), []);

  return { templates };
}
