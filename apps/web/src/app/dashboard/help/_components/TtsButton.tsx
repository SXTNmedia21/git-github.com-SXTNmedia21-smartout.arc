"use client";

/**
 * TtsButton.tsx — Browser-native Text-to-Speech toggle for KB articles.
 *
 * Uses the Web Speech API (SpeechSynthesis) — no server-side TTS, no API
 * keys, no Twilio/Ultravox (I-5 invariant: TTS on help page = browser only,
 * not a voice call). Reads Norwegian text in nb-NO locale.
 *
 * The component is window-guarded: `window.speechSynthesis` is accessed only
 * inside event handlers (never at module level or during render), so it is
 * safe to import in SSR builds and will never crash during server rendering.
 *
 * Usage:
 *   <TtsButton text="Slik bytter du vakt. Steg for steg…" label="Hør artikkelen" />
 */

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TtsButtonProps {
  /** The full text to be read aloud. Keep under ~500 chars for best UX. */
  text: string;
  /** Accessible label — also shown as tooltip via title attribute. */
  label?: string;
}

export function TtsButton({ text, label = "Hør artikkelen" }: TtsButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  function handleToggle() {
    // Window-guard: SpeechSynthesis is a browser-only API. This handler is
    // called only in response to a user click — never during SSR or hydration.
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nb-NO";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      title={label}
      aria-label={isPlaying ? "Stopp avlesing" : label}
      aria-pressed={isPlaying}
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      {isPlaying ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
