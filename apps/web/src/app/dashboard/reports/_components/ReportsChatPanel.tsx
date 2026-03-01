// ============================================
// ReportsChatPanel.tsx
// AI chat panel for the report builder wizard.
// Adapted from contract-editor/ai-chat-panel.tsx pattern.
// Users chat with Mr. Botsson to create reports step-by-step.
// Connected to: apps/web/src/app/api/reports-agent/route.ts (API endpoint)
// ============================================

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, BarChart3, List, Users, ClipboardCheck, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reportData?: unknown;
  savedReport?: unknown;
  timestamp: Date;
};

type ReportsChatPanelProps = {
  workspaceId: string;
  /** Called when the agent returns report data for visualization */
  onReportData: (data: unknown) => void;
  /** Called when a report is saved — refresh the saved reports list */
  onReportSaved: () => void;
};

const QUICK_ACTIONS = [
  {
    label: "Ny rapport",
    icon: BarChart3,
    prompt: "Jeg vil lage en ny rapport. Vis meg hva jeg kan rapportere på.",
  },
  {
    label: "Mine rapporter",
    icon: List,
    prompt: "Vis mine lagrede rapporter.",
  },
  {
    label: "Medarbeidere",
    icon: Users,
    prompt: "Lag en medarbeider-oversikt som viser antall ansatte per rolle og status.",
  },
  {
    label: "Protokoll-status",
    icon: ClipboardCheck,
    prompt: "Lag en rapport over protokoll-tildelinger og fullføringsstatus.",
  },
];

/**
 * Chat panel for the AI report builder.
 * Sends messages to /api/reports-agent and displays responses.
 * Passes report data and save events to parent for visualization.
 */
export function ReportsChatPanel({
  workspaceId,
  onReportData,
  onReportSaved,
}: ReportsChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/reports-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            userMessage: messageText.trim(),
            conversationHistory,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          text: string;
          reportData?: unknown;
          savedReport?: unknown;
        };

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.text,
          reportData: data.reportData,
          savedReport: data.savedReport,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Pass report data to parent for visualization
        if (data.reportData) {
          onReportData(data.reportData);
        }

        // Notify parent that a report was saved
        if (data.savedReport) {
          onReportSaved();
        }
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Beklager, noe gikk galt. Prøv igjen.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        console.error("Reports agent error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, workspaceId, onReportData, onReportSaved],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      void sendMessage(prompt);
    },
    [sendMessage],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <Bot className="text-primary h-4 w-4" />
        <span className="text-sm font-semibold">Rapportassistent</span>
        <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">Online</span>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bot className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-center text-sm">
              Hei! Jeg kan hjelpe deg å bygge tilpassede rapporter.
            </p>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              Spør meg om noe, eller bruk hurtighandlingene nedenfor.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.reportData != null && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p className="text-xs opacity-70">
                        <BarChart3 className="mr-1 inline h-3 w-3" />
                        Rapportdata mottatt — se forhåndsvisning til venstre
                      </p>
                    </div>
                  )}
                  {message.savedReport != null && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p className="text-xs text-green-400">Rapporten er lagret!</p>
                    </div>
                  )}
                  <p className="mt-1 text-xs opacity-50">
                    {message.timestamp.toLocaleTimeString("no-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-muted-foreground">Tenker...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Quick actions */}
      <div className="border-border flex flex-wrap gap-1.5 border-t px-3 py-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleQuickAction(action.prompt)}
            disabled={isLoading}
          >
            <action.icon className="mr-1 h-3 w-3" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Input area */}
      <div className="border-border border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Beskriv rapporten du vil lage..."
            className="max-h-[120px] min-h-[40px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
