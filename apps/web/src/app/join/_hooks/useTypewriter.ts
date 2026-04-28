"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Typewriter effect — types out a string character by character.
 *
 * @param target - The final string to type out
 * @param active - Whether to start the animation
 * @param delay - Initial delay before typing starts (ms)
 * @param speed - Delay between each character (ms)
 * @returns The current partially-typed string and whether it's done
 */
export function useTypewriter(
  target: string,
  active: boolean,
  { delay = 900, speed = 35 }: { delay?: number; speed?: number } = {},
) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active || !target) return;

    // Reset
    setValue("");
    setDone(false);
    indexRef.current = 0;

    // Initial delay
    timerRef.current = setTimeout(() => {
      function typeNext() {
        if (indexRef.current >= target.length) {
          setDone(true);
          return;
        }
        indexRef.current += 1;
        setValue(target.slice(0, indexRef.current));

        // Slight variation in speed for natural feel
        const jitter = Math.random() * 20 - 10;
        timerRef.current = setTimeout(typeNext, speed + jitter);
      }
      typeNext();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, active, delay, speed]);

  return { value, done };
}

/**
 * Orchestrates multiple typewriter fields in sequence.
 * Each field starts after the previous one finishes.
 *
 * The typing loop reads `fields` and timing options from refs so each
 * `setValues` tick during typing does NOT re-run the start effect —
 * which would otherwise reset state mid-type and trigger
 * "Maximum update depth exceeded" when a parent's sync-to-wizard-state
 * effect fires on every keystroke and creates a new updateState ref.
 *
 * The effect runs only on `active` transitions; everything else uses
 * the latest ref value at call time.
 */
export function useTypewriterSequence(
  fields: Array<{ key: string; value: string }>,
  active: boolean,
  {
    initialDelay = 900,
    speed = 30,
    gap = 200,
  }: { initialDelay?: number; speed?: number; gap?: number } = {},
) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const [allDone, setAllDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charRef = useRef(0);

  // Refs hold latest values so the typing loop reads fresh data without
  // forcing the start effect to re-run on every consumer re-render.
  const fieldsRef = useRef(fields);
  const speedRef = useRef(speed);
  const gapRef = useRef(gap);
  const initialDelayRef = useRef(initialDelay);
  fieldsRef.current = fields;
  speedRef.current = speed;
  gapRef.current = gap;
  initialDelayRef.current = initialDelay;

  // Stable signature — only reset when actual content changes, not when
  // the array gets a new reference from a parent useMemo recompute.
  const fieldsKey = fields.map((f) => `${f.key}:${f.value.length}`).join("|");

  useEffect(() => {
    if (!active || fieldsRef.current.length === 0) return;

    setValues({});
    setActiveIndex(-1);
    setAllDone(false);
    charRef.current = 0;

    function typeField(fieldIndex: number) {
      const currentFields = fieldsRef.current;
      if (fieldIndex >= currentFields.length) {
        setAllDone(true);
        return;
      }

      setActiveIndex(fieldIndex);
      charRef.current = 0;

      function typeChar() {
        const f = fieldsRef.current[fieldIndex];
        if (!f || charRef.current >= f.value.length) {
          timerRef.current = setTimeout(() => typeField(fieldIndex + 1), gapRef.current);
          return;
        }
        charRef.current += 1;
        const sliced = f.value.slice(0, charRef.current);
        setValues((prev) => (prev[f.key] === sliced ? prev : { ...prev, [f.key]: sliced }));
        const jitter = Math.random() * 15 - 7;
        timerRef.current = setTimeout(typeChar, speedRef.current + jitter);
      }
      typeChar();
    }

    timerRef.current = setTimeout(() => typeField(0), initialDelayRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, fieldsKey]);

  return { values, activeIndex, allDone };
}
