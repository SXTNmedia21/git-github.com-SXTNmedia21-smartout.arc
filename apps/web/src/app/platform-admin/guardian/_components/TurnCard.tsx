"use client";

/**
 * TurnCard — expandable per-turn card inside the TurnTimeline (ADR-0184).
 *
 * Collapsed: phase badge + turn_index + content preview + attention pill
 * (only when score > 0.7) + hover Flag icon.
 * Expanded: full content_redacted JSON + meta keys.
 *
 * Motion contract (Nordic Split):
 *   - layout animation on the outer card (spring stiffness 35 damping 22 mass 2.2)
 *   - height/opacity crossfade on the expanded region (stiffness 40 damping 22)
 *
 * Verdict colour cue:
 *   - block severity  → destructive tint
 *   - flagged         → amber tint
 *   - everything else → muted
 *
 * The Flag icon fades in on row hover (opacity 0 → 100 over 200ms) to keep
 * the resting state calm.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown, Flag } from "lucide-react";
import type { Database } from "@smartout/supabase";

type Turn = Database["public"]["Tables"]["agent_session_recording"]["Row"];

type TurnCardProps = {
  turn: Turn;
  onFlag?: (id: string) => void;
};

type GuardianVerdictShape = {
  verdict?: { severity?: string };
};

function verdictClass(turn: Turn): string {
  if (turn.turn_kind === "guardian_verdict") {
    const content = turn.content_redacted as GuardianVerdictShape | null;
    if (content?.verdict?.severity === "block") {
      return "bg-destructive/10 text-destructive";
    }
  }
  if (turn.is_flagged) {
    return "bg-amber-500/10 text-amber-700";
  }
  return "bg-muted/40 text-muted-foreground";
}

export function TurnCard({ turn, onFlag }: TurnCardProps) {
  const [expanded, setExpanded] = useState(false);

  const attention = Number(turn.attention_score ?? 0);
  const showAttention = attention > 0.7;
  const preview = JSON.stringify(turn.content_redacted).slice(0, 80);
  const metaEntries =
    turn.meta && typeof turn.meta === "object" && !Array.isArray(turn.meta)
      ? Object.entries(turn.meta as Record<string, unknown>)
      : [];

  return (
    <motion.div
      layout
      className="group border-border/30 bg-card/60 relative mb-2 rounded-lg border"
      transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        type="button"
      >
        <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${verdictClass(turn)}`}>
          {turn.phase}
        </span>
        <span className="text-muted-foreground text-xs">#{turn.turn_index}</span>
        <span className="flex-1 truncate text-xs">{preview}</span>
        {showAttention ? (
          <span className="text-[10px] font-semibold text-amber-700">⚠ {attention.toFixed(2)}</span>
        ) : null}
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {onFlag ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFlag(turn.id);
          }}
          className="absolute top-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-label="Flag turn"
          type="button"
        >
          <Flag className="text-muted-foreground h-3.5 w-3.5 hover:text-amber-600" />
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 40, damping: 22 }}
            className="overflow-hidden"
          >
            <pre className="bg-muted/20 overflow-x-auto p-3 font-mono text-[11px]">
              {JSON.stringify(turn.content_redacted, null, 2)}
            </pre>
            {metaEntries.length > 0 ? (
              <div className="text-muted-foreground px-3 pb-2 text-[10px]">
                {metaEntries.map(([k, v]) => (
                  <span key={k} className="mr-3">
                    <span className="font-semibold">{k}:</span> {JSON.stringify(v)}
                  </span>
                ))}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
