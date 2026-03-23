"use client";

import { useEffect, useRef, useCallback } from "react";

type AutosaveConfig = {
  /** Called when the timer fires and content is dirty. Should be a stable reference (useCallback). */
  onSave: (content: Record<string, unknown>) => Promise<void>;
  /** How often to check for dirty content and save. Defaults to 60 seconds. */
  intervalMs?: number;
};

/**
 * Interval-based autosave hook.
 * Tracks dirty state via a ref (not state) to avoid triggering re-renders on every keystroke.
 * The save interval only fires when content has actually changed since the last save.
 *
 * Usage:
 *   const { markDirty, markClean } = useAutosave({ onSave: handleSave });
 *   // Call markDirty(latestContent) in form onChange handlers
 *   // Call markClean() after a successful manual save
 */
export function useAutosave(config: AutosaveConfig) {
  const { onSave, intervalMs = 60_000 } = config;

  // Refs avoid stale closures without adding render overhead
  const isDirtyRef = useRef(false);
  const contentRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const markDirty = useCallback((content: Record<string, unknown>) => {
    isDirtyRef.current = true;
    contentRef.current = content;
  }, []);

  const markClean = useCallback(() => {
    isDirtyRef.current = false;
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(async () => {
      if (isDirtyRef.current) {
        await onSave(contentRef.current);
        isDirtyRef.current = false;
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onSave, intervalMs]);

  return { markDirty, markClean, isDirty: isDirtyRef };
}
