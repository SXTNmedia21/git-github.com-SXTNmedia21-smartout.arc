"use client";

/**
 * AdminActionDrawer — right-side drawer hosting the three platform-admin
 * interventions on a live session (ADR-0185).
 *
 *   1. Whisper — inject an instruction into Emma's next turn.
 *      POST /api/botsson/recorder/whisper { session_id, content }
 *
 *   2. Flag session — flag the whole session with a reason.
 *      POST /api/botsson/recorder/flag-session { session_id, reason }
 *      NOTE (Phase 2 follow-up): endpoint does not exist yet. Until it lands
 *      the per-turn flag endpoint stays the supported path. The drawer shows
 *      a toast-style error when the call fails.
 *
 *   3. Force-stop — hold 800ms to tear down the live session.
 *      POST /api/botsson/recorder/force-stop { session_id }
 *      NOTE (Phase 2 follow-up): endpoint does not exist yet. The hold UI is
 *      wired; failures surface via alert so operators know to fall back.
 *
 * Motion: spring stiffness 40 damping 22 mass 2.2 on drawer slide-in,
 * 0.28s opacity on backdrop. Esc closes.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, MessageSquare, StopCircle, X } from "lucide-react";

type AdminActionDrawerProps = {
  sessionId: string;
  open: boolean;
  onClose: () => void;
};

const FORCE_STOP_HOLD_MS = 800;

export function AdminActionDrawer({ sessionId, open, onClose }: AdminActionDrawerProps) {
  const [whisperText, setWhisperText] = useState("");
  const [whisperBusy, setWhisperBusy] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [stopProgress, setStopProgress] = useState(0);

  // useRef so the rAF loop can observe cancellation without going stale.
  const stoppingRef = useRef(false);
  const holdStartRef = useRef(0);

  // Reset whisper text when the drawer closes — otherwise a cancelled draft
  // would reappear on the next open and confuse the operator.
  useEffect(() => {
    if (!open) {
      setWhisperText("");
      setStopProgress(0);
      stoppingRef.current = false;
    }
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submitWhisper = useCallback(async () => {
    const content = whisperText.trim();
    if (!content) return;
    setWhisperBusy(true);
    try {
      const res = await fetch("/api/botsson/recorder/whisper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, content }),
      });
      if (!res.ok) {
        window.alert(`Whisper feilet: ${res.status}`);
        return;
      }
      setWhisperText("");
    } finally {
      setWhisperBusy(false);
    }
  }, [sessionId, whisperText]);

  const flagSession = useCallback(async () => {
    const reason = window.prompt("Hvorfor flagge hele sesjonen?");
    if (!reason) return;
    setFlagBusy(true);
    try {
      const res = await fetch("/api/botsson/recorder/flag-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, reason }),
      });
      if (!res.ok) {
        // Phase 2 follow-up: endpoint does not exist yet.
        window.alert(
          `Flag-session ikke tilgjengelig ennå (${res.status}). Flag turns individuelt inntil videre.`,
        );
        return;
      }
    } finally {
      setFlagBusy(false);
    }
  }, [sessionId]);

  const startForceStop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    holdStartRef.current = Date.now();

    const tick = () => {
      if (!stoppingRef.current) {
        setStopProgress(0);
        return;
      }
      const progress = Math.min(1, (Date.now() - holdStartRef.current) / FORCE_STOP_HOLD_MS);
      setStopProgress(progress);

      if (progress >= 1) {
        stoppingRef.current = false;
        setStopProgress(0);
        void fetch("/api/botsson/recorder/force-stop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        }).then((res) => {
          if (!res.ok) {
            window.alert(`Force-stop ikke tilgjengelig ennå (${res.status}). Phase 2 follow-up.`);
          }
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [sessionId]);

  const cancelForceStop = useCallback(() => {
    stoppingRef.current = false;
    setStopProgress(0);
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            className="bg-background border-border fixed top-0 right-0 bottom-0 z-50 w-[520px] border-l"
            initial={{ x: 520 }}
            animate={{ x: 0 }}
            exit={{ x: 520 }}
            transition={{ type: "spring", stiffness: 40, damping: 22, mass: 2.2 }}
            role="dialog"
            aria-label="Session admin actions"
          >
            <div className="flex h-full flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl">Session Admin</h2>
                <button onClick={onClose} aria-label="Lukk" type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Whisper */}
              <div className="space-y-2">
                <label className="text-muted-foreground flex items-center gap-1 text-xs">
                  <MessageSquare className="h-3 w-3" /> Whisper til Emma
                </label>
                <textarea
                  value={whisperText}
                  onChange={(e) => setWhisperText(e.target.value)}
                  placeholder="Skriv en instruks som blir injisert i neste turn..."
                  className="bg-card border-border min-h-[100px] w-full rounded-md border p-2 text-sm"
                />
                <button
                  onClick={submitWhisper}
                  disabled={!whisperText.trim() || whisperBusy}
                  className="bg-primary text-primary-foreground w-full rounded-md py-2 text-sm font-medium disabled:opacity-50"
                  type="button"
                >
                  {whisperBusy ? "Sender..." : "Send whisper"}
                </button>
              </div>

              {/* Flag session */}
              <div className="border-border space-y-2 border-t pt-4">
                <label className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Flag className="h-3 w-3" /> Flag session
                </label>
                <button
                  onClick={flagSession}
                  disabled={flagBusy}
                  className="w-full rounded-md bg-amber-500/10 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50"
                  type="button"
                >
                  {flagBusy ? "Flagger..." : "Flag hele sesjonen"}
                </button>
              </div>

              {/* Force-stop */}
              <div className="border-border mt-auto space-y-2 border-t pt-4">
                <label className="text-muted-foreground flex items-center gap-1 text-xs">
                  <StopCircle className="h-3 w-3" /> Force-stop (hold 800ms)
                </label>
                <button
                  onMouseDown={startForceStop}
                  onMouseUp={cancelForceStop}
                  onMouseLeave={cancelForceStop}
                  onTouchStart={startForceStop}
                  onTouchEnd={cancelForceStop}
                  className="bg-destructive/10 text-destructive relative w-full overflow-hidden rounded-md py-2 text-sm font-medium"
                  type="button"
                >
                  <span className="relative z-10">Hold for å stoppe</span>
                  {stopProgress > 0 ? (
                    <span
                      className="bg-destructive/30 absolute inset-0 origin-left"
                      style={{ transform: `scaleX(${stopProgress})` }}
                      aria-hidden
                    />
                  ) : null}
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
