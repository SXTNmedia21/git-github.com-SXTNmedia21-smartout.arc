// ============================================
// wizard-chat.tsx — Wizard Chat Interface
// Main client component for the journey wizard.
// Full-height chat layout with messages on the left,
// draft preview sidebar on the right.
// Sends messages to /api/journey-agent and persists responses.
// Connected to: /api/journey-agent (POST)
// Connected to: /api/platform-admin/journeys/wizard/[sessionId]/complete (POST)
// ============================================

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WizardPhaseIndicator } from "./wizard-phase-indicator";
import { WizardDraftPreview } from "./wizard-draft-preview";

type Message = {
  role: string;
  content: string;
  phase?: string;
  timestamp?: string;
};

type WizardChatProps = {
  sessionId: string;
  initialMessages: Message[];
  initialPhase: string;
  initialDraft: Record<string, unknown>;
  sessionStatus: string;
  journeyId: string | null;
};

/**
 * Full-screen chat interface for the journey wizard.
 *
 * Layout: Phase indicator at top, messages on the left,
 * draft preview sidebar on the right, input at the bottom.
 *
 * Why not streaming: The agent calls tools between responses.
 * Streaming would complicate tool result handling.
 * Full responses are shown after each turn completes.
 */
export function WizardChat({
  sessionId,
  initialMessages,
  initialPhase,
  initialDraft,
  sessionStatus,
  journeyId,
}: WizardChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentPhase, setCurrentPhase] = useState(initialPhase);
  const [draftJourney, setDraftJourney] = useState<Record<string, unknown>>(initialDraft);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isActive = sessionStatus === "active";
  const isReviewPhase = currentPhase === "review";

  /**
   * Scrolls the chat to the bottom when new messages arrive.
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-focus the textarea when chat loads
  useEffect(() => {
    if (isActive) {
      textareaRef.current?.focus();
    }
  }, [isActive]);

  /**
   * Sends the user message to the journey agent API
   * and appends both user and assistant messages to state.
   */
  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Optimistic: show user message immediately
    const userMsg: Message = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/journey-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userMessage: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Agent error");
        return;
      }

      const data = await res.json();

      // Append assistant response
      const assistantMsg: Message = {
        role: "assistant",
        content: data.text,
        phase: data.phase,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update phase and draft from agent response
      if (data.phase) setCurrentPhase(data.phase);
      if (data.draftJourney) setDraftJourney(data.draftJourney as Record<string, unknown>);
    } catch {
      toast.error("Network error — could not reach the agent");
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  /**
   * Handles keyboard shortcuts in the textarea.
   * Enter sends, Shift+Enter adds a newline.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /**
   * Completes the wizard session by creating the journey
   * from the draft data. Redirects to the journey detail page.
   */
  async function handleComplete() {
    setIsCompleting(true);
    try {
      const res = await fetch(`/api/platform-admin/journeys/wizard/${sessionId}/complete`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to complete journey");
        return;
      }

      const data = await res.json();
      toast.success(`Journey ${data.code} created: ${data.title}`);
      router.push(`/platform-admin/journeys/${data.journey_id}`);
    } catch {
      toast.error("Network error");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header bar */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/platform-admin/journeys/wizard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-foreground text-lg font-semibold">Journey Wizard</h1>
            <WizardPhaseIndicator currentPhase={currentPhase} />
          </div>
        </div>

        {/* Complete button — only visible in review phase */}
        {isActive && isReviewPhase && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isCompleting}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isCompleting ? "Creating..." : "Complete Journey"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create journey from draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a new journey with status &quot;Defined&quot;. The wizard session
                  will be marked as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleComplete} disabled={isCompleting}>
                  {isCompleting ? "Creating..." : "Create Journey"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Link to created journey if completed */}
        {!isActive && journeyId && (
          <Link href={`/platform-admin/journeys/${journeyId}`}>
            <Button variant="outline" size="sm">
              View Journey
            </Button>
          </Link>
        )}
      </div>

      {/* Main content — chat + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages area */}
        <div className="flex flex-1 flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="mx-auto max-w-2xl space-y-4">
              {/* Initial guidance if no messages yet */}
              {messages.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <p>Start by describing the journey you want to define.</p>
                  <p className="mt-1">
                    The agent will guide you through 6 phases: Discovery, Classification, Steps,
                    Testing, Documentation, and Review.
                  </p>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Card
                    className={`max-w-[85%] px-4 py-3 ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </Card>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">Thinking...</span>
                    </div>
                  </Card>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          {isActive && (
            <div className="border-border border-t p-4">
              <div className="mx-auto flex max-w-2xl gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your journey..."
                  className="min-h-[44px] flex-1 resize-none"
                  rows={1}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Completed session notice */}
          {!isActive && (
            <div className="border-border border-t p-4 text-center">
              <p className="text-muted-foreground text-sm">This session is {sessionStatus}.</p>
            </div>
          )}
        </div>

        {/* Draft preview sidebar */}
        <div className="border-border hidden w-72 border-l lg:block">
          <WizardDraftPreview draft={draftJourney} />
        </div>
      </div>
    </div>
  );
}
