"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "../lib/utils";
import type { BroadcastType } from "./types";

const TYPES: Array<{ key: BroadcastType; label: string; colorClass: string }> = [
  { key: "note", label: "Melding", colorClass: "text-[color:var(--info)]" },
  { key: "alert", label: "Alert", colorClass: "text-[color:var(--warning)]" },
  { key: "reminder", label: "Påminnelse", colorClass: "text-muted-foreground" },
];

const TYPE_BG: Record<BroadcastType, string> = {
  note: "bg-[color:color-mix(in_oklch,var(--info)_14%,transparent)]",
  alert: "bg-[color:color-mix(in_oklch,var(--warning)_14%,transparent)]",
  reminder: "bg-muted",
};

const TYPE_BORDER: Record<BroadcastType, string> = {
  note: "border-[color:var(--info)]",
  alert: "border-[color:var(--warning)]",
  reminder: "border-border",
};

export function BroadcastComposer({
  onSubmit,
  placeholder = "Skriv til teamet…",
  busy = false,
}: {
  onSubmit?: (input: { type: BroadcastType; text: string }) => void;
  placeholder?: string;
  busy?: boolean;
}) {
  const [type, setType] = useState<BroadcastType>("note");
  const [text, setText] = useState("");

  function handleSend() {
    if (!text.trim() || busy) return;
    onSubmit?.({ type, text });
    setText("");
  }

  return (
    <div className="bg-card border-border rounded-[14px] border p-3.5">
      {/* Radiogroup (not tablist) — pills toggle message type, no panel assoc (Gate 2 designer fix). */}
      <div className="mb-2.5 flex gap-1.5" role="radiogroup" aria-label="Meldingstype">
        {TYPES.map((t) => {
          const active = type === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(t.key)}
              className={cn(
                "focus-visible:ring-brand-orange h-7 rounded-full border px-3 text-[11px] font-semibold tracking-[0.04em] transition-all focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? `${TYPE_BORDER[t.key]} ${TYPE_BG[t.key]} ${t.colorClass}`
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="broadcast-input" className="sr-only">
          Meldingsinnhold
        </label>
        <input
          id="broadcast-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="border-border bg-background focus-visible:ring-brand-orange h-10 flex-1 rounded-[10px] border px-3.5 text-[14px] outline-none focus-visible:ring-2"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={busy || !text.trim()}
          className="bg-brand-orange hover:bg-brand-orange/90 flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </button>
      </div>
    </div>
  );
}
