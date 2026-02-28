"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Sparkles, Languages, Plus, CheckCircle, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { EditorAction } from "./contract-editor";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: EditorAction[];
  timestamp: Date;
};

type AiChatPanelProps = {
  templateId: string;
  getEditorState: () => {
    html: string;
    json: unknown;
    text: string;
  } | null;
  onApplyActions: (actions: EditorAction[]) => void;
};

const QUICK_ACTIONS = [
  {
    label: "Forenkle",
    icon: Sparkles,
    prompt: "Forenkle språket i denne kontrakten. Gjør det lettere å forstå.",
  },
  { label: "Oversett", icon: Languages, prompt: "Oversett hele kontrakten til engelsk." },
  {
    label: "Legg til",
    icon: Plus,
    prompt: "Foreslå viktige seksjoner som mangler i denne kontrakten.",
  },
  {
    label: "Valider",
    icon: CheckCircle,
    prompt: "Valider kontrakten. Sjekk at alle nødvendige seksjoner og felt er på plass.",
  },
];

export function AiChatPanel({ templateId, getEditorState, onApplyActions }: AiChatPanelProps) {
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
        const editorState = getEditorState();
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/contract-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            userMessage: messageText.trim(),
            conversationHistory,
            editorState: editorState ? { html: editorState.html, text: editorState.text } : null,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          text: string;
          actions?: EditorAction[];
        };

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.text,
          actions: data.actions,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If the AI produced actions, pass them to the editor for diff visualization
        if (data.actions && data.actions.length > 0) {
          onApplyActions(data.actions);
        }
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Beklager, noe gikk galt. Prøv igjen.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        console.error("Contract agent error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, templateId, getEditorState, onApplyActions],
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
        <span className="text-sm font-semibold">Kontraktsassistent</span>
        <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">Online</span>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bot className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="text-muted-foreground text-center text-sm">
              Hei! Jeg kan hjelpe deg med å bygge og forbedre kontraktsmaler.
            </p>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              Spor meg om noe, eller bruk hurtighandlingene nedenfor.
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
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p className="mb-1 text-xs opacity-70">
                        {message.actions.length} endring(er) foreslått
                      </p>
                      <div className="space-y-1">
                        {message.actions.map((action, i) => (
                          <div key={i} className="rounded bg-white/5 px-2 py-1 text-xs">
                            {action.type}:{" "}
                            {action.target || (action.data?.title as string) || "dokument"}
                          </div>
                        ))}
                      </div>
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
            placeholder="Skriv en melding..."
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
