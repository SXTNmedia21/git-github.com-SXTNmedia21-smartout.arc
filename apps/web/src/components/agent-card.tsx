"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DebugEntry {
  timestamp: number;
  type: "status" | "tool_call" | "tool_result" | "context_push" | "inference" | "event";
  content: string;
}

interface AgentCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Identity
  name: string;
  description: string;
  greeting: string;
  // Config
  temperature?: number;
  voice?: string;
  language?: string;
  maxDuration?: number;
  firstSpeaker?: "agent" | "user";
  // Live session
  status?: string;
  isConnected?: boolean;
  // Context log: messages pushed via sendContext
  contextLog?: string[];
  // Debug log: structured event log
  debugLog?: DebugEntry[];
  // Transcript: conversation history
  transcript?: { role: string; text: string }[];
  // System prompt
  instruction?: string;
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
        {label}
      </span>
      <span className="text-sm text-white/80">{value}</span>
    </div>
  );
}

export function AgentCard({
  open,
  onOpenChange,
  name,
  description,
  greeting,
  temperature,
  voice,
  language,
  maxDuration,
  firstSpeaker,
  status,
  isConnected,
  contextLog,
  debugLog,
  transcript,
  instruction,
}: AgentCardProps) {
  const [showInstruction, setShowInstruction] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-white/10 bg-black/90 p-0 backdrop-blur-xl sm:max-w-md"
      >
        {/* Header */}
        <SheetHeader className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-semibold text-white">{name}</SheetTitle>
            {isConnected !== undefined && (
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-white/20"}`}
              />
            )}
            {status && status !== "idle" && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                {status}
              </span>
            )}
          </div>
          <SheetDescription className="text-sm text-white/50">{greeting}</SheetDescription>
          <p className="text-xs leading-relaxed text-white/30">{description}</p>
        </SheetHeader>

        {/* Config grid */}
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h3 className="mb-3 text-[10px] font-medium tracking-wider text-white/40 uppercase">
            Config
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {temperature !== undefined && (
              <ConfigItem label="Temperature" value={String(temperature)} />
            )}
            {voice && (
              <ConfigItem
                label="Voice"
                value={voice.length > 12 ? `${voice.slice(0, 12)}...` : voice}
              />
            )}
            {language && <ConfigItem label="Language" value={language} />}
            {maxDuration !== undefined && (
              <ConfigItem label="Max duration" value={`${Math.round(maxDuration / 60)} min`} />
            )}
            {firstSpeaker && <ConfigItem label="First speaker" value={firstSpeaker} />}
          </div>
        </div>

        {/* Context log */}
        {contextLog && contextLog.length > 0 && (
          <div className="border-b border-white/[0.06] px-6 py-4">
            <h3 className="mb-3 text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Context pushed ({contextLog.length})
            </h3>
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {contextLog.map((msg, i) => (
                <p
                  key={i}
                  className="rounded-md bg-white/[0.04] px-3 py-1.5 text-xs leading-relaxed text-white/60"
                >
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Debug log */}
        {debugLog && debugLog.length > 0 && (
          <div className="border-b border-white/[0.06] px-6 py-4">
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase transition-colors hover:text-white/60"
            >
              {showDebug ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Debug log ({debugLog.length})
            </button>
            {showDebug && (
              <div className="flex max-h-60 flex-col gap-1 overflow-y-auto font-mono text-[11px]">
                {debugLog.map((entry, i) => {
                  const time = new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  const colors: Record<string, string> = {
                    status: "text-blue-400/70",
                    tool_call: "text-amber-400/80",
                    tool_result: "text-emerald-400/60",
                    context_push: "text-purple-400/70",
                    inference: "text-rose-400/70",
                    event: "text-white/30",
                  };
                  return (
                    <div key={i} className="flex gap-2 leading-tight">
                      <span className="shrink-0 text-white/20">{time}</span>
                      <span className={`shrink-0 ${colors[entry.type] ?? "text-white/40"}`}>
                        {entry.type}
                      </span>
                      <span className="truncate text-white/50">{entry.content}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Transcript */}
        {transcript && transcript.length > 0 && (
          <div className="border-b border-white/[0.06] px-6 py-4">
            <h3 className="mb-3 text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Transcript ({transcript.length})
            </h3>
            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] font-medium tracking-wider text-white/30 uppercase">
                    {msg.role}
                  </span>
                  <p
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-white/[0.08] text-white/70"
                        : "bg-white/[0.04] text-white/60"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System prompt (collapsible) */}
        {instruction && (
          <div className="px-6 py-4">
            <button
              type="button"
              onClick={() => setShowInstruction((v) => !v)}
              className="mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase transition-colors hover:text-white/60"
            >
              {showInstruction ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              System prompt
            </button>
            {showInstruction && (
              <pre className="max-h-80 overflow-y-auto rounded-lg bg-white/[0.04] p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/50">
                {instruction}
              </pre>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
