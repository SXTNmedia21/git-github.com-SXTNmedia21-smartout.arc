"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, SendHorizonal } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function DocsAgentPanel({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const isEn = locale === "en";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: isEn
        ? "Hi! I'm the LISA Docs Agent. Ask me about setup, shift planning, onboarding, HACCP or reports."
        : "Hei! Jeg er LISA Docs Agent. Spør meg om setup, vaktplan, onboarding, HACCP eller rapporter.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextUserMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, nextUserMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/docs-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed request");
      }

      const data = (await response.json()) as { answer?: string };
      const answer =
        data.answer ??
        "Beklager, jeg fikk ikke hentet et svar akkurat na. Proev igjen om et oyeblikk.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Jeg fikk en teknisk feil. Sjekk at OPENROUTER_API_KEY er satt, og proev igjen.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="border-border/50 bg-card overflow-hidden rounded-3xl border shadow-2xl">
      <div className="border-border/50 flex items-center gap-3 border-b px-6 py-5">
        <div className="border-brand-orange/30 bg-brand-orange/10 flex h-10 w-10 items-center justify-center rounded-xl border">
          <Bot className="text-brand-orange h-5 w-5" />
        </div>
        <div>
          <h3 className="text-foreground font-bold tracking-tight">LISA Docs Agent</h3>
          <p className="text-muted-foreground text-sm">
            {isEn
              ? "Ask about the full SmartOut documentation"
              : "Spør om hele Smartout-dokumentasjonen"}
          </p>
        </div>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
        {messages.map((message, idx) => (
          <div
            key={`${message.role}-${idx}`}
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              message.role === "assistant"
                ? "border-border bg-foreground/5 text-foreground border"
                : "border-brand-orange/30 bg-brand-orange/10 text-brand-orange ml-8 border"
            }`}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="border-border bg-foreground/5 text-muted-foreground flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? "Thinking..." : "Tenker..."}
          </div>
        )}
      </div>

      <div className="border-border/50 bg-background/50 border-t p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={isEn ? "Ask about SmartOut docs..." : "Spør om Smartout docs..."}
            className="border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-brand-orange/40 focus:ring-brand-orange/40 flex-1 rounded-xl border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading}
            className="border-brand-orange/30 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 rounded-xl border px-3.5 py-2.5 transition-colors disabled:opacity-50"
            aria-label="Send message"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
