"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { OnboardingSection, BotssonScript } from "../types";
import { getScriptsForSection } from "../lib/botsson-scripts";

interface BotssonState {
  isSpeaking: boolean;
  isEnabled: boolean;
  isUnlocked: boolean;
  currentText: string;
  toggleVoice: () => void;
  unlock: () => void;
  speak: (text: string) => void;
  triggerSection: (section: OnboardingSection, trigger: BotssonScript["trigger"]) => void;
}

export function useBotsson(): BotssonState {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const spokenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const unlockedRef = useRef(false);

  // Initialize speech synthesis and find Norwegian voice
  useEffect(() => {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;
    synthRef.current = synth;

    function findNorwegianVoice() {
      const voices = synth.getVoices();
      const nbVoice =
        voices.find((v) => v.lang.startsWith("nb")) ??
        voices.find((v) => v.lang.startsWith("no")) ??
        null;
      voiceRef.current = nbVoice;
    }

    findNorwegianVoice();
    synth.addEventListener("voiceschanged", findNorwegianVoice);
    return () => synth.removeEventListener("voiceschanged", findNorwegianVoice);
  }, []);

  const speakNow = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    utterance.rate = 0.95;
    utterance.pitch = 0.9;

    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
    }

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

    synth.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled) return;

      // If not yet unlocked by user gesture, queue it
      if (!unlockedRef.current) {
        queueRef.current.push(text);
        // Still show the text in the speech bubble even without audio
        setCurrentText(text);
        return;
      }

      speakNow(text);
    },
    [isEnabled, speakNow],
  );

  // Unlock: called on first user interaction, plays queued text
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setIsUnlocked(true);

    // Play the most recent queued script (skip old ones)
    const last = queueRef.current.pop();
    queueRef.current = [];
    if (last && isEnabled) {
      speakNow(last);
    }
  }, [isEnabled, speakNow]);

  const triggerSection = useCallback(
    (section: OnboardingSection, trigger: BotssonScript["trigger"]) => {
      const key = `${section}:${trigger}`;
      if (spokenRef.current.has(key)) return;
      spokenRef.current.add(key);

      const scripts = getScriptsForSection(section, trigger);
      if (scripts.length === 0) return;

      const script = scripts[0]!;
      const delay = script.delay ?? 0;
      setTimeout(() => speak(script.text), delay);
    },
    [speak],
  );

  const toggleVoice = useCallback(() => {
    // Toggling also acts as unlock (user gesture)
    if (!unlockedRef.current) {
      unlockedRef.current = true;
      setIsUnlocked(true);
    }

    setIsEnabled((prev) => {
      if (prev) synthRef.current?.cancel();
      return !prev;
    });
  }, []);

  return {
    isSpeaking,
    isEnabled,
    isUnlocked,
    currentText,
    toggleVoice,
    unlock,
    speak,
    triggerSection,
  };
}
