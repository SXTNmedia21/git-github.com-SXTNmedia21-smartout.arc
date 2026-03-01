// ============================================
// FeatureDeviation.tsx
// Demo feature component: incident/deviation report via chat.
// This journey is chat-only — the feature panel shows a
// structured form that builds up as the user provides info
// through the assistant panel. Ends with a summary card.
// Connected to: journeys/journey-4-deviation.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, FileText, Clock, MapPin, User, CheckCircle2, Send } from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Component ───────────────────────────────────────────

/**
 * Renders a progressive incident report form.
 * Fields appear one by one as the assistant guides the visitor.
 *
 * UI state keys used:
 * - phase: "empty" | "building" | "submitted"
 * - fields: object with filled-in report fields
 */
export function FeatureDeviation({ currentStepId, uiState, onInteraction }: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "empty";
  const fields = (uiState.fields as Record<string, string>) ?? {};

  return (
    <div className="flex h-full flex-col gap-5">
      <AnimatePresence mode="wait">
        {/* Phase: Empty — waiting for user to start */}
        {phase === "empty" && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Avviksmeldning</h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Meld inn avvik via chat med Lise. Hun hjelper deg å strukturere meldingen.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300">
              <FileText className="h-3.5 w-3.5" />
              Bruk chatpanelet til høyre for å begynne
            </div>
          </motion.div>
        )}

        {/* Phase: Building — fields appear progressively */}
        {phase === "building" && (
          <motion.div
            key="building"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Ny avviksmeldning</h2>
              <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                Pågår
              </span>
            </div>

            {/* Report fields — appear as info is gathered */}
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {fields.what && (
                  <motion.div
                    key="what"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-4"
                  >
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <AlertTriangle className="h-3 w-3" />
                      Hva skjedde
                    </label>
                    <p className="text-sm text-zinc-200">{fields.what}</p>
                  </motion.div>
                )}

                {fields.when && (
                  <motion.div
                    key="when"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-4"
                  >
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <Clock className="h-3 w-3" />
                      Når skjedde det
                    </label>
                    <p className="text-sm text-zinc-200">{fields.when}</p>
                  </motion.div>
                )}

                {fields.where && (
                  <motion.div
                    key="where"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-4"
                  >
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <MapPin className="h-3 w-3" />
                      Hvor skjedde det
                    </label>
                    <p className="text-sm text-zinc-200">{fields.where}</p>
                  </motion.div>
                )}

                {fields.severity && (
                  <motion.div
                    key="severity"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-4"
                  >
                    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-zinc-500">
                      <AlertTriangle className="h-3 w-3" />
                      Alvorlighetsgrad
                    </label>
                    <div className="mt-1 flex gap-2">
                      {["Lav", "Middels", "Høy"].map((level) => (
                        <span
                          key={level}
                          className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                            fields.severity === level
                              ? level === "Høy"
                                ? "border-red-500/30 bg-red-500/10 text-red-300"
                                : level === "Middels"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-white/[0.06] bg-transparent text-zinc-600"
                          }`}
                        >
                          {level}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Waiting indicator when not all fields are filled */}
            {Object.keys(fields).length < 4 && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                Lise samler inn informasjon...
              </div>
            )}
          </motion.div>
        )}

        {/* Phase: Submitted — final summary card */}
        {phase === "submitted" && (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            {/* Success banner */}
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Avviksmeldning registrert</p>
                <p className="text-xs text-zinc-500">Sendt til avdelingsleder kl. 14:32</p>
              </div>
            </motion.div>

            {/* Summary card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Oppsummering</h3>
                <span className="text-xs text-zinc-500">AV-2026-0047</span>
              </div>

              <div className="flex flex-col gap-3">
                <SummaryRow
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label="Hendelse"
                  value={fields.what ?? "—"}
                />
                <SummaryRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Tidspunkt"
                  value={fields.when ?? "—"}
                />
                <SummaryRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Sted"
                  value={fields.where ?? "—"}
                />
                <SummaryRow
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Meldt av"
                  value="Maria S."
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    fields.severity === "Høy"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {fields.severity ?? "Middels"}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Send className="h-3 w-3" />
                  Varslet: Erik Paulsen (leder)
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Single row in the summary card */
function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-zinc-500">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm text-zinc-200">{value}</p>
      </div>
    </div>
  );
}
