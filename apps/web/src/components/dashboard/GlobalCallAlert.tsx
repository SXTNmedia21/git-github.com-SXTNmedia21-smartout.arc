"use client";

/**
 * GlobalCallAlert — Shows incoming call overlay from ANY dashboard page.
 *
 * Subscribes to personal call signaling via Supabase Realtime. When a
 * call_invite arrives, shows a full-screen overlay with ringtone sound,
 * accept/reject buttons, and caller info. Accept opens the komm page
 * with the call connected.
 */

import { useContext, useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardContext } from "./DashboardShell";
import { useCallSignaling } from "@/app/dashboard/komm/_hooks/use-call-signaling";
import { useTranslation } from "@smartout/i18n";

/* ------------------------------------------------------------------ */
/*  Ringtone — Web Audio API oscillator (no external file needed)      */
/* ------------------------------------------------------------------ */

function useRingtone() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      function playTone() {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Two-tone ring pattern (like a phone)
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }

      playTone();
      intervalRef.current = setInterval(playTone, 1500);
    } catch {
      // Audio not available — silent fallback
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop };
}

/* ------------------------------------------------------------------ */
/*  Spring config (Nordic Split motion)                                */
/* ------------------------------------------------------------------ */

const OVERLAY_SPRING = { type: "spring" as const, stiffness: 40, damping: 24, mass: 2 };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GlobalCallAlert() {
  const { profileId } = useContext(DashboardContext);
  const router = useRouter();
  const { t } = useTranslation("komm");
  const ringtone = useRingtone();

  // Subscribe to personal calls globally (channelId=null for personal only)
  const { incomingCall, dismissIncoming } = useCallSignaling(profileId, null);
  const [isVisible, setIsVisible] = useState(false);

  // Show overlay + start ringtone when call comes in
  useEffect(() => {
    if (incomingCall) {
      setIsVisible(true);
      ringtone.start();
    } else {
      setIsVisible(false);
      ringtone.stop();
    }
  }, [incomingCall, ringtone]);

  const handleAccept = useCallback(() => {
    ringtone.stop();
    dismissIncoming();
    // Navigate to komm to connect the call
    if (incomingCall?.channelId) {
      router.push(`/dashboard/komm?call=${incomingCall.channelId}`);
    } else {
      router.push("/dashboard/komm");
    }
  }, [ringtone, dismissIncoming, incomingCall, router]);

  const handleReject = useCallback(() => {
    ringtone.stop();
    dismissIncoming();
  }, [ringtone, dismissIncoming]);

  // Keyboard shortcuts: Enter=accept, Escape=reject
  useEffect(() => {
    if (!isVisible) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleReject();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isVisible, handleAccept, handleReject]);

  if (!incomingCall) return null;

  const initials = incomingCall.callerName.slice(0, 2).toUpperCase();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="call-popup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incoming-call-title"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={OVERLAY_SPRING}
            className="w-[320px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{
              background:
                "linear-gradient(145deg, rgba(24,24,27,0.98) 0%, rgba(14,14,16,0.99) 100%)",
            }}
          >
            {/* Pulsing green top accent */}
            <motion.div
              className="h-[3px] bg-gradient-to-r from-green-500 via-green-400 to-green-500"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Content */}
            <div className="flex flex-col items-center gap-5 px-6 pt-7 pb-5">
              {/* Pulsing avatar */}
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(34, 197, 94, 0)",
                    "0 0 0 14px rgba(34, 197, 94, 0.12)",
                    "0 0 0 0 rgba(34, 197, 94, 0)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-full"
              >
                <Avatar className="h-16 w-16 border-2 border-green-500/30">
                  <AvatarFallback className="bg-green-500/10 text-lg font-bold text-green-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              {/* Caller info */}
              <div className="text-center">
                <h3 id="incoming-call-title" className="text-base font-semibold text-white">
                  {incomingCall.callerName}
                </h3>
                <motion.p
                  className="mt-0.5 text-sm text-green-400/80"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {t("incoming_call.ringing")}
                </motion.p>
              </div>

              {/* Accept / Reject */}
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={handleReject}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25"
                  aria-label={t("incoming_call.reject_aria")}
                >
                  <PhoneOff className="h-5 w-5" />
                </button>

                <motion.button
                  type="button"
                  onClick={handleAccept}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-colors hover:bg-green-400"
                  aria-label={t("incoming_call.accept_aria")}
                >
                  <Phone className="h-6 w-6" />
                </motion.button>

                <div className="h-12 w-12" />
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="border-t border-white/5 px-4 py-2">
              <p className="text-center text-[10px] tracking-wide text-white/25">
                ENTER {t("incoming_call.accept_aria")} · ESC {t("incoming_call.reject_aria")}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
