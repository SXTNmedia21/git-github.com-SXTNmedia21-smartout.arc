"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { OnboardingSection, BotssonScript } from "../types";
import { getScriptsForSection } from "../lib/botsson-scripts";

interface BotssonState {
  isSpeaking: boolean;
  isEnabled: boolean;
  currentText: string;
  toggleVoice: () => void;
  speak: (text: string) => void;
  triggerSection: (section: OnboardingSection, trigger: BotssonScript["trigger"]) => void;
}

export function useBotsson(): BotssonState {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentText, setCurrentText] = useState("");
  const spokenRef = useRef<Set<string>>(new Set());
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled || !synthRef.current) return;

      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "nb-NO";
      utterance.rate = 0.95;
      utterance.pitch = 0.9;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentText(text);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentText("");
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentText("");
      };

      synthRef.current.speak(utterance);
    },
    [isEnabled],
  );

  const triggerSection = useCallback(
    (section: OnboardingSection, trigger: BotssonScript["trigger"]) => {
      const key = `${section}:${trigger}`;
      if (spokenRef.current.has(key)) return;
      spokenRef.current.add(key);

      const scripts = getScriptsForSection(section, trigger);
      if (scripts.length === 0) return;

      const script = scripts[0];
      const delay = script.delay ?? 0;
      setTimeout(() => speak(script.text), delay);
    },
    [speak],
  );

  const toggleVoice = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) synthRef.current?.cancel();
      return !prev;
    });
  }, []);

  return {
    isSpeaking,
    isEnabled,
    currentText,
    toggleVoice,
    speak,
    triggerSection,
  };
}
