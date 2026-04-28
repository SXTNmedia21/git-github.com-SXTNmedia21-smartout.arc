// ============================================
// journey-ops-chat.tsx — Journey Operations Agent chat panel
// Lives inside the journey detail page as the "Agent" tab. Sends messages
// to /api/platform-admin/journey-ops-agent with currentJourneyId set, then
// renders text + per-turn tool-call log so the user can see what the agent
// did to the spec, the runbook, and the engine binding.
// Connected to: apps/web/src/app/api/platform-admin/journey-ops-agent/route.ts
// ============================================

"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Bot, User, Wrench } from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────

type ToolCall = { name: string; args: unknown };

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] };

type JourneyOpsChatProps = {
  /** Specific journey to keep in focus, or null on the index page. */
  journeyId: string | null;
  /** Display label (code or "All journeys"). */
  journeyCode: string;
};

// ─── Quick-prompt presets ────────────────────────────────

const QUICK_PROMPTS_DETAIL = [
  { label: "Read spec", prompt: "Read the current journey spec and summarize key fields." },
  {
    label: "Run runbook",
    prompt: "Run the engine-binding runbook on the current journey and walk me through the result.",
  },
  {
    label: "Find related",
    prompt:
      "Look up sibling journeys + sibling triggers in this module. Tell me what naming conventions are already in use.",
  },
  {
    label: "Index this module",
    prompt:
      "Show me the index of all journeys in this journey's module — code, title, status, whether they have a binding set, and whether they are compiled.",
  },
];

const QUICK_PROMPTS_INDEX = [
  {
    label: "Full index",
    prompt:
      "List all journeys in a compact table: code, title, module, status, version, binding_set, compiled.",
  },
  {
    label: "Mangler binding",
    prompt:
      "Find every journey where trigger_event, step_event_type, or entity_type is null. Group by module and tell me which to fix first.",
  },
  {
    label: "Ikke kompilert",
    prompt:
      "Show me journeys that have a binding set but no engine_process_id (i.e. the binding is filled but compile has not run).",
  },
  {
    label: "Triggers per modul",
    prompt:
      "For each module, list the engine_trigger event_type values currently in use. Flag inconsistent naming patterns.",
  },
];

// ─── Component ───────────────────────────────────────────

export function JourneyOpsChat({ journeyId, journeyCode }: JourneyOpsChatProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, running]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    const next: Turn = { role: "user", content: trimmed };
    const optimisticTurns = [...turns, next];
    setTurns(optimisticTurns);
    setDraft("");
    setRunning(true);

    const conversationHistory = optimisticTurns.slice(0, -1).map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch("/api/platform-admin/journey-ops-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: trimmed,
          conversationHistory,
          currentJourneyId: journeyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Agent error");
        setTurns([
          ...optimisticTurns,
          {
            role: "assistant",
            content: `_Error: ${data.error ?? res.status}_`,
            toolCalls: [],
          },
        ]);
        return;
      }

      const data = (await res.json()) as { text: string; toolCalls: ToolCall[] };
      setTurns([
        ...optimisticTurns,
        { role: "assistant", content: data.text, toolCalls: data.toolCalls },
      ]);
    } catch {
      toast.error("Network error");
    } finally {
      setRunning(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <Card className="flex h-[640px] flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Journey Ops Agent
            <span className="text-muted-foreground font-mono text-xs">{journeyCode}</span>
          </CardTitle>
          {turns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTurns([])} disabled={running}>
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden">
        {/* Quick prompts */}
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Start with a preset:</p>
            <div className="flex flex-wrap gap-2">
              {(journeyId ? QUICK_PROMPTS_DETAIL : QUICK_PROMPTS_INDEX).map((qp) => (
                <Button
                  key={qp.label}
                  variant="outline"
                  size="sm"
                  onClick={() => void send(qp.prompt)}
                  disabled={running}
                >
                  {qp.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
          <ol className="space-y-4">
            {turns.map((turn, idx) => (
              <li key={idx} className="flex gap-2">
                <div className="bg-muted text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
                  {turn.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {turn.role === "assistant" && turn.toolCalls.length > 0 && (
                    <ul className="space-y-1">
                      {turn.toolCalls.map((tc, i) => (
                        <li
                          key={i}
                          className="text-muted-foreground flex items-center gap-2 font-mono text-xs"
                        >
                          <Wrench className="h-3 w-3" />
                          {tc.name}
                          <span className="text-muted-foreground/60 truncate">
                            {summarizeArgs(tc.args)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="text-foreground text-sm whitespace-pre-wrap">
                    {turn.content ||
                      (turn.role === "assistant" ? "_(no text — tool calls only)_" : "")}
                  </div>
                </div>
              </li>
            ))}
            {running && (
              <li className="flex items-center gap-2 pl-9 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-muted-foreground">Thinking…</span>
              </li>
            )}
          </ol>
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spør agenten — “les speken og kjør runbook”, “hvilke triggers finnes for module=onboarding?”, “sett bindingen til <verdi>”…"
            rows={2}
            disabled={running}
            className="resize-none"
          />
          <Button type="submit" disabled={!draft.trim() || running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const obj = args as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string") {
      parts.push(`${k}=${v.length > 30 ? v.slice(0, 30) + "…" : v}`);
    } else if (typeof v === "number" || typeof v === "boolean") {
      parts.push(`${k}=${v}`);
    } else {
      parts.push(`${k}=…`);
    }
    if (parts.length >= 3) break;
  }
  return parts.join(" ");
}
